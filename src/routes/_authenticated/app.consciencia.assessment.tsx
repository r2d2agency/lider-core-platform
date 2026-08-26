import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2, Sparkles } from "lucide-react";
import { api } from "@/lib/api";
import { useCurrentOrg } from "@/lib/use-current-org";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  SABOTAGEM_BLOCKS,
  SABOTAGEM_HELP,
  SABOTAGEM_ITEMS,
  SABOTAGEM_PATTERNS,
  SABOTAGEM_SCALE,
  normalizeSabotagemAnswer,
  sabotagemBand,
  sabotagemPattern,
  scoreSabotagem,
} from "@/lib/sabotadores";

type AssessmentStepKey = "papel" | "behavioral" | "sabotages" | "cerebral" | "hsh";

const STEP_INDEX: Record<AssessmentStepKey, number> = {
  papel: 0,
  behavioral: 1,
  sabotages: 2,
  cerebral: 3,
  hsh: 5,
};

function isAssessmentStepKey(value: unknown): value is AssessmentStepKey {
  return value === "papel" || value === "behavioral" || value === "sabotages" || value === "cerebral" || value === "hsh";
}

export const Route = createFileRoute("/_authenticated/app/consciencia/assessment")({
  validateSearch: (search: Record<string, unknown>) => ({
    step: (search.step as AssessmentStepKey) || undefined,
    showResults: search.showResults === true || search.showResults === "true",
    reset: search.reset === true || search.reset === "true",
  }),
  component: AssessmentWizard,
  head: () => ({
    meta: [
      { title: "Assessment guiado · Consciência · LíderCore" },
      { name: "description", content: "Complete seu perfil comportamental, sabotadores de performance e radar Hard Soft Heart." },
      { property: "og:title", content: "Assessment guiado · Consciência · LíderCore" },
      { property: "og:description", content: "Complete seu perfil comportamental, sabotadores de performance e radar Hard Soft Heart." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type DiscPrimary = "D" | "I" | "S" | "C";
type CerebralMode = "aguia" | "lobo" | "gato" | "tubarao";
type Profile = {
  declaredRole: string | null; notMine: string | null;
  discPrimary: DiscPrimary | null; discSecondary?: DiscPrimary | null; mbtiType: string | null;
  cerebralPrimary?: CerebralMode | null;
  cerebralProfile?: Record<CerebralMode, number> | null;
  sabotages: string[]; riskFlags: string[];
  hardSelfScore: number | null; softSelfScore: number | null; heartSelfScore: number | null;
  strengths: string[]; notes: string | null; communicationStyle: string | null;
  assessmentType: "disc" | "big_five" | "other" | null;
  sabotageScores?: Record<string, number> | null;
  hardAnswers?: number[] | null;
  softAnswers?: number[] | null;
  heartAnswers?: number[] | null;
};
type Me = { profile: Profile | null };

const DISC = [
  { key: "D" as const, title: "Dominante",  desc: "Direto, decidido, orientado a resultado." },
  { key: "I" as const, title: "Influente",  desc: "Comunicativo, entusiasta, mobiliza pessoas." },
  { key: "S" as const, title: "Estável",    desc: "Cooperativo, paciente, mantém o time unido." },
  { key: "C" as const, title: "Cauteloso",  desc: "Analítico, metódico, valoriza precisão." },
];

function formatDiscSummary(primary: DiscPrimary | null | undefined, secondary: DiscPrimary | null | undefined) {
  return primary ? `${primary}${secondary ?? ""}` : null;
}

function sanitizeSabotageAnswers(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const sanitized: Record<string, number> = {};
  for (const [key, value] of Object.entries(raw)) {
    const normalized = normalizeSabotagemAnswer(value);
    if (normalized != null) sanitized[key] = normalized;
  }
  return sanitized;
}

const SABOTAGEM_TOTAL = SABOTAGEM_ITEMS.length; // 50 itens oficiais

const RISKS = [
  { 
    value: "controle", 
    label: "Controle excessivo", 
    origin: "Tubarão / Perfeccionista",
    intensity: "Alta",
    meaning: "Necessidade de garantir o resultado final através da microgestão, gerando gargalos e desmotivação no time." 
  },
  { 
    value: "evita_conflito", 
    label: "Evita conflito",
    origin: "Gato / Evasivo",
    intensity: "Média",
    meaning: "Dificuldade em ter conversas difíceis ou dar feedbacks corretivos, acumulando problemas não resolvidos."
  },
  { 
    value: "cobranca_dura", 
    label: "Cobrança dura",
    origin: "Tubarão / Juiz interno",
    intensity: "Alta",
    meaning: "Foco exclusivo no 'quê' em detrimento do 'como', podendo gerar um clima de medo ou estresse."
  },
  { 
    value: "perfeccionismo", 
    label: "Perfeccionismo",
    origin: "Águia / Perfeccionista",
    intensity: "Média",
    meaning: "Retenção de entregas por busca de um padrão irreal, impactando a velocidade da operação."
  },
  { 
    value: "impaciencia", 
    label: "Impaciência",
    origin: "Tubarão / Inquieto",
    intensity: "Média",
    meaning: "Dificuldade em respeitar o tempo de aprendizado ou execução dos outros, gerando ansiedade."
  },
  { 
    value: "acomodacao", 
    label: "Acomodação",
    origin: "Lobo / Estável",
    intensity: "Baixa",
    meaning: "Manutenção do status quo para evitar desconforto, perdendo oportunidades de inovação ou melhoria."
  },
];

// 30 perguntas oficiais Hard·Soft·Heart (10 por dimensão)
const HSH_QUESTIONS = {
  hard: [
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
  soft: [
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
  heart: [
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
};

// 8 blocos de predominância cerebral (Águia/Lobo/Gato/Tubarão)
const CEREBRAL: Array<{ id: string; label: string; opts: Array<{ text: string; dim: CerebralMode }> }> = [
  { id: "b1", label: "Diante de um problema novo…", opts: [
    { text: "Subo o zoom e vejo o todo antes de agir.", dim: "aguia" },
    { text: "Assumo o comando e articulo o grupo.",       dim: "lobo" },
    { text: "Sinto o clima e busco saída criativa.",      dim: "gato" },
    { text: "Ataco agora, ajusto depois.",                dim: "tubarao" },
  ]},
  { id: "b2", label: "O que mais me motiva é…", opts: [
    { text: "Descobrir padrões e estratégias.",   dim: "aguia" },
    { text: "Formar time forte e proteger.",      dim: "lobo" },
    { text: "Liberdade e adaptar rota.",           dim: "gato" },
    { text: "Vencer disputas e bater metas.",     dim: "tubarao" },
  ]},
  { id: "b3", label: "Sob pressão eu tendo a…", opts: [
    { text: "Isolar e analisar antes de decidir.", dim: "aguia" },
    { text: "Chamar o time e coordenar frente.",   dim: "lobo" },
    { text: "Improvisar e mudar de tática.",       dim: "gato" },
    { text: "Acelerar e forçar resultado.",        dim: "tubarao" },
  ]},
  { id: "b4", label: "Meu jeito de decidir…", opts: [
    { text: "Dados, cenários, longo prazo.",       dim: "aguia" },
    { text: "Consenso do time, protejo os meus.",  dim: "lobo" },
    { text: "Intuição e leitura do momento.",      dim: "gato" },
    { text: "Rápido e direto, sem hesitar.",       dim: "tubarao" },
  ]},
  { id: "b5", label: "Sou reconhecido(a) por…", opts: [
    { text: "Visão de alto.",                      dim: "aguia" },
    { text: "Liderança de grupo.",                 dim: "lobo" },
    { text: "Criatividade e independência.",       dim: "gato" },
    { text: "Foco em resultado e velocidade.",     dim: "tubarao" },
  ]},
  { id: "b6", label: "Minha maior fragilidade é…", opts: [
    { text: "Ficar preso na análise.",             dim: "aguia" },
    { text: "Exigir demais do time.",              dim: "lobo" },
    { text: "Fugir quando prende demais.",         dim: "gato" },
    { text: "Passar por cima de gente.",           dim: "tubarao" },
  ]},
  { id: "b7", label: "Prefiro trabalhar…", opts: [
    { text: "Com espaço mental para pensar.",      dim: "aguia" },
    { text: "Comandando grupo alinhado.",          dim: "lobo" },
    { text: "Sozinho(a) e no meu ritmo.",          dim: "gato" },
    { text: "Em ambiente com placar visível.",     dim: "tubarao" },
  ]},
  { id: "b8", label: "Se pudesse mudar uma coisa em mim…", opts: [
    { text: "Agir mais rápido.",                   dim: "aguia" },
    { text: "Ser menos protetor(a).",              dim: "lobo" },
    { text: "Comprometer-me mais com longo prazo.", dim: "gato" },
    { text: "Escutar antes de reagir.",            dim: "tubarao" },
  ]},
];

const CEREBRAL_LABEL: Record<CerebralMode, string> = {
  aguia: "Águia — visão de alto",
  lobo: "Lobo — liderança de grupo",
  gato: "Gato — criativo independente",
  tubarao: "Tubarão — foco em resultado",
};

function AssessmentWizard() {
  const { orgId } = useCurrentOrg();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const search = Route.useSearch();
  const stepParam: unknown = search.step;
  const showResults = !!search.showResults && !search.reset;
  
  // Se houver um step parametrizado, o modo é "individual" (não sequencial)
  const isIndividualMode = !!stepParam;
  const requestedStep: number = isAssessmentStepKey(stepParam) ? STEP_INDEX[stepParam] : 0;
  const { data, isLoading } = useQuery({
    queryKey: ["consciencia", "me", orgId],
    enabled: !!orgId,
    queryFn: () => api<Me>(`/organization/${orgId}/consciencia/me`),
  });

  const initial = data?.profile ?? null;
  const [step, setStep] = useState<number>(() => requestedStep);
  const [declaredRole, setDeclaredRole] = useState("");
  const [notMine, setNotMine] = useState("");
  const [discPrimary, setDiscPrimary] = useState<DiscPrimary | null>(null);
  const [discSecondary, setDiscSecondary] = useState<DiscPrimary | null>(null);
  const [mbtiType, setMbtiType] = useState("");
  const [riskFlags, setRiskFlags] = useState<string[]>([]);
  const [sabAns, setSabAns] = useState<Record<string, number>>({});
  const [cerAns, setCerAns] = useState<Record<string, CerebralMode>>({});
  const [hard, setHard] = useState<number[]>([]);
  const [soft, setSoft] = useState<number[]>([]);
  const [heart, setHeart] = useState<number[]>([]);
  const [blockedMessage, setBlockedMessage] = useState<string | null>(null);
  const [sabotageBlockIndex, setSabotageBlockIndex] = useState(0);
  const [isResetting, setIsResetting] = useState(false);

  const clearAllStates = () => {
    setIsResetting(true);
    
    // Só limpamos o estado que o usuário realmente quer refazer (baseado no stepParam)
    // Se não houver stepParam (fluxo completo), limpamos tudo.
    if (!stepParam) {
      setDeclaredRole("");
      setNotMine("");
      setDiscPrimary(null);
      setDiscSecondary(null);
      setMbtiType("");
      setRiskFlags([]);
      setSabAns({});
      setCerAns({});
      setHard([]);
      setSoft([]);
      setHeart([]);
    } else {
      // Limpeza seletiva para o modo individual baseada no stepParam
      if (stepParam === "papel") {
        setDeclaredRole("");
        setNotMine("");
      } else if (stepParam === "behavioral") {
        setDiscPrimary(null);
        setDiscSecondary(null);
        setMbtiType("");
      } else if (stepParam === "sabotages") {
        setSabAns({});
        setSabotageBlockIndex(0);
      } else if (stepParam === "cerebral") {
        setCerAns({});
      } else if (stepParam === "hsh") {
        setHard([]);
        setSoft([]);
        setHeart([]);
      }
    }
    
    setBlockedMessage(null);
    
    // IMPORTANTE: Não removemos o draft inteiro se estivermos no modo individual,
    // apenas atualizamos ele no próximo ciclo de useEffect do auto-save.
    if (orgId && !stepParam) {
      localStorage.removeItem(`assessment_draft_${orgId}`);
    }
    
    setTimeout(() => setIsResetting(false), 500);
  };

  // Salvamento automático: persiste estado local a cada mudança
  useEffect(() => {
    if (!orgId || isResetting || search.reset) return;
    const state = {
      declaredRole,
      notMine,
      discPrimary,
      discSecondary,
      mbtiType,
      riskFlags,
      sabAns,
      cerAns,
      hard,
      soft,
      heart,
      step,
      sabotageBlockIndex
    };
    localStorage.setItem(`assessment_draft_${orgId}`, JSON.stringify(state));
  }, [orgId, declaredRole, notMine, discPrimary, discSecondary, mbtiType, riskFlags, sabAns, cerAns, hard, soft, heart, step, sabotageBlockIndex, isResetting, search.reset]);

  useEffect(() => {
    if (!orgId) return;

    // Se reset for true, limpamos tudo e ignoramos o draft
    if (search.reset) {
      clearAllStates();
      if (requestedStep !== 0) {
        setStep(requestedStep);
      }
      return;
    }

    const draft = localStorage.getItem(`assessment_draft_${orgId}`);
    if (draft) {
      try {
        const s = JSON.parse(draft);
        
        // Se estamos em modo reset individual, não carregamos o estado do rascunho para aquele step
        const isResetStep = (key: string) => search.reset && stepParam === key;

        if (s.declaredRole && !isResetStep("papel")) setDeclaredRole(s.declaredRole);
        if (s.notMine && !isResetStep("papel")) setNotMine(s.notMine);
        if (s.discPrimary && !isResetStep("behavioral")) setDiscPrimary(s.discPrimary);
        if (s.discSecondary && !isResetStep("behavioral")) setDiscSecondary(s.discSecondary);
        if (s.mbtiType && !isResetStep("behavioral")) setMbtiType(s.mbtiType);
        if (s.riskFlags) setRiskFlags(s.riskFlags);
        if (s.sabAns && !isResetStep("sabotages")) setSabAns(sanitizeSabotageAnswers(s.sabAns));
        if (s.cerAns && !isResetStep("cerebral")) setCerAns(s.cerAns);
        if (s.hard && !isResetStep("hsh")) setHard(s.hard);
        if (s.soft && !isResetStep("hsh")) setSoft(s.soft);
        if (s.heart && !isResetStep("hsh")) setHeart(s.heart);
        if (s.sabotageBlockIndex !== undefined) setSabotageBlockIndex(s.sabotageBlockIndex);
        
        if (requestedStep !== 0) {
          setStep(requestedStep);
        } else if (s.step !== undefined) {
          setStep(s.step);
        }
      } catch (e) {
        console.error("Erro ao carregar draft", e);
      }
    } else if (requestedStep !== 0) {
      setStep(requestedStep);
    }
  }, [orgId, requestedStep, search.reset, stepParam]);

  // hidrata quando dados chegam
  useEffect(() => {
    // Se reset for true, ignoramos hidratação inicial para começar limpo (apenas para o que foi resetado)
    // No modo individual, se estivermos resetando, não carregamos do perfil os dados daquele step.
    if (search.reset && isIndividualMode) return;
    if (search.reset && !isIndividualMode) return; // Reset total
    
    // Se o usuário já concluiu ou se estamos visualizando resultados, hidratamos do perfil.
    if (!initial) return;

    // Hidratamos tudo, o draft local cuidará de manter o que o usuário já mexeu nesta sessão
    if (!declaredRole) setDeclaredRole(initial.declaredRole ?? "");
    if (!notMine) setNotMine(initial.notMine ?? "");
    if (!discPrimary) setDiscPrimary(initial.discPrimary ?? null);
    if (!discSecondary) setDiscSecondary(initial.discSecondary ?? null);
    if (!mbtiType) setMbtiType(initial.mbtiType ?? "");
    if (riskFlags.length === 0) setRiskFlags(initial.riskFlags ?? []);

    // Respostas item a item (50 itens) não são reconstruídas a partir dos scores:
    // o resultado consolidado já é exibido na tela de resultados.

    // Hidrata HSH se o estado local estiver vazio
    if (initial.hardAnswers && hard.length === 0) setHard(initial.hardAnswers as number[]);
    if (initial.softAnswers && soft.length === 0) setSoft(initial.softAnswers as number[]);
    if (initial.heartAnswers && heart.length === 0) setHeart(initial.heartAnswers as number[]);
  }, [initial, requestedStep, search.reset, isIndividualMode]);

  // Como as questões são respondidas de 1 a 5, subtraímos 1 para alinhar com a escala 0-4 do PDF
  const calculateIpm = (arr: number[]) => {
    if (arr.length === 0) return 0;
    const sum = arr.reduce((s, v) => s + (v - 1), 0);
    return Math.round((sum / (arr.length * 4)) * 100);
  };
  
  const hardScore = calculateIpm(hard);
  const softScore = calculateIpm(soft);
  const heartScore = calculateIpm(heart);

  // Apuração oficial: soma dos 5 itens de cada padrão, normalizada da escala 1..4 para 0..100%.
  const sabotagemResult = useMemo(() => {
    const numeric: Record<number, number> = {};
    for (const [key, value] of Object.entries(sabAns)) {
      const n = Number(key);
      const normalized = normalizeSabotagemAnswer(value);
      if (Number.isFinite(n) && normalized != null) numeric[n] = normalized;
    }
    return scoreSabotagem(numeric);
  }, [sabAns]);
  const sabotageScores = sabotagemResult.scores;
  const topSabotages = sabotagemResult.top3;
  const cerebralProfile = useMemo(() => {
    const counts = { aguia: 0, lobo: 0, gato: 0, tubarao: 0 } as Record<CerebralMode, number>;
    for (const b of CEREBRAL) {
      const c = cerAns[b.id];
      if (c) counts[c] += 1;
    }
    const total = counts.aguia + counts.lobo + counts.gato + counts.tubarao || 1;
    const pct: Record<CerebralMode, number> = {
      aguia: Math.round((counts.aguia / total) * 100),
      lobo: Math.round((counts.lobo / total) * 100),
      gato: Math.round((counts.gato / total) * 100),
      tubarao: Math.round((counts.tubarao / total) * 100),
    };
    const primary = (Object.keys(pct) as CerebralMode[]).sort((a, b) => pct[b] - pct[a])[0];
    return { pct, primary };
  }, [cerAns]);

  const save = useMutation({
    mutationFn: () =>
      api(`/organization/${orgId}/consciencia/me`, {
        method: "PUT",
        body: {
          declaredRole: declaredRole || initial?.declaredRole || null,
          notMine: notMine || initial?.notMine || null,
          discPrimary: discPrimary || initial?.discPrimary || null,
          discSecondary: discSecondary || initial?.discSecondary || null,
          discProfile:
            (discPrimary || initial?.discPrimary)
              ? {
                  kind: "disc_profile",
                  primary: discPrimary || initial?.discPrimary || null,
                  secondary: discSecondary || initial?.discSecondary || null,
                  manual: true,
                }
              : null,
          mbtiType: (mbtiType || initial?.mbtiType || "").toUpperCase() || null,
          assessmentType: "disc",
          sabotages: topSabotages.length > 0 ? topSabotages : initial?.sabotages || [],
          sabotageScores: Object.keys(sabotageScores).length > 0 ? sabotageScores : initial?.sabotageScores || {},
          cerebralProfile: cerebralProfile.pct.aguia + cerebralProfile.pct.lobo + cerebralProfile.pct.gato + cerebralProfile.pct.tubarao > 0 
            ? cerebralProfile.pct 
            : (initial as any)?.cerebralProfile || {},
          cerebralPrimary: cerebralProfile.primary || (initial as any)?.cerebralPrimary || null,
          hardAnswers: hard.length > 0 ? hard : initial?.hardAnswers || [],
          softAnswers: soft.length > 0 ? soft : initial?.softAnswers || [],
          heartAnswers: heart.length > 0 ? heart : initial?.heartAnswers || [],
          riskFlags: riskFlags.length > 0 ? riskFlags : initial?.riskFlags || [],
          hardSelfScore: hard.length > 0 ? hardScore : initial?.hardSelfScore || 0,
          softSelfScore: soft.length > 0 ? softScore : initial?.softSelfScore || 0,
          heartSelfScore: heart.length > 0 ? heartScore : initial?.heartSelfScore || 0,
          markAssessedNow: true,
        },
      }),
    onSuccess: async (data: any) => {
      localStorage.removeItem(`assessment_draft_${orgId}`);
      await queryClient.invalidateQueries({ queryKey: ["consciencia", "me", orgId] });
      toast.success("Assessment oficial concluído.");
      // Redireciona para os resultados dentro do assessment com o parâmetro showResults
      if (isIndividualMode) {
        navigate({ to: "/app/consciencia" });
      } else {
        navigate({ 
          to: "/app/consciencia/assessment", 
          search: { step: stepParam as any, showResults: true, reset: false } 
        });
      }
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao salvar"),
  });

  if (!orgId) return null;
  if (isLoading) return <div className="mx-auto max-w-3xl p-6 text-sm text-muted-foreground"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />Carregando…</div>;

  const steps = [
    { key: "papel", title: "Papel",      hint: "Pra que sua liderança existe." },
    { key: "behavioral", title: "Perfil Comportamental", hint: "Defina seu estilo principal e sua secundária." },
    { key: "sabotages", title: "Sabotadores de Performance", hint: "Padrões automáticos que travam sua performance sob pressão." },
    { key: "cerebral", title: "Predominância cerebral", hint: "Águia · Lobo · Gato · Tubarão." },
    { key: "risks", title: "Análise de Riscos",              hint: "Padrões que aparecem sob pressão." },
    { key: "hsh", title: "Radar de Autogestão (IPM)", hint: "Sua potência mental e capacidade de resposta." },
  ];
  const canNext = () => {
    if (step === 0) return declaredRole.trim().length > 3;
    if (step === 1) return !!discPrimary && !!discSecondary && discPrimary !== discSecondary;
    if (step === 2) return Object.keys(sabAns).length >= SABOTAGEM_TOTAL;
    if (step === 3) return Object.keys(cerAns).length >= 8;
    if (step === 5) return hard.length >= 10 && soft.length >= 10 && heart.length >= 10;
    return true;
  };
  const sabAnswered = Object.values(sabAns).filter((value) => normalizeSabotagemAnswer(value) != null).length;
  const cerAnswered = Object.keys(cerAns).length;
  const nextBlockedMessage = () => {
    if (step === 0) return "Escreva seu papel declarado para continuar.";
    if (step === 1) return "Selecione dois estilos DISC diferentes, definindo principal e secundária.";
    if (step === 2) return `Responda todas as ${SABOTAGEM_TOTAL} afirmações para continuar. Faltam ${Math.max(0, SABOTAGEM_TOTAL - sabAnswered)}.`;
    if (step === 3) return `Responda todas as 8 afirmações para continuar. Faltam ${Math.max(0, 8 - cerAnswered)}.`;
    if (step === 5) return "Responda todas as 30 afirmações do radar para concluir.";
    return "Complete esta etapa para continuar.";
  };
  const goNext = async () => {
    if (!canNext()) {
      const message = nextBlockedMessage();
      setBlockedMessage(message);
      toast.warning(message);
      return;
    }
    setBlockedMessage(null);

    // Se estivermos no modo individual ou for a última etapa, salvamos antes de prosseguir
    if (isIndividualMode || step === steps.length - 1) {
      try {
        await save.mutateAsync();
        // O redirecionamento já acontece no onSuccess do save
      } catch (err) {
        // Erro já tratado no onError do mutation
        return;
      }
      return;
    }

    setStep((s: number) => Math.min(steps.length - 1, s + 1));
  };
  const toggle = (arr: string[], v: string, set: (a: string[]) => void) =>
    set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-20">
      {showResults && (
        <section className="mb-6 rounded-2xl border-2 border-accent bg-accent/5 p-6 shadow-xl animate-in fade-in zoom-in duration-300">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-full bg-accent text-white">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div>
              <h2 className="font-display text-2xl font-bold">Resultado Identificado</h2>
              <p className="text-sm text-muted-foreground">O sistema já possui suas respostas salvas.</p>
            </div>
          </div>
          
          <div className="mt-6 space-y-4">
            {stepParam === "papel" && (
              <div className="rounded-xl bg-card p-4 border border-border">
                <div className="text-xs font-semibold uppercase tracking-wider text-accent">Seu Papel Declarado</div>
                <div className="mt-1 text-xl font-bold font-display">{initial?.declaredRole ?? "Não preenchido"}</div>
                {initial?.notMine && (
                  <>
                    <div className="mt-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">O que NÃO é meu papel</div>
                    <p className="mt-1 text-sm text-muted-foreground italic">"{initial.notMine}"</p>
                  </>
                )}
              </div>
            )}
            
            {stepParam === "behavioral" && (
              <div className="rounded-xl bg-card p-4 border border-border">
                <div className="text-xs font-semibold uppercase tracking-wider text-accent">Seus Estilos DISC</div>
                <div className="mt-1 text-3xl font-bold font-display">
                  {formatDiscSummary(initial?.discPrimary, initial?.discSecondary)
                    ? `DISC ${formatDiscSummary(initial?.discPrimary, initial?.discSecondary)}`
                    : "Não identificado"}
                </div>
                {initial?.discPrimary && (
                  <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                    <p>
                      <strong className="text-foreground">Principal:</strong>{" "}
                      {DISC.find(d => d.key === initial.discPrimary)?.title}
                    </p>
                    {initial?.discSecondary && (
                      <p>
                        <strong className="text-foreground">Secundária:</strong>{" "}
                        {DISC.find(d => d.key === initial.discSecondary)?.title}
                      </p>
                    )}
                    <p>{DISC.find(d => d.key === initial.discPrimary)?.desc}</p>
                  </div>
                )}
              </div>
            )}
            
            {stepParam === "sabotages" && (
              <div className="space-y-3 rounded-xl bg-card p-4 border border-border">
                <div className="text-xs font-semibold uppercase tracking-wider text-accent">Seus 3 Sabotadores Prioritários</div>
                <div className="flex flex-wrap gap-2">
                  {initial?.sabotages?.map(s => (
                    <span key={s} className="rounded-full bg-accent/10 px-3 py-1 text-sm font-bold text-accent border border-accent/20">{s}</span>
                  ))}
                </div>
                <div className="space-y-2">
                  {SABOTAGEM_PATTERNS.map((p) => {
                    const value = (initial?.sabotageScores as Record<string, number> | null | undefined)?.[p.id];
                    if (typeof value !== "number") return null;
                    return (
                      <div key={p.id} className="flex items-center gap-3 text-xs">
                        <span className="w-32 shrink-0 font-medium">{p.id}</span>
                        <div className="h-1.5 flex-1 rounded-full bg-border">
                          <div className="h-full rounded-full bg-accent" style={{ width: `${value}%` }} />
                        </div>
                        <span className="w-24 shrink-0 text-right text-muted-foreground">{value}% · {sabotagemBand(value).band}</span>
                      </div>
                    );
                  })}
                </div>
                {(initial?.sabotages ?? []).slice(0, 3).map((s) => {
                  const p = sabotagemPattern(s);
                  if (!p) return null;
                  return (
                    <div key={s} className="rounded-lg border border-border/60 bg-secondary/30 p-3 text-xs">
                      <div className="font-display text-sm font-bold">{p.id}</div>
                      <p className="mt-1"><span className="font-semibold">Mecanismo:</span> {p.mechanism}</p>
                      <p><span className="font-semibold">Potência quando regulado:</span> {p.strength}</p>
                      <p><span className="font-semibold">Custo quando dominante:</span> {p.cost}</p>
                      <p className="mt-1 italic text-muted-foreground">{p.question}</p>
                    </div>
                  );
                })}
                <p className="text-[11px] text-muted-foreground">
                  Leitura responsável: priorize os três padrões mais altos e trate diferenças de até 10 pontos como empate técnico.
                </p>
              </div>
            )}
            
            {stepParam === "hsh" && (
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl bg-card p-3 border border-border text-center">
                  <div className="text-[10px] font-bold uppercase text-primary">Autopercepção</div>
                  <div className="text-xl font-bold">{initial?.hardSelfScore ?? "—"}%</div>
                </div>
                <div className="rounded-xl bg-card p-3 border border-border text-center">
                  <div className="text-[10px] font-bold uppercase text-accent">Autorregulação</div>
                  <div className="text-xl font-bold">{initial?.softSelfScore ?? "—"}%</div>
                </div>
                <div className="rounded-xl bg-card p-3 border border-border text-center">
                  <div className="text-[10px] font-bold uppercase text-success">Escolha</div>
                  <div className="text-xl font-bold">{initial?.heartSelfScore ?? "—"}%</div>
                </div>
              </div>
            )}
          </div>

          <div className="mt-8 flex gap-3">
            <Button className="flex-1" onClick={() => navigate({ to: "/app/consciencia" })}>
              Voltar para a Jornada
            </Button>
            <Button variant="outline" className="flex-1" onClick={() => {
              clearAllStates();
              // Navegamos com a flag reset=true para forçar o reinício
              navigate({ 
                to: "/app/consciencia/assessment", 
                search: { step: stepParam as any, showResults: false, reset: true } 
              });
            }}>
              Refazer Avaliação
            </Button>
          </div>
        </section>
      )}

      {!showResults && (
        <>
      <header className="flex items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Módulo C · Assessment guiado</div>
          <h1 className="mt-2 font-display text-3xl leading-tight">{steps[step].title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{steps[step].hint}</p>
        </div>
        {isIndividualMode && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate({ to: "/app/consciencia" })}
            className="h-8 gap-1.5 px-3 text-muted-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Sair
          </Button>
        )}
      </header>

      {!isIndividualMode && (
        <div className="mt-4 flex items-center gap-1.5">
          {steps.map((_, i) => (
            <div key={i} className={"h-1.5 flex-1 rounded-full " + (i <= step ? "bg-primary" : "bg-border")} />
          ))}
        </div>
      )}

      <section className="rounded-2xl border border-border bg-card p-6">
        {blockedMessage && (
          <div className="mb-4 rounded-xl border border-accent/30 bg-accent/10 px-4 py-3 text-sm font-medium text-foreground">
            {blockedMessage}
          </div>
        )}
        {step === 0 && (
          <div className="space-y-4">
            <div>
              <Label>Papel declarado *</Label>
              <Input value={declaredRole} onChange={(e) => setDeclaredRole(e.target.value)} placeholder="Ex.: líder integrador que forma gente e entrega resultado" />
            </div>
            <div>
              <Label>O que NÃO é meu papel</Label>
              <Textarea rows={3} value={notMine} onChange={(e) => setNotMine(e.target.value)} placeholder="Ex.: executar tarefas técnicas do time; ser bombeiro de conflitos entre pares." />
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-5">
            <div>
              <Label>Perfil DISC principal *</Label>
              <p className="mt-1 text-xs text-muted-foreground">
                Não sabe o seu?{" "}
                <button
                  type="button"
                  className="font-semibold text-accent underline"
                  onClick={() => navigate({ to: "/app/consciencia/disc" })}
                >
                  Faça (ou refaça) o teste DISC completo de 20 questões
                </button>
                .
              </p>
              <div className="mt-2 grid gap-2 md:grid-cols-2">
                {DISC.map((d) => (
                  <button
                    type="button"
                    key={d.key}
                    onClick={() => {
                      setDiscPrimary(d.key);
                      if (discSecondary === d.key) setDiscSecondary(null);
                    }}
                    className={
                      "rounded-xl border p-3 text-left transition-colors " +
                      (discPrimary === d.key
                        ? "border-primary bg-primary/10"
                        : "border-border hover:bg-secondary/60")
                    }
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-display text-lg">{d.title}</div>
                      <span className="rounded-full border border-border px-1.5 text-xs font-mono">{d.key}</span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{d.desc}</p>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label>Perfil DISC secundário *</Label>
              <p className="mt-1 text-xs text-muted-foreground">
                Escolha a segunda predominância. Ela precisa ser diferente da principal.
              </p>
              <div className="mt-2 grid gap-2 md:grid-cols-2">
                {DISC.map((d) => {
                  const disabled = discPrimary === d.key;
                  return (
                    <button
                      type="button"
                      key={`secondary-${d.key}`}
                      disabled={disabled}
                      onClick={() => setDiscSecondary(d.key)}
                      className={
                        "rounded-xl border p-3 text-left transition-colors " +
                        (discSecondary === d.key
                          ? "border-primary bg-primary/10"
                          : disabled
                            ? "cursor-not-allowed border-border bg-secondary/30 text-muted-foreground opacity-60"
                            : "border-border hover:bg-secondary/60")
                      }
                    >
                      <div className="flex items-center justify-between">
                        <div className="font-display text-lg">{d.title}</div>
                        <span className="rounded-full border border-border px-1.5 text-xs font-mono">{d.key}</span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{d.desc}</p>
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <Label>MBTI (opcional)</Label>
              <Input value={mbtiType} onChange={(e) => setMbtiType(e.target.value.toUpperCase().slice(0, 4))} placeholder="Ex.: ENTJ" maxLength={4} />
              <p className="mt-1 text-xs text-muted-foreground">4 letras. Se não sabe, deixe em branco.</p>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{SABOTAGEM_HELP}</p>
            <div className="grid grid-cols-2 gap-1.5 rounded-xl border border-border bg-secondary/40 p-2 text-center text-[9px] font-semibold uppercase tracking-wide text-muted-foreground sm:grid-cols-4 sm:text-[10px]">
              {SABOTAGEM_SCALE.map((s) => (
                <div key={s.value} className="rounded-lg bg-background/50 px-2 py-1.5 leading-tight">
                  <div className="text-sm font-bold text-foreground">{s.value}</div>
                  <div className="mt-0.5 break-words normal-case">{s.label}</div>
                </div>
              ))}
            </div>
            <div className="rounded-xl border border-accent/25 bg-accent/5 px-3 py-2 text-xs font-medium text-foreground">
              Respondidas: {sabAnswered}/{SABOTAGEM_TOTAL}.
            </div>
            {SABOTAGEM_BLOCKS.map((block, bIdx) => {
              if (bIdx !== sabotageBlockIndex) return null;
              
              return (
                <div key={block.title} className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                  <div className="flex items-center justify-between">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent">{block.title}</div>
                    <div className="text-[10px] font-medium text-muted-foreground">Bloco {bIdx + 1} de {SABOTAGEM_BLOCKS.length}</div>
                  </div>
                  
                  <ul className="space-y-3">
                    {SABOTAGEM_ITEMS.slice(block.from - 1, block.to).map((prompt, idx) => {
                      const num = block.from + idx;
                      return (
                        <li key={num} className="rounded-xl border border-border/60 p-3">
                          <div className="text-sm">
                            <span className="mr-2 font-mono text-xs text-muted-foreground">{num}.</span>
                            {prompt}
                          </div>
                          <div className="mt-2 flex gap-1.5">
                            {SABOTAGEM_SCALE.map((s) => (
                              <button
                                type="button"
                                key={s.value}
                                onClick={() => {
                                  setBlockedMessage(null);
                                  setSabAns((prev) => ({ ...prev, [String(num)]: s.value }));
                                }}
                                className={
                                  "h-9 flex-1 rounded-lg border text-sm transition-colors " +
                                  (normalizeSabotagemAnswer(sabAns[String(num)]) === s.value
                                    ? "border-primary bg-primary text-primary-foreground"
                                    : "border-border bg-card hover:bg-secondary")
                                }
                              >
                                {s.value}
                              </button>
                            ))}
                          </div>
                        </li>
                      );
                    })}
                  </ul>

                  <div className="flex gap-3 pt-2">
                    {sabotageBlockIndex > 0 && (
                      <Button 
                        variant="outline" 
                        className="flex-1 gap-2" 
                        onClick={() => setSabotageBlockIndex(i => i - 1)}
                      >
                        <ArrowLeft className="h-4 w-4" /> Bloco anterior
                      </Button>
                    )}
                    
                    {sabotageBlockIndex < SABOTAGEM_BLOCKS.length - 1 && (
                      <Button 
                        className="flex-1 gap-2" 
                        disabled={!SABOTAGEM_ITEMS.slice(block.from - 1, block.to).every((_, i) => {
                          const answer = sabAns[String(block.from + i)];
                          return normalizeSabotagemAnswer(answer) != null;
                        })}
                        onClick={() => setSabotageBlockIndex(i => i + 1)}
                      >
                        Próximo bloco <ArrowRight className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
            {/* Apuração parcial removida a pedido para não influenciar respostas */}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Em cada bloco, escolha a frase que MAIS te representa hoje.</p>
            <div className="rounded-xl border border-accent/25 bg-accent/5 px-3 py-2 text-xs font-medium text-foreground">
              Respondidas: {cerAnswered}/8.
            </div>
            <ul className="space-y-4">
              {CEREBRAL.map((b) => (
                <li key={b.id} className="rounded-xl border border-border/60 p-3">
                  <div className="text-sm font-medium">{b.label}</div>
                  <div className="mt-2 grid gap-2 md:grid-cols-2">
                    {b.opts.map((o) => (
                      <button
                        type="button"
                        key={o.dim}
                        onClick={() => {
                          setBlockedMessage(null);
                          setCerAns((prev) => ({ ...prev, [b.id]: o.dim }));
                        }}
                        className={
                          "rounded-lg border p-2.5 text-left text-sm transition-colors " +
                          (cerAns[b.id] === o.dim
                            ? "border-primary bg-primary/10"
                            : "border-border hover:bg-secondary/60")
                        }>
                        <div className="mt-0.5">{o.text}</div>
                      </button>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
            {/* Predominância parcial removida a pedido */}
          </div>
        )}

        {step === 4 && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Padrões que aparecem quando a pressão sobe.</p>
            <div className="grid gap-2 md:grid-cols-2">
              {RISKS.map((r) => {
                const on = riskFlags.includes(r.value);
                return (
                  <button
                    type="button"
                    key={r.value}
                    onClick={() => toggle(riskFlags, r.value, setRiskFlags)}
                    className={
                      "flex flex-col gap-2 rounded-xl border p-4 text-left transition-all " +
                      (on ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "border-border hover:bg-secondary/60")
                    }
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-foreground">{r.label}</span>
                      {on && <CheckCircle2 className="h-4 w-4 text-primary" />}
                    </div>
                    {on && (
                      <div className="mt-1 space-y-2 text-[11px] animate-in fade-in slide-in-from-top-1 duration-200">
                        <div className="flex gap-2">
                          <span className="font-bold text-accent uppercase tracking-tighter">Origem:</span>
                          <span className="text-muted-foreground">{(r as any).origin}</span>
                        </div>
                        <div className="flex gap-2">
                          <span className="font-bold text-accent uppercase tracking-tighter">Intensidade:</span>
                          <span className="text-muted-foreground">{(r as any).intensity}</span>
                        </div>
                        <div className="mt-2 text-muted-foreground leading-relaxed italic border-l-2 border-accent/20 pl-2">
                          {(r as any).meaning}
                        </div>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-6">
            <p className="text-sm text-muted-foreground">30 afirmações oficiais — 10 por dimensão. O IPM mede sua capacidade de resposta consciente vs padrão automático.</p>
            <HshBlock title="Autopercepção (Hard)" color="bg-primary" values={hard} setValues={setHard} questions={HSH_QUESTIONS.hard} />
            <HshBlock title="Autorregulação (Soft)"  color="bg-accent"  values={soft} setValues={setSoft} questions={HSH_QUESTIONS.soft} />
            <HshBlock title="Escolha Consciente (Heart)"  color="bg-success" values={heart} setValues={setHeart} questions={HSH_QUESTIONS.heart} />
            {/* Resultado inicial removido a pedido */}
          </div>
        )}
      </section>

      <footer className="flex items-center justify-between">
        <Button
          type="button"
          variant="ghost"
          disabled={step === 0 || (isIndividualMode && step === requestedStep)}
          onClick={() => setStep((s: number) => Math.max(0, s - 1))}
          className="gap-1.5"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Button>
        {step < steps.length - 1 ? (
          <Button type="button" onClick={goNext} className="gap-1.5">
            Próximo <ArrowRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button type="button" disabled={save.isPending} onClick={goNext} className="gap-2">
            {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Concluir
          </Button>
        )}
      </footer>
      </>
      )}
    </div>
  );
}

function HshBlock({
  title, color, values, setValues, questions,
}: { title: string; color: string; values: number[]; setValues: (v: number[]) => void; questions: string[] }) {
  return (
    <div className="rounded-xl border border-border/60 p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className={"h-2.5 w-2.5 rounded-full " + color} />
        <div className="font-display text-lg">{title}</div>
      </div>
      <ul className="space-y-3">
        {questions.map((q, i) => (
          <li key={i}>
            <div className="text-sm">{q}</div>
            <div className="mt-2.5 flex flex-col gap-3">
              <div className="flex gap-1.5">
                {[1, 2, 3, 4, 5].map((v) => (
                  <button
                    type="button"
                    key={v}
                    onClick={() => {
                      const newArr = [...values];
                      // Garante que o array tenha o tamanho correto
                      while (newArr.length <= i) newArr.push(0);
                      newArr[i] = v;
                      setValues(newArr);
                    }}
                    className={
                      "h-10 flex-1 rounded-lg border text-sm font-medium transition-all focus:ring-2 focus:ring-primary/40 focus:outline-none " +
                      (values[i] === v
                        ? "border-primary bg-primary text-primary-foreground shadow-sm scale-[1.02]"
                        : "border-border bg-card hover:bg-secondary active:scale-[0.98]")
                    }
                    aria-label={`Avaliação ${v} de 5`}
                    aria-pressed={values[i] === v}
                  >
                    {v}
                  </button>
                ))}
              </div>
              <div className="flex justify-between px-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">
                <span>Discordo</span>
                <span>Neutro</span>
                <span>Concordo</span>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ResultTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-background p-3">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="mt-1 font-display text-2xl">{value}<span className="text-sm text-muted-foreground">/100</span></div>
    </div>
  );
}
