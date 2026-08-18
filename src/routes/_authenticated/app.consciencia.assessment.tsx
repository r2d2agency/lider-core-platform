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

type AssessmentStepKey = "behavioral" | "sabotages" | "hsh";

const STEP_INDEX: Record<AssessmentStepKey, number> = {
  behavioral: 1,
  sabotages: 2,
  hsh: 5,
};

function isAssessmentStepKey(value: unknown): value is AssessmentStepKey {
  return value === "behavioral" || value === "sabotages" || value === "hsh";
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
      { name: "description", content: "Complete seu perfil comportamental, limitadores e radar Hard Soft Heart." },
      { property: "og:title", content: "Assessment guiado · Consciência · LíderCore" },
      { property: "og:description", content: "Complete seu perfil comportamental, limitadores e radar Hard Soft Heart." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type DiscPrimary = "D" | "I" | "S" | "C";
type CerebralMode = "aguia" | "lobo" | "gato" | "tubarao";
type Profile = {
  declaredRole: string | null; notMine: string | null;
  discPrimary: DiscPrimary | null; mbtiType: string | null;
  sabotages: string[]; riskFlags: string[];
  hardSelfScore: number | null; softSelfScore: number | null; heartSelfScore: number | null;
  strengths: string[]; notes: string | null; communicationStyle: string | null;
  assessmentType: "disc" | "big_five" | "other" | null;
  sabotageScores?: Record<string, number> | null;
};
type Me = { profile: Profile | null };

const DISC = [
  { key: "D" as const, title: "Dominante",  desc: "Direto, decidido, orientado a resultado." },
  { key: "I" as const, title: "Influente",  desc: "Comunicativo, entusiasta, mobiliza pessoas." },
  { key: "S" as const, title: "Estável",    desc: "Cooperativo, paciente, mantém o time unido." },
  { key: "C" as const, title: "Cauteloso",  desc: "Analítico, metódico, valoriza precisão." },
];

// 10 pilares oficiais (Radar de Autogestão e Performance Mental)
const SABOTAGE_PILLARS = [
  { id: "Crítico Interno",     q: "Percebo primeiro o que está errado, mesmo quando o resultado geral é bom." },
  { id: "Controlador",        q: "Fico tenso quando decisões importantes são tomadas sem minha participação." },
  { id: "Perfeccionista",     q: "Adio uma entrega quando acredito que ela ainda não atingiu o padrão ideal." },
  { id: "Agradador",          q: "Digo sim para evitar decepcionar alguém, mesmo quando deveria dizer não." },
  { id: "Hiper-realizador",   q: "Meu valor pessoal fica muito ligado ao que produzo ou conquisto." },
  { id: "Alerta",             q: "Imagino com frequência o que pode dar errado antes de considerar o que pode dar certo." },
  { id: "Esquivo",            q: "Adio conversas difíceis na esperança de que o problema se resolva sozinho." },
  { id: "Vitimia",            q: "Quando me sinto incompreendido, permaneço preso a essa sensação por bastante tempo." },
  { id: "Inquieto",           q: "Perco o interesse quando uma atividade deixa de oferecer novidade ou estímulo." },
  { id: "Hiperanalítico",     q: "Confio mais na lógica do que em sinais emocionais ou relacionais." },
] as const;

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
  const [mbtiType, setMbtiType] = useState("");
  const [riskFlags, setRiskFlags] = useState<string[]>([]);
  const [sabAns, setSabAns] = useState<Record<string, number>>({});
  const [cerAns, setCerAns] = useState<Record<string, CerebralMode>>({});
  const [hard, setHard] = useState<number[]>([]);
  const [soft, setSoft] = useState<number[]>([]);
  const [heart, setHeart] = useState<number[]>([]);
  const [blockedMessage, setBlockedMessage] = useState<string | null>(null);
  const [isResetting, setIsResetting] = useState(false);

  const clearAllStates = () => {
    setIsResetting(true);
    setDeclaredRole("");
    setNotMine("");
    setDiscPrimary(null);
    setMbtiType("");
    setRiskFlags([]);
    setSabAns({});
    setCerAns({});
    setHard([]);
    setSoft([]);
    setHeart([]);
    setBlockedMessage(null);
    if (orgId) {
      localStorage.removeItem(`assessment_draft_${orgId}`);
    }
    // Damos um tempo para os estados serem limpos antes de permitir novo salvamento
    setTimeout(() => setIsResetting(false), 500);
  };

  // Salvamento automático: persiste estado local a cada mudança
  useEffect(() => {
    if (!orgId || isResetting || search.reset) return;
    const state = {
      declaredRole,
      notMine,
      discPrimary,
      mbtiType,
      riskFlags,
      sabAns,
      cerAns,
      hard,
      soft,
      heart,
      step
    };
    localStorage.setItem(`assessment_draft_${orgId}`, JSON.stringify(state));
  }, [orgId, declaredRole, notMine, discPrimary, mbtiType, riskFlags, sabAns, cerAns, hard, soft, heart, step, isResetting, search.reset]);

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
        if (s.declaredRole) setDeclaredRole(s.declaredRole);
        if (s.notMine) setNotMine(s.notMine);
        if (s.discPrimary) setDiscPrimary(s.discPrimary);
        if (s.mbtiType) setMbtiType(s.mbtiType);
        if (s.riskFlags) setRiskFlags(s.riskFlags);
        if (s.sabAns) setSabAns(s.sabAns);
        if (s.cerAns) setCerAns(s.cerAns);
        if (s.hard) setHard(s.hard);
        if (s.soft) setSoft(s.soft);
        if (s.heart) setHeart(s.heart);
        
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
  }, [orgId, requestedStep, search.reset]);

  // hidrata quando dados chegam
  useEffect(() => {
    // Se reset for true, ignoramos hidratação inicial para começar limpo
    if (search.reset) return;
    
    // Se o usuário já concluiu ou se estamos visualizando resultados, hidratamos do perfil.
    if (!initial) return;

    setDeclaredRole(initial.declaredRole ?? "");
    setNotMine(initial.notMine ?? "");
    setDiscPrimary(initial.discPrimary ?? null);
    setMbtiType(initial.mbtiType ?? "");
    setRiskFlags(initial.riskFlags ?? []);

    // Hidrata respostas de sabotadores se existirem
    if (initial.sabotageScores) {
      const scores = initial.sabotageScores as Record<string, number>;
      const answers: Record<string, number> = {};
      Object.entries(scores).forEach(([key, val]) => {
        answers[key] = Math.round(val / 20);
      });
      setSabAns(answers);
    }
  }, [initial, requestedStep]);

  const avg = (arr: number[]) => Math.round((arr.reduce((s, v) => s + v, 0) / (arr.length * 4)) * 100); // 0..4 total → 0..100%
  // Como as questões são respondidas de 1 a 5, subtraímos 1 para alinhar com a escala 0-4 do PDF
  const calculateIpm = (arr: number[]) => {
    if (arr.length === 0) return 0;
    const sum = arr.reduce((s, v) => s + (v - 1), 0);
    return Math.round((sum / (arr.length * 4)) * 100);
  };
  
  const hardScore = calculateIpm(hard);
  const softScore = calculateIpm(soft);
  const heartScore = calculateIpm(heart);

  // Scores derivados
  const sabotageScores: Record<string, number> = useMemo(() => {
    const out: Record<string, number> = {};
    for (const p of SABOTAGE_PILLARS) {
      const v = sabAns[p.id];
      if (typeof v === "number") out[p.id] = v * 20;
    }
    return out;
  }, [sabAns]);
  const topSabotages = useMemo(
    () => Object.entries(sabotageScores).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => k),
    [sabotageScores],
  );
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
          declaredRole: declaredRole || null,
          notMine: notMine || null,
          discPrimary,
          mbtiType: mbtiType.toUpperCase() || null,
          assessmentType: "disc",
          sabotages: topSabotages,
          sabotageScores,
          cerebralProfile: cerebralProfile.pct,
          cerebralPrimary: cerebralProfile.primary,
          hardAnswers: hard,
          softAnswers: soft,
          heartAnswers: heart,
          riskFlags,
          hardSelfScore: hardScore,
          softSelfScore: softScore,
          heartSelfScore: heartScore,
          markAssessedNow: true,
        },
      }),
    onSuccess: async (data: any) => {
      localStorage.removeItem(`assessment_draft_${orgId}`);
      await queryClient.invalidateQueries({ queryKey: ["consciencia", "me", orgId] });
      toast.success("Assessment oficial concluído.");
      // Redireciona para os resultados dentro do assessment com o parâmetro showResults
      navigate({ 
        to: "/app/consciencia/assessment", 
        search: { step: stepParam as any, showResults: true, reset: false } 
      });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao salvar"),
  });

  if (!orgId) return null;
  if (isLoading) return <div className="mx-auto max-w-3xl p-6 text-sm text-muted-foreground"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />Carregando…</div>;

  const steps = [
    { title: "Papel",      hint: "Pra que sua liderança existe." },
    { title: "Perfil",         hint: "DISC · MBTI · Papel." },
    { title: "Limitadores", hint: "Identifique padrões que travam sua execução." },
    { title: "Predominância cerebral", hint: "Águia · Lobo · Gato · Tubarão." },
    { title: "Riscos",              hint: "Padrões que aparecem sob pressão." },
    { title: "Radar de Autogestão (IPM)", hint: "30 afirmações oficiais (10 por dimensão)." },
  ];
  const canNext = () => {
    if (step === 0) return declaredRole.trim().length > 3;
    if (step === 1) return !!discPrimary;
    if (step === 2) return Object.keys(sabAns).length >= 10;
    if (step === 3) return Object.keys(cerAns).length >= 8;
    if (step === 5) return hard.length >= 10 && soft.length >= 10 && heart.length >= 10;
    return true;
  };
  const sabAnswered = Object.keys(sabAns).length;
  const cerAnswered = Object.keys(cerAns).length;
  const nextBlockedMessage = () => {
    if (step === 0) return "Escreva seu papel declarado para continuar.";
    if (step === 1) return "Selecione seu estilo DISC predominante para continuar.";
    if (step === 2) return `Responda todas as 10 afirmações para continuar. Faltam ${Math.max(0, 10 - sabAnswered)}.`;
    if (step === 3) return `Responda todas as 8 afirmações para continuar. Faltam ${Math.max(0, 8 - cerAnswered)}.`;
    if (step === 5) return "Responda todas as 30 afirmações do radar para concluir.";
    return "Complete esta etapa para continuar.";
  };
  const goNext = () => {
    if (!canNext()) {
      const message = nextBlockedMessage();
      setBlockedMessage(message);
      toast.warning(message);
      return;
    }
    setBlockedMessage(null);
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
            {stepParam === "behavioral" && (
              <div className="rounded-xl bg-card p-4 border border-border">
                <div className="text-xs font-semibold uppercase tracking-wider text-accent">Seu Estilo Dominante</div>
                <div className="mt-1 text-3xl font-bold font-display">{initial?.discPrimary ? DISC.find(d => d.key === initial.discPrimary)?.title : "Não identificado"}</div>
                <p className="mt-2 text-sm text-muted-foreground">{initial?.discPrimary ? DISC.find(d => d.key === initial.discPrimary)?.desc : ""}</p>
              </div>
            )}
            
            {stepParam === "sabotages" && (
              <div className="rounded-xl bg-card p-4 border border-border">
                <div className="text-xs font-semibold uppercase tracking-wider text-accent">Seus Principais Limitadores</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {initial?.sabotages?.map(s => (
                    <span key={s} className="rounded-full bg-accent/10 px-3 py-1 text-sm font-bold text-accent border border-accent/20">{s}</span>
                  ))}
                </div>
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
      <header>
        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Módulo C · Assessment guiado</div>
        <h1 className="mt-2 font-display text-3xl leading-tight">{steps[step].title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{steps[step].hint}</p>

        <div className="mt-4 flex items-center gap-1.5">
          {steps.map((_, i) => (
            <div key={i} className={"h-1.5 flex-1 rounded-full " + (i <= step ? "bg-primary" : "bg-border")} />
          ))}
        </div>
      </header>

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
              <Label>Estilo DISC predominante *</Label>
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
                    onClick={() => setDiscPrimary(d.key)}
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
              <Label>MBTI (opcional)</Label>
              <Input value={mbtiType} onChange={(e) => setMbtiType(e.target.value.toUpperCase().slice(0, 4))} placeholder="Ex.: ENTJ" maxLength={4} />
              <p className="mt-1 text-xs text-muted-foreground">4 letras. Se não sabe, deixe em branco.</p>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Para cada afirmação, escolha o quanto ela te descreve (1 = nada · 5 = totalmente).
            </p>
            <div className="rounded-xl border border-accent/25 bg-accent/5 px-3 py-2 text-xs font-medium text-foreground">
              Respondidas: {sabAnswered}/10.
            </div>
            <ul className="space-y-4">
              {SABOTAGE_PILLARS.map((p) => (
                <li key={p.id} className="rounded-xl border border-border/60 p-3">
                  <div className="mb-1 text-xs uppercase tracking-widest text-muted-foreground">{p.id}</div>
                  <div className="text-sm">{p.q}</div>
                  <div className="mt-2 flex gap-1.5">
                    {[1,2,3,4,5].map((v) => (
                    <button
                        type="button"
                        key={v}
                        onClick={() => {
                          setBlockedMessage(null);
                          setSabAns((prev) => ({ ...prev, [p.id]: v }));
                        }}
                        className={
                          "h-9 flex-1 rounded-lg border text-sm transition-colors " +
                          (sabAns[p.id] === v
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-card hover:bg-secondary")
                        }>{v}</button>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
            {topSabotages.length > 0 && (
              <div className="rounded-xl border border-border bg-secondary/40 p-3 text-xs text-muted-foreground">
                Top 3 (parcial): <span className="font-medium text-foreground">{topSabotages.join(" · ")}</span>
              </div>
            )}
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
            {Object.keys(cerAns).length >= 8 && (
              <div className="rounded-xl border border-border bg-secondary/40 p-3">
                <div className="text-xs uppercase tracking-widest text-muted-foreground">Predominância parcial</div>
                <div className="mt-1 font-display text-lg">{CEREBRAL_LABEL[cerebralProfile.primary]}</div>
                <div className="mt-2 grid grid-cols-4 gap-2 text-center text-xs">
                  {(Object.keys(cerebralProfile.pct) as CerebralMode[]).map((k) => (
                    <div key={k}>
                      <div className="text-muted-foreground">{k}</div>
                      <div className="font-mono">{cerebralProfile.pct[k]}%</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
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
            <div className="rounded-xl border border-border bg-secondary/40 p-4">
              <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5" /> Resultado inicial
              </div>
              <div className="mt-2 grid grid-cols-3 gap-3 text-center">
                <ResultTile label="Autopercepção"  value={hardScore} />
                <ResultTile label="Autorregulação"  value={softScore} />
                <ResultTile label="Escolha" value={heartScore} />
              </div>
            </div>
          </div>
        )}
      </section>

      <footer className="flex items-center justify-between">
        <Button type="button" variant="ghost" disabled={step === 0} onClick={() => setStep((s: number) => Math.max(0, s - 1))} className="gap-1.5">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Button>
        {step < steps.length - 1 ? (
          <Button type="button" onClick={goNext} className="gap-1.5">
            Próximo <ArrowRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button type="button" disabled={save.isPending} onClick={() => save.mutate()} className="gap-2">
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