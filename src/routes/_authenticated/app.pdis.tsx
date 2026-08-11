import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  BookOpen,
  CalendarClock,
  CheckCircle2,
  Filter,
  Loader2,
  Plus,
  Search,
  Target,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { api } from "@/lib/api";
import { useCurrentOrg } from "@/lib/use-current-org";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
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

export const Route = createFileRoute("/_authenticated/app/pdis")({
  component: PdisPage,
  head: () => ({
    meta: [
      { title: "PDIs · LíderCore" },
      {
        name: "description",
        content: "Planos de desenvolvimento individual dos seus liderados, com metas, prazos e status.",
      },
      { property: "og:title", content: "PDIs · LíderCore" },
      {
        property: "og:description",
        content: "Acompanhe a evolução das pessoas com metas concretas e prazos.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

type GoalStatus = "a_fazer" | "em_andamento" | "concluido" | "atrasado";
type PdiStatus = "ativo" | "concluido" | "pausado" | "cancelado";

type Goal = {
  id: string;
  title: string;
  action: string | null;
  dueAt: string | null;
  status: GoalStatus;
  evidence: string | null;
};
type Pdi = {
  id: string;
  subjectUserId: string;
  title: string;
  focus: string | null;
  summary: string | null;
  reviewAt: string | null;
  status: PdiStatus;
  createdAt: string;
  goals: Goal[];
};

type TeamOption = { membershipId: string; userId: string; fullName: string };

const GOAL_STATUS: Record<GoalStatus, string> = {
  a_fazer: "A fazer",
  em_andamento: "Em andamento",
  concluido: "Concluído",
  atrasado: "Atrasado",
};
const PDI_STATUS: Record<PdiStatus, string> = {
  ativo: "Ativo",
  concluido: "Concluído",
  pausado: "Pausado",
  cancelado: "Cancelado",
};

const PDI_STATUS_CLS: Record<PdiStatus, string> = {
  ativo: "border-primary/35 bg-primary/12 text-primary",
  concluido: "border-success/40 bg-success/15 text-success",
  pausado: "border-accent/40 bg-accent/15 text-accent",
  cancelado: "border-border bg-secondary text-muted-foreground",
};

const GOAL_STATUS_CLS: Record<GoalStatus, string> = {
  a_fazer: "border-border bg-secondary text-muted-foreground",
  em_andamento: "border-primary/35 bg-primary/12 text-primary",
  concluido: "border-success/40 bg-success/15 text-success",
  atrasado: "border-destructive/40 bg-destructive/12 text-destructive",
};

type DateFilter = "todos" | "30d" | "90d" | "ano";

function Avatar({ name }: { name?: string }) {
  const initials = (name ?? "Liderado")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase())
    .join("");
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-sm font-semibold text-primary ring-1" style={{ color: 'var(--pilar-e)', backgroundColor: 'color-mix(in oklab, var(--pilar-e) 12%, transparent)', ringColor: 'color-mix(in oklab, var(--pilar-e) 25%, transparent)' }}>
      {initials || <Users className="h-4 w-4" />}
    </div>

  );
}

const DATE_FILTERS: Record<DateFilter, string> = {
  todos: "Todo o período",
  "30d": "Últimos 30 dias",
  "90d": "Últimos 90 dias",
  ano: "Este ano",
};

function StatTile({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Target;
  label: string;
  value: string | number;
  tone: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className={cn("flex h-8 w-8 items-center justify-center rounded-xl", tone)}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="mt-3 font-display text-2xl leading-none">{value}</div>
      <div className="mt-1 text-[11px] uppercase tracking-widest text-muted-foreground">{label}</div>
    </div>
  );
}

function PdisPage() {
  const { orgId } = useCurrentOrg();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"todos" | PdiStatus>("todos");
  const [dateFilter, setDateFilter] = useState<DateFilter>("todos");
  const [subjectFilter, setSubjectFilter] = useState<string>("todos");

  const { data: pdis = [], isLoading } = useQuery<Pdi[]>({
    queryKey: ["pdis", orgId],
    enabled: !!orgId,
    queryFn: () => api<Pdi[]>(`/organization/${orgId}/pdis`),
  });

  const { data: team = [] } = useQuery<TeamOption[]>({
    queryKey: ["team-basic", orgId],
    enabled: !!orgId,
    queryFn: () => api<TeamOption[]>(`/organization/${orgId}/team`),
  });

  const del = useMutation({
    mutationFn: (id: string) => api(`/organization/${orgId}/pdis/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pdis", orgId] }),
  });

  const patchStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: PdiStatus }) =>
      api(`/organization/${orgId}/pdis/${id}`, { method: "PATCH", body: { status } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pdis", orgId] }),
  });

  if (!orgId) return null;

  const filtered = useMemo(() => {
    const now = Date.now();
    const cutoff =
      dateFilter === "30d"
        ? now - 30 * 86400000
        : dateFilter === "90d"
          ? now - 90 * 86400000
          : dateFilter === "ano"
            ? new Date(new Date().getFullYear(), 0, 1).getTime()
            : null;
    const q = search.trim().toLowerCase();
    return pdis.filter((p) => {
      if (statusFilter !== "todos" && p.status !== statusFilter) return false;
      if (subjectFilter !== "todos" && p.subjectUserId !== subjectFilter) return false;
      if (cutoff && new Date(p.createdAt).getTime() < cutoff) return false;
      if (q) {
        const name = team.find((t) => t.userId === p.subjectUserId)?.fullName ?? "";
        const hay = `${p.title} ${p.focus ?? ""} ${p.summary ?? ""} ${name}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [pdis, team, search, statusFilter, dateFilter, subjectFilter]);

  const totalGoals = filtered.reduce((acc, p) => acc + p.goals.length, 0);
  const doneGoals = filtered.reduce(
    (acc, p) => acc + p.goals.filter((g) => g.status === "concluido").length,
    0,
  );
  const lateGoals = filtered.reduce(
    (acc, p) => acc + p.goals.filter((g) => g.status === "atrasado").length,
    0,
  );
  const hasFilters =
    !!search.trim() || statusFilter !== "todos" || dateFilter !== "todos" || subjectFilter !== "todos";

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <header className="overflow-hidden rounded-3xl bg-ink-gradient p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="max-w-2xl">
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-foreground/60">
            PDIs — Planos de Desenvolvimento Individual
          </div>
            <h1 className="mt-2 font-display text-3xl leading-tight sm:text-4xl">Evolução das pessoas</h1>
            <p className="mt-3 text-sm text-ink-foreground/70">
            Um PDI por liderado. Foco central + metas concretas com prazo. Alimenta a Sala em "pessoas que precisam de atenção".
          </p>
          </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="premium" className="gap-2">
              <Plus className="h-4 w-4" /> Novo PDI
            </Button>
          </DialogTrigger>
          <NewPdiDialog
            orgId={orgId}
            team={team}
            onDone={() => {
              setOpen(false);
              qc.invalidateQueries({ queryKey: ["pdis", orgId] });
            }}
          />
        </Dialog>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile icon={BookOpen} label="PDIs listados" value={filtered.length} tone="bg-primary/12 text-primary" />
        <StatTile icon={Target} label="Metas no total" value={totalGoals} tone="bg-accent/15 text-accent" />
        <StatTile icon={CheckCircle2} label="Metas concluídas" value={doneGoals} tone="bg-success/15 text-success" />
        <StatTile icon={CalendarClock} label="Metas atrasadas" value={lateGoals} tone="bg-destructive/12 text-destructive" />
      </section>

      <section className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-muted-foreground">
          <Filter className="h-3.5 w-3.5" /> Filtros
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por PDI, foco ou pessoa"
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os status</SelectItem>
              {(Object.keys(PDI_STATUS) as PdiStatus[]).map((s) => (
                <SelectItem key={s} value={s}>{PDI_STATUS[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={dateFilter} onValueChange={(v) => setDateFilter(v as DateFilter)}>
            <SelectTrigger><SelectValue placeholder="Período" /></SelectTrigger>
            <SelectContent>
              {(Object.keys(DATE_FILTERS) as DateFilter[]).map((d) => (
                <SelectItem key={d} value={d}>{DATE_FILTERS[d]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={subjectFilter} onValueChange={setSubjectFilter}>
            <SelectTrigger><SelectValue placeholder="Liderado" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os liderados</SelectItem>
              {team.map((t) => (
                <SelectItem key={t.userId} value={t.userId}>{t.fullName}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {hasFilters && (
          <div className="mt-3 flex items-center justify-between gap-3 text-xs text-muted-foreground">
            <span>
              Mostrando {filtered.length} de {pdis.length} PDIs
            </span>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 gap-1 text-xs"
              onClick={() => {
                setSearch("");
                setStatusFilter("todos");
                setDateFilter("todos");
                setSubjectFilter("todos");
              }}
            >
              <X className="h-3 w-3" /> Limpar filtros
            </Button>
          </div>
        )}
      </section>

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
        </div>
      )}

      {!isLoading && pdis.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border bg-secondary/30 p-8 text-center">
          <BookOpen className="mx-auto h-8 w-8 text-muted-foreground" />
          <div className="mt-3 font-medium">Nenhum PDI cadastrado</div>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Comece pelo liderado com maior necessidade de desenvolvimento identificada.
          </p>
        </div>
      )}

      {!isLoading && pdis.length > 0 && filtered.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border bg-secondary/30 p-8 text-center">
          <Filter className="mx-auto h-7 w-7 text-muted-foreground" />
          <div className="mt-3 font-medium">Nenhum PDI com esses filtros</div>
          <p className="mt-2 text-sm text-muted-foreground">Ajuste o período, o status ou a busca.</p>
        </div>
      )}

      <ul className="space-y-4">
        {filtered.map((p) => {
          const subject = team.find((t) => t.userId === p.subjectUserId);
          const total = p.goals.length;
          const done = p.goals.filter((g) => g.status === "concluido").length;
          const pct = total ? Math.round((done / total) * 100) : 0;
          return (
            <li
              key={p.id}
              className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-colors hover:border-primary/30"
            >
              <div className="space-y-4 p-5">
                {/* Linha 1: pessoa + status + ações */}
                <div className="flex items-center gap-3">
                  <Avatar name={subject?.fullName} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium leading-tight">
                      {subject?.fullName ?? "Liderado"}
                    </div>
                    <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
                      Criado em {new Date(p.createdAt).toLocaleDateString("pt-BR")}
                    </div>
                  </div>
                  <span
                    className={cn(
                      "hidden rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest sm:inline",
                      PDI_STATUS_CLS[p.status],
                    )}
                  >
                    {PDI_STATUS[p.status]}
                  </span>
                  <Select
                    value={p.status}
                    onValueChange={(v) => patchStatus.mutate({ id: p.id, status: v as PdiStatus })}
                  >
                    <SelectTrigger className="h-8 w-32 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(PDI_STATUS) as PdiStatus[]).map((s) => (
                        <SelectItem key={s} value={s}>{PDI_STATUS[s]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <button
                    onClick={() => del.mutate(p.id)}
                    className="rounded-full p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    aria-label="Excluir"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                {/* Linha 2: conteúdo do PDI */}
                <div>
                  <h3 className="font-display text-xl leading-tight">{p.title}</h3>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                    {p.focus && (
                      <span className="flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-primary">
                        <Target className="h-3 w-3" /> {p.focus}
                      </span>
                    )}
                    {p.reviewAt && (
                      <span className="flex items-center gap-1.5 rounded-full border border-border bg-secondary px-2 py-0.5 text-muted-foreground">
                        <CalendarClock className="h-3 w-3" />
                        Rever em {new Date(p.reviewAt).toLocaleDateString("pt-BR")}
                      </span>
                    )}
                  </div>
                  {p.summary && (
                    <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{p.summary}</p>
                  )}
                </div>

                {total > 0 && (
                  <div>
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>{done} de {total} metas concluídas</span>
                      <span className="font-semibold text-foreground">{pct}%</span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-secondary">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ 
                          width: `${pct}%`,
                          backgroundColor: "var(--pilar-e)"
                        }}
                      />
                    </div>

                  </div>
                )}

                <Goals orgId={orgId} pdi={p} />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Goals({ orgId, pdi }: { orgId: string; pdi: Pdi }) {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [action, setAction] = useState("");
  const [dueAt, setDueAt] = useState("");

  const invalidate = () => qc.invalidateQueries({ queryKey: ["pdis", orgId] });

  const create = useMutation({
    mutationFn: () =>
      api(`/organization/${orgId}/pdis/${pdi.id}/goals`, {
        method: "POST",
        body: {
          title,
          action: action || null,
          dueAt: dueAt ? new Date(dueAt).toISOString() : null,
        },
      }),
    onSuccess: () => {
      setTitle("");
      setAction("");
      setDueAt("");
      setAdding(false);
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao salvar"),
  });

  const patchGoal = useMutation({
    mutationFn: ({ id, status }: { id: string; status: GoalStatus }) =>
      api(`/organization/${orgId}/pdis/${pdi.id}/goals/${id}`, {
        method: "PATCH",
        body: { status },
      }),
    onSuccess: invalidate,
  });

  const delGoal = useMutation({
    mutationFn: (id: string) =>
      api(`/organization/${orgId}/pdis/${pdi.id}/goals/${id}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });

  return (
    <div className="mt-1 rounded-xl border border-border bg-secondary/30 p-4">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-xs uppercase tracking-widest text-muted-foreground">Metas</div>
        <Button size="sm" variant="outline" onClick={() => setAdding((v) => !v)} className="h-7 gap-1 text-xs">
          <Plus className="h-3 w-3" /> Nova
        </Button>
      </div>
      {adding && (
        <div className="mb-3 space-y-3 rounded-xl border border-border bg-background p-4 shadow-sm">
          <div>
            <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">O que precisa ser feito?</Label>
            <Input placeholder="Título da meta" value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Como será feito? (Ação)</Label>
            <Input placeholder="Descreva a ação concreta" value={action} onChange={(e) => setAction(e.target.value)} className="mt-1" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Prazo</Label>
              <Input type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} className="mt-1" />
            </div>
          </div>
          <div>
            <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Evidência de sucesso</Label>
            <Input placeholder="O que prova que a meta foi atingida?" className="mt-1" />
          </div>
          <div className="flex justify-end pt-1">
            <Button size="sm" onClick={() => create.mutate()} disabled={!title || create.isPending}>
              {create.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Adicionar"}
            </Button>
          </div>
        </div>
      )}
      {pdi.goals.length === 0 && !adding && (
        <div className="text-xs text-muted-foreground">Sem metas cadastradas.</div>
      )}
      <ul className="space-y-2">
        {pdi.goals.map((g) => (
          <li
            key={g.id}
            className={cn(
              "flex flex-wrap items-start justify-between gap-3 rounded-lg border bg-background p-3 text-sm",
              g.status === "atrasado"
                ? "border-destructive/35"
                : g.status === "concluido"
                  ? "border-success/35"
                  : "border-border",
            )}
          >
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={g.status === "concluido" ? "text-muted-foreground line-through" : "font-medium"}
                >
                  {g.title}
                </span>
                <span
                  className={cn(
                    "rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-widest",
                    GOAL_STATUS_CLS[g.status],
                  )}
                >
                  {GOAL_STATUS[g.status]}
                </span>
              </div>
              {g.action && <div className="text-xs text-muted-foreground">{g.action}</div>}
              {g.dueAt && (
                <div className="mt-0.5 text-[10px] uppercase tracking-widest text-muted-foreground">
                  Prazo: {new Date(g.dueAt).toLocaleDateString("pt-BR")}
                </div>
              )}
            </div>
            <div className="flex items-center gap-1">
              <Select
                value={g.status}
                onValueChange={(v) => patchGoal.mutate({ id: g.id, status: v as GoalStatus })}
              >
                <SelectTrigger className="h-7 w-32 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(GOAL_STATUS) as GoalStatus[]).map((s) => (
                    <SelectItem key={s} value={s}>{GOAL_STATUS[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <button
                onClick={() => delGoal.mutate(g.id)}
                className="rounded-full p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                aria-label="Excluir meta"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function NewPdiDialog({
  orgId,
  team,
  onDone,
}: {
  orgId: string;
  team: TeamOption[];
  onDone: () => void;
}) {
  const [subjectUserId, setSubjectUserId] = useState("");
  const [title, setTitle] = useState("");
  const [focus, setFocus] = useState("");
  const [summary, setSummary] = useState("");
  const [reviewAt, setReviewAt] = useState("");

  const create = useMutation({
    mutationFn: () =>
      api(`/organization/${orgId}/pdis`, {
        method: "POST",
        body: {
          subjectUserId,
          title,
          focus: focus || null,
          summary: summary || null,
          reviewAt: reviewAt ? new Date(reviewAt).toISOString() : null,
        },
      }),
    onSuccess: () => {
      toast.success("PDI criado");
      onDone();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao salvar"),
  });

  return (
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
      <DialogHeader>
        <DialogTitle>Novo PDI</DialogTitle>
      </DialogHeader>
      <div className="space-y-4 py-2">
        <div>
          <Label>Liderado</Label>
          <Select value={subjectUserId} onValueChange={setSubjectUserId}>
            <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
            <SelectContent>
              {team.map((t) => (
                <SelectItem key={t.userId} value={t.userId}>{t.fullName}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Título</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Desenvolver comunicação com pares" />
        </div>
        <div>
          <Label>Foco central</Label>
          <Input value={focus} onChange={(e) => setFocus(e.target.value)} placeholder="Competência ou módulo C.O.R.E." />
        </div>
        <div>
          <Label>Resumo</Label>
          <Textarea value={summary} onChange={(e) => setSummary(e.target.value)} className="min-h-[90px]" />
        </div>
        <div>
          <Label>Data de revisão</Label>
          <Input type="date" value={reviewAt} onChange={(e) => setReviewAt(e.target.value)} />
        </div>
      </div>
      <DialogFooter>
        <Button
          disabled={create.isPending || !subjectUserId || !title}
          onClick={() => create.mutate()}
        >
          {create.isPending ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
          Criar PDI
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
