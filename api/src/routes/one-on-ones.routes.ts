import { Router, type Response } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { requireAuth } from "../auth.js";
import { notifyInApp } from "../lib/notifications.js";
import { assertOrgAccess } from "../lib/org-access.js";

/**
 * 1:1s — reuniões guiadas entre Líder e Liderado.
 * Roteiro estruturado (wins, desafios, feedback, desenvolvimento, ações),
 * histórico e compromissos com prazo. Alimenta a Sala de Liderança.
 */
export const oneOnOnesRouter = Router();
oneOnOnesRouter.use(requireAuth);
function badReq(res: Response, err: unknown) {
  return res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
}

oneOnOnesRouter.param("orgId", async (req, res, next, orgId) => {
  if (!(await assertOrgAccess(req.userId!, orgId))) {
    return res.status(403).json({ error: "Forbidden" });
  }
  next();
});

// GET /:orgId/one-on-ones?subjectUserId=&status=
oneOnOnesRouter.get("/:orgId/one-on-ones", async (req, res) => {
  const orgId = req.params.orgId;
  const q = req.query;
  const where: Record<string, unknown> = { organizationId: orgId };
  if (typeof q.subjectUserId === "string") where.subjectUserId = q.subjectUserId;
  if (typeof q.status === "string") where.status = q.status;
  const list = await prisma.oneOnOne.findMany({
    where,
    include: { items: { orderBy: [{ orderIndex: "asc" }, { createdAt: "asc" }] } },
    orderBy: [{ scheduledAt: "desc" }],
  });
  res.json(list);
});

const itemKind = z.enum([
  "wins",
  "challenges",
  "feedback",
  "development",
  "personal",
  "action",
  "note",
]);

const oneOnOneSchema = z.object({
  subjectUserId: z.string().uuid(),
  scheduledAt: z.string().datetime(),
  durationMin: z.number().int().min(5).max(240).optional(),
  status: z.enum(["scheduled", "in_progress", "done", "canceled"]).optional(),
  summary: z.string().optional().nullable(),
  privateNotes: z.string().optional().nullable(),
  mood: z.number().int().min(1).max(5).optional().nullable(),
});

// Roteiro padrão criado junto com a sessão para acelerar o líder
const DEFAULT_SCRIPT: Array<{ kind: z.infer<typeof itemKind>; content: string }> = [
  { kind: "wins", content: "O que funcionou muito bem desde a última conversa?" },
  { kind: "challenges", content: "Onde você está travado ou precisando de ajuda?" },
  { kind: "feedback", content: "O que precisamos ajustar entre nós dois?" },
  { kind: "development", content: "Qual foi o principal aprendizado desta semana?" },
  { kind: "personal", content: "Como você está fora do trabalho? Algo importante?" },
];

oneOnOnesRouter.post("/:orgId/one-on-ones", async (req, res) => {
  try {
    const data = oneOnOneSchema.parse(req.body);
    const created = await prisma.oneOnOne.create({
      data: {
        organizationId: req.params.orgId,
        leaderId: req.userId!,
        subjectUserId: data.subjectUserId,
        scheduledAt: new Date(data.scheduledAt),
        durationMin: data.durationMin ?? 30,
        status: data.status ?? "scheduled",
        summary: data.summary ?? null,
        privateNotes: data.privateNotes ?? null,
        mood: data.mood ?? null,
        items: {
          create: DEFAULT_SCRIPT.map((s, i) => ({
            kind: s.kind,
            content: s.content,
            orderIndex: i,
          })),
        },
      },
      include: { items: true },
    });
    if (created.subjectUserId && created.subjectUserId !== req.userId) {
      void notifyInApp({
        userId: created.subjectUserId,
        organizationId: created.organizationId,
        title: "Nova 1:1 agendada",
        body: `Seu líder marcou uma conversa para ${new Date(created.scheduledAt).toLocaleString("pt-BR")}.`,
        linkUrl: "/app/one-on-ones",
      }).catch(() => null);
    }
    res.status(201).json(created);
  } catch (err) {
    badReq(res, err);
  }
});

oneOnOnesRouter.patch("/:orgId/one-on-ones/:id", async (req, res) => {
  try {
    const existing = await prisma.oneOnOne.findFirst({
      where: { id: req.params.id, organizationId: req.params.orgId },
      select: { id: true },
    });
    if (!existing) return res.status(404).json({ error: "Not found" });
    const data = oneOnOneSchema.partial().parse(req.body);
    const updated = await prisma.oneOnOne.update({
      where: { id: req.params.id },
      data: {
        ...(data.scheduledAt ? { scheduledAt: new Date(data.scheduledAt) } : {}),
        ...(data.durationMin != null ? { durationMin: data.durationMin } : {}),
        ...(data.status ? { status: data.status } : {}),
        ...(data.summary !== undefined ? { summary: data.summary } : {}),
        ...(data.privateNotes !== undefined ? { privateNotes: data.privateNotes } : {}),
        ...(data.mood !== undefined ? { mood: data.mood } : {}),
      },
      include: { items: { orderBy: [{ orderIndex: "asc" }] } },
    });
    res.json(updated);
  } catch (err) {
    badReq(res, err);
  }
});

oneOnOnesRouter.delete("/:orgId/one-on-ones/:id", async (req, res) => {
  try {
    const existing = await prisma.oneOnOne.findFirst({
      where: { id: req.params.id, organizationId: req.params.orgId },
      select: { id: true },
    });
    if (!existing) return res.status(404).json({ error: "Not found" });
    await prisma.oneOnOne.delete({ where: { id: req.params.id } });
    res.status(204).end();
  } catch (err) {
    badReq(res, err);
  }
});

// -------- Items (tópicos / ações) --------

const itemSchema = z.object({
  kind: itemKind,
  content: z.string().min(1),
  done: z.boolean().optional(),
  dueAt: z.string().datetime().optional().nullable(),
  orderIndex: z.number().int().optional(),
});

oneOnOnesRouter.post("/:orgId/one-on-ones/:id/items", async (req, res) => {
  try {
    const parent = await prisma.oneOnOne.findFirst({
      where: { id: req.params.id, organizationId: req.params.orgId },
      select: { id: true },
    });
    if (!parent) return res.status(404).json({ error: "Not found" });
    const data = itemSchema.parse(req.body);
    const created = await prisma.oneOnOneItem.create({
      data: {
        oneOnOneId: req.params.id,
        kind: data.kind,
        content: data.content,
        done: data.done ?? false,
        dueAt: data.dueAt ? new Date(data.dueAt) : null,
        orderIndex: data.orderIndex ?? 999,
      },
    });
    res.status(201).json(created);
  } catch (err) {
    badReq(res, err);
  }
});

oneOnOnesRouter.patch("/:orgId/one-on-ones/:id/items/:itemId", async (req, res) => {
  try {
    const item = await prisma.oneOnOneItem.findFirst({
      where: {
        id: req.params.itemId,
        oneOnOne: { id: req.params.id, organizationId: req.params.orgId },
      },
      select: { id: true },
    });
    if (!item) return res.status(404).json({ error: "Not found" });
    const data = itemSchema.partial().parse(req.body);
    const updated = await prisma.oneOnOneItem.update({
      where: { id: req.params.itemId },
      data: {
        ...(data.kind ? { kind: data.kind } : {}),
        ...(data.content ? { content: data.content } : {}),
        ...(data.done !== undefined ? { done: data.done } : {}),
        ...(data.dueAt !== undefined ? { dueAt: data.dueAt ? new Date(data.dueAt) : null } : {}),
        ...(data.orderIndex != null ? { orderIndex: data.orderIndex } : {}),
      },
    });
    res.json(updated);
  } catch (err) {
    badReq(res, err);
  }
});

oneOnOnesRouter.delete("/:orgId/one-on-ones/:id/items/:itemId", async (req, res) => {
  try {
    const item = await prisma.oneOnOneItem.findFirst({
      where: {
        id: req.params.itemId,
        oneOnOne: { id: req.params.id, organizationId: req.params.orgId },
      },
      select: { id: true },
    });
    if (!item) return res.status(404).json({ error: "Not found" });
    await prisma.oneOnOneItem.delete({ where: { id: req.params.itemId } });
    res.status(204).end();
  } catch (err) {
    badReq(res, err);
  }
});
