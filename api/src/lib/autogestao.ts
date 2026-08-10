/**
 * Radar de Autogestão e Performance Mental (IPM).
 * Instrumento autoral de desenvolvimento — NÃO é teste psicológico
 * nem instrumento psicométrico validado.
 *
 * 50 afirmações de padrões automáticos (itens 1..50) + 10 itens de
 * Índice de Potência Mental (itens 51..60). Escala 0..4.
 *
 * Apuração:
 *  - Padrão = soma dos 5 itens (0..20) × 5 → intensidade 0..100%.
 *  - IPM    = (soma dos itens 51..60 ÷ 40) × 100.
 */

export const AUTOGESTAO_SLUG = "radar-autogestao-performance-mental";

export const AUTOGESTAO_HELP =
  "Escala: 0 Nunca · 1 Raramente · 2 Às vezes · 3 Frequentemente · 4 Quase sempre. Responda pensando nos últimos 90 dias, especialmente sob pressão.";

export type AutogestaoPatternKey =
  | "critico_interno"
  | "controlador"
  | "perfeccionista"
  | "prestativo"
  | "hiper_realizador"
  | "hiper_vigilante"
  | "esquivo"
  | "vitimia"
  | "inquieto"
  | "hiperanalitico";

export const AUTOGESTAO_PATTERNS: Record<
  AutogestaoPatternKey,
  { name: string; mechanism: string; strength: string; cost: string; question: string; items: number[] }
> = {
  critico_interno: {
    name: "Crítico Interno",
    mechanism: "Busca falhas para prevenir rejeição, perda de qualidade ou culpa.",
    strength: "Discernimento, rigor e aprendizado.",
    cost: "Autocrítica, julgamento e perda de segurança psicológica.",
    question: "O que precisa ser corrigido — e o que já está suficientemente bom?",
    items: [1, 11, 21, 31, 41],
  },
  controlador: {
    name: "Controlador",
    mechanism: "Tenta garantir segurança assumindo comando e reduzindo variabilidade.",
    strength: "Direção, coragem decisória e resposta rápida.",
    cost: "Microgestão, dependência da equipe e baixa escala.",
    question: "Qual controle é indispensável e qual está impedindo autonomia?",
    items: [2, 12, 22, 32, 42],
  },
  perfeccionista: {
    name: "Perfeccionista",
    mechanism: "Tenta evitar erro e crítica por meio de padrões muito elevados.",
    strength: "Qualidade, precisão e confiabilidade.",
    cost: "Lentidão, retrabalho e dificuldade de concluir.",
    question: "Qual é o padrão necessário para esta entrega, não o padrão ideal?",
    items: [3, 13, 23, 33, 43],
  },
  prestativo: {
    name: "Prestativo",
    mechanism: "Busca pertencimento tornando-se necessário e evitando desagradar.",
    strength: "Empatia, colaboração e cuidado.",
    cost: "Limites frágeis, ressentimento e conversas evitadas.",
    question: "Que verdade precisa ser dita com respeito, mesmo sem aprovação?",
    items: [4, 14, 24, 34, 44],
  },
  hiper_realizador: {
    name: "Hiper Realizador",
    mechanism: "Associa valor pessoal a produtividade, status e conquista.",
    strength: "Ambição, energia e orientação a resultados.",
    cost: "Exaustão, relações instrumentalizadas e meta sem sentido.",
    question: "Quem você é quando não está produzindo?",
    items: [5, 15, 25, 35, 45],
  },
  hiper_vigilante: {
    name: "Hiper Vigilante",
    mechanism: "Antecipar ameaças parece a forma mais segura de não ser surpreendido.",
    strength: "Gestão de risco e preparação.",
    cost: "Ansiedade, lentidão e contágio emocional.",
    question: "Qual risco é provável, qual é apenas possível e qual ação é proporcional?",
    items: [6, 16, 26, 36, 46],
  },
  esquivo: {
    name: "Esquivo",
    mechanism: "Protege a harmonia e foge da dor imediata.",
    strength: "Diplomacia, estabilidade e mediação.",
    cost: "Problemas acumulados, omissão e paz aparente.",
    question: "Qual desconforto curto evita um custo maior depois?",
    items: [7, 17, 27, 37, 47],
  },
  vitimia: {
    name: "Vitimia",
    mechanism: "Transforma sofrimento em pedido indireto de reconhecimento ou proteção.",
    strength: "Sensibilidade e percepção emocional.",
    cost: "Passividade, dramatização e perda de agência.",
    question: "O que está sob sua responsabilidade e influência agora?",
    items: [8, 18, 28, 38, 48],
  },
  inquieto: {
    name: "Inquieto",
    mechanism: "Busca estímulo e novidade para evitar tédio, limite ou presença.",
    strength: "Criatividade, curiosidade e visão de possibilidades.",
    cost: "Dispersão, projetos inacabados e baixa profundidade.",
    question: "O que merece continuidade antes de uma nova iniciativa?",
    items: [9, 19, 29, 39, 49],
  },
  hiperanalitico: {
    name: "Hiperanalítico",
    mechanism: "Usa lógica e distância para reduzir vulnerabilidade e ambiguidade.",
    strength: "Objetividade, análise e solução estruturada.",
    cost: "Frieza percebida, paralisia e baixa conexão.",
    question: "Que dado humano está ausente desta análise?",
    items: [10, 20, 30, 40, 50],
  },
};

/** Itens 1..50 — padrões automáticos (ordem oficial do instrumento). */
export const AUTOGESTAO_PATTERN_ITEMS: string[] = [
  "Percebo primeiro o que está errado, mesmo quando o resultado geral é bom.",
  "Fico tenso quando decisões importantes são tomadas sem minha participação.",
  "Adio uma entrega quando acredito que ela ainda não atingiu o padrão ideal.",
  "Digo sim para evitar decepcionar alguém, mesmo quando deveria dizer não.",
  "Meu valor pessoal fica muito ligado ao que produzo ou conquisto.",
  "Imagino com frequência o que pode dar errado antes de considerar o que pode dar certo.",
  "Adio conversas difíceis na esperança de que o problema se resolva sozinho.",
  "Quando me sinto incompreendido, permaneço preso a essa sensação por bastante tempo.",
  "Perco o interesse quando uma atividade deixa de oferecer novidade ou estímulo.",
  "Confio mais na lógica do que em sinais emocionais ou relacionais.",
  "Um erro pequeno permanece na minha cabeça por mais tempo do que deveria.",
  "Prefiro assumir uma tarefa a correr o risco de vê-la executada de outro modo.",
  "Detalhes fora do lugar me incomodam mesmo quando não afetam o resultado.",
  "Antes de decidir, penso muito em como os outros reagirão a mim.",
  "Ao alcançar uma meta, rapidamente passo para a próxima sem absorver o resultado.",
  "Mesmo quando tudo está bem, permaneço esperando que surja algum problema.",
  "Quando surge conflito, tento suavizar a situação antes de tratar a causa.",
  "Em períodos difíceis, penso que os outros não reconhecem o peso que carrego.",
  "Enquanto faço algo, penso com frequência na próxima experiência ou possibilidade.",
  "Em situações sensíveis, explico e analiso antes de demonstrar o que sinto.",
  "Costumo ser mais duro comigo do que seria com outra pessoa na mesma situação.",
  "Tenho dificuldade de delegar sem acompanhar de perto cada etapa.",
  "Tenho dificuldade de considerar uma tarefa realmente concluída.",
  "Evito expor uma discordância quando ela pode gerar desconforto na relação.",
  "Tenho dificuldade de reduzir o ritmo sem sentir culpa ou improdutividade.",
  "Preciso de muitas garantias antes de me sentir seguro para avançar.",
  "Evito tarefas desagradáveis até que se tornem urgentes.",
  "Minha energia diminui quando acredito que não tenho influência sobre a situação.",
  "Tenho dificuldade de sustentar atenção em tarefas repetitivas, mesmo importantes.",
  "Posso parecer distante quando tento resolver um problema de forma racional.",
  "Quando alguém falha, tenho dificuldade de separar o erro do valor da pessoa.",
  "Quando algo sai do plano, minha reação inicial é aumentar o controle.",
  "Reviso meu trabalho mais vezes do que o risco da tarefa justificaria.",
  "Assumo necessidades alheias como responsabilidade minha.",
  "Resultados medianos me parecem fracasso, mesmo quando são adequados ao contexto.",
  "Mudanças inesperadas geram em mim uma tensão difícil de desligar.",
  "Tenho dificuldade de permanecer presente diante da tensão emocional de outra pessoa.",
  "Às vezes uso meu sofrimento como sinal de que alguém deveria mudar ou me acolher.",
  "Busco novos projetos antes de concluir plenamente os atuais.",
  "Tenho dificuldade de agir quando ainda existem variáveis sem resposta.",
  "Sinto que relaxar a cobrança pode diminuir a qualidade do meu desempenho.",
  "Sinto que os resultados dependem excessivamente da minha intervenção.",
  "Padrões elevados acabam consumindo tempo que deveria ser dedicado ao essencial.",
  "Quando não sou reconhecido por ajudar, sinto frustração ou ressentimento.",
  "Sacrifico descanso ou relações para manter um nível alto de entrega.",
  "Repasso mentalmente riscos e cenários negativos por tempo excessivo.",
  "Prefiro preservar uma paz aparente a enfrentar um problema necessário.",
  "Tenho dificuldade de sair de uma decepção sem revisitar repetidamente o ocorrido.",
  "Momentos de silêncio ou inatividade rapidamente me deixam desconfortável.",
  "Às vezes trato pessoas como problemas a resolver, e não como experiências a compreender.",
];

/** Itens 51..60 — Índice de Potência Mental. */
export const AUTOGESTAO_IPM_ITEMS: string[] = [
  "Consigo perceber um pensamento automático antes de transformá-lo em ação.",
  "Sob pressão, recupero clareza suficiente para escolher minha resposta.",
  "Consigo reconhecer emoções desconfortáveis sem ser conduzido por elas.",
  "Diante de um erro, extraio aprendizado sem permanecer em autocondenação.",
  "Consigo enxergar alternativas quando um plano importante falha.",
  "Escuto perspectivas diferentes sem precisar me defender imediatamente.",
  "Tomo decisões importantes com equilíbrio entre fatos, intuição e impacto humano.",
  "Consigo estabelecer limites mesmo quando alguém pode se frustrar comigo.",
  "Delego responsabilidades com critérios claros e espaço real de autonomia.",
  "Reservo pausas suficientes para recuperar foco e qualidade de presença.",
];

export const AUTOGESTAO_BLOCKS: Array<{ title: string; description: string; items: string[] }> = [
  {
    title: "Padrões automáticos",
    description:
      "Marque a frequência real com que cada afirmação descreve o seu funcionamento nos últimos 90 dias — não a resposta ideal. A primeira resposta honesta tende a retratar melhor o padrão automático.",
    items: AUTOGESTAO_PATTERN_ITEMS,
  },
  {
    title: "Índice de Potência Mental (IPM)",
    description:
      "Agora avalie seus recursos de autorregulação e escolha consciente, usando a mesma escala de 0 a 4.",
    items: AUTOGESTAO_IPM_ITEMS,
  },
];

export function isAutogestaoAssessment(slug: string | null | undefined) {
  return (slug ?? "").startsWith("radar-autogestao");
}

export function autogestaoBand(percent: number): { band: string; reading: string } {
  if (percent < 25)
    return {
      band: "Baixa ativação",
      reading: "O padrão aparece pontualmente; no IPM, há necessidade de construir repertório básico.",
    };
  if (percent < 50)
    return {
      band: "Ativação moderada",
      reading: "O funcionamento varia conforme contexto, energia e pressão.",
    };
  if (percent < 75)
    return {
      band: "Alta ativação",
      reading:
        "O padrão influencia decisões com frequência; no IPM, há boa capacidade de recuperação.",
    };
  return {
    band: "Ativação dominante",
    reading:
      "O padrão tende a comandar respostas; no IPM, a escolha consciente está amplamente disponível.",
  };
}

export type AutogestaoScore = {
  kind: "autogestao_ipm";
  answered: number;
  patterns: Array<{
    key: AutogestaoPatternKey;
    name: string;
    sum: number;
    intensity: number;
    band: string;
    mechanism: string;
    strength: string;
    cost: string;
    question: string;
  }>;
  top3: AutogestaoPatternKey[];
  ipm: number | null;
  ipmSum: number | null;
  ipmBand: string | null;
  profile: string;
  breakdown: Array<{ emotion: string; polarity: "positive" | "negative"; value: number }>;
};

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/^\s*\d+[).]\s*/, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Mapa prompt normalizado → número oficial do item (1..60). */
const ITEM_NUMBER_BY_PROMPT = new Map<string, number>();
AUTOGESTAO_PATTERN_ITEMS.forEach((p, i) => ITEM_NUMBER_BY_PROMPT.set(normalize(p), i + 1));
AUTOGESTAO_IPM_ITEMS.forEach((p, i) => ITEM_NUMBER_BY_PROMPT.set(normalize(p), i + 51));

export function scoreAutogestao(
  questions: Array<{ id: string; prompt: string }>,
  answers: Record<string, unknown>,
): AutogestaoScore | null {
  const values = new Map<number, number>();
  let answered = 0;

  for (const q of questions) {
    const num = ITEM_NUMBER_BY_PROMPT.get(normalize(q.prompt.replace(/^\s*\d+[).]\s*/, "")));
    if (!num) continue;
    const raw = answers[q.id];
    const value = typeof raw === "number" ? raw : Number(raw);
    if (!Number.isFinite(value)) continue;
    values.set(num, Math.max(0, Math.min(4, value)));
    answered += 1;
  }

  if (answered === 0) return null;

  const patterns = (Object.keys(AUTOGESTAO_PATTERNS) as AutogestaoPatternKey[])
    .map((key) => {
      const def = AUTOGESTAO_PATTERNS[key];
      const answeredItems = def.items.filter((n) => values.has(n));
      const sum = answeredItems.reduce((acc, n) => acc + (values.get(n) ?? 0), 0);
      const intensity = Number((sum * 5).toFixed(0));
      return {
        key,
        name: def.name,
        sum,
        intensity,
        band: autogestaoBand(intensity).band,
        mechanism: def.mechanism,
        strength: def.strength,
        cost: def.cost,
        question: def.question,
      };
    })
    .sort((a, b) => b.intensity - a.intensity);

  const ipmItems = Array.from({ length: 10 }, (_, i) => i + 51).filter((n) => values.has(n));
  const ipmSum = ipmItems.length ? ipmItems.reduce((acc, n) => acc + (values.get(n) ?? 0), 0) : null;
  const ipm = ipmSum === null ? null : Number(((ipmSum / 40) * 100).toFixed(0));

  const top3 = patterns.slice(0, 3).map((p) => p.key);
  const profile = `${patterns
    .slice(0, 3)
    .map((p) => `${p.name} ${p.intensity}%`)
    .join(" · ")}${ipm !== null ? ` — IPM ${ipm}%` : ""}`;

  return {
    kind: "autogestao_ipm",
    answered,
    patterns,
    top3,
    ipm,
    ipmSum,
    ipmBand: ipm === null ? null : autogestaoBand(ipm).band,
    profile,
    breakdown: [
      ...patterns.map((p) => ({
        emotion: p.name,
        polarity: (p.intensity >= 50 ? "negative" : "positive") as "positive" | "negative",
        value: p.intensity,
      })),
      ...(ipm !== null
        ? [{ emotion: "IPM · Índice de Potência Mental", polarity: "positive" as const, value: ipm }]
        : []),
    ],
  };
}
