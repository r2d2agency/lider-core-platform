import { Router, type Response } from "express";
import { prisma } from "../prisma.js";
import { requireAuth } from "../auth.js";
import { completeChat } from "../lib/ai-gateway.js";

/**
 * Fase 4 · IA Coach preditiva + Lembretes.
 * Endpoints heurísticos que olham os últimos 14–30 dias e antecipam
 * risco H/S/H, além de listar pendências prontas para virar
 * mensagens de WhatsApp/Slack (item 19).
 */
export const coachRouter = Router();
coachRouter.use(requireAuth);

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
function forbid(res: Response) {
  return res.status(403).json({ error: "Forbidden" });
}

coachRouter.param("orgId", async (req, res, next, orgId) => {
  if (!(await assertOrgAccess(req.userId!, orgId))) return forbid(res);
  next();
});

// ------------------------------------------------------------
// GET /organization/:orgId/coach/predictions
// Heurística simples que projeta risco H/S/H 2 semanas à frente
// olhando: rituais atrasados, delegações fora do prazo, feedback
// e pulsos das últimas semanas.
// ------------------------------------------------------------
coachRouter.get("/:orgId/coach/predictions", async (req, res) => {
  const orgId = req.params.orgId;
  const now = new Date();
  const twoWeeks = new Date(now.getTime() - 14 * 86400_000);
  const fourWeeks = new Date(now.getTime() - 28 * 86400_000);

  const [ritualOcc, delegations, feedbacks, pulses] = await Promise.all([
    prisma.ritualOccurrence.findMany({
      where: { ritual: { organizationId: orgId }, scheduledAt: { gte: fourWeeks } },
      select: { status: true, scheduledAt: true },
    }),
    prisma.delegation.findMany({
      where: { organizationId: orgId },
      select: { status: true, dueAt: true, doneAt: true, updatedAt: true },
    }),
    prisma.feedbackRecord.findMany({
      where: { organizationId: orgId, createdAt: { gte: fourWeeks } },
      select: { createdAt: true },
    }),
    prisma.pulseSend.findMany({
      where: { organizationId: orgId, createdAt: { gte: fourWeeks } },
      select: { status: true, createdAt: true, answeredAt: true },
    }),
  ]);

  // Hard: rituais realizados / agendados (2 semanas)
  const ritLast = ritualOcc.filter((o) => o.scheduledAt >= twoWeeks);
  const ritPrev = ritualOcc.filter((o) => o.scheduledAt < twoWeeks);
  const doneRate = (list: typeof ritualOcc) =>
    list.length ? list.filter((o) => o.status === "done").length / list.length : 0;
  const hardCur = doneRate(ritLast);
  const hardPrev = doneRate(ritPrev);
  const hardTrend = hardCur - hardPrev;

  // Soft: delegações no prazo (últimas 30 dias com dueAt)
  const delWithDue = delegations.filter((d) => d.dueAt);
  const overdue = delWithDue.filter((d) => d.status !== "done" && d.dueAt && d.dueAt < now).length;
  const softRate = delWithDue.length ? 1 - overdue / delWithDue.length : 1;

  // Heart: consistência semanal de feedbacks
  const wkLast = feedbacks.filter((f) => f.createdAt >= twoWeeks).length;
  const wkPrev = feedbacks.filter((f) => f.createdAt < twoWeeks).length;
  const heartTrend = wkLast - wkPrev; // volume delta

  const closedPulses = pulses.filter((p) => p.answeredAt != null).length;
  const openPulses = pulses.filter((p) => p.answeredAt == null).length;

  const risks: Array<{
    dimension: "hard" | "soft" | "heart";
    level: "low" | "medium" | "high";
    title: string;
    reason: string;
    action: string;
  }> = [];

  if (hardCur < 0.6 || hardTrend < -0.15) {
    risks.push({
      dimension: "hard",
      level: hardCur < 0.4 ? "high" : "medium",
      title: "Rituais quebrando",
      reason: `Apenas ${(hardCur * 100).toFixed(0)}% dos rituais aconteceram nas últimas 2 semanas.`,
      action: "Reagendar rituais faltantes e reduzir cadência se estiver irrealista.",
    });
  }
  if (overdue >= 3 || softRate < 0.6) {
    risks.push({
      dimension: "soft",
      level: overdue >= 5 ? "high" : "medium",
      title: "Delegações atrasadas acumulando",
      reason: `${overdue} delegações com prazo estourado.`,
      action: "Revisar carga do time. Repactuar prazo ou desmembrar a entrega.",
    });
  }
  if (heartTrend < -1 || (wkLast === 0 && wkPrev > 0)) {
    risks.push({
      dimension: "heart",
      level: wkLast === 0 ? "high" : "medium",
      title: "Ritmo de feedback caiu",
      reason: `Feedback saiu de ${wkPrev} para ${wkLast} nas últimas 2 semanas.`,
      action: "Bloquear 20min esta semana para 1 feedback fato-por-pessoa.",
    });
  }
  if (openPulses > 0 && closedPulses === 0) {
    risks.push({
      dimension: "heart",
      level: "medium",
      title: "Pulsos abertos sem resposta",
      reason: `${openPulses} pulsos ativos e nenhum fechado no período.`,
      action: "Reenviar link do pulso via WhatsApp. Sem sinal do time, o Heart voa cego.",
    });
  }

  res.json({
    generatedAt: now.toISOString(),
    horizonWeeks: 2,
    signals: {
      hard: { current: Number(hardCur.toFixed(2)), previous: Number(hardPrev.toFixed(2)), trend: Number(hardTrend.toFixed(2)) },
      soft: { rate: Number(softRate.toFixed(2)), overdue },
      heart: { feedbackLast2w: wkLast, feedbackPrev2w: wkPrev, openPulses, closedPulses },
    },
    risks,
  });
});

// ------------------------------------------------------------
// GET /organization/:orgId/coach/reminders
// Lista pendências com sugestão de mensagem pronta para WhatsApp/Slack.
// ------------------------------------------------------------
coachRouter.get("/:orgId/coach/reminders", async (req, res) => {
  const orgId = req.params.orgId;
  const now = new Date();
  const in3Days = new Date(now.getTime() + 3 * 86400_000);

  const [delegations, pulseSends, oneOnOnes] = await Promise.all([
    prisma.delegation.findMany({
      where: {
        organizationId: orgId,
        status: { in: ["open", "in_progress"] },
        dueAt: { lte: in3Days },
      },
      orderBy: { dueAt: "asc" },
      take: 30,
    }),
    prisma.pulseSend.findMany({
      where: { organizationId: orgId, answeredAt: null, status: "pending" },
      include: { template: { select: { title: true } } },
      orderBy: { createdAt: "asc" },
      take: 30,
    }),
    prisma.oneOnOne.findMany({
      where: { organizationId: orgId, status: "scheduled", scheduledAt: { lte: in3Days } },
      orderBy: { scheduledAt: "asc" },
      take: 20,
    }),
  ]);

  // Buscar dados dos assignees em lote
  const userIds = Array.from(new Set([
    ...delegations.map((d) => d.assigneeId).filter((v): v is string => !!v),
    ...oneOnOnes.map((o) => o.subjectUserId),
  ]));
  const users = userIds.length
    ? await prisma.user.findMany({ where: { id: { in: userIds } }, include: { profile: true } })
    : [];
  const userMap = new Map(users.map((u) => [u.id, u]));

  const clean = (phone: string | null | undefined) => (phone ? phone.replace(/\D/g, "") : "");
  const wa = (phone: string, text: string) =>
    phone ? `https://wa.me/${clean(phone)}?text=${encodeURIComponent(text)}` : null;

  const items: Array<{
    id: string;
    kind: "delegation" | "pulse" | "one_on_one";
    title: string;
    subtitle: string;
    dueAt: string | null;
    recipient: string | null;
    whatsappUrl: string | null;
    slackText: string;
  }> = [];

  for (const d of delegations) {
    const u = d.assigneeId ? userMap.get(d.assigneeId) : null;
    const name = u?.profile?.fullName ?? u?.email ?? "responsável";
    const phone = clean(u?.profile?.phone ?? "");
    const dueTxt = d.dueAt ? d.dueAt.toLocaleDateString("pt-BR") : "sem prazo";
    const overdue = d.dueAt && d.dueAt < now;
    const text = `Oi ${name.split(" ")[0]}, lembrete rápido: "${d.title}" ${overdue ? "está atrasada" : `vence em ${dueTxt}`}. Consegue devolver hoje?`;
    items.push({
      id: d.id,
      kind: "delegation",
      title: d.title,
      subtitle: `Delegação · ${overdue ? "atrasada" : "vence em " + dueTxt}`,
      dueAt: d.dueAt ? d.dueAt.toISOString() : null,
      recipient: name,
      whatsappUrl: wa(phone, text),
      slackText: text,
    });
  }

  for (const p of pulseSends) {
    const name = p.subjectLabel ?? "colega";
    const phone = clean(p.subjectPhone);
    const link = `${req.headers.origin ?? ""}/p/${p.token}`;
    const text = `Oi ${name.split(" ")[0]}, ainda dá pra responder o pulso "${p.template?.title ?? ""}"? Leva 2 min: ${link}`;
    items.push({
      id: p.id,
      kind: "pulse",
      title: p.template?.title ?? "Pulso",
      subtitle: "Aguardando resposta",
      dueAt: null,
      recipient: name,
      whatsappUrl: wa(phone, text),
      slackText: text,
    });
  }

  for (const oo of oneOnOnes) {
    const u = userMap.get(oo.subjectUserId);
    const name = u?.profile?.fullName ?? u?.email ?? "liderado";
    const phone = clean(u?.profile?.phone ?? "");
    const dueTxt = oo.scheduledAt ? oo.scheduledAt.toLocaleDateString("pt-BR") : "";
    const text = `Oi ${name.split(" ")[0]}, nosso 1:1 é ${dueTxt}. Manda 2–3 tópicos que quer levar?`;
    items.push({
      id: oo.id,
      kind: "one_on_one",
      title: `1:1 com ${name}`,
      subtitle: `Agendado ${dueTxt}`,
      dueAt: oo.scheduledAt ? oo.scheduledAt.toISOString() : null,
      recipient: name,
      whatsappUrl: wa(phone, text),
      slackText: text,
    });
  }

  res.json({ generatedAt: now.toISOString(), items });
});

// ------------------------------------------------------------
// POST /organization/:orgId/coach/ai-recommendations
// Usa a IA configurada em Admin → Provedor de IA (OpenAI/Gemini)
// para gerar recomendações personalizadas baseadas nos sinais H/S/H.
// ------------------------------------------------------------
coachRouter.post("/:orgId/coach/ai-recommendations", async (req, res) => {
  const orgId = req.params.orgId;
  const now = new Date();
  const fourWeeks = new Date(now.getTime() - 28 * 86400_000);
  const twoWeeks = new Date(now.getTime() - 14 * 86400_000);

  try {
    const [org, ritualOcc, delegations, feedbacks, pulses, oneOnOnes, indicators] = await Promise.all([
      prisma.organization.findUnique({ where: { id: orgId }, select: { name: true } }),
      prisma.ritualOccurrence.findMany({
        where: { ritual: { organizationId: orgId }, scheduledAt: { gte: fourWeeks } },
        select: { status: true, scheduledAt: true, ritual: { select: { name: true, type: true } } },
      }),
      prisma.delegation.findMany({
        where: { organizationId: orgId },
        select: { title: true, status: true, dueAt: true, doneAt: true },
      }),
      prisma.feedbackRecord.findMany({
        where: { organizationId: orgId, createdAt: { gte: fourWeeks } },
        select: { createdAt: true, type: true },
      }),
      prisma.pulseSend.findMany({
        where: { organizationId: orgId, createdAt: { gte: fourWeeks } },
        select: { status: true, answeredAt: true },
      }),
      prisma.oneOnOne.findMany({
        where: { organizationId: orgId, scheduledAt: { gte: fourWeeks } },
        select: { status: true, scheduledAt: true },
      }),
      prisma.indicator.findMany({
        where: { organizationId: orgId },
        select: {
          name: true,
          target: true,
          unit: true,
          readings: { orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }], take: 1, select: { value: true } },
        },
        take: 20,
      }),
    ]);

    const ritLast = ritualOcc.filter((o) => o.scheduledAt >= twoWeeks);
    const ritDoneRate = ritLast.length ? ritLast.filter((o) => o.status === "done").length / ritLast.length : 0;
    const overdue = delegations.filter((d) => d.status !== "done" && d.dueAt && d.dueAt < now).length;
    const fbLast2w = feedbacks.filter((f) => f.createdAt >= twoWeeks).length;
    const fbPrev2w = feedbacks.filter((f) => f.createdAt < twoWeeks).length;
    const openPulses = pulses.filter((p) => p.answeredAt == null).length;
    const closedPulses = pulses.filter((p) => p.answeredAt != null).length;
    const scheduled1on1 = oneOnOnes.filter((o) => o.status === "scheduled").length;
    const done1on1 = oneOnOnes.filter((o) => o.status === "done").length;

    const indicatorLines = indicators
      .filter((i) => i.readings.length > 0)
      .slice(0, 8)
      .map((i) => {
        const cur = i.readings[0]?.value ?? null;
        const gap = cur != null && i.target ? (((cur - i.target) / i.target) * 100).toFixed(1) : "n/a";
        return `- ${i.name}: atual=${cur ?? "?"}${i.unit ?? ""} · meta=${i.target ?? "?"}${i.unit ?? ""} · desvio=${gap}%`;
      })
      .join("\n");

    const context = `Empresa: ${org?.name ?? "—"}
Janela analisada: últimos 28 dias (comparativo 2 semanas atuais vs. 2 semanas anteriores)

HARD (Estrutura & Rituais):
- Rituais realizados nas últimas 2 semanas: ${(ritDoneRate * 100).toFixed(0)}% (${ritLast.filter((o) => o.status === "done").length}/${ritLast.length})
- 1:1s agendados: ${scheduled1on1} · concluídos no período: ${done1on1}

SOFT (Execução & Delegações):
- Delegações com prazo estourado: ${overdue}
- Total de delegações abertas/andamento: ${delegations.filter((d) => d.status !== "done").length}

HEART (Cultura & Escuta):
- Feedbacks: ${fbLast2w} (últimas 2s) vs ${fbPrev2w} (2s anteriores)
- Pulsos: ${closedPulses} respondidos · ${openPulses} pendentes

INDICADORES (últimas leituras):
${indicatorLines || "(nenhum indicador com leitura)"}`;

    const messages = [
      {
        role: "system" as const,
        content: `Você é um coach executivo especializado na metodologia C.O.R.E. (Consciência, Organização, Resultado, Evolução) para líderes brasileiros. Sua tarefa é analisar os sinais H/S/H (Hard/Soft/Heart) de uma equipe e devolver:

1) Um DIAGNÓSTICO curto (2-3 frases) do momento da liderança;
2) 3 a 5 RECOMENDAÇÕES PRÁTICAS e específicas, cada uma com: título curto, dimensão (Hard | Soft | Heart), prazo sugerido e o primeiro passo concreto (o "faça agora");
3) Um RITUAL da semana — 1 conversa ou reunião de 20 min para desbloquear o time.

Regras:
- Português do Brasil, tom direto e sênior, sem clichês de coach.
- Se um sinal está bom, elogie objetivamente e não force problema.
- Use apenas os dados fornecidos, sem inventar métricas.
- Formato de saída: markdown com títulos ## Diagnóstico, ## Recomendações e ## Ritual da semana. Nas recomendações use lista numerada.`,
      },
      { role: "user" as const, content: context },
    ];

    const text = await completeChat({ messages, temperature: 0.5 });
    res.json({
      generatedAt: now.toISOString(),
      context: {
        ritDoneRate,
        overdue,
        fbLast2w,
        fbPrev2w,
        openPulses,
        closedPulses,
        indicators: indicators.length,
      },
      markdown: text,
    });
  } catch (err) {
    const e = err as Error;
    console.error("[coach/ai-recommendations]", e);
    res.status(400).json({ error: e.message });
  }
});