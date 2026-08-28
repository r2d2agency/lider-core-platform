import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useCurrentOrg } from "@/lib/use-current-org";
import { useMemo, useState } from "react";
import {
  BarChart3,
  CalendarDays,
  ChevronRight,
  ClipboardList,
  ScrollText,
  Users,
  Workflow,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Handshake,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/organization/agenda")({
  component: AgendaPage,
});

type Entry = {
  kind: "ritual" | "delegation" | "decision" | "agreement";
  id: string;
  at: string;
  title: string;
  subtitle: string;
  status: string;
};

type Range = "day" | "week" | "month";

function AgendaPage() {
  const { orgId } = useCurrentOrg();
  const [range, setRange] = useState<Range>("week");
  const [selectedDay, setSelectedDay] = useState<Date>(startOfDay(new Date()));

  const q = useQuery({
    queryKey: ["org", "agenda", orgId, range],
    queryFn: () => api<{ entries: Entry[] }>(`/organization/${orgId}/agenda?range=${range}`),
    enabled: !!orgId,
  });

  const entries = q.data?.entries ?? [];
  const weekDays = useMemo(() => buildWeek(selectedDay), [selectedDay]);
  const weekRange = useMemo(() => formatWeekRange(weekDays[0], weekDays[6]), [weekDays]);

  const eventsByDay = useMemo(() => {
    const m = new Map<string, Entry[]>();
    for (const e of entries) {
      const k = dayKey(new Date(e.at));
      const arr = m.get(k);
      if (arr) arr.push(e);
      else m.set(k, [e]);
    }
    return m;
  }, [entries]);

  const todaysEvents = useMemo(() => {
    const k = dayKey(selectedDay);
    return (eventsByDay.get(k) ?? []).slice().sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
  }, [eventsByDay, selectedDay]);

  const kpis = useMemo(() => {
    const rituals = entries.filter((e) => e.kind === "ritual").length;
    const agreements = entries.filter((e) => e.kind === "agreement").length;
    const late = entries.filter((e) =>
      (e.kind === "delegation" || e.kind === "agreement") &&
      (e.status === "overdue" || e.status === "late"),
    ).length;
    return { commitments: entries.length, rituals, agreements, late };
  }, [entries]);

  return (
    <div className="space-y-5">
      {/* Tabs de intervalo + range chip */}
      <section className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card p-1">
          {(["day", "week", "month"] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              className={
                "rounded-full px-4 py-1.5 text-sm font-medium transition-colors " +
                (range === r ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")
              }
            >
              {r === "day" ? "Hoje" : r === "week" ? "Semana" : "Mês"}
            </button>
          ))}
        </div>

        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-foreground/80 hover:border-accent/40 hover:text-foreground"
        >
          <CalendarDays className="h-4 w-4" />
          {weekRange}
          <ChevronRight className="h-4 w-4 rotate-90 text-muted-foreground" />
        </button>
      </section>

      {/* Strip de dias da semana */}
      <section className="grid grid-cols-7 gap-2">
        {weekDays.map((d) => {
          const active = sameDay(d, selectedDay);
          const count = eventsByDay.get(dayKey(d))?.length ?? 0;
          return (
            <button
              key={d.toISOString()}
              type="button"
              onClick={() => setSelectedDay(d)}
              className={
                "relative flex flex-col items-center gap-1 rounded-2xl border px-1 py-3 text-center transition-colors " +
                (active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-foreground hover:border-accent/40")
              }
            >
              <span className={"text-[10px] font-bold uppercase tracking-widest " + (active ? "text-primary-foreground/70" : "text-muted-foreground")}>
                {weekdayLabel(d)}
              </span>
              <span className="font-display text-2xl leading-none tabular-nums">
                {d.getDate().toString().padStart(2, "0")}
              </span>
              <span className={"text-[10px] " + (active ? "text-primary-foreground/80" : "text-muted-foreground")}>
                {count === 0 ? "0 eventos" : count === 1 ? "1 evento" : `${count} eventos`}
              </span>
              {active && count > 0 && (
                <span className="absolute bottom-1.5 h-1 w-1 rounded-full bg-accent" />
              )}
            </button>
          );
        })}
      </section>

      {/* KPIs */}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <KpiTile
          icon={CalendarDays}
          value={kpis.commitments}
          label={"Compromissos\nno período"}
          tint="orange"
        />
        <KpiTile
          icon={Workflow}
          value={kpis.rituals}
          label={"Rituais\nagendados"}
          tint="violet"
        />
        <KpiTile
          icon={Handshake}
          value={kpis.agreements}
          label={"Acordos\ncom prazo"}
          tint="sky"
        />
        <KpiTile
          icon={kpis.late > 0 ? AlertTriangle : CheckCircle2}
          value={kpis.late}
          label={"Atrasos\nidentificados"}
          tint={kpis.late > 0 ? "rose" : "emerald"}
        />
      </section>

      {/* Eventos de hoje */}
      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="font-display text-lg">Eventos de {sameDay(selectedDay, new Date()) ? "hoje" : formatShortDay(selectedDay)}</h2>
          <Link to="/app/organization/agenda" className="inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline">
            Ver agenda completa <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {q.isLoading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => <div key={i} className="h-20 animate-pulse rounded-2xl bg-muted" />)}
          </div>
        ) : todaysEvents.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-10 text-center">
            <Sparkles className="mx-auto h-6 w-6 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">Nenhum evento neste dia.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {todaysEvents.map((e, i) => (
              <EventRow key={e.kind + e.id} e={e} index={i} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function EventRow({ e, index }: { e: Entry; index: number }) {
  const Icon =
    e.kind === "ritual" ? Workflow :
    e.kind === "delegation" ? ClipboardList :
    e.kind === "agreement" ? Handshake :
    ScrollText;
  // Alterna ícones com base no título quando parece 1:1 / reunião de equipe / indicadores
  const t = e.title.toLowerCase();
  const RealIcon =
    t.startsWith("1:1") || t.includes("check-in") ? Users :
    t.includes("indica") || t.includes("resultado") ? BarChart3 :
    t.includes("reunião") || t.includes("reuniao") ? Users :
    Icon;
  const tint = eventTint(e.kind, index);
  const dur = estimateDuration(e);
  const rel = relTimeShort(new Date(e.at));

  return (
    <li>
      <div className="grid grid-cols-[64px_auto_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 transition hover:border-accent/30">
        <div className="border-l-2 border-accent pl-3">
          <div className="text-sm font-bold tabular-nums">{formatTime(e.at)}</div>
          <div className="text-[11px] text-muted-foreground">{dur}</div>
        </div>
        <span className={`grid h-10 w-10 place-items-center rounded-full ${tint.bg} ${tint.fg}`}>
          <RealIcon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{e.title}</div>
          <div className="truncate text-xs text-muted-foreground">{e.subtitle}</div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold ${rel.cls}`}>{rel.label}</span>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </div>
      </div>
    </li>
  );
}

// ---------- KPI Tile ----------

type Tint = "orange" | "violet" | "emerald" | "rose" | "sky";
const TINTS: Record<Tint, { card: string; icon: string; iconBg: string; text: string }> = {
  orange:  { card: "bg-accent/8 border-accent/25",                         icon: "text-accent",                        iconBg: "bg-accent/15",                          text: "text-foreground" },
  violet:  { card: "bg-violet-50 border-violet-200 dark:bg-violet-500/10 dark:border-violet-500/20",     icon: "text-violet-600 dark:text-violet-300",  iconBg: "bg-violet-100 dark:bg-violet-500/15",   text: "text-foreground" },
  emerald: { card: "bg-emerald-50 border-emerald-200 dark:bg-emerald-500/10 dark:border-emerald-500/20", icon: "text-emerald-600 dark:text-emerald-300",iconBg: "bg-emerald-100 dark:bg-emerald-500/15", text: "text-foreground" },
  rose:    { card: "bg-rose-50 border-rose-200 dark:bg-rose-500/10 dark:border-rose-500/20",             icon: "text-rose-600 dark:text-rose-300",      iconBg: "bg-rose-100 dark:bg-rose-500/15",       text: "text-foreground" },
  sky:     { card: "bg-sky-50 border-sky-200 dark:bg-sky-500/10 dark:border-sky-500/20",                 icon: "text-sky-600 dark:text-sky-300",        iconBg: "bg-sky-100 dark:bg-sky-500/15",         text: "text-foreground" },
};

function KpiTile({ icon: Icon, value, label, tint }: { icon: typeof CalendarDays; value: number; label: string; tint: Tint }) {
  const s = TINTS[tint];
  return (
    <div className={`flex items-center gap-4 rounded-2xl border p-4 ${s.card}`}>
      <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${s.iconBg} ${s.icon}`}>
        <Icon className="h-5 w-5" strokeWidth={1.75} />
      </span>
      <div className="min-w-0">
        <div className={`font-display text-3xl leading-none tabular-nums ${s.text}`}>{value}</div>
        <div className="mt-1 whitespace-pre-line text-xs font-medium text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}

// ---------- Helpers ----------

function startOfDay(d: Date) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function sameDay(a: Date, b: Date) { return dayKey(a) === dayKey(b); }
function dayKey(d: Date) { return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; }

function buildWeek(reference: Date): Date[] {
  // Semana começando na segunda
  const d = startOfDay(reference);
  const dow = (d.getDay() + 6) % 7; // 0 = seg
  const monday = new Date(d);
  monday.setDate(d.getDate() - dow);
  return Array.from({ length: 7 }, (_, i) => {
    const x = new Date(monday);
    x.setDate(monday.getDate() + i);
    return x;
  });
}

function weekdayLabel(d: Date) {
  return ["SEG", "TER", "QUA", "QUI", "SEX", "SÁB", "DOM"][((d.getDay() + 6) % 7)];
}

function formatWeekRange(a: Date, b: Date) {
  const month = new Intl.DateTimeFormat("pt-BR", { month: "short" }).format(b).replace(".", "");
  return `${a.getDate()} – ${b.getDate()} ${cap(month)}`;
}

function cap(s: string) { return s.charAt(0).toUpperCase() + s.slice(1); }

function formatShortDay(d: Date) {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(d);
}

function formatTime(iso: string | Date) {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function estimateDuration(e: Entry) {
  const t = e.title.toLowerCase();
  if (t.startsWith("1:1")) return "30min";
  if (t.includes("check-in")) return "15min";
  if (t.includes("ritual")) return "45min";
  if (t.includes("reunião") || t.includes("reuniao")) return "1h";
  if (e.kind === "agreement") return "Prazo";
  return "30min";
}

function eventTint(kind: Entry["kind"], i: number): { bg: string; fg: string } {
  if (kind === "ritual") return { bg: "bg-violet-100 dark:bg-violet-500/15", fg: "text-violet-600 dark:text-violet-300" };
  if (kind === "decision") return { bg: "bg-sky-100 dark:bg-sky-500/15", fg: "text-sky-600 dark:text-sky-300" };
  if (kind === "agreement") return { bg: "bg-rose-100 dark:bg-rose-500/15", fg: "text-rose-600 dark:text-rose-300" };
  const alts = [
    { bg: "bg-emerald-100 dark:bg-emerald-500/15", fg: "text-emerald-600 dark:text-emerald-300" },
    { bg: "bg-accent/15", fg: "text-accent" },
  ];
  return alts[i % alts.length];
}

function relTimeShort(d: Date): { label: string; cls: string } {
  const diff = d.getTime() - Date.now();
  const min = Math.round(diff / 60000);
  if (min < -5) return { label: "Encerrado", cls: "bg-muted text-muted-foreground" };
  if (min <= 0) return { label: "Agora", cls: "bg-accent/15 text-accent" };
  if (min < 60) return { label: `Em ${min}min`, cls: "bg-accent/15 text-accent" };
  const h = Math.floor(min / 60);
  const m = min % 60;
  const label = m ? `Em ${h}h ${m}min` : `Em ${h}h`;
  if (h < 6) return { label, cls: "bg-accent/10 text-accent" };
  if (h < 24) return { label, cls: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300" };
  const days = Math.round(h / 24);
  return { label: `Em ${days}d`, cls: "bg-muted text-muted-foreground" };
}
