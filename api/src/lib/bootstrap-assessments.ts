import { prisma } from "../prisma.js";
import {
  POSITIVITY_BLOCKS,
  POSITIVITY_HELP,
  POSITIVITY_ITEMS,
  POSITIVITY_SLUG,
} from "./positivity.js";
import {
  HERRMANN_BLOCK_DESCRIPTION,
  HERRMANN_BLOCK_TITLE,
  HERRMANN_HELP,
  HERRMANN_ITEMS,
  HERRMANN_SLUG,
} from "./herrmann.js";
import { DISC_BLOCK_DESCRIPTION, DISC_BLOCK_TITLE, DISC_HELP, DISC_ITEMS, DISC_SLUG } from "./disc.js";
import { RADAR_HSH_BLOCKS, RADAR_HSH_HELP, RADAR_HSH_SLUG } from "./radar-hsh.js";
import {
  AUTOGESTAO_BLOCKS,
  AUTOGESTAO_HELP,
  AUTOGESTAO_SLUG,
} from "./autogestao.js";

/**
 * Garante que os assessments canônicos da metodologia existam no banco.
 * Roda no boot da API — nunca exige criação manual.
 */
export async function bootstrapCoreAssessments() {
  await bootstrapPositivity();
  await bootstrapHerrmann();
  await bootstrapDisc();
  await bootstrapRadarHsh();
  await bootstrapAutogestao();
}

async function bootstrapPositivity() {
  try {
    const existing = await prisma.assessment.findUnique({
      where: { slug: POSITIVITY_SLUG },
      include: { blocks: { include: { _count: { select: { questions: true } } } } },
    });

    const assessment =
      existing ??
      (await prisma.assessment.create({
        data: {
          slug: POSITIVITY_SLUG,
          name: "Quociente Positivo",
          objective:
            "Medir a razão entre emoções positivas e negativas vividas nas últimas 24 horas (Positivity Ratio de Barbara Fredrickson) e acompanhar a evolução do estado emocional do líder.",
          audience: "Líderes e liderados",
          competency: "Autoconhecimento",
          category: "Consciência",
          coreModule: "C",
          estimatedTime: 4,
          frequency: "diario",
          status: "active",
        },
        include: { blocks: { include: { _count: { select: { questions: true } } } } },
      }));

    const totalQuestions = (assessment.blocks ?? []).reduce((acc, b) => acc + b._count.questions, 0);
    if (totalQuestions >= POSITIVITY_ITEMS.length) return;

    // versão antiga (12 itens) ou incompleta: recria os 2 blocos oficiais
    if (totalQuestions > 0) {
      await prisma.assessmentBlock.deleteMany({ where: { assessmentId: assessment.id } });
    }

    for (const [bIndex, def] of POSITIVITY_BLOCKS.entries()) {
      const block = await prisma.assessmentBlock.create({
        data: {
          assessmentId: assessment.id,
          title: def.title,
          description: def.description,
          orderIndex: bIndex,
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

    console.log(`[bootstrap] assessment "Quociente Positivo" garantido (${POSITIVITY_ITEMS.length} itens)`);
  } catch (err) {
    console.error("[bootstrap] falha ao garantir assessments canônicos", err);
  }
}

async function bootstrapHerrmann() {
  try {
    const existing = await prisma.assessment.findUnique({
      where: { slug: HERRMANN_SLUG },
      include: { blocks: { include: { _count: { select: { questions: true } } } } },
    });

    const assessment =
      existing ??
      (await prisma.assessment.create({
        data: {
          slug: HERRMANN_SLUG,
          name: "Dominância Cerebral (Herrmann)",
          objective:
            "Avaliação comportamental baseada no modelo de dominância cerebral de Ned Herrmann: identifica a preferência de pensamento do líder entre os quadrantes Analítico, Organizado, Relacional e Experimental.",
          audience: "Líderes e liderados",
          competency: "Autoconhecimento",
          category: "Consciência",
          coreModule: "C",
          estimatedTime: 10,
          frequency: "semestral",
          status: "active",
        },
        include: { blocks: { include: { _count: { select: { questions: true } } } } },
      }));

    const hasQuestions = (assessment.blocks ?? []).some((b) => b._count.questions > 0);
    if (hasQuestions) return;

    const block = await prisma.assessmentBlock.create({
      data: {
        assessmentId: assessment.id,
        title: HERRMANN_BLOCK_TITLE,
        description: HERRMANN_BLOCK_DESCRIPTION,
        orderIndex: 0,
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

    console.log(`[bootstrap] assessment "Dominância Cerebral (Herrmann)" garantido (${HERRMANN_ITEMS.length} questões)`);
  } catch (err) {
    console.error("[bootstrap] falha ao garantir assessment Herrmann", err);
  }
}

async function bootstrapDisc() {
  try {
    const existing = await prisma.assessment.findUnique({
      where: { slug: DISC_SLUG },
      include: { blocks: { include: { _count: { select: { questions: true } } } } },
    });

    const assessment =
      existing ??
      (await prisma.assessment.create({
        data: {
          slug: DISC_SLUG,
          name: "DISC — Perfil Comportamental",
          objective:
            "Mapear o perfil comportamental do líder nos fatores Dominância, Influência, Estabilidade e Conformidade, orientando comunicação, delegação e desenvolvimento.",
          audience: "Líderes e liderados",
          competency: "Autoconhecimento",
          category: "Consciência",
          coreModule: "C",
          estimatedTime: 8,
          frequency: "semestral",
          status: "active",
        },
        include: { blocks: { include: { _count: { select: { questions: true } } } } },
      }));

    const hasQuestions = (assessment.blocks ?? []).some((b: { _count: { questions: number } }) => b._count.questions > 0);
    if (hasQuestions) return;

    const block = await prisma.assessmentBlock.create({
      data: {
        assessmentId: assessment.id,
        title: DISC_BLOCK_TITLE,
        description: DISC_BLOCK_DESCRIPTION,
        orderIndex: 0,
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
            create: item.options.map((opt, i) => ({
              label: opt.label,
              value: opt.factor,
              score: 1,
              orderIndex: i,
            })),
          },
        },
      });
    }

    console.log(`[bootstrap] assessment "DISC" garantido (${DISC_ITEMS.length} questões)`);
  } catch (err) {
    console.error("[bootstrap] falha ao garantir assessment DISC", err);
  }
}

async function bootstrapRadarHsh() {
  try {
    const existing = await prisma.assessment.findUnique({
      where: { slug: RADAR_HSH_SLUG },
      include: { blocks: { include: { _count: { select: { questions: true } } } } },
    });

    const assessment =
      existing ??
      (await prisma.assessment.create({
        data: {
          slug: RADAR_HSH_SLUG,
          name: "Radar das Competências (Hard · Soft · Heart)",
          objective:
            "Medir o nível de desenvolvimento do líder nos três eixos da metodologia C.O.R.E.: Hard (saber fazer), Soft (saber agir e se relacionar) e Heart (saber ser). Score por eixo = média das 10 respostas × 20 (0 a 100).",
          audience: "Líderes",
          competency: "Autoconhecimento",
          category: "Consciência",
          coreModule: "C",
          estimatedTime: 12,
          frequency: "trimestral",
          status: "active",
        },
        include: { blocks: { include: { _count: { select: { questions: true } } } } },
      }));

    const hasQuestions = (assessment.blocks ?? []).some((b: { _count: { questions: number } }) => b._count.questions > 0);
    if (hasQuestions) {
      await refreshRadarHshPrompts(assessment.id);
      return;
    }

    for (const [bIndex, blockDef] of RADAR_HSH_BLOCKS.entries()) {
      const block = await prisma.assessmentBlock.create({
        data: {
          assessmentId: assessment.id,
          title: blockDef.title,
          description: blockDef.description,
          orderIndex: bIndex,
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
    }

    console.log("[bootstrap] assessment \"Radar das Competências H.S.H\" garantido (30 itens)");
  } catch (err) {
    console.error("[bootstrap] falha ao garantir assessment Radar H.S.H", err);
  }
}


/**
 * Atualiza, no lugar (sem apagar respostas), o texto das 30 afirmações do
 * Radar H.S.H para a redação oficial do diagnóstico de autoavaliação.
 */
async function refreshRadarHshPrompts(assessmentId: string) {
  const blocks = await prisma.assessmentBlock.findMany({
    where: { assessmentId },
    orderBy: { orderIndex: "asc" },
    include: { questions: { orderBy: { orderIndex: "asc" }, select: { id: true, prompt: true } } },
  });
  for (const [bIndex, blockDef] of RADAR_HSH_BLOCKS.entries()) {
    const block = blocks[bIndex];
    if (!block) continue;
    if (block.title !== blockDef.title || block.description !== blockDef.description) {
      await prisma.assessmentBlock.update({
        where: { id: block.id },
        data: { title: blockDef.title, description: blockDef.description },
      });
    }
    for (const [qIndex, prompt] of blockDef.items.entries()) {
      const question = block.questions[qIndex];
      if (!question || question.prompt === prompt) continue;
      await prisma.assessmentQuestion.update({
        where: { id: question.id },
        data: { prompt, helpText: RADAR_HSH_HELP, scaleMin: 1, scaleMax: 5 },
      });
    }
  }
}

async function bootstrapAutogestao() {
  try {
    const existing = await prisma.assessment.findUnique({
      where: { slug: AUTOGESTAO_SLUG },
      include: { blocks: { include: { _count: { select: { questions: true } } } } },
    });

    const assessment =
      existing ??
      (await prisma.assessment.create({
        data: {
          slug: AUTOGESTAO_SLUG,
          name: "Radar de Autogestão e Performance Mental (IPM)",
          objective:
            "Mapear padrões automáticos de funcionamento sob pressão (10 padrões, 50 itens) e a capacidade de resposta consciente através do Índice de Potência Mental (10 itens). Padrão = soma dos 5 itens × 5 (0 a 100%). IPM = (soma dos itens 51–60 ÷ 40) × 100. Instrumento de desenvolvimento: não constitui teste psicológico, diagnóstico clínico ou instrumento psicométrico validado.",
          audience: "Líderes e mentorados",
          competency: "Autogestão",
          category: "Consciência",
          coreModule: "C",
          estimatedTime: 15,
          frequency: "semestral",
          status: "active",
        },
        include: { blocks: { include: { _count: { select: { questions: true } } } } },
      }));

    const hasQuestions = (assessment.blocks ?? []).some(
      (b: { _count: { questions: number } }) => b._count.questions > 0,
    );
    if (hasQuestions) return;

    for (const [bIndex, blockDef] of AUTOGESTAO_BLOCKS.entries()) {
      const block = await prisma.assessmentBlock.create({
        data: {
          assessmentId: assessment.id,
          title: blockDef.title,
          description: blockDef.description,
          orderIndex: bIndex,
        },
      });
      await prisma.assessmentQuestion.createMany({
        data: blockDef.items.map((prompt, index) => ({
          blockId: block.id,
          type: "likert" as const,
          prompt,
          helpText: AUTOGESTAO_HELP,
          required: true,
          weight: 1,
          scaleMin: 0,
          scaleMax: 4,
          orderIndex: index,
        })),
      });
    }

    console.log("[bootstrap] assessment \"Radar de Autogestão e Performance Mental\" garantido (60 itens)");
  } catch (err) {
    console.error("[bootstrap] falha ao garantir assessment Radar de Autogestão", err);
  }
}
