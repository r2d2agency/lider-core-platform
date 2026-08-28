import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useCurrentOrg } from "@/lib/use-current-org";
import { useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Workflow, Plus, Play, Clock, Sparkles, Check } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/organization/rituals")({
  component: RitualsPage,
});

const TYPES = [
  { v: "daily", l: "Diária" }, { v: "weekly", l: "Semanal" }, { v: "one_on_one", l: "1:1" },
  { v: "feedback", l: "Feedback" }, { v: "action_plan", l: "Plano de ação" },
  { v: "indicators", l: "Indicadores" }, { v: "strategic", l: "Estratégico" },
  { v: "day_one", l: "Primeiro dia" }, { v: "checkpoint", l: "Ponto de controle" },
  { v: "retro", l: "Retrospectiva" }, { v: "custom", l: "Personalizado" },
] as const;

const TYPE_LABELS: Record<string, string> = Object.fromEntries(
  [
    ["daily", "Diária"], ["weekly", "Semanal"], ["one_on_one", "1:1"],
    ["feedback", "Feedback"], ["action_plan", "Plano de ação"],
    ["indicators", "Indicadores"], ["strategic", "Estratégico"],
    ["day_one", "Primeiro dia"], ["checkpoint", "Ponto de controle"],
    ["retro", "Retrospectiva"], ["custom", "Personalizado"],
  ],
);

function labelType(t: string) { return TYPE_LABELS[t] ?? t; }

type RitualTemplate = {
  name: string;
  type: string;
  objective: string;
  cadence: string;
  durationMin: number;
  weekDay?: string;
  agendaTemplate: string;
};

const RITUAL_TEMPLATES: RitualTemplate[] = [
  {
    name: "Daily da Equipe",
    type: "daily",
    objective: "Alinhamento rápido diário: o que fiz ontem, o que faço hoje, bloqueios.",
    cadence: "diária",
    durationMin: 15,
    agendaTemplate: "## Daily - {data}\n\n### O que foi feito ontem\n- \n\n### O que será feito hoje\n- \n\n### Bloqueios / Riscos\n- ",
  },
  {
    name: "Weekly de Alinhamento",
    type: "weekly",
    objective: "Revisar a semana passada, alinhar prioridades da próxima semana e resolver pendências cruzadas.",
    cadence: "semanal",
    durationMin: 60,
    weekDay: "segunda",
    agendaTemplate: "## Weekly - {semana}\n\n1. Check-in rápido (2 min cada)\n2. Resultados da semana anterior\n3. Prioridades da semana atual\n4. Pendencias e dependências\n5. Decisões pendentes\n6. Feedbacks gerais",
  },
  {
    name: "1:1 Individual",
    type: "one_on_one",
    objective: "Conversa individual quinzenal com cada liderado: carreira, desempenho, bloqueios e desenvolvimento.",
    cadence: "quinzenal",
    durationMin: 45,
    agendaTemplate: "## 1:1 - {liderado}\n\n### Como você está? (check-in emocional)\n\n### O que está fluindo bem\n\n### O que está te atrapalhando / bloqueios\n\n### Carreira e desenvolvimento\n\n### Feedback para mim\n\n### Ações combinadas\n- ",
  },
  {
    name: "Retrospectiva de Sprint",
    type: "retro",
    objective: "Refletir sobre a sprint passada: o que funcionou, o que melhorar, planos de ação.",
    cadence: "quinzenal",
    durationMin: 90,
    agendaTemplate: "## Retrospectiva - Sprint {N}\n\n### O que deu certo / Continue fazendo\n- \n\n### O que deu errado / Pare de fazer\n- \n\n### O que melhorar / Comece a fazer\n- \n\n### Planos de ação\n- [ ] Ação 1 | responsável | prazo\n- [ ] Ação 2 | responsável | prazo",
  },
  {
    name: "Checkpoint de Indicadores",
    type: "indicators",
    objective: "Revisão mensal dos KPIs da área: acompanhamento de metas, desvios e ações corretivas.",
    cadence: "mensal",
    durationMin: 60,
    agendaTemplate: "## Revisão de Indicadores - {mês}\n\n### Mapa de KPIs\n| KPI | Meta | Realizado | % | Desvio |\n|---|---|---|---|---|\n\n### Desvios críticos e análise de causa\n- \n\n### Ações corretivas\n- [ ] \n\n### Riscos identificados\n- ",
  },
  {
    name: "Sessão de Feedback Estruturado",
    type: "feedback",
    objective: "Feedback formal sobre desempenho, pontos fortes e pontos de desenvolvimento com plano de ação.",
    cadence: "trimestral",
    durationMin: 60,
    agendaTemplate: "## Feedback - {liderado}\n\n### Pontos fortes (observados com exemplos)\n- \n\n### Pontos de desenvolvimento (com impacto + exemplo)\n- \n\n### Auto-avaliação do colaborador\n\n### Plano de desenvolvimento\n- Meta 1: \n- Meta 2: \n- Apoios: \n\n### Compromissos\n- ",
  },
  {
    name: "Plano de Ação - Fechamento",
    type: "action_plan",
    objective: "Validar o andamento do plano de ação do ciclo, remover bloqueios e confirmar entregas.",
    cadence: "quinzenal",
    durationMin: 45,
    agendaTemplate: "## Plano de Ação - {ciclo}\n\n### Atrasadas ou em risco\n- [ ] Tarefa | responsável | prazo | motivo\n\n### Concluídas desde a última\n- [x] \n\n### Ajustes no plano\n- \n\n### Próximas entregas-chave\n- ",
  },
  {
    name: "Onboarding - Primeiro Dia",
    type: "day_one",
    objective: "Receber o novo colaborador, apresentar cultura, ferramentas, time e primeiros passos dos 90 dias.",
    cadence: "eventual",
    durationMin: 90,
    agendaTemplate: "## Onboarding - Primeiro dia\n\n### 1. Apresentação pessoal e propósito do papel\n\n### 2. Cultura e valores da empresa\n\n### 3. Ferramentas e acessos\n- [ ] Email\n- [ ] Slack\n- [ ] Sistemas internos\n- [ ] Documentação\n\n### 4. Apresentação do time\n\n### 5. Primeira semana: objetivos de aprendizado\n\n### 6. Check-in: dúvidas e sentimentos",
  },
  {
    name: "Ponto de Controle de Ciclo",
    type: "checkpoint",
    objective: "Meio do ciclo: validar progresso de objetivos, identificar desvios e redefinir prioridades.",
    cadence: "mensal",
    durationMin: 60,
    agendaTemplate: "## Checkpoint - {ciclo}\n\n### Progresso dos objetivos (OKR / metas)\n| Objetivo | Início | Atual | Status |\n|---|---|---|---|\n\n### Destaques positivos\n\n### Riscos e bloqueios\n- \n\n### Ajustes necessários\n- \n\n### Prioridades para a 2a metade do ciclo\n- ",
  },
  {
    name: "Reunião Estratégica de Diretoria",
    type: "strategic",
    objective: "Alinhamento estratégico trimestral: cenários, prioridades, investimentos e estrutura.",
    cadence: "trimestral",
    durationMin: 180,
    agendaTemplate: "## Reunião Estratégica\n\n### 1. Visão de cenário externo e interno\n\n### 2. Revisão do plano estratégico\n\n### 3. Prioridades do próximo trimestre\n- Objetivo 1\n- Objetivo 2\n- Objetivo 3\n\n### 4. Investimentos e estrutura\n\n### 5. Decisões e donos\n- Decisão | Dono | Prazo\n\n### 6. Riscos estratégicos\n- ",
  },
];

function labelCadence(c: string | null) {
  if (!c) return "sem cadência";
  const map: Record<string, string> = {
    daily: "diária", weekly: "semanal", biweekly: "quinzenal",
    monthly: "mensal", quarterly: "trimestral", yearly: "anual",
  };
  return map[c.toLowerCase()] ?? c;
}

type Ritual = {
  id: string; name: string; type: string; objective: string | null;
  cadence: string | null; durationMin: number; status: string;
  agendaTemplate: string | null; checklist: string[] | null;
  weekDay: string | null;
  _count: { participants: number; occurrences: number };
  occurrences: Array<{ id: string; scheduledAt: string; status: string }>;
};

function RitualsPage() {
  const { orgId } = useCurrentOrg();
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const list = useQuery({
    queryKey: ["org", "rituals", orgId],
    queryFn: () => api<Ritual[]>(`/organization/${orgId}/rituals`),
    enabled: !!orgId,
  });

  const create = useMutation({
    mutationFn: (body: Record<string, unknown>) => api(`/organization/${orgId}/rituals`, { method: "POST", body }),
    onSuccess: () => { toast.success("Ritual criado."); qc.invalidateQueries({ queryKey: ["org", "rituals", orgId] }); setCreating(false); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!orgId) return null;

  return (
    <div className="space-y-4">
      {list.data?.length === 0 && (
        <section className="rounded-3xl border border-border bg-card p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                <Workflow className="h-3.5 w-3.5" /> Rituais de gestão
              </div>
              <h1 className="mt-2 font-display text-2xl leading-tight">Por que ter rituais?</h1>
              <p className="mt-3 text-sm text-muted-foreground">
                Ritual é uma reunião recorrente com propósito claro — o ritmo da sua gestão. Quando eles existem e acontecem,
                você ganha previsibilidade, alinhamento e controle da operação sem precisar "sair apagando incêndio".
              </p>
              <div className="mt-4 space-y-2 text-sm text-muted-foreground">
                <div className="flex gap-2"><span className="font-semibold text-foreground">Comece pelo mínimo viável:</span></div>
                <ul className="space-y-1 pl-5 marker:text-violet-500 list-disc">
                  <li><b>Daily (15 min/dia)</b> — alinhamento rápido de prioridades e bloqueios com a equipe.</li>
                  <li><b>Weekly (60 min/semana)</b> — revisão da semana, prioridades da próxima e pendências.</li>
                  <li><b>1:1 (45 min/quinzena)</b> — conversa individual com cada liderado sobre carreira e desempenho.</li>
                  <li><b>Retrospectiva (90 min/sprint)</b> — lições aprendidas e planos de ação concretos.</li>
                  <li><b>Checkpoint de Indicadores (60 min/mês)</b> — acompanhamento de metas e desvios dos KPIs.</li>
                </ul>
                <p className="mt-4 rounded-2xl border border-violet-200/70 bg-violet-50/70 p-3 text-xs text-violet-800 dark:border-violet-800/50 dark:bg-violet-950/40 dark:text-violet-200">
                  💡 <b>Dica:</b> ao clicar em <b>Novo ritual</b>, você encontrará <b>10 modelos prontos</b> com nome, objetivo e
                  pauta padrão. Basta selecionar um deles para já sair com tudo preenchido.
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-3 self-start">
              <Button className="gap-2" onClick={() => setCreating(true)}>
                <Plus className="h-4 w-4" /> Criar meu primeiro ritual
              </Button>
              <span className="text-center text-[11px] text-muted-foreground">
                Sugestão: comece criando o Daily da equipe
              </span>
            </div>
          </div>
        </section>
      )}

      {list.data && list.data.length > 0 && (
        <div className="flex justify-end">
          <Dialog open={creating} onOpenChange={setCreating}>
            <DialogTrigger asChild><Button size="sm"><Plus className="h-3.5 w-3.5" /> Novo ritual</Button></DialogTrigger>
            <DialogContent className="sm:max-w-2xl max-h-[92vh] overflow-hidden flex flex-col">
              <CreateForm onSave={(v) => create.mutate(v)} saving={create.isPending} />
            </DialogContent>
          </Dialog>
        </div>
      )}

      {list.data && list.data.length > 0 && (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {list.data.map((r) => (
            <button key={r.id} onClick={() => setDetailId(r.id)} className="rounded-2xl border border-border bg-card p-5 text-left transition-shadow hover:shadow-md">
              <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
                <Workflow className="h-3.5 w-3.5" /> {labelType(r.type)}
              </div>
              <div className="mt-2 font-display text-xl">{r.name}</div>
              <div className="mt-1 line-clamp-2 text-sm text-muted-foreground">{r.objective ?? "Sem objetivo definido."}</div>
              <div className="mt-4 flex items-center gap-3 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" /> {r.durationMin} min</span>
                <span>{labelCadence(r.cadence)}</span>
                <span>·</span>
                <span>{r._count.occurrences} ocorrências</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {list.data?.length === 0 && (
        <Dialog open={creating} onOpenChange={setCreating}>
          <DialogContent className="sm:max-w-2xl max-h-[92vh] overflow-hidden flex flex-col">
            <CreateForm onSave={(v) => create.mutate(v)} saving={create.isPending} />
          </DialogContent>
        </Dialog>
      )}

      <Sheet open={!!detailId} onOpenChange={(o) => !o && setDetailId(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {detailId && <RitualDetail id={detailId} orgId={orgId} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function CreateForm({ onSave, saving }: { onSave: (v: Record<string, unknown>) => void; saving: boolean }) {
  const [name, setName] = useState("");
  const [type, setType] = useState("daily");
  const [objective, setObjective] = useState("");
  const [cadence, setCadence] = useState("");
  const [durationMin, setDurationMin] = useState(30);
  const [agenda, setAgenda] = useState("");
  const [weekDay, setWeekDay] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<number | null>(null);

  function applyTemplate(tpl: RitualTemplate, index: number) {
    setName(tpl.name);
    setType(tpl.type);
    setObjective(tpl.objective);
    setCadence(tpl.cadence);
    setDurationMin(tpl.durationMin);
    setAgenda(tpl.agendaTemplate);
    setWeekDay(tpl.weekDay ?? "");
    setSelectedTemplate(index);
  }

  return (
    <div className="flex min-h-0 flex-col gap-0">
      <DialogHeader className="flex-none pb-3">
        <DialogTitle>Novo ritual</DialogTitle>
      </DialogHeader>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto pr-1 pb-2">
        <div className="rounded-2xl border border-border bg-secondary/30 p-4">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5" /> Sugestões prontas — clique para usar
          </div>
          <div className="mt-3 grid max-h-[260px] grid-cols-1 gap-2 overflow-y-auto pr-1 md:grid-cols-2">
            {RITUAL_TEMPLATES.map((tpl, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => applyTemplate(tpl, idx)}
                className={`group flex items-start gap-3 rounded-xl border p-3 text-left transition-all ${
                  selectedTemplate === idx
                    ? "border-violet-400 bg-violet-50 ring-2 ring-violet-200 dark:border-violet-500 dark:bg-violet-950/40 dark:ring-violet-700/40"
                    : "border-border bg-card hover:border-violet-300 hover:bg-violet-50/40 dark:hover:border-violet-600 dark:hover:bg-violet-950/20"
                }`}
              >
                <div className={`mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full border text-[10px] ${
                  selectedTemplate === idx
                    ? "border-violet-500 bg-violet-500 text-white dark:border-violet-400 dark:bg-violet-400"
                    : "border-muted-foreground/40 text-muted-foreground opacity-0 group-hover:opacity-100"
                }`}>
                  {selectedTemplate === idx ? <Check className="h-3 w-3" /> : idx + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-display text-sm">{tpl.name}</span>
                    <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {labelType(tpl.type)}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-[10px] text-muted-foreground">
                    <span>{tpl.durationMin} min</span>
                    <span>·</span>
                    <span>{tpl.cadence}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5"><Label>Nome</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label>Tipo</Label>
            <select value={type} onChange={(e) => setType(e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
              {TYPES.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
            </select>
          </div>
          <div className="space-y-1.5"><Label>Dia da semana</Label>
            <select value={weekDay} onChange={(e) => setWeekDay(e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
              <option value="">Selecione…</option>
              <option value="segunda">Segunda</option>
              <option value="terca">Terça</option>
              <option value="quarta">Quarta</option>
              <option value="quinta">Quinta</option>
              <option value="sexta">Sexta</option>
              <option value="sabado">Sábado</option>
              <option value="domingo">Domingo</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label>Duração (min)</Label><Input type="number" value={durationMin} onChange={(e) => setDurationMin(Number(e.target.value))} /></div>
          <div className="space-y-1.5"><Label>Cadência</Label><Input value={cadence} placeholder="ex: diária, semanal" onChange={(e) => setCadence(e.target.value)} /></div>
        </div>
        <div className="space-y-1.5"><Label>Objetivo</Label><Textarea rows={2} value={objective} onChange={(e) => setObjective(e.target.value)} /></div>
        <div className="space-y-1.5"><Label>Pauta padrão (Markdown)</Label><Textarea rows={4} value={agenda} onChange={(e) => setAgenda(e.target.value)} /></div>
      </div>

      <DialogFooter className="flex-none border-t border-border pt-3">
        <Button disabled={!name || saving} onClick={() => onSave({
          name, type, objective: objective || null, cadence: cadence || null, durationMin,
          agendaTemplate: agenda || null, weekDay: weekDay || null, scope: "org", scopeId: null,
        })}>{saving ? "Salvando…" : "Criar ritual"}</Button>
      </DialogFooter>
    </div>
  );
}

function RitualDetail({ id, orgId }: { id: string; orgId: string }) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["org", "ritual", id],
    queryFn: () => api<Ritual & { participants: unknown[]; occurrences: Array<{ id: string; scheduledAt: string; status: string; minutes: string | null }> }>(`/organization/${orgId}/rituals/${id}`),
  });
  const open = useMutation({
    mutationFn: () => api(`/organization/${orgId}/rituals/${id}/occurrences`, { method: "POST", body: { scheduledAt: new Date().toISOString() } }),
    onSuccess: () => { toast.success("Ocorrência aberta."); qc.invalidateQueries({ queryKey: ["org", "ritual", id] }); },
  });

  const r = q.data;
  if (!r) return null;
  return (
    <>
      <SheetHeader><SheetTitle>{r.name}</SheetTitle></SheetHeader>
      <div className="mt-4 space-y-4 text-sm">
        <div><div className="text-[10px] uppercase tracking-widest text-muted-foreground">Objetivo</div><div className="mt-1">{r.objective ?? "—"}</div></div>
        <div><div className="text-[10px] uppercase tracking-widest text-muted-foreground">Cadência</div><div className="mt-1">{labelCadence(r.cadence)} {r.weekDay ? `(${r.weekDay})` : ""} · {r.durationMin} min</div></div>
        {r.agendaTemplate && (
          <div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Pauta</div>
            <pre className="mt-1 whitespace-pre-wrap rounded-md bg-secondary/40 p-3 text-xs">{r.agendaTemplate}</pre>
          </div>
        )}

        <div className="flex items-center justify-between border-t border-border pt-4">
          <div className="text-sm font-medium">Ocorrências</div>
          <Button size="sm" variant="outline" onClick={() => open.mutate()} disabled={open.isPending}>
            <Play className="h-3 w-3" /> Abrir agora
          </Button>
        </div>
        <ul className="space-y-1.5">
          {r.occurrences.map((o) => (
            <li key={o.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-xs">
              <span>{new Date(o.scheduledAt).toLocaleString("pt-BR")}</span>
              <span className="text-muted-foreground">{o.status}</span>
            </li>
          ))}
          {r.occurrences.length === 0 && <li className="text-xs text-muted-foreground">Nenhuma ocorrência.</li>}
        </ul>
      </div>
    </>
  );
}
