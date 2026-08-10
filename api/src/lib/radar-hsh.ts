/**
 * Radar das Competências H.S.H — Hard, Soft e Heart.
 * 3 eixos × 10 afirmações, escala 1..5.
 * Score por eixo = média das 10 respostas × 20 (0 a 100).
 */

export type HshAxis = "hard" | "soft" | "heart";

export const RADAR_HSH_SLUG = "radar-competencias-hsh";

export const HSH_AXES: Record<HshAxis, { name: string; subtitle: string; description: string }> = {
  hard: { name: "HARD", subtitle: "saber fazer", description: "Domínio técnico, ferramentas, indicadores, processos e organização das entregas." },
  soft: { name: "SOFT", subtitle: "saber agir e se relacionar", description: "Comunicação, delegação, feedback, decisão sob pressão e mobilização do time." },
  heart: { name: "HEART", subtitle: "saber ser", description: "Escuta, humildade, empatia, coerência, reconhecimento e cuidado com as pessoas." },
};

export const RADAR_HSH_HELP =
  "Escala: 1 Quase nunca · 2 Raramente · 3 Às vezes · 4 Frequentemente · 5 Quase sempre";

export const RADAR_HSH_BLOCKS: Array<{ axis: HshAxis; title: string; description: string; items: string[] }> = [
  {
    axis: "hard",
    title: "HARD — saber fazer",
    description:
      "Competências técnicas, gerenciais e analíticas. Responda em que grau cada competência está presente na sua atuação hoje.",
    items: [
      "Gestão de indicadores — eu acompanho e uso indicadores (KPIs/OKRs) para tomar decisões no dia a dia da minha área.",
      "Planejamento de entregas — eu planejo entregas com prazos, prioridades e etapas claras antes de começar a execução.",
      "Gestão de processos — os processos da minha área estão documentados e padronizados, permitindo que outras pessoas os executem sem depender de mim.",
      "Gestão de prioridades — eu consigo distinguir o urgente do importante e organizar minha agenda e a da equipe de acordo com isso.",
      "Decisão baseada em dados — minhas decisões se apoiam em dados e evidências, e não apenas na percepção ou urgência do momento.",
      "Domínio técnico da área — eu domino os sistemas, normas e metodologias técnicas específicas da minha área de atuação.",
      "Avaliação da qualidade das entregas — eu tenho critérios claros e objetivos para avaliar se uma entrega está dentro do padrão esperado.",
      "Diagnóstico e solução de problemas — eu busco a causa raiz dos problemas antes de agir, em vez de apenas tratar os sintomas.",
      "Estruturação da autonomia da equipe — minha equipe sabe até onde pode decidir sozinha, sem precisar recorrer a mim para tudo.",
      "Desenvolvimento e atualização técnica — eu me mantenho atualizado tecnicamente, buscando novos conhecimentos e boas práticas da minha área.",
    ],
  },
  {
    axis: "soft",
    title: "SOFT — saber agir e se relacionar",
    description:
      "Competências para comunicar, influenciar, delegar e conduzir o time.",
    items: [
      "Comunicação clara e assertiva — eu me comunico de forma clara, direta e respeitosa, mesmo em situações de tensão.",
      "Conversas difíceis — eu me sinto preparado e disposto a ter conversas difíceis quando o assunto exige.",
      "Delegação — eu delego de forma estruturada, com briefing, autonomia e checkpoints, e não apenas repasso a tarefa.",
      "Redução do microgerenciamento — eu confio nos resultados combinados e evito controlar demais o passo a passo da equipe.",
      "Decisão sob pressão — eu consigo tomar boas decisões mesmo sob pressão de tempo ou de resultado.",
      "Comunicação adaptativa — eu ajusto minha forma de me comunicar de acordo com o perfil e o contexto de cada pessoa da equipe.",
      "Feedback — eu dou feedbacks claros, específicos e frequentes, não só nas avaliações formais.",
      "Abertura ao feedback — eu recebo feedback sobre mim mesmo sem me colocar na defensiva.",
      "Confiança na equipe — eu confio na capacidade da minha equipe de entregar com autonomia.",
      "Influência e mobilização — eu consigo mobilizar e engajar pessoas em torno de um propósito, mesmo sem usar minha autoridade formal.",
    ],
  },
  {
    axis: "heart",
    title: "HEART — saber ser",
    description:
      "Maturidade emocional, caráter, coerência e qualidade humana da liderança.",
    items: [
      "Escuta genuína — eu realmente escuto as pessoas antes de responder, sem já estar formulando minha resposta enquanto o outro fala.",
      "Humildade e vulnerabilidade — eu consigo reconhecer publicamente um erro meu ou pedir ajuda quando não sei algo.",
      "Autorresponsabilidade — eu assumo a responsabilidade pelos resultados da minha área, mesmo quando fatores externos contribuíram.",
      "Empatia sob pressão — eu consigo manter empatia com as pessoas mesmo em momentos de pressão ou crise.",
      "Coerência entre discurso e prática — minhas atitudes no dia a dia são coerentes com o que eu falo e defendo como líder.",
      "Reconhecimento das pessoas — eu reconheço publicamente e de forma específica o bom trabalho da minha equipe.",
      "Disponibilidade para o time — eu estou genuinamente disponível para as pessoas da minha equipe, além das pautas operacionais.",
      "Justiça nas decisões sobre pessoas — minhas decisões sobre pessoas se baseiam em critérios objetivos, e não em preferência pessoal.",
      "Coragem para enfrentar a realidade — eu encaro e comunico verdades difíceis, mesmo quando isso é desconfortável.",
      "Sensibilidade humana — eu percebo mudanças de comportamento ou de humor nas pessoas da minha equipe antes que se tornem um problema maior.",
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
