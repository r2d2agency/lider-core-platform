/**
 * Radar das Competências H.S.H — Hard, Soft e Heart.
 * 3 eixos × 10 afirmações, escala 1..5.
 * Score por eixo = média das 10 respostas × 20 (0 a 100).
 */

export type HshAxis = "hard" | "soft" | "heart";

export const RADAR_HSH_SLUG = "radar-competencias-hsh";

export const HSH_AXES: Record<HshAxis, { name: string; subtitle: string; description: string }> = {
  hard: { name: "AUTOPERCEPÇÃO", subtitle: "saber ver", description: "Capacidade de notar padrões automáticos, reações corporais e estados mentais no momento em que ocorrem." },
  soft: { name: "AUTORREGULAÇÃO", subtitle: "saber equilibrar", description: "Habilidade de retornar ao centro, mudar o estado mental e manter o foco sob pressão." },
  heart: { name: "ESCOLHA CONSCIENTE", subtitle: "saber decidir", description: "Capacidade de decidir ações alinhadas a valores e objetivos de longo prazo, em vez de reagir por impulso." },
};

export const RADAR_HSH_HELP =
  "Escala: 1 Quase nunca · 2 Raramente · 3 Às vezes · 4 Frequentemente · 5 Quase sempre";

export const RADAR_HSH_BLOCKS: Array<{ axis: HshAxis; title: string; description: string; items: string[] }> = [
  {
    axis: "hard",
    title: "AUTOPERCEPÇÃO — saber ver",
    description: "Mapeamento de padrões automáticos. Em que grau você percebe seu funcionamento interno?",
    items: [
      "Consigo perceber um pensamento automático antes de transformá-lo em ação.",
      "Observo o que sinto sem ser dominado pela emoção do momento.",
      "Percebo a tensão no meu corpo quando estou sob pressão.",
      "Identifico quando meu Crítico Interno começa a me sabotar.",
      "Consigo pausar antes de reagir a um comentário difícil.",
      "Observo meus julgamentos sobre os outros sem validá-los como verdade absoluta.",
      "Percebo quando estou acelerando o ritmo apenas por ansiedade.",
      "Identifico a necessidade de controle quando as coisas saem do plano.",
      "Consigo dar um nome ao que estou sentindo no momento.",
      "Observo quando minha mente foge do presente para o futuro ou passado.",
    ],
  },
  {
    axis: "soft",
    title: "AUTORREGULAÇÃO — saber equilibrar",
    description: "Capacidade de gerir seu estado interno e manter a performance mental.",
    items: [
      "Respiro conscientemente para retornar ao equilíbrio em situações de conflito.",
      "Consigo mudar meu estado mental quando percebo que estou sendo improdutivo.",
      "Mantenho o foco no que é essencial, mesmo com muitas distrações.",
      "Consigo relaxar voluntariamente após um período de alta exigência.",
      "Transformo o estresse em energia focada para a solução.",
      "Mudo minha resposta habitual quando ela não é útil para o resultado.",
      "Consigo me manter presente e calmo em conversas difíceis.",
      "Acesso um estado de clareza mental quando o ambiente está caótico.",
      "Consigo desativar a preocupação excessiva para focar na ação.",
      "Mantenho a qualidade da presença mesmo em dias cansativos.",
    ],
  },
  {
    axis: "heart",
    title: "ESCOLHA CONSCIENTE — saber decidir",
    description: "Tradução da consciência em comportamento de liderança intencional.",
    items: [
      "Escolho minhas palavras com intenção, e não por impulso.",
      "Respondo aos erros (meus e dos outros) com foco em aprender, não em culpar.",
      "Decido como quero agir alinhado aos meus valores, não ao meu medo.",
      "Escolho ouvir até o fim antes de formular minha defesa.",
      "Decido quando é hora de parar, respeitando meus limites biológicos.",
      "Consigo estabelecer limites mesmo quando alguém pode se frustrar comigo.",
      "Delego responsabilidades com critérios claros e espaço real de autonomia.",
      "Reservo pausas suficientes para recuperar foco e qualidade de presença.",
      "Acolho a vulnerabilidade como parte do processo de liderança.",
      "Mantenho a coerência entre minha intenção e meu comportamento real.",
    ],
  },
];

const LEGACY_HSH_BLOCKS: Array<{ axis: HshAxis; title: string; description: string; items: string[] }> = [
  {
    axis: "hard",
    title: "HARD — saber fazer",
    description: "Competências técnicas e de gestão da operação. Responda pensando no seu dia a dia real.",
    items: [
      "Eu domino as ferramentas e indicadores necessários para acompanhar o desempenho da minha área.",
      "Eu me sinto tecnicamente seguro para orientar minha equipe nas atividades do dia a dia.",
      "Eu uso com confiança as ferramentas e sistemas necessários para gerir minha área.",
      "Eu planejo minhas entregas com prazos e metas claras, não apenas por urgência.",
      "Eu sei estruturar processos que ajudam o time a executar sem depender de mim o tempo todo.",
      "Eu tomo decisões baseadas em dados e indicadores, não em achismo.",
      "Eu consigo organizar prioridades mesmo quando várias demandas chegam ao mesmo tempo.",
      "Eu tenho clareza técnica suficiente pra avaliar se uma entrega do time está no padrão esperado.",
      "Eu sei identificar quando um problema técnico exige minha intervenção direta ou pode ser resolvido pelo time.",
      "Eu me atualizo tecnicamente para não ficar defasado em relação às demandas da minha função.",
    ],
  },
  {
    axis: "soft",
    title: "SOFT — saber agir e se relacionar",
    description: "Competências comportamentais de liderança: comunicação, delegação, feedback e mobilização.",
    items: [
      "Eu me comunico de forma clara mesmo em conversas difíceis.",
      "Eu consigo delegar tarefas com confiança, sem microgerenciar.",
      "Eu evito controlar excessivamente como o time realiza suas tarefas, focando no resultado combinado.",
      "Eu tomo decisões com segurança mesmo sob pressão ou incerteza.",
      "Eu ajusto meu estilo de comunicação de acordo com quem estou falando.",
      "Eu dou feedback direto e específico, não genérico.",
      "Eu busco ativamente feedback sobre minha liderança, não só espero que me digam.",
      "Eu recebo bem um feedback difícil, sem me colocar na defensiva.",
      "Eu confio na capacidade do meu time de executar sem precisar verificar cada detalhe.",
      "Eu consigo mobilizar o time em direção a um objetivo comum, mesmo diante de resistência.",
    ],
  },
  {
    axis: "heart",
    title: "HEART — saber ser",
    description: "Presença humana da liderança: escuta, empatia, coerência, responsabilidade e cuidado.",
    items: [
      "Eu escuto minha equipe genuinamente, sem já estar pensando na resposta.",
      "Eu admito quando erro ou quando não sei algo, sem tentar disfarçar.",
      "Eu me responsabilizo pelo impacto que minhas decisões geram nas pessoas.",
      "Eu trato minha equipe com empatia mesmo quando estou sob pressão.",
      "Minhas ações no dia a dia são coerentes com os valores que eu digo defender.",
      "Eu reconheço publicamente o esforço e as conquistas do time, não só cobro resultado.",
      "Eu reservo tempo de verdade na minha agenda para cuidar e valorizar as pessoas do meu time.",
      "Eu baseio minhas decisões sobre pessoas em fatos e dados, não em impressões ou achismo.",
      "Eu enfrento fatos difíceis com o time, mesmo quando a notícia não é boa.",
      "Eu percebo quando alguém da equipe não está bem, mesmo sem essa pessoa dizer diretamente.",
    ],
  },
];

export function isRadarHshAssessment(slug: string | null | undefined) {
  return (slug ?? "").startsWith(RADAR_HSH_SLUG);
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const AXIS_BY_PROMPT = new Map<string, HshAxis>();
for (const block of [...RADAR_HSH_BLOCKS, ...LEGACY_HSH_BLOCKS]) {
  for (const item of block.items) AXIS_BY_PROMPT.set(normalize(item), block.axis);
}

export type RadarHshScore = {
  kind: "radar_hsh";
  answered: number;
  scores: Record<HshAxis, number>;
  averages: Record<HshAxis, number>;
  overall: number;
  strongest: HshAxis | null;
  weakest: HshAxis | null;
  profile: string;
  breakdown: Array<{ emotion: string; polarity: "positive" | "negative"; value: number }>;
};

export function scoreRadarHsh(
  questions: Array<{ id: string; prompt: string }>,
  answers: Record<string, unknown>,
): RadarHshScore | null {
  const sums: Record<HshAxis, number> = { hard: 0, soft: 0, heart: 0 };
  const counts: Record<HshAxis, number> = { hard: 0, soft: 0, heart: 0 };
  let answered = 0;

  for (const q of questions) {
    const axis = AXIS_BY_PROMPT.get(normalize(q.prompt.replace(/^\s*\d+[).]\s*/, "")));
    if (!axis) continue;
    const raw = answers[q.id];
    const value = typeof raw === "number" ? raw : Number(raw);
    if (!Number.isFinite(value)) continue;
    sums[axis] += value;
    counts[axis] += 1;
    answered += 1;
  }

  if (answered === 0) return null;

  const axes: HshAxis[] = ["hard", "soft", "heart"];
  const averages = {} as Record<HshAxis, number>;
  const scores = {} as Record<HshAxis, number>;
  for (const a of axes) {
    const avg = counts[a] ? sums[a] / counts[a] : 0;
    averages[a] = Number(avg.toFixed(2));
    scores[a] = Number((avg * 20).toFixed(1));
  }

  const ranked = axes.filter((a) => counts[a] > 0).sort((a, b) => scores[b] - scores[a]);
  const strongest = ranked[0] ?? null;
  const weakest = ranked.length ? ranked[ranked.length - 1] : null;
  const overall = Number(
    (ranked.reduce((acc, a) => acc + scores[a], 0) / (ranked.length || 1)).toFixed(1),
  );

  const label = (s: number) => (s >= 80 ? "consolidado" : s >= 60 ? "em desenvolvimento" : s >= 40 ? "frágil" : "crítico");
  const profile = strongest
    ? `Radar geral ${overall}/100 — ${HSH_AXES[strongest].name} ${scores[strongest]} (mais forte)${weakest && weakest !== strongest ? ` · ${HSH_AXES[weakest].name} ${scores[weakest]} (${label(scores[weakest])})` : ""}`
    : "Sem respostas suficientes";

  return {
    kind: "radar_hsh",
    answered,
    scores,
    averages,
    overall,
    strongest,
    weakest,
    profile,
    breakdown: axes.map((a) => ({
      emotion: `${HSH_AXES[a].name} · ${HSH_AXES[a].subtitle}`,
      polarity: (scores[a] >= 60 ? "positive" : "negative") as "positive" | "negative",
      value: scores[a],
    })),
  };
}
