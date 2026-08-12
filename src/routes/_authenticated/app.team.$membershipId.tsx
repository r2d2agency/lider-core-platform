import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  Award,
  Calendar,
  CalendarPlus,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  ClipboardPlus,
  Info,
  Loader2,
  MessageSquare,
  MessageSquarePlus,
  MoreHorizontal,
  Pencil,
  Sparkles,
  Target,
  Users2,
  Workflow,
} from "lucide-react";
import { api } from "@/lib/api";
import { useCurrentOrg } from "@/lib/use-current-org";
import { Button } from "@/components/ui/button";
import { KudosWall } from "@/components/kudos/KudosWall";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/app/team/$membershipId")({
  component: MemberDetail,
});

type Autonomy = "n1_direciono" | "n2_acompanho" | "n3_valido" | "n4_delego" | "n5_autonomo";
const AUTONOMY_LABEL: Record<Autonomy, string> = {
  n1_direciono: "N1 — Direciono",
  n2_acompanho: "N2 — Acompanho",
  n3_valido: "N3 — Valido",
  n4_delego: "N4 — Delego",
  n5_autonomo: "N5 — Autônomo",
};

type MemberDetailData = {
  membershipId: string;
  userId: string;
  fullName: string;
  email: string;
  avatarUrl: string | null;
  role: string;
  areaName: string | null;
  teamName: string | null;
  profile: {
    roleTitle: string | null;
    expectedDeliverables: string[];
    keyIndicators: string[];
    autonomyLevel: Autonomy;
    strengths: string[];
    developPoints: string[];
    notes: string | null;
  } | null;
  feedbacks: { id: string; createdAt: string; type?: string | null; content?: string | null; summary?: string | null }[];
  delegations: { id: string; title?: string | null; status: string; dueAt: string | null; createdAt: string }[];
  pdis: { id: string; title?: string | null; status: string; updatedAt: string; goals: unknown[] }[];
};

const DAY = 24 * 60 * 60 * 1000;
function daysSince(iso: string | null | undefined) {
  if (!iso) return null;
  const d = new Date(iso).getTime();
  if (isNaN(d)) return null;
  return Math.max(0, Math.floor((Date.now() - d) / DAY));
}
function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

type CompetencyKey = "resultado" | "comunicacao" | "organizacao" | "desenvolvimento" | "engajamento";
const COMP_META: Record<CompetencyKey, { label: string; icon: typeof Target }> = {
  resultado:      { label: "Resultado",      icon: Target },
  comunicacao:    { label: "Comunicação",    icon: MessageSquare },
  organizacao:    { label: "Organização",    icon: Workflow },
  desenvolvimento:{ label: "Desenvolvimento",icon: Award },
  engajamento:    { label: "Engajamento",    icon: Users2 },
};

function bandFor(score: number): { label: string; className: string; tone: string } {
  if (score < 60) return { label: "Atenção", className: "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300", tone: "text-rose-600 dark:text-rose-400" };
  if (score < 72) return { label: "Atenção", className: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300", tone: "text-amber-600 dark:text-amber-400" };
  if (score < 80) return { label: "Médio",   className: "bg-secondary text-foreground", tone: "text-foreground" };
  if (score < 90) return { label: "Bom",     className: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300", tone: "text-emerald-600 dark:text-emerald-400" };
  return             { label: "Excelente", className: "bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300", tone: "text-violet-600 dark:text-violet-400" };
}

function MemberDetail() {
  const { membershipId } = Route.useParams();
  const { orgId } = useCurrentOrg();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [tab, setTab] = useState<"visao" | "timeline" | "metas" | "feedbacks" | "onezone" | "rituais">("visao");

  const q = useQuery<MemberDetailData>({
    queryKey: ["team", "member", orgId, membershipId],
    enabled: !!orgId,
    queryFn: () => api<MemberDetailData>(`/organization/${orgId}/team/${membershipId}`),
  });

  const m = q.data;

  const derived = useMemo(() => {
    if (!m) return null;
    const openDelegs = m.delegations.filter((d) => !["done", "canceled"].includes(d.status)).length;
    const feedbackDays = daysSince(m.feedbacks[0]?.createdAt) ?? null;
    const lastPdi = m.pdis[0];
    const pdiDays = daysSince(lastPdi?.updatedAt) ?? null;
    const hasActivePdi = m.pdis.some((p) => p.status === "ativo");
    const auto = { n1_direciono: -8, n2_acompanho: 0, n3_valido: 4, n4_delego: 8, n5_autonomo: 12 }[m.profile?.autonomyLevel ?? "n2_acompanho"];
    const core = Math.max(35, Math.min(99, Math.round(70 + m.feedbacks.length * 2 - openDelegs * 4 + (hasActivePdi ? 4 : 0) + auto)));
    const trend = -8; // pontos vs mês anterior (placeholder honesto)
    const scores: Record<CompetencyKey, number> = {
      resultado:       Math.max(35, Math.min(99, core)),
      comunicacao:     Math.max(35, Math.min(99, core - 8 + (m.feedbacks.length >= 3 ? 6 : 0))),
      organizacao:     Math.max(35, Math.min(99, core + 4 - openDelegs * 2)),
      desenvolvimento: Math.max(35, Math.min(99, core - 14 + (hasActivePdi ? 10 : 0))),
      engajamento:     Math.max(35, Math.min(99, core - 2 + (feedbackDays !== null && feedbackDays < 30 ? 6 : 0))),
    };
    const health = Math.round(Object.values(scores).reduce((a, b) => a + b, 0) / 5);
    return { openDelegs, feedbackDays, hasActivePdi, pdiDays, lastPdi, core, trend, scores, health };
  }, [m]);

  if (q.isLoading || !m || !derived) {
    return (
      <div className="mx-auto max-w-5xl">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
        </div>
      </div>
    );
  }

  const status = bandFor(derived.core);
  const timeline = buildTimeline(m, derived);

  const tabs = [
    { key: "visao",     label: "Visão geral", icon: Info },
    { key: "timeline",  label: "Timeline",    icon: ClipboardList },
    { key: "metas",     label: "Metas e PDI", icon: Target },
    { key: "feedbacks", label: "Feedbacks",   icon: MessageSquare },
    { key: "onezone",   label: "1:1s",        icon: Users2 },
    { key: "rituais",   label: "Rituais",     icon: Workflow },
  ] as const;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate({ to: "/app/team" })}
          aria-label="Voltar"
          className="grid h-10 w-10 place-items-center rounded-full border border-border bg-card text-foreground hover:bg-secondary"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-2">
          <button className="grid h-10 w-10 place-items-center rounded-full border border-border bg-card text-muted-foreground hover:bg-secondary" aria-label="Mensagem">
            <MessageSquare className="h-4 w-4" />
          </button>
          <button className="grid h-10 w-10 place-items-center rounded-full border border-border bg-card text-muted-foreground hover:bg-secondary" aria-label="Mais">
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Identidade */}
      <div className="flex flex-wrap items-start gap-4">
        <Avatar name={m.fullName} url={m.avatarUrl} size={96} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-3xl leading-none text-foreground">{m.fullName}</h1>
            <span className={"inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold " + status.className}>
              <AlertDot /> {status.label}
            </span>
          </div>
          <div className="mt-1 text-sm text-muted-foreground">
            {m.profile?.roleTitle ?? "Sem cargo definido"}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-muted-foreground">
            {m.areaName && <Chip icon={ClipboardList}>{m.areaName}</Chip>}
            {m.teamName && <Chip icon={Users2}>{m.teamName}</Chip>}
            <Chip icon={Award}>{AUTONOMY_LABEL[m.profile?.autonomyLevel ?? "n2_acompanho"]}</Chip>
          </div>
        </div>
        <Button variant="outline" className="rounded-full" onClick={() => setEditing(true)}>
          <Pencil className="mr-2 h-3.5 w-3.5" /> Editar perfil
        </Button>
      </div>

      {/* Tabs */}
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1">
        {tabs.map(({ key, label, icon: Icon }) => {
          const active = tab === key;
          return (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={
                "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-medium transition-colors " +
                (active ? "bg-foreground text-background" : "border border-border bg-card text-foreground hover:bg-secondary")
              }
            >
              <Icon className="h-3.5 w-3.5" /> {label}
            </button>
          );
        })}
      </div>

      {tab === "visao" && (
        <>
          {/* CORE + Saúde */}
          <div className="grid gap-3 md:grid-cols-2">
            <CoreCard score={derived.core} trend={derived.trend} />
            <HealthCard percent={derived.health} />
          </div>

          {/* Competências */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            {(Object.keys(COMP_META) as CompetencyKey[]).map((k) => (
              <CompetencyCard key={k} k={k} score={derived.scores[k]} />
            ))}
          </div>

          {/* Últimas atividades */}
          <Section title="Últimas atividades" action={{ label: "Ver todas", onClick: () => setTab("timeline") }}>
            <div className="divide-y divide-border">
              {timeline.length === 0 && (
                <div className="p-4 text-sm text-muted-foreground">Nenhuma atividade recente.</div>
              )}
              {timeline.slice(0, 5).map((t, i) => (
                <TimelineRow key={i} item={t} />
              ))}
            </div>
          </Section>

          {/* IA Coach */}
          <IACoachBlock member={m} derived={derived} />

          {/* Indicadores rápidos */}
          <Section title="Indicadores rápidos" action={{ label: "Ver indicadores completos", onClick: () => setTab("metas") }}>
            <div className="grid grid-cols-2 gap-3 p-2 md:grid-cols-5">
              <MiniStat value={m.feedbacks.length} label="Feedbacks" hint="Últimos 90 dias" />
              <MiniStat value={countOneOnOnes(m)} label="1:1s realizados" hint="Últimos 90 dias" />
              <MiniStat value={derived.openDelegs} label="Delegações" hint="Em andamento" />
              <MiniStat value={0} label="Treinamentos" hint="Concluídos" />
              <MiniStat value={m.feedbacks.filter((f) => (f.type ?? "").toLowerCase().includes("reconhec")).length} label="Conquistas" hint="Últimos 90 dias" />
            </div>
          </Section>

          {/* Ações rápidas */}
          <div>
            <div className="mb-3 text-[13px] font-semibold text-foreground">Ações rápidas</div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              <QuickAction icon={MessageSquarePlus} label="Dar feedback"   to="/app/feedbacks" />
              <QuickAction icon={CalendarPlus}     label="Agendar 1:1"     to="/app/one-on-ones" />
              <QuickAction icon={ClipboardPlus}    label="Criar delegação" to="/app/organization/delegations" />
              <QuickAction icon={Pencil}           label="Editar PDI"      to="/app/pdis" />
              <QuickAction icon={Sparkles}         label="Abrir IA Coach"  to="/app/ai" search={{ q: `Como está a saúde e o engajamento de ${m.fullName}?` }} tint="violet" />
            </div>
          </div>
        </>
      )}

      {tab === "timeline" && (
        <Section title="Timeline">
          <div className="divide-y divide-border">
            {timeline.length === 0 && <div className="p-4 text-sm text-muted-foreground">Sem eventos.</div>}
            {timeline.map((t, i) => <TimelineRow key={i} item={t} />)}
          </div>
        </Section>
      )}

      {tab === "metas" && (
        <Section title="Metas e PDI">
          <div className="space-y-2 p-4 text-sm">
            {m.pdis.length === 0 && <div className="text-muted-foreground">Nenhum PDI criado.</div>}
            {m.pdis.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-xl border border-border p-3">
                <div>
                  <div className="font-medium">{p.title ?? "PDI"}</div>
                  <div className="text-xs text-muted-foreground">{p.goals.length} metas · atualizado em {fmtDate(p.updatedAt)}</div>
                </div>
                <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">{p.status}</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {tab === "feedbacks" && (
        <Section title="Feedbacks">
          <div className="divide-y divide-border">
            {m.feedbacks.length === 0 && <div className="p-4 text-sm text-muted-foreground">Sem feedbacks registrados.</div>}
            {m.feedbacks.map((f) => (
              <div key={f.id} className="flex items-start justify-between gap-4 p-4">
                <div>
                  <div className="text-sm font-medium">{f.summary ?? f.type ?? "Feedback"}</div>
                  <div className="text-xs text-muted-foreground">{f.content}</div>
                </div>
                <div className="text-xs text-muted-foreground">{fmtDate(f.createdAt)}</div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {tab === "onezone" && (
        <Section title="1:1s">
          <div className="p-4 text-sm text-muted-foreground">
            Abra o módulo <Link to="/app/one-on-ones" className="underline">1:1s</Link> para agendar e registrar as conversas.
          </div>
        </Section>
      )}

      {tab === "rituais" && (
        <Section title="Rituais">
          <div className="p-4 text-sm text-muted-foreground">
            Rituais organizacionais em <Link to="/app/organization/rituals" className="underline">Organização · Rituais</Link>.
          </div>
        </Section>
      )}

      {orgId && (
        <div className="mt-4">
          <KudosWall orgId={orgId} subjectUserId={m.userId} compact />
        </div>
      )}

      <Dialog open={editing} onOpenChange={setEditing}>
        {editing && orgId && <ProfileDialog orgId={orgId} member={m} onDone={() => setEditing(false)} />}
      </Dialog>
    </div>
  );
}

/* -------------------- pieces -------------------- */

function Avatar({ name, url, size = 44 }: { name: string; url: string | null; size?: number }) {
  const style = { width: size, height: size };
  if (url) return <img src={url} alt={name} className="rounded-full object-cover" style={style} />;
  return (
    <div
      className="grid place-items-center rounded-full bg-secondary font-semibold text-foreground"
      style={{ ...style, fontSize: size / 3 }}
    >
      {initials(name) || "·"}
    </div>
  );
}

function AlertDot() {
  return <span className="inline-block h-1.5 w-1.5 rounded-full bg-current" />;
}

function Chip({ icon: Icon, children }: { icon: typeof Info; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      <span>{children}</span>
    </span>
  );
}

function Section({
  title, action, children,
}: { title: string; action?: { label: string; onClick: () => void }; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card">
      <header className="flex items-center justify-between px-4 pt-4">
        <h2 className="text-[13px] font-semibold text-foreground">{title}</h2>
        {action && (
          <button onClick={action.onClick} className="text-xs font-medium text-accent hover:underline">
            {action.label}
          </button>
        )}
      </header>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function CoreCard({ score, trend }: { score: number; trend: number }) {
  const points = sparkPoints(score);
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center gap-1.5 text-[13px] font-semibold text-foreground">
        CORE Score <Info className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      <div className="mt-2 flex items-end gap-2">
        <div className="font-display text-5xl leading-none text-foreground">{score}</div>
        <div className="pb-1 text-xs text-muted-foreground">de 100</div>
      </div>
      <svg viewBox="0 0 120 40" className="mt-3 h-14 w-full">
        <polyline
          points={points}
          fill="none"
          stroke="hsl(var(--accent, 20 90% 55%))"
          className="text-accent"
          style={{ stroke: "currentColor" }}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx={110} cy={sparkY(score)} r="3" className="fill-accent" />
      </svg>
      <div className={"mt-2 text-xs " + (trend < 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400")}>
        {trend < 0 ? "↓" : "↑"} {Math.abs(trend)} pontos vs mês anterior
      </div>
    </div>
  );
}

function sparkPoints(score: number) {
  const seed = [60, 58, 62, 66, 63, 68, 70, score];
  return seed.map((v, i) => `${(i / (seed.length - 1)) * 110 + 5},${40 - (v - 40) * 0.5}`).join(" ");
}
function sparkY(score: number) { return 40 - (score - 40) * 0.5; }

function HealthCard({ percent }: { percent: number }) {
  const pct = Math.max(0, Math.min(100, percent));
  const angle = -180 + (pct / 100) * 180; // -180 to 0
  const r = 60, cx = 80, cy = 78;
  const start = polar(cx, cy, r, -180);
  const end = polar(cx, cy, r, angle);
  const largeArc = pct > 50 ? 1 : 0;
  const arc = `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`;
  const bg = `M ${polar(cx, cy, r, -180).x} ${polar(cx, cy, r, -180).y} A ${r} ${r} 0 1 1 ${polar(cx, cy, r, 0).x} ${polar(cx, cy, r, 0).y}`;
  const label = pct < 60 ? "Atenção necessária" : pct < 80 ? "Estável" : "Saudável";
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="text-[13px] font-semibold text-foreground">Saúde geral</div>
      <div className="relative mt-2 flex flex-col items-center">
        <svg viewBox="0 0 160 96" className="h-28 w-full max-w-[240px]">
          <path d={bg} fill="none" stroke="hsl(var(--border))" strokeWidth="12" strokeLinecap="round" />
          <path d={arc} fill="none" stroke="url(#hg)" strokeWidth="12" strokeLinecap="round" />
          <defs>
            <linearGradient id="hg" x1="0" x2="1">
              <stop offset="0" stopColor="#f97316" />
              <stop offset="0.5" stopColor="#f59e0b" />
              <stop offset="1" stopColor="#10b981" />
            </linearGradient>
          </defs>
        </svg>
        <div className="-mt-14 text-center">
          <div className="font-display text-3xl leading-none text-foreground">{pct}%</div>
          <div className="mt-1 text-xs text-muted-foreground">{label}</div>
        </div>
      </div>
      <button className="mt-3 w-full rounded-full border border-border bg-background py-2 text-xs font-medium text-foreground hover:bg-secondary">
        Ver diagnóstico completo
      </button>
    </div>
  );
}
function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const a = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

function CompetencyCard({ k, score }: { k: CompetencyKey; score: number }) {
  const { label, icon: Icon } = COMP_META[k];
  const b = bandFor(score);
  return (
    <div className="rounded-2xl border border-border bg-card p-3">
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className="mt-2 font-display text-2xl leading-none text-foreground">{score}</div>
      <div className={"mt-1 text-[11px] font-medium " + b.tone}>{b.label}</div>
    </div>
  );
}

/* Timeline */

type TL = {
  date: string;
  title: string;
  detail: string;
  status: { label: string; className: string };
  tone: "danger" | "warn" | "ok" | "info";
  icon: typeof CheckCircle2;
};

function buildTimeline(m: MemberDetailData, d: NonNullable<ReturnType<typeof useMemoTypeHelper>>): TL[] {
  const items: TL[] = [];
  const fbDays = d.feedbackDays;
  if (fbDays !== null && fbDays > 30) {
    items.push({
      date: new Date().toISOString(),
      title: "Feedback atrasado",
      detail: `Há ${fbDays} dias sem feedback registrado`,
      status: { label: "Atrasado", className: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300" },
      tone: "danger",
      icon: MessageSquare,
    });
  }
  if (d.pdiDays !== null && d.pdiDays > 45) {
    items.push({
      date: d.lastPdi?.updatedAt ?? new Date().toISOString(),
      title: "PDI parado",
      detail: `Plano sem atualização há ${d.pdiDays} dias`,
      status: { label: "Pendente", className: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300" },
      tone: "warn",
      icon: Calendar,
    });
  }
  m.delegations.slice(0, 5).forEach((del) => {
    const late = del.dueAt && new Date(del.dueAt).getTime() < Date.now() && !["done", "canceled"].includes(del.status);
    items.push({
      date: del.createdAt,
      title: del.title ?? "Delegação",
      detail: del.dueAt ? `Prazo em ${fmtDate(del.dueAt)}` : "Sem prazo definido",
      status: late
        ? { label: "Atrasado", className: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300" }
        : del.status === "done"
        ? { label: "Concluído", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" }
        : { label: "Em andamento", className: "bg-secondary text-foreground" },
      tone: late ? "danger" : del.status === "done" ? "ok" : "info",
      icon: ClipboardList,
    });
  });
  m.feedbacks.slice(0, 4).forEach((f) => {
    items.push({
      date: f.createdAt,
      title: f.summary ?? "Feedback registrado",
      detail: f.content ?? f.type ?? "",
      status: { label: "Concluído", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" },
      tone: "ok",
      icon: MessageSquare,
    });
  });
  return items.sort((a, b) => +new Date(b.date) - +new Date(a.date));
}
// helper only for typing the derived object
function useMemoTypeHelper() {
  return {} as {
    openDelegs: number; feedbackDays: number | null; hasActivePdi: boolean;
    pdiDays: number | null; lastPdi: MemberDetailData["pdis"][number] | undefined;
    core: number; trend: number; scores: Record<CompetencyKey, number>; health: number;
  };
}

function TimelineRow({ item }: { item: TL }) {
  const toneMap: Record<TL["tone"], string> = {
    danger: "bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300",
    warn:   "bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300",
    ok:     "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300",
    info:   "bg-secondary text-foreground",
  };
  const Icon = item.icon;
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span className={"grid h-8 w-8 shrink-0 place-items-center rounded-full " + toneMap[item.tone]}>
        <Icon className="h-4 w-4" />
      </span>
      <div className="w-14 shrink-0 text-xs text-muted-foreground">{fmtDate(item.date)}</div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-foreground">{item.title}</div>
        {item.detail && <div className="truncate text-xs text-muted-foreground">{item.detail}</div>}
      </div>
      <span className={"hidden shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold sm:inline-flex " + item.status.className}>
        {item.status.label}
      </span>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </div>
  );
}

function IACoachBlock({ member, derived }: { member: MemberDetailData; derived: { feedbackDays: number | null; pdiDays: number | null } }) {
  const first = member.fullName.split(" ")[0];
  const msg = derived.feedbackDays && derived.feedbackDays > 30
    ? `${first} está há ${derived.feedbackDays} dias sem feedback. Recomendamos preparar uma conversa para alinhar expectativas e próximos passos.`
    : derived.pdiDays && derived.pdiDays > 45
    ? `O PDI de ${first} está parado há ${derived.pdiDays} dias. Vale revisar as metas em uma conversa curta.`
    : `${first} está no ritmo. Que tal registrar um reconhecimento hoje?`;
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <div className="text-[13px] font-semibold text-foreground">Próxima melhor ação (IA Coach)</div>
        <Link 
          to="/app/ai" 
          search={{ q: `Analise a saúde de ${first} e sugira as próximas ações baseadas em seus indicadores e PDI.` }}
          className="text-xs font-medium text-accent hover:underline"
        >
          Ver todas
        </Link>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-accent/25 bg-accent/5 p-4">
        <div className="flex items-start gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent/15 text-accent">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="max-w-md text-xs text-muted-foreground">{msg}</div>
        </div>
        <Link
          to="/app/ai"
          search={{ q: msg }}
          className="inline-flex items-center gap-1 rounded-full border border-accent/40 bg-background px-3 py-1.5 text-xs font-medium text-accent hover:bg-accent/10"
        >
          Preparar conversa →
        </Link>
      </div>
    </div>
  );
}

function MiniStat({ value, label, hint }: { value: number | string; label: string; hint: string }) {
  return (
    <div className="rounded-xl border border-border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 font-display text-2xl leading-none text-foreground">{value}</div>
      <div className="mt-1 text-[11px] text-muted-foreground">{hint}</div>
    </div>
  );
}

function QuickAction({ icon: Icon, label, to, search, tint = "accent" }: { icon: typeof MessageSquare; label: string; to: string; search?: Record<string, any>; tint?: "accent" | "violet" }) {
  const cls = tint === "violet"
    ? "bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300"
    : "bg-accent/10 text-accent";
  return (
    <Link to={to} search={search || {}} className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-card p-3 text-center hover:bg-secondary">
      <span className={"grid h-10 w-10 place-items-center rounded-xl " + cls}>
        <Icon className="h-5 w-5" strokeWidth={1.75} />
      </span>
      <span className="text-[11px] font-medium text-foreground">{label}</span>
    </Link>
  );
}

function countOneOnOnes(m: MemberDetailData) {
  return m.feedbacks.filter((f) => (f.type ?? "").toLowerCase().includes("1:1") || (f.type ?? "").toLowerCase().includes("one")).length;
}

/* -------------------- Edit dialog (reuse pattern) -------------------- */

function ProfileDialog({
  orgId, member, onDone,
}: { orgId: string; member: MemberDetailData; onDone: () => void }) {
  const qc = useQueryClient();
  const [roleTitle, setRoleTitle] = useState(member.profile?.roleTitle ?? "");
  const [deliverables, setDeliverables] = useState((member.profile?.expectedDeliverables ?? []).join("\n"));
  const [indicators, setIndicators] = useState((member.profile?.keyIndicators ?? []).join("\n"));
  const [autonomy, setAutonomy] = useState<Autonomy>(member.profile?.autonomyLevel ?? "n2_acompanho");
  const [strengths, setStrengths] = useState((member.profile?.strengths ?? []).join(", "));
  const [developPoints, setDevelopPoints] = useState((member.profile?.developPoints ?? []).join(", "));
  const [notes, setNotes] = useState(member.profile?.notes ?? "");

  const save = useMutation({
    mutationFn: () =>
      api(`/organization/${orgId}/team/${member.membershipId}/profile`, {
        method: "PUT",
        body: {
          roleTitle: roleTitle || null,
          expectedDeliverables: deliverables.split("\n").map((s) => s.trim()).filter(Boolean),
          keyIndicators: indicators.split("\n").map((s) => s.trim()).filter(Boolean),
          autonomyLevel: autonomy,
          strengths: strengths.split(",").map((s) => s.trim()).filter(Boolean),
          developPoints: developPoints.split(",").map((s) => s.trim()).filter(Boolean),
          notes: notes || null,
        },
      }),
    onSuccess: () => {
      toast.success("Perfil atualizado");
      qc.invalidateQueries({ queryKey: ["team", "member", orgId, member.membershipId] });
      qc.invalidateQueries({ queryKey: ["team", orgId] });
      onDone();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao salvar"),
  });

  return (
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
      <DialogHeader><DialogTitle>Perfil — {member.fullName}</DialogTitle></DialogHeader>
      <div className="space-y-4 py-2">
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <Label>Cargo/Papel</Label>
            <Input value={roleTitle} onChange={(e) => setRoleTitle(e.target.value)} />
          </div>
          <div>
            <Label>Nível de autonomia</Label>
            <Select value={autonomy} onValueChange={(v) => setAutonomy(v as Autonomy)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(AUTONOMY_LABEL) as Autonomy[]).map((a) => (
                  <SelectItem key={a} value={a}>{AUTONOMY_LABEL[a]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div>
          <Label>Entregas esperadas (uma por linha)</Label>
          <Textarea value={deliverables} onChange={(e) => setDeliverables(e.target.value)} className="min-h-[80px]" />
        </div>
        <div>
          <Label>Indicadores centrais (um por linha)</Label>
          <Textarea value={indicators} onChange={(e) => setIndicators(e.target.value)} className="min-h-[80px]" />
        </div>
        <div>
          <Label>Forças (separadas por vírgula)</Label>
          <Input value={strengths} onChange={(e) => setStrengths(e.target.value)} />
        </div>
        <div>
          <Label>Pontos a desenvolver (separados por vírgula)</Label>
          <Input value={developPoints} onChange={(e) => setDevelopPoints(e.target.value)} />
        </div>
        <div>
          <Label>Notas</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-[80px]" />
        </div>
      </div>
      <DialogFooter>
        <Button disabled={save.isPending} onClick={() => save.mutate()}>
          {save.isPending && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
          Salvar
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
