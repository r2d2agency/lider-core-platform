/**
 * Sabotadores de Performance — Radar de Autogestão e Performance Mental.
 * Instrumento autoral de desenvolvimento (NÃO é teste psicológico).
 *
 * 50 afirmações (10 padrões × 5 itens). Escala 0..4:
 * 0 Nunca · 1 Raramente · 2 Às vezes · 3 Frequentemente · 4 Quase sempre.
 * Apuração por padrão: soma dos 5 itens (0..20) × 5 → intensidade 0..100%.
 */

export const SABOTAGEM_SCALE = [
  { value: 0, label: "Nunca" },
  { value: 1, label: "Raramente" },
  { value: 2, label: "Às vezes" },
  { value: 3, label: "Frequentemente" },
  { value: 4, label: "Quase sempre" },
] as const;

export const SABOTAGEM_HELP =
  "Responda considerando como você tem funcionado nos últimos 90 dias — especialmente sob pressão, conflito ou alta cobrança. Marque a frequência real, não a resposta ideal.";

export type SabotadorPattern = {
  id: string;
  mechanism: string;
  strength: string;
  cost: string;
  question: string;
  /** números oficiais dos itens (1..50) */
  items: number[];
};

/** Itens 1..50 na ordem oficial do instrumento. */
export const SABOTAGEM_ITEMS: string[] = [
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

export const SABOTAGEM_PATTERNS: SabotadorPattern[] = [
  {
    id: "Crítico Interno",
    mechanism: "Busca falhas para prevenir rejeição, perda de qualidade ou culpa.",
    strength: "Discernimento, rigor e aprendizado.",
    cost: "Autocrítica, julgamento e perda de segurança psicológica.",
    question: "O que precisa ser corrigido — e o que já está suficientemente bom?",
    items: [1, 11, 21, 31, 41],
  },
  {
    id: "Controlador",
    mechanism: "Tenta garantir segurança assumindo comando e reduzindo variabilidade.",
    strength: "Direção, coragem decisória e resposta rápida.",
    cost: "Microgestão, dependência da equipe e baixa escala.",
    question: "Qual controle é indispensável e qual está impedindo autonomia?",
    items: [2, 12, 22, 32, 42],
  },
  {
    id: "Perfeccionista",
    mechanism: "Tenta evitar erro e crítica por meio de padrões muito elevados.",
    strength: "Qualidade, precisão e confiabilidade.",
    cost: "Lentidão, retrabalho e dificuldade de concluir.",
    question: "Qual é o padrão necessário para esta entrega, não o padrão ideal?",
    items: [3, 13, 23, 33, 43],
  },
  {
    id: "Agradador",
    mechanism: "Busca pertencimento tornando-se necessário e evitando desagradar.",
    strength: "Empatia, colaboração e cuidado.",
    cost: "Limites frágeis, ressentimento e conversas evitadas.",
    question: "Que verdade precisa ser dita com respeito, mesmo sem aprovação?",
    items: [4, 14, 24, 34, 44],
  },
  {
    id: "Hiper-realizador",
    mechanism: "Associa valor pessoal a produtividade, status e conquista.",
    strength: "Ambição, energia e orientação a resultados.",
    cost: "Exaustão, relações instrumentalizadas e meta sem sentido.",
    question: "Quem você é quando não está produzindo?",
    items: [5, 15, 25, 35, 45],
  },
  {
    id: "Alerta",
    mechanism: "Antecipar ameaças parece a forma mais segura de não ser surpreendido.",
    strength: "Gestão de risco e preparação.",
    cost: "Ansiedade, lentidão e contágio emocional.",
    question: "Qual risco é provável, qual é apenas possível e qual ação é proporcional?",
    items: [6, 16, 26, 36, 46],
  },
  {
    id: "Esquivo",
    mechanism: "Protege a harmonia e foge da dor imediata.",
    strength: "Diplomacia, estabilidade e mediação.",
    cost: "Problemas acumulados, omissão e paz aparente.",
    question: "Qual desconforto curto evita um custo maior depois?",
    items: [7, 17, 27, 37, 47],
  },
  {
    id: "Vitimia",
    mechanism: "Transforma sofrimento em pedido indireto de reconhecimento ou proteção.",
    strength: "Sensibilidade e percepção emocional.",
    cost: "Passividade, dramatização e perda de agência.",
    question: "O que está sob sua responsabilidade e influência agora?",
    items: [8, 18, 28, 38, 48],
  },
  {
    id: "Inquieto",
    mechanism: "Busca estímulo e novidade para evitar tédio, limite ou presença.",
    strength: "Criatividade, curiosidade e visão de possibilidades.",
    cost: "Dispersão, projetos inacabados e baixa profundidade.",
    question: "O que merece continuidade antes de uma nova iniciativa?",
    items: [9, 19, 29, 39, 49],
  },
  {
    id: "Hiperanalítico",
    mechanism: "Usa lógica e distância para reduzir vulnerabilidade e ambiguidade.",
    strength: "Objetividade, análise e solução estruturada.",
    cost: "Frieza percebida, paralisia e baixa conexão.",
    question: "Que dado humano está ausente desta análise?",
    items: [10, 20, 30, 40, 50],
  },
];

/** Blocos de aplicação (5 blocos de 10 itens) para não cansar o participante. */
export const SABOTAGEM_BLOCKS = Array.from({ length: 5 }, (_, b) => ({
  title: `Bloco ${b + 1} de 5`,
  from: b * 10 + 1,
  to: b * 10 + 10,
}));

export function sabotagemBand(percent: number): { band: string; reading: string } {
  if (percent < 25)
    return { band: "Baixa ativação", reading: "O padrão aparece pontualmente e raramente comanda decisões." };
  if (percent < 50)
    return { band: "Ativação moderada", reading: "O funcionamento varia conforme contexto, energia e pressão." };
  if (percent < 75)
    return { band: "Alta ativação", reading: "O padrão influencia decisões com frequência e já gera custo visível." };
  return { band: "Ativação dominante", reading: "O padrão tende a comandar respostas; priorize-o no seu PDI." };
}

/**
 * Apuração oficial: soma dos 5 itens do padrão × 5 → 0..100%.
 * `answers` é indexado pelo número oficial do item (1..50).
 */
export function scoreSabotagem(answers: Record<number, number>) {
  const scores: Record<string, number> = {};
  for (const p of SABOTAGEM_PATTERNS) {
    const answered = p.items.filter((n) => typeof answers[n] === "number");
    if (answered.length === 0) continue;
    const sum = answered.reduce((acc, n) => acc + Math.max(0, Math.min(4, answers[n])), 0);
    scores[p.id] = Math.round(sum * 5);
  }
  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  return { scores, ranked, top3: ranked.slice(0, 3).map(([id]) => id) };
}

export function sabotagemPattern(id: string) {
  return SABOTAGEM_PATTERNS.find((p) => p.id === id);
}
