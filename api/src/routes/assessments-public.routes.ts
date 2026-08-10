import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { isPositivityAssessment, scorePositivity } from "../lib/positivity.js";
import { isHerrmannAssessment, scoreHerrmann } from "../lib/herrmann.js";
import { isDiscAssessment, scoreDisc } from "../lib/disc.js";
import { isRadarHshAssessment, scoreRadarHsh } from "../lib/radar-hsh.js";
import { isAutogestaoAssessment, scoreAutogestao } from "../lib/autogestao.js";

/**
 * Endpoints públicos (sem login) para responder assessments via link.
 * Montados em /api/public.
 */
export const publicAssessmentsRouter = Router();

publicAssessmentsRouter.get("/assessment/:token", async (req, res) => {
  const link = await prisma.assessmentShareLink.findUnique({
    where: { token: req.params.token },
  });
  if (!link) return res.status(404).json({ error: "Link inválido." });
  if (link.revokedAt) return res.status(410).json({ error: "Este link foi revogado." });
  if (link.expiresAt && link.expiresAt < new Date())
    return res.status(410).json({ error: "Este link expirou." });
  if (link.maxResponses) {
    const count = await prisma.assessmentPublicResponse.count({ where: { shareId: link.id } });
    if (count >= link.maxResponses)
      return res.status(410).json({ error: "Este link atingiu o limite de respostas." });
  }

  const a = await prisma.assessment.findUnique({
    where: { id: link.assessmentId },
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
    },
  });
  if (!a) return res.status(404).json({ error: "Assessment não encontrado." });

  // sanitiza — não expõe pesos, scores nem showIf
  res.json({
    id: a.id,
    name: a.name,
    objective: a.objective,
    audience: a.audience,
    coreModule: a.coreModule,
    estimatedTime: a.estimatedTime,
    label: link.label,
    blocks: a.blocks.map((b) => ({
      id: b.id,
      title: b.title,
      description: b.description,
      questions: b.questions.map((q) => ({
        id: q.id,
        type: q.type,
        prompt: q.prompt,
        helpText: q.helpText,
        required: q.required,
        scaleMin: q.scaleMin,
        scaleMax: q.scaleMax,
        options: q.options.map((o) => ({ id: o.id, label: o.label, value: o.value })),
      })),
    })),
  });
});

const submitSchema = z.object({
  respondentName: z.string().max(120).optional().nullable(),
  respondentEmail: z.string().email().max(180).optional().nullable(),
  answers: z.record(z.string(), z.any()),
});

publicAssessmentsRouter.post("/assessment/:token", async (req, res) => {
  const parsed = submitSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const link = await prisma.assessmentShareLink.findUnique({
    where: { token: req.params.token },
  });
  if (!link) return res.status(404).json({ error: "Link inválido." });
  if (link.revokedAt) return res.status(410).json({ error: "Este link foi revogado." });
  if (link.expiresAt && link.expiresAt < new Date())
    return res.status(410).json({ error: "Este link expirou." });
  if (link.maxResponses) {
    const count = await prisma.assessmentPublicResponse.count({ where: { shareId: link.id } });
    if (count >= link.maxResponses)
      return res.status(410).json({ error: "Este link atingiu o limite de respostas." });
  }

  // Score automático para assessments com motor próprio (ex.: Quociente Positivo)
  let score: unknown = null;
  const assessment = await prisma.assessment.findUnique({
    where: { id: link.assessmentId },
    select: {
      slug: true,
      blocks: {
        select: {
          questions: {
            select: {
              id: true,
              prompt: true,
              options: { select: { id: true, label: true, value: true } },
            },
          },
        },
      },
    },
  });
  if (assessment && isPositivityAssessment(assessment.slug)) {
    const questions = assessment.blocks.flatMap((b) => b.questions);
    score = scorePositivity(questions, parsed.data.answers);
  } else if (assessment && isHerrmannAssessment(assessment.slug)) {
    const questions = assessment.blocks.flatMap((b) => b.questions);
    score = scoreHerrmann(questions, parsed.data.answers);
  } else if (assessment && isDiscAssessment(assessment.slug)) {
    const questions = assessment.blocks.flatMap((b) => b.questions);
    score = scoreDisc(questions, parsed.data.answers);
  } else if (assessment && isRadarHshAssessment(assessment.slug)) {
    const questions = assessment.blocks.flatMap((b) => b.questions);
    score = scoreRadarHsh(questions, parsed.data.answers);
  } else if (assessment && isAutogestaoAssessment(assessment.slug)) {
    const questions = assessment.blocks.flatMap((b) => b.questions);
    score = scoreAutogestao(questions, parsed.data.answers);
  }

  const saved = await prisma.assessmentPublicResponse.create({
    data: {
      shareId: link.id,
      assessmentId: link.assessmentId,
      respondentName: parsed.data.respondentName ?? null,
      respondentEmail: parsed.data.respondentEmail ?? null,
      answers: parsed.data.answers as never,
      score: (score ?? undefined) as never,
    },
  });

  res.status(201).json({ ok: true, id: saved.id });
});