import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarRange, Loader2, Plus, Sparkles, Target, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { useCurrentOrg } from "@/lib/use-current-org";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/app/organization/cycles")({
  component: CyclesPage,
});

type GoalStatus = "on_track" | "at_risk" | "off_track" | "done" | "dropped";
type CycleStatus = "planning" | "active" | "closed";
type Goal = {
  id: string; title: string; specific: string | null; measurable: string | null;
  achievable: string | null; relevant: string | null; timeBound: string | null;
  ownerUserId: string | null; indicatorId: string | null; targetValue: number | null;
  status: GoalStatus;
  indicatorLinkedId?: string | null;
};
type Cycle = {
  id: string; name: string; startAt: string; endAt: string;
  status: CycleStatus; summary: string | null; goals: Goal[];
};

const STATUS_META: Record<CycleStatus, { label: string; cls: string }> = {
  planning: { label: "Planejamento", cls: "bg-secondary text-foreground" },
  active:   { label: "Ativo",        cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
  closed:   { label: "Encerrado",    cls: "bg-muted text-muted-foreground" },
};
const GOAL_META: Record<GoalStatus, { label: string; dot: string }> = {
  on_track:  { label: "No prumo",  dot: "bg-emerald-500" },
  at_risk:   { label: "Em risco",  dot: "bg-amber-500" },
  off_track: { label: "Atrasada",  dot: "bg-rose-500" },
  done:      { label: "Concluída", dot: "bg-sky-500" },
  dropped:   { label: "Descartada",dot: "bg-muted-foreground" },
};

function CyclesPage() {
  const { orgId } = useCurrentOrg();
  const qc = useQueryClient();
  const [openCycle, setOpenCycle] = useState(false);
  const [goalCycleId, setGoalCycleId] = useState<string | null>(null);
  const [retroCycle, setRetroCycle] = useState<Cycle | null>(null);

  const { data: cycles = [], isLoading } = useQuery({
    queryKey: ["cycles", orgId],
    enabled: !!orgId,
    queryFn: () => api<Cycle[]>(`/organization/${orgId}/cycles`),
  });

  const del = useMutation({
    mutationFn: (id: string) => api(`/organization/${orgId}/cycles/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cycles", orgId] }),
  });

  const active = useMemo(() => cycles.filter((c) => c.status !== "closed"), [cycles]);
  const closed = useMemo(() => cycles.filter((c) => c.status === "closed"), [cycles]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Defina horizontes (trimestre, campanha) e escreva metas <strong className="text-foreground">SMART</strong> ligadas aos indicadores da casa.
        </div>
        <Dialog open={openCycle} onOpenChange={setOpenCycle}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2"><Plus className="h-4 w-4" />Novo ciclo</Button>
          </DialogTrigger>
          <CycleDialog onClose={() => setOpenCycle(false)} />
        </Dialog>
      </div>

      {isLoading ? (
        <div className="grid place-items-center py-16 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : cycles.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <Target className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">Nenhum ciclo ainda. Comece pelo trimestre atual.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {[...active, ...closed].map((c) => (
            <CycleCard
              key={c.id}
              cycle={c}
              onAddGoal={() => setGoalCycleId(c.id)}
              onRetro={() => setRetroCycle(c)}
              onDelete={() => {
                if (confirm(`Excluir ciclo "${c.name}"?`)) del.mutate(c.id);
              }}
            />
          ))}
        </div>
      )}

      <Dialog open={!!goalCycleId} onOpenChange={(o) => !o && setGoalCycleId(null)}>
        {goalCycleId && <GoalDialog cycleId={goalCycleId} onClose={() => setGoalCycleId(null)} />}
      </Dialog>

      <Dialog open={!!retroCycle} onOpenChange={(o) => !o && setRetroCycle(null)}>
        {retroCycle && <RetroDialog cycle={retroCycle} onClose={() => setRetroCycle(null)} />}
      </Dialog>
    </div>
  );
}

function CycleCard({ cycle, onAddGoal, onRetro, onDelete }: { cycle: Cycle; onAddGoal: () => void; onRetro: () => void; onDelete: () => void }) {
  const meta = STATUS_META[cycle.status];
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-display text-xl">{cycle.name}</h3>
            <span className={"rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider " + meta.cls}>
              {meta.label}
            </span>
          </div>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <CalendarRange className="h-3.5 w-3.5" />
            {new Date(cycle.startAt).toLocaleDateString("pt-BR")} — {new Date(cycle.endAt).toLocaleDateString("pt-BR")}
          </p>
          {cycle.summary && <p className="mt-2 text-sm text-foreground/80">{cycle.summary}</p>}
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="gap-1.5" onClick={onAddGoal}>
            <Plus className="h-3.5 w-3.5" />Meta
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={onRetro}>
            <Sparkles className="h-3.5 w-3.5" />Retrô
          </Button>
          <Button size="icon" variant="ghost" onClick={onDelete}><Trash2 className="h-4 w-4" /></Button>
        </div>
      </div>

      {cycle.goals.length > 0 && (
        <ul className="mt-4 space-y-2">
          {cycle.goals.map((g) => {
            const gm = GOAL_META[g.status];
            return (
              <li key={g.id} className="rounded-xl border border-border/70 bg-background p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={"inline-block h-2 w-2 rounded-full " + gm.dot} />
                      <span className="font-medium">{g.title}</span>
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{gm.label}</span>
                    </div>
                    <SmartLine goal={g} />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function SmartLine({ goal }: { goal: Goal }) {
  const parts: string[] = [];
  if (goal.specific)   parts.push(`S · ${goal.specific}`);
  if (goal.measurable) parts.push(`M · ${goal.measurable}`);
  if (goal.achievable) parts.push(`A · ${goal.achievable}`);
  if (goal.relevant)   parts.push(`R · ${goal.relevant}`);
  if (goal.timeBound)  parts.push(`T · ${goal.timeBound}`);
  if (!parts.length) return null;
  return <p className="mt-1 text-xs text-muted-foreground">{parts.join(" · ")}</p>;
}

function CycleDialog({ onClose }: { onClose: () => void }) {
  const { orgId } = useCurrentOrg();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [status, setStatus] = useState<CycleStatus>("active");
  const [summary, setSummary] = useState("");

  const save = useMutation({
    mutationFn: () => api(`/organization/${orgId}/cycles`, {
      method: "POST",
      body: {
        name, status, summary: summary || null,
        startAt: new Date(start).toISOString(),
        endAt: new Date(end).toISOString(),
      },
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cycles", orgId] });
      toast.success("Ciclo criado.");
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <DialogContent className="sm:max-w-lg">
      <DialogHeader><DialogTitle>Novo ciclo</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div><Label>Nome</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Q3 2026 · Aceleração comercial" /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Início</Label><Input type="date" value={start} onChange={(e) => setStart(e.target.value)} /></div>
          <div><Label>Fim</Label><Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} /></div>
        </div>
        <div>
          <Label>Status</Label>
          <Select value={status} onValueChange={(v) => setStatus(v as CycleStatus)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="planning">Planejamento</SelectItem>
              <SelectItem value="active">Ativo</SelectItem>
              <SelectItem value="closed">Encerrado</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div><Label>Resumo (opcional)</Label><Textarea rows={3} value={summary} onChange={(e) => setSummary(e.target.value)} /></div>
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button disabled={!name || !start || !end || save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Criar"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function GoalDialog({ cycleId, onClose }: { cycleId: string; onClose: () => void }) {
  const { orgId } = useCurrentOrg();
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [indicatorLinkedId, setIndicatorLinkedId] = useState("");
  const [targetValue, setTargetValue] = useState("");
  const [S, setS] = useState(""); const [M, setM] = useState("");
  const [A, setA] = useState(""); const [R, setR] = useState("");
  const [T, setT] = useState("");

  const { data: indicators = [] } = useQuery({
    queryKey: ["indicators", orgId],
    enabled: !!orgId,
    queryFn: () => api<any[]>(`/organization/${orgId}/indicators`),
  });

  const save = useMutation({
    mutationFn: () => api(`/organization/${orgId}/cycles/${cycleId}/goals`, {
      method: "POST",
      body: {
        title,
        indicatorId: indicatorLinkedId || null,
        targetValue: targetValue ? Number(targetValue.replace(",", ".")) : null,
        specific: S || null, measurable: M || null, achievable: A || null,
        relevant: R || null, timeBound: T || null,
      },
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cycles", orgId] });
      toast.success("Meta adicionada.");
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <DialogContent className="sm:max-w-xl">
      <DialogHeader><DialogTitle>Nova meta SMART</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div><Label>Título</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Fechar 12 novos contratos até setembro" /></div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Indicador vinculado</Label>
            <Select value={indicatorLinkedId} onValueChange={setIndicatorLinkedId}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {indicators.map((i) => (
                  <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Valor-alvo</Label><Input value={targetValue} onChange={(e) => setTargetValue(e.target.value)} placeholder="Ex: 95" /></div>
        </div>
        <div><Label>S · Específica</Label><Textarea rows={2} value={S} onChange={(e) => setS(e.target.value)} placeholder="O que exatamente?" /></div>
        <div><Label>M · Mensurável</Label><Input value={M} onChange={(e) => setM(e.target.value)} placeholder="Ex.: 12 contratos, R$ 300k MRR" /></div>
        <div><Label>A · Atingível</Label><Input value={A} onChange={(e) => setA(e.target.value)} placeholder="Recursos, capacidade" /></div>
        <div><Label>R · Relevante</Label><Input value={R} onChange={(e) => setR(e.target.value)} placeholder="Por que agora?" /></div>
        <div><Label>T · Temporal</Label><Input value={T} onChange={(e) => setT(e.target.value)} placeholder="Ex.: até 30/09" /></div>
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button disabled={!title || save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Adicionar"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

type Retro = {
  id: string; wentWell: string | null; toImprove: string | null;
  learnings: string | null; nextSteps: string | null; confidence: number | null;
  createdAt: string;
};

const STEPS = [
  { key: "wentWell",  title: "O que funcionou?",     hint: "Conquistas, decisões acertadas, quem brilhou." },
  { key: "toImprove", title: "O que travou?",        hint: "Gargalos, atrasos, falhas de comunicação." },
  { key: "causes",    title: "Análise de Causa Raiz", hint: "Vincule o que travou às causas do PDI (5 Porquês)." },
  { key: "learnings", title: "O que aprendemos?",    hint: "Insights, padrões, hipóteses validadas." },
  { key: "nextSteps", title: "Próximos passos",      hint: "3 prioridades estruturadas para o PDI." },
  { key: "confidence",title: "Confiança no próximo", hint: "0 a 10 — quão confiantes estamos no próximo ciclo?" },
] as const;

function RetroDialog({ cycle, onClose }: { cycle: Cycle; onClose: () => void }) {
  const { orgId } = useCurrentOrg();
  const qc = useQueryClient();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    wentWell: "", toImprove: "", learnings: "", nextSteps: "", confidence: 7,
    causes: [] as Array<{ category: string; description: string }>,
  });

  const { data: closure } = useQuery({
    queryKey: ["closure", orgId, cycle.id],
    enabled: !!orgId && !!cycle.id,
    queryFn: () => api<any>(`/organization/${orgId}/jornada/closure/${cycle.id}`),
  });

  useEffect(() => {
    if (closure?.causes) {
      setForm(f => ({ ...f, causes: closure.causes }));
    }
  }, [closure]);

  const { data: retros = [] } = useQuery({
    queryKey: ["retros", cycle.id],
    queryFn: () => api<Retro[]>(`/organization/${orgId}/cycles/${cycle.id}/retrospectives`),
  });

  const save = useMutation({
    mutationFn: () => api(`/organization/${orgId}/cycles/${cycle.id}/retrospectives`, {
      method: "POST",
      body: {
        wentWell: form.wentWell || null,
        toImprove: form.toImprove || null,
        learnings: form.learnings || null,
        nextSteps: form.nextSteps || null,
        confidence: form.confidence,
      },
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["retros", cycle.id] });
      toast.success("Retrospectiva registrada.");
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <DialogContent className="sm:max-w-xl">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-accent" />
          Retrospectiva · {cycle.name}
        </DialogTitle>
      </DialogHeader>

      <div className="flex items-center gap-1.5">
        {STEPS.map((_, i) => (
          <div key={i} className={"h-1 flex-1 rounded-full " + (i <= step ? "bg-accent" : "bg-muted")} />
        ))}
      </div>

      <div className="space-y-3 pt-2">
        <div>
          <p className="font-display text-lg">{current.title}</p>
          <p className="text-xs text-muted-foreground">{current.hint}</p>
        </div>

        {current.key === "confidence" ? (
          <div className="space-y-2">
            <Input
              type="range" min={0} max={10} step={1}
              value={form.confidence}
              onChange={(e) => setForm((f) => ({ ...f, confidence: Number(e.target.value) }))}
            />
            <div className="text-center font-display text-3xl">{form.confidence}<span className="text-sm text-muted-foreground">/10</span></div>
          </div>
        ) : current.key === "causes" ? (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground italic">Causas importadas da análise de fechamento (E10):</p>
            {form.causes.length === 0 ? (
              <div className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">
                Nenhuma causa raiz vinculada. Defina no fechamento de ciclo.
              </div>
            ) : (
              <div className="grid gap-2">
                {form.causes.map((c, i) => (
                  <div key={i} className="rounded-lg border bg-muted/30 p-3 text-sm">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-primary">{c.category}</div>
                    <div>{c.description}</div>
                  </div>
                ))}
              </div>
            )}
            <Link to="/app/cycle-closure" search={{ cycleId: cycle.id }}>
              <Button variant="link" size="sm" className="h-auto p-0 text-xs">
                Ajustar causas no Fechamento de Ciclo →
              </Button>
            </Link>
          </div>
        ) : (
          <Textarea
            rows={5}
            value={form[current.key as "wentWell" | "toImprove" | "learnings" | "nextSteps"]}
            onChange={(e) => setForm((f) => ({ ...f, [current.key]: e.target.value }))}
            placeholder={current.key === "nextSteps" ? "Prioridade 1: ...\nPrioridade 2: ...\nPrioridade 3: ..." : "Escreva livremente..."}
          />
        )}

        {retros.length > 0 && step === 0 && (
          <div className="rounded-lg border border-border/60 bg-muted/40 p-3 text-xs text-muted-foreground">
            {retros.length} retrospectiva(s) já registrada(s) neste ciclo.
          </div>
        )}
      </div>

      <DialogFooter className="flex-row justify-between sm:justify-between">
        <Button
          variant="ghost"
          onClick={() => (step === 0 ? onClose() : setStep((s) => s - 1))}
        >
          {step === 0 ? "Cancelar" : "Voltar"}
        </Button>
        <Button
          disabled={save.isPending}
          onClick={() => (isLast ? save.mutate() : setStep((s) => s + 1))}
        >
          {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : isLast ? "Concluir" : "Próximo"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}