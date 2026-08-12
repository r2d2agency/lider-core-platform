import { Router, type Response } from "express";
import multer from "multer";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { requireAuth } from "../auth.js";
import { completeChat, streamChat, transcribeAudio, type ChatMessage } from "../lib/ai-gateway.js";
import { neoContextMessage } from "../lib/neo-context.js";

/**
 * IA Coach — usa o provedor de IA (OpenAI ou Gemini) configurado pelo
 * administrador em Admin → Provedor de IA, com contexto real do líder.
 * - POST /ai/coach/context : retorna o snapshot que o modelo receberia (debug/preview)
 * - POST /ai/coach/insight : one-shot com insight semanal (JSON estruturado)
 * - POST /ai/coach/chat    : streaming SSE de resposta conversacional
 */
export const aiRouter = Router();
aiRouter.use(requireAuth);

async function assertOrgAccess(userId: string, orgId: string) {
  const superRole = await prisma.userRole.findFirst({
    where: { userId, role: { in: ["super_admin", "neo_admin"] } },
  });
  if (superRole) return true;
  const m = await prisma.membership.findFirst({ where: { userId, organizationId: orgId } });
  return !!m;
}

/**
 * Coleta os fatos que a plataforma já registra sobre este líder.
 * Tudo em pt-BR, agregado — sem PII de terceiros.
 */
async function buildLeaderContext(userId: string, orgId: string) {
  const now = new Date();
  const from = new Date(now.getTime() - 30 * 24 * 3600 * 1000);

  const [membership, org, profile, signals, delegs, rituals, snapshot, commitments] = await Promise.all([
    prisma.membership.findFirst({
      where: { userId, organizationId: orgId },
      include: { user: { include: { profile: { select: { fullName: true } } } } },
    }),
    prisma.organization.findUnique({ where: { id: orgId }, select: { name: true } }),
    prisma.leaderProfile.findUnique({
      where: { organizationId_userId: { organizationId: orgId, userId } },
    }).catch(() => null),
    prisma.crossSignal.findMany({
      where: { organizationId: orgId, userId, dismissedAt: null },
      orderBy: { createdAt: "desc" },
      take: 10,
    }).catch(() => []),
    prisma.delegation.findMany({
      where: {
        organizationId: orgId,
        assigneeId: userId,
        status: { in: ["open", "in_progress", "blocked"] },
      },
      orderBy: [{ dueAt: "asc" }],
      take: 15,
    }).catch(() => []),
    prisma.ritualOccurrence.findMany({
      where: { ritual: { organizationId: orgId, ownerId: userId }, scheduledAt: { gte: from } },
      include: { ritual: { select: { name: true, type: true } } },
      orderBy: { scheduledAt: "desc" },
      take: 30,
    }).catch(() => []),
    prisma.leadershipScoreSnapshot.findFirst({
      where: { organizationId: orgId, userId },
      orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }],
    }).catch(() => null),
    prisma.mentorshipCommitment.findMany({
      where: { organizationId: orgId, userId, status: "active" },
      take: 10,
    }).catch(() => []),
  ]);

  const done = rituals.filter((r) => r.status === "done").length;
  const missed = rituals.filter((r) => r.status === "missed").length;
  const now2 = new Date();
  const overdue = delegs.filter((d) => d.dueAt && d.dueAt < now2 && d.status !== "done").length;

  return {
    leader: membership?.user.profile?.fullName ?? "líder",
    organization: org?.name ?? "empresa",
    profile: profile
      ? {
          strengths: profile.strengths ?? [],
          risks: profile.riskFlags ?? [],
          communicationStyle: profile.communicationStyle,
          sabotages: profile.sabotages ?? [],
          assessmentAt: profile.assessmentAt,
        }
      : null,
    score: snapshot
      ? {
          total: snapshot.score,
          rituals: snapshot.ritualsScore,
          delegations: snapshot.delegScore,
          indicators: snapshot.indicatorsScore,
          diagnostic: snapshot.diagnostic,
        }
      : null,
    rituals30d: { done, missed, planned: rituals.length },
    delegations: {
      total: delegs.length,
      overdue,
      titles: delegs.slice(0, 8).map((d) => ({
        title: d.title,
        status: d.status,
        dueAt: d.dueAt,
      })),
    },
    signals: signals.map((s) => ({ kind: s.kind, severity: s.severity, detail: s.detail, title: s.title })),
    commitments: commitments.map((c) => c.phrase),
  };
}

function systemPrompt() {
  return `Você é o Coach C.O.R.E. — um coach executivo brasileiro que ajuda líderes a evoluir com base em FATOS da plataforma Líder C.O.R.E. (Consciência, Organização, Resultado, Evolução).

Regras:
- Sempre responda em português do Brasil, tom direto, claro, respeitoso.
- Use os fatos do contexto (rituais, delegações, sinais, score) — nunca invente números.
- Priorize ações concretas: quem, o quê, quando. No máximo 3 recomendações por resposta.
- Prefira perguntas provocativas a diagnósticos genéricos.
- Se faltar dado, diga que ainda não há evidência suficiente e sugira o que registrar.
- Nunca julgue caráter. Foque em comportamento observado.
- Formate em markdown enxuto: bullets curtos, títulos leves, sem emojis.`;
}

function contextMessage(ctx: unknown): ChatMessage {
  return {
    role: "system",
    content: `Contexto atual do líder (JSON):\n\`\`\`json\n${JSON.stringify(ctx, null, 2)}\n\`\`\``,
  };
}

// --- POST /:orgId/ai/coach/context (debug) ---
aiRouter.post("/:orgId/ai/coach/context", async (req, res) => {
  const orgId = req.params.orgId;
  if (!(await assertOrgAccess(req.userId!, orgId))) return res.status(403).json({ error: "Forbidden" });
  const ctx = await buildLeaderContext(req.userId!, orgId);
  res.json(ctx);
});

// --- POST /:orgId/ai/coach/insight ---
aiRouter.post("/:orgId/ai/coach/insight", async (req, res) => {
  const orgId = req.params.orgId;
  if (!(await assertOrgAccess(req.userId!, orgId))) return res.status(403).json({ error: "Forbidden" });

  try {
    const ctx = await buildLeaderContext(req.userId!, orgId);
    const text = await completeChat({
      messages: [
        { role: "system", content: systemPrompt() },
        await neoContextMessage(),
        contextMessage(ctx),
        {
          role: "user",
          content:
            "Gere o INSIGHT DA SEMANA — 3 blocos curtos:\n" +
            "1) 'O que está funcionando' (2 linhas).\n" +
            "2) 'Onde há atrito' (2 linhas — cite delegação ou ritual específico do contexto).\n" +
            "3) 'Próximo movimento' (1 ação concreta para os próximos 7 dias).",
        },
      ],
    });
    res.json({ insight: text, generatedAt: new Date().toISOString() });
  } catch (err) {
    console.error("[ai/insight]", err);
    const message = err instanceof Error ? err.message : "Falha ao gerar insight";
    res.status(500).json({ error: message });
  }
});

// --- POST /:orgId/ai/coach/chat (SSE) ---
const chatSchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string().max(4000),
    }),
  ).min(1).max(30),
});

aiRouter.post("/:orgId/ai/coach/chat", async (req, res: Response) => {
  const orgId = req.params.orgId;
  if (!(await assertOrgAccess(req.userId!, orgId))) return res.status(403).json({ error: "Forbidden" });

  const parsed = chatSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message });

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();

  const send = (event: string, data: unknown) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const ctx = await buildLeaderContext(req.userId!, orgId);
    const messages: ChatMessage[] = [
      { role: "system", content: systemPrompt() },
      await neoContextMessage(),
      contextMessage(ctx),
      ...parsed.data.messages,
    ];
    for await (const delta of streamChat({ messages })) {
      send("delta", { text: delta });
    }
    send("done", { ok: true });
    res.end();
  } catch (err) {
    console.error("[ai/chat]", err);
    send("error", { message: err instanceof Error ? err.message : "Falha" });
    res.end();
  }
});

// --- POST /:orgId/ai/explain-metric ---
const explainSchema = z.object({
  metric: z.string().min(1).max(80),
  value: z.union([z.string(), z.number()]).optional(),
  scope: z.string().max(80).optional(),
  window: z.string().max(40).optional(),
  hint: z.string().max(600).optional(),
});

aiRouter.post("/:orgId/ai/explain-metric", async (req, res) => {
  const orgId = req.params.orgId;
  if (!(await assertOrgAccess(req.userId!, orgId))) return res.status(403).json({ error: "Forbidden" });
  const parsed = explainSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message });

  try {
    const ctx = await buildLeaderContext(req.userId!, orgId);
    const { metric, value, scope, window, hint } = parsed.data;
    const text = await completeChat({
      messages: [
        { role: "system", content: systemPrompt() },
      await neoContextMessage(),
        contextMessage(ctx),
        {
          role: "user",
          content:
            `Explique de forma curta (máximo 3 parágrafos) a métrica "${metric}"` +
            (value !== undefined ? ` com valor atual ${value}` : "") +
            (scope ? ` no escopo ${scope}` : "") +
            (window ? ` na janela ${window}` : "") +
            (hint ? `. Contexto extra: ${hint}` : "") +
            ".\n\nEstrutura:\n" +
            "1) O que está por trás desse número (cite eventos concretos do contexto).\n" +
            "2) Por que isso importa agora.\n" +
            "3) Uma ação sugerida para os próximos 7 dias.",
        },
      ],
    });
    res.json({ explanation: text, generatedAt: new Date().toISOString() });
  } catch (err) {
    console.error("[ai/explain-metric]", err);
    res.status(500).json({ error: err instanceof Error ? err.message : "Falha ao explicar" });
  }
});

// ============================================================
// Briefing automático de 1:1 — agrega histórico do liderado
// ============================================================
aiRouter.post("/:orgId/ai/one-on-one/:id/brief", async (req, res) => {
  const { orgId, id } = req.params;
  if (!(await assertOrgAccess(req.userId!, orgId))) return res.status(403).json({ error: "Forbidden" });
  try {
    const session = await prisma.oneOnOne.findFirst({
      where: { id, organizationId: orgId },
    });
    if (!session) return res.status(404).json({ error: "Sessão não encontrada" });

    const subjectId = session.subjectUserId;
    const now = new Date();
    const from90 = new Date(now.getTime() - 90 * 24 * 3600 * 1000);

    const [subjectProfile, feedbacks, delegs, pdi, signals, prevSessions, snapshot] = await Promise.all([
      prisma.profile.findUnique({ where: { id: subjectId } }).catch(() => null),
      prisma.feedbackRecord.findMany({
        where: {
          organizationId: orgId,
          OR: [{ subjectUserId: subjectId }, { authorId: subjectId }],
          createdAt: { gte: from90 },
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      }).catch(() => []),
      prisma.delegation.findMany({
        where: {
          organizationId: orgId,
          assigneeId: subjectId,
          status: { in: ["open", "in_progress", "blocked"] },
        },
        orderBy: [{ dueAt: "asc" }],
        take: 15,
      }).catch(() => []),
      prisma.pdi.findFirst({
        where: { organizationId: orgId, subjectUserId: subjectId, status: "ativo" },
        include: { goals: true },
      }).catch(() => null),
      prisma.crossSignal.findMany({
        where: { organizationId: orgId, userId: subjectId, dismissedAt: null },
        orderBy: { createdAt: "desc" },
        take: 8,
      }).catch(() => []),
      prisma.oneOnOne.findMany({
        where: {
          organizationId: orgId,
          subjectUserId: subjectId,
          status: "done",
          id: { not: id },
        },
        orderBy: { scheduledAt: "desc" },
        take: 3,
        include: { items: true },
      }).catch(() => []),
      prisma.leadershipScoreSnapshot.findFirst({
        where: { organizationId: orgId, userId: subjectId },
        orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }],
      }).catch(() => null),
    ]);

    const ctx = {
      liderado: subjectProfile?.fullName ?? "liderado",
      score: snapshot ? { total: snapshot.score, diagnostico: snapshot.diagnostic } : null,
      pdi: pdi
        ? {
            titulo: pdi.title,
            foco: pdi.focus,
            metas: pdi.goals.map((g) => ({ titulo: g.title, status: g.status, prazo: g.dueAt })),
          }
        : null,
      delegacoesAbertas: delegs.map((d) => ({
        titulo: d.title,
        status: d.status,
        prazo: d.dueAt,
        atrasada: d.dueAt ? d.dueAt < now : false,
      })),
      feedbacksRecentes: feedbacks.map((f) => ({
        tipo: f.type,
        conteudo: [f.fact, f.impact, f.expectation].filter(Boolean).join(" | ").slice(0, 300),
        data: f.createdAt,
      })),
      sinaisAbertos: signals.map((s) => ({ tipo: s.kind, severidade: s.severity, titulo: s.title })),
      ultimasConversas: prevSessions.map((s) => ({
        quando: s.scheduledAt,
        resumo: s.summary,
        acoesPendentes: s.items.filter((i) => i.kind === "action" && !i.done).map((i) => i.content),
      })),
    };

    const text = await completeChat({
      messages: [
        { role: "system", content: systemPrompt() },
      await neoContextMessage(),
        { role: "system", content: `Contexto do liderado (JSON):\n\`\`\`json\n${JSON.stringify(ctx, null, 2)}\n\`\`\`` },
        {
          role: "user",
          content:
            "Prepare um BRIEFING de 1:1 em markdown, curto e acionável, com estas seções (use exatamente estes títulos):\n" +
            "## Contexto\n(2-3 linhas do momento do liderado)\n\n" +
            "## Vitórias a reconhecer\n(bullets citando fatos do contexto)\n\n" +
            "## Riscos e sinais\n(bullets — cite delegação atrasada, sinal aberto ou queda de score específicos)\n\n" +
            "## Perguntas sugeridas\n(3 perguntas provocativas)\n\n" +
            "## Ações propostas\n(2-3 ações concretas para acordar na conversa)",
        },
      ],
    });

    const updated = await prisma.oneOnOne.update({
      where: { id },
      data: { briefingMarkdown: text, briefingGeneratedAt: new Date() },
    });

    res.json({
      briefingMarkdown: updated.briefingMarkdown,
      briefingGeneratedAt: updated.briefingGeneratedAt,
    });
  } catch (err) {
    console.error("[ai/one-on-one/brief]", err);
    res.status(500).json({ error: err instanceof Error ? err.message : "Falha ao gerar briefing" });
  }
});

// ============================================================
// Voz → texto + classificação (feedback | delegação | nota)
// ============================================================
const audioUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
});

type VoiceIntent = {
  tipo: "feedback" | "delegacao" | "nota" | "kudos";
  resumo: string;
  titulo?: string;
  prazoISO?: string | null;
  membroSugerido?: string | null;
  transcricao: string;
};

aiRouter.post("/:orgId/ai/transcribe", audioUpload.single("audio"), async (req, res) => {
  const orgId = req.params.orgId;
  if (!(await assertOrgAccess(req.userId!, orgId))) return res.status(403).json({ error: "Forbidden" });
  const file = req.file;
  if (!file) return res.status(400).json({ error: "Áudio ausente" });
  try {
    const transcript = await transcribeAudio({
      audioBase64: file.buffer.toString("base64"),
      mimeType: file.mimetype || "audio/webm",
    });
    if (!transcript) return res.status(400).json({ error: "Não foi possível transcrever o áudio" });

    // Classifica e extrai entidades
    const raw = await completeChat({
      messages: [
        {
          role: "system",
          content:
            "Você recebe uma transcrição em pt-BR ditada por um líder. Classifique como um de:\n" +
            "- feedback (elogio ou crítica sobre alguém)\n" +
            "- delegacao (tarefa/pedido para alguém fazer)\n" +
            "- kudos (reconhecimento público, agradecimento, celebração de conquista)\n" +
            "- nota (observação livre)\n\n" +
            "Responda APENAS um JSON válido no formato:\n" +
            `{"tipo":"feedback|delegacao|kudos|nota","titulo":"...","resumo":"...","prazoISO":null,"membroSugerido":null}\n` +
            "prazoISO em ISO-8601 se citado, senão null. membroSugerido = nome mencionado, senão null.",
        },
        { role: "user", content: transcript },
      ],
    });

    let parsed: Omit<VoiceIntent, "transcricao"> = { tipo: "nota", resumo: transcript };
    try {
      const clean = raw.replace(/```json|```/g, "").trim();
      const jsonStart = clean.indexOf("{");
      const jsonEnd = clean.lastIndexOf("}");
      if (jsonStart >= 0 && jsonEnd > jsonStart) {
        parsed = JSON.parse(clean.slice(jsonStart, jsonEnd + 1));
      }
    } catch {
      /* fallback já setado */
    }

    const out: VoiceIntent = { ...parsed, transcricao: transcript };
    res.json(out);
  } catch (err) {
    console.error("[ai/transcribe]", err);
    res.status(500).json({ error: err instanceof Error ? err.message : "Falha ao transcrever" });
  }
});