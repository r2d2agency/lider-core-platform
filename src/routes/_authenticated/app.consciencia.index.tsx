import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Brain,
  CheckCircle2,
  ClipboardList,
  Bell,
  Zap,
  Loader2,
  Sparkles,
  Target,
  ArrowRight,
  Pencil,
  Activity,
  Play,
  Users,
  Mic,
} from "lucide-react";
import { api } from "@/lib/api";
import { useCurrentOrg } from "@/lib/use-current-org";
import { useFeature } from "@/lib/features";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/app/consciencia/")({
  component: ConscienciaPage,
  head: () => ({
    meta: [
      { title: "Meu Perfil · Consciência · LíderCore" },
      { name: "description", content: "Sua jornada de autoconhecimento no Módulo C." },
    ],
  }),
});

type Profile = {
  id: string;
  declaredRole: string | null;
  notMine: string | null;
  assessmentType: "disc" | "big_five" | "other" | null;
  assessmentTraits: Record<string, unknown> | null;
  sabotages: string[];
  communicationStyle: string | null;
  mbtiType: string | null;
  discPrimary: "D" | "I" | "S" | "C" | null;
  hardSelfScore: number | null;
  softSelfScore: number | null;
  heartSelfScore: number | null;
  riskFlags: string[];
  strengths: string[];
  notes: string | null;
  assessmentAt: string | null;
  activityDescription?: string | null;
  autoPdiGeneratedAt?: string | null;
  coachTrackGeneratedAt?: string | null;
  updatedAt: string;
};

type Commitment = {
  id: string;
  phrase: string;
  status: "active" | "in_progress" | "done" | "dropped";
  reviewAt: string | null;
  createdAt: string;
};

type CrossSignal = {
  id: string;
  kind: string;
  severity: "low" | "medium" | "high";
  title: string;
  detail: string;
  createdAt: string;
};

type MeResponse = {
  profile: Profile | null;
  commitments: Commitment[];
  signals: CrossSignal[];
  assessmentStale: boolean;
};

const RISK_OPTIONS = [
  { value: "controle", label: "Controle excessivo" },
  { value: "evita_conflito", label: "Evita conflito" },
  { value: "cobranca_dura", label: "Cobrança dura" },
  { value: "perfeccionismo", label: "Perfeccionismo" },
  { value: "impaciencia", label: "Impaciência" },
  { value: "acomodacao", label: "Acomodação" },
];

const SABOTAGE_OPTIONS = [
  "Juiz interno",
  "Agradador",
  "Hiper-realizador",
  "Hiper-racional",
  "Vítima",
  "Evasivo",
  "Controlador",
  "Reservado",
  "Inquieto",
];

function ConscienciaPage() {
  const { orgId } = useCurrentOrg();
  const qc = useQueryClient();
  const { user } = useAuth();
  const [profileOpen, setProfileOpen] = useState(false);
  const canEditProfile = useFeature("consciencia.profile", "edit");

  const { data, isLoading } = useQuery({
    queryKey: ["consciencia", "me", orgId],
    enabled: !!orgId,
    queryFn: () => api<MeResponse>(`/organization/${orgId}/consciencia/me`),
  });

  const { data: subordinates } = useQuery({
    queryKey: ["consciencia", "subordinates", orgId],
    enabled: !!orgId,
    queryFn: () =>
      api<{ items: Array<{ id: string }> }>(`/organization/${orgId}/consciencia/subordinate-map`),
  });
  const subordinateCount = subordinates?.items?.length ?? 0;

  if (!orgId) return null;

  const profile = data?.profile ?? null;
  const commitments = data?.commitments ?? [];

  const hshFilled =
    profile?.hardSelfScore != null &&
    profile?.softSelfScore != null &&
    profile?.heartSelfScore != null;
  const activeCommitments = commitments.filter(
    (c) => c.status !== "done" && c.status !== "dropped",
  ).length;

  type Step = {
    key: string;
    icon: React.ComponentType<{ className?: string }>;
    title: string;
    subtitle: string;
    minutes: number;
    done: boolean;
    weight: number; 
    to: "/app/consciencia/assessment" | "/app/consciencia/activity" | "/app/consciencia/pdi" | "/app/consciencia/coach" | "/app/consciencia/liderados";
    search?: { step: "behavioral" | "hsh" | "sabotages"; showResults?: boolean };
  };
  const steps: Step[] = [
    {
      key: "behavioral",
      icon: Brain,
      title: "Perfil Comportamental",
      subtitle:
        profile?.discPrimary || profile?.mbtiType
          ? `${profile?.discPrimary ? "DISC " + profile.discPrimary : ""}${profile?.discPrimary && profile?.mbtiType ? " · " : ""}${profile?.mbtiType ?? ""}`
          : "DISC · MBTI",
      minutes: 8,
      done: !!(profile?.discPrimary || profile?.mbtiType),
      weight: 20,
      to: "/app/consciencia/assessment",
      search: { step: "behavioral" },
    },
    {
      key: "sabotages",
      icon: Zap,
      title: "Limitadores de Performance",
      subtitle:
        (profile?.sabotages?.length ?? 0) > 0
          ? `${profile!.sabotages.slice(0, 2).join(", ")}${profile!.sabotages.length > 2 ? "..." : ""}`
          : "Identifique padrões que travam sua execução",
      minutes: 6,
      done: (profile?.sabotages?.length ?? 0) >= 3,
      weight: 15,
      to: "/app/consciencia/assessment",
      search: { step: "sabotages" },
    },
    {
      key: "hsh",
      icon: Activity,
      title: "Radar Hard · Soft · Heart",
      subtitle: "Autoavaliação nas 3 dimensões",
      minutes: 4,
      done: !!hshFilled,
      weight: 15,
      to: "/app/consciencia/assessment",
      search: { step: "hsh" },
    },
    {
      key: "activity",
      icon: ClipboardList,
      title: "Descrição das atividades",
      subtitle: "O que ocupa suas horas hoje",
      minutes: 5,
      done: !!(profile?.activityDescription && profile.activityDescription.trim().length > 20),
      weight: 10,
      to: "/app/consciencia/activity",
    },
    {
      key: "pdi",
      icon: Target,
      title: "PDI",
      subtitle: activeCommitments > 0 ? `${activeCommitments} meta${activeCommitments > 1 ? "s" : ""} ativa${activeCommitments > 1 ? "s" : ""}` : "Plano de desenvolvimento",
      minutes: 3,
      done: activeCommitments > 0 || !!profile?.autoPdiGeneratedAt,
      weight: 20,
      to: "/app/consciencia/pdi",
    },
    {
      key: "liderados",
      icon: Users,
      title: "Mapa dos liderados",
      subtitle:
        subordinateCount > 0
          ? `${subordinateCount} perfil${subordinateCount > 1 ? "s" : ""} mapeado${subordinateCount > 1 ? "s" : ""}`
          : "Perfis e trilha individual do time",
      minutes: 4,
      done: subordinateCount > 0,
      weight: 10,
      to: "/app/consciencia/liderados",
    },
    {
      key: "coach",
      icon: Sparkles,
      title: "Coach C.O.R.E.",
      subtitle: "Trilha guiada de evolução",
      minutes: 3,
      done: !!profile?.coachTrackGeneratedAt,
      weight: 10,
      to: "/app/consciencia/coach",
    },
  ];

  const totalWeight = steps.reduce((sum, s) => sum + s.weight, 0);
  const completedWeight = steps.filter((s) => s.done).reduce((sum, s) => sum + s.weight, 0);
  const progressPct = Math.round((completedWeight / totalWeight) * 100);
  const completed = steps.filter((s) => s.done).length;
  const total = steps.length;
  const missingSteps = steps.filter((s) => !s.done);
  const missingCount = missingSteps.length;
  const currentIdx = steps.findIndex((s) => !s.done);
  const current = currentIdx >= 0 ? steps[currentIdx] : null;
  const next = currentIdx >= 0 ? steps[currentIdx + 1] ?? null : null;

  // Trilha completa: nenhuma etapa fica bloqueada — todas navegáveis.
  const visibleSteps: Array<Step & { state: "done" | "current" | "todo" }> = steps.map((s) => ({
    ...s,
    state: s.done ? ("done" as const) : s.key === current?.key ? ("current" as const) : ("todo" as const),
  }));
  void next;

  const initial =
    (user?.fullName ?? user?.email ?? "?")
      .trim()
      .charAt(0)
      .toUpperCase() || "?";

  // Timeline
  const timeline: Array<{ when: string; label: string }> = [];
  if (profile?.discPrimary) timeline.push({ when: relativeDay(profile.assessmentAt ?? profile.updatedAt), label: `DISC ${profile.discPrimary} concluído` });
  if (profile?.sabotages && profile.sabotages.length > 0) {
    const sList = profile.sabotages.join(", ");
    timeline.push({ 
      when: relativeDay(profile.assessmentAt ?? profile.updatedAt), 
      label: `Sabotadores identificados: ${sList}` 
    });
  }
  if (profile?.updatedAt) timeline.push({ when: relativeDay(profile.updatedAt), label: "Perfil atualizado" });

  return (
    <div className="mx-auto max-w-md space-y-6 pb-28">
      {/* 1 · Header */}
      <header className="flex items-center justify-between gap-3 pt-1">
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            Módulo C · Consciência
          </div>
          <h1 className="mt-1 font-display text-[26px] font-bold leading-none tracking-tight">
            Meu Perfil
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Notificações"
            className="grid h-10 w-10 place-items-center rounded-full border border-border bg-card text-foreground transition-colors hover:bg-secondary/60"
          >
            <Bell className="h-4 w-4" />
          </button>
          <div
            className="grid h-10 w-10 place-items-center rounded-full bg-primary text-[13px] font-semibold text-primary-foreground"
            aria-label="Perfil"
          >
            {initial}
          </div>
        </div>
      </header>

      {isLoading && !profile ? (
        <div className="flex items-center gap-2 pt-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando sua jornada…
        </div>
      ) : null}

      {/* 2 · Progresso da Jornada */}
      <section className="rounded-3xl border border-border bg-card p-5">
        <div className="flex items-baseline justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              Sua jornada
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="font-display text-4xl font-bold leading-none tracking-tight">
                {progressPct}
              </span>
              <span className="text-lg font-semibold text-muted-foreground">%</span>
            </div>
            <div className="mt-1 text-[12px] text-muted-foreground">
              {missingCount > 0 
                ? `Faltam ${missingCount} etapa${missingCount > 1 ? "s" : ""}: ${missingSteps[0].title === "Sabotadores" ? "Limitadores" : missingSteps[0].title}` 
                : "Perfil completo"}
            </div>
          </div>
          {current && (
            <Link
              to={current.to}
              search={current.search}
              className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-[12px] font-semibold text-primary-foreground transition-transform hover:scale-[1.02] active:scale-100"
            >
              Continuar <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>
        <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-700 ease-out"
            style={{ 
              width: `${progressPct}%`,
              backgroundColor: "var(--pilar-c)"
            }}
          />
        </div>

      </section>

      {/* 3 · Continue de onde parou */}
      {current && (
        <section className="overflow-hidden rounded-3xl bg-ink-gradient text-ink-foreground shadow-[0_24px_60px_-30px_oklch(0_0_0_/_0.5)]">
          <div className="relative p-6">
            <div
              aria-hidden
              className="absolute -right-16 -top-16 h-52 w-52 rounded-full bg-accent/40 blur-3xl"
            />
            <div className="relative">
              <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-ink-foreground/60">
                Continue de onde parou
              </div>
              <div className="mt-3 flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-2xl bg-ink-foreground/10 text-ink-foreground">
                  <current.icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-display text-xl font-bold leading-tight">
                    {current.title}
                  </div>
                  <div className="text-[12px] text-ink-foreground/60">
                    Tempo estimado · {current.minutes} min
                  </div>
                </div>
              </div>
              <Link
                to={current.to}
                search={current.search}
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-accent-gradient px-4 py-3 text-[13px] font-semibold text-white shadow-lg transition-transform hover:scale-[1.01] active:scale-100"
              >
                <Play className="h-4 w-4" fill="currentColor" /> Continuar
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* 4 · Minha Jornada */}
      <section>
        <div className="mb-3 flex items-baseline justify-between px-1">
          <h2 className="text-[13px] font-semibold">Minha jornada</h2>
          <span className="text-[11px] text-muted-foreground">
            {completed}/{total}
          </span>
        </div>
        <ul className="space-y-2">
          {visibleSteps.map((s) => (
            <JourneyRow key={s.key} step={s} />
          ))}
        </ul>
      </section>

      {/* 4b · Ferramentas do módulo */}
      <section>
        <div className="mb-3 px-1 text-[13px] font-semibold">Ferramentas</div>
        <div className="grid grid-cols-2 gap-2">
          <Link
            to="/app/consciencia/agenda"
            className="rounded-2xl border border-border bg-card p-4 transition-colors hover:bg-secondary/50"
          >
            <Mic className="h-4 w-4 text-accent" />
            <div className="mt-2 text-[13px] font-semibold leading-tight">Agenda de voz</div>
            <div className="mt-0.5 text-[11px] text-muted-foreground">
              Fale sua agenda e vire tarefas
            </div>
          </Link>
          <Link
            to="/app/consciencia/liderados"
            className="rounded-2xl border border-border bg-card p-4 transition-colors hover:bg-secondary/50"
          >
            <Users className="h-4 w-4 text-accent" />
            <div className="mt-2 text-[13px] font-semibold leading-tight">Mapa dos liderados</div>
            <div className="mt-0.5 text-[11px] text-muted-foreground">
              Perfis e trilhas do time
            </div>
          </Link>
          <Link
            to="/app/consciencia/disc"
            className="rounded-2xl border border-border bg-card p-4 transition-colors hover:bg-secondary/50"
          >
            <Brain className="h-4 w-4 text-accent" />
            <div className="mt-2 text-[13px] font-semibold leading-tight">
              {profile?.discPrimary ? "Refazer teste DISC" : "Fazer teste DISC"}
            </div>
            <div className="mt-0.5 text-[11px] text-muted-foreground">
              20 questões · resultado na hora
            </div>
          </Link>
        </div>
      </section>

      {/* 5 · Minha Evolução */}
      {hshFilled && (
        <section>
          <div className="mb-3 flex items-baseline justify-between px-1">
            <h2 className="text-[13px] font-semibold">Minha evolução</h2>
            <Link
              to="/app/evolution"
              className="text-[11px] font-semibold text-accent hover:underline"
            >
              Ver histórico completo
            </Link>
          </div>
          <HSHEvolutionGrid profile={profile!} orgId={orgId} />
        </section>
      )}

      {/* 6 · Próximo Objetivo */}
      {current && (
        <section className="rounded-3xl border border-border bg-card p-5">
          <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-accent">
            Hoje
          </div>
          <div className="mt-2 font-display text-lg font-bold leading-tight">
            Complete: {current.title.toLowerCase()}
          </div>
          <div className="mt-1 text-[12px] text-muted-foreground">
            Tempo · {current.minutes} min
          </div>
          <Link
            to={current.to}
            search={current.search}
            className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-primary px-4 py-2 text-[12px] font-semibold text-foreground transition-colors hover:bg-primary hover:text-primary-foreground"
          >
            Começar <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </section>
      )}

      {/* 7 · Timeline */}
      {timeline.length > 0 && (
        <section>
          <div className="mb-3 px-1 text-[13px] font-semibold">Timeline</div>
          <ul className="space-y-3">
            {timeline.slice(0, 5).map((t, i) => (
              <li key={i} className="flex items-center gap-3 text-[13px]">
                <div
                  className={
                    "h-2 w-2 shrink-0 rounded-full " +
                    (i === 0 ? "bg-accent ring-4 ring-accent/15" : "bg-border")
                  }
                />
                <div className="w-24 shrink-0 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  {t.when}
                </div>
                <div className="min-w-0 flex-1 truncate">{t.label}</div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 8 · Editar perfil */}
      {canEditProfile && (
        <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
          <DialogTrigger asChild>
            <button
              type="button"
              className="flex w-full items-center justify-center gap-2 rounded-full border border-border bg-card px-4 py-3 text-[13px] font-semibold text-foreground transition-colors hover:bg-secondary/60"
            >
              <Pencil className="h-4 w-4" /> Editar perfil
            </button>
          </DialogTrigger>
          <ProfileDialog
            orgId={orgId!}
            initial={profile}
            onDone={() => {
              setProfileOpen(false);
              qc.invalidateQueries({ queryKey: ["consciencia", "me", orgId] });
            }}
          />
        </Dialog>
      )}
    </div>
  );
}

// ---------- Row da jornada ----------
function JourneyRow({
  step,
}: {
  step: {
    icon: React.ComponentType<{ className?: string }>;
    title: string;
    subtitle: string;
    state: "done" | "current" | "todo";
    minutes: number;
    to: "/app/consciencia/assessment" | "/app/consciencia/activity" | "/app/consciencia/pdi" | "/app/consciencia/coach" | "/app/consciencia/liderados";
    search?: { step: "behavioral" | "hsh" | "sabotages" };
  };
}) {
  const Icon = step.icon;
  const isCurrent = step.state === "current";
  const isDone = step.state === "done";
  const inner = (
    <div
      className={
        "flex items-center gap-3 rounded-2xl px-4 py-3.5 transition-colors " +
        (isCurrent
          ? "border-2 border-accent bg-accent/5"
          : isDone
            ? "border border-border bg-card"
            : "border border-dashed border-border bg-transparent")
      }
    >
      <div
        className={
          "grid h-9 w-9 shrink-0 place-items-center rounded-full " +
          (isDone
            ? "bg-primary text-primary-foreground"
            : isCurrent
              ? "bg-accent text-accent-foreground"
              : "bg-secondary text-muted-foreground")
        }
      >
        {isDone ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
      </div>
      <div className="min-w-0 flex-1">
        <div
          className={
            "truncate text-[13px] font-semibold leading-tight text-foreground"
          }
        >
          {step.title}
        </div>
        <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
          {isCurrent ? `Continue daqui · ${step.minutes} min` : step.subtitle}
        </div>
      </div>
      <ArrowRight
        className={"h-4 w-4 shrink-0 " + (isCurrent ? "text-accent" : "text-muted-foreground")}
      />
    </div>
  );

  return (
    <li>
      <Link 
        to={step.to} 
        search={step.state === "done" ? { ...step.search, showResults: true } : step.search} 
        className="block w-full text-left"
      >
        {inner}
      </Link>
    </li>
  );
}

function EvolutionTile({
  label,
  value,
  previousValue,
}: {
  label: string;
  value: number;
  previousValue?: number;
}) {
  const diff = previousValue != null ? value - previousValue : 0;
  return (
    <div className="rounded-2xl border border-border bg-card p-3.5 shadow-sm">
      <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 flex items-baseline gap-1">
        <div className="font-display text-2xl font-bold leading-none tabular-nums">
          {value}
        </div>
        {diff !== 0 && (
          <div
            className={`text-[10px] font-bold ${diff > 0 ? "text-emerald-500" : "text-rose-500"}`}
          >
            {diff > 0 ? "↑" : "↓"}
            {Math.abs(diff)}
          </div>
        )}
      </div>
      <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-700 ease-out"
          style={{ width: `${Math.max(4, Math.min(100, value))}%` }}
        />
      </div>
    </div>
  );
}

// ---------- helpers de UI ----------
function ProgressGauge({ value }: { value: number }) {
  // Semicircle SVG gauge
  const radius = 46;
  const stroke = 10;
  const cx = 56;
  const cy = 56;
  const circ = Math.PI * radius;
  const dash = (value / 100) * circ;
  return (
    <div className="relative h-[72px] w-[112px] shrink-0">
      <svg viewBox="0 0 112 64" className="h-full w-full">
        <path
          d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
          fill="none"
          stroke="hsl(var(--border))"
          strokeWidth={stroke}
          strokeLinecap="round"
        />
        <path
          d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
          fill="none"
          stroke="hsl(var(--accent))"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`}
          className="transition-[stroke-dasharray] duration-700 ease-out"
        />
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-end pb-1">
        <div className="font-display text-2xl font-bold leading-none">{value}%</div>
        <div className="mt-0.5 text-[9px] uppercase tracking-widest text-muted-foreground">Perfil concluído</div>
      </div>
    </div>
  );
}

function relativeDay(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diff <= 0) return "Hoje";
  if (diff === 1) return "Ontem";
  if (diff < 7) return `${diff} dias atrás`;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

// (helpers TrilhaItem / MiniSpark / FeatureRow / SummaryCard removidos com o redesign)

function HSHPanel({ profile }: { profile: Profile }) {
  const dims: Array<{ key: "hard" | "soft" | "heart"; label: string; sub: string; value: number | null; tone: string }> = [
    { key: "hard", label: "Hard", sub: "Saber fazer — método, indicadores, planejamento", value: profile.hardSelfScore, tone: "bg-primary" },
    { key: "soft", label: "Soft", sub: "Saber agir — comunicação, decisão, delegação", value: profile.softSelfScore, tone: "bg-accent" },
    { key: "heart", label: "Heart", sub: "Saber ser — escuta, empatia, coerência", value: profile.heartSelfScore, tone: "bg-success" },
  ];
  const filled = dims.filter((d) => d.value != null).length;
  return (
    <section className="rounded-2xl border border-border bg-background p-6">
      <div className="mb-4 flex items-baseline justify-between">
        <div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Lente Hard · Soft · Heart</div>
          <div className="mt-1 text-sm text-muted-foreground">
            Sua autoavaliação inicial nas 3 dimensões da liderança. O sistema vai inferir a evolução real a partir do seu uso em O e R.
          </div>
        </div>
        {filled < 3 && (
          <span className="rounded-full border border-accent/40 bg-accent/10 px-2 py-1 text-[10px] font-medium uppercase tracking-widest text-accent">
            Preencha as 3 dimensões
          </span>
        )}
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {dims.map((d) => (
          <div key={d.key} className="rounded-xl border border-border/60 bg-secondary/20 p-4">
            <div className="flex items-baseline justify-between">
              <div className="font-display text-lg">{d.label}</div>
              <div className="font-mono text-sm tabular-nums">
                {d.value != null ? `${d.value}` : "—"}<span className="text-muted-foreground">/100</span>
              </div>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{d.sub}</p>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-border/50">
              <div className={`h-full ${d.tone} transition-all`} style={{ width: `${d.value ?? 0}%` }} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ---------- Dialogs ----------
function ProfileDialog({
  orgId, initial, onDone,
}: { orgId: string; initial: Profile | null; onDone: () => void }) {
  const [declaredRole, setDeclaredRole] = useState(initial?.declaredRole ?? "");
  const [notMine, setNotMine] = useState(initial?.notMine ?? "");
  const [assessmentType, setAssessmentType] = useState<Profile["assessmentType"]>(initial?.assessmentType ?? null);
  const [mbtiType, setMbtiType] = useState(initial?.mbtiType ?? "");
  const [discPrimary, setDiscPrimary] = useState<Profile["discPrimary"]>(initial?.discPrimary ?? null);
  const [hardSelfScore, setHardSelfScore] = useState<number>(initial?.hardSelfScore ?? 50);
  const [softSelfScore, setSoftSelfScore] = useState<number>(initial?.softSelfScore ?? 50);
  const [heartSelfScore, setHeartSelfScore] = useState<number>(initial?.heartSelfScore ?? 50);
  const [strengths, setStrengths] = useState((initial?.strengths ?? []).join(", "));
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [communicationStyle, setCommunicationStyle] = useState(initial?.communicationStyle ?? "");
  const [riskFlags, setRiskFlags] = useState<string[]>(initial?.riskFlags ?? []);
  const [sabotages, setSabotages] = useState<string[]>(initial?.sabotages ?? []);

  const save = useMutation({
    mutationFn: () =>
      api(`/organization/${orgId}/consciencia/me`, {
        method: "PUT",
        body: {
          declaredRole: declaredRole || null,
          notMine: notMine || null,
          assessmentType,
          mbtiType: mbtiType.toUpperCase() || null,
          discPrimary,
          hardSelfScore,
          softSelfScore,
          heartSelfScore,
          strengths: strengths.split(",").map((s) => s.trim()).filter(Boolean),
          notes: notes || null,
          communicationStyle: communicationStyle || null,
          riskFlags,
          sabotages,
          markAssessedNow: true,
        },
      }),
    onSuccess: () => {
      toast.success("Perfil atualizado");
      onDone();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao salvar"),
  });

  const toggle = (arr: string[], v: string, set: (a: string[]) => void) =>
    set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  return (
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle>Meu perfil de liderança</DialogTitle>
      </DialogHeader>
      <div className="space-y-5 py-2">
        <div>
          <Label>Papel declarado</Label>
          <Input value={declaredRole} onChange={(e) => setDeclaredRole(e.target.value)} placeholder="Ex.: líder integrador, formador de gente" />
          <p className="mt-1 text-xs text-muted-foreground">Pra que essa liderança existe — em uma frase.</p>
        </div>

        <div>
          <Label>O que NÃO é meu papel</Label>
          <Textarea value={notMine} onChange={(e) => setNotMine(e.target.value)} placeholder="Ex.: executar entregas técnicas no lugar do time; resolver conflitos entre pares." className="min-h-[70px]" />
        </div>

        <div className="rounded-xl border border-border bg-secondary/20 p-4">
          <div className="mb-3 text-xs uppercase tracking-widest text-muted-foreground">Autoavaliação Hard · Soft · Heart</div>
          <div className="space-y-4">
            <ScoreSlider label="Hard — método, indicadores, planejamento" value={hardSelfScore} onChange={setHardSelfScore} tone="bg-primary" />
            <ScoreSlider label="Soft — comunicação, delegação, decisão" value={softSelfScore} onChange={setSoftSelfScore} tone="bg-accent" />
            <ScoreSlider label="Heart — escuta, empatia, coerência" value={heartSelfScore} onChange={setHeartSelfScore} tone="bg-success" />
          </div>
          <p className="mt-3 text-xs text-muted-foreground">Ponto de partida. Depois disso, o sistema mede evolução real a partir do uso — não pede autoavaliação toda semana.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label>Assessment</Label>
            <Select value={assessmentType ?? ""} onValueChange={(v) => setAssessmentType((v || null) as Profile["assessmentType"])}>
              <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="disc">DISC</SelectItem>
                <SelectItem value="big_five">Big Five</SelectItem>
                <SelectItem value="other">Outro</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Estilo de comunicação (egograma)</Label>
            <Input value={communicationStyle} onChange={(e) => setCommunicationStyle(e.target.value)} placeholder="Ex.: pai crítico dominante" />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label>Tipo MBTI (opcional)</Label>
            <Input maxLength={4} value={mbtiType} onChange={(e) => setMbtiType(e.target.value.toUpperCase())} placeholder="Ex.: ENTJ" />
          </div>
          <div>
            <Label>Perfil DISC dominante</Label>
            <Select value={discPrimary ?? ""} onValueChange={(v) => setDiscPrimary((v || null) as Profile["discPrimary"])}>
              <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="D">D — Dominância</SelectItem>
                <SelectItem value="I">I — Influência</SelectItem>
                <SelectItem value="S">S — Estabilidade</SelectItem>
                <SelectItem value="C">C — Conformidade</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Label>Forças (separadas por vírgula)</Label>
          <Input value={strengths} onChange={(e) => setStrengths(e.target.value)} placeholder="Visão, escuta ativa, execução" />
        </div>

        <div>
          <Label className="mb-2 block">Riscos comportamentais</Label>
          <div className="flex flex-wrap gap-2">
            {RISK_OPTIONS.map((r) => (
              <button
                type="button"
                key={r.value}
                onClick={() => toggle(riskFlags, r.value, setRiskFlags)}
                className={
                  "rounded-full border px-3 py-1 text-xs transition-colors " +
                  (riskFlags.includes(r.value)
                    ? "border-destructive/50 bg-destructive/10 text-destructive"
                    : "border-border hover:bg-secondary")
                }
              >
                {r.label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Alimentam o motor de alertas cruzados.</p>
        </div>

        <div>
          <Label className="mb-2 block">Sabotadores ativos</Label>
          <div className="flex flex-wrap gap-2">
            {SABOTAGE_OPTIONS.map((s) => (
              <button
                type="button"
                key={s}
                onClick={() => toggle(sabotages, s, setSabotages)}
                className={
                  "rounded-full border px-3 py-1 text-xs transition-colors " +
                  (sabotages.includes(s)
                    ? "border-accent/50 bg-accent/10 text-accent"
                    : "border-border hover:bg-secondary")
                }
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div>
          <Label>Notas pessoais</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Somente você lê." className="min-h-[90px]" />
        </div>
      </div>
      <DialogFooter>
        <Button disabled={save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
          Salvar
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function CommitmentDialog({ orgId, onDone }: { orgId: string; onDone: () => void }) {
  const [phrase, setPhrase] = useState("");
  const [reviewDate, setReviewDate] = useState("");
  const create = useMutation({
    mutationFn: () =>
      api(`/organization/${orgId}/consciencia/commitments`, {
        method: "POST",
        body: {
          phrase,
          reviewAt: reviewDate ? new Date(reviewDate).toISOString() : null,
        },
      }),
    onSuccess: () => {
      toast.success("Compromisso registrado");
      onDone();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao salvar"),
  });
  return (
    <DialogContent>
      <DialogHeader><DialogTitle>Novo compromisso</DialogTitle></DialogHeader>
      <div className="space-y-4 py-2">
        <div>
          <Label>Frase-âncora</Label>
          <Textarea value={phrase} onChange={(e) => setPhrase(e.target.value)} placeholder="Ex.: nesta semana, delego pelo menos 2 entregas do meu backlog." />
        </div>
        <div>
          <Label>Data de revisão</Label>
          <Input type="date" value={reviewDate} onChange={(e) => setReviewDate(e.target.value)} />
        </div>
      </div>
      <DialogFooter>
        <Button disabled={!phrase.trim() || create.isPending} onClick={() => create.mutate()}>
          {create.isPending ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
          Registrar
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function HSHEvolutionGrid({ profile, orgId }: { profile: Profile; orgId: string }) {
  const history = useQuery({
    queryKey: ["hsh-history", orgId],
    queryFn: () => api<any[]>(`/organization/${orgId}/jornada/hsh-history`),
  });

  const lastSnapshot = history.data?.[0]?.radarSnapshot;

  return (
    <div className="grid grid-cols-3 gap-2">
      <EvolutionTile
        label="Hard"
        value={profile.hardSelfScore!}
        previousValue={lastSnapshot?.hard}
      />
      <EvolutionTile
        label="Soft"
        value={profile.softSelfScore!}
        previousValue={lastSnapshot?.soft}
      />
      <EvolutionTile
        label="Heart"
        value={profile.heartSelfScore!}
        previousValue={lastSnapshot?.heart}
      />
    </div>
  );
}

// ---------- labels ----------
function ScoreSlider({ label, value, onChange, tone }: { label: string; value: number; onChange: (v: number) => void; tone: string }) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <Label className="text-xs font-normal text-muted-foreground">{label}</Label>
        <span className="font-mono text-xs tabular-nums">{value}<span className="text-muted-foreground">/100</span></span>
      </div>
      <div className="relative">
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="h-2 w-full cursor-pointer appearance-none rounded-full bg-border/60 accent-primary"
          aria-label={label}
        />
        <div className={`pointer-events-none absolute inset-y-0 left-0 h-2 rounded-full ${tone} opacity-40`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function labelRisk(v: string) {
  return RISK_OPTIONS.find((r) => r.value === v)?.label ?? v;
}
function labelAssessment(v: string) {
  return v === "disc" ? "DISC" : v === "big_five" ? "Big Five" : "Outro";
}
function labelCommitmentStatus(s: Commitment["status"]) {
  return s === "active" ? "Ativo" : s === "in_progress" ? "Em execução" : s === "done" ? "Cumprido" : "Descartado";
}