import { Router, type Response } from "express";
import { z } from "zod";
import { randomBytes } from "node:crypto";
import { prisma } from "../prisma.js";
import { heuristicTrack } from "../lib/subordinate-track.js";
import { requireAuth } from "../auth.js";
import { notifyInApp } from "../lib/notifications.js";

/**
 * Pulsos — links públicos com token para o liderado responder
 * sem precisar de login. Suporta 4 tipos:
 *  - feedback: perguntas abertas + escala (feedback solicitado)
 *  - climate: pulse curto (humor/carga/clareza)
 *  - disc: 24 pares forçados
 *  - custom: montado pelo líder
 */

// ---------------------- helpers ----------------------

function badReq(res: Response, err: unknown) {
  return res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
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

function genToken() {
  // 32 chars url-safe
  return randomBytes(24).toString("base64url");
}

// ---------------------- default templates ----------------------

type Q =
  | { id: string; type: "scale"; label: string; min?: number; max?: number; minLabel?: string; maxLabel?: string; required?: boolean }
  | { id: string; type: "text"; label: string; placeholder?: string; required?: boolean }
  | { id: string; type: "choice"; label: string; options: string[]; multi?: boolean; required?: boolean }
  | { id: string; type: "disc_pair"; label: string; options: { text: string; dim: "D" | "I" | "S" | "C" }[] };

const SYSTEM_TEMPLATES: Array<{
  slug: string;
  kind: "feedback" | "climate" | "disc" | "custom" | "sabotadores" | "cerebral";
  title: string;
  intro: string;
  buildQuestions: () => Q[];
}> = [
  {
    slug: "feedback_leader",
    kind: "feedback",
    title: "Feedback pro seu líder",
    intro:
      "Sua resposta é confidencial e ajuda a melhorar a forma como somos liderados. Leva 2 minutos.",
    buildQuestions: () => [
      { id: "clarity", type: "scale", label: "Quão clara está a direção do time?", minLabel: "Nada clara", maxLabel: "Muito clara", required: true },
      { id: "autonomy", type: "scale", label: "Você sente que tem autonomia pra decidir?", minLabel: "Pouca", maxLabel: "Muita", required: true },
      { id: "feedback_quality", type: "scale", label: "Como está a qualidade dos feedbacks que recebe?", minLabel: "Baixa", maxLabel: "Excelente", required: true },
      { id: "keep", type: "text", label: "O que seu líder deveria CONTINUAR fazendo?", required: true },
      { id: "start", type: "text", label: "O que ele deveria COMEÇAR a fazer?", required: true },
      { id: "stop", type: "text", label: "O que ele deveria PARAR de fazer?" },
    ],
  },
  {
    slug: "climate_weekly",
    kind: "climate",
    title: "Pulse semanal — 30 segundos",
    intro: "Três perguntas rápidas pra gente saber como você tá essa semana.",
    buildQuestions: () => [
      { id: "mood", type: "scale", label: "Como você tá se sentindo essa semana?", minLabel: "Muito mal", maxLabel: "Muito bem", required: true },
      { id: "workload", type: "scale", label: "Como tá sua carga de trabalho?", minLabel: "Baixíssima", maxLabel: "Insustentável", required: true },
      { id: "clarity", type: "scale", label: "Quão claro tá o que se espera de você?", minLabel: "Confuso", maxLabel: "Cristalino", required: true },
      { id: "note", type: "text", label: "Algo que você queira contar? (opcional)" },
    ],
  },
  {
    slug: "disc_light",
    kind: "disc",
    title: "DISC leve — Perfil comportamental",
    intro:
      "Em cada par, escolha a frase que MAIS te descreve. Não existe resposta certa. Leva 5 minutos.",
    buildQuestions: buildDiscPairs,
  },
  {
    slug: "sabotadores_10",
    kind: "sabotadores",
    title: "Sabotadores — 10 padrões internos",
    intro:
      "Para cada afirmação, escolha o quanto ela te descreve (1 = nada, 5 = totalmente). Sem resposta certa.",
    buildQuestions: buildSabotageQuestions,
  },
  {
    slug: "cerebral_8",
    kind: "cerebral",
    title: "Predominância cerebral — Águia · Lobo · Gato · Tubarão",
    intro:
      "Escolha em cada bloco a frase que MAIS te representa hoje. Leva 3 minutos.",
    buildQuestions: buildCerebralQuestions,
  },
  {
    slug: "custom_blank",
    kind: "custom",
    title: "Pesquisa personalizada",
    intro: "Responda com sinceridade.",
    buildQuestions: () => [
      { id: "q1", type: "text", label: "Pergunta 1", required: true },
    ],
  },
];

const SABOTAGE_PILLARS = [
  { id: "juiz", label: "Juiz interno", q: "Costumo julgar duramente a mim, aos outros ou às circunstâncias." },
  { id: "agradador", label: "Agradador", q: "Foco em agradar e evito criar desconforto mesmo quando preciso." },
  { id: "hiper_realizador", label: "Hiper-realizador", q: "Meu valor depende do quanto entrego. Difícil parar." },
  { id: "hiper_racional", label: "Hiper-racional", q: "Racionalizo tudo. Emoção do outro me incomoda." },
  { id: "vitima", label: "Vítima", q: "Percebo que sofro mais do que os outros nas mesmas situações." },
  { id: "evasivo", label: "Evasivo", q: "Evito conflitos e conversas difíceis, mesmo caras." },
  { id: "controlador", label: "Controlador", q: "Preciso ter tudo sob controle, custe o que custar." },
  { id: "reservado", label: "Reservado", q: "Guardo o que sinto e mantenho distância emocional." },
  { id: "inquieto", label: "Inquieto", q: "Fico entediado rápido. Preciso de estímulos novos." },
  { id: "perfeccionista", label: "Perfeccionista", q: "Retenho entregas até que estejam impecáveis. Nada é bom suficiente." },
] as const;

function buildSabotageQuestions(): Q[] {
  return SABOTAGE_PILLARS.map((p) => ({
    id: p.id,
    type: "scale",
    label: p.q,
    min: 1,
    max: 4,
    minLabel: "1 · raramente",
    maxLabel: "4 · quase sempre",
    required: true,
  }));
}

function scoreSabotages(answers: Record<string, unknown>) {
  const scores: Record<string, number> = {};
  for (const p of SABOTAGE_PILLARS) {
    const v = answers[p.id];
    if (typeof v === "number" && Number.isFinite(v)) {
      const normalized = Math.round(v);
      if (normalized < 1 || normalized > 4) continue;
      scores[p.label] = Math.round(((normalized - 1) / 3) * 100);
    }
  }
  return scores;
}

const CEREBRAL_BLOCKS: Array<{ id: string; label: string; opts: Array<{ text: string; dim: "aguia" | "lobo" | "gato" | "tubarao" }> }> = [
  { id: "b1", label: "Diante de um problema novo…", opts: [
    { text: "Subo o zoom e vejo o todo antes de agir.", dim: "aguia" },
    { text: "Assumo o comando e articulo o grupo.", dim: "lobo" },
    { text: "Sinto o clima e busco uma saída criativa.", dim: "gato" },
    { text: "Ataco agora, ajusto depois.", dim: "tubarao" },
  ]},
  { id: "b2", label: "O que mais me motiva no trabalho é…", opts: [
    { text: "Descobrir padrões e estratégias.", dim: "aguia" },
    { text: "Formar time forte e proteger o território.", dim: "lobo" },
    { text: "Ter liberdade e adaptar rota.", dim: "gato" },
    { text: "Vencer disputas e bater metas.", dim: "tubarao" },
  ]},
  { id: "b3", label: "Sob pressão eu tendo a…", opts: [
    { text: "Isolar e analisar antes de decidir.", dim: "aguia" },
    { text: "Chamar o time e coordenar frente.", dim: "lobo" },
    { text: "Improvisar e mudar de tática.", dim: "gato" },
    { text: "Acelerar e forçar resultado.", dim: "tubarao" },
  ]},
  { id: "b4", label: "Meu jeito de decidir…", opts: [
    { text: "Dados, cenários, longo prazo.", dim: "aguia" },
    { text: "Consenso do time, protejo os meus.", dim: "lobo" },
    { text: "Intuição e leitura do momento.", dim: "gato" },
    { text: "Rápido e direto, sem hesitar.", dim: "tubarao" },
  ]},
  { id: "b5", label: "Sou reconhecido(a) por…", opts: [
    { text: "Visão de alto.", dim: "aguia" },
    { text: "Liderança de grupo.", dim: "lobo" },
    { text: "Criatividade e independência.", dim: "gato" },
    { text: "Foco em resultado e velocidade.", dim: "tubarao" },
  ]},
  { id: "b6", label: "Minha maior fragilidade é…", opts: [
    { text: "Ficar preso na análise.", dim: "aguia" },
    { text: "Exigir demais do time.", dim: "lobo" },
    { text: "Fugir quando prende demais.", dim: "gato" },
    { text: "Passar por cima de gente.", dim: "tubarao" },
  ]},
  { id: "b7", label: "Prefiro trabalhar…", opts: [
    { text: "Com espaço mental para pensar.", dim: "aguia" },
    { text: "Comandando um grupo bem alinhado.", dim: "lobo" },
    { text: "Sozinho(a) e no meu ritmo.", dim: "gato" },
    { text: "Em ambiente competitivo com placar.", dim: "tubarao" },
  ]},
  { id: "b8", label: "Se pudesse mudar uma coisa em mim…", opts: [
    { text: "Agir mais rápido.", dim: "aguia" },
    { text: "Ser menos protetor(a).", dim: "lobo" },
    { text: "Comprometer-me mais com o longo prazo.", dim: "gato" },
    { text: "Escutar antes de reagir.", dim: "tubarao" },
  ]},
];

function buildCerebralQuestions(): Q[] {
  return CEREBRAL_BLOCKS.map((b) => ({
    id: b.id,
    type: "choice",
    label: b.label,
    options: b.opts.map((o) => o.text),
    required: true,
  }));
}

function scoreCerebral(answers: Record<string, unknown>) {
  const counts = { aguia: 0, lobo: 0, gato: 0, tubarao: 0 };
  for (const b of CEREBRAL_BLOCKS) {
    const chosenText = answers[b.id];
    const opt = b.opts.find((o) => o.text === chosenText);
    if (opt) counts[opt.dim] += 1;
  }
  const total = counts.aguia + counts.lobo + counts.gato + counts.tubarao || 1;
  const pct = {
    aguia: Math.round((counts.aguia / total) * 100),
    lobo: Math.round((counts.lobo / total) * 100),
    gato: Math.round((counts.gato / total) * 100),
    tubarao: Math.round((counts.tubarao / total) * 100),
  };
  const primary = (Object.keys(pct) as Array<keyof typeof pct>).sort((a, b) => pct[b] - pct[a])[0];
  return { counts, pct, primary };
}

function buildDiscPairs(): Q[] {
  // 24 forced-choice pairs — 6 per DISC dimension across pairs
  const pairs: Array<[[string, "D" | "I" | "S" | "C"], [string, "D" | "I" | "S" | "C"]]> = [
    [["Direto ao ponto", "D"], ["Divertido em grupo", "I"]],
    [["Paciente com pessoas", "S"], ["Detalhista com dados", "C"]],
    [["Gosto de comandar", "D"], ["Gosto de acolher", "S"]],
    [["Falo com entusiasmo", "I"], ["Sigo regras à risca", "C"]],
    [["Assumo riscos", "D"], ["Analiso antes de agir", "C"]],
    [["Convenço pessoas", "I"], ["Escuto antes de opinar", "S"]],
    [["Foco em resultado", "D"], ["Foco em qualidade", "C"]],
    [["Alegro o ambiente", "I"], ["Mantenho a harmonia", "S"]],
    [["Decido rápido", "D"], ["Decido com cuidado", "C"]],
    [["Gosto de novidades", "I"], ["Prefiro rotina", "S"]],
    [["Enfrento conflitos", "D"], ["Evito conflitos", "S"]],
    [["Sou espontâneo", "I"], ["Sou reservado", "C"]],
    [["Impaciente com lentidão", "D"], ["Paciente por natureza", "S"]],
    [["Comunico com humor", "I"], ["Comunico com precisão", "C"]],
    [["Competitivo", "D"], ["Colaborativo", "S"]],
    [["Otimista sempre", "I"], ["Cético saudável", "C"]],
    [["Direto e firme", "D"], ["Diplomático", "S"]],
    [["Persuasivo", "I"], ["Rigoroso", "C"]],
    [["Tomo iniciativa", "D"], ["Aguardo alinhamento", "S"]],
    [["Improviso bem", "I"], ["Planejo tudo", "C"]],
    [["Gosto de mudar as coisas", "D"], ["Gosto de estabilidade", "S"]],
    [["Falo mais que ouço", "I"], ["Ouço mais que falo", "C"]],
    [["Motivo pela pressão", "D"], ["Motivo pelo apoio", "S"]],
    [["Motivo pelo entusiasmo", "I"], ["Motivo pela lógica", "C"]],
  ];
  return pairs.map((p, i) => ({
    id: `p${i + 1}`,
    type: "disc_pair" as const,
    label: `Par ${i + 1}`,
    options: [
      { text: p[0][0], dim: p[0][1] },
      { text: p[1][0], dim: p[1][1] },
    ],
  }));
}

function scoreDisc(answers: Record<string, unknown>, questions: Q[]) {
  const counts = { D: 0, I: 0, S: 0, C: 0 };
  for (const q of questions) {
    if (q.type !== "disc_pair") continue;
    const val = answers[q.id];
    const chosen = q.options.find((o) => o.text === val);
    if (chosen) counts[chosen.dim] += 1;
  }
  const total = counts.D + counts.I + counts.S + counts.C || 1;
  const pct = {
    D: Math.round((counts.D / total) * 100),
    I: Math.round((counts.I / total) * 100),
    S: Math.round((counts.S / total) * 100),
    C: Math.round((counts.C / total) * 100),
  };
  const primary = (Object.keys(pct) as Array<keyof typeof pct>).sort((a, b) => pct[b] - pct[a])[0];
  return { counts, pct, primary };
}

function summarize(kind: string, answers: Record<string, unknown>, questions: Q[]) {
  const parts: string[] = [];
  for (const q of questions) {
    if (q.type === "scale") {
      const v = answers[q.id];
      if (typeof v === "number") parts.push(`${q.label} → ${v}/5`);
    } else if (q.type === "text") {
      const v = answers[q.id];
      if (typeof v === "string" && v.trim()) parts.push(`${q.label} → "${v.trim().slice(0, 120)}"`);
    } else if (q.type === "choice") {
      const v = answers[q.id];
      if (v) parts.push(`${q.label} → ${Array.isArray(v) ? v.join(", ") : String(v)}`);
    }
  }
  if (kind === "disc") return "Perfil DISC calculado."; // detail lives in discProfile
  return parts.slice(0, 4).join(" · ");
}

async function ensureSystemTemplates() {
  for (const t of SYSTEM_TEMPLATES) {
    const existing = await prisma.pulseTemplate.findFirst({
      where: { organizationId: null, isSystem: true, kind: t.kind, title: t.title },
    });
    if (!existing) {
      await prisma.pulseTemplate.create({
        data: {
          organizationId: null,
          kind: t.kind,
          title: t.title,
          intro: t.intro,
          questions: t.buildQuestions() as unknown as object,
          isSystem: true,
        },
      });
    }
  }
}
void ensureSystemTemplates().catch((e) => console.error("[pulses] seed error", e));

// ---------------------- authenticated router ----------------------

export const pulsesRouter = Router();
pulsesRouter.use(requireAuth);

pulsesRouter.param("orgId", async (req, res, next, orgId) => {
  if (!(await assertOrgAccess(req.userId!, orgId))) {
    return res.status(403).json({ error: "Forbidden" });
  }
  next();
});

// Templates (system + org custom)
pulsesRouter.get("/:orgId/pulses/templates", async (req, res) => {
  const list = await prisma.pulseTemplate.findMany({
    where: { OR: [{ isSystem: true }, { organizationId: req.params.orgId }] },
    orderBy: [{ isSystem: "desc" }, { createdAt: "desc" }],
  });
  res.json(list);
});

// Create custom template
const templateSchema = z.object({
  kind: z.enum(["feedback", "climate", "disc", "custom"]),
  title: z.string().min(2),
  intro: z.string().optional().nullable(),
  questions: z.array(z.any()).min(1),
});

pulsesRouter.post("/:orgId/pulses/templates", async (req, res) => {
  try {
    const d = templateSchema.parse(req.body);
    const created = await prisma.pulseTemplate.create({
      data: {
        organizationId: req.params.orgId,
        kind: d.kind,
        title: d.title,
        intro: d.intro ?? null,
        questions: d.questions as unknown as object,
        isSystem: false,
        createdById: req.userId!,
      },
    });
    res.status(201).json(created);
  } catch (err) {
    badReq(res, err);
  }
});

pulsesRouter.delete("/:orgId/pulses/templates/:id", async (req, res) => {
  const t = await prisma.pulseTemplate.findFirst({
    where: { id: req.params.id, organizationId: req.params.orgId, isSystem: false },
  });
  if (!t) return res.status(404).json({ error: "Not found" });
  await prisma.pulseTemplate.delete({ where: { id: t.id } });
  res.status(204).end();
});

// List sends
pulsesRouter.get("/:orgId/pulses", async (req, res) => {
  const list = await prisma.pulseSend.findMany({
    where: { organizationId: req.params.orgId },
    include: { template: true, answer: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  res.json(list);
});

// Create + send
const sendSchema = z.object({
  templateId: z.string().uuid(),
  subjectUserId: z.string().uuid().optional().nullable(),
  subjectLabel: z.string().optional().nullable(),
  subjectPhone: z.string().optional().nullable(),
  message: z.string().optional().nullable(),
  expiresInDays: z.number().int().min(1).max(60).default(7),
});

pulsesRouter.post("/:orgId/pulses", async (req, res) => {
  try {
    const d = sendSchema.parse(req.body);
    const template = await prisma.pulseTemplate.findFirst({
      where: {
        id: d.templateId,
        OR: [{ isSystem: true }, { organizationId: req.params.orgId }],
      },
    });
    if (!template) return res.status(404).json({ error: "Template not found" });

    let subjectLabel = d.subjectLabel ?? null;
    let subjectPhone = d.subjectPhone ?? null;
    if (d.subjectUserId) {
      const profile = await prisma.profile.findUnique({ where: { id: d.subjectUserId } });
      if (profile) {
        subjectLabel = subjectLabel ?? profile.fullName;
        subjectPhone = subjectPhone ?? profile.whatsapp ?? profile.phone;
      }
    }

    const token = genToken();
    const expiresAt = new Date(Date.now() + d.expiresInDays * 24 * 60 * 60 * 1000);
    const created = await prisma.pulseSend.create({
      data: {
        organizationId: req.params.orgId,
        templateId: template.id,
        senderId: req.userId!,
        subjectUserId: d.subjectUserId ?? null,
        subjectLabel,
        subjectPhone,
        token,
        message: d.message ?? null,
        expiresAt,
      },
      include: { template: true },
    });
    res.status(201).json(created);
  } catch (err) {
    badReq(res, err);
  }
});

// Revoke
pulsesRouter.patch("/:orgId/pulses/:id/revoke", async (req, res) => {
  const s = await prisma.pulseSend.findFirst({
    where: { id: req.params.id, organizationId: req.params.orgId },
  });
  if (!s) return res.status(404).json({ error: "Not found" });
  const updated = await prisma.pulseSend.update({
    where: { id: s.id },
    data: { status: "revoked" },
  });
  res.json(updated);
});

pulsesRouter.delete("/:orgId/pulses/:id", async (req, res) => {
  const s = await prisma.pulseSend.findFirst({
    where: { id: req.params.id, organizationId: req.params.orgId },
  });
  if (!s) return res.status(404).json({ error: "Not found" });
  await prisma.pulseSend.delete({ where: { id: s.id } });
  res.status(204).end();
});

// ---------------------- PUBLIC router (no auth) ----------------------

export const publicPulsesRouter = Router();

publicPulsesRouter.get("/pulse/:token", async (req, res) => {
  const s = await prisma.pulseSend.findUnique({
    where: { token: req.params.token },
    include: { template: true, answer: true },
  });
  if (!s) return res.status(404).json({ error: "Link inválido." });
  if (s.status === "revoked") return res.status(410).json({ error: "Este link foi cancelado." });
  if (s.answeredAt || s.status === "answered")
    return res.status(410).json({ error: "Esta pesquisa já foi respondida." });
  if (s.expiresAt.getTime() < Date.now()) {
    await prisma.pulseSend.update({ where: { id: s.id }, data: { status: "expired" } }).catch(() => null);
    return res.status(410).json({ error: "Este link expirou." });
  }

  // fetch sender name for context
  const sender = await prisma.profile.findUnique({ where: { id: s.senderId } });
  res.json({
    id: s.id,
    token: s.token,
    subjectLabel: s.subjectLabel,
    message: s.message,
    senderName: sender?.fullName ?? "Seu líder",
    template: {
      kind: s.template.kind,
      title: s.template.title,
      intro: s.template.intro,
      questions: s.template.questions,
    },
    expiresAt: s.expiresAt,
  });
});

const submitSchema = z.object({
  answers: z.record(z.string(), z.any()),
});

publicPulsesRouter.post("/pulse/:token", async (req, res) => {
  try {
    const { answers } = submitSchema.parse(req.body);
    const s = await prisma.pulseSend.findUnique({
      where: { token: req.params.token },
      include: { template: true },
    });
    if (!s) return res.status(404).json({ error: "Link inválido." });
    if (s.status !== "pending") return res.status(410).json({ error: "Link não está mais disponível." });
    if (s.expiresAt.getTime() < Date.now())
      return res.status(410).json({ error: "Link expirado." });

    const qs = (s.template.questions as unknown as Q[]) ?? [];
    // required check
    for (const q of qs) {
      if ("required" in q && q.required) {
        const v = answers[q.id];
        if (v === undefined || v === null || v === "") {
          return res.status(400).json({ error: `Responda: ${q.label}` });
        }
      }
    }

    const discProfile = s.template.kind === "disc" ? scoreDisc(answers, qs) : null;
    const summary = summarize(s.template.kind, answers, qs);

    const ip =
      (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0].trim() ||
      req.socket.remoteAddress ||
      null;

    await prisma.$transaction([
      prisma.pulseAnswer.create({
        data: {
          sendId: s.id,
          answers: answers as unknown as object,
          aiSummary: summary || null,
          discProfile: (discProfile as unknown as object) ?? undefined,
          respondentIp: ip,
          userAgent: (req.headers["user-agent"] as string | undefined)?.slice(0, 200) ?? null,
        },
      }),
      prisma.pulseSend.update({
        where: { id: s.id },
        data: { status: "answered", answeredAt: new Date() },
      }),
    ]);

    // Notify sender
    void notifyInApp({
      userId: s.senderId,
      organizationId: s.organizationId,
      title: `Resposta recebida — ${s.template.title}`,
      body: (s.subjectLabel ?? "Um liderado") + " respondeu sua pesquisa.",
      linkUrl: "/app/pulses",
    }).catch(() => null);

    // Interpreter — grava snapshot no mapa comportamental do líder
    void interpretPulseAnswer(s, answers, qs).catch((e) =>
      console.error("[pulse-interpret]", e),
    );

    res.json({ ok: true });
  } catch (err) {
    badReq(res, err);
  }
});

// ============================================================
// INTERPRETER — cria/atualiza SubordinateAssessment a partir
// da resposta ao pulse. Alimenta o mapa da equipe do líder.
// ============================================================
const DISC_READ = {
  D: "Direto e orientado a resultado. Fale objetivo, evite rodeio.",
  I: "Sociável e entusiasta. Reconheça publicamente, envolva em coisas novas.",
  S: "Estável e cooperativo. Dê contexto e tempo, evite mudanças bruscas.",
  C: "Analítico e preciso. Traga dados antes de pedir decisão.",
} as const;
const DISC_TRACK = {
  D: "Foco de desenvolvimento: escuta ativa em decisões que exigem alinhamento.",
  I: "Foco: disciplina de método e follow-up dos compromissos.",
  S: "Foco: expor opinião mesmo quando gera desconforto.",
  C: "Foco: agir com informação parcial. Progresso > perfeição.",
} as const;

async function interpretPulseAnswer(
  s: {
    id: string;
    organizationId: string;
    senderId: string;
    subjectUserId: string | null;
    subjectLabel: string | null;
    subjectPhone: string | null;
    template: { kind: string };
  },
  answers: Record<string, unknown>,
  qs: Q[],
) {
  const kind = s.template.kind;
  if (kind !== "disc" && kind !== "sabotadores" && kind !== "cerebral") return;
  const label = s.subjectLabel ?? "Liderado";

  const existing = await prisma.subordinateAssessment.findFirst({
    where: {
      organizationId: s.organizationId,
      leaderId: s.senderId,
      memberLabel: label,
    },
  });

  const patch: Record<string, unknown> = { lastPulseSendId: s.id };
  let reading = "";
  let track = "";

  if (kind === "disc") {
    const disc = scoreDisc(answers, qs);
    patch.discPrimary = disc.primary;
    patch.discProfile = disc as unknown as object;
    reading = `Perfil DISC ${disc.primary} (${disc.pct[disc.primary]}%). ${DISC_READ[disc.primary]}`;
    track = DISC_TRACK[disc.primary];
  } else if (kind === "sabotadores") {
    const scores = scoreSabotages(answers);
    patch.sabotageScores = scores as unknown as object;
    const top = Object.entries(scores)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
    reading = top.length
      ? `Top 3 padrões: ${top.map(([n, v]) => `${n} (${v})`).join(", ")}.`
      : "Sem padrões marcantes.";
    track = top.length
      ? `Trilha: 1 interceptação diária no padrão "${top[0][0]}" por 21 dias.`
      : "Trilha: manter observação semanal em 1:1.";
  } else if (kind === "cerebral") {
    const c = scoreCerebral(answers);
    patch.cerebralPrimary = c.primary;
    patch.cerebralProfile = c as unknown as object;
    reading = `Predominância ${c.primary.toUpperCase()} (${c.pct[c.primary]}%).`;
    track = `Trilha: aproveitar a força de "${c.primary}" e balancear com prática oposta na próxima quinzena.`;
  }

  const trackSteps = heuristicTrack({
    memberLabel: label,
    discPrimary: (patch.discPrimary as string | undefined) ?? existing?.discPrimary ?? null,
    cerebralPrimary: (patch.cerebralPrimary as string | undefined) ?? existing?.cerebralPrimary ?? null,
    sabotageScores: patch.sabotageScores ?? existing?.sabotageScores ?? null,
  });

  if (existing) {
    await prisma.subordinateAssessment.update({
      where: { id: existing.id },
      data: {
        ...patch,
        aiReading: reading,
        aiTrack: track,
        trackSteps: trackSteps as never,
        trackGeneratedAt: new Date(),
        memberPhone: s.subjectPhone ?? existing.memberPhone,
        memberId: s.subjectUserId ?? existing.memberId,
      },
    });
  } else {
    await prisma.subordinateAssessment.create({
      data: {
        organizationId: s.organizationId,
        leaderId: s.senderId,
        memberLabel: label,
        memberPhone: s.subjectPhone ?? null,
        memberId: s.subjectUserId ?? null,
        aiReading: reading,
        aiTrack: track,
        trackSteps: trackSteps as never,
        trackGeneratedAt: new Date(),
        ...patch,
      },
    });
  }
}
