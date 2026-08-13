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
import { Workflow, Plus, Play, Clock } from "lucide-react";

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
      <div className="flex justify-end">
        <Dialog open={creating} onOpenChange={setCreating}>
          <DialogTrigger asChild><Button size="sm"><Plus className="h-3.5 w-3.5" /> Novo ritual</Button></DialogTrigger>
          <DialogContent><CreateForm onSave={(v) => create.mutate(v)} saving={create.isPending} /></DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {list.data?.map((r) => (
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
        {list.data?.length === 0 && (
          <div className="col-span-full rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            Nenhum ritual cadastrado. Comece com um Daily, uma Weekly e um 1:1.
          </div>
        )}
      </div>

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
  return (
    <div className="space-y-4">
      <DialogHeader><DialogTitle>Novo ritual</DialogTitle></DialogHeader>
      <div className="space-y-1.5"><Label>Nome</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5"><Label>Tipo</Label>
          <select value={type} onChange={(e) => setType(e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
            {TYPES.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
          </select>
        </div>
        <div className="space-y-1.5"><Label>Dia da semana (opcional)</Label>
          <select value={weekDay} onChange={(e) => setWeekDay(e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
            <option value="">Selecione...</option>
            <option value="segunda">Segunda-feira</option>
            <option value="terca">Terça-feira</option>
            <option value="quarta">Quarta-feira</option>
            <option value="quinta">Quinta-feira</option>
            <option value="sexta">Sexta-feira</option>
            <option value="sabado">Sábado</option>
            <option value="domingo">Domingo</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5"><Label>Duração (min)</Label><Input type="number" value={durationMin} onChange={(e) => setDurationMin(Number(e.target.value))} /></div>
        <div className="space-y-1.5"><Label>Cadência (ex: diária, semanal)</Label><Input value={cadence} onChange={(e) => setCadence(e.target.value)} /></div>
      </div>
      <div className="space-y-1.5"><Label>Objetivo</Label><Textarea rows={2} value={objective} onChange={(e) => setObjective(e.target.value)} /></div>
      <div className="space-y-1.5"><Label>Pauta padrão (Markdown)</Label><Textarea rows={4} value={agenda} onChange={(e) => setAgenda(e.target.value)} /></div>
      <DialogFooter>
        <Button disabled={!name || saving} onClick={() => onSave({
          name, type, objective: objective || null, cadence: cadence || null, durationMin,
          agendaTemplate: agenda || null, weekDay: weekDay || null, scope: "org", scopeId: null,
        })}>{saving ? "Salvando…" : "Criar"}</Button>
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
