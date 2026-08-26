import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Loader2, RefreshCcw, Sparkles } from "lucide-react";
import { api } from "@/lib/api";
import { useCurrentOrg } from "@/lib/use-current-org";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/app/consciencia/disc")({
  component: DiscTestPage,
  head: () => ({
    meta: [
      { title: "Teste DISC completo · Consciência · LíderCore" },
      {
        name: "description",
        content: "Refaça o teste DISC de 20 questões e atualize seu perfil comportamental.",
      },
      { property: "og:title", content: "Teste DISC completo · LíderCore" },
      {
        property: "og:description",
        content: "Refaça o teste DISC de 20 questões e atualize seu perfil comportamental.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Factor = "D" | "I" | "S" | "C";

const FACTORS: Record<Factor, { name: string; description: string }> = {
  D: { name: "Dominância", description: "Foco em resultado, decisão rápida, desafio e assertividade." },
  I: { name: "Influência", description: "Comunicação, entusiasmo, persuasão e relacionamento." },
  S: { name: "Estabilidade", description: "Constância, paciência, cooperação e apoio ao time." },
  C: { name: "Conformidade", description: "Precisão, análise, regras, qualidade e rigor técnico." },
};

const ITEMS: Array<{ prompt: string; options: Array<{ label: string; factor: Factor }> }> = [
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

const PER_PAGE = 5;

type Profile = {
  discPrimary: Factor | null;
  discSecondary?: Factor | null;
  discProfile: Record<string, unknown> | null;
};

function DiscTestPage() {
  const { orgId } = useCurrentOrg();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [answers, setAnswers] = useState<Record<number, Factor>>({});
  const [page, setPage] = useState(0);
  const [finished, setFinished] = useState(false);

  const { data } = useQuery({
    queryKey: ["consciencia", "me", orgId],
    enabled: !!orgId,
    queryFn: () => api<{ profile: Profile | null }>(`/organization/${orgId}/consciencia/me`),
  });
  const previous = data?.profile?.discPrimary ?? null;

  const totalPages = Math.ceil(ITEMS.length / PER_PAGE);
  const answered = Object.keys(answers).length;

  const result = useMemo(() => {
    const counts: Record<Factor, number> = { D: 0, I: 0, S: 0, C: 0 };
    for (const f of Object.values(answers)) counts[f] += 1;
    const total = answered || 1;
    const ranking = (Object.keys(counts) as Factor[])
      .map((f) => ({
        factor: f,
        name: FACTORS[f].name,
        count: counts[f],
        percent: Math.round((counts[f] / total) * 100),
      }))
      .sort((a, b) => b.count - a.count);
    const primary = ranking[0].count > 0 ? ranking[0].factor : null;
    const secondary = ranking[1] && ranking[1].count > 0 ? ranking[1].factor : null;
    return { counts, ranking, primary, secondary };
  }, [answers, answered]);

  const save = useMutation({
    mutationFn: () =>
      api(`/organization/${orgId}/consciencia/me`, {
        method: "PUT",
        body: {
          assessmentType: "disc",
          discPrimary: result.primary,
          discSecondary: result.secondary,
          discAnswers: Object.fromEntries(
            Object.entries(answers).map(([i, f]) => [`q${Number(i) + 1}`, f]),
          ),
          discProfile: {
            kind: "disc_profile",
            answered,
            counts: result.counts,
            primary: result.primary,
            secondary: result.secondary,
            ranking: result.ranking,
            profile: result.primary
              ? result.secondary
                ? `Perfil ${result.primary}${result.secondary} — ${FACTORS[result.primary].name} com ${FACTORS[result.secondary].name}`
                : `Perfil ${result.primary} — ${FACTORS[result.primary].name}`
              : "Sem perfil identificado",
          },
          markAssessedNow: true,
        },
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["consciencia", "me", orgId] });
      toast.success("Perfil DISC atualizado.");
      navigate({ to: "/app/consciencia" });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao salvar"),
  });

  if (!orgId) return null;

  const start = page * PER_PAGE;
  const pageItems = ITEMS.slice(start, start + PER_PAGE);
  const pageComplete = pageItems.every((_, i) => answers[start + i] != null);

  if (finished) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <header>
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Módulo C · Resultado DISC
          </div>
          <h1 className="mt-2 font-display text-3xl leading-tight">
            {result.primary
              ? result.secondary
                ? `Perfil ${result.primary}${result.secondary}`
                : `Perfil ${result.primary}`
              : "Sem perfil identificado"}
          </h1>
          {result.primary && (
            <div className="mt-3 space-y-1 text-sm text-muted-foreground">
              <p>
                <strong className="text-foreground">Principal:</strong> {result.primary} · {FACTORS[result.primary].name}
              </p>
              {result.secondary && (
                <p>
                  <strong className="text-foreground">Secundária:</strong> {result.secondary} · {FACTORS[result.secondary].name}
                </p>
              )}
              <p>{FACTORS[result.primary].description}</p>
            </div>
          )}
        </header>

        <section className="space-y-3 rounded-2xl border border-border bg-card p-6">
          {result.ranking.map((r) => (
            <div key={r.factor}>
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">
                  {r.factor} · {r.name}
                </span>
                <span className="font-mono text-xs text-muted-foreground">{r.percent}%</span>
              </div>
              <div className="mt-1.5 h-2 rounded-full bg-secondary">
                <div
                  className="h-2 rounded-full bg-primary transition-all"
                  style={{ width: `${r.percent}%` }}
                />
              </div>
            </div>
          ))}
          {(previous || data?.profile?.discSecondary) && result.primary && (
            <p className="pt-2 text-xs text-muted-foreground">
              Seu perfil anterior era{" "}
              <strong>
                {previous}
                {data?.profile?.discSecondary ? data.profile.discSecondary : ""}
              </strong>
              {" "}e ao salvar passará para{" "}
              <strong>
                {result.primary}
                {result.secondary ? result.secondary : ""}
              </strong>.
            </p>
          )}
        </section>

        <div className="flex flex-wrap gap-2">
          <Button onClick={() => save.mutate()} disabled={save.isPending} className="gap-2">
            {save.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            Salvar no meu perfil
          </Button>
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => {
              setAnswers({});
              setPage(0);
              setFinished(false);
            }}
          >
            <RefreshCcw className="h-4 w-4" /> Refazer o teste
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Módulo C · Teste DISC completo
        </div>
        <h1 className="mt-2 font-display text-3xl leading-tight">Perfil comportamental</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          20 questões. Escolha a alternativa que MAIS parece com você. Não existe resposta certa ou
          errada.
        </p>
        <div className="mt-4 flex items-center gap-3">
          <div className="h-1.5 flex-1 rounded-full bg-border">
            <div
              className="h-1.5 rounded-full bg-primary transition-all"
              style={{ width: `${(answered / ITEMS.length) * 100}%` }}
            />
          </div>
          <span className="font-mono text-xs text-muted-foreground">
            {answered}/{ITEMS.length}
          </span>
        </div>
      </header>

      <section className="space-y-6 rounded-2xl border border-border bg-card p-6">
        {pageItems.map((item, i) => {
          const idx = start + i;
          return (
            <div key={idx}>
              <div className="text-sm font-semibold">
                {idx + 1}. {item.prompt}
              </div>
              <div className="mt-2 grid gap-2 md:grid-cols-2">
                {item.options.map((o) => (
                  <button
                    type="button"
                    key={o.label}
                    onClick={() => setAnswers((a) => ({ ...a, [idx]: o.factor }))}
                    className={
                      "rounded-xl border px-3 py-2.5 text-left text-[13px] transition-colors " +
                      (answers[idx] === o.factor
                        ? "border-primary bg-primary/10 font-medium"
                        : "border-border hover:bg-secondary/60")
                    }
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </section>

      <div className="flex items-center justify-between">
        {page === 0 ? (
          <Link
            to="/app/consciencia"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:underline"
          >
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Link>
        ) : (
          <Button variant="ghost" className="gap-1.5" onClick={() => setPage((p) => p - 1)}>
            <ArrowLeft className="h-4 w-4" /> Anterior
          </Button>
        )}
        <Button
          className="gap-1.5"
          onClick={() => {
            if (!pageComplete) {
              toast.warning("Responda todas as questões desta página para continuar.");
              return;
            }
            if (page + 1 < totalPages) setPage((p) => p + 1);
            else setFinished(true);
          }}
        >
          {page + 1 < totalPages ? "Continuar" : "Ver resultado"}
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
