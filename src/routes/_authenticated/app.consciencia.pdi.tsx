import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Flag, Loader2, Sparkles, Target } from "lucide-react";
import { api } from "@/lib/api";
import { useCurrentOrg } from "@/lib/use-current-org";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export const Route = createFileRoute("/_authenticated/app/consciencia/pdi")({
  component: PdiAutoPage,
  head: () => ({
    meta: [
      { title: "PDI automático · LíderCore" },
      { name: "description", content: "PDI gerado a partir do radar, sabotadores e descrição de atividades." },
    ],
  }),
});

type SuggestedGoal = {
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
  source: string;
  detail?: {
    context: string;
    explanation: string;
    practices: string[];
    firstStep: string;
    successSignal: string;
  };
};

type CurrentGoal = {
  id: string;
  title: string;
  action: string | null;
  dueAt: string | null;
  status: "a_fazer" | "em_andamento" | "concluido" | "atrasado";
  evidence: string | null;
};

type CurrentPdi = {
  id: string;
  title: string;
  focus: string | null;
  summary: string | null;
  status: "ativo" | "concluido" | "pausado" | "cancelado";
  startAt: string;
  reviewAt: string | null;
  updatedAt: string;
  totalGoals: number;
  completedGoals: number;
  goals: CurrentGoal[];
};

type CurrentPdiSummary = {
  totalCycles: number;
  activeCycles: number;
  concludedCycles: number;
  currentStatus: CurrentPdi["status"] | null;
  currentGoals: number;
  currentCompletedGoals: number;
  currentId: string | null;
  currentUpdatedAt: string | null;
  currentTitle: string | null;
  currentReviewAt: string | null;
  canStartNewCycle: boolean;
};

type CurrentPdiResponse = {
  current: CurrentPdi | null;
  summary: CurrentPdiSummary;
};

function PdiAutoPage() {
  const { orgId } = useCurrentOrg();
  const qc = useQueryClient();
  const [draftGoals, setDraftGoals] = useState<SuggestedGoal[]>([]);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);

  const currentQ = useQuery<CurrentPdiResponse>({
    queryKey: ["consciencia", "pdi", "current", orgId],
    enabled: !!orgId,
    queryFn: () => api<CurrentPdiResponse>(`/organization/${orgId}/consciencia/pdi/current`),
  });

  const gen = useMutation({
    mutationFn: () =>
      api<{ goals: SuggestedGoal[]; generatedAt: string }>(
        `/organization/${orgId}/consciencia/pdi/auto-generate`,
        { method: "POST", body: {} },
      ),
    onSuccess: (r) => {
      setDraftGoals(r.goals);
      setGeneratedAt(r.generatedAt);
      qc.invalidateQueries({ queryKey: ["consciencia", "me", orgId] });
      toast.success(`${r.goals.length} objetivos sugeridos.`);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao gerar"),
  });

  const save = useMutation({
    mutationFn: () =>
      api<CurrentPdiResponse>(`/organization/${orgId}/consciencia/pdi/save`, {
        method: "POST",
        body: {
          title: "Meu ciclo de evolução",
          focus: "Autodesenvolvimento do líder",
          summary: "Ciclo pessoal criado a partir do PDI sugerido do módulo Consciência.",
          goals: draftGoals.map((goal, index) => ({
            title: goal.title,
            action: goal.detail?.firstStep ?? goal.description,
            evidence: goal.detail?.successSignal ?? `Evolução percebida no objetivo ${index + 1}`,
          })),
        },
      }),
    onSuccess: () => {
      setDraftGoals([]);
      qc.invalidateQueries({ queryKey: ["consciencia", "me", orgId] });
      qc.invalidateQueries({ queryKey: ["consciencia", "pdi", "current", orgId] });
      qc.invalidateQueries({ queryKey: ["journey", orgId] });
      toast.success("Seu PDI foi salvo como ciclo pessoal.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao salvar o ciclo"),
  });

  const updateGoal = useMutation({
    mutationFn: ({ goalId, status }: { goalId: string; status: CurrentGoal["status"] }) =>
      api(`/organization/${orgId}/pdis/${currentQ.data?.current?.id}/goals/${goalId}`, {
        method: "PATCH",
        body: { status },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["consciencia", "pdi", "current", orgId] });
      qc.invalidateQueries({ queryKey: ["consciencia", "me", orgId] });
      qc.invalidateQueries({ queryKey: ["journey", orgId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao atualizar a meta"),
  });

  const conclude = useMutation({
    mutationFn: () =>
      api(`/organization/${orgId}/pdis/${currentQ.data?.current?.id}`, {
        method: "PATCH",
        body: { status: "concluido" },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["consciencia", "pdi", "current", orgId] });
      qc.invalidateQueries({ queryKey: ["consciencia", "me", orgId] });
      qc.invalidateQueries({ queryKey: ["journey", orgId] });
      toast.success("Ciclo concluído. Agora você já pode gerar um novo PDI.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao concluir o ciclo"),
  });

  if (!orgId) return null;

  const current = currentQ.data?.current ?? null;
  const summary = currentQ.data?.summary ?? null;
  const allGoalsDone = !!current && current.goals.length > 0 && current.goals.every((goal) => goal.status === "concluido");
  const hasDraft = draftGoals.length > 0;
  const canGenerate = !currentQ.isLoading && (!current || current.status !== "ativo");
  const statusLabel = useMemo(() => {
    if (!current) return null;
    if (current.status === "concluido") return "Ciclo concluído";
    if (current.status === "pausado") return "Ciclo pausado";
    if (current.status === "cancelado") return "Ciclo cancelado";
    return "Ciclo ativo";
  }, [current]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Módulo C · PDI automático
        </div>
        <h1 className="mt-2 font-display text-3xl leading-tight">Seu ciclo pessoal de evolução</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Aqui você gera sugestões, salva o que virou compromisso real, acompanha a execução e fecha um ciclo
          antes de abrir o próximo. Assim sua evolução não some do sistema.
        </p>
      </header>

      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Seu momento atual
            </div>
            <div className="mt-1 text-sm text-muted-foreground">
              {current
                ? `${statusLabel} · ${current.completedGoals}/${current.totalGoals} metas concluídas`
                : summary?.concludedCycles
                  ? `${summary.concludedCycles} ciclo(s) concluído(s) até agora`
                  : "Você ainda não iniciou um ciclo pessoal salvo"}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => gen.mutate()} disabled={gen.isPending || !canGenerate} className="gap-2">
              {gen.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {current ? "Gerar próximo PDI" : "Gerar PDI agora"}
            </Button>
            {hasDraft && (
              <Button variant="outline" onClick={() => save.mutate()} disabled={save.isPending} className="gap-2">
                {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Target className="h-4 w-4" />}
                Salvar como meu ciclo
              </Button>
            )}
          </div>
        </div>
        {!canGenerate && (
          <div className="mt-4 rounded-xl border border-accent/30 bg-accent/5 px-4 py-3 text-sm text-muted-foreground">
            Você já tem um ciclo ativo. Conclua este PDI antes de abrir um novo.
          </div>
        )}
        {generatedAt && (
          <div className="mt-3 text-xs text-muted-foreground">
            Sugestão gerada em {new Date(generatedAt).toLocaleString("pt-BR")}
          </div>
        )}
      </section>

      {current && (
        <section className="rounded-2xl border border-border bg-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                Ciclo atual
              </div>
              <h2 className="mt-1 font-display text-2xl leading-tight">{current.title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {current.summary ?? "Seu PDI salvo aparece aqui como compromisso real de evolução."}
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => conclude.mutate()}
              disabled={conclude.isPending || !allGoalsDone || current.status !== "ativo"}
              className="gap-2"
            >
              {conclude.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Concluir ciclo
            </Button>
          </div>
          {!allGoalsDone && current.status === "ativo" && (
            <div className="mt-4 rounded-xl border border-border bg-secondary/40 px-4 py-3 text-sm text-muted-foreground">
              Marque todas as metas como concluídas para fechar este ciclo e liberar o próximo.
            </div>
          )}
          <div className="mt-5 space-y-3">
            {current.goals.map((goal, index) => (
              <article key={goal.id} className="rounded-xl border border-border bg-background p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="rounded-full border border-border bg-card px-2 py-0.5 text-[10px] uppercase tracking-widest text-muted-foreground">
                        Meta {index + 1}
                      </span>
                      <StatusBadge status={goal.status} />
                    </div>
                    <div className="mt-2 font-medium text-foreground">{goal.title}</div>
                    {goal.action && <p className="mt-1 text-sm text-muted-foreground">{goal.action}</p>}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {goal.status !== "em_andamento" && goal.status !== "concluido" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateGoal.mutate({ goalId: goal.id, status: "em_andamento" })}
                        disabled={updateGoal.isPending || current.status !== "ativo"}
                      >
                        Em andamento
                      </Button>
                    )}
                    {goal.status !== "concluido" && (
                      <Button
                        size="sm"
                        onClick={() => updateGoal.mutate({ goalId: goal.id, status: "concluido" })}
                        disabled={updateGoal.isPending || current.status !== "ativo"}
                      >
                        Concluir
                      </Button>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {hasDraft && (
        <section className="space-y-3">
          <div className="text-sm font-medium text-foreground">Sugestões prontas para virar seu próximo ciclo</div>
          {draftGoals.map((g, i) => (
            <article key={i} className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-center gap-2">
                <PriorityBadge p={g.priority} />
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  {labelSource(g.source)}
                </span>
              </div>
              <h2 className="mt-2 flex items-start gap-2 font-display text-lg">
                <Flag className="mt-0.5 h-4 w-4 text-primary" />
                {g.title}
              </h2>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{g.description}</p>

              {g.detail ? (
                <Accordion type="single" collapsible className="mt-4">
                  <AccordionItem value={`goal-${i}`} className="border-none">
                    <AccordionTrigger className="rounded-xl border border-border px-4 py-3 text-sm hover:no-underline">
                      <span>Ver detalhamento desta sugestão</span>
                    </AccordionTrigger>
                    <AccordionContent className="px-1 pb-1 pt-4">
                      <div className="space-y-4 rounded-xl border border-border/70 bg-background/60 p-4">
                        <DetailBlock label="Por que isso entrou no seu PDI" text={g.detail.context} />
                        <DetailBlock label="O que isso quer desenvolver" text={g.detail.explanation} />
                        <div>
                          <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                            Como praticar
                          </div>
                          <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
                            {g.detail.practices.map((practice, idx) => (
                              <li key={idx} className="rounded-lg border border-border/60 bg-card px-3 py-2">
                                {practice}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <DetailBlock label="Primeiro passo sugerido" text={g.detail.firstStep} />
                        <DetailBlock label="Como perceber evolução" text={g.detail.successSignal} />
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              ) : null}
            </article>
          ))}
        </section>
      )}

      {!gen.isPending && !current && !hasDraft && (
        <div className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
          Sem ciclo salvo ainda. Clique em <strong>Gerar PDI agora</strong>, revise as sugestões e salve quando
          quiser transformar isso em um compromisso real de evolução.
        </div>
      )}
    </div>
  );
}

function PriorityBadge({ p }: { p: "high" | "medium" | "low" }) {
  const map = {
    high: { label: "Prioridade alta", cls: "border-destructive/40 bg-destructive/10 text-destructive" },
    medium: { label: "Prioridade média", cls: "border-accent/40 bg-accent/10 text-accent" },
    low: { label: "Prioridade baixa", cls: "border-border bg-secondary text-muted-foreground" },
  };
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-widest ${map[p].cls}`}>
      {map[p].label}
    </span>
  );
}

function StatusBadge({ status }: { status: CurrentGoal["status"] }) {
  const map = {
    a_fazer: "border-border bg-secondary text-muted-foreground",
    em_andamento: "border-accent/40 bg-accent/10 text-accent",
    concluido: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600",
    atrasado: "border-destructive/30 bg-destructive/10 text-destructive",
  } as const;
  const label = {
    a_fazer: "A fazer",
    em_andamento: "Em andamento",
    concluido: "Concluída",
    atrasado: "Atrasada",
  } as const;
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-widest ${map[status]}`}>
      {label[status]}
    </span>
  );
}

function DetailBlock({ label, text }: { label: string; text: string }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{text}</p>
    </div>
  );
}

function labelSource(source: string) {
  if (source === "hsh_gap") return "Radar HSH";
  if (source === "activity_delegation") return "Atividades";
  if (source.startsWith("sabotage:")) return "Sabotadores";
  if (source.startsWith("risk:")) return "Risco declarado";
  return source;
}
