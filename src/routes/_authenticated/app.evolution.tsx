import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Save, Sparkles, TrendingUp, CheckSquare, Target, MessageSquare, Building2, Users2, Heart } from "lucide-react";
import { api } from "@/lib/api";
import { useCurrentOrg } from "@/lib/use-current-org";
import { Button } from "@/components/ui/button";
import { CompositionBars, ScoreGauge, TrendArea } from "@/components/charts";
import { CountUp, FadeIn, StaggerItem, StaggerList } from "@/components/motion";
import { SectionHeader } from "@/components/ui/metric-card";

export const Route = createFileRoute("/_authenticated/app/evolution")({
  component: EvolutionPage,
});

type Snapshot = {
  id: string;
  periodYear: number;
  periodMonth: number;
  score: number;
  ritualsScore: number;
  delegScore: number;
  indicatorsScore: number;
  diagnostic: string | null;
};

type MeResponse = {
  current: {
    score: number;
    diagnostic: string;
    breakdown: {
      ritualsScore: number;
      delegScore: number;
      indicatorsScore: number;
      rituals: { done: number; planned: number };
      delegations: { onTime: number; total: number; overdue: number };
      indicators: { onTarget: number; withReadings: number };
    };
    hard: Dimension;
    soft: Dimension;
    heart: Dimension;
  };
  trend: Snapshot[];
  commitments: Array<{ id: string; phrase: string; status: string }>;
};

type Dimension = {
  score: number;
  parts: Array<{ label: string; value: number; hint?: string }>;
  diagnostic: string;
};

type TimelineEvent = {
  id: string;
  kind: "snapshot" | "delegation" | "pdi" | "feedback";
  at: string;
  title: string;
  detail?: string | null;
  score?: number;
};

function EvolutionPage() {
  return <EvolutionPageInner />;
}

function DimensionCard({ icon, label, tone, dim }: { icon: React.ReactNode; label: string; tone: string; dim: Dimension }) {
  return (
    <div className="card-elevated p-5">
      <div className={"flex items-center gap-2 text-xs uppercase tracking-widest " + tone}>
        {icon}
        <span>{label}</span>
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <div className="metric-number text-4xl">{dim.score}</div>
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">/100</div>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{dim.diagnostic}</p>
      <div className="mt-4 space-y-2">
        {dim.parts.map((p) => (
          <div key={p.label}>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-foreground/80">{p.label}</span>
              <span className="text-muted-foreground">{Math.round(p.value * 100)}%</span>
            </div>
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-accent" style={{ width: `${Math.round(p.value * 100)}%` }} />
            </div>
            {p.hint && <div className="mt-0.5 text-[10px] text-muted-foreground">{p.hint}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

function EvolutionPageInner() {
  const { orgId } = useCurrentOrg();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["evolution", "me", orgId],
    enabled: !!orgId,
    queryFn: () => api<MeResponse>(`/organization/${orgId}/evolution/me`),
  });

  const timeline = useQuery({
    queryKey: ["evolution", "timeline", orgId],
    enabled: !!orgId,
    queryFn: () => api<TimelineEvent[]>(`/organization/${orgId}/evolution/timeline`),
  });

  const snapshot = useMutation({
    mutationFn: () => api(`/organization/${orgId}/evolution/snapshot`, { method: "POST" }),
    onSuccess: () => {
      toast.success("Snapshot do mês registrado");
      qc.invalidateQueries({ queryKey: ["evolution", "me", orgId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha"),
  });

  if (!orgId) return null;

  const current = data?.current;
  const trend = data?.trend ?? [];
  const commitments = data?.commitments ?? [];
  const prev = trend.length >= 2 ? trend[trend.length - 2] : null;
  const delta = current && prev ? current.score - prev.score : null;

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <FadeIn>
        <SectionHeader
          eyebrow="Módulo E · Evolução"
          title="Score de sustentação"
          description="35% cadência dos rituais · 35% delegações no prazo · 30% indicadores dentro da meta. O número é consequência dos fatos."
          right={
            <Button
              variant="outline"
              className="gap-2"
              disabled={snapshot.isPending}
              onClick={() => snapshot.mutate()}
            >
              {snapshot.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Registrar snapshot
            </Button>
          }
        />
      </FadeIn>

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Calculando…
        </div>
      )}

      {current && (
        <>
          <section className="grid gap-4 md:grid-cols-[1.1fr_1fr]">
            <FadeIn delay={0.05}>
              <div className="card-elevated relative overflow-hidden p-6">
                <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-accent/20 blur-3xl" />
                <div className="eyebrow relative">Score atual</div>
                <div className="relative mt-2 flex items-center gap-6">
                  <ScoreGauge
                    value={current.score}
                    size={180}
                    center={
                      <>
                        <div className="metric-number text-5xl text-accent-gradient">
                          <CountUp value={current.score} />
                        </div>
                        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">/100</div>
                      </>
                    }
                  />
                  <div className="min-w-0 flex-1">
                    {delta != null && (
                      <div
                        className={
                          "mb-2 inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium " +
                          (delta > 0
                            ? "bg-success/15 text-success"
                            : delta < 0
                              ? "bg-destructive/15 text-destructive"
                              : "bg-muted text-muted-foreground")
                        }
                      >
                        {delta > 0 ? "+" : ""}
                        {delta} vs mês anterior
                      </div>
                    )}
                    <p className="text-sm leading-relaxed text-foreground/90">{current.diagnostic}</p>
                  </div>
                </div>
              </div>
            </FadeIn>

            <FadeIn delay={0.1}>
              <div className="card-elevated p-6">
                <div className="eyebrow">Composição</div>
                <div className="mt-4">
                  <CompositionBars
                    segments={[
                      {
                        label: "Rituais (35%)",
                        value: current.breakdown.ritualsScore,
                        hint: `${current.breakdown.rituals.done}/${current.breakdown.rituals.planned} feitos em 30d`,
                      },
                      {
                        label: "Delegações (35%)",
                        value: current.breakdown.delegScore,
                        hint: `${current.breakdown.delegations.onTime}/${current.breakdown.delegations.total} no prazo · ${current.breakdown.delegations.overdue} atrasada(s)`,
                      },
                      {
                        label: "Indicadores (30%)",
                        value: current.breakdown.indicatorsScore,
                        hint: `${current.breakdown.indicators.onTarget}/${current.breakdown.indicators.withReadings} na meta`,
                      },
                    ]}
                  />
                </div>
              </div>
            </FadeIn>
          </section>

          <FadeIn delay={0.12}>
            <section>
              <div className="mb-3 flex items-end justify-between">
                <div>
                  <div className="eyebrow">Sustentação por dimensão</div>
                  <h3 className="mt-1 font-display text-xl">Radar de Autogestão (IPM)</h3>
                </div>
                <div className="text-xs text-muted-foreground">
                  O IPM mede sua capacidade de resposta consciente vs padrão automático.
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <DimensionCard icon={<Building2 className="h-4 w-4" />} label="Autopercepção" tone="text-sky-500" dim={current.hard} />
                <DimensionCard icon={<Users2 className="h-4 w-4" />} label="Autorregulação" tone="text-emerald-500" dim={current.soft} />
                <DimensionCard icon={<Heart className="h-4 w-4" />} label="Escolha Consciente" tone="text-rose-500" dim={current.heart} />
              </div>
            </section>
          </FadeIn>

          <FadeIn delay={0.15}>
            <section className="card-elevated p-6">
              <div className="mb-4 flex items-end justify-between">
                <div>
                  <div className="eyebrow">Tendência</div>
                  <h3 className="mt-1 font-display text-xl">Últimos meses</h3>
                </div>
                <div className="text-xs text-muted-foreground">{trend.length} snapshot(s)</div>
              </div>
              {trend.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border bg-secondary/20 p-6 text-sm text-muted-foreground">
                  Ainda não há snapshots. Clique em "Registrar snapshot" no fim de cada mês para começar a tendência.
                </div>
              ) : (
                <TrendArea
                  data={trend.map((s) => ({
                    label: `${s.periodMonth.toString().padStart(2, "0")}/${String(s.periodYear).slice(2)}`,
                    value: s.score,
                  }))}
                  height={220}
                />
              )}
            </section>
          </FadeIn>

          <FadeIn delay={0.2}>
            <section>
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <div className="eyebrow">Mentoria</div>
                  <h3 className="mt-1 font-display text-xl">Plano de ação</h3>
                </div>
                <span className="text-xs uppercase tracking-widest text-muted-foreground">
                  {commitments.length} ativo(s)
                </span>
              </div>
              {commitments.length === 0 ? (
                <div className="rounded-xl border border-border bg-secondary/20 p-4 text-sm text-muted-foreground">
                  Nenhum compromisso ativo. Registre em Consciência → Compromissos de mentoria.
                </div>
              ) : (
                <StaggerList className="space-y-2">
                  {commitments.map((c) => (
                    <StaggerItem key={c.id}>
                      <div className="card-elevated card-elevated-hover flex items-center gap-3 p-4">
                        <div className="grid h-8 w-8 place-items-center rounded-full bg-accent/10">
                          <Sparkles className="h-4 w-4 text-accent" />
                        </div>
                        <div className="text-sm font-medium">{c.phrase}</div>
                      </div>
                    </StaggerItem>
                  ))}
                </StaggerList>
              )}
            </section>
          </FadeIn>

          <FadeIn delay={0.25}>
            <section>
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <div className="eyebrow">Trilha do líder</div>
                  <h3 className="mt-1 font-display text-xl">Últimos 6 meses</h3>
                </div>
                <span className="text-xs uppercase tracking-widest text-muted-foreground">
                  {timeline.data?.length ?? 0} evento(s)
                </span>
              </div>
              {timeline.isLoading ? (
                <div className="rounded-xl border border-border bg-secondary/20 p-4 text-sm text-muted-foreground">
                  Montando trilha…
                </div>
              ) : (timeline.data?.length ?? 0) === 0 ? (
                <div className="rounded-xl border border-border bg-secondary/20 p-4 text-sm text-muted-foreground">
                  Ainda sem eventos. Assim que houver snapshots, delegações concluídas, PDIs ou feedbacks, sua trilha começa a se formar.
                </div>
              ) : (
                <ol className="relative space-y-3 border-l border-border pl-5">
                  {timeline.data!.map((ev) => {
                    const Icon =
                      ev.kind === "snapshot" ? TrendingUp :
                      ev.kind === "delegation" ? CheckSquare :
                      ev.kind === "pdi" ? Target : MessageSquare;
                    return (
                      <li key={ev.id} className="relative">
                        <span className="absolute -left-[27px] top-1.5 grid h-5 w-5 place-items-center rounded-full border border-border bg-background text-muted-foreground">
                          <Icon className="h-3 w-3" />
                        </span>
                        <div className="rounded-xl border border-border bg-card p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="text-sm font-medium">{ev.title}</div>
                            <div className="shrink-0 text-[10px] uppercase tracking-widest text-muted-foreground">
                              {new Date(ev.at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "2-digit" })}
                            </div>
                          </div>
                          {ev.detail && (
                            <div className="mt-1 text-xs text-muted-foreground">{ev.detail}</div>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </section>
          </FadeIn>
        </>
      )}
    </div>
  );
}
