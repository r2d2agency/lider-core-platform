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