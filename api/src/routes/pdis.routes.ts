import { Router, type Response } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { requireAuth } from "../auth.js";
import { notifyInApp } from "../lib/notifications.js";

/**
 * PDIs — Planos de Desenvolvimento Individual.
 * Alimenta "pessoas que precisam de atenção" na Sala de Liderança.
 */
export const pdisRouter = Router();
pdisRouter.use(requireAuth);

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

pdisRouter.param("orgId", async (req, res, next, orgId) => {
  if (!(await assertOrgAccess(req.userId!, orgId))) {
    return res.status(403).json({ error: "Forbidden" });
  }
  next();
});

// GET /:orgId/pdis
pdisRouter.get("/:orgId/pdis", async (req, res) => {
  const orgId = req.params.orgId;
  const q = req.query;
  const where: Record<string, unknown> = { organizationId: orgId };
  if (typeof q.subjectUserId === "string") where.subjectUserId = q.subjectUserId;
  if (typeof q.status === "string") where.status = q.status;
  const list = await prisma.pdi.findMany({
    where,
    include: { 
      goals: true,
      rootCauses: true
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],

  });
  res.json(list);
});

const pdiSchema = z.object({
  subjectUserId: z.string().uuid(),
  title: z.string().min(3),
  focus: z.string().optional().nullable(),
  summary: z.string().optional().nullable(),
  reviewAt: z.string().datetime().optional().nullable(),
  status: z.enum(["ativo", "concluido", "pausado", "cancelado"]).default("ativo"),
  rootCauses: z.array(z.object({
    category: z.enum(["comportamental", "processo", "dado", "estrutural", "outro"]),
    description: z.string()
  })).optional(),
});


pdisRouter.post("/:orgId/pdis", async (req, res) => {
  try {
    const data = pdiSchema.parse(req.body);
    const created = await prisma.pdi.create({
      data: {
        organizationId: req.params.orgId,
        authorId: req.userId!,
        subjectUserId: data.subjectUserId,
        title: data.title,
        focus: data.focus ?? null,
        summary: data.summary ?? null,
        reviewAt: data.reviewAt ? new Date(data.reviewAt) : null,
        status: data.status,
        rootCauses: {
          create: data.rootCauses?.map(rc => ({
            organizationId: req.params.orgId,
            category: rc.category,
            description: rc.description,
            createdBy: req.userId!
          })) || []
        }
      },
    });

    if (created.subjectUserId && created.subjectUserId !== req.userId) {
      void notifyInApp({
        userId: created.subjectUserId,
        organizationId: created.organizationId,
        title: "Novo PDI para você",
        body: created.title,
        linkUrl: "/app/pdis",
      }).catch(() => null);
    }
    res.status(201).json(created);
  } catch (err) {
    badReq(res, err);
  }
});

pdisRouter.patch("/:orgId/pdis/:id", async (req, res) => {
  try {
    const existing = await prisma.pdi.findFirst({
      where: { id: req.params.id, organizationId: req.params.orgId },
    });
    if (!existing) return res.status(404).json({ error: "Not found" });
    const data = pdiSchema.partial().parse(req.body);
    const updated = await prisma.pdi.update({
      where: { id: req.params.id },
      data: {
        ...(data.title ? { title: data.title } : {}),
        ...(data.focus !== undefined ? { focus: data.focus ?? null } : {}),
        ...(data.summary !== undefined ? { summary: data.summary ?? null } : {}),
        ...(data.reviewAt !== undefined ? { reviewAt: data.reviewAt ? new Date(data.reviewAt) : null } : {}),
        ...(data.status ? { status: data.status } : {}),
      },
    });
    res.json(updated);
  } catch (err) {
    badReq(res, err);
  }
});

pdisRouter.delete("/:orgId/pdis/:id", async (req, res) => {
  const existing = await prisma.pdi.findFirst({
    where: { id: req.params.id, organizationId: req.params.orgId },
  });
  if (!existing) return res.status(404).json({ error: "Not found" });
  await prisma.pdi.delete({ where: { id: req.params.id } });
  res.status(204).end();
});

// Goals
const goalSchema = z.object({
  title: z.string().min(3),
  action: z.string().optional().nullable(),
  dueAt: z.string().datetime().optional().nullable(),
  status: z.enum(["a_fazer", "em_andamento", "concluido", "atrasado"]).default("a_fazer"),
  evidence: z.string().optional().nullable(),
});

pdisRouter.post("/:orgId/pdis/:id/goals", async (req, res) => {
  try {
    const pdi = await prisma.pdi.findFirst({
      where: { id: req.params.id, organizationId: req.params.orgId },
    });
    if (!pdi) return res.status(404).json({ error: "Not found" });
    const data = goalSchema.parse(req.body);
    const goal = await prisma.pdiGoal.create({
      data: {
        pdiId: pdi.id,
        title: data.title,
        action: data.action ?? null,
        dueAt: data.dueAt ? new Date(data.dueAt) : null,
        status: data.status,
        evidence: data.evidence ?? null,
      },
    });
    res.status(201).json(goal);
  } catch (err) {
    badReq(res, err);
  }
});

pdisRouter.patch("/:orgId/pdis/:id/goals/:goalId", async (req, res) => {
  try {
    const pdi = await prisma.pdi.findFirst({
      where: { id: req.params.id, organizationId: req.params.orgId },
    });
    if (!pdi) return res.status(404).json({ error: "Not found" });
    const data = goalSchema.partial().parse(req.body);
    const updated = await prisma.pdiGoal.update({
      where: { id: req.params.goalId },
      data: {
        ...(data.title ? { title: data.title } : {}),
        ...(data.action !== undefined ? { action: data.action ?? null } : {}),
        ...(data.dueAt !== undefined ? { dueAt: data.dueAt ? new Date(data.dueAt) : null } : {}),
        ...(data.status ? { status: data.status } : {}),
        ...(data.evidence !== undefined ? { evidence: data.evidence ?? null } : {}),
      },
    });
    res.json(updated);
  } catch (err) {
    badReq(res, err);
  }
});

pdisRouter.delete("/:orgId/pdis/:id/goals/:goalId", async (req, res) => {
  const pdi = await prisma.pdi.findFirst({
    where: { id: req.params.id, organizationId: req.params.orgId },
  });
  if (!pdi) return res.status(404).json({ error: "Not found" });
  await prisma.pdiGoal.delete({ where: { id: req.params.goalId } });
  res.status(204).end();
});