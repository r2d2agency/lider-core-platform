import { Router } from "express";
import { z } from "zod";
import { randomBytes } from "node:crypto";
import { AssessmentBlock } from "@prisma/client";
import { prisma } from "../prisma.js";
import { requireAuth, requireRoles } from "../auth.js";
import { recordAudit, shallowDiff } from "../lib/audit.js";
import { completeChat } from "../lib/ai-gateway.js";
import {
  POSITIVITY_BLOCKS,
  POSITIVITY_HELP,
  POSITIVITY_ITEMS,
  scorePositivity,
} from "../lib/positivity.js";
import {
  HERRMANN_BLOCK_DESCRIPTION,
  HERRMANN_BLOCK_TITLE,
  HERRMANN_HELP,
  HERRMANN_ITEMS,
  HERRMANN_QUADRANTS,
  scoreHerrmann,
} from "../lib/herrmann.js";
import { DISC_BLOCK_DESCRIPTION, DISC_BLOCK_TITLE, DISC_FACTORS, DISC_HELP, DISC_ITEMS, scoreDisc } from "../lib/disc.js";
import { HSH_AXES, RADAR_HSH_BLOCKS, RADAR_HSH_HELP, scoreRadarHsh } from "../lib/radar-hsh.js";
import { isAutogestaoAssessment, scoreAutogestao } from "../lib/autogestao.js";

export const neoRouter = Router();
neoRouter.use(requireAuth, requireRoles("super_admin", "neo_admin"));

// ============================================================
// Helpers
// ============================================================
function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

async function ensureUniqueSlug(
  base: string,
  exists: (slug: string) => Promise<boolean>,
): Promise<string> {
  let slug = base || `item-${Date.now()}`;
  let i = 2;
  while (await exists(slug)) {
    slug = `${base}-${i++}`;
  }
  return slug;
}

// ============================================================
// Methodology Items
// ============================================================
const methodologyTypes = [
  "competencia", "valor", "pilar", "modulo_core", "ritual", "ferramenta",
  "modelo_lideranca", "comp_tecnica", "comp_comportamental", "comp_emocional",
] as const;
const itemStatuses = ["draft", "active", "archived"] as const;

const methodologyItemSchema = z.object({
  type: z.enum(methodologyTypes),
  slug: z.string().optional(),
  name: z.string().min(1),
  category: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  objective: z.string().optional().nullable(),
  content: z.any().optional(),
  tags: z.array(z.string()).optional().default([]),
  orderIndex: z.number().int().min(0).optional().default(0),
  status: z.enum(itemStatuses).optional().default("active"),
});

neoRouter.get("/methodology-items", async (req, res) => {
  const type = req.query.type as string | undefined;
  const q = (req.query.q as string | undefined)?.trim();
  const items = await prisma.methodologyItem.findMany({
    where: {
      AND: [
        type ? { type: type as never } : {},
        q ? { OR: [
          { name: { contains: q, mode: "insensitive" } },
          { slug: { contains: q, mode: "insensitive" } },
          { tags: { has: q } },
        ] } : {},
      ],
    },
    orderBy: [{ orderIndex: "asc" }, { updatedAt: "desc" }],
    take: 500,
  });
  res.json(items);
});

neoRouter.get("/methodology-items/:id", async (req, res) => {
  const item = await prisma.methodologyItem.findUnique({
    where: { id: req.params.id },
    include: { versions: { orderBy: { version: "desc" }, take: 20 } },
  });
  if (!item) return res.status(404).json({ error: "Item não encontrado" });
  res.json(item);
});

neoRouter.post("/methodology-items", async (req, res) => {
  const parsed = methodologyItemSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const base = slugify(parsed.data.slug || parsed.data.name);
  const slug = await ensureUniqueSlug(base, async (s) => !!(await prisma.methodologyItem.findUnique({ where: { slug: s } })));
  const item = await prisma.methodologyItem.create({
    data: {
      ...parsed.data,
      slug,
      createdById: req.userId ?? null,
      updatedById: req.userId ?? null,
    },
  });
  await prisma.methodologyItemVersion.create({
    data: { itemId: item.id, version: 1, snapshot: item as never, authorId: req.userId ?? null, note: "criação" },
  });
  await recordAudit({ entity: "methodology_item", entityId: item.id, action: "create", actorId: req.userId, diff: { after: item } });
  res.status(201).json(item);
});

neoRouter.patch("/methodology-items/:id", async (req, res) => {
  const parsed = methodologyItemSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const before = await prisma.methodologyItem.findUnique({ where: { id: req.params.id } });
  if (!before) return res.status(404).json({ error: "Item não encontrado" });
  const nextVersion = before.version + 1;
  const item = await prisma.methodologyItem.update({
    where: { id: req.params.id },
    data: { ...parsed.data, version: nextVersion, updatedById: req.userId ?? null },
  });
  await prisma.methodologyItemVersion.create({
    data: { itemId: item.id, version: nextVersion, snapshot: item as never, authorId: req.userId ?? null, note: (req.body?.note as string) ?? null },
  });
  await recordAudit({ entity: "methodology_item", entityId: item.id, action: "update", actorId: req.userId, diff: shallowDiff(before as never, item as never) });
  res.json(item);
});

neoRouter.delete("/methodology-items/:id", async (req, res) => {
  const before = await prisma.methodologyItem.findUnique({ where: { id: req.params.id } });
  if (!before) return res.status(204).end();
  await prisma.methodologyItem.delete({ where: { id: req.params.id } }).catch(() => null);
  await recordAudit({ entity: "methodology_item", entityId: before.id, action: "delete", actorId: req.userId, diff: { before } });
  res.status(204).end();
});

neoRouter.get("/methodology-items/:id/versions", async (req, res) => {
  const versions = await prisma.methodologyItemVersion.findMany({
    where: { itemId: req.params.id },
    orderBy: { version: "desc" },
  });
  res.json(versions);
});

neoRouter.post("/methodology-items/:id/restore/:version", async (req, res) => {
  const target = await prisma.methodologyItemVersion.findUnique({
    where: { itemId_version: { itemId: req.params.id, version: Number(req.params.version) } },
  });
  if (!target) return res.status(404).json({ error: "Versão não encontrada" });
  const snap = target.snapshot as never as { name?: string; description?: string | null; objective?: string | null; content?: unknown; tags?: string[]; category?: string | null; orderIndex?: number; status?: never; type?: never };
  const current = await prisma.methodologyItem.findUnique({ where: { id: req.params.id } });
  if (!current) return res.status(404).json({ error: "Item não encontrado" });
  const nextVersion = current.version + 1;
  const item = await prisma.methodologyItem.update({
    where: { id: req.params.id },
    data: {
      name: snap.name ?? current.name,
      description: snap.description ?? current.description,
      objective: snap.objective ?? current.objective,
      content: (snap.content ?? current.content) as never,
      tags: snap.tags ?? current.tags,
      category: snap.category ?? current.category,
      orderIndex: snap.orderIndex ?? current.orderIndex,
      version: nextVersion,
      updatedById: req.userId ?? null,
    },
  });
  await prisma.methodologyItemVersion.create({
    data: { itemId: item.id, version: nextVersion, snapshot: item as never, authorId: req.userId ?? null, note: `restaurado da versão ${target.version}` },
  });
  await recordAudit({ entity: "methodology_item", entityId: item.id, action: "restore", actorId: req.userId, note: `v${target.version}` });
  res.json(item);
});

// ============================================================
// Knowledge Items
// ============================================================
const knowledgeKinds = [
  "conceito", "playbook", "boa_pratica", "caso", "recomendacao", "tecnica",
  "exercicio", "leitura", "video", "ferramenta", "template", "modelo_feedback",
  "modelo_pdi", "ritual",
] as const;
const difficulties = ["iniciante", "intermediario", "avancado"] as const;

const knowledgeSchema = z.object({
  kind: z.enum(knowledgeKinds),
  slug: z.string().optional(),
  title: z.string().min(1),
  summary: z.string().optional().nullable(),
  body: z.any().optional(),
  category: z.string().optional().nullable(),
  tags: z.array(z.string()).optional().default([]),
  competencyIds: z.array(z.string()).optional().default([]),
  coreModule: z.string().optional().nullable(),
  difficulty: z.enum(difficulties).optional().nullable(),
  audience: z.string().optional().nullable(),
  author: z.string().optional().nullable(),
  reviewedAt: z.string().datetime().optional().nullable(),
  status: z.enum(itemStatuses).optional().default("active"),
});

neoRouter.get("/knowledge", async (req, res) => {
  const kind = req.query.kind as string | undefined;
  const q = (req.query.q as string | undefined)?.trim();
  const items = await prisma.knowledgeItem.findMany({
    where: {
      AND: [
        kind ? { kind: kind as never } : {},
        q ? { OR: [
          { title: { contains: q, mode: "insensitive" } },
          { summary: { contains: q, mode: "insensitive" } },
          { tags: { has: q } },
        ] } : {},
      ],
    },
    orderBy: { updatedAt: "desc" },
    take: 500,
  });
  res.json(items);
});

neoRouter.get("/knowledge/:id", async (req, res) => {
  const item = await prisma.knowledgeItem.findUnique({
    where: { id: req.params.id },
    include: { versions: { orderBy: { version: "desc" }, take: 20 } },
  });
  if (!item) return res.status(404).json({ error: "Não encontrado" });
  res.json(item);
});

neoRouter.post("/knowledge", async (req, res) => {
  const parsed = knowledgeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const base = slugify(parsed.data.slug || parsed.data.title);
  const slug = await ensureUniqueSlug(base, async (s) => !!(await prisma.knowledgeItem.findUnique({ where: { slug: s } })));
  const item = await prisma.knowledgeItem.create({
    data: {
      ...parsed.data,
      slug,
      reviewedAt: parsed.data.reviewedAt ? new Date(parsed.data.reviewedAt) : null,
      createdById: req.userId ?? null,
      updatedById: req.userId ?? null,
    },
  });
  await prisma.knowledgeItemVersion.create({
    data: { itemId: item.id, version: 1, snapshot: item as never, authorId: req.userId ?? null, note: "criação" },
  });
  await recordAudit({ entity: "knowledge_item", entityId: item.id, action: "create", actorId: req.userId });
  res.status(201).json(item);
});

neoRouter.patch("/knowledge/:id", async (req, res) => {
  const parsed = knowledgeSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const before = await prisma.knowledgeItem.findUnique({ where: { id: req.params.id } });
  if (!before) return res.status(404).json({ error: "Não encontrado" });
  const nextVersion = before.version + 1;
  const item = await prisma.knowledgeItem.update({
    where: { id: req.params.id },
    data: {
      ...parsed.data,
      reviewedAt: parsed.data.reviewedAt ? new Date(parsed.data.reviewedAt) : undefined,
      version: nextVersion,
      updatedById: req.userId ?? null,
    },
  });
  await prisma.knowledgeItemVersion.create({
    data: { itemId: item.id, version: nextVersion, snapshot: item as never, authorId: req.userId ?? null },
  });
  await recordAudit({ entity: "knowledge_item", entityId: item.id, action: "update", actorId: req.userId, diff: shallowDiff(before as never, item as never) });
  res.json(item);
});

neoRouter.delete("/knowledge/:id", async (req, res) => {
  const before = await prisma.knowledgeItem.findUnique({ where: { id: req.params.id } });
  if (!before) return res.status(204).end();
  await prisma.knowledgeItem.delete({ where: { id: req.params.id } }).catch(() => null);
  await recordAudit({ entity: "knowledge_item", entityId: before.id, action: "delete", actorId: req.userId });
  res.status(204).end();
});

// ============================================================
// Templates
// ============================================================
const templateKinds = ["feedback", "pdi", "exercicio", "one_on_one", "plano", "checklist", "avaliacao"] as const;
const templateSchema = z.object({
  kind: z.enum(templateKinds),
  slug: z.string().optional(),
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  body: z.any(),
  tags: z.array(z.string()).optional().default([]),
  status: z.enum(itemStatuses).optional().default("active"),
});

neoRouter.get("/templates", async (req, res) => {
  const kind = req.query.kind as string | undefined;
  const items = await prisma.template.findMany({
    where: kind ? { kind: kind as never } : undefined,
    orderBy: { updatedAt: "desc" },
  });
  res.json(items);
});

neoRouter.post("/templates", async (req, res) => {
  const parsed = templateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const base = slugify(parsed.data.slug || parsed.data.name);
  const slug = await ensureUniqueSlug(base, async (s) => !!(await prisma.template.findUnique({ where: { slug: s } })));
  const item = await prisma.template.create({
    data: {
      ...parsed.data,
      body: (parsed.data.body ?? {}) as never,
      slug,
      createdById: req.userId ?? null,
      updatedById: req.userId ?? null,
    },
  });
  await prisma.templateVersion.create({ data: { templateId: item.id, version: 1, snapshot: item as never, authorId: req.userId ?? null } });
  await recordAudit({ entity: "template", entityId: item.id, action: "create", actorId: req.userId });
  res.status(201).json(item);
});

neoRouter.patch("/templates/:id", async (req, res) => {
  const parsed = templateSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const before = await prisma.template.findUnique({ where: { id: req.params.id } });
  if (!before) return res.status(404).json({ error: "Não encontrado" });
  const nextVersion = before.version + 1;
  const item = await prisma.template.update({
    where: { id: req.params.id },
    data: { ...parsed.data, version: nextVersion, updatedById: req.userId ?? null },
  });
  await prisma.templateVersion.create({ data: { templateId: item.id, version: nextVersion, snapshot: item as never, authorId: req.userId ?? null } });
  await recordAudit({ entity: "template", entityId: item.id, action: "update", actorId: req.userId });
  res.json(item);
});

neoRouter.delete("/templates/:id", async (req, res) => {
  await prisma.template.delete({ where: { id: req.params.id } }).catch(() => null);
  await recordAudit({ entity: "template", entityId: req.params.id, action: "delete", actorId: req.userId });
  res.status(204).end();
});

// ============================================================
// Assessments (metadata + builder blocks/questions)
// ============================================================
const assessmentSchema = z.object({
  slug: z.string().optional(),
  name: z.string().min(1),
  objective: z.string().optional().nullable(),
  audience: z.string().optional().nullable(),
  competency: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  estimatedTime: z.number().int().min(0).optional().nullable(),
  frequency: z.string().optional().nullable(),
  weight: z.number().int().min(1).optional().default(1),
  coreModule: z.string().optional().nullable(),
  status: z.enum(itemStatuses).optional().default("draft"),
  randomize: z.boolean().optional().default(false),
});

neoRouter.get("/assessments", async (req, res) => {
  const q = (req.query.q as string | undefined)?.trim();
  const items = await prisma.assessment.findMany({
    where: q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { slug: { contains: q, mode: "insensitive" } }] } : undefined,
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { blocks: true } } },
  });
  res.json(items);
});

neoRouter.get("/assessments/:id", async (req, res) => {
  const a = await prisma.assessment.findUnique({
    where: { id: req.params.id },
    include: {
      blocks: {
        orderBy: { orderIndex: "asc" },
        include: {
          questions: {
            orderBy: { orderIndex: "asc" },
            include: { options: { orderBy: { orderIndex: "asc" } } },
          },
        },
      },
      versions: { orderBy: { version: "desc" }, take: 20 },
    },
  });
  if (!a) return res.status(404).json({ error: "Não encontrado" });
  res.json(a);
});

neoRouter.post("/assessments", async (req, res) => {
  const parsed = assessmentSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const base = slugify(parsed.data.slug || parsed.data.name);
  const slug = await ensureUniqueSlug(base, async (s) => !!(await prisma.assessment.findUnique({ where: { slug: s } })));
  const item = await prisma.assessment.create({
    data: { ...parsed.data, slug, createdById: req.userId ?? null, updatedById: req.userId ?? null },
  });
  await recordAudit({ entity: "assessment", entityId: item.id, action: "create", actorId: req.userId });
  res.status(201).json(item);
});

neoRouter.patch("/assessments/:id", async (req, res) => {
  const parsed = assessmentSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const before = await prisma.assessment.findUnique({ where: { id: req.params.id } });
  if (!before) return res.status(404).json({ error: "Não encontrado" });
  const item = await prisma.assessment.update({
    where: { id: req.params.id },
    data: { ...parsed.data, updatedById: req.userId ?? null },
  });
  await recordAudit({ entity: "assessment", entityId: item.id, action: "update", actorId: req.userId });
  res.json(item);
});

neoRouter.post("/assessments/:id/publish", async (req, res) => {
  const current = await prisma.assessment.findUnique({
    where: { id: req.params.id },
    include: { blocks: { include: { questions: { include: { options: true } } } } },
  });
  if (!current) return res.status(404).json({ error: "Não encontrado" });
  const nextVersion = current.version + 1;
  const updated = await prisma.assessment.update({
    where: { id: req.params.id },
    data: { status: "active", version: nextVersion, updatedById: req.userId ?? null },
  });
  await prisma.assessmentVersion.create({
    data: { assessmentId: current.id, version: nextVersion, snapshot: current as never, authorId: req.userId ?? null, note: "publicação" },
  });
  await recordAudit({ entity: "assessment", entityId: current.id, action: "publish", actorId: req.userId });
  res.json(updated);
});

neoRouter.delete("/assessments/:id", async (req, res) => {
  await prisma.assessment.delete({ where: { id: req.params.id } }).catch(() => null);
  await recordAudit({ entity: "assessment", entityId: req.params.id, action: "delete", actorId: req.userId });
  res.status(204).end();
});

// blocks
const blockSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  orderIndex: z.number().int().min(0).optional().default(0),
});
neoRouter.post("/assessments/:id/blocks", async (req, res) => {
  const parsed = blockSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const b = await prisma.assessmentBlock.create({ data: { ...parsed.data, assessmentId: req.params.id } });
  res.status(201).json(b);
});
neoRouter.patch("/blocks/:blockId", async (req, res) => {
  const parsed = blockSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const b = await prisma.assessmentBlock.update({ where: { id: req.params.blockId }, data: parsed.data });
  res.json(b);
});
neoRouter.delete("/blocks/:blockId", async (req, res) => {
  await prisma.assessmentBlock.delete({ where: { id: req.params.blockId } }).catch(() => null);
  res.status(204).end();
});

// questions
const questionTypes = ["unica", "multipla", "likert", "slider", "ranking", "texto", "cenario", "autoavaliacao"] as const;
const questionSchema = z.object({
  type: z.enum(questionTypes),
  prompt: z.string().min(1),
  helpText: z.string().optional().nullable(),
  required: z.boolean().optional().default(true),
  weight: z.number().int().min(0).optional().default(1),
  scaleMin: z.number().int().optional().nullable(),
  scaleMax: z.number().int().optional().nullable(),
  showIf: z.any().optional(),
  orderIndex: z.number().int().min(0).optional().default(0),
  options: z.array(z.object({
    label: z.string(), value: z.string(), score: z.number().int().optional().default(0), orderIndex: z.number().int().optional().default(0),
  })).optional(),
});
neoRouter.post("/blocks/:blockId/questions", async (req, res) => {
  const parsed = questionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { options, ...rest } = parsed.data;
  const q = await prisma.assessmentQuestion.create({
    data: {
      ...rest,
      blockId: req.params.blockId,
      options: options ? { create: options } : undefined,
    },
    include: { options: true },
  });
  res.status(201).json(q);
});
neoRouter.patch("/questions/:questionId", async (req, res) => {
  const parsed = questionSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { options, ...rest } = parsed.data;
  const q = await prisma.assessmentQuestion.update({
    where: { id: req.params.questionId },
    data: rest,
  });
  if (options) {
    await prisma.assessmentOption.deleteMany({ where: { questionId: q.id } });
    await prisma.assessmentOption.createMany({ data: options.map((o) => ({ ...o, questionId: q.id })) });
  }
  const fresh = await prisma.assessmentQuestion.findUnique({ where: { id: q.id }, include: { options: true } });
  res.json(fresh);
});
neoRouter.delete("/questions/:questionId", async (req, res) => {
  await prisma.assessmentQuestion.delete({ where: { id: req.params.questionId } }).catch(() => null);
  res.status(204).end();
});

// ============================================================
// Assessment — Share Links (para teste externo, sem login)
// ============================================================
function genShareToken() {
  return randomBytes(24).toString("base64url");
}

neoRouter.get("/assessments/:id/share-links", async (req, res) => {
  const links = await prisma.assessmentShareLink.findMany({
    where: { assessmentId: req.params.id },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { responses: true } } },
  });
  res.json(links);
});

neoRouter.post("/assessments/:id/share-links", async (req, res) => {
  const a = await prisma.assessment.findUnique({ where: { id: req.params.id } });
  if (!a) return res.status(404).json({ error: "Assessment não encontrado" });
  const schema = z.object({
    label: z.string().optional().nullable(),
    expiresInDays: z.number().int().min(1).max(365).optional().nullable(),
    maxResponses: z.number().int().min(1).optional().nullable(),
  });
  const parsed = schema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const expiresAt = parsed.data.expiresInDays
    ? new Date(Date.now() + parsed.data.expiresInDays * 86400_000)
    : null;
  const link = await prisma.assessmentShareLink.create({
    data: {
      assessmentId: a.id,
      token: genShareToken(),
      label: parsed.data.label ?? null,
      expiresAt,
      maxResponses: parsed.data.maxResponses ?? null,
      createdById: req.userId ?? null,
    },
  });
  await recordAudit({ entity: "assessment", entityId: a.id, action: "create", actorId: req.userId, note: `share-link ${link.id}` });
  res.status(201).json(link);
});

neoRouter.delete("/assessments/share-links/:linkId", async (req, res) => {
  await prisma.assessmentShareLink.update({
    where: { id: req.params.linkId },
    data: { revokedAt: new Date() },
  }).catch(() => null);
  res.status(204).end();
});

neoRouter.get("/assessments/:id/responses", async (req, res) => {
  const rows = await prisma.assessmentPublicResponse.findMany({
    where: { assessmentId: req.params.id },
    orderBy: { submittedAt: "desc" },
    take: 500,
    include: { share: { select: { id: true, label: true, token: true } } },
  });
  res.json(rows);
});

// ============================================================
// Quociente Positivo — preset oficial + análise
// ============================================================

/** Preenche o assessment com os 12 itens oficiais do Quociente Positivo. */
neoRouter.post("/assessments/:id/preset/quociente-positivo", async (req, res) => {
  const a = await prisma.assessment.findUnique({ where: { id: req.params.id } });
  if (!a) return res.status(404).json({ error: "Assessment não encontrado" });

  const existingBlocks = await prisma.assessmentBlock.count({ where: { assessmentId: a.id } });
  for (const [bIndex, def] of POSITIVITY_BLOCKS.entries()) {
    const block = await prisma.assessmentBlock.create({
      data: {
        assessmentId: a.id,
        title: def.title,
        description: def.description,
        orderIndex: existingBlocks + bIndex,
      },
    });
    await prisma.assessmentQuestion.createMany({
      data: def.items.map((item, index) => ({
        blockId: block.id,
        type: "likert" as const,
        prompt: item.prompt,
        helpText: POSITIVITY_HELP,
        required: true,
        weight: 1,
        scaleMin: 1,
        scaleMax: 5,
        orderIndex: index,
      })),
    });
  }
  await recordAudit({
    entity: "assessment",
    entityId: a.id,
    action: "update",
    actorId: req.userId,
    note: "preset Quociente Positivo aplicado",
  });
  res.json({ created: POSITIVITY_BLOCKS.length, questions: POSITIVITY_ITEMS.length, mode: "preset" });
});

/** Preenche o assessment com as 25 questões do teste de Dominância Cerebral (Herrmann). */
neoRouter.post("/assessments/:id/preset/dominancia-cerebral", async (req, res) => {
  const a = await prisma.assessment.findUnique({ where: { id: req.params.id } });
  if (!a) return res.status(404).json({ error: "Assessment não encontrado" });

  const existingBlocks = await prisma.assessmentBlock.count({ where: { assessmentId: a.id } });
  const block = await prisma.assessmentBlock.create({
    data: {
      assessmentId: a.id,
      title: HERRMANN_BLOCK_TITLE,
      description: HERRMANN_BLOCK_DESCRIPTION,
      orderIndex: existingBlocks,
    },
  });

  for (const [index, item] of HERRMANN_ITEMS.entries()) {
    await prisma.assessmentQuestion.create({
      data: {
        blockId: block.id,
        type: "unica",
        prompt: `${index + 1}) ${item.prompt}`,
        helpText: HERRMANN_HELP,
        required: true,
        weight: 1,
        orderIndex: index,
        options: {
          create: item.options.map((opt, i) => ({
            label: opt.label,
            value: opt.quadrant,
            score: 1,
            orderIndex: i,
          })),
        },
      },
    });
  }

  await recordAudit({
    entity: "assessment",
    entityId: a.id,
    action: "update",
    actorId: req.userId,
    note: "preset Dominância Cerebral (Herrmann) aplicado",
  });
  res.json({ created: 1, questions: HERRMANN_ITEMS.length, mode: "preset" });
});

/** Preenche o assessment com as 20 questões do DISC. */
neoRouter.post("/assessments/:id/preset/disc", async (req, res) => {
  const a = await prisma.assessment.findUnique({ where: { id: req.params.id } });
  if (!a) return res.status(404).json({ error: "Assessment não encontrado" });

  const existingBlocks = await prisma.assessmentBlock.count({ where: { assessmentId: a.id } });
  const block = await prisma.assessmentBlock.create({
    data: {
      assessmentId: a.id,
      title: DISC_BLOCK_TITLE,
      description: DISC_BLOCK_DESCRIPTION,
      orderIndex: existingBlocks,
    },
  });

  for (const [index, item] of DISC_ITEMS.entries()) {
    await prisma.assessmentQuestion.create({
      data: {
        blockId: block.id,
        type: "unica",
        prompt: `${index + 1}) ${item.prompt}`,
        helpText: DISC_HELP,
        required: true,
        weight: 1,
        orderIndex: index,
        options: {
          create: item.options.map((opt, i) => ({ label: opt.label, value: opt.factor, score: 1, orderIndex: i })),
        },
      },
    });
  }

  await recordAudit({
    entity: "assessment",
    entityId: a.id,
    action: "update",
    actorId: req.userId,
    note: "preset DISC aplicado",
  });
  res.json({ created: 1, questions: DISC_ITEMS.length, mode: "preset" });
});

/** Preenche o assessment com os 30 itens do Radar das Competências H.S.H. */
neoRouter.post("/assessments/:id/preset/radar-hsh", async (req, res) => {
  const a = await prisma.assessment.findUnique({ where: { id: req.params.id } });
  if (!a) return res.status(404).json({ error: "Assessment não encontrado" });

  const existingBlocks = await prisma.assessmentBlock.count({ where: { assessmentId: a.id } });
  let total = 0;
  for (const [bIndex, blockDef] of RADAR_HSH_BLOCKS.entries()) {
    const block = await prisma.assessmentBlock.create({
      data: {
        assessmentId: a.id,
        title: blockDef.title,
        description: blockDef.description,
        orderIndex: existingBlocks + bIndex,
      },
    });
    await prisma.assessmentQuestion.createMany({
      data: blockDef.items.map((prompt, index) => ({
        blockId: block.id,
        type: "likert" as const,
        prompt,
        helpText: RADAR_HSH_HELP,
        required: true,
        weight: 1,
        scaleMin: 1,
        scaleMax: 5,
        orderIndex: index,
      })),
    });
    total += blockDef.items.length;
  }

  await recordAudit({
    entity: "assessment",
    entityId: a.id,
    action: "update",
    actorId: req.userId,
    note: "preset Radar H.S.H aplicado",
  });
  res.json({ created: RADAR_HSH_BLOCKS.length, questions: total, mode: "preset" });
});

/** Recalcula o score e gera a leitura da IA para uma resposta pública. */
neoRouter.post("/assessments/responses/:responseId/analyze", async (req, res) => {
  const response = await prisma.assessmentPublicResponse.findUnique({
    where: { id: req.params.responseId },
  });
  if (!response) return res.status(404).json({ error: "Resposta não encontrada" });

  const assessment = await prisma.assessment.findUnique({
    where: { id: response.assessmentId },
    select: {
      name: true,
      objective: true,
      slug: true,
      blocks: {
        select: {
          questions: {
            select: {
              id: true,
              prompt: true,
              scaleMin: true,
              scaleMax: true,
              options: { select: { id: true, label: true, value: true } },
            },
          },
        },
      },
    },
  });
  if (!assessment) return res.status(404).json({ error: "Assessment não encontrado" });

  const questions = assessment.blocks.flatMap((b) => b.questions);
  const answers = (response.answers ?? {}) as Record<string, unknown>;
  const isHerrmann = (assessment.slug ?? "").startsWith("dominancia-cerebral");
  const slug = assessment.slug ?? "";
  const isDisc = slug.startsWith("disc-");
  const isRadar = slug.startsWith("radar-competencias");
  const herrmann = isHerrmann ? scoreHerrmann(questions, answers) : null;
  const disc = isDisc ? scoreDisc(questions, answers) : null;
  const radar = isRadar ? scoreRadarHsh(questions, answers) : null;
  const autogestao = isAutogestaoAssessment(slug) ? scoreAutogestao(questions, answers) : null;
  const computed: Record<string, unknown> | null =
    herrmann ?? disc ?? radar ?? autogestao ?? scorePositivity(questions, answers);

  const readable = questions
    .map((q) => {
      const raw = answers[q.id];
      const opt = (q.options ?? []).find((o) => o.id === String(raw) || o.value === String(raw));
      return `- ${q.prompt} → ${opt ? `${opt.label} [quadrante ${opt.value}]` : String(raw ?? "sem resposta")}`;
    })
    .join("\n");

  const scoreSummary = herrmann
    ? `Score calculado (Dominância Cerebral de Ned Herrmann): ${herrmann.profile}. Distribuição: ${herrmann.ranking
        .map((r) => `${r.quadrant} ${HERRMANN_QUADRANTS[r.quadrant].short} ${r.count} (${r.percent}%)`)
        .join(" · ")}.`
    : disc
      ? `Score calculado (DISC): ${disc.profile}. Distribuição: ${disc.ranking
          .map((r) => `${r.factor} ${DISC_FACTORS[r.factor].name} ${r.count} (${r.percent}%)`)
          .join(" · ")}.`
      : radar
        ? `Score calculado (Radar das Competências H.S.H — média das respostas × 20): ${(["hard", "soft", "heart"] as const)
            .map((a) => `${HSH_AXES[a].name} ${radar.scores[a]}/100`)
            .join(" · ")}. Média geral ${radar.overall}/100.`
        : autogestao
          ? `Score calculado (Radar de Autogestão — padrão = soma dos 5 itens × 5; IPM = soma ÷ 40 × 100): ${autogestao.patterns
              .map((pt) => `${pt.name} ${pt.intensity}% (${pt.band})`)
              .join(" · ")}. IPM ${autogestao.ipm ?? "—"}%. Padrões dominantes: ${autogestao.patterns
              .slice(0, 3)
              .map((pt) => pt.name)
              .join(", ")}. Instrumento de desenvolvimento, não psicométrico: evite linguagem clínica ou diagnóstica.`
        : computed
      ? `Score calculado (Positivity Ratio de Fredrickson): razão ${(computed as { ratio?: number | null }).ratio ?? "acima de 5"} · faixa ${(computed as { band?: string }).band}.`
      : "";

  try {
    const raw = await completeChat({
      messages: [
        {
          role: "system",
          content:
            "Você é psicóloga organizacional da Neo Pessoas. Analise respostas de assessment com rigor técnico e linguagem humana em pt-BR. Retorne SOMENTE JSON válido, sem markdown.",
        },
        {
          role: "user",
          content: `Assessment: ${assessment.name}
Objetivo: ${assessment.objective ?? "—"}
Respondente: ${response.respondentName ?? "anônimo"}
${scoreSummary}

Respostas:
${readable}

Retorne exatamente:
{
  "resumo": "2-3 frases sobre o perfil/estado identificado",
  "interpretacao": "o que o resultado indica na prática para a liderança",
  "pontosFortes": ["..."],
  "pontosAtencao": ["..."],
  "recomendacoes": ["3 a 5 ações concretas para os próximos 7 dias"]
}`,
        },
      ],
      temperature: 0.4,
    });
    const analysis = extractJson<Record<string, unknown>>(raw);
    const score = { ...(computed ?? {}), analysis, analyzedAt: new Date().toISOString() };
    await prisma.assessmentPublicResponse.update({
      where: { id: response.id },
      data: { score: score as never },
    });
    res.json({ score });
  } catch (e) {
    if (computed) {
      await prisma.assessmentPublicResponse.update({
        where: { id: response.id },
        data: { score: computed as never },
      });
    }
    res.status(500).json({ error: e instanceof Error ? e.message : "Falha na análise por IA" });
  }
});

// ============================================================
// Journeys
// ============================================================
const journeySchema = z.object({
  slug: z.string().optional(),
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  audience: z.string().optional().nullable(),
  coreModule: z.string().optional().nullable(),
  status: z.enum(itemStatuses).optional().default("draft"),
});
const stepKinds = ["assessment", "video", "texto", "exercicio", "quiz", "documento", "pdi", "conteudo", "aprovacao"] as const;
const stepSchema = z.object({
  kind: z.enum(stepKinds),
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  refId: z.string().optional().nullable(),
  content: z.any().optional(),
  requires: z.array(z.string()).optional().default([]),
  orderIndex: z.number().int().min(0).optional().default(0),
});

neoRouter.get("/journeys", async (_req, res) => {
  const items = await prisma.journey.findMany({
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { steps: true } } },
  });
  res.json(items);
});

neoRouter.get("/journeys/:id", async (req, res) => {
  const j = await prisma.journey.findUnique({
    where: { id: req.params.id },
    include: { steps: { orderBy: { orderIndex: "asc" } } },
  });
  if (!j) return res.status(404).json({ error: "Não encontrado" });
  res.json(j);
});

neoRouter.post("/journeys", async (req, res) => {
  const parsed = journeySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const base = slugify(parsed.data.slug || parsed.data.name);
  const slug = await ensureUniqueSlug(base, async (s) => !!(await prisma.journey.findUnique({ where: { slug: s } })));
  const j = await prisma.journey.create({ data: { ...parsed.data, slug, createdById: req.userId ?? null, updatedById: req.userId ?? null } });
  await recordAudit({ entity: "journey", entityId: j.id, action: "create", actorId: req.userId });
  res.status(201).json(j);
});

neoRouter.patch("/journeys/:id", async (req, res) => {
  const parsed = journeySchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const j = await prisma.journey.update({ where: { id: req.params.id }, data: { ...parsed.data, updatedById: req.userId ?? null } });
  await recordAudit({ entity: "journey", entityId: j.id, action: "update", actorId: req.userId });
  res.json(j);
});

neoRouter.delete("/journeys/:id", async (req, res) => {
  await prisma.journey.delete({ where: { id: req.params.id } }).catch(() => null);
  await recordAudit({ entity: "journey", entityId: req.params.id, action: "delete", actorId: req.userId });
  res.status(204).end();
});

neoRouter.post("/journeys/:id/steps", async (req, res) => {
  const parsed = stepSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const step = await prisma.journeyStep.create({ data: { ...parsed.data, journeyId: req.params.id } });
  res.status(201).json(step);
});
neoRouter.patch("/steps/:stepId", async (req, res) => {
  const parsed = stepSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const step = await prisma.journeyStep.update({ where: { id: req.params.stepId }, data: parsed.data });
  res.json(step);
});
neoRouter.delete("/steps/:stepId", async (req, res) => {
  await prisma.journeyStep.delete({ where: { id: req.params.stepId } }).catch(() => null);
  res.status(204).end();
});

// ============================================================
// Audit — read-only for admin
// ============================================================
neoRouter.get("/audit", async (req, res) => {
  const entity = req.query.entity as string | undefined;
  const entityId = req.query.entityId as string | undefined;
  const items = await prisma.auditEntry.findMany({
    where: { entity: entity ?? undefined, entityId: entityId ?? undefined },
    orderBy: { createdAt: "desc" },
    take: 500,
  });
  res.json(items);
});

// ============================================================
// Overview — for admin home
// ============================================================
neoRouter.get("/overview", async (_req, res) => {
  const [methodology, knowledge, templates, assessments, journeys, audit] = await Promise.all([
    prisma.methodologyItem.count(),
    prisma.knowledgeItem.count(),
    prisma.template.count(),
    prisma.assessment.count(),
    prisma.journey.count(),
    prisma.auditEntry.count(),
  ]);
  res.json({ methodology, knowledge, templates, assessments, journeys, audit });
});

// ============================================================
// AI Knowledge Context — served to AI callers
// ============================================================
neoRouter.get("/ai-context", async (_req, res) => {
  const [methodology, competencies, playbooks, templates, activeAssessments, activeJourneys] = await Promise.all([
    prisma.methodologyItem.findMany({ where: { status: "active" }, take: 200 }),
    prisma.methodologyItem.findMany({ where: { type: "competencia", status: "active" }, take: 100 }),
    prisma.knowledgeItem.findMany({ where: { kind: "playbook", status: "active" }, take: 50 }),
    prisma.template.findMany({ where: { status: "active" }, take: 50 }),
    prisma.assessment.findMany({ where: { status: "active" }, take: 50 }),
    prisma.journey.findMany({ where: { status: "active" }, take: 20 }),
  ]);
  res.json({ methodology, competencies, playbooks, templates, assessments: activeAssessments, journeys: activeJourneys });
});

// ============================================================
// AI Generation — assist admin authoring
// ============================================================
function extractJson<T>(raw: string): T {
  const trimmed = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  // Try to find the first { or [ if the model added prose
  const start = Math.min(
    ...[trimmed.indexOf("{"), trimmed.indexOf("[")].filter((i) => i >= 0),
  );
  const jsonSlice = Number.isFinite(start) && start >= 0 ? trimmed.slice(start) : trimmed;
  return JSON.parse(jsonSlice) as T;
}

function extractNumberedLikertQuestions(input: string): string[] {
  const questions: string[] = [];
  const seen = new Set<string>();
  const pattern = /(?:^|\n)\s*\d{1,3}\s*[.)]\s*(?:\n|\s)+([^\n]+\?)/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(input)) !== null) {
    const prompt = match[1]?.replace(/\s+/g, " ").trim();
    if (prompt && /^em que grau/i.test(prompt) && !seen.has(prompt.toLowerCase())) {
      seen.add(prompt.toLowerCase());
      questions.push(prompt);
    }
  }
  return questions;
}

async function createLikertQuestionBlocks({
  assessmentId,
  questions,
  existingBlocks,
}: {
  assessmentId: string;
  questions: string[];
  existingBlocks: number;
}) {
  const blocks: string[] = [];
  const chunkSize = questions.length > 12 ? 12 : questions.length;
  const helpText = "Escala: 1 Nem um pouco · 2 Um pouco · 3 Moderadamente · 4 Muito · 5 Extremamente";

  for (let start = 0; start < questions.length; start += chunkSize) {
    const chunk = questions.slice(start, start + chunkSize);
    const end = start + chunk.length;
    const block: AssessmentBlock = await prisma.assessmentBlock.create({
      data: {
        assessmentId,
        title: questions.length > chunkSize
          ? `Sentimentos — últimas 24h (${start + 1}–${end})`
          : "Sentimentos — últimas 24h",
        description: "Deste mesmo horário ontem até agora, marque o maior grau em que viveu cada sentimento.",
        orderIndex: existingBlocks + blocks.length,
      },
    });

    await prisma.assessmentQuestion.createMany({
      data: chunk.map((prompt, index) => ({
        blockId: block.id,
        type: "likert",
        prompt,
        helpText,
        required: true,
        weight: 1,
        scaleMin: 1,
        scaleMax: 5,
        orderIndex: index,
      })),
    });
    blocks.push(block.id);
  }

  return { blockIds: blocks, questionCount: questions.length };
}

/** Gera blocos + perguntas para um assessment usando o provedor de IA global. */
neoRouter.post("/assessments/:id/ai-generate", async (req, res) => {
  const a = await prisma.assessment.findUnique({ where: { id: req.params.id } });
  if (!a) return res.status(404).json({ error: "Assessment não encontrado" });
  const brief = (req.body?.brief as string | undefined)?.trim() || "";
  const numBlocks = Math.min(Math.max(Number(req.body?.blocks) || 3, 1), 12);
  const perBlock = Math.min(Math.max(Number(req.body?.perBlock) || 4, 2), 25);
  const system = [
    "Você é uma consultora especialista da Neo Pessoas, ajudando a montar um assessment de liderança dentro da metodologia C.O.R.E.",
    "Retorne SOMENTE JSON válido, sem comentários, sem markdown.",
    "Escreva em pt-BR, tom profissional e humano, evitando jargão de IA.",
    "Tipos de pergunta permitidos: unica, multipla, likert, slider, ranking, texto, cenario, autoavaliacao.",
  ].join(" ");
  const user = `Assessment: "${a.name}"
Objetivo: ${a.objective ?? "—"}
Público: ${a.audience ?? "—"}
Competência: ${a.competency ?? "—"}
Módulo C.O.R.E.: ${a.coreModule ?? "—"}
Instrução extra: ${brief || "—"}

Gere ${numBlocks} blocos com ${perBlock} perguntas cada.
Formato exato:
{
  "blocks": [
    {
      "title": "string",
      "description": "string",
      "questions": [
        {
          "type": "unica|multipla|likert|slider|ranking|texto|cenario|autoavaliacao",
          "prompt": "string",
          "helpText": "string opcional",
          "required": true,
          "weight": 1,
          "scaleMin": 1,
          "scaleMax": 5,
          "options": [{ "label": "string", "value": "string", "score": 0 }]
        }
      ]
    }
  ]
}
Regras: para likert/slider inclua scaleMin/scaleMax e deixe options vazio; para unica/multipla/ranking inclua 3-5 options com score; para texto/cenario/autoavaliacao deixe options vazio.`;

  try {
    const directQuestions = extractNumberedLikertQuestions(brief);
    if (directQuestions.length >= 3) {
      const existingBlocks = await prisma.assessmentBlock.count({ where: { assessmentId: a.id } });
      const imported = await createLikertQuestionBlocks({
        assessmentId: a.id,
        questions: directQuestions,
        existingBlocks,
      });
      await recordAudit({
        entity: "assessment",
        entityId: a.id,
        action: "ai_generate",
        actorId: req.userId,
        note: `${imported.blockIds.length} blocos e ${imported.questionCount} perguntas importadas do briefing`,
      });
      return res.json({ created: imported.blockIds.length, questions: imported.questionCount, mode: "imported" });
    }

    const raw = await completeChat({
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
      temperature: 0.6,
    });
    const parsed = extractJson<{
      blocks: Array<{
        title: string; description?: string;
        questions: Array<{
          type: string; prompt: string; helpText?: string; required?: boolean; weight?: number;
          scaleMin?: number | null; scaleMax?: number | null;
          options?: Array<{ label: string; value: string; score?: number }>;
        }>;
      }>;
    }>(raw);

    const existingBlocks = await prisma.assessmentBlock.count({ where: { assessmentId: a.id } });
    let bIdx = existingBlocks;
    const created: unknown[] = [];
    let questionCount = 0;
    for (const block of parsed.blocks ?? []) {
      const b = await prisma.assessmentBlock.create({
        data: {
          assessmentId: a.id,
          title: block.title || "Bloco",
          description: block.description ?? null,
          orderIndex: bIdx++,
        },
      });
      let qIdx = 0;
      for (const q of block.questions ?? []) {
        const type = (["unica","multipla","likert","slider","ranking","texto","cenario","autoavaliacao"] as const).includes(q.type as never)
          ? (q.type as never) : ("texto" as never);
        await prisma.assessmentQuestion.create({
          data: {
            blockId: b.id,
            type,
            prompt: q.prompt || "Pergunta",
            helpText: q.helpText ?? null,
            required: q.required ?? true,
            weight: q.weight ?? 1,
            scaleMin: q.scaleMin ?? null,
            scaleMax: q.scaleMax ?? null,
            orderIndex: qIdx++,
            options: q.options?.length
              ? { create: q.options.map((o, i) => ({ label: o.label, value: o.value || slugify(o.label), score: o.score ?? 0, orderIndex: i })) }
              : undefined,
          },
        });
        questionCount += 1;
      }
      created.push(b.id);
    }
    if (created.length === 0 || questionCount === 0) {
      throw new Error("A IA não retornou blocos/perguntas válidos. Tente colar as perguntas numeradas no campo de instruções.");
    }
    await recordAudit({ entity: "assessment", entityId: a.id, action: "ai_generate", actorId: req.userId, note: `${created.length} blocos e ${questionCount} perguntas gerados` });
    res.json({ created: created.length, questions: questionCount, mode: "ai" });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Falha na geração por IA" });
  }
});

/** Gera etapas para uma jornada usando o provedor de IA global. */
neoRouter.post("/journeys/:id/ai-generate", async (req, res) => {
  const j = await prisma.journey.findUnique({ where: { id: req.params.id } });
  if (!j) return res.status(404).json({ error: "Jornada não encontrada" });
  const brief = (req.body?.brief as string | undefined)?.trim() || "";
  const steps = Math.min(Math.max(Number(req.body?.steps) || 6, 3), 15);
  const system = "Você é consultora Neo Pessoas montando uma jornada de desenvolvimento de líderes C.O.R.E. Retorne SOMENTE JSON válido, pt-BR, sem markdown.";
  const user = `Jornada: "${j.name}"
Descrição: ${j.description ?? "—"}
Público: ${j.audience ?? "—"}
Módulo C.O.R.E.: ${j.coreModule ?? "—"}
Instrução extra: ${brief || "—"}

Monte ${steps} etapas em sequência lógica. Tipos permitidos: assessment, video, texto, exercicio, quiz, documento, pdi, conteudo, aprovacao.
Formato exato:
{ "steps": [ { "kind": "texto", "title": "string", "description": "string" } ] }`;
  try {
    const raw = await completeChat({
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
      temperature: 0.6,
    });
    const parsed = extractJson<{ steps: Array<{ kind: string; title: string; description?: string }> }>(raw);
    const existing = await prisma.journeyStep.count({ where: { journeyId: j.id } });
    let idx = existing;
    const created: string[] = [];
    for (const s of parsed.steps ?? []) {
      const kind = (["assessment","video","texto","exercicio","quiz","documento","pdi","conteudo","aprovacao"] as const).includes(s.kind as never)
        ? (s.kind as never) : ("texto" as never);
      const step = await prisma.journeyStep.create({
        data: {
          journeyId: j.id,
          kind,
          title: s.title || "Etapa",
          description: s.description ?? null,
          orderIndex: idx++,
        },
      });
      created.push(step.id);
    }
    await recordAudit({ entity: "journey", entityId: j.id, action: "ai_generate", actorId: req.userId, note: `${created.length} etapas geradas` });
    res.json({ created: created.length });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Falha na geração por IA" });
  }
});