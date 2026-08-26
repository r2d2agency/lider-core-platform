/**
 * DISC — Perfil Comportamental (Marston).
 * 20 questões de escolha única; cada alternativa pertence a um fator:
 *  D = Dominância · I = Influência · S = Estabilidade · C = Conformidade
 */

export type DiscFactor = "D" | "I" | "S" | "C";
export type DiscItem = { prompt: string; options: Array<{ label: string; factor: DiscFactor }> };

export const DISC_SLUG = "disc-perfil-comportamental";

export const DISC_FACTORS: Record<DiscFactor, { name: string; short: string; description: string }> = {
  D: { name: "Dominância", short: "Dominância", description: "Foco em resultado, decisão rápida, desafio, direção e assertividade." },
  I: { name: "Influência", short: "Influência", description: "Comunicação, entusiasmo, persuasão, relacionamento e otimismo." },
  S: { name: "Estabilidade", short: "Estabilidade", description: "Constância, paciência, cooperação, escuta e apoio ao time." },
  C: { name: "Conformidade", short: "Conformidade", description: "Precisão, análise, regras, qualidade e rigor técnico." },
};

export const DISC_BLOCK_TITLE = "DISC — 20 questões";
export const DISC_BLOCK_DESCRIPTION =
  "Em cada questão, escolha a alternativa que MAIS descreve o seu comportamento natural no trabalho. Não existe resposta certa ou errada.";
export const DISC_HELP = "Selecione apenas uma alternativa — a que mais parece com você.";

export const DISC_ITEMS: DiscItem[] = [
  { prompt: "No trabalho, eu costumo ser mais...", options: [
    { label: "Determinado e direto", factor: "D" },
    { label: "Comunicativo e entusiasmado", factor: "I" },
    { label: "Paciente e constante", factor: "S" },
    { label: "Detalhista e criterioso", factor: "C" },
  ]},
  { prompt: "Diante de um problema novo, eu...", options: [
    { label: "Assumo o comando e decido rápido", factor: "D" },
    { label: "Chamo pessoas e crio energia em volta", factor: "I" },
    { label: "Mantenho a calma e busco estabilidade", factor: "S" },
    { label: "Analiso os dados antes de agir", factor: "C" },
  ]},
  { prompt: "O que mais me motiva é...", options: [
    { label: "Vencer desafios e ver resultado", factor: "D" },
    { label: "Reconhecimento e contato com pessoas", factor: "I" },
    { label: "Um ambiente previsível e harmonioso", factor: "S" },
    { label: "Fazer certo, com qualidade e padrão", factor: "C" },
  ]},
  { prompt: "Meu maior incômodo é...", options: [
    { label: "Perder tempo e perder controle", factor: "D" },
    { label: "Ser ignorado ou ficar isolado", factor: "I" },
    { label: "Mudanças bruscas e conflito", factor: "S" },
    { label: "Erro, improviso e desorganização", factor: "C" },
  ]},
  { prompt: "Ao me comunicar, eu sou...", options: [
    { label: "Objetivo e às vezes ríspido", factor: "D" },
    { label: "Expansivo e envolvente", factor: "I" },
    { label: "Calmo e acolhedor", factor: "S" },
    { label: "Preciso e formal", factor: "C" },
  ]},
  { prompt: "Sob pressão, eu tendo a...", options: [
    { label: "Ficar impaciente e mandão", factor: "D" },
    { label: "Falar demais e me dispersar", factor: "I" },
    { label: "Me calar e absorver a tensão", factor: "S" },
    { label: "Me fechar nos detalhes e travar", factor: "C" },
  ]},
  { prompt: "Prefiro trabalhar...", options: [
    { label: "Com autonomia total e metas ousadas", factor: "D" },
    { label: "Em equipe, com muita interação", factor: "I" },
    { label: "Com rotina clara e time estável", factor: "S" },
    { label: "Com processos e critérios bem definidos", factor: "C" },
  ]},
  { prompt: "Quando delego, eu...", options: [
    { label: "Digo o resultado esperado e cobro", factor: "D" },
    { label: "Inspiro e vendo a ideia", factor: "I" },
    { label: "Apoio de perto e dou suporte", factor: "S" },
    { label: "Explico o passo a passo e o padrão", factor: "C" },
  ]},
  { prompt: "Eu tomo decisões...", options: [
    { label: "Rápido, mesmo com pouca informação", factor: "D" },
    { label: "Pela intuição e pelo impacto nas pessoas", factor: "I" },
    { label: "Devagar, buscando consenso", factor: "S" },
    { label: "Só depois de analisar tudo", factor: "C" },
  ]},
  { prompt: "As pessoas dizem que eu sou...", options: [
    { label: "Exigente", factor: "D" },
    { label: "Animado", factor: "I" },
    { label: "Confiável", factor: "S" },
    { label: "Perfeccionista", factor: "C" },
  ]},
  { prompt: "Em uma reunião, eu costumo...", options: [
    { label: "Puxar a decisão e cortar o que não importa", factor: "D" },
    { label: "Falar bastante e animar o grupo", factor: "I" },
    { label: "Ouvir mais do que falar", factor: "S" },
    { label: "Questionar dados e inconsistências", factor: "C" },
  ]},
  { prompt: "Meu ritmo natural é...", options: [
    { label: "Acelerado e impositivo", factor: "D" },
    { label: "Acelerado e sociável", factor: "I" },
    { label: "Constante e tranquilo", factor: "S" },
    { label: "Metódico e cauteloso", factor: "C" },
  ]},
  { prompt: "Diante de um conflito, eu...", options: [
    { label: "Enfrento de frente", factor: "D" },
    { label: "Tento descontrair e aproximar", factor: "I" },
    { label: "Busco harmonizar e ceder", factor: "S" },
    { label: "Recorro às regras e aos fatos", factor: "C" },
  ]},
  { prompt: "Um bom projeto para mim é aquele que...", options: [
    { label: "Traz resultado rápido e visível", factor: "D" },
    { label: "Envolve pessoas e visibilidade", factor: "I" },
    { label: "Tem previsibilidade e segurança", factor: "S" },
    { label: "Tem método, precisão e qualidade", factor: "C" },
  ]},
  { prompt: "Meu ponto de atenção como líder é...", options: [
    { label: "Atropelar pessoas para entregar", factor: "D" },
    { label: "Prometer mais do que consigo cumprir", factor: "I" },
    { label: "Evitar conversas difíceis", factor: "S" },
    { label: "Travar buscando a perfeição", factor: "C" },
  ]},
  { prompt: "Eu prefiro receber informação...", options: [
    { label: "Resumida e direto ao ponto", factor: "D" },
    { label: "Numa conversa, com contexto humano", factor: "I" },
    { label: "Com calma, sem me pressionar", factor: "S" },
    { label: "Completa, com dados e evidências", factor: "C" },
  ]},
  { prompt: "Mudanças no trabalho me deixam...", options: [
    { label: "Empolgado, se acelerarem resultado", factor: "D" },
    { label: "Curioso e animado pelo novo", factor: "I" },
    { label: "Desconfortável até me adaptar", factor: "S" },
    { label: "Preocupado com riscos e falhas", factor: "C" },
  ]},
  { prompt: "Meu jeito de reconhecer alguém é...", options: [
    { label: "Apontar a meta batida", factor: "D" },
    { label: "Celebrar publicamente", factor: "I" },
    { label: "Agradecer de forma pessoal e discreta", factor: "S" },
    { label: "Elogiar a qualidade técnica do trabalho", factor: "C" },
  ]},
  { prompt: "Quando cobro o time, eu...", options: [
    { label: "Vou direto ao ponto e exijo prazo", factor: "D" },
    { label: "Motivo e reforço o propósito", factor: "I" },
    { label: "Ofereço ajuda antes de cobrar", factor: "S" },
    { label: "Mostro o padrão e onde ficou fora", factor: "C" },
  ]},
  { prompt: "No fundo, o que eu mais valorizo é...", options: [
    { label: "Resultado", factor: "D" },
    { label: "Pessoas e energia", factor: "I" },
    { label: "Confiança e estabilidade", factor: "S" },
    { label: "Precisão e coerência", factor: "C" },
  ]},
];

export function isDiscAssessment(slug: string | null | undefined) {
  return (slug ?? "").startsWith(DISC_SLUG);
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const FACTOR_BY_LABEL = new Map<string, DiscFactor>();
for (const item of DISC_ITEMS) {
  for (const opt of item.options) FACTOR_BY_LABEL.set(normalize(opt.label), opt.factor);
}

export type DiscScore = {
  kind: "disc_profile";
  answered: number;
  counts: Record<DiscFactor, number>;
  percents: Record<DiscFactor, number>;
  primary: DiscFactor | null;
  secondary: DiscFactor | null;
  profile: string;
  ranking: Array<{ factor: DiscFactor; name: string; count: number; percent: number }>;
  breakdown: Array<{ emotion: string; polarity: "positive" | "negative"; value: number }>;
};

export function scoreDisc(
  questions: Array<{ id: string; prompt: string; options?: Array<{ id: string; label: string; value: string }> }>,
  answers: Record<string, unknown>,
): DiscScore | null {
  const counts: Record<DiscFactor, number> = { D: 0, I: 0, S: 0, C: 0 };
  let answered = 0;

  for (const q of questions) {
    const raw = answers[q.id];
    if (raw == null || raw === "") continue;
    const values = Array.isArray(raw) ? raw : [raw];
    for (const v of values) {
      const str = String(v);
      let factor: DiscFactor | undefined;
      if (/^[DISC]$/.test(str.trim().toUpperCase())) factor = str.trim().toUpperCase() as DiscFactor;
      if (!factor) {
        const opt = (q.options ?? []).find((o) => o.id === str || o.value === str || o.label === str);
        const candidate = opt?.value?.trim().toUpperCase();
        if (candidate && /^[DISC]$/.test(candidate)) factor = candidate as DiscFactor;
        else if (opt) factor = FACTOR_BY_LABEL.get(normalize(opt.label));
        else factor = FACTOR_BY_LABEL.get(normalize(str));
      }
      if (!factor) continue;
      counts[factor] += 1;
      answered += 1;
    }
  }

  if (answered === 0) return null;

  const pct = (n: number) => Number(((n / answered) * 100).toFixed(1));
  const percents: Record<DiscFactor, number> = { D: pct(counts.D), I: pct(counts.I), S: pct(counts.S), C: pct(counts.C) };
  const ranking = (Object.keys(counts) as DiscFactor[])
    .map((f) => ({ factor: f, name: DISC_FACTORS[f].short, count: counts[f], percent: percents[f] }))
    .sort((a, b) => b.count - a.count);

  const primary = ranking[0].count > 0 ? ranking[0].factor : null;
  const secondary = ranking[1] && ranking[1].count > 0 ? ranking[1].factor : null;
  const profile = primary
    ? secondary
      ? `Perfil ${primary}${secondary} — ${DISC_FACTORS[primary].name} com ${DISC_FACTORS[secondary].name}`
      : `Perfil ${primary} — ${DISC_FACTORS[primary].name}`
    : "Sem perfil identificado";

  return {
    kind: "disc_profile",
    answered,
    counts,
    percents,
    primary,
    secondary,
    profile,
    ranking,
    breakdown: ranking.map((r) => ({
      emotion: `${r.factor} · ${r.name} (${r.percent}%)`,
      polarity: "positive" as const,
      value: r.count,
    })),
  };
}
