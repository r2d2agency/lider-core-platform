import { Router, type Response } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { requireAuth } from "../auth.js";

/**
 * Jornada C.O.R.E. — modelo transversal (Spec Jornada · caso Mariana).
 *
 * - 9-box como entidade própria com histórico por ciclo/estágio:
 *   nasce em O (potencial), ganha desempenho em R, é consolidado em E.
 * - Causa raiz com múltiplas causas categorizadas.
 * - OKR de 90 dias vinculado à meta do ciclo.
 * - Fechamento de ciclo (resultado × meta, recalibração, adesão de agenda).
 * - Snapshot versionado do PDI (4 frentes) — o PDI nunca é recriado.
 * - Acordos do time (comportamento / entrega) do Módulo O.
 */
export const jornadaRouter = Router();
jornadaRouter.use(requireAuth);

function badReq(res: Response, err: unknown) {
  return res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
}

function asDiscFactor(value: unknown): "D" | "I" | "S" | "C" | null {
  return value === "D" || value === "I" || value === "S" || value === "C" ? value : null;
}

function extractDiscSecondary(profile: { discProfile?: unknown; assessmentTraits?: unknown } | null | undefined) {
  const discProfile = profile?.discProfile;
  if (discProfile && typeof discProfile === "object" && !Array.isArray(discProfile)) {
    return asDiscFactor((discProfile as Record<string, unknown>).secondary);
  }
  const assessmentTraits = profile?.assessmentTraits;
  if (assessmentTraits && typeof assessmentTraits === "object" && !Array.isArray(assessmentTraits)) {
    return asDiscFactor((assessmentTraits as Record<string, unknown>).discSecondary);
  }
  return null;
}

function formatDiscProfile(primary: unknown, secondary: unknown) {
  const main = asDiscFactor(primary);
  const aux = asDiscFactor(secondary);
  if (!main) return null;
  return aux ? `${main}${aux}` : main;
}

async function assertOrgAccess(userId: string, orgId: string) {
  const su = await prisma.userRole.findFirst({
    where: { userId, role: { in: ["super_admin", "neo_admin"] } },
  });
  if (su) return true;
  const m = await prisma.membership.findFirst({ where: { userId, organizationId: orgId } });
  return !!m;
}

jornadaRouter.param("orgId", async (req, res, next, orgId) => {
  try {
    if (!(await assertOrgAccess(req.userId!, orgId))) {
      return res.status(403).json({ error: "Forbidden" });
    }
    next();
  } catch (err) {
    console.error("[jornada] falha ao validar acesso", err);
    return res.status(500).json({ error: "Não foi possível validar o acesso agora." });
  }
});

const LEVEL = z.enum(["baixo", "medio", "alto"]);
const STAGE = z.enum(["organizacao", "resultado", "evolucao"]);

// ============================================================
// 9-BOX — entidade própria, com histórico por ciclo e estágio
// ============================================================

jornadaRouter.get("/:orgId/jornada/ninebox", async (req, res) => {
  try {
    const { orgId } = req.params;
    const cycleId = typeof req.query.cycleId === "string" ? req.query.cycleId : null;
    const entries = await prisma.nineBoxEntry.findMany({
      where: { organizationId: orgId, ...(cycleId ? { cycleId } : {}) },
      orderBy: [{ createdAt: "asc" }],
    });
    res.json(entries);
  } catch (err) {
    console.error("[jornada] falha ao carregar 9-box", err);
    res.status(500).json({ error: "Não foi possível carregar o 9-box agora." });
  }
});

const nineBoxSchema = z.object({
  cycleId: z.string().uuid(),
  membershipId: z.string().uuid(),
  subjectUserId: z.string().uuid().optional().nullable(),
  subjectLabel: z.string().optional().nullable(),
  stage: STAGE.default("organizacao"),
  potential: LEVEL.optional().nullable(),
  performance: LEVEL.optional().nullable(),
  notes: z.string().optional().nullable(),
});

/** Upsert por (ciclo, liderado, estágio) — preserva o histórico entre estágios. */
jornadaRouter.put("/:orgId/jornada/ninebox", async (req, res) => {
  try {
    const data = nineBoxSchema.parse(req.body);
    const entry = await prisma.nineBoxEntry.upsert({
      where: {
        cycleId_membershipId_stage: {
          cycleId: data.cycleId,
          membershipId: data.membershipId,
          stage: data.stage,
        },
      },
      create: {
        organizationId: req.params.orgId,
        cycleId: data.cycleId,
        membershipId: data.membershipId,
        subjectUserId: data.subjectUserId ?? null,
        subjectLabel: data.subjectLabel ?? null,
        stage: data.stage,
        potential: data.potential ?? null,
        performance: data.performance ?? null,
        notes: data.notes ?? null,
        createdBy: req.userId!,
      },
      update: {
        ...(data.subjectLabel !== undefined ? { subjectLabel: data.subjectLabel ?? null } : {}),
        ...(data.subjectUserId !== undefined ? { subjectUserId: data.subjectUserId ?? null } : {}),
        ...(data.potential !== undefined ? { potential: data.potential ?? null } : {}),
        ...(data.performance !== undefined ? { performance: data.performance ?? null } : {}),
        ...(data.notes !== undefined ? { notes: data.notes ?? null } : {}),
      },
    });
    res.json(entry);
  } catch (err) { badReq(res, err); }
});

/** Copia o estágio anterior para o próximo (O → R → E), sem perder o histórico. */
jornadaRouter.post("/:orgId/jornada/ninebox/promote", async (req, res) => {
  try {
    const { cycleId, from, to } = z
      .object({ cycleId: z.string().uuid(), from: STAGE, to: STAGE })
      .parse(req.body);
    const source = await prisma.nineBoxEntry.findMany({
      where: { organizationId: req.params.orgId, cycleId, stage: from },
    });
    for (const s of source) {
      await prisma.nineBoxEntry.upsert({
        where: { cycleId_membershipId_stage: { cycleId, membershipId: s.membershipId, stage: to } },
        create: {
          organizationId: s.organizationId,
          cycleId,
          membershipId: s.membershipId,
          subjectUserId: s.subjectUserId,
          subjectLabel: s.subjectLabel,
          stage: to,
          potential: s.potential,
          performance: s.performance,
          createdBy: req.userId!,
        },
        update: { potential: s.potential },
      });
    }
    res.json({ copied: source.length });
  } catch (err) { badReq(res, err); }
});

// ============================================================
// CAUSA RAIZ — múltiplas causas por ciclo
// ============================================================

jornadaRouter.get("/:orgId/jornada/root-causes", async (req, res) => {
  const cycleId = typeof req.query.cycleId === "string" ? req.query.cycleId : undefined;
  const rows = await prisma.rootCause.findMany({
    where: { organizationId: req.params.orgId, ...(cycleId ? { cycleId } : {}) },
    orderBy: { createdAt: "asc" },
  });
  res.json(rows);
});

jornadaRouter.post("/:orgId/jornada/root-causes", async (req, res) => {
  try {
    const data = z
      .object({
        cycleId: z.string().uuid(),
        category: z.enum(["comportamental", "processo", "dado", "estrutural", "outro"]),
        description: z.string().min(3),
      })
      .parse(req.body);
    const created = await prisma.rootCause.create({
      data: {
        organizationId: req.params.orgId,
        cycleId: data.cycleId,
        category: data.category,
        description: data.description,
        createdBy: req.userId!,
      },
    });
    res.status(201).json(created);
  } catch (err) { badReq(res, err); }
});

jornadaRouter.delete("/:orgId/jornada/root-causes/:id", async (req, res) => {
  await prisma.rootCause.delete({ where: { id: req.params.id } }).catch(() => null);
  res.status(204).end();
});

// ============================================================
// OKR de 90 dias
// ============================================================

jornadaRouter.get("/:orgId/jornada/okrs", async (req, res) => {
  const cycleId = typeof req.query.cycleId === "string" ? req.query.cycleId : undefined;
  const rows = await prisma.cycleOkr.findMany({
    where: { organizationId: req.params.orgId, ...(cycleId ? { cycleId } : {}) },
    include: { keyResults: { orderBy: { createdAt: "asc" } } },
    orderBy: { createdAt: "desc" },
  });
  res.json(rows);
});

jornadaRouter.post("/:orgId/jornada/okrs", async (req, res) => {
  try {
    const data = z
      .object({
        cycleId: z.string().uuid(),
        objective: z.string().min(3),
        linkedGoalId: z.string().uuid().optional().nullable(),
        horizonDays: z.number().int().min(7).max(365).default(90),
        plan90: z.array(z.record(z.unknown())).optional().nullable(),
        keyResults: z
          .array(
            z.object({
              title: z.string().min(2),
              targetValue: z.number().optional().nullable(),
              unit: z.string().optional().nullable(),
            }),
          )
          .max(3)
          .default([]),
      })
      .parse(req.body);
    const created = await prisma.cycleOkr.create({
      data: {
        organizationId: req.params.orgId,
        cycleId: data.cycleId,
        objective: data.objective,
        plan90: (data.plan90 ?? null) as unknown as object,
        linkedGoalId: data.linkedGoalId ?? null,
        horizonDays: data.horizonDays,
        createdBy: req.userId!,
        keyResults: {
          create: data.keyResults.map((k) => ({
            title: k.title,
            targetValue: k.targetValue ?? null,
            unit: k.unit ?? null,
          })),
        },
      },
      include: { keyResults: true },
    });
    res.status(201).json(created);
  } catch (err) { badReq(res, err); }
});

jornadaRouter.patch("/:orgId/jornada/okrs/:id/key-results/:krId", async (req, res) => {
  try {
    const data = z
      .object({
        currentValue: z.number().optional().nullable(),
        done: z.boolean().optional(),
      })
      .parse(req.body);
    const kr = await prisma.cycleOkrKeyResult.update({
      where: { id: req.params.krId },
      data: {
        ...(data.currentValue !== undefined ? { currentValue: data.currentValue ?? null } : {}),
        ...(data.done !== undefined ? { done: data.done } : {}),
      },
    });
    res.json(kr);
  } catch (err) { badReq(res, err); }
});

jornadaRouter.delete("/:orgId/jornada/okrs/:id", async (req, res) => {
  await prisma.cycleOkr.delete({ where: { id: req.params.id } }).catch(() => null);
  res.status(204).end();
});

// ============================================================
// FECHAMENTO DE CICLO — resultado × meta, recalibração, adesão de agenda
// ============================================================

/** Adesão de agenda: rituais planejados (O) × ocorrências realizadas (R). */
async function computeAgendaAdherence(orgId: string, startAt: Date, endAt: Date) {
  const rituals = await prisma.ritual.findMany({
    where: { organizationId: orgId },
    select: { id: true, name: true, type: true },
  });
  const occurrences = await prisma.ritualOccurrence.findMany({
    where: {
      ritualId: { in: rituals.map((r) => r.id) },
      scheduledAt: { gte: startAt, lte: endAt },
    },
    select: { ritualId: true, status: true },
  });
  return rituals.map((r) => {
    const own = occurrences.filter((o) => o.ritualId === r.id);
    const done = own.filter((o) => o.status === "done").length;
    return {
      ritualId: r.id,
      title: r.name,
      type: r.type,
      planned: own.length,
      done,
      percent: own.length ? Math.round((done / own.length) * 100) : 0,
    };
  });
}

jornadaRouter.get("/:orgId/jornada/closure/:cycleId", async (req, res) => {
  try {
    const { orgId, cycleId } = req.params;
    const cycle = await prisma.cycle.findFirst({
      where: { id: cycleId, organizationId: orgId },
      include: { goals: true },
    });
    if (!cycle) return res.status(404).json({ error: "Ciclo não encontrado" });

    const [closure, causes, okrs, nineBox, adherence] = await Promise.all([
      prisma.cycleClosure.findUnique({ where: { cycleId } }),
      prisma.rootCause.findMany({ where: { cycleId }, orderBy: { createdAt: "asc" } }),
      prisma.cycleOkr.findMany({ where: { cycleId }, include: { keyResults: true } }),
      prisma.nineBoxEntry.findMany({ where: { cycleId } }),
      computeAgendaAdherence(orgId, cycle.startAt, cycle.endAt),
    ]);

    res.json({ cycle, closure, causes, okrs, nineBox, adherence });
  } catch (err) {
    console.error("[jornada] falha ao carregar fechamento", err);
    res.status(500).json({ error: "Não foi possível carregar o fechamento do ciclo." });
  }
});

const closureSchema = z.object({
  targetValue: z.number().optional().nullable(),
  resultValue: z.number().optional().nullable(),
  targetLabel: z.string().optional().nullable(),
  recalibrateGoal: z.boolean().optional(),
  recalibrateReason: z.string().optional().nullable(),
  learnings: z.string().optional().nullable(),
  decision: z.string().optional().nullable(),
  coachSuggestion: z.string().optional().nullable(),
  coachResponse: z.string().optional().nullable(),
  radarSnapshot: z.record(z.unknown()).optional().nullable(),
  closeCycle: z.boolean().optional(),
});

jornadaRouter.put("/:orgId/jornada/closure/:cycleId", async (req, res) => {
  try {
    const { orgId, cycleId } = req.params;
    const data = closureSchema.parse(req.body);
    const cycle = await prisma.cycle.findFirst({ where: { id: cycleId, organizationId: orgId } });
    if (!cycle) return res.status(404).json({ error: "Ciclo não encontrado" });

    const adherence = await computeAgendaAdherence(orgId, cycle.startAt, cycle.endAt);
    const payload = {
      targetValue: data.targetValue ?? null,
      resultValue: data.resultValue ?? null,
      targetLabel: data.targetLabel ?? null,
      recalibrateGoal: data.recalibrateGoal ?? false,
      recalibrateReason: data.recalibrateReason ?? null,
      learnings: data.learnings ?? null,
      decision: data.decision ?? null,
      coachSuggestion: data.coachSuggestion ?? null,
      coachResponse: data.coachResponse ?? null,
      radarSnapshot: (data.radarSnapshot ?? null) as unknown as object,
      agendaAdherence: adherence as unknown as object,
    };

    const closure = await prisma.cycleClosure.upsert({
      where: { cycleId },
      create: { organizationId: orgId, cycleId, createdBy: req.userId!, ...payload },
      update: payload,
    });

    if (data.closeCycle) {
      await prisma.cycle.update({ where: { id: cycleId }, data: { status: "closed" } });
    }
    res.json(closure);
  } catch (err) { badReq(res, err); }
});

// ============================================================
// PDI — snapshots versionados (4 frentes)
// ============================================================

jornadaRouter.get("/:orgId/jornada/pdi-snapshots", async (req, res) => {
  const subjectUserId =
    typeof req.query.subjectUserId === "string" ? req.query.subjectUserId : req.userId!;
  const rows = await prisma.pdiSnapshot.findMany({
    where: { organizationId: req.params.orgId, subjectUserId },
    orderBy: { version: "desc" },
  });
  res.json(rows);
});

jornadaRouter.get("/:orgId/jornada/hsh-history", async (req, res) => {
  const subjectUserId =
    typeof req.query.subjectUserId === "string" ? req.query.subjectUserId : req.userId!;
  const snapshots = await prisma.pdiSnapshot.findMany({
    where: { organizationId: req.params.orgId, subjectUserId },
    orderBy: { version: "desc" },
    select: { version: true, createdAt: true, radarSnapshot: true },
  });
  res.json(snapshots);
});

jornadaRouter.post("/:orgId/jornada/pdi-snapshots", async (req, res) => {
  try {
    const data = z
      .object({
        subjectUserId: z.string().uuid().optional(),
        pdiId: z.string().uuid().optional().nullable(),
        cycleId: z.string().uuid().optional().nullable(),
        selfDevelopment: z.array(z.string()).default([]),
        teamFront: z.array(z.string()).default([]),
        ritualsFront: z.array(z.string()).default([]),
        goalsFront: z.array(z.string()).default([]),
        radarSnapshot: z.record(z.unknown()).optional().nullable(),
      })
      .parse(req.body);
    const subjectUserId = data.subjectUserId ?? req.userId!;
    const last = await prisma.pdiSnapshot.findFirst({
      where: { organizationId: req.params.orgId, subjectUserId },
      orderBy: { version: "desc" },
    });
    const created = await prisma.pdiSnapshot.create({
      data: {
        organizationId: req.params.orgId,
        subjectUserId,
        pdiId: data.pdiId ?? null,
        cycleId: data.cycleId ?? null,
        version: (last?.version ?? 0) + 1,
        selfDevelopment: data.selfDevelopment,
        teamFront: data.teamFront,
        ritualsFront: data.ritualsFront,
        goalsFront: data.goalsFront,
        radarSnapshot: (data.radarSnapshot ?? null) as unknown as object,
        createdBy: req.userId!,
      },
    });
    res.status(201).json(created);
  } catch (err) { badReq(res, err); }
});

// ============================================================
// ACORDOS DO TIME (Módulo O)
// ============================================================

jornadaRouter.get("/:orgId/jornada/agreements", async (req, res) => {
  const rows = await prisma.teamAgreement.findMany({
    where: { organizationId: req.params.orgId },
    orderBy: { createdAt: "asc" },
  });
  res.json(rows);
});

jornadaRouter.post("/:orgId/jornada/agreements", async (req, res) => {
  try {
    const data = z
      .object({
        kind: z.enum(["comportamento", "entrega"]).default("comportamento"),
        text: z.string().min(3),
        teamId: z.string().uuid().optional().nullable(),
        areaId: z.string().uuid().optional().nullable(),
      })
      .parse(req.body);
    const created = await prisma.teamAgreement.create({
      data: {
        organizationId: req.params.orgId,
        kind: data.kind,
        text: data.text,
        teamId: data.teamId ?? null,
        areaId: data.areaId ?? null,
        createdBy: req.userId!,
      },
    });
    res.status(201).json(created);
  } catch (err) { badReq(res, err); }
});

jornadaRouter.delete("/:orgId/jornada/agreements/:id", async (req, res) => {
  await prisma.teamAgreement.delete({ where: { id: req.params.id } }).catch(() => null);
  res.status(204).end();
});
// ============================================================
// VISÃO GERAL DA JORNADA — status por etapa (C, O, R, E)
// ============================================================

type StepStatus = "done" | "partial" | "todo";
type JourneyStep = {
  key: string;
  label: string;
  status: StepStatus;
  detail: string;
  to: string;
};

const mark = (ok: boolean, partial = false): StepStatus =>
  ok ? "done" : partial ? "partial" : "todo";

jornadaRouter.get("/:orgId/jornada/progress", async (req, res) => {
  try {
    const { orgId } = req.params;
    const userId = req.userId!;
    const cycleIdParam = typeof req.query.cycleId === "string" ? req.query.cycleId : null;

    const cycles = await prisma.cycle.findMany({
      where: { organizationId: orgId },
      orderBy: [{ startAt: "desc" }],
      include: { goals: true },
    });
    const cycle =
      (cycleIdParam ? cycles.find((c) => c.id === cycleIdParam) : null) ??
      cycles.find((c) => c.status === "active") ??
      cycles[0] ??
      null;

    const [
      profile,
      pdiCount,
      memberships,
      memberProfiles,
      rituals,
      agreements,
      delegations,
      feedbacks,
      nineBox,
      closure,
      causes,
      okrs,
      snapshots,
      radarSnapshots,
      occurrences,
    ] = await Promise.all([
      prisma.leaderProfile.findFirst({ where: { organizationId: orgId, userId } }),
      prisma.pdi.count({ where: { organizationId: orgId, subjectUserId: userId } }),
      prisma.membership.count({ where: { organizationId: orgId } }),
      prisma.teamMemberProfile.count({ where: { organizationId: orgId } }),
      prisma.ritual.count({ where: { organizationId: orgId, status: "active" } }),
      prisma.teamAgreement.findMany({ where: { organizationId: orgId } }),
      prisma.delegation.count({ where: { organizationId: orgId } }),
      prisma.feedbackRecord.count({ where: { organizationId: orgId } }),
      cycle
        ? prisma.nineBoxEntry.findMany({ where: { organizationId: orgId, cycleId: cycle.id } })
        : Promise.resolve([]),
      cycle
        ? prisma.cycleClosure.findUnique({ where: { cycleId: cycle.id } })
        : Promise.resolve(null),
      cycle
        ? prisma.rootCause.count({ where: { organizationId: orgId, cycleId: cycle.id } })
        : Promise.resolve(0),
      cycle
        ? prisma.cycleOkr.count({ where: { organizationId: orgId, cycleId: cycle.id } })
        : Promise.resolve(0),
      prisma.pdiSnapshot.count({ where: { organizationId: orgId, subjectUserId: userId } }),
      prisma.leadershipScoreSnapshot.count({ where: { organizationId: orgId, userId } }),
      cycle
        ? prisma.ritualOccurrence.count({
            where: {
              status: "done",
              scheduledAt: { gte: cycle.startAt, lte: cycle.endAt },
              ritual: { organizationId: orgId },
            },
          })
        : Promise.resolve(0),
    ]);

    const discSecondary = extractDiscSecondary(profile);
    const discProfileLabel = formatDiscProfile(profile?.discPrimary, discSecondary);
    const hsh =
      profile?.hardSelfScore != null &&
      profile?.softSelfScore != null &&
      profile?.heartSelfScore != null;
    const goalsWithIndicator = (cycle?.goals ?? []).filter((g) => !!g.indicatorId).length;
    const potentialEntries = nineBox.filter((e) => e.potential != null).length;
    const performanceEntries = nineBox.filter((e) => e.performance != null).length;
    const behaviourAgreements = agreements.filter((a) => a.kind === "comportamento").length;
    const deliveryAgreements = agreements.filter((a) => a.kind === "entrega").length;

    const consciencia: JourneyStep[] = [
      {
        key: "disc",
        label: "Assessment DISC",
        status: mark(!!(profile?.discPrimary && discSecondary), !!profile?.discPrimary),
        detail: discProfileLabel
          ? `Perfil predominante: ${discProfileLabel}`
          : "Ainda não respondido",
        to: "/app/consciencia/disc",
      },
      { key: "sabotadores", label: "Sabotadores", status: mark((profile?.sabotages?.length ?? 0) > 0), detail: (profile?.sabotages?.length ?? 0) > 0 ? `Padrões: ${profile!.sabotages.join(", ")}` : "Ainda não respondido", to: "/app/consciencia/assessment" },
      { key: "cerebral", label: "Predominância cerebral (4 animais)", status: mark(!!profile?.cerebralPrimary), detail: profile?.cerebralPrimary ? `Predominância: ${profile.cerebralPrimary}` : "Ainda não respondido", to: "/app/consciencia/assessment" },
      { key: "hsh", label: "Radar Hard · Soft · Heart", status: mark(hsh), detail: hsh ? `Hard ${profile!.hardSelfScore} · Soft ${profile!.softSelfScore} · Heart ${profile!.heartSelfScore}` : "Radar HSH pendente", to: "/app/consciencia" },
      { key: "cargo", label: "Descrição de cargo e atividades", status: mark(!!(profile?.activityDescription || profile?.activityDocText)), detail: profile?.activityDescription || profile?.activityDocText ? "Descrição registrada" : "Descreva ou envie o documento das suas atividades", to: "/app/consciencia/activity" },
      { key: "pdi", label: "PDI criado", status: mark(pdiCount > 0), detail: pdiCount > 0 ? `${pdiCount} PDI(s) ativos` : "O PDI nasce do cruzamento Radar + Sabotadores + cargo", to: "/app/consciencia/pdi" },
    ];

    const organizacao: JourneyStep[] = [
      { key: "meta", label: "Meta do período com indicador", status: mark(goalsWithIndicator > 0, (cycle?.goals.length ?? 0) > 0), detail: goalsWithIndicator > 0 ? `${goalsWithIndicator} meta(s) vinculada(s) a indicador` : cycle ? "Ciclo criado, mas sem meta ligada a indicador" : "Nenhum ciclo criado", to: "/app/organization/cycles" },
      { key: "mapa", label: "Mapa do time (liderados e papéis)", status: mark(memberships > 1 && memberProfiles > 0, memberships > 1), detail: memberships > 1 ? `${memberships} pessoas · ${memberProfiles} com papel definido` : "Cadastre os liderados da sua equipe", to: "/app/team" },
      { key: "rituais", label: "Agenda de rituais combinada", status: mark(rituals >= 3, rituals > 0), detail: rituals > 0 ? `${rituals} ritual(is) ativos` : "Combine 1:1, gestão à vista e reunião de indicadores", to: "/app/organization/rituals" },
      { key: "ninebox-o", label: "9-Box baseline (potencial)", status: mark(potentialEntries > 0), detail: potentialEntries > 0 ? `${potentialEntries} liderado(s) avaliados em potencial` : "Faça a primeira leitura de potencial do time", to: "/app/ninebox" },
      { key: "acordos", label: "Acordos de comportamento e entrega", status: mark(behaviourAgreements > 0 && deliveryAgreements > 0, agreements.length > 0), detail: agreements.length > 0 ? `${behaviourAgreements} de comportamento · ${deliveryAgreements} de entrega` : "Registre o que o time não abre mão", to: "/app/organization/agreements" },
    ];

    const resultado: JourneyStep[] = [
      { key: "time", label: "Time confirmado em execução", status: mark(memberships > 1), detail: memberships > 1 ? `${memberships - 1} liderado(s) confirmados` : "Confirme o time herdado de Organização", to: "/app/team" },
      { key: "delegacoes", label: "Meta desmembrada em delegações", status: mark(delegations > 0), detail: delegations > 0 ? `${delegations} delegação(ões) registradas` : "Desmembre a meta por pessoa, com prazo", to: "/app/organization/delegations" },
      { key: "feedbacks", label: "Feedbacks estruturados", status: mark(feedbacks > 0), detail: feedbacks > 0 ? `${feedbacks} feedback(s) no histórico` : "Registre os primeiros feedbacks do ciclo", to: "/app/feedbacks" },
      { key: "ninebox-r", label: "9-Box com desempenho real", status: mark(performanceEntries > 0), detail: performanceEntries > 0 ? `${performanceEntries} liderado(s) com desempenho lançado` : "O segundo eixo do 9-box nasce aqui", to: "/app/ninebox" },
      { key: "rituais-log", label: "Rituais realmente executados", status: mark(occurrences > 0), detail: occurrences > 0 ? `${occurrences} ocorrência(s) concluídas no ciclo` : "Sem execução registrada — a adesão de agenda ficará em 0%", to: "/app/organization/agenda" },
    ];

    const evolucao: JourneyStep[] = [
      { key: "resultado", label: "Resultado do período × meta", status: mark(closure?.resultValue != null), detail: closure?.resultValue != null ? `Realizado ${closure.resultValue}${closure.targetValue != null ? ` de ${closure.targetValue}` : ""}` : "Lance o realizado do ciclo", to: "/app/cycle-closure" },
      { key: "adesao", label: "Adesão de agenda (planejado × realizado)", status: mark(!!closure?.agendaAdherence, occurrences > 0), detail: closure?.agendaAdherence ? "Auditoria de agenda calculada" : "Calculada automaticamente ao salvar o fechamento", to: "/app/cycle-closure" },
      { key: "causa", label: "Causa raiz (múltiplas causas)", status: mark(causes > 0), detail: causes > 0 ? `${causes} causa(s) mapeadas` : "Aplique os 5 Porquês — pode haver mais de uma causa", to: "/app/cycle-closure" },
      { key: "recalibrar", label: "Decisão de recalibrar a meta", status: mark(!!closure?.recalibrateReason, !!closure), detail: closure?.recalibrateReason ? (closure.recalibrateGoal ? "Meta recalibrada" : "Meta mantida, com justificativa") : "Decida e justifique", to: "/app/cycle-closure" },
      { key: "radar-novo", label: "Radar HSH do novo ciclo", status: mark(radarSnapshots > 1, radarSnapshots > 0), detail: radarSnapshots > 1 ? `${radarSnapshots} medições — já há comparação` : "Reaplique o radar para comparar sua evolução", to: "/app/evolution" },
      { key: "coach", label: "Recomendação da IA Coach respondida", status: mark(!!closure?.coachResponse, !!closure?.coachSuggestion), detail: closure?.coachResponse ? "Você registrou sua resposta à trilha sugerida" : "Leia a sugestão do Coach e diga se concorda", to: "/app/coach" },
      { key: "okr", label: "OKR dos próximos 90 dias", status: mark(okrs > 0), detail: okrs > 0 ? `${okrs} OKR(s) do ciclo` : "Escreva 1 objetivo com até 3 key results", to: "/app/cycle-closure" },
      { key: "pdi-v", label: "PDI atualizado (4 frentes, versionado)", status: mark(snapshots > 0), detail: snapshots > 0 ? `${snapshots} versão(ões) no histórico` : "Consolide o PDI ao fechar o ciclo", to: "/app/cycle-closure" },
    ];

    const stages = [
      { key: "C", name: "Consciência", subtitle: "Quem eu sou como líder", steps: consciencia },
      { key: "O", name: "Organização", subtitle: "Estrutura, meta e combinados", steps: organizacao },
      { key: "R", name: "Resultado", subtitle: "Execução e desempenho real", steps: resultado },
      { key: "E", name: "Evolução", subtitle: "PDCA, causa raiz e próximo ciclo", steps: evolucao },
    ].map((s) => {
      const score = s.steps.reduce((acc, st) => acc + (st.status === "done" ? 1 : st.status === "partial" ? 0.5 : 0), 0);
      return { ...s, percent: Math.round((score / s.steps.length) * 100) };
    });

    const nextSteps = stages
      .flatMap((s) => s.steps.filter((st) => st.status !== "done").map((st) => ({ ...st, stage: s.key, stageName: s.name })))
      .slice(0, 5);

    const overall = Math.round(stages.reduce((a, s) => a + s.percent, 0) / stages.length);

    res.json({
      cycle: cycle ? { id: cycle.id, name: cycle.name, status: cycle.status, startAt: cycle.startAt, endAt: cycle.endAt } : null,
      cycles: cycles.map((c) => ({ id: c.id, name: c.name, status: c.status })),
      overall,
      stages,
      nextSteps,
    });
  } catch (err) {
    console.error("[jornada] progress", err);
    res.status(500).json({ error: "Não foi possível calcular o progresso da jornada." });
  }
});
