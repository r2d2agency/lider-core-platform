// Home do líder — "Briefing do dia" (Sistema Operacional do Líder).
// Este é o seu sistema de liderança. Aqui você acompanha o que precisa
// da sua atenção e transforma desenvolvimento em rotina.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import type * as React from "react";
import { api } from "@/lib/api";
import {
  Bell,
  Brain,
  Calendar as CalendarIcon,
  Compass,
  MessageSquare,
  Sparkles,
  NotebookPen,
  Target,
  Users as UsersIcon,
  ArrowRight,
} from "lucide-react";
import { useFeatures, type FeaturesResponse } from "@/lib/features";

export const Route = createFileRoute("/_authenticated/app/")({
  ssr: false,
  component: HomeBriefing,
});

type Briefing = {
  generatedAt: string;
  greeting: string;
  profile: {
    fullName: string | null;
    onboardingCompletedAt: string | null;
    didNeoMentorship: boolean;
  };
  dna: null | {
    scores: Record<string, number> | null;
    strengths: string[];
    improvements: string[];
    updatedAt: string;
  };
  initialJourney: null | { id: string; slug: string; name: string; description: string | null };
  notifications: Array<{
    id: string;
    title: string;
    body: string | null;
    linkUrl: string | null;
    createdAt: string;
  }>;
};

type AttentionItem = {
  id: string;
  title: string;
  reason: string;
  severity: "high" | "medium" | "low";
  kind: string;
  link: string | null;
};
type Attention = {
  generatedAt: string;
  items: AttentionItem[];
  total: number;
  coreScore: number | null;
};

function HomeBriefing() {
  const featuresQ = useFeatures();
  const modules = collectModules(featuresQ.data);
  // Enquanto as features carregam, não bloqueamos nada (evita "Em breve" falso).
  const hasC = !featuresQ.data || modules.has("consciencia");
  const q = useQuery({
    queryKey: ["me", "home", "briefing"],
    queryFn: () => api<Briefing>("/me/home/briefing"),
    refetchInterval: 60_000,
  });
  const progressQ = useQuery({
    queryKey: ["journey-progress-summary"],
    queryFn: () => api<any>(`/organization/${data?.profile ? 'me' : 'null'}/jornada/progress`),
    enabled: !!data,
  });
  const data = q.data;
  const journeyProgress = progressQ.data;

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <header>
        <div className="text-[11px] font-semibold uppercase tracking-[0.22em]" style={{ color: 'var(--pilar-c)' }}>
          Briefing do dia
        </div>
        <h1 className="mt-2 font-display text-4xl font-semibold leading-[1.05] tracking-tight md:text-5xl">
          {data?.greeting ?? "Sala de liderança"}
        </h1>
        <p className="mt-3 max-w-xl text-sm text-muted-foreground">
          A jornada toda começa pela consciência. Faça seus assessments e receba seu diagnóstico de liderança — esta é a porta de entrada da metodologia.
        </p>
      </header>

      <AttentionCard />

      {data?.initialJourney && (
        <Link
          to="/app/journey"
          className="group flex items-center justify-between gap-4 rounded-2xl border border-accent/40 bg-accent/5 p-5 shadow-sm transition hover:bg-accent/10"
        >
          <div className="flex items-start gap-4">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-accent text-accent-foreground">
              <Compass className="h-5 w-5" />
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-widest text-accent">
                Jornada Inicial
              </div>
              <div className="mt-1 font-medium">{data.initialJourney.name}</div>
              <p className="mt-1 text-sm text-muted-foreground">
                Comece por aqui para gerar seu CORE DNA e desbloquear o app.
              </p>
            </div>
          </div>
          <ArrowRight className="h-5 w-5 shrink-0 text-accent transition group-hover:translate-x-1" />
        </Link>
      )}

      <section className="grid gap-3 md:grid-cols-2">
        {/* Módulo C (ativo hoje) */}
        <Tile icon={Brain} label="1. Consciência" desc={!data?.profile?.onboardingCompletedAt ? "Perfil incompleto — clique para finalizar" : "Diagnóstico C.O.R.E. e CORE DNA"} to="/app/consciencia" enabled={hasC} pilar="c" />
        <Tile icon={Compass} label="2. Organização" desc="Agenda sem rituais — organize sua semana" to="/app/organization" enabled={hasC} pilar="o" />
        <Tile icon={Target} label="3. Resultados" desc="Indicadores e metas do time" to="/app/indicators" enabled={hasC} pilar="r" />
        <Tile icon={Sparkles} label="4. Evolução" desc={journeyProgress?.stages?.find((s: any) => s.key === "E")?.percent > 0 ? "Ciclo em evolução — acompanhe o PDI" : "PDI não iniciado — comece seu crescimento"} to="/app/pdis" enabled={hasC} pilar="e" />

        
        <div className="md:col-span-2 my-4">
          <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3 px-1 opacity-60" style={{ color: 'var(--pilar-c)' }}>
            Principais da ferramenta
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <Tile icon={MessageSquare} label="Feedbacks e 1:1s" desc="Gerir conversas e pulsos de clima" to="/app/pulses" enabled={hasC} />
            <Tile icon={CalendarIcon} label="Agenda do líder" desc="Seu calendário de gestão" to="/app/consciencia/agenda" enabled />
            <Tile icon={NotebookPen} label="Notas & Reuniões" desc="Anotações rápidas e por voz" to="/app/notes" enabled />
            <Tile icon={Sparkles} label="Copiloto IA" desc="Coach e recomendações" to="/app/ai" enabled />
          </div>
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-accent" />
            <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Últimos avisos
            </h2>
          </div>
          <Link to="/app/notifications" className="text-xs font-medium text-accent hover:underline">
            Ver tudo
          </Link>
        </div>
        <ul className="space-y-2">
          {(data?.notifications ?? []).slice(0, 4).map((n) => (
            <li key={n.id} className="rounded-xl border border-border bg-card p-3 text-sm shadow-sm">
              <div className="font-medium">{n.title}</div>
              {n.body && <div className="mt-0.5 text-xs text-muted-foreground">{n.body}</div>}
            </li>
          ))}
          {!q.isLoading && (data?.notifications ?? []).length === 0 && (
            <li className="rounded-xl border border-dashed border-border p-4 text-xs text-muted-foreground">
              Nada novo por aqui. Tudo tranquilo.
            </li>
          )}
        </ul>
      </section>
    </div>
  );
}

function collectModules(features: FeaturesResponse | undefined): Set<string> {
  return collectModulesImpl(features);
}

function AttentionCard() {
  const q = useQuery({
    queryKey: ["me", "home", "attention"],
    queryFn: () => api<Attention>("/me/home/attention"),
    refetchInterval: 120_000,
  });
  const items = q.data?.items ?? [];
  const today = new Intl.DateTimeFormat("pt-BR", { weekday: "long" }).format(new Date());
  const dayLabel = today.charAt(0).toUpperCase() + today.slice(1);

  return (
    <section className="rounded-3xl border border-border bg-card p-5 shadow-sm md:p-6">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Hoje · {dayLabel}
        </div>
        {items.length > 0 && (
          <span className="rounded-full bg-accent/10 px-3 py-1 text-[11px] font-semibold text-accent">
            {items.length} {items.length === 1 ? "ação" : "ações"}
          </span>
        )}
      </div>

      <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight md:text-3xl">
        Quem precisa da sua atenção
      </h2>

      <ul className="mt-4 space-y-3">
        {q.isLoading &&
          [0, 1, 2].map((i) => (
            <li key={i} className="h-[62px] animate-pulse rounded-2xl border border-border bg-muted/40" />
          ))}

        {!q.isLoading && items.length === 0 && (
          <li className="rounded-2xl border border-dashed border-border p-5 text-sm text-muted-foreground">
            Nada urgente agora. Seus liderados estão em dia com 1:1s, feedbacks e delegações.
          </li>
        )}

        {items.map((it) => {
          const dot =
            it.severity === "high"
              ? "bg-destructive"
              : it.severity === "medium"
                ? "bg-accent"
                : "bg-muted-foreground/40";
          const body = (
            <div className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-background px-4 py-3 shadow-sm transition group-hover:border-accent/50 group-hover:bg-secondary/30">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{it.title}</div>
                <div className="mt-0.5 truncate text-xs text-muted-foreground">{it.reason}</div>
              </div>
              <span className={"h-2.5 w-2.5 shrink-0 rounded-full " + dot} aria-hidden />
            </div>
          );
          return (
            <li key={it.id} className="group">
              {it.link ? <Link to={it.link}>{body}</Link> : body}
            </li>
          );
        })}
      </ul>

      <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
        <span className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
          CORE Score
        </span>
        <span className="font-display text-2xl font-semibold">
          {q.data?.coreScore ?? "—"}
        </span>
      </div>
    </section>
  );
}

function collectModulesImpl(features: FeaturesResponse | undefined): Set<string> {
  const roles = features?.roles ?? [];
  const isAdmin = roles.includes("super_admin") || roles.includes("neo_admin");
  if (isAdmin || !features) return new Set(["consciencia", "organizacao", "resultado", "evolucao"]);
  const set = new Set<string>();
  for (const [k, actions] of Object.entries(features.features ?? {})) {
    if (Object.values(actions ?? {}).some(Boolean)) set.add(k.split(".")[0]);
  }
  return set;
}

function Tile({
  icon: Icon,
  label,
  desc,
  to,
  enabled,
  pilar,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  desc: string;
  to: string;
  enabled: boolean;
  pilar?: "c" | "o" | "r" | "e";
}) {
  const pilarColor = 
    pilar === "c" ? "var(--pilar-c)" :
    pilar === "o" ? "var(--pilar-o)" :
    pilar === "r" ? "var(--pilar-r)" :
    pilar === "e" ? "var(--pilar-e)" :
    "var(--accent)";

  const inner = (
    <div
      className={
        "flex items-start gap-3 rounded-2xl border p-4 shadow-sm transition " +
        (enabled
          ? "border-border bg-card hover:bg-secondary/40"
          : "border-dashed border-border bg-muted/40 text-muted-foreground")
      }
      style={{
        borderColor: enabled && pilar ? `color-mix(in oklab, ${pilarColor} 30%, var(--border))` : undefined
      }}
    >
      <div
        className={
          "grid h-11 w-11 shrink-0 place-items-center rounded-xl " +
          (enabled ? "" : "bg-muted text-muted-foreground")
        }
        style={{
          backgroundColor: enabled ? `color-mix(in oklab, ${pilarColor} 12%, transparent)` : undefined,
          color: enabled ? pilarColor : undefined
        }}
      >
        <Icon className="h-5 w-5" />
      </div>

      <div className="flex-1">
        <div className="flex items-center gap-2">
          <div className="text-sm font-semibold">{label}</div>
          {!enabled && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-widest">
              Em breve
            </span>
          )}
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">{desc}</p>
      </div>
    </div>
  );
  return enabled ? <Link to={to}>{inner}</Link> : <div aria-disabled>{inner}</div>;
}