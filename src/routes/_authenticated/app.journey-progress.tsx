import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  Brain,
  Building,
  Check,
  CircleDashed,
  Gauge,
  Loader2,
  Minus,
  Sparkles,
  Target,
} from "lucide-react";
import { api } from "@/lib/api";
import { useCurrentOrg } from "@/lib/use-current-org";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/app/journey-progress")({
  ssr: false,
  component: JourneyProgressPage,
  head: () => ({
    meta: [
      { title: "Progresso da jornada C.O.R.E. · Líder C.O.R.E." },
      {
        name: "description",
        content:
          "Visão geral do seu ciclo: status de cada etapa de Consciência, Organização, Resultado e Evolução, com os próximos passos recomendados.",
      },
      { property: "og:title", content: "Progresso da jornada C.O.R.E." },
      {
        property: "og:description",
        content: "Veja onde você está em C, O, R e E e o que fazer a seguir para fechar o ciclo.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Status = "done" | "partial" | "todo";
type Step = { key: string; label: string; status: Status; detail: string; to: string };
type Stage = { key: string; name: string; subtitle: string; percent: number; steps: Step[] };
type NextStep = Step & { stage: string; stageName: string };
type Payload = {
  cycle: { id: string; name: string; status: string; startAt: string; endAt: string } | null;
  cycles: Array<{ id: string; name: string; status: string }>;
  overall: number;
  stages: Stage[];
  nextSteps: NextStep[];
};

const STAGE_META: Record<string, { icon: typeof Brain; color: string }> = {
  C: { icon: Brain, color: "var(--pilar-c)" },
  O: { icon: Building, color: "var(--pilar-o)" },
  R: { icon: Target, color: "var(--pilar-r)" },
  E: { icon: Gauge, color: "var(--pilar-e)" },
};

const STATUS_META: Record<Status, { label: string; icon: typeof Check; className: string }> = {
  done: { label: "Concluído", icon: Check, className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" },
  partial: { label: "Em andamento", icon: Minus, className: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300" },
  todo: { label: "Pendente", icon: CircleDashed, className: "bg-secondary text-muted-foreground" },
};

function JourneyProgressPage() {
  const { orgId, current, orgs, setOrgId } = useCurrentOrg();
  const [cycleId, setCycleId] = useState("");

  const q = useQuery({
    queryKey: ["journey-progress", orgId, cycleId],
    enabled: !!orgId,
    queryFn: () =>
      api<Payload>(
        `/organization/${orgId}/jornada/progress${cycleId ? `?cycleId=${cycleId}` : ""}`,
      ),
  });

  const data = q.data;

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-accent" /> Jornada C.O.R.E.
          </span>
          <h1 className="mt-3 font-display text-3xl leading-tight sm:text-4xl">
            Progresso da jornada<span className="text-accent">.</span>
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Onde você está em cada etapa do ciclo — Consciência, Organização, Resultado e Evolução — e
            o que falta para o ciclo fechar de verdade.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {orgs.length > 1 && current && (
            <select
              value={current.id}
              onChange={(e) => setOrgId(e.target.value)}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              {orgs.map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          )}
          {(data?.cycles.length ?? 0) > 0 && (
            <select
              value={cycleId || data?.cycle?.id || ""}
              onChange={(e) => setCycleId(e.target.value)}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              {data!.cycles.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          )}
        </div>
      </header>

      {q.isLoading && (
        <div className="flex items-center gap-2 rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Calculando seu progresso…
        </div>
      )}

      {q.isError && (
        <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-6 text-sm">
          Não foi possível carregar o progresso agora.
          <Button variant="outline" className="ml-3" onClick={() => q.refetch()}>
            Tentar de novo
          </Button>
        </div>
      )}

      {data && (
        <>
          <section className="rounded-2xl border border-border bg-card p-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Ciclo atual
                </div>
                <div className="font-display text-2xl">
                  {data.cycle?.name ?? "Nenhum ciclo criado"}
                </div>
                {data.cycle && (
                  <div className="text-sm text-muted-foreground">
                    {new Date(data.cycle.startAt).toLocaleDateString("pt-BR")} —{" "}
                    {new Date(data.cycle.endAt).toLocaleDateString("pt-BR")} · {data.cycle.status}
                  </div>
                )}
              </div>
              <div className="text-right">
                <div className="font-display text-4xl">{data.overall}%</div>
                <div className="text-xs text-muted-foreground">jornada completa</div>
              </div>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-accent transition-all"
                style={{ width: `${data.overall}%` }}
              />
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            {data.stages.map((s) => {
              const meta = STAGE_META[s.key] ?? STAGE_META.C;
              const Icon = meta.icon;
              return (
                <div key={s.key} className="space-y-4 rounded-2xl border border-border bg-card p-6">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <span
                        className="flex h-10 w-10 items-center justify-center rounded-xl"
                        style={{ backgroundColor: `color-mix(in oklab, ${meta.color} 14%, transparent)` }}
                      >
                        <Icon className="h-5 w-5" style={{ color: meta.color }} />
                      </span>
                      <div>
                        <h2 className="font-display text-xl leading-tight">
                          {s.key} · {s.name}
                        </h2>
                        <p className="text-sm text-muted-foreground">{s.subtitle}</p>
                      </div>
                    </div>
                    <span className="rounded-full border border-border px-3 py-1 text-sm font-semibold">
                      {s.percent}%
                    </span>
                  </div>

                  <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${s.percent}%`, backgroundColor: meta.color }}
                    />
                  </div>

                  <ul className="space-y-2">
                    {s.steps.map((st) => {
                      const sm = STATUS_META[st.status];
                      const SIcon = sm.icon;
                      return (
                        <li key={st.key}>
                          <Link
                            to={st.to}
                            className="flex items-start gap-3 rounded-xl border border-border/70 p-3 transition-colors hover:bg-secondary/60"
                          >
                            <span
                              className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${sm.className}`}
                            >
                              <SIcon className="h-3.5 w-3.5" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block text-sm font-medium">{st.label}</span>
                              <span className="block text-xs text-muted-foreground">{st.detail}</span>
                            </span>
                            <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </section>

          <section className="space-y-4 rounded-2xl border border-border bg-card p-6">
            <h2 className="font-display text-xl">Próximos passos recomendados</h2>
            {data.nextSteps.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-5 text-sm text-muted-foreground">
                Ciclo completo em todas as etapas. Registre o fechamento e abra o próximo ciclo de 90
                dias.
              </div>
            ) : (
              <ol className="space-y-2">
                {data.nextSteps.map((st, i) => {
                  const meta = STAGE_META[st.stage] ?? STAGE_META.C;
                  return (
                    <li key={st.stage + st.key}>
                      <Link
                        to={st.to}
                        className="flex items-center gap-3 rounded-xl border border-border/70 p-3 transition-colors hover:bg-secondary/60"
                      >
                        <span
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                          style={{ backgroundColor: meta.color }}
                        >
                          {i + 1}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium">{st.label}</span>
                          <span className="block text-xs text-muted-foreground">
                            {st.stageName} · {st.detail}
                          </span>
                        </span>
                        <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                      </Link>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>
        </>
      )}
    </div>
  );
}
