import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, Gauge, Grid3X3, Loader2, Plus, Target, Trash2, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { useCurrentOrg } from "@/lib/use-current-org";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PdiSnapshotPanel } from "@/components/jornada/PdiSnapshotPanel";

export const Route = createFileRoute("/_authenticated/app/cycle-closure")({
  ssr: false,
  component: CycleClosurePage,
  head: () => ({
    meta: [
      { title: "Fechamento de ciclo · Evolução · Líder C.O.R.E." },
      {
        name: "description",
        content:
          "Resultado × meta, adesão de agenda, causa raiz múltipla, OKR de 90 dias e PDI atualizado no fim de cada ciclo.",
      },
      { property: "og:title", content: "Fechamento de ciclo · Líder C.O.R.E." },
      {
        property: "og:description",
        content: "Feche o PDCA do ciclo: resultado, causas, decisão e OKR dos próximos 90 dias.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Cycle = { id: string; name: string; status: string; startAt: string; endAt: string };
type Closure = {
  targetValue: number | null;
  resultValue: number | null;
  targetLabel: string | null;
  recalibrateGoal: boolean;
  recalibrateReason: string | null;
  radarSnapshot: Record<string, number> | null;
  learnings: string | null;
  decision: string | null;
  coachSuggestion: string | null;
  coachResponse: string | null;
} | null;
type Cause = { id: string; category: string; description: string };
type Okr = {
  id: string;
  objective: string;
  horizonDays: number;
  keyResults: Array<{ id: string; title: string; targetValue: number | null; done: boolean }>;
};

type Priority90 = {
  what: string;
  why: string;
  who: string;
  deadline: string;
  successIndicator: string;
};
type Adherence = { ritualId: string; title: string; planned: number; done: number; percent: number };
type NineBoxEntry = { id: string; potential: string; performance: string; stage: string; subjectLabel?: string };
type Payload = {
  cycle: Cycle;
  closure: Closure;
  causes: Cause[];
  okrs: Okr[];
  adherence: Adherence[];
  nineBox: NineBoxEntry[];
};

const CATEGORIES = [
  { key: "comportamental", label: "Comportamental / sabotador" },
  { key: "processo", label: "Processo / ritual" },
  { key: "dado", label: "Dado / cultura" },
  { key: "estrutural", label: "Estrutural / meta" },
  { key: "outro", label: "Outro" },
];

function CycleClosurePage() {
  const { orgId } = useCurrentOrg();
  const qc = useQueryClient();
  const [cycleId, setCycleId] = useState("");

  const cycles = useQuery({
    queryKey: ["cycles", orgId],
    enabled: !!orgId,
    queryFn: () => api<Cycle[]>(`/organization/${orgId}/cycles`),
  });
  const activeCycleId =
    cycleId || cycles.data?.find((c) => c.status === "active")?.id || cycles.data?.[0]?.id || "";

  const data = useQuery({
    queryKey: ["closure", orgId, activeCycleId],
    enabled: !!orgId && !!activeCycleId,
    queryFn: () => api<Payload>(`/organization/${orgId}/jornada/closure/${activeCycleId}`),
  });

  const [form, setForm] = useState({
    targetLabel: "",
    targetValue: "",
    resultValue: "",
    recalibrateGoal: false,
    recalibrateReason: "",
    radarSnapshot: null as Record<string, number> | null,
    learnings: "",
    decision: "",
    coachSuggestion: "",
    coachResponse: "",
  });

  useEffect(() => {
    const c = data.data?.closure;
    setForm({
      targetLabel: c?.targetLabel ?? "",
      targetValue: c?.targetValue != null ? String(c.targetValue) : "",
      resultValue: c?.resultValue != null ? String(c.resultValue) : "",
      recalibrateGoal: c?.recalibrateGoal ?? false,
      recalibrateReason: c?.recalibrateReason ?? "",
      radarSnapshot: (c?.radarSnapshot as Record<string, number>) ?? null,
      learnings: c?.learnings ?? "",
      decision: c?.decision ?? "",
      coachSuggestion: c?.coachSuggestion ?? "",
      coachResponse: c?.coachResponse ?? "",
    });
  }, [data.data?.closure]);

  const saveClosure = useMutation({
    mutationFn: ({ closeCycle, radar }: { closeCycle: boolean; radar?: any }) =>
      api(`/organization/${orgId}/jornada/closure/${activeCycleId}`, {
        method: "PUT",
        body: {
          targetLabel: form.targetLabel || null,
          targetValue: form.targetValue ? Number(form.targetValue) : null,
          resultValue: form.resultValue ? Number(form.resultValue) : null,
          recalibrateGoal: form.recalibrateGoal,
          recalibrateReason: form.recalibrateReason || null,
          learnings: form.learnings || null,
          decision: form.decision || null,
          coachSuggestion: form.coachSuggestion || null,
          coachResponse: form.coachResponse || null,
          radarSnapshot: radar || form.radarSnapshot,
          closeCycle,
        },
      }),
    onSuccess: (_d, { closeCycle }) => {
      toast.success(closeCycle ? "Ciclo encerrado." : "Fechamento salvo.");
      qc.invalidateQueries({ queryKey: ["closure", orgId, activeCycleId] });
      qc.invalidateQueries({ queryKey: ["cycles", orgId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao salvar"),
  });

  const [cause, setCause] = useState({ category: "comportamental", description: "" });
  const addCause = useMutation({
    mutationFn: () =>
      api(`/organization/${orgId}/jornada/root-causes`, {
        method: "POST",
        body: { cycleId: activeCycleId, ...cause },
      }),
    onSuccess: () => {
      setCause({ category: "comportamental", description: "" });
      qc.invalidateQueries({ queryKey: ["closure", orgId, activeCycleId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao adicionar causa"),
  });
  const delCause = useMutation({
    mutationFn: (id: string) =>
      api(`/organization/${orgId}/jornada/root-causes/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["closure", orgId, activeCycleId] }),
  });

  const [okr, setOkr] = useState({ objective: "", kr1: "", kr2: "", kr3: "" });
  const [priorities, setPriorities] = useState<Priority90[]>([
    { what: "", why: "", who: "", deadline: "", successIndicator: "" },
  ]);

  const addPriority = () => {
    if (priorities.length < 3) {
      setPriorities([...priorities, { what: "", why: "", who: "", deadline: "", successIndicator: "" }]);
    }
  };

  const updatePriority = (index: number, field: keyof Priority90, value: string) => {
    const newP = [...priorities];
    newP[index] = { ...newP[index], [field]: value };
    setPriorities(newP);
  };

  const addOkr = useMutation({
    mutationFn: () =>
      api(`/organization/${orgId}/jornada/okrs`, {
        method: "POST",
        body: {
          cycleId: activeCycleId,
          objective: okr.objective,
          horizonDays: 90,
          keyResults: [okr.kr1, okr.kr2, okr.kr3]
            .filter((t) => t.trim().length > 1)
            .map((title) => ({ title })),
          plan90: priorities.filter((p) => p.what.trim().length > 2),
        },
      }),
    onSuccess: () => {
      setOkr({ objective: "", kr1: "", kr2: "", kr3: "" });
      setPriorities([{ what: "", why: "", who: "", deadline: "", successIndicator: "" }]);
      toast.success("OKR e Plano de 90 dias criados.");
      qc.invalidateQueries({ queryKey: ["closure", orgId, activeCycleId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao criar planejamento"),
  });

  if (!orgId) return null;

  const target = form.targetValue ? Number(form.targetValue) : null;
  const result = form.resultValue ? Number(form.resultValue) : null;
  const delta = target && result != null ? Math.round(((result - target) / target) * 100) : null;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className="grid h-11 w-11 place-items-center rounded-2xl"
            style={{
              backgroundColor: "color-mix(in oklab, var(--pilar-e) 12%, transparent)",
              color: "var(--pilar-e)",
            }}
          >
            <Gauge className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-display text-3xl font-semibold leading-tight">
              Fechamento de ciclo
            </h1>
            <p className="text-sm text-muted-foreground">
              Leia o resultado, ache a causa, decida e abra os próximos 90 dias.
            </p>
          </div>
        </div>
        <select
          value={activeCycleId}
          onChange={(e) => setCycleId(e.target.value)}
          className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
        >
          {(cycles.data ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} · {c.status}
            </option>
          ))}
        </select>
      </header>

      {!activeCycleId && (
        <div className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
          Crie um ciclo em Organização · Ciclos para fechar o PDCA.
        </div>
      )}

      {activeCycleId && (
        <>
          <section className="space-y-4 rounded-2xl border border-border bg-card p-6">
            <h2 className="font-display text-xl">Resultado do período</h2>
            <div className="grid gap-3 md:grid-cols-3">
              <div>
                <label className="text-xs text-muted-foreground">Indicador / meta</label>
                <Input
                  value={form.targetLabel}
                  onChange={(e) => setForm((f) => ({ ...f, targetLabel: e.target.value }))}
                  placeholder="Vendas do trimestre"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Meta</label>
                <Input
                  type="number"
                  value={form.targetValue}
                  onChange={(e) => setForm((f) => ({ ...f, targetValue: e.target.value }))}
                  placeholder="2400000"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Realizado</label>
                <Input
                  type="number"
                  value={form.resultValue}
                  onChange={(e) => setForm((f) => ({ ...f, resultValue: e.target.value }))}
                  placeholder="2110000"
                />
              </div>
            </div>
            {delta != null && (
              <div
                className="rounded-xl border p-3 text-sm"
                style={{
                  borderColor: delta < 0 ? "var(--pilar-r)" : "var(--pilar-o)",
                  backgroundColor: `color-mix(in oklab, ${delta < 0 ? "var(--pilar-r)" : "var(--pilar-o)"} 8%, transparent)`,
                }}
              >
                Desvio do período: <strong>{delta > 0 ? `+${delta}` : delta}%</strong> em relação à
                meta.
              </div>
            )}
          </section>

          <section className="space-y-3 rounded-2xl border border-border bg-card p-6">
            <h2 className="font-display text-xl">Adesão de agenda</h2>
            <p className="text-xs text-muted-foreground">
              Planejado (Organização) × realizado (Resultado), calculado automaticamente.
            </p>
            {(data.data?.adherence ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">
                Nenhum ritual com ocorrências dentro deste ciclo.
              </p>
            )}
            {(data.data?.adherence ?? []).map((a) => (
              <div key={a.ritualId}>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{a.title}</span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {a.done} de {a.planned} · {a.percent}%
                  </span>
                </div>
                <div className="mt-1.5 h-2 rounded-full bg-secondary">
                  <div
                    className="h-2 rounded-full transition-all"
                    style={{ width: `${a.percent}%`, backgroundColor: "var(--pilar-o)" }}
                  />
                </div>
              </div>
            ))}
          </section>

          <section className="space-y-4 rounded-2xl border border-border bg-card p-6">
            <h2 className="font-display text-xl">Causa raiz</h2>
            <p className="text-xs text-muted-foreground">
              Mais de uma causa pode se alimentar — registre todas.
            </p>
            <div className="space-y-2">
              {(data.data?.causes ?? []).map((c) => (
                <div
                  key={c.id}
                  className="flex items-start justify-between gap-3 rounded-xl border border-border/70 p-3"
                >
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                      {CATEGORIES.find((x) => x.key === c.category)?.label ?? c.category}
                    </div>
                    <div className="text-sm">{c.description}</div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => delCause.mutate(c.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
            <div className="grid gap-2 md:grid-cols-[220px_1fr_auto]">
              <select
                value={cause.category}
                onChange={(e) => setCause((c) => ({ ...c, category: e.target.value }))}
                className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </select>
              <Input
                value={cause.description}
                onChange={(e) => setCause((c) => ({ ...c, description: e.target.value }))}
                placeholder="Ex: 1:1 não aconteceu com quem mais precisava"
              />
              <Button
                className="gap-2"
                disabled={cause.description.trim().length < 3 || addCause.isPending}
                onClick={() => addCause.mutate()}
              >
                <Plus className="h-4 w-4" /> Adicionar
              </Button>
            </div>
          </section>

          <section className="space-y-4 rounded-2xl border border-border bg-card p-6">
            <h2 className="font-display text-xl">Snapshot 9-Box (E)</h2>
            <p className="text-xs text-muted-foreground">
              A matriz consolidada deste ciclo. Os dados de Potencial (O) e Desempenho (R) são travados como registro histórico.
            </p>
            <div className="grid gap-2 md:grid-cols-3">
              {(["alto", "medio", "baixo"] as const).map((pot: string) =>
                (["baixo", "medio", "alto"] as const).map((perf: string) => {
                  const entries = data.data?.nineBox ?? [];
                  const cellEntries = entries.filter(
                    (e) =>
                      e.stage === "evolucao" && e.potential === pot && e.performance === perf,
                  );
                  const risk = pot === "alto" && perf === "baixo";
                  return (
                    <div
                      key={`${pot}-${perf}`}
                      className="min-h-[80px] rounded-xl border border-border bg-card p-3"
                      style={
                        risk && cellEntries.length > 0
                          ? {
                              borderColor: "var(--pilar-r)",
                              backgroundColor: "color-mix(in oklab, var(--pilar-r) 8%, transparent)",
                            }
                          : undefined
                      }
                    >
                      <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                        {pot[0].toUpperCase()}
                        {perf[0].toUpperCase()}
                      </div>
                      <div className="mt-1 space-y-0.5">
                        {cellEntries.map((e) => (
                          <div key={e.id} className="text-[11px] font-medium leading-tight">
                            {e.subjectLabel || "Liderado"}
                          </div>
                        ))}
                        {cellEntries.length === 0 && (
                          <span className="text-[10px] text-muted-foreground opacity-50">—</span>
                        )}
                      </div>
                    </div>
                  );
                }),
              )}
            </div>
            <div className="flex justify-end">
              <Link to="/app/ninebox" search={{ cycleId: activeCycleId }}>
                <Button variant="ghost" size="sm" className="text-xs gap-2">
                  <Grid3X3 className="h-3.5 w-3.5" /> Ajustar 9-Box no estágio Evolução
                </Button>
              </Link>
            </div>
          </section>

          <section className="space-y-4 rounded-2xl border border-border bg-card p-6">
            <h2 className="font-display text-xl">Recalibração de meta</h2>
            <p className="text-xs text-muted-foreground">
              Decisão formal sobre manter ou ajustar a meta para o ciclo seguinte.
            </p>
            <div className="flex gap-2">
              {[
                { v: false, label: "Não — a meta continua válida" },
                { v: true, label: "Sim — vou recalibrar" },
              ].map((o) => (
                <button
                  key={String(o.v)}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, recalibrateGoal: o.v }))}
                  className={
                    "rounded-xl border px-3 py-2 text-[13px] transition-colors " +
                    (form.recalibrateGoal === o.v
                      ? "border-primary bg-primary/10 font-medium"
                      : "border-border hover:bg-secondary/60")
                  }
                >
                  {o.label}
                </button>
              ))}
            </div>
            {form.recalibrateGoal && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Justificativa da recalibração
                </label>
                <Textarea
                  value={form.recalibrateReason}
                  onChange={(e) => setForm((f) => ({ ...f, recalibrateReason: e.target.value }))}
                  placeholder="Explique por que a meta precisa ser ajustada..."
                  className="min-h-[100px]"
                />
              </div>
            )}
          </section>
          <section className="space-y-4 rounded-2xl border border-border bg-card p-6">
            <h2 className="font-display text-xl">Conclusão e Decisão</h2>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="text-xs text-muted-foreground">Aprendizados</label>
                <Textarea
                  value={form.learnings}
                  onChange={(e) => setForm((f) => ({ ...f, learnings: e.target.value }))}
                  rows={3}
                  placeholder="O que aprendemos neste ciclo?"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Decisão para o próximo ciclo</label>
                <Textarea
                  value={form.decision}
                  onChange={(e) => setForm((f) => ({ ...f, decision: e.target.value }))}
                  rows={3}
                  placeholder="Qual a decisão estratégica?"
                />
              </div>
            </div>
          </section>

          <section className="space-y-4 rounded-2xl border border-border bg-card p-6">
            <div className="flex items-center gap-2 text-accent">
              <BookOpen className="h-5 w-5" />
              <h2 className="font-display text-xl">Recomendação da IA Coach</h2>
            </div>
            <div className="rounded-xl bg-accent/5 p-4 border border-accent/10">
              <label className="text-[10px] font-bold uppercase tracking-wider text-accent/80">Recomendação do Coach C.O.R.E. para este ciclo</label>
              <Textarea
                value={form.coachSuggestion}
                onChange={(e) => setForm((f) => ({ ...f, coachSuggestion: e.target.value }))}
                placeholder="IA Coach analisando dados..."
                className="mt-2 bg-background/50"
              />
            </div>
            
            <div className="space-y-3">
              <label className="text-xs font-semibold">Qual a sua resposta para a recomendação acima?</label>
              <div className="flex flex-wrap gap-2">
                {["Concordo", "Vou ajustar", "Discordo"].map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => {
                      const current = form.coachResponse.split(":")[0];
                      const comment = form.coachResponse.includes(":") ? form.coachResponse.split(":")[1] : "";
                      setForm(f => ({ ...f, coachResponse: `${opt}${comment ? ":" + comment : ""}` }));
                    }}
                    className={cn(
                      "rounded-lg border px-3 py-1.5 text-xs font-medium transition-all",
                      form.coachResponse.startsWith(opt)
                        ? "border-primary bg-primary text-primary-foreground shadow-sm"
                        : "border-border bg-secondary/50 hover:bg-secondary"
                    )}
                  >
                    {opt}
                  </button>
                ))}
              </div>
              <Textarea
                value={form.coachResponse.includes(":") ? form.coachResponse.split(":")[1].trim() : ""}
                onChange={(e) => {
                  const prefix = form.coachResponse.split(":")[0] || "Concordo";
                  setForm(f => ({ ...f, coachResponse: `${prefix}: ${e.target.value}` }));
                }}
                placeholder="Comentário opcional sobre sua decisão..."
                className="text-sm"
              />
            </div>
          </section>

          <section className="space-y-4 rounded-2xl border border-border bg-card p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-primary">
                <Gauge className="h-5 w-5" />
                <h2 className="font-display text-xl">Radar HSH (Evolução)</h2>
              </div>
              <Link to="/app/consciencia/assessment" search={{ step: 'hsh' }}>
                <Button variant="outline" size="sm" className="gap-2">
                  Realizar Reteste
                </Button>
              </Link>
            </div>
            <p className="text-xs text-muted-foreground">
              O reteste do Radar Hard·Soft·Heart deve ser feito ao fim de cada ciclo para registrar a evolução do score.
            </p>
            {form.radarSnapshot ? (
              <div className="grid grid-cols-3 gap-2 text-center">
                {Object.entries(form.radarSnapshot).map(([k, v]) => (
                  <div key={k} className="rounded-xl border border-border p-3">
                    <div className="text-[10px] uppercase font-bold text-muted-foreground">{k}</div>
                    <div className="text-xl font-display">{Number(v)}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                Nenhum snapshot do radar registrado para este ciclo.
              </div>
            )}
          </section>

          <section className="space-y-6 rounded-2xl border border-border bg-card p-6">
            <div className="flex items-center gap-2 text-primary">
              <Target className="h-5 w-5" />
              <h2 className="font-display text-xl">Plano de 90 Dias e OKR</h2>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Plano de Ação Estruturado (Prioridades)
              </h3>
              {priorities.map((p, i) => (
                <div key={i} className="space-y-3 rounded-xl border border-border/50 p-4 bg-muted/30">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-primary">PRIORIDADE #{i + 1}</span>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="md:col-span-2">
                      <label className="text-[10px] uppercase font-bold text-muted-foreground">O quê? (Ação)</label>
                      <Input
                        value={p.what}
                        onChange={(e) => updatePriority(i, "what", e.target.value)}
                        placeholder="Ex: Implementar novo CRM de vendas"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase font-bold text-muted-foreground">Por quê? (Motivo/Impacto)</label>
                      <Input
                        value={p.why}
                        onChange={(e) => updatePriority(i, "why", e.target.value)}
                        placeholder="Centralizar dados e reduzir churn"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase font-bold text-muted-foreground">Quem? (Responsável)</label>
                      <Input
                        value={p.who}
                        onChange={(e) => updatePriority(i, "who", e.target.value)}
                        placeholder="Time de TI + Vendas"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase font-bold text-muted-foreground">Prazo</label>
                      <Input
                        type="date"
                        value={p.deadline}
                        onChange={(e) => updatePriority(i, "deadline", e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase font-bold text-muted-foreground">Indicador de Sucesso</label>
                      <Input
                        value={p.successIndicator}
                        onChange={(e) => updatePriority(i, "successIndicator", e.target.value)}
                        placeholder="Adesão de 95% do time"
                      />
                    </div>
                  </div>
                </div>
              ))}
              {priorities.length < 3 && (
                <Button variant="outline" size="sm" className="w-full gap-2 border-dashed" onClick={addPriority}>
                  <Plus className="h-4 w-4" /> Adicionar Prioridade
                </Button>
              )}
            </div>

            <div className="space-y-4 pt-4 border-t border-border">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                OKR do Próximo Ciclo (Objetivo + KRs)
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] uppercase font-bold text-muted-foreground">Objetivo Principal</label>
                  <Input
                    value={okr.objective}
                    onChange={(e) => setOkr((o) => ({ ...o, objective: e.target.value }))}
                    placeholder="Ser a referência em atendimento no setor"
                  />
                </div>
                <div className="grid gap-2">
                  <label className="text-[10px] uppercase font-bold text-muted-foreground">Key Results (Resultados-Chave)</label>
                  <Input
                    value={okr.kr1}
                    onChange={(e) => setOkr((o) => ({ ...o, kr1: e.target.value }))}
                    placeholder="KR 1: NPS acima de 75"
                  />
                  <Input
                    value={okr.kr2}
                    onChange={(e) => setOkr((o) => ({ ...o, kr2: e.target.value }))}
                    placeholder="KR 2: Reduzir tempo de resposta para < 2h"
                  />
                  <Input
                    value={okr.kr3}
                    onChange={(e) => setOkr((o) => ({ ...o, kr3: e.target.value }))}
                    placeholder="KR 3: Taxa de resolução no primeiro contato > 80%"
                  />
                </div>
              </div>
              <Button
                className="w-full gap-2"
                disabled={!okr.objective || addOkr.isPending}
                onClick={() => addOkr.mutate()}
              >
                {addOkr.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Target className="h-4 w-4" />}
                Salvar Planejamento de 90 Dias
              </Button>
            </div>
          </section>

          <PdiSnapshotPanel orgId={orgId} cycleId={activeCycleId} />

          <div className="flex flex-wrap gap-2 pb-12">
            <Button
              className="gap-2"
              disabled={saveClosure.isPending}
              onClick={() => saveClosure.mutate({ closeCycle: false })}
            >
              {saveClosure.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              Salvar fechamento
            </Button>
            <Button
              variant="outline"
              disabled={saveClosure.isPending}
              onClick={() => saveClosure.mutate({ closeCycle: true })}
            >
              Encerrar ciclo
            </Button>
          </div>
        </>
      )}
    </div>
  );
}