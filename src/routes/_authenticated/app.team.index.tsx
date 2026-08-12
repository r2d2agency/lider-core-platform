import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Download,
  Filter,
  Loader2,
  Pencil,
  Search,
  Sparkles,
  Grid3x3,
  TrendingUp,
  UserPlus,
  Users,
  Users2,
} from "lucide-react";
import PhoneInput, { isValidPhoneNumber } from 'react-phone-number-input';
import 'react-phone-number-input/style.css';
import { api } from "@/lib/api";

import { exportCsv } from "@/lib/csv-export";
import { useCurrentOrg } from "@/lib/use-current-org";
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
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/app/team/")({
  component: TeamPage,
});

type Autonomy = "n1_direciono" | "n2_acompanho" | "n3_valido" | "n4_delego" | "n5_autonomo";

const AUTONOMY_LABEL: Record<Autonomy, string> = {
  n1_direciono: "N1 — Direciono",
  n2_acompanho: "N2 — Acompanho",
  n3_valido: "N3 — Valido",
  n4_delego: "N4 — Delego",
  n5_autonomo: "N5 — Autônomo",
};

type TeamMember = {
  membershipId: string;
  userId: string;
  fullName: string;
  email: string;
  role: string;
  areaName: string | null;
  teamName: string | null;
  avatarUrl?: string | null;
  whatsapp?: string | null;
  phone?: string | null;
  profile: {
    roleTitle: string | null;
    expectedDeliverables: string[];
    keyIndicators: string[];
    autonomyLevel: Autonomy;
    strengths: string[];
    developPoints: string[];
    notes: string | null;
    performanceLevel: number | null;
    potentialLevel: number | null;
    discPrimary: string | null;
  } | null;
  openDelegations: number;
  feedbackCount: number;
  hasActivePdi: boolean;
};

type Status = "atencao" | "em_risco" | "no_ritmo" | "evoluindo" | "top";
const STATUS_META: Record<Status, { label: string; className: string; icon: typeof CheckCircle2 }> = {
  no_ritmo:  { label: "No ritmo",   className: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300", icon: CheckCircle2 },
  evoluindo: { label: "Evoluindo",  className: "bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300", icon: TrendingUp },
  atencao:   { label: "Atenção",    className: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300", icon: AlertTriangle },
  em_risco:  { label: "Em risco",   className: "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300", icon: AlertTriangle },
  top:       { label: "Top",        className: "bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300", icon: Sparkles },
};

function scoreFor(m: TeamMember) {
  // Derivamos um "CORE" heurístico a partir dos sinais disponíveis.
  const auto = { n1_direciono: -8, n2_acompanho: 0, n3_valido: 4, n4_delego: 8, n5_autonomo: 12 }[m.profile?.autonomyLevel ?? "n2_acompanho"];
  const raw = 70 + m.feedbackCount * 2 - m.openDelegations * 4 + (m.hasActivePdi ? 4 : 0) + auto;
  return Math.max(35, Math.min(99, Math.round(raw)));
}
function statusFor(m: TeamMember, s = scoreFor(m)): Status {
  if (s < 60) return "em_risco";
  if (s < 72) return "atencao";
  if (s >= 90) return "top";
  if (m.hasActivePdi || m.feedbackCount >= 3) return "evoluindo";
  return "no_ritmo";
}
function scoreColor(s: number) {
  if (s < 60) return "text-rose-600 dark:text-rose-400";
  if (s < 72) return "text-amber-600 dark:text-amber-400";
  if (s >= 90) return "text-violet-600 dark:text-violet-400";
  return "text-emerald-600 dark:text-emerald-400";
}
function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
}

function TeamPage() {
  const { orgId } = useCurrentOrg();
  const [editing, setEditing] = useState<TeamMember | null>(null);
  const [inviting, setInviting] = useState(false);
  const [filter, setFilter] = useState<"todos" | Status>("todos");
  const [q, setQ] = useState("");
  const [view, setView] = useState<"lista" | "nine_box">("lista");

  const { data: members = [], isLoading } = useQuery<TeamMember[]>({
    queryKey: ["team", orgId],
    enabled: !!orgId,
    queryFn: () => api<TeamMember[]>(`/organization/${orgId}/team`),
  });

  const enriched = useMemo(
    () => members.map((m) => {
      const score = scoreFor(m);
      return { m, score, status: statusFor(m, score) };
    }),
    [members],
  );

  const counts = useMemo(() => {
    const c: Record<Status, number> = { atencao: 0, em_risco: 0, no_ritmo: 0, evoluindo: 0, top: 0 };
    enriched.forEach((e) => (c[e.status] += 1));
    return c;
  }, [enriched]);

  if (!orgId) return null;

  const areas = new Set(members.map((m) => m.areaName).filter(Boolean));
  const avgHealth = enriched.length
    ? Math.round(enriched.reduce((s, e) => s + e.score, 0) / enriched.length)
    : 0;

  const visible = enriched
    .filter((e) => (filter === "todos" ? true : e.status === filter))
    .filter((e) => (q ? (e.m.fullName + " " + (e.m.profile?.roleTitle ?? "")).toLowerCase().includes(q.toLowerCase()) : true));

  const tabs: { key: "todos" | Status; label: string; count?: number; danger?: boolean }[] = [
    { key: "todos",     label: "Todos" },
    { key: "atencao",   label: "Atenção",       count: counts.atencao,   danger: true },
    { key: "em_risco",  label: "Em risco",      count: counts.em_risco,  danger: true },
    { key: "evoluindo", label: "Evoluindo" },
    { key: "top",       label: "Top performers" },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Equipe</div>
          <h1 className="mt-2 font-display text-4xl leading-tight">Minha equipe</h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            Acompanhe sua equipe, veja indicadores individuais e identifique quem precisa da sua atenção.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setView(view === "lista" ? "nine_box" : "lista")}
            className={
              "inline-flex h-10 items-center gap-2 rounded-full border px-4 text-sm transition-colors " +
              (view === "nine_box"
                ? "border-foreground bg-foreground text-background"
                : "border-border bg-card text-foreground hover:bg-secondary")
            }
          >
            <Grid3x3 className="h-4 w-4" /> 9-box
          </button>
          <button
            aria-label="Buscar"
            className="grid h-10 w-10 place-items-center rounded-full border border-border bg-card text-muted-foreground hover:bg-secondary"
            onClick={() => {
              const el = document.getElementById("team-search") as HTMLInputElement | null;
              el?.focus();
            }}
          >
            <Search className="h-4 w-4" />
          </button>
          <button className="inline-flex h-10 items-center gap-2 rounded-full border border-border bg-card px-4 text-sm text-foreground hover:bg-secondary">
            <Filter className="h-4 w-4" /> Filtros
          </button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1"
            disabled={!enriched.length}
            onClick={() =>
              exportCsv(
                `equipe-${new Date().toISOString().slice(0, 10)}.csv`,
                enriched,
                [
                  { key: "fullName", label: "Nome", get: (e) => e.m.fullName },
                  { key: "email", label: "E-mail", get: (e) => e.m.email },
                  { key: "role", label: "Papel", get: (e) => e.m.profile?.roleTitle ?? e.m.role },
                  { key: "area", label: "Área", get: (e) => e.m.areaName ?? "" },
                  { key: "team", label: "Time", get: (e) => e.m.teamName ?? "" },
                  { key: "score", label: "Score CORE" },
                  { key: "status", label: "Status", get: (e) => STATUS_META[e.status].label },
                  { key: "autonomy", label: "Autonomia", get: (e) => (e.m.profile ? AUTONOMY_LABEL[e.m.profile.autonomyLevel] : "") },
                  { key: "openDelegations", label: "Delegações abertas", get: (e) => e.m.openDelegations },
                  { key: "feedbackCount", label: "Feedbacks", get: (e) => e.m.feedbackCount },
                  { key: "hasActivePdi", label: "PDI ativo", get: (e) => (e.m.hasActivePdi ? "sim" : "não") },
                ],
              )
            }
          >
            <Download className="h-3.5 w-3.5" /> CSV
          </Button>
        </div>
      </header>

      <div className="sr-only">
        <Input id="team-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar" />
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi
          icon={Users2}
          tint="slate"
          value={members.length}
          label="Pessoas"
          hint={areas.size ? `em ${areas.size} ${areas.size === 1 ? "área" : "áreas"}` : "—"}
        />
        <Kpi
          icon={CheckCircle2}
          tint="emerald"
          value={counts.no_ritmo + counts.evoluindo + counts.top}
          label="No ritmo"
          hint={members.length ? `${Math.round(((counts.no_ritmo + counts.evoluindo + counts.top) / members.length) * 100)}% da equipe` : "—"}
        />
        <Kpi
          icon={AlertTriangle}
          tint="amber"
          value={counts.atencao}
          label="Precisam atenção"
          hint={members.length ? `${Math.round((counts.atencao / members.length) * 100)}% da equipe` : "—"}
        />
        <Kpi
          icon={Activity}
          tint="sky"
          value={avgHealth || "—"}
          label="Health Score"
          hint="da equipe"
        />
      </div>

      {/* Tabs */}
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1">
        {tabs.map((t) => {
          const active = filter === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setFilter(t.key)}
              className={
                "inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm transition-colors " +
                (active
                  ? "bg-foreground text-background"
                  : "border border-border bg-card text-foreground hover:bg-secondary")
              }
            >
              {t.label}
              {t.count ? (
                <span
                  className={
                    "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold " +
                    (t.danger
                      ? "bg-rose-500 text-white"
                      : active
                      ? "bg-background/20 text-background"
                      : "bg-secondary text-foreground")
                  }
                >
                  {t.count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
        </div>
      )}

      {!isLoading && members.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border bg-secondary/30 p-8 text-center">
          <Users className="mx-auto h-8 w-8 text-muted-foreground" />
          <div className="mt-3 font-medium">Nenhum membro na organização ainda</div>
        </div>
      )}

      {view === "nine_box" ? (
        <NineBoxMatrix orgId={orgId} members={members} onEdit={setEditing} />
      ) : (
      <div className="space-y-3">
        {visible.map(({ m, score, status }) => (
          <MemberRow key={m.membershipId} m={m} score={score} status={status} onEdit={() => setEditing(m)} />
        ))}
        {!isLoading && visible.length === 0 && members.length > 0 && (
          <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Ninguém neste filtro.
          </div>
        )}
      </div>
      )}

      <button
        onClick={() => setInviting(true)}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-card px-4 py-4 text-sm text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
      >
        <UserPlus className="h-4 w-4" /> Adicionar pessoa à equipe
      </button>

      <IACoachCard members={enriched} />

      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        {editing && (
          <ProfileDialog orgId={orgId} member={editing} onDone={() => setEditing(null)} />
        )}
      </Dialog>
      <Dialog open={inviting} onOpenChange={setInviting}>
        {inviting && <InviteDialog orgId={orgId} onDone={() => setInviting(false)} />}
      </Dialog>
    </div>
  );
}

function Kpi({
  icon: Icon,
  tint,
  value,
  label,
  hint,
}: {
  icon: typeof CheckCircle2;
  tint: "slate" | "emerald" | "amber" | "sky";
  value: number | string;
  label: string;
  hint: string;
}) {
  const TINT: Record<string, { bg: string; fg: string }> = {
    slate:   { bg: "bg-secondary",                                    fg: "text-foreground" },
    emerald: { bg: "bg-emerald-50 dark:bg-emerald-500/15",            fg: "text-emerald-600 dark:text-emerald-300" },
    amber:   { bg: "bg-amber-50 dark:bg-amber-500/15",                fg: "text-amber-600 dark:text-amber-300" },
    sky:     { bg: "bg-sky-50 dark:bg-sky-500/15",                    fg: "text-sky-600 dark:text-sky-300" },
  };
  const t = TINT[tint];
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className={"grid h-9 w-9 place-items-center rounded-xl " + t.bg + " " + t.fg}>
        <Icon className="h-4 w-4" strokeWidth={1.75} />
      </div>
      <div className="mt-3 font-display text-3xl leading-none">{value}</div>
      <div className="mt-1 text-[13px] text-foreground">{label}</div>
      <div className="mt-0.5 text-[11px] text-muted-foreground">{hint}</div>
    </div>
  );
}

function MemberRow({
  m,
  score,
  status,
  onEdit,
}: {
  m: TeamMember;
  score: number;
  status: Status;
  onEdit: () => void;
}) {
  const meta = STATUS_META[status];
  const Secondary = secondaryFor(m);
  return (
      <Link
        to="/app/team/$membershipId"
        params={{ membershipId: m.membershipId }}
        className="group flex items-center gap-3 rounded-2xl border border-border bg-card p-3 pr-4 transition-shadow hover:shadow-sm"
      >
        <Avatar name={m.fullName} url={m.avatarUrl ?? null} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[15px] font-semibold text-foreground">{m.fullName}</div>
        <div className="truncate text-xs text-muted-foreground">
          {m.profile?.roleTitle || AUTONOMY_LABEL[m.profile?.autonomyLevel ?? "n2_acompanho"]}
          {m.areaName ? ` · ${m.areaName}` : ""}
        </div>
      </div>

      <span className={"inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold " + meta.className}>
        <meta.icon className="h-3 w-3" /> {meta.label}
      </span>

      <div className="hidden w-16 text-center sm:block">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">CORE</div>
        <div className={"font-display text-lg leading-none " + scoreColor(score)}>{score}</div>
      </div>

      <div className="hidden w-24 text-center md:block">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{Secondary.label}</div>
        <div className={"text-sm font-medium " + Secondary.tone}>{Secondary.value}</div>
      </div>

      <span
        aria-label="Abrir perfil"
        className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground transition-colors group-hover:bg-secondary group-hover:text-foreground"
      >
        <ChevronRight className="h-4 w-4" />
      </span>
      </Link>
  );
}

function secondaryFor(m: TeamMember): { label: string; value: string; tone: string } {
  if (m.openDelegations > 0) {
    const danger = m.openDelegations >= 3;
    return {
      label: "Delegações",
      value: `${m.openDelegations} aberta${m.openDelegations === 1 ? "" : "s"}`,
      tone: danger ? "text-rose-600 dark:text-rose-400" : "text-foreground",
    };
  }
  if (m.hasActivePdi) return { label: "PDI", value: "Ativo", tone: "text-emerald-600 dark:text-emerald-400" };
  if (m.feedbackCount > 0) return { label: "Feedbacks", value: String(m.feedbackCount), tone: "text-foreground" };
  return { label: "PDI", value: "Parado", tone: "text-amber-600 dark:text-amber-400" };
}

function Avatar({ name, url }: { name: string; url: string | null }) {
  if (url) {
    return <img src={url} alt={name} className="h-11 w-11 rounded-full object-cover" />;
  }
  return (
    <div className="grid h-11 w-11 place-items-center rounded-full bg-secondary text-sm font-semibold text-foreground">
      {initials(name) || "·"}
    </div>
  );
}

function IACoachCard({ members }: { members: { m: TeamMember; score: number; status: Status }[] }) {
  const target = members
    .filter((e) => e.status === "atencao" || e.status === "em_risco")
    .sort((a, b) => a.score - b.score)[0]?.m;
  const msg = target
    ? `${target.fullName.split(" ")[0]} precisa da sua atenção. Deseja preparar uma conversa?`
    : "Sua equipe está no ritmo. Quer preparar um 1:1 com alguém específico?";
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-violet-200 bg-violet-50/60 p-4 dark:border-violet-500/25 dark:bg-violet-500/10">
      <div className="flex items-start gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-violet-500/15 text-violet-600 dark:text-violet-300">
          <Sparkles className="h-4 w-4" />
        </div>
        <div>
          <div className="text-sm font-semibold text-foreground">IA Coach</div>
          <div className="mt-0.5 max-w-md text-xs text-muted-foreground">{msg}</div>
        </div>
      </div>
      <Link
        to="/app/ai"
        search={{ q: undefined }}
        className="inline-flex items-center gap-1 rounded-full border border-violet-300/70 bg-background px-3 py-1.5 text-xs font-medium text-violet-700 hover:bg-violet-100 dark:border-violet-500/40 dark:text-violet-200 dark:hover:bg-violet-500/15"
      >
        Preparar conversa →
      </Link>
    </div>
  );
}

function Block({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{title}</div>
      {items.length === 0 ? (
        <div className="mt-1 text-xs text-muted-foreground">—</div>
      ) : (
        <ul className="mt-1 space-y-0.5 text-sm">
          {items.map((v, i) => (
            <li key={i}>· {v}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number | string; tone?: "ok" | "muted" }) {
  return (
    <span
      className={
        "rounded-full border px-2 py-0.5 " +
        (tone === "ok"
          ? "border-success/40 text-success"
          : tone === "muted"
          ? "border-border text-muted-foreground"
          : "border-border text-foreground")
      }
    >
      {label}: {value}
    </span>
  );
}

function ProfileDialog({
  orgId,
  member,
  onDone,
}: {
  orgId: string;
  member: TeamMember;
  onDone: () => void;
}) {
  const qc = useQueryClient();
  const [roleTitle, setRoleTitle] = useState(member.profile?.roleTitle ?? "");
  const [whatsapp, setWhatsapp] = useState<string | undefined>(member.whatsapp ?? undefined);
  const [deliverables, setDeliverables] = useState((member.profile?.expectedDeliverables ?? []).join("\n"));
  const [indicators, setIndicators] = useState((member.profile?.keyIndicators ?? []).join("\n"));
  const [autonomy, setAutonomy] = useState<Autonomy>(member.profile?.autonomyLevel ?? "n2_acompanho");
  const [strengths, setStrengths] = useState((member.profile?.strengths ?? []).join(", "));
  const [developPoints, setDevelopPoints] = useState((member.profile?.developPoints ?? []).join(", "));
  const [notes, setNotes] = useState(member.profile?.notes ?? "");

  const save = useMutation({
    mutationFn: async () => {
      if (whatsapp && !isValidPhoneNumber(whatsapp)) {
        throw new Error("Número de WhatsApp inválido");
      }

      await api(`/organization/${orgId}/team/${member.membershipId}/profile`, {
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
      });
      if ((whatsapp || null) !== (member.whatsapp ?? null)) {
        await api(`/organization/${orgId}/team/${member.membershipId}/contact`, {
          method: "PUT",
          body: { whatsapp: whatsapp || null, phone: whatsapp || null },
        });
      }
    },

    onSuccess: () => {
      toast.success("Perfil atualizado");
      qc.invalidateQueries({ queryKey: ["team", orgId] });
      onDone();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao salvar"),
  });

  return (
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle>Perfil — {member.fullName}</DialogTitle>
      </DialogHeader>
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
        <div className="whatsapp-input-container">
          <Label>WhatsApp</Label>
          <PhoneInput
            defaultCountry="BR"
            value={whatsapp}
            onChange={setWhatsapp}
            placeholder="Ex.: +55 11 90000-0000"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          />
          <p className="mt-1 text-[11px] text-muted-foreground">
            Preenche automaticamente o envio de Pulsos por WhatsApp.
          </p>
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

// ============================================================
// 9-Box: Performance × Potencial
// ============================================================
const PERF_LABEL = ["Baixa", "Média", "Alta"] as const;
const POT_LABEL  = ["Baixo", "Médio", "Alto"] as const;
const BOX_LABEL: Record<string, { title: string; tone: string }> = {
  "3-1": { title: "Enigma",           tone: "bg-sky-50 dark:bg-sky-500/10" },
  "3-2": { title: "Crescimento",      tone: "bg-sky-100 dark:bg-sky-500/15" },
  "3-3": { title: "Estrela",          tone: "bg-emerald-100 dark:bg-emerald-500/20" },
  "2-1": { title: "Dilema",           tone: "bg-amber-50 dark:bg-amber-500/10" },
  "2-2": { title: "Mantenedor",       tone: "bg-secondary" },
  "2-3": { title: "Alta performance", tone: "bg-emerald-50 dark:bg-emerald-500/10" },
  "1-1": { title: "Insuficiente",     tone: "bg-rose-50 dark:bg-rose-500/10" },
  "1-2": { title: "Efetivo",          tone: "bg-secondary" },
  "1-3": { title: "Especialista",     tone: "bg-sky-50 dark:bg-sky-500/10" },
};

function NineBoxMatrix({
  orgId, members, onEdit,
}: { orgId: string; members: TeamMember[]; onEdit: (m: TeamMember) => void }) {
  const qc = useQueryClient();
  const [picking, setPicking] = useState<TeamMember | null>(null);

  const save = useMutation({
    mutationFn: ({ id, perf, pot }: { id: string; perf: number; pot: number }) =>
      api(`/organization/${orgId}/team/${id}/box`, {
        method: "PUT",
        body: { performanceLevel: perf, potentialLevel: pot },
      }),
    onSuccess: () => {
      toast.success("Posição atualizada.");
      qc.invalidateQueries({ queryKey: ["team", orgId] });
      setPicking(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cellOf = (perf: number, pot: number) =>
    members.filter(
      (m) => m.profile?.performanceLevel === perf && m.profile?.potentialLevel === pot,
    );
  const unclassified = members.filter(
    (m) => !m.profile?.performanceLevel || !m.profile?.potentialLevel,
  );

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="mb-3 flex items-baseline justify-between">
          <div>
            <div className="font-display text-lg leading-tight">Matriz 9-box</div>
            <p className="text-xs text-muted-foreground">Performance atual × potencial futuro. Clique numa pessoa para reposicionar.</p>
          </div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
            {members.length - unclassified.length}/{members.length} posicionados
          </div>
        </div>

        <div className="flex gap-3">
          {/* eixo Y = potencial */}
          <div className="flex w-6 flex-col justify-between py-4 text-[10px] uppercase tracking-widest text-muted-foreground">
            <span className="-rotate-90 origin-left translate-y-2">Alto</span>
            <span className="-rotate-90 origin-left translate-y-2">Médio</span>
            <span className="-rotate-90 origin-left translate-y-2">Baixo</span>
          </div>
          <div className="flex-1">
            <div className="grid grid-cols-3 gap-2">
              {[3, 2, 1].map((pot) =>
                [1, 2, 3].map((perf) => {
                  const key = `${perf}-${pot}`;
                  const box = BOX_LABEL[key];
                  const people = cellOf(perf, pot);
                  return (
                    <div key={key} className={"min-h-[110px] rounded-xl border border-border/70 p-2 " + box.tone}>
                      <div className="mb-1.5 flex items-center justify-between text-[10px] uppercase tracking-widest text-muted-foreground">
                        <span className="font-semibold text-foreground/80">{box.title}</span>
                        <span>{people.length}</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {people.map((m) => (
                          <button
                            key={m.membershipId}
                            title={m.fullName}
                            onClick={() => setPicking(m)}
                            className="inline-flex items-center gap-1 rounded-full border border-border bg-background/90 px-2 py-0.5 text-[11px] font-medium text-foreground hover:bg-secondary"
                          >
                            <span className="grid h-4 w-4 place-items-center rounded-full bg-secondary text-[9px] font-bold">
                              {initials(m.fullName)}
                            </span>
                            <span className="max-w-[100px] truncate">{m.fullName.split(" ")[0]}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                }),
              )}
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2 text-center text-[10px] uppercase tracking-widest text-muted-foreground">
              <span>Perf. baixa</span><span>Perf. média</span><span>Perf. alta</span>
            </div>
          </div>
        </div>
      </div>

      {unclassified.length > 0 && (
        <div className="rounded-2xl border border-dashed border-border p-4">
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Sem classificação ({unclassified.length})
          </div>
          <div className="flex flex-wrap gap-2">
            {unclassified.map((m) => (
              <button
                key={m.membershipId}
                onClick={() => setPicking(m)}
                className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-sm hover:bg-secondary"
              >
                <span className="grid h-6 w-6 place-items-center rounded-full bg-secondary text-[10px] font-bold">
                  {initials(m.fullName)}
                </span>
                {m.fullName}
              </button>
            ))}
          </div>
        </div>
      )}

      <Dialog open={!!picking} onOpenChange={(o) => !o && setPicking(null)}>
        {picking && (
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Posicionar — {picking.fullName}</DialogTitle>
            </DialogHeader>
            <NineBoxPicker
              initialPerf={picking.profile?.performanceLevel ?? null}
              initialPot={picking.profile?.potentialLevel ?? null}
              saving={save.isPending}
              onOpenProfile={() => { const m = picking; setPicking(null); onEdit(m); }}
              onSave={(perf, pot) => save.mutate({ id: picking.membershipId, perf, pot })}
            />
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}

function NineBoxPicker({
  initialPerf, initialPot, saving, onSave, onOpenProfile,
}: {
  initialPerf: number | null;
  initialPot: number | null;
  saving: boolean;
  onSave: (perf: number, pot: number) => void;
  onOpenProfile: () => void;
}) {
  const [perf, setPerf] = useState<number>(initialPerf ?? 2);
  const [pot, setPot]   = useState<number>(initialPot ?? 2);
  return (
    <div className="space-y-4 py-2">
      <div>
        <Label className="text-xs uppercase tracking-widest text-muted-foreground">Performance atual</Label>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {[1, 2, 3].map((v) => (
            <button
              key={v}
              onClick={() => setPerf(v)}
              className={
                "rounded-xl border p-2 text-sm transition-colors " +
                (perf === v
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-card hover:bg-secondary")
              }
            >
              {PERF_LABEL[v - 1]}
            </button>
          ))}
        </div>
      </div>
      <div>
        <Label className="text-xs uppercase tracking-widest text-muted-foreground">Potencial</Label>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {[1, 2, 3].map((v) => (
            <button
              key={v}
              onClick={() => setPot(v)}
              className={
                "rounded-xl border p-2 text-sm transition-colors " +
                (pot === v
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-card hover:bg-secondary")
              }
            >
              {POT_LABEL[v - 1]}
            </button>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-between gap-2">
        <button onClick={onOpenProfile} className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground">
          Editar perfil completo →
        </button>
        <Button disabled={saving} onClick={() => onSave(perf, pot)}>
          {saving ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}Salvar
        </Button>
      </div>
    </div>
  );
}

function InviteDialog({ orgId, onDone }: { orgId: string; onDone: () => void }) {
  const qc = useQueryClient();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState<string | undefined>("");
  const [roleTitle, setRoleTitle] = useState("");
  const [role, setRole] = useState<"collaborator" | "leader" | "hr_admin">("collaborator");
  const [autonomy, setAutonomy] = useState<Autonomy>("n2_acompanho");
  const [deliverables, setDeliverables] = useState("");
  const [notes, setNotes] = useState("");

  const create = useMutation({
    mutationFn: () => {
      if (whatsapp && !isValidPhoneNumber(whatsapp)) {
        throw new Error("Número de WhatsApp inválido");
      }
      return api(`/organization/${orgId}/team`, {
        method: "POST",
        body: {
          fullName,
          email,
          whatsapp: whatsapp || null,
          phone: whatsapp || null,
          role,
          roleTitle: roleTitle || null,
          autonomyLevel: autonomy,
          expectedDeliverables: deliverables.split("\n").map((s) => s.trim()).filter(Boolean),
          notes: notes || null,
        },
      });
    },

    onSuccess: () => {
      toast.success("Pessoa adicionada à equipe");
      qc.invalidateQueries({ queryKey: ["team", orgId] });
      onDone();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao adicionar"),
  });

  return (
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
      <DialogHeader>
        <DialogTitle>Adicionar pessoa à equipe</DialogTitle>
      </DialogHeader>
      <div className="space-y-4 py-2">
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <Label>Nome completo *</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Ex.: Ana Souza" />
          </div>
          <div>
            <Label>E-mail *</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ana@empresa.com" />
          </div>
          <div className="whatsapp-input-container">
            <Label>WhatsApp</Label>
            <PhoneInput
              defaultCountry="BR"
              value={whatsapp}
              onChange={setWhatsapp}
              placeholder="Ex.: +55 11 90000-0000"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              Usado para enviar Pulsos direto pelo WhatsApp.
            </p>
          </div>

          <div>
            <Label>Cargo</Label>
            <Input value={roleTitle} onChange={(e) => setRoleTitle(e.target.value)} placeholder="Ex.: Analista de Marketing" />
          </div>
          <div>
            <Label>Papel no sistema</Label>
            <Select value={role} onValueChange={(v) => setRole(v as typeof role)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="collaborator">Colaborador</SelectItem>
                <SelectItem value="leader">Líder</SelectItem>
                <SelectItem value="hr_admin">RH / Admin</SelectItem>
              </SelectContent>
            </Select>
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
          <Label>Obrigações / entregas esperadas (uma por linha)</Label>
          <Textarea
            value={deliverables}
            onChange={(e) => setDeliverables(e.target.value)}
            className="min-h-[90px]"
            placeholder={"Ex.: Publicar 4 conteúdos por semana\nRelatório mensal de campanhas"}
          />
        </div>
        <div>
          <Label>Notas</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-[70px]" />
        </div>
      </div>
      <DialogFooter>
        <Button
          disabled={create.isPending || !fullName || !email}
          onClick={() => create.mutate()}
        >
          {create.isPending && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
          Adicionar à equipe
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
