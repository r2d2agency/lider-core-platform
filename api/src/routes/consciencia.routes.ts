import { Router, type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { requireAuth } from "../auth.js";
import { completeChat, extractDocumentText } from "../lib/ai-gateway.js";
import { heuristicTrack, type TrackStep } from "../lib/subordinate-track.js";
import { neoContextMessage } from "../lib/neo-context.js";
import { DISC_FACTORS, type DiscFactor } from "../lib/disc.js";

/**
 * MÓDULO C — Consciência.
 *
 * Regra de visibilidade: perfil detalhado (assessment, sabotadores, riscos)
 * é SOMENTE do próprio líder. A organização vê apenas cobertura agregada
 * (existência do perfil, não conteúdo).
 */
export const conscienciaRouter = Router();
conscienciaRouter.use(requireAuth);

function asyncRoute(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    void handler(req, res, next).catch(next);
  };
}

async function isSuper(userId: string) {
  const r = await prisma.userRole.findFirst({
    where: { userId, role: { in: ["super_admin", "neo_admin"] } },
  });
  return !!r;
}
async function assertOrgAccess(userId: string, orgId: string) {
  if (await isSuper(userId)) return true;
  const m = await prisma.membership.findFirst({ where: { userId, organizationId: orgId } });
  return !!m;
}
function badReq(res: Response, err: unknown) {
  return res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
}

function asDiscFactor(value: unknown): DiscFactor | null {
  return value === "D" || value === "I" || value === "S" || value === "C" ? value : null;
}

function describeDiscProfile(primary: DiscFactor | null, secondary: DiscFactor | null) {
  if (!primary) return "Sem perfil identificado";
  return secondary
    ? `Perfil ${primary}${secondary} — ${DISC_FACTORS[primary].name} com ${DISC_FACTORS[secondary].name}`
    : `Perfil ${primary} — ${DISC_FACTORS[primary].name}`;
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

conscienciaRouter.param("orgId", async (req, res, next, orgId) => {
  const userId = req.userId;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  try {
    if (!(await assertOrgAccess(userId, orgId))) {
      return res.status(403).json({ error: "Forbidden" });
    }
    next();
  } catch (err) {
    console.error("[consciencia] falha ao validar acesso", err);
    res.status(500).json({ error: "Não foi possível validar seu acesso agora." });
  }
});

// ------------------------------------------------------------
// GET /:orgId/consciencia/me — perfil + compromissos + alertas
// ------------------------------------------------------------
conscienciaRouter.get("/:orgId/consciencia/me", asyncRoute(async (req, res) => {
  const userId = req.userId;
  const orgId = req.params.orgId;
  const subjectUserId = typeof req.query.subjectUserId === "string" ? req.query.subjectUserId : userId;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const includePersonalPdi = subjectUserId === userId;
  const [profile, commitments, signals, personalPdis] = await Promise.all([
    prisma.leaderProfile.findUnique({
      where: { organizationId_userId: { organizationId: orgId, userId: subjectUserId! } },
      select: {
        id: true,
        declaredRole: true,
        notMine: true,
        assessmentType: true,
        assessmentTraits: true,
        sabotages: true,
        communicationStyle: true,
        mbtiType: true,
        discPrimary: true,
        egogramaTraits: true,
        hardSelfScore: true,
        softSelfScore: true,
        heartSelfScore: true,
        riskFlags: true,
        strengths: true,
        notes: true,
        assessmentAt: true,
        activityDescription: true,
        activityDescriptionUrl: true,
        activityDocName: true,
        activityDocAt: true,
        coachCadence: true,
        sabotageScores: true,
        cerebralProfile: true,
        cerebralPrimary: true,
        qpScore: true,
        hardAnswers: true,
        softAnswers: true,
        heartAnswers: true,
        discAnswers: true,
        discProfile: true,
        autoPdiId: true,
        autoPdiGeneratedAt: true,
        coachTrackMarkdown: true,
        coachTrackPlan: true,
        coachTrackGeneratedAt: true,
        updatedAt: true,
      },
    }).catch((err) => {
      console.error("[consciencia] falha ao carregar perfil", err);
      return null;
    }),
    prisma.mentorshipCommitment.findMany({
      where: { organizationId: orgId, userId },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    }).catch((err) => {
      console.error("[consciencia] falha ao carregar compromissos", err);
      return [];
    }),
    prisma.crossSignal.findMany({
      where: { organizationId: orgId, userId, dismissedAt: null },
      orderBy: { createdAt: "desc" },
      take: 20,
    }).catch((err) => {
      console.error("[consciencia] falha ao carregar alertas", err);
      return [];
    }),
    includePersonalPdi
      ? prisma.pdi.findMany({
        where: { organizationId: orgId, subjectUserId: userId },
        include: { goals: true },
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      }).catch((err) => {
        console.error("[consciencia] falha ao carregar ciclo pessoal de PDI", err);
        return [];
      })
      : Promise.resolve([]),
  ]);

  const stale = profile?.assessmentAt
    ? Date.now() - profile.assessmentAt.getTime() > 90 * 86400000
    : profile != null;

  const shapedProfile = profile
    ? {
        ...profile,
        discSecondary: extractDiscSecondary(profile),
      }
    : null;

  const currentPersonalPdi = includePersonalPdi
    ? pickCurrentPersonalPdi(personalPdis as PersonalPdiRecord[], profile?.autoPdiId ?? null)
    : null;
  const personalPdiSummary = includePersonalPdi
    ? summarizePersonalPdis(personalPdis as PersonalPdiRecord[], profile?.autoPdiId ?? null)
    : null;

  res.json({
    profile: shapedProfile,
    commitments,
    signals,
    assessmentStale: stale,
    currentPersonalPdi: serializePersonalPdi(currentPersonalPdi),
    personalPdiSummary,
  });
}));

// ------------------------------------------------------------
// PUT /:orgId/consciencia/me — upsert do meu perfil
// ------------------------------------------------------------
const profileSchema = z.object({
  declaredRole: z.string().optional().nullable(),
  notMine: z.string().optional().nullable(),
  assessmentType: z.enum(["disc", "big_five", "other"]).optional().nullable(),
  assessmentTraits: z.record(z.any()).optional().nullable(),
  sabotages: z.array(z.string()).default([]),
  communicationStyle: z.string().optional().nullable(),
  mbtiType: z.string().max(4).optional().nullable(),
  discPrimary: z.enum(["D", "I", "S", "C"]).optional().nullable(),
  discSecondary: z.enum(["D", "I", "S", "C"]).optional().nullable(),
  egogramaTraits: z.record(z.any()).optional().nullable(),
  hardSelfScore: z.number().int().min(0).max(100).optional().nullable(),
  softSelfScore: z.number().int().min(0).max(100).optional().nullable(),
  heartSelfScore: z.number().int().min(0).max(100).optional().nullable(),
  riskFlags: z.array(z.string()).default([]),
  strengths: z.array(z.string()).default([]),
  notes: z.string().optional().nullable(),
  markAssessedNow: z.boolean().optional(),
});

// Módulo C v2 — extensão do perfil
const profileV2Schema = profileSchema.extend({
  activityDescription: z.string().optional().nullable(),
  sabotageScores: z.record(z.number()).optional().nullable(),
  cerebralProfile: z.record(z.number()).optional().nullable(),
  cerebralPrimary: z.enum(["aguia", "lobo", "gato", "tubarao"]).optional().nullable(),
  qpScore: z.number().int().min(0).max(100).optional().nullable(),
  hardAnswers: z.array(z.number()).optional().nullable(),
  softAnswers: z.array(z.number()).optional().nullable(),
  heartAnswers: z.array(z.number()).optional().nullable(),
  discAnswers: z.record(z.any()).optional().nullable(),
  discProfile: z.record(z.any()).optional().nullable(),
  coachCadence: z.enum(["weekly", "biweekly", "monthly"]).optional(),
});

conscienciaRouter.put("/:orgId/consciencia/me", async (req, res) => {
  try {
    const data = profileV2Schema.parse(req.body);
    const userId = req.userId!;
    const orgId = req.params.orgId;

    if (data.discPrimary && data.discSecondary && data.discPrimary === data.discSecondary) {
      return res.status(400).json({
        error: "DISC principal e secundário precisam ser diferentes.",
      });
    }
    if (!data.discPrimary && data.discSecondary) {
      return res.status(400).json({
        error: "Defina um perfil DISC principal antes do secundário.",
      });
    }

    const assessmentAt = data.markAssessedNow ? new Date() : undefined;
    const current = await prisma.leaderProfile.findUnique({
      where: { organizationId_userId: { organizationId: orgId, userId } },
      select: { discProfile: true, assessmentTraits: true },
    });

    const primary = data.discPrimary === undefined ? undefined : (data.discPrimary ?? null);
    const secondary = data.discSecondary === undefined ? undefined : (data.discSecondary ?? null);

    const currentDiscProfile =
      current?.discProfile && typeof current.discProfile === "object" && !Array.isArray(current.discProfile)
        ? { ...(current.discProfile as Record<string, unknown>) }
        : null;
    const incomingDiscProfile =
      data.discProfile && typeof data.discProfile === "object" && !Array.isArray(data.discProfile)
        ? { ...(data.discProfile as Record<string, unknown>) }
        : data.discProfile === null
          ? null
          : undefined;
    const nextDiscProfile =
      incomingDiscProfile !== undefined
        ? incomingDiscProfile
        : primary !== undefined || secondary !== undefined
          ? { ...(currentDiscProfile ?? {}) }
          : undefined;

    if (nextDiscProfile) {
      if (!("kind" in nextDiscProfile)) nextDiscProfile.kind = "disc_profile";
      if (primary !== undefined) nextDiscProfile.primary = primary;
      if (secondary !== undefined) nextDiscProfile.secondary = secondary;
      const nextPrimary = asDiscFactor(nextDiscProfile.primary);
      const nextSecondary = asDiscFactor(nextDiscProfile.secondary);
      nextDiscProfile.profile = describeDiscProfile(nextPrimary, nextSecondary);
    }

    const currentTraits =
      current?.assessmentTraits && typeof current.assessmentTraits === "object" && !Array.isArray(current.assessmentTraits)
        ? { ...(current.assessmentTraits as Record<string, unknown>) }
        : null;
    const nextAssessmentTraits =
      primary !== undefined || secondary !== undefined
        ? {
            ...(currentTraits ?? {}),
            ...(primary !== undefined ? { discPrimary: primary } : {}),
            ...(secondary !== undefined ? { discSecondary: secondary } : {}),
          }
        : undefined;

    const v2Fields = {
      ...(data.activityDescription !== undefined ? { activityDescription: data.activityDescription ?? null } : {}),
      ...(data.sabotageScores !== undefined ? { sabotageScores: (data.sabotageScores ?? null) as never } : {}),
      ...(data.cerebralProfile !== undefined ? { cerebralProfile: (data.cerebralProfile ?? null) as never } : {}),
      ...(data.cerebralPrimary !== undefined ? { cerebralPrimary: data.cerebralPrimary ?? null } : {}),
      ...(data.qpScore !== undefined ? { qpScore: data.qpScore ?? null } : {}),
      ...(data.hardAnswers !== undefined ? { hardAnswers: (data.hardAnswers ?? null) as never } : {}),
      ...(data.softAnswers !== undefined ? { softAnswers: (data.softAnswers ?? null) as never } : {}),
      ...(data.heartAnswers !== undefined ? { heartAnswers: (data.heartAnswers ?? null) as never } : {}),
      ...(data.discAnswers !== undefined ? { discAnswers: (data.discAnswers ?? null) as never } : {}),
      ...(nextDiscProfile !== undefined ? { discProfile: (nextDiscProfile ?? null) as never } : {}),
      ...(nextAssessmentTraits !== undefined ? { assessmentTraits: nextAssessmentTraits as never } : {}),
      ...(data.coachCadence !== undefined ? { coachCadence: data.coachCadence } : {}),
    };

    const saved = await prisma.leaderProfile.upsert({
      where: { organizationId_userId: { organizationId: orgId, userId } },
      update: {
        declaredRole: data.declaredRole ?? null,
        notMine: data.notMine ?? null,
        assessmentType: data.assessmentType ?? null,
        assessmentTraits: nextAssessmentTraits !== undefined
          ? (nextAssessmentTraits as never)
          : (data.assessmentTraits ?? null) as never,
        sabotages: data.sabotages,
        communicationStyle: data.communicationStyle ?? null,
        mbtiType: data.mbtiType ?? null,
        discPrimary: data.discPrimary ?? null,
        egogramaTraits: (data.egogramaTraits ?? null) as never,
        hardSelfScore: data.hardSelfScore ?? null,
        softSelfScore: data.softSelfScore ?? null,
        heartSelfScore: data.heartSelfScore ?? null,
        riskFlags: data.riskFlags,
        strengths: data.strengths,
        notes: data.notes ?? null,
        ...(assessmentAt ? { assessmentAt } : {}),
        ...v2Fields,
      },
      create: {
        organizationId: orgId,
        userId,
        declaredRole: data.declaredRole ?? null,
        notMine: data.notMine ?? null,
        assessmentType: data.assessmentType ?? null,
        assessmentTraits: nextAssessmentTraits !== undefined
          ? (nextAssessmentTraits as never)
          : (data.assessmentTraits ?? null) as never,
        sabotages: data.sabotages,
        communicationStyle: data.communicationStyle ?? null,
        mbtiType: data.mbtiType ?? null,
        discPrimary: data.discPrimary ?? null,
        egogramaTraits: (data.egogramaTraits ?? null) as never,
        hardSelfScore: data.hardSelfScore ?? null,
        softSelfScore: data.softSelfScore ?? null,
        heartSelfScore: data.heartSelfScore ?? null,
        riskFlags: data.riskFlags,
        strengths: data.strengths,
        notes: data.notes ?? null,
        assessmentAt: assessmentAt ?? new Date(),
        ...v2Fields,
      },
    });

    // Recomputa sinais cruzados assim que o perfil muda
    await computeCrossSignals(orgId, userId).catch((e) => console.error("[cross-signals]", e));

    res.json(saved);
  } catch (err) {
    badReq(res, err);
  }
});

// ------------------------------------------------------------
// COVERAGE — só quantitativo, jamais conteúdo
// ------------------------------------------------------------
conscienciaRouter.get("/:orgId/consciencia/coverage", asyncRoute(async (req, res) => {
  const orgId = req.params.orgId;
  const [totalMembers, profiled, assessed] = await Promise.all([
    prisma.membership.count({ where: { organizationId: orgId } }),
    prisma.leaderProfile.count({ where: { organizationId: orgId } }),
    prisma.leaderProfile.count({
      where: { organizationId: orgId, assessmentType: { not: null } },
    }),
  ]);
  res.json({ totalMembers, profiled, assessed });
}));

// ------------------------------------------------------------
// COMPROMISSOS de mentoria (CRUD do próprio usuário)
// ------------------------------------------------------------
const commitmentSchema = z.object({
  phrase: z.string().min(3),
  reviewAt: z.string().datetime().optional().nullable(),
  status: z.enum(["active", "in_progress", "done", "dropped"]).default("active"),
});

conscienciaRouter.post("/:orgId/consciencia/commitments", async (req, res) => {
  try {
    const data = commitmentSchema.parse(req.body);
    const c = await prisma.mentorshipCommitment.create({
      data: {
        organizationId: req.params.orgId,
        userId: req.userId!,
        phrase: data.phrase,
        status: data.status,
        reviewAt: data.reviewAt ? new Date(data.reviewAt) : null,
      },
    });
    res.status(201).json(c);
  } catch (err) {
    badReq(res, err);
  }
});

conscienciaRouter.patch("/:orgId/consciencia/commitments/:id", async (req, res) => {
  try {
    const existing = await prisma.mentorshipCommitment.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.userId !== req.userId) return res.status(404).json({ error: "Not found" });
    const data = commitmentSchema.partial().parse(req.body);
    const c = await prisma.mentorshipCommitment.update({
      where: { id: req.params.id },
      data: {
        ...(data.phrase != null ? { phrase: data.phrase } : {}),
        ...(data.status != null ? { status: data.status } : {}),
        ...(data.reviewAt !== undefined
          ? { reviewAt: data.reviewAt ? new Date(data.reviewAt) : null }
          : {}),
      },
    });
    res.json(c);
  } catch (err) {
    badReq(res, err);
  }
});

conscienciaRouter.delete("/:orgId/consciencia/commitments/:id", asyncRoute(async (req, res) => {
  const existing = await prisma.mentorshipCommitment.findUnique({ where: { id: req.params.id } });
  if (!existing || existing.userId !== req.userId) return res.status(404).json({ error: "Not found" });
  await prisma.mentorshipCommitment.delete({ where: { id: req.params.id } });
  res.status(204).end();
}));

conscienciaRouter.post("/:orgId/consciencia/signals/:id/dismiss", asyncRoute(async (req, res) => {
  const s = await prisma.crossSignal.findUnique({ where: { id: req.params.id } });
  if (!s || (s.userId && s.userId !== req.userId)) return res.status(404).json({ error: "Not found" });
  await prisma.crossSignal.update({
    where: { id: req.params.id },
    data: { dismissedAt: new Date() },
  });
  res.status(204).end();
}));

// ============================================================
// MOTOR DE ALERTAS CRUZADOS
// Regras (§3.4 da especificação):
//   perfil_risco[controle]       + rituais caíram >30% em 14d
//   perfil_risco[evita_conflito] + delegação atrasada 2x mesmo owner
//   assessment > 90 dias         → sinal de auto-percepção defasada
// Sempre dado objetivo + leitura comportamental.
// ============================================================
export async function computeCrossSignals(orgId: string, userId?: string) {
  const profiles = await prisma.leaderProfile.findMany({
    where: { organizationId: orgId, ...(userId ? { userId } : {}) },
  });

  const created: string[] = [];

  for (const p of profiles) {
    const risks = new Set(p.riskFlags);

    // 1) controle: adesão a rituais caiu > 30% nos últimos 14d vs 14d anteriores
    if (risks.has("controle")) {
      const now = new Date();
      const d14 = new Date(now.getTime() - 14 * 86400000);
      const d28 = new Date(now.getTime() - 28 * 86400000);

      const [recent, previous] = await Promise.all([
        prisma.ritualOccurrence.findMany({
          where: {
            ritual: { organizationId: orgId },
            scheduledAt: { gte: d14, lte: now },
          },
          select: { status: true },
        }),
        prisma.ritualOccurrence.findMany({
          where: {
            ritual: { organizationId: orgId },
            scheduledAt: { gte: d28, lt: d14 },
          },
          select: { status: true },
        }),
      ]);
      const adh = (arr: { status: string }[]) => {
        if (!arr.length) return null;
        const done = arr.filter((r) => r.status === "done").length;
        return done / arr.length;
      };
      const rec = adh(recent);
      const prev = adh(previous);
      if (rec != null && prev != null && prev > 0 && (prev - rec) / prev > 0.3) {
        await upsertSignal(orgId, p.userId, {
          kind: "ritual_drop_control",
          severity: "high",
          title: "Adesão a rituais caiu — cuidado com o padrão de controle",
          detail: `Últimos 14d: ${Math.round(rec * 100)}% de rituais no prazo (vs ${Math.round(prev * 100)}% nas 2 semanas anteriores). O Radar de Autogestão sinaliza tendência de controle; quando a cadência cai, o time perde referência.`,
        });
        created.push("ritual_drop_control");
      }
    }

    // 2) evita_conflito: mesmo assignee com 2+ delegações atrasadas
    if (risks.has("evita_conflito")) {
      const overdue = await prisma.delegation.findMany({
        where: {
          organizationId: orgId,
          delegatorId: p.userId,
          status: { notIn: ["done", "canceled"] },
          dueAt: { lt: new Date() },
        },
        select: { assigneeId: true },
      });
      const counts = new Map<string, number>();
      for (const d of overdue) if (d.assigneeId) counts.set(d.assigneeId, (counts.get(d.assigneeId) ?? 0) + 1);
      const offenders = Array.from(counts.entries()).filter(([, n]) => n >= 2);
      if (offenders.length) {
        await upsertSignal(orgId, p.userId, {
          kind: "delegation_delay_conflict_avoidance",
          severity: "high",
          title: "Atrasos concentrados sem conversa dura",
          detail: `${offenders.length} pessoa(s) com 2+ delegações atrasadas suas. Perfil sinaliza evitar conflito; o silêncio virou padrão.`,
          sourceRefs: { assignees: offenders.map(([id]) => id) },
        });
        created.push("delegation_delay_conflict_avoidance");
      }
    }

    // 3) auto-percepção defasada (>90d desde último assessment)
    if (p.assessmentAt && Date.now() - p.assessmentAt.getTime() > 90 * 86400000) {
      await upsertSignal(orgId, p.userId, {
        kind: "self_awareness_stale",
        severity: "low",
        title: "Rever o próprio perfil (90 dias)",
        detail: `Última atualização em ${p.assessmentAt.toLocaleDateString("pt-BR")}. A metodologia pede revisão trimestral do assessment.`,
      });
      created.push("self_awareness_stale");
    }
  }

  return { created };
}

async function upsertSignal(
  orgId: string,
  userId: string,
  s: { kind: "ritual_drop_control" | "delegation_delay_conflict_avoidance" | "concentration_high" | "self_awareness_stale" | "other"; severity: "low" | "medium" | "high"; title: string; detail: string; sourceRefs?: Record<string, unknown> },
) {
  // Evita duplicar sinal ativo do mesmo tipo para o mesmo usuário
  const existing = await prisma.crossSignal.findFirst({
    where: { organizationId: orgId, userId, kind: s.kind, dismissedAt: null },
  });
  if (existing) {
    await prisma.crossSignal.update({
      where: { id: existing.id },
      data: { severity: s.severity, title: s.title, detail: s.detail, sourceRefs: (s.sourceRefs ?? null) as never },
    });
  } else {
    await prisma.crossSignal.create({
      data: {
        organizationId: orgId,
        userId,
        kind: s.kind,
        severity: s.severity,
        title: s.title,
        detail: s.detail,
        sourceRefs: (s.sourceRefs ?? null) as never,
      },
    });
  }
}

// ============================================================
// MÓDULO C v2 — Atividade · PDI auto · Agenda · Coach · Mapa
// ============================================================

// -------- Descrição de atividades --------
conscienciaRouter.put("/:orgId/consciencia/me/activity", async (req, res) => {
  try {
    const parsed = z
      .object({
        activityDescription: z.string().max(20000).optional().nullable(),
        activityDescriptionUrl: z.string().url().optional().nullable(),
      })
      .parse(req.body);
    const saved = await prisma.leaderProfile.upsert({
      where: {
        organizationId_userId: { organizationId: req.params.orgId, userId: req.userId! },
      },
      update: {
        activityDescription: parsed.activityDescription ?? null,
        activityDescriptionUrl: parsed.activityDescriptionUrl ?? null,
      },
      create: {
        organizationId: req.params.orgId,
        userId: req.userId!,
        activityDescription: parsed.activityDescription ?? null,
        activityDescriptionUrl: parsed.activityDescriptionUrl ?? null,
      },
    });
    res.json(saved);
  } catch (err) {
    badReq(res, err);
  }
});

// -------- PDI auto-gerado (heurístico) --------
type AutoPdiGoal = {
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
  source: string;
  detail: {
    context: string;
    explanation: string;
    practices: string[];
    firstStep: string;
    successSignal: string;
  };
};

function buildAutoPdiGoal(input: AutoPdiGoal): AutoPdiGoal {
  return input;
}

type AutoPdiSourceProfile = {
  hardSelfScore: number | null;
  softSelfScore: number | null;
  heartSelfScore: number | null;
  sabotageScores: unknown;
  sabotages: string[];
  riskFlags: string[];
  activityDescription: string | null;
};

type PersonalPdiGoalRecord = {
  id: string;
  title: string;
  action: string | null;
  dueAt: Date | null;
  status: "a_fazer" | "em_andamento" | "concluido" | "atrasado";
  evidence: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type PersonalPdiRecord = {
  id: string;
  title: string;
  focus: string | null;
  startAt: Date;
  reviewAt: Date | null;
  status: "ativo" | "concluido" | "pausado" | "cancelado";
  summary: string | null;
  createdAt: Date;
  updatedAt: Date;
  goals: PersonalPdiGoalRecord[];
};

function generateAutoPdiGoals(profile: AutoPdiSourceProfile) {
  const goals: AutoPdiGoal[] = [];

  const scores = [
    { k: "hard", label: "Hard — método e indicadores", v: profile.hardSelfScore ?? 50 },
    { k: "soft", label: "Soft — decisão e delegação", v: profile.softSelfScore ?? 50 },
    { k: "heart", label: "Heart — escuta e coerência", v: profile.heartSelfScore ?? 50 },
  ].sort((a, b) => a.v - b.v);
  const lowest = scores[0];
  goals.push(buildAutoPdiGoal({
    title: `Elevar ${lowest.label} de ${lowest.v} → 75 em 90 dias`,
    description:
      `Seu menor placar hoje está em ${lowest.label}. Esse objetivo prioriza a dimensão que mais tende a travar sua liderança no curto prazo.`,
    priority: "high",
    source: "hsh_gap",
    detail: {
      context: `Entre Hard, Soft e Heart, a dimensão mais baixa hoje é ${lowest.label} com ${lowest.v}/100.`,
      explanation:
        "O PDI começou por aqui porque, quando a menor dimensão evolui, a liderança ganha mais consistência no dia a dia. A ideia não é 'virar outra pessoa', e sim fortalecer a parte que hoje está mais frágil.",
      practices: [
        "Escolher uma situação real da semana em que essa dimensão foi exigida e registrar o que funcionou ou travou.",
        "Aplicar uma prática concreta por semana com o time, em vez de deixar o objetivo só no campo da intenção.",
        "Revisar quinzenalmente o que mudou na sua resposta sob pressão, em decisão ou em escuta.",
      ],
      firstStep:
        `Reserve 20 minutos ainda esta semana e descreva uma situação recente em que ${lowest.label} fez falta na sua liderança.`,
      successSignal:
        "Você começa a perceber que reage com mais clareza e menos impulso exatamente nas situações em que antes se sentia mais travado.",
    },
  }));

  const sabotageScores = (profile.sabotageScores as Record<string, number> | null) ?? null;
  if (sabotageScores) {
    const top = Object.entries(sabotageScores)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .filter(([, v]) => v >= 40);
    for (const [name, score] of top) {
      goals.push(buildAutoPdiGoal({
        title: `Neutralizar o sabotador "${name}"`,
        description:
          `O padrão "${name}" apareceu com força (${score}/100). A recomendação aqui é diminuir o comando automático desse sabotador nas decisões do dia a dia.`,
        priority: score >= 70 ? "high" : "medium",
        source: `sabotage:${name}`,
        detail: {
          context: `Esse sabotador apareceu entre os mais altos do seu assessment, com score ${score}/100.`,
          explanation:
            "Ele entrou no PDI porque provavelmente está influenciando seu jeito de decidir, se posicionar ou conduzir o time quando a pressão sobe. O objetivo não é 'eliminar' o padrão, mas perceber quando ele assumiu o volante.",
          practices: [
            "Fazer uma interceptação por dia: identificar o gatilho, nomear o padrão e escolher uma resposta mais consciente.",
            "Anotar no fim da semana em quais contextos esse sabotador apareceu com mais frequência.",
            "Levar um caso real para revisão quinzenal e observar o custo concreto desse padrão na liderança.",
          ],
          firstStep:
            `Escolha uma situação recorrente em que o sabotador "${name}" costuma aparecer e defina qual será o novo comportamento de resposta.`,
          successSignal:
            "Você começa a reconhecer o padrão mais cedo e percebe redução no custo que ele gera sobre conversas, decisões ou execução.",
        },
      }));
    }
  } else if (profile.sabotages?.length) {
    for (const s of profile.sabotages.slice(0, 3)) {
      goals.push(buildAutoPdiGoal({
        title: `Reduzir o padrão "${s}"`,
        description:
          `Esse padrão apareceu no seu perfil e merece observação prática. A ideia é sair da percepção genérica e transformar isso em treino consciente.`,
        priority: "medium",
        source: `sabotage:${s}`,
        detail: {
          context: `O padrão "${s}" apareceu no seu assessment, mesmo sem score detalhado disponível nesta leitura.`,
          explanation:
            "Ele entrou no PDI porque já existe evidência suficiente de que influencia sua liderança. Sem score detalhado, o foco aqui é aumentar consciência e registrar exemplos reais.",
          practices: [
            "Observar durante a semana em quais situações esse padrão aparece com mais clareza.",
            "Fazer uma revisão semanal consigo mesmo: o que acionou, como você respondeu e o que teria sido uma resposta melhor.",
            "Escolher uma conversa ou decisão concreta para praticar uma resposta diferente do impulso automático.",
          ],
          firstStep:
            `Escreva um exemplo real em que o padrão "${s}" apareceu nos últimos 15 dias e o custo que ele gerou.`,
          successSignal:
            "Você começa a sair do modo automático e consegue descrever com mais precisão quando o padrão entra em cena.",
        },
      }));
    }
  }

  for (const r of (profile.riskFlags ?? []).slice(0, 2)) {
    goals.push(buildAutoPdiGoal({
      title: `Trabalhar o risco declarado "${r}"`,
      description:
        `Esse risco foi declarado no seu perfil e entrou no PDI para não ficar só como alerta abstrato. A proposta é transformar percepção em prática acompanhável.`,
      priority: "medium",
      source: `risk:${r}`,
      detail: {
        context: `Você marcou "${r}" como um risco comportamental do seu momento atual.`,
        explanation:
          "Como esse ponto já foi reconhecido por você, o PDI usa essa informação para transformar autoconsciência em ação concreta. O ganho aqui vem de repetir prática com observação, e não de uma mudança brusca.",
        practices: [
          "Escolher um ritual quinzenal para observar esse risco em contexto real.",
          "Pedir feedback direto de uma pessoa do time impactada por esse comportamento.",
          "Registrar um microajuste objetivo para a próxima conversa, reunião ou decisão relevante.",
        ],
        firstStep:
          `Defina qual situação real da sua rotina mais ativa o risco "${r}" e qual ajuste concreto você quer testar primeiro.`,
        successSignal:
          "As pessoas começam a perceber mais consistência no seu comportamento exatamente no ponto que antes gerava ruído.",
      },
    }));
  }

  if (profile.activityDescription && profile.activityDescription.length > 60) {
    goals.push(buildAutoPdiGoal({
      title: "Delegar 2 entregas presas no papel do líder",
      description:
        "Sua descrição de atividades mostra acúmulo executivo no papel do líder. Esse objetivo busca tirar você do operacional que hoje consome energia demais.",
      priority: "medium",
      source: "activity_delegation",
      detail: {
        context:
          "Na leitura das suas atividades existe sinal de sobrecarga executiva, com tarefas que ainda estão excessivamente concentradas em você.",
        explanation:
          "Esse item entrou no PDI porque o líder cresce menos quando continua operando o que já deveria estar rodando com o time. Delegar bem aqui não é só aliviar agenda: é abrir espaço para liderar.",
        practices: [
          "Mapear duas entregas que hoje estão no seu colo e que poderiam rodar com outra pessoa.",
          "Definir critério de aceite claro, prazo e checkpoint antes de delegar.",
          "Acompanhar sem retomar a tarefa ao primeiro sinal de imperfeição ou lentidão.",
        ],
        firstStep:
          "Escolha agora duas entregas repetitivas ou operacionais que você ainda centraliza e nomeie quem pode assumir cada uma.",
        successSignal:
          "Você começa a recuperar tempo de liderança e percebe o time ganhando autonomia sem depender de você para cada passo.",
      },
    }));
  }

  return goals;
}

function pickCurrentPersonalPdi(pdis: PersonalPdiRecord[], autoPdiId?: string | null) {
  const active = pdis.find((pdi) => pdi.status === "ativo");
  if (active) return active;
  if (autoPdiId) {
    const linked = pdis.find((pdi) => pdi.id === autoPdiId);
    if (linked) return linked;
  }
  return pdis.find((pdi) => pdi.status === "pausado")
    ?? pdis[0]
    ?? null;
}

function serializePersonalPdi(pdi: PersonalPdiRecord | null) {
  if (!pdi) return null;
  const completedGoals = pdi.goals.filter((goal) => goal.status === "concluido").length;
  return {
    id: pdi.id,
    title: pdi.title,
    focus: pdi.focus,
    summary: pdi.summary,
    status: pdi.status,
    startAt: pdi.startAt.toISOString(),
    reviewAt: pdi.reviewAt?.toISOString() ?? null,
    createdAt: pdi.createdAt.toISOString(),
    updatedAt: pdi.updatedAt.toISOString(),
    totalGoals: pdi.goals.length,
    completedGoals,
    goals: pdi.goals.map((goal) => ({
      id: goal.id,
      title: goal.title,
      action: goal.action,
      dueAt: goal.dueAt?.toISOString() ?? null,
      status: goal.status,
      evidence: goal.evidence,
      createdAt: goal.createdAt.toISOString(),
      updatedAt: goal.updatedAt.toISOString(),
    })),
  };
}

function summarizePersonalPdis(pdis: PersonalPdiRecord[], autoPdiId?: string | null) {
  const current = pickCurrentPersonalPdi(pdis, autoPdiId);
  const activeCycles = pdis.filter((pdi) => pdi.status === "ativo").length;
  const concludedCycles = pdis.filter((pdi) => pdi.status === "concluido").length;
  const currentCompletedGoals = current?.goals.filter((goal) => goal.status === "concluido").length ?? 0;
  return {
    totalCycles: pdis.length,
    activeCycles,
    concludedCycles,
    currentStatus: current?.status ?? null,
    currentGoals: current?.goals.length ?? 0,
    currentCompletedGoals,
    currentId: current?.id ?? null,
    currentUpdatedAt: current?.updatedAt.toISOString() ?? null,
    currentTitle: current?.title ?? null,
    currentReviewAt: current?.reviewAt?.toISOString() ?? null,
    canStartNewCycle: !current || current.status !== "ativo",
  };
}

// -------- Upload de documento com a descrição de atividades --------
const activityDocSchema = z.object({
  filename: z.string().min(1).max(200),
  mimeType: z.string().min(3).max(120),
  /** conteúdo do arquivo em base64 (sem o prefixo data:) */
  base64: z.string().min(10),
  /** se true, substitui a descrição livre pelo texto extraído */
  replaceDescription: z.boolean().optional(),
});

conscienciaRouter.post("/:orgId/consciencia/me/activity/document", asyncRoute(async (req, res) => {
  let data: z.infer<typeof activityDocSchema>;
  try {
    data = activityDocSchema.parse(req.body);
  } catch (err) {
    return badReq(res, err);
  }

  const bytes = Buffer.byteLength(data.base64, "base64");
  if (bytes > 8 * 1024 * 1024) {
    return res.status(413).json({ error: "Arquivo muito grande. Envie um documento de até 8 MB." });
  }

  let text = "";
  try {
    text = (await extractDocumentText(data)).trim();
  } catch (err) {
    console.error("[consciencia] extração de documento falhou", err);
    return res.status(502).json({
      error:
        err instanceof Error && /Provedor de IA|Chave de API/.test(err.message)
          ? err.message
          : "Não consegui ler esse documento. Tente um PDF/DOCX menor ou cole o texto na descrição.",
    });
  }

  if (!text) {
    return res.status(422).json({ error: "Não encontrei conteúdo legível nesse documento." });
  }

  const orgId = req.params.orgId;
  const userId = req.userId!;
  const current = await prisma.leaderProfile.findUnique({
    where: { organizationId_userId: { organizationId: orgId, userId } },
    select: { activityDescription: true },
  });
  const description =
    data.replaceDescription || !current?.activityDescription?.trim()
      ? text
      : current.activityDescription;

  const saved = await prisma.leaderProfile.upsert({
    where: { organizationId_userId: { organizationId: orgId, userId } },
    update: {
      activityDocName: data.filename,
      activityDocText: text,
      activityDocAt: new Date(),
      activityDescription: description,
    },
    create: {
      organizationId: orgId,
      userId,
      activityDocName: data.filename,
      activityDocText: text,
      activityDocAt: new Date(),
      activityDescription: description,
    },
  });

  res.status(201).json({ profile: saved, extractedText: text });
}));

conscienciaRouter.post("/:orgId/consciencia/pdi/auto-generate", async (req, res) => {
  try {
    const orgId = req.params.orgId;
    const userId = req.userId!;
    const profile = await prisma.leaderProfile.findUnique({
      where: { organizationId_userId: { organizationId: orgId, userId } },
      select: {
        hardSelfScore: true,
        softSelfScore: true,
        heartSelfScore: true,
        sabotageScores: true,
        sabotages: true,
        riskFlags: true,
        activityDescription: true,
      },
    });
    if (!profile) {
      return res.status(400).json({ error: "Preencha o assessment antes de gerar o PDI." });
    }

    const goals = generateAutoPdiGoals(profile);
    const generatedAt = new Date();

    await prisma.leaderProfile.update({
      where: { organizationId_userId: { organizationId: orgId, userId } },
      data: { autoPdiGeneratedAt: generatedAt },
    });

    res.json({ generatedAt: generatedAt.toISOString(), goals });
  } catch (err) {
    badReq(res, err);
  }
});

const saveAutoPdiSchema = z.object({
  title: z.string().min(3).max(160).optional(),
  focus: z.string().max(160).optional().nullable(),
  summary: z.string().max(4000).optional().nullable(),
  reviewAt: z.string().datetime().optional().nullable(),
  goals: z.array(z.object({
    title: z.string().min(3).max(240),
    action: z.string().max(2000).optional().nullable(),
    dueAt: z.string().datetime().optional().nullable(),
    evidence: z.string().max(2000).optional().nullable(),
  })).min(1),
});

conscienciaRouter.get("/:orgId/consciencia/pdi/current", async (req, res) => {
  try {
    const orgId = req.params.orgId;
    const userId = req.userId!;
    const [profile, pdis] = await Promise.all([
      prisma.leaderProfile.findUnique({
        where: { organizationId_userId: { organizationId: orgId, userId } },
        select: { autoPdiId: true },
      }),
      prisma.pdi.findMany({
        where: { organizationId: orgId, subjectUserId: userId },
        include: { goals: true },
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      }),
    ]);

    const current = pickCurrentPersonalPdi(pdis as PersonalPdiRecord[], profile?.autoPdiId ?? null);
    res.json({
      current: serializePersonalPdi(current),
      summary: summarizePersonalPdis(pdis as PersonalPdiRecord[], profile?.autoPdiId ?? null),
    });
  } catch (err) {
    badReq(res, err);
  }
});

conscienciaRouter.post("/:orgId/consciencia/pdi/save", async (req, res) => {
  try {
    const orgId = req.params.orgId;
    const userId = req.userId!;
    const data = saveAutoPdiSchema.parse(req.body);

    const existingActive = await prisma.pdi.findFirst({
      where: { organizationId: orgId, subjectUserId: userId, status: "ativo" },
      select: { id: true },
    });
    if (existingActive) {
      return res.status(409).json({
        error: "Você já tem um ciclo de PDI ativo. Conclua ou pause o atual antes de abrir outro.",
      });
    }

    const created = await prisma.pdi.create({
      data: {
        organizationId: orgId,
        authorId: userId,
        subjectUserId: userId,
        title: data.title?.trim() || "Meu ciclo de evolução",
        focus: data.focus ?? "Autodesenvolvimento do líder",
        summary: data.summary ?? null,
        reviewAt: data.reviewAt ? new Date(data.reviewAt) : null,
        status: "ativo",
        goals: {
          create: data.goals.map((goal) => ({
            title: goal.title,
            action: goal.action ?? null,
            dueAt: goal.dueAt ? new Date(goal.dueAt) : null,
            evidence: goal.evidence ?? null,
            status: "a_fazer" as const,
          })),
        },
      },
      include: { goals: true },
    });

    await prisma.leaderProfile.upsert({
      where: { organizationId_userId: { organizationId: orgId, userId } },
      update: {
        autoPdiId: created.id,
        autoPdiGeneratedAt: new Date(),
      },
      create: {
        organizationId: orgId,
        userId,
        autoPdiId: created.id,
        autoPdiGeneratedAt: new Date(),
      },
    });

    res.status(201).json({
      current: serializePersonalPdi(created as PersonalPdiRecord),
      summary: summarizePersonalPdis([created as PersonalPdiRecord], created.id),
    });
  } catch (err) {
    badReq(res, err);
  }
});

// -------- Trilha do coach (metodologia C.O.R.E.) --------
conscienciaRouter.post("/:orgId/consciencia/coach/plan", async (req, res) => {
  try {
    const orgId = req.params.orgId;
    const userId = req.userId!;
    const { cadence } = z
      .object({ cadence: z.enum(["weekly", "biweekly", "monthly"]) })
      .parse(req.body);
    const profile = await prisma.leaderProfile.findUnique({
      where: { organizationId_userId: { organizationId: orgId, userId } },
    });
    if (!profile) return res.status(400).json({ error: "Preencha o assessment antes." });

    const cadenceLabel =
      cadence === "weekly" ? "semanal" : cadence === "biweekly" ? "quinzenal" : "mensal";
    const h = profile.hardSelfScore ?? 50;
    const s = profile.softSelfScore ?? 50;
    const hr = profile.heartSelfScore ?? 50;
    const focus: "Hard" | "Soft" | "Heart" =
      h <= s && h <= hr ? "Hard" : s <= hr ? "Soft" : "Heart";
    const sabotageTop = Object.entries(
      (profile.sabotageScores as Record<string, number> | null) ?? {},
    )
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([k, v]) => `${k} (${v}/100)`);
    const sabotages = sabotageTop.length
      ? sabotageTop
      : (profile.sabotages ?? []).slice(0, 2);

    const plan = await buildCoachPlan({
      cadence,
      cadenceLabel,
      focus,
      scores: { hard: h, soft: s, heart: hr },
      sabotages,
      risks: profile.riskFlags ?? [],
      strengths: profile.strengths ?? [],
      activity: profile.activityDescription ?? null,
    });

    const md = planToMarkdown(plan, cadenceLabel);

    await prisma.leaderProfile.update({
      where: { organizationId_userId: { organizationId: orgId, userId } },
      data: {
        coachTrackMarkdown: md,
        coachTrackPlan: plan as never,
        coachTrackGeneratedAt: new Date(),
        coachCadence: cadence,
      },
    });

    res.json({ plan, markdown: md, cadence, generatedAt: new Date().toISOString() });
  } catch (err) {
    badReq(res, err);
  }
});

// ---- Plano estruturado do coach (IA com fallback determinístico) ----

export type CoachAction = {
  id: string;
  title: string;
  why: string;
  how: string;
  when: string;
  dimension: "C" | "O" | "R" | "E";
  minutes: number;
};

export type CoachPlan = {
  headline: string;
  focus: "Hard" | "Soft" | "Heart";
  diagnosis: string;
  actions: CoachAction[];
  ritual: { title: string; cadence: string; script: string[] };
  metric: { name: string; target: string; checkAt: string };
  watchOut: string;
};

type CoachInput = {
  cadence: "weekly" | "biweekly" | "monthly";
  cadenceLabel: string;
  focus: "Hard" | "Soft" | "Heart";
  scores: { hard: number; soft: number; heart: number };
  sabotages: string[];
  risks: string[];
  strengths: string[];
  activity: string | null;
};

function heuristicCoachPlan(input: CoachInput): CoachPlan {
  const { focus, scores, cadenceLabel } = input;
  const sab = input.sabotages[0] ?? "seu padrão automático de urgência";
  const value = focus === "Hard" ? scores.hard : focus === "Soft" ? scores.soft : scores.heart;

  const byFocus: Record<CoachPlan["focus"], CoachAction[]> = {
    Hard: [
      {
        id: "h1",
        title: "Escolher 1 indicador que decide o mês",
        why: `Seu Hard está em ${value}/100 — decisão sem número vira opinião.`,
        how: "Escreva a meta do mês em uma frase e o número que prova que ela andou.",
        when: "Hoje, 15 min",
        dimension: "O",
        minutes: 15,
      },
      {
        id: "h2",
        title: "Rodar 1 revisão planejado × entregue",
        why: "Sem revisão o plano vira lista de desejos.",
        how: "Abra o plano da semana, marque o que saiu e escreva o motivo de cada desvio.",
        when: "Sexta, 20 min",
        dimension: "R",
        minutes: 20,
      },
      {
        id: "h3",
        title: "Cortar 1 iniciativa que não move o indicador",
        why: "Foco é o que você deixa de fazer.",
        how: "Liste as 5 frentes ativas, escolha a de menor impacto e comunique o corte.",
        when: "Esta semana, 10 min",
        dimension: "O",
        minutes: 10,
      },
    ],
    Soft: [
      {
        id: "s1",
        title: "Delegar 1 entrega que ainda está no seu colo",
        why: `Seu Soft está em ${value}/100 — você está executando o que deveria estar dirigindo.`,
        how: "Escolha a entrega, defina critério de aceite, prazo e 1 checkpoint. Comunique hoje.",
        when: "Hoje, 20 min",
        dimension: "O",
        minutes: 20,
      },
      {
        id: "s2",
        title: "Dar 1 feedback direto que você vem adiando",
        why: "Feedback adiado vira ressentimento e queda de performance.",
        how: "Fato → impacto → pedido. 3 frases, sem rodeio, cara a cara.",
        when: "Nas próximas 48h, 15 min",
        dimension: "C",
        minutes: 15,
      },
      {
        id: "s3",
        title: "Interceptar o sabotador na hora da decisão",
        why: `"${sab}" aparece justamente quando a decisão é difícil.`,
        how: "Ao sentir o gatilho, pare 60s e escreva: o que o medo está pedindo? o que o papel exige?",
        when: "Diário, 2 min",
        dimension: "C",
        minutes: 2,
      },
    ],
    Heart: [
      {
        id: "c1",
        title: "30 min de escuta pura com o liderado mais crítico",
        why: `Seu Heart está em ${value}/100 — o time sente antes de você perceber.`,
        how: "Sem pauta, sem solução. Pergunte: o que está pesando? Só ouça e anote.",
        when: "Esta semana, 30 min",
        dimension: "C",
        minutes: 30,
      },
      {
        id: "c2",
        title: "Reconhecer 2 pessoas com fato específico",
        why: "Reconhecimento genérico não muda comportamento; fato muda.",
        how: "Diga o que a pessoa fez, o impacto real e por que importou para o time.",
        when: "Até sexta, 10 min",
        dimension: "E",
        minutes: 10,
      },
      {
        id: "c3",
        title: "Fechar 1 combinado que você quebrou",
        why: "Coerência é o único ativo de confiança que não se recupera com discurso.",
        how: "Nomeie o combinado, assuma o furo e refaça o acordo com data.",
        when: "Hoje, 10 min",
        dimension: "C",
        minutes: 10,
      },
    ],
  };

  return {
    headline:
      focus === "Hard"
        ? "Você está liderando no instinto — falta número."
        : focus === "Soft"
        ? "Você está fazendo o trabalho do time — falta direção."
        : "Você está entregando resultado sem levar gente junto.",
    focus,
    diagnosis: `Hard ${scores.hard} · Soft ${scores.soft} · Heart ${scores.heart}. A dimensão ${focus} é o gargalo desta rodada${
      input.sabotages.length ? ` e "${input.sabotages.join('", "')}" é o padrão que segura você.` : "."
    }`,
    actions: byFocus[focus],
    ritual: {
      title: focus === "Heart" ? "1:1 de escuta" : "Revisão de rota",
      cadence: cadenceLabel,
      script: [
        "O que avançou desde a última rodada?",
        "O que travou e de quem depende?",
        "Qual é a única coisa que precisa acontecer até a próxima?",
      ],
    },
    metric: {
      name: `${focus} autoavaliado`,
      target: `${Math.min(100, value + 10)}/100`,
      checkAt: `Próxima rodada ${cadenceLabel}`,
    },
    watchOut: input.risks[0]
      ? `Atenção ao risco declarado: ${input.risks[0]}.`
      : `Se a semana apertar, a primeira coisa que você vai abandonar é ${
          focus === "Heart" ? "a escuta" : "a revisão"
        }. Não abandone.`,
  };
}

async function buildCoachPlan(input: CoachInput): Promise<CoachPlan> {
  const fallback = heuristicCoachPlan(input);
  try {
    const neo = await neoContextMessage();
    const raw = await completeChat({
      temperature: 0.5,
      messages: [
        neo,
        {
          role: "system",
          content:
            "Você é o coach da metodologia Líder C.O.R.E. Fale em português do Brasil, direto, sem enrolação e sem elogio vazio. Cada ação precisa ser executável em minutos e ter um verbo no início. Responda APENAS com JSON válido no formato: {\"headline\":string,\"diagnosis\":string,\"actions\":[{\"title\":string,\"why\":string,\"how\":string,\"when\":string,\"dimension\":\"C\"|\"O\"|\"R\"|\"E\",\"minutes\":number}],\"ritual\":{\"title\":string,\"cadence\":string,\"script\":[string]},\"metric\":{\"name\":string,\"target\":string,\"checkAt\":string},\"watchOut\":string}. Entre 3 e 5 ações.",
        },
        {
          role: "user",
          content: JSON.stringify({
            cadencia: input.cadenceLabel,
            radar_hsh: input.scores,
            dimensao_foco: input.focus,
            sabotadores: input.sabotages,
            riscos: input.risks,
            forcas: input.strengths,
            atividades_do_lider: input.activity?.slice(0, 1200) ?? null,
          }),
        },
      ],
    });
    const json = raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1);
    const parsed = JSON.parse(json) as Partial<CoachPlan>;
    const actions = (parsed.actions ?? [])
      .filter((a) => a && a.title)
      .slice(0, 5)
      .map((a, i) => ({
        id: `ai${i + 1}`,
        title: String(a.title),
        why: String(a.why ?? ""),
        how: String(a.how ?? ""),
        when: String(a.when ?? "Esta semana"),
        dimension: (["C", "O", "R", "E"].includes(String(a.dimension)) ? a.dimension : "O") as CoachAction["dimension"],
        minutes: Number(a.minutes) > 0 ? Number(a.minutes) : 15,
      }));
    if (!actions.length) return fallback;
    return {
      headline: parsed.headline ? String(parsed.headline) : fallback.headline,
      focus: input.focus,
      diagnosis: parsed.diagnosis ? String(parsed.diagnosis) : fallback.diagnosis,
      actions,
      ritual: parsed.ritual?.title
        ? {
            title: String(parsed.ritual.title),
            cadence: String(parsed.ritual.cadence ?? input.cadenceLabel),
            script: (parsed.ritual.script ?? fallback.ritual.script).map(String).slice(0, 5),
          }
        : fallback.ritual,
      metric: parsed.metric?.name
        ? {
            name: String(parsed.metric.name),
            target: String(parsed.metric.target ?? fallback.metric.target),
            checkAt: String(parsed.metric.checkAt ?? fallback.metric.checkAt),
          }
        : fallback.metric,
      watchOut: parsed.watchOut ? String(parsed.watchOut) : fallback.watchOut,
    };
  } catch (err) {
    console.warn("[consciencia] plano do coach via IA indisponível, usando heurística", err);
    return fallback;
  }
}

function planToMarkdown(plan: CoachPlan, cadenceLabel: string): string {
  return [
    `# Trilha ${cadenceLabel} — ${plan.headline}`,
    "",
    plan.diagnosis,
    "",
    "## Faça agora",
    ...plan.actions.map((a, i) => `${i + 1}. **${a.title}** (${a.when}) — ${a.how}`),
    "",
    `## Ritual: ${plan.ritual.title} (${plan.ritual.cadence})`,
    ...plan.ritual.script.map((q) => `- ${q}`),
    "",
    `## Métrica: ${plan.metric.name} → ${plan.metric.target} (${plan.metric.checkAt})`,
    "",
    `> ${plan.watchOut}`,
  ].join("\n");
}


// -------- Agenda de liderança --------
const agendaSchema = z.object({
  title: z.string().min(1),
  detail: z.string().optional().nullable(),
  kind: z.string().optional(),
  memberLabel: z.string().optional().nullable(),
  scheduledAt: z.string().datetime().optional().nullable(),
  source: z.string().optional(),
});

conscienciaRouter.get("/:orgId/consciencia/agenda", asyncRoute(async (req, res) => {
  const items = await prisma.leaderAgendaItem.findMany({
    where: { organizationId: req.params.orgId, userId: req.userId! },
    orderBy: [{ done: "asc" }, { scheduledAt: "asc" }, { createdAt: "desc" }],
  });
  res.json({ items });
}));

conscienciaRouter.post("/:orgId/consciencia/agenda", async (req, res) => {
  try {
    const data = agendaSchema.parse(req.body);
    const item = await prisma.leaderAgendaItem.create({
      data: {
        organizationId: req.params.orgId,
        userId: req.userId!,
        title: data.title,
        detail: data.detail ?? null,
        kind: data.kind ?? "acao",
        memberLabel: data.memberLabel ?? null,
        scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
        source: data.source ?? "manual",
      },
    });
    res.status(201).json(item);
  } catch (err) {
    badReq(res, err);
  }
});

conscienciaRouter.patch("/:orgId/consciencia/agenda/:id", async (req, res) => {
  try {
    const existing = await prisma.leaderAgendaItem.findUnique({
      where: { id: req.params.id },
    });
    if (!existing || existing.userId !== req.userId)
      return res.status(404).json({ error: "Not found" });
    const data = agendaSchema
      .partial()
      .extend({ done: z.boolean().optional() })
      .parse(req.body);
    const item = await prisma.leaderAgendaItem.update({
      where: { id: req.params.id },
      data: {
        ...(data.title != null ? { title: data.title } : {}),
        ...(data.detail !== undefined ? { detail: data.detail ?? null } : {}),
        ...(data.kind != null ? { kind: data.kind } : {}),
        ...(data.memberLabel !== undefined ? { memberLabel: data.memberLabel ?? null } : {}),
        ...(data.scheduledAt !== undefined
          ? { scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null }
          : {}),
        ...(data.done !== undefined ? { done: data.done } : {}),
      },
    });
    res.json(item);
  } catch (err) {
    badReq(res, err);
  }
});

conscienciaRouter.delete("/:orgId/consciencia/agenda/:id", asyncRoute(async (req, res) => {
  const existing = await prisma.leaderAgendaItem.findUnique({
    where: { id: req.params.id },
  });
  if (!existing || existing.userId !== req.userId)
    return res.status(404).json({ error: "Not found" });
  await prisma.leaderAgendaItem.delete({ where: { id: req.params.id } });
  res.status(204).end();
}));

// -------- Mapa comportamental dos liderados --------
conscienciaRouter.get("/:orgId/consciencia/subordinate-map", asyncRoute(async (req, res) => {
  const orgId = req.params.orgId;

  const [memberships, assessments, profiles] = await Promise.all([
    prisma.membership.findMany({
      where: { organizationId: orgId, userId: { not: req.userId! } },
      include: { user: { include: { profile: true } }, team: true, area: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.subordinateAssessment.findMany({
      where: { organizationId: orgId },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.teamMemberProfile.findMany({ where: { organizationId: orgId } }),
  ]);

  const profByMembership = new Map(profiles.map((p) => [p.membershipId, p]));
  const byUser = new Map<string, (typeof assessments)[number]>();
  const byLabel = new Map<string, (typeof assessments)[number]>();
  for (const a of assessments) {
    if (a.memberId && !byUser.has(a.memberId)) byUser.set(a.memberId, a);
    const key = a.memberLabel.trim().toLowerCase();
    if (key && !byLabel.has(key)) byLabel.set(key, a);
  }

  const used = new Set<string>();
  const items = memberships.map((m) => {
    const name = m.user.profile?.fullName ?? m.user.email;
    const a = byUser.get(m.userId) ?? byLabel.get(name.trim().toLowerCase()) ?? null;
    if (a) used.add(a.id);
    const prof = profByMembership.get(m.id);
    return {
      id: a?.id ?? `membership:${m.id}`,
      membershipId: m.id,
      userId: m.userId,
      memberLabel: name,
      email: m.user.email,
      roleTitle: prof?.roleTitle ?? null,
      teamName: m.team?.name ?? null,
      areaName: m.area?.name ?? null,
      whatsapp: m.user.profile?.whatsapp ?? m.user.profile?.phone ?? null,
      hasAssessment: !!a,
      discPrimary: a?.discPrimary ?? prof?.discPrimary ?? null,
      cerebralPrimary: a?.cerebralPrimary ?? null,
      aiReading: a?.aiReading ?? null,
      aiTrack: a?.aiTrack ?? null,
      trackSteps: a?.trackSteps ?? null,
      trackGeneratedAt: a?.trackGeneratedAt ?? null,
      updatedAt: a?.updatedAt ?? m.createdAt,
    };
  });

  // Respostas de assessment que ainda não têm cadastro na equipe (ex.: pulso por link)
  const orphans = assessments
    .filter((a) => !used.has(a.id) && a.leaderId === req.userId!)
    .map((a) => ({
      id: a.id,
      membershipId: null as string | null,
      userId: a.memberId,
      memberLabel: a.memberLabel,
      email: null as string | null,
      roleTitle: null as string | null,
      teamName: null as string | null,
      areaName: null as string | null,
      whatsapp: a.memberPhone,
      hasAssessment: true,
      discPrimary: a.discPrimary,
      cerebralPrimary: a.cerebralPrimary,
      aiReading: a.aiReading,
      aiTrack: a.aiTrack,
      trackSteps: a.trackSteps,
      trackGeneratedAt: a.trackGeneratedAt,
      updatedAt: a.updatedAt,
    }));

  res.json({ items: [...items, ...orphans] });
}));

// -------- Trilha individual do liderado (gerada a partir do assessment) --------
conscienciaRouter.post("/:orgId/consciencia/subordinate-map/:id/track", asyncRoute(async (req, res) => {
  const orgId = req.params.orgId;
  const rawId = req.params.id;

  let item: Awaited<ReturnType<typeof prisma.subordinateAssessment.findUnique>> = null;

  if (rawId.startsWith("membership:")) {
    // Liderado cadastrado na equipe que ainda não respondeu assessment:
    // criamos o registro a partir dos dados do time para poder gerar a trilha.
    const membershipId = rawId.slice("membership:".length);
    const membership = await prisma.membership.findFirst({
      where: { id: membershipId, organizationId: orgId },
      include: { user: { include: { profile: true } } },
    });
    if (!membership) return res.status(404).json({ error: "Not found" });
    const prof = await prisma.teamMemberProfile.findUnique({
      where: { membershipId: membership.id },
    });
    const label = membership.user.profile?.fullName ?? membership.user.email;
    item =
      (await prisma.subordinateAssessment.findFirst({
        where: { organizationId: orgId, leaderId: req.userId!, memberId: membership.userId },
      })) ??
      (await prisma.subordinateAssessment.create({
        data: {
          organizationId: orgId,
          leaderId: req.userId!,
          memberId: membership.userId,
          memberLabel: label,
          memberPhone: membership.user.profile?.whatsapp ?? membership.user.profile?.phone ?? null,
          discPrimary: prof?.discPrimary ?? null,
        },
      }));
  } else {
    item = await prisma.subordinateAssessment.findUnique({ where: { id: rawId } });
    if (!item || item.leaderId !== req.userId! || item.organizationId !== orgId) {
      return res.status(404).json({ error: "Not found" });
    }
  }

  if (!item) return res.status(404).json({ error: "Not found" });

  let steps: TrackStep[] = heuristicTrack(item);
  let summary = item.aiReading ?? "";

  try {
    const raw = await completeChat({
      temperature: 0.3,
      messages: [
        {
          role: "system",
          content:
            "Você é o coach da metodologia Líder C.O.R.E. Gere trilhas curtas de desenvolvimento de 4 semanas, práticas e específicas, em português do Brasil. Responda APENAS com JSON válido.",
        },
        {
          role: "user",
          content: `Liderado: ${item.memberLabel}
Perfil DISC: ${item.discPrimary ?? "não informado"}
Modo de ativação: ${item.cerebralPrimary ?? "não informado"}
Sabotadores: ${JSON.stringify(item.sabotageScores ?? {})}
Leitura atual: ${item.aiReading ?? "—"}

Devolva JSON no formato:
{"summary":"1 parágrafo","steps":[{"week":1,"title":"","focus":"","practice":"","leaderAction":""}]}
Exatamente 4 semanas.`,
        },
      ],
    });
    const json = JSON.parse(raw.replace(/^```(?:json)?|```$/gm, "").trim()) as {
      summary?: string;
      steps?: TrackStep[];
    };
    if (Array.isArray(json.steps) && json.steps.length) {
      steps = json.steps.slice(0, 6).map((s, i) => ({
        week: Number(s.week) || i + 1,
        title: String(s.title ?? `Semana ${i + 1}`),
        focus: String(s.focus ?? ""),
        practice: String(s.practice ?? ""),
        leaderAction: String(s.leaderAction ?? ""),
      }));
    }
    if (json.summary) summary = json.summary;
  } catch (err) {
    console.warn("[consciencia] trilha do liderado via IA indisponível, usando heurística", err);
  }

  const saved = await prisma.subordinateAssessment.update({
    where: { id: item.id },
    data: {
      trackSteps: steps as never,
      trackGeneratedAt: new Date(),
      aiTrack: summary || item.aiTrack,
    },
  });

  res.json(saved);
}));
