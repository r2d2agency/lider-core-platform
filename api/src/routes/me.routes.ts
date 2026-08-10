import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { requireAuth } from "../auth.js";

/**
 * Rotas do "eu logado" — dados agregados para a Home (Briefing do dia),
 * jornada inicial (onboarding pós mentoria Neo) e importação do CORE DNA.
 *
 * O app do líder deve ser DESACOPLADO da metodologia: essas rotas leem
 * jornadas/assessments criados pelo admin Neo e devolvem o mínimo que a Home
 * precisa exibir.
 */
export const meRouter = Router();
meRouter.use(requireAuth);

// GET /me/home/briefing
// Devolve o "o que precisa da minha atenção hoje?".
meRouter.get("/home/briefing", async (req, res) => {
  const userId = req.userId!;
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfWeek = new Date(startOfDay);
  endOfWeek.setDate(endOfWeek.getDate() + 7);

  const [profile, notifications, dna] = await Promise.all([
    prisma.profile.findUnique({
      where: { id: userId },
      select: {
        fullName: true,
        onboardingCompletedAt: true,
        onboardingSteps: true,
        didNeoMentorship: true,
      },
    }),
    prisma.notificationLog
      .findMany({
        where: { userId, channel: "in_app", readAt: null },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { id: true, title: true, body: true, linkUrl: true, createdAt: true },
      })
      .catch(() => []),
    prisma.leaderDNA
      .findUnique({ where: { userId }, select: { scores: true, strengths: true, improvements: true, updatedAt: true } })
      .catch(() => null),
  ]);

  // Próxima jornada inicial disponível (usada no onboarding pós-mentoria)
  const initialJourney = await prisma.journey
    .findFirst({
      where: { isInitial: true, status: "active" },
      orderBy: { updatedAt: "desc" },
      select: { id: true, slug: true, name: true, description: true },
    })
    .catch(() => null);

  res.json({
    generatedAt: new Date().toISOString(),
    greeting: buildGreeting(profile?.fullName ?? null),
    profile: {
      fullName: profile?.fullName ?? null,
      onboardingCompletedAt: profile?.onboardingCompletedAt ?? null,
      didNeoMentorship: profile?.didNeoMentorship ?? false,
    },
    dna: dna ?? null,
    initialJourney,
    notifications: notifications.map((n) => ({
      id: n.id,
      title: n.title,
      body: n.body,
      linkUrl: n.linkUrl,
      createdAt: n.createdAt,
    })),
    windows: {
      today: startOfDay.toISOString(),
      weekEnd: endOfWeek.toISOString(),
    },
  });
});

function buildGreeting(name: string | null): string {
  const first = (name ?? "").trim().split(" ")[0];
  return first ? `Olá, ${first}` : "Olá";
}

// ============================================================
// GET /me/home/attention — "Quem precisa da sua atenção"
// Agrega fatos reais do sistema: liderados sem 1:1, feedbacks pendentes,
// delegações atrasadas e próximos rituais. Mais o CORE Score atual.
// ============================================================
type AttentionItem = {
  id: string;
  title: string;
  reason: string;
  severity: "high" | "medium" | "low";
  kind: "one_on_one" | "feedback" | "delegation" | "ritual";
  link: string | null;
};

const DAY = 86_400_000;

meRouter.get("/home/attention", async (req, res) => {
  const userId = req.userId!;
  const now = new Date();
  try {
    const membership = await prisma.membership.findFirst({
      where: { userId },
      orderBy: { createdAt: "asc" },
      select: { organizationId: true },
    });
    if (!membership) {
      return res.json({ generatedAt: now.toISOString(), items: [], coreScore: null });
    }
    const orgId = membership.organizationId;

    const [members, oneOnOnes, feedbacks, delegations, occurrences, snapshot] = await Promise.all([
      prisma.membership.findMany({
        where: { organizationId: orgId, userId: { not: userId } },
        include: { user: { include: { profile: true } } },
        take: 60,
      }),
      prisma.oneOnOne.findMany({
        where: { organizationId: orgId, leaderId: userId },
        orderBy: { scheduledAt: "desc" },
        select: { subjectUserId: true, scheduledAt: true, status: true },
        take: 300,
      }),
      prisma.feedbackRecord.findMany({
        where: { organizationId: orgId, authorId: userId, status: { not: "concluido" } },
        orderBy: { createdAt: "asc" },
        take: 50,
      }),
      prisma.delegation
        .findMany({
          where: { organizationId: orgId, delegatorId: userId, dueAt: { lt: now } },
          orderBy: { dueAt: "asc" },
          take: 20,
        })
        .catch(() => [] as Array<{ id: string; title: string; dueAt: Date | null; status: string }>),
      prisma.ritualOccurrence
        .findMany({
          where: {
            scheduledAt: { gte: now, lte: new Date(now.getTime() + 2 * DAY) },
            status: "scheduled",
            ritual: { organizationId: orgId },
          },
          orderBy: { scheduledAt: "asc" },
          include: { ritual: { select: { name: true } } },
          take: 10,
        })
        .catch(() => []),
      prisma.leadershipScoreSnapshot
        .findFirst({
          where: { organizationId: orgId, userId },
          orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }],
          select: { score: true, createdAt: true },
        })
        .catch(() => null),
    ]);

    const items: AttentionItem[] = [];

    // 1) Liderados sem 1:1 recente
    const lastOneOnOne = new Map<string, Date>();
    for (const o of oneOnOnes) {
      if (o.status === "canceled") continue;
      if (o.scheduledAt > now) continue;
      const prev = lastOneOnOne.get(o.subjectUserId);
      if (!prev || o.scheduledAt > prev) lastOneOnOne.set(o.subjectUserId, o.scheduledAt);
    }
    for (const m of members) {
      const name = m.user?.profile?.fullName || m.user?.email || "Liderado";
      const last = lastOneOnOne.get(m.userId);
      const days = last ? Math.floor((now.getTime() - last.getTime()) / DAY) : null;
      if (days === null) {
        items.push({
          id: `1x1-never-${m.id}`,
          title: name,
          reason: "Nunca teve uma 1:1 registrada",
          severity: "high",
          kind: "one_on_one",
          link: "/app/one-on-ones",
        });
      } else if (days >= 14) {
        items.push({
          id: `1x1-${m.id}`,
          title: name,
          reason: `Sem 1:1 há ${days} dias`,
          severity: days >= 30 ? "high" : "medium",
          kind: "one_on_one",
          link: "/app/one-on-ones",
        });
      }
    }

    // 2) Feedbacks pendentes
    const nameByUser = new Map(
      members.map((m) => [m.userId, m.user?.profile?.fullName || m.user?.email || "Liderado"]),
    );
    for (const f of feedbacks) {
      const due = f.followUpAt ?? f.dueAt;
      const days = Math.floor((now.getTime() - f.createdAt.getTime()) / DAY);
      const overdue = due ? due < now : days >= 7;
      if (!overdue) continue;
      items.push({
        id: `fb-${f.id}`,
        title: (f.subjectUserId ? nameByUser.get(f.subjectUserId) : null) ?? f.subjectLabel ?? "Feedback",
        reason: `Feedback pendente há ${days} dia${days === 1 ? "" : "s"}`,
        severity: days >= 14 ? "high" : "medium",
        kind: "feedback",
        link: "/app/feedbacks",
      });
    }

    // 3) Delegações atrasadas
    for (const d of delegations as Array<{ id: string; title: string; dueAt: Date | null; status: string }>) {
      if (["done", "canceled"].includes(String(d.status))) continue;
      const days = d.dueAt ? Math.floor((now.getTime() - new Date(d.dueAt).getTime()) / DAY) : 0;
      items.push({
        id: `dg-${d.id}`,
        title: d.title,
        reason: `Delegação atrasada há ${Math.max(days, 1)} dia${days === 1 ? "" : "s"}`,
        severity: "high",
        kind: "delegation",
        link: "/app/organization/delegations",
      });
    }

    // 4) Próximos rituais (informativo)
    for (const occ of occurrences as Array<{ id: string; scheduledAt: Date; ritual: { name: string } }>) {
      const hours = Math.max(1, Math.round((new Date(occ.scheduledAt).getTime() - now.getTime()) / 3_600_000));
      items.push({
        id: `rt-${occ.id}`,
        title: occ.ritual?.name ?? "Ritual",
        reason: hours <= 48 ? `Ritual em ${hours}h` : "Ritual agendado",
        severity: "low",
        kind: "ritual",
        link: "/app/consciencia/agenda",
      });
    }

    const rank = { high: 0, medium: 1, low: 2 } as const;
    items.sort((a, b) => rank[a.severity] - rank[b.severity]);

    res.json({
      generatedAt: now.toISOString(),
      items: items.slice(0, 8),
      total: items.length,
      coreScore: snapshot?.score ?? null,
    });
  } catch (err) {
    console.error("[me] falha ao montar atenção", err);
    res.json({ generatedAt: now.toISOString(), items: [], total: 0, coreScore: null });
  }
});

// GET /me/dna — CORE DNA do usuário logado
meRouter.get("/dna", async (req, res) => {
  const dna = await prisma.leaderDNA.findUnique({ where: { userId: req.userId! } });
  res.json({ dna });
});

// POST /me/dna/import — importa DNA já gerado (usuários que fizeram a mentoria Neo)
const importSchema = z.object({
  scores: z.record(z.number()).optional(),
  strengths: z.array(z.string()).optional(),
  improvements: z.array(z.string()).optional(),
  behavioral: z.record(z.unknown()).optional(),
  emotional: z.record(z.unknown()).optional(),
  technical: z.record(z.unknown()).optional(),
  communication: z.record(z.unknown()).optional(),
  source: z.string().optional(),
});

meRouter.post("/dna/import", async (req, res) => {
  const parsed = importSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const d = parsed.data;
  const dna = await prisma.leaderDNA.upsert({
    where: { userId: req.userId! },
    update: {
      scores: (d.scores ?? undefined) as never,
      strengths: d.strengths ?? undefined,
      improvements: d.improvements ?? undefined,
      behavioral: (d.behavioral ?? undefined) as never,
      emotional: (d.emotional ?? undefined) as never,
      technical: (d.technical ?? undefined) as never,
      communication: (d.communication ?? undefined) as never,
    },
    create: {
      userId: req.userId!,
      scores: (d.scores ?? {}) as never,
      strengths: d.strengths ?? [],
      improvements: d.improvements ?? [],
      behavioral: (d.behavioral ?? {}) as never,
      emotional: (d.emotional ?? {}) as never,
      technical: (d.technical ?? {}) as never,
      communication: (d.communication ?? {}) as never,
    },
  });
  await prisma.leaderDNAEvent.create({
    data: {
      dnaId: dna.id,
      kind: "import",
      payload: parsed.data as never,
      source: d.source ?? "manual",
    },
  });
  res.json({ ok: true, dna });
});

// POST /me/onboarding/neo-mentorship — grava se o usuário já fez a mentoria Neo
meRouter.post("/onboarding/neo-mentorship", async (req, res) => {
  const schema = z.object({ did: z.boolean() });
  const parsed = schema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: "invalid payload" });
  await prisma.profile.upsert({
    where: { id: req.userId! },
    update: { didNeoMentorship: parsed.data.did },
    create: { id: req.userId!, didNeoMentorship: parsed.data.did },
  });
  res.json({ ok: true });
});

// GET /me/journey/initial — jornada inicial publicada + step atual (best-effort)
meRouter.get("/journey/initial", async (_req, res) => {
  const journey = await prisma.journey.findFirst({
    where: { isInitial: true, status: "active" },
    orderBy: { updatedAt: "desc" },
    include: {
      steps: { orderBy: { orderIndex: "asc" } },
    },
  });
  if (!journey) return res.json({ journey: null });
  res.json({ journey });
});