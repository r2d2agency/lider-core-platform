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
import { ClipboardList, Plus, AlertTriangle, BellRing, Download } from "lucide-react";
import { exportCsv } from "@/lib/csv-export";

export const Route = createFileRoute("/_authenticated/app/organization/delegations")({
  component: DelegationsPage,
});

type Delegation = {
  id: string; title: string; description: string | null;
  status: "open" | "in_progress" | "blocked" | "done" | "canceled";
  priority: "low" | "medium" | "high" | "critical";
  dueAt: string | null; doneCriteria: string | null;
  assigneeId?: string | null;
  _count: { comments: number };
};

type FollowUp = {
  id: string; title: string; status: Delegation["status"]; priority: Delegation["priority"];
  dueAt: string | null; assigneeId: string | null; overdueDays: number | null; staleDays: number;
  reason: string;
};

const COLUMNS: Array<{ key: Delegation["status"]; label: string }> = [
  { key: "open", label: "Aberta" },
  { key: "in_progress", label: "Em andamento" },
  { key: "blocked", label: "Bloqueada" },
  { key: "done", label: "Concluída" },
];

function DelegationsPage() {
  const { orgId } = useCurrentOrg();
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Delegation | null>(null);

  const q = useQuery({
    queryKey: ["org", "delegations", orgId],
    queryFn: () => api<Delegation[]>(`/organization/${orgId}/delegations`),
    enabled: !!orgId,
  });

  const create = useMutation({
    mutationFn: (body: Record<string, unknown>) => api(`/organization/${orgId}/delegations`, { method: "POST", body }),
    onSuccess: () => { toast.success("Delegação criada."); qc.invalidateQueries({ queryKey: ["org", "delegations", orgId] }); setCreating(false); },
    onError: (e: Error) => toast.error(e.message),
  });
  const patch = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) => api(`/organization/${orgId}/delegations/${id}`, { method: "PATCH", body }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["org", "delegations", orgId] }); },
  });

  const followUp = useQuery({
    queryKey: ["org", "delegations", "follow-up", orgId],
    queryFn: () => api<FollowUp[]>(`/organization/${orgId}/delegations/follow-up`),
    enabled: !!orgId,
  });

  const nudge = useMutation({
    mutationFn: ({ id, message }: { id: string; message?: string }) =>
      api(`/organization/${orgId}/delegations/${id}/nudge`, { method: "POST", body: { message } }),
    onSuccess: () => {
      toast.success("Responsável notificado.");
      qc.invalidateQueries({ queryKey: ["org", "delegations", "follow-up", orgId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const now = Date.now();
  const cols = new Map<Delegation["status"], Delegation[]>();
  COLUMNS.forEach((c) => cols.set(c.key, []));
  (q.data ?? []).forEach((d) => { if (d.status !== "canceled") cols.get(d.status)?.push(d); });

  return (
    <div className="space-y-4">
      {followUp.data && followUp.data.length > 0 && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-widest text-amber-700 dark:text-amber-400">Follow-up ativo</div>
              <div className="text-sm font-medium">
                {followUp.data.length} delegação(ões) precisam de cobrança
              </div>
            </div>
          </div>
          <ul className="mt-3 space-y-2">
            {followUp.data.slice(0, 6).map((d) => (
              <li key={d.id} className="flex items-center gap-3 rounded-lg border border-border bg-background p-3 text-sm">
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{d.title}</div>
                  <div className="truncate text-xs text-muted-foreground">{d.reason}</div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!d.assigneeId || nudge.isPending}
                  onClick={() => nudge.mutate({ id: d.id })}
                  className="gap-1"
                >
                  <BellRing className="h-3.5 w-3.5" /> Cobrar
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="flex justify-end">
        <Button
          size="sm"
          variant="outline"
          className="mr-2 gap-1"
          disabled={!q.data?.length}
          onClick={() =>
            exportCsv(
              `delegacoes-${new Date().toISOString().slice(0, 10)}.csv`,
              q.data ?? [],
              [
                { key: "title", label: "Título" },
                { key: "status", label: "Status" },
                { key: "priority", label: "Prioridade" },
                { key: "dueAt", label: "Prazo", get: (r) => (r.dueAt ? new Date(r.dueAt as string).toLocaleDateString("pt-BR") : "") },
                { key: "description", label: "Descrição" },
                { key: "doneCriteria", label: "Critério de concluído" },
              ],
            )
          }
        >
          <Download className="h-3.5 w-3.5" /> Exportar CSV
        </Button>
        <Dialog open={creating} onOpenChange={setCreating}>
          <DialogTrigger asChild><Button size="sm"><Plus className="h-3.5 w-3.5" /> Nova delegação</Button></DialogTrigger>
          <DialogContent><CreateForm onSave={(v) => create.mutate(v)} saving={create.isPending} /></DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        {COLUMNS.map((c) => (
          <div key={c.key} className="rounded-2xl border border-border bg-card">
            <div className="border-b border-border px-4 py-2.5 text-xs uppercase tracking-widest text-muted-foreground">
              {c.label} <span className="ml-1 text-foreground">({cols.get(c.key)?.length ?? 0})</span>
            </div>
            <div className="space-y-2 p-3">
              {cols.get(c.key)?.map((d) => {
                const overdue = d.dueAt && new Date(d.dueAt).getTime() < now && d.status !== "done";
                return (
                  <button key={d.id} onClick={() => setEditing(d)} className="w-full rounded-xl border border-border bg-background p-3 text-left text-sm hover:shadow-sm">
                    <div className="flex items-start justify-between">
                      <span className="font-medium">{d.title}</span>
                      <PriorityDot p={d.priority} />
                    </div>
                    {d.description && <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">{d.description}</div>}
                    <div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
                      {d.dueAt && <span className={overdue ? "flex items-center gap-1 text-amber-600" : ""}>{overdue && <AlertTriangle className="h-3 w-3" />}{new Date(d.dueAt).toLocaleDateString("pt-BR")}</span>}
                      {d._count.comments > 0 && <span>💬 {d._count.comments}</span>}
                    </div>
                  </button>
                );
              })}
              {cols.get(c.key)?.length === 0 && <div className="rounded-md border border-dashed border-border p-4 text-center text-xs text-muted-foreground">Vazio</div>}
            </div>
          </div>
        ))}
      </div>

      <Sheet open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editing?.title}</SheetTitle>
          </SheetHeader>
          {editing && (
            <div className="mt-4 space-y-4 text-sm">
              <div>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Responsável</div>
                <div className="mt-1 font-medium">
                  {/* Se tivermos os membros carregados poderíamos mostrar o nome, 
                      por enquanto mostramos o status do responsável */}
                  {editing.assigneeId ? "Liderado atribuído" : "Sem responsável"}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Descrição</div>
                <div className="mt-1">{editing.description ?? "—"}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Critério de concluído</div>
                <div className="mt-1">{editing.doneCriteria ?? "—"}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Status</div>
                <select
                  value={editing.status}
                  onChange={(e) => {
                    patch.mutate({ id: editing.id, body: { status: e.target.value } });
                    setEditing({ ...editing, status: e.target.value as Delegation["status"] });
                  }}
                  className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  {COLUMNS.map((c) => (
                    <option key={c.key} value={c.key}>
                      {c.label}
                    </option>
                  ))}
                  <option value="canceled">Cancelada</option>
                </select>
              </div>
              <Button
                variant="outline"
                className="w-full gap-2"
                disabled={nudge.isPending || editing.status === "done" || editing.status === "canceled" || !editing.assigneeId}
                onClick={() => nudge.mutate({ id: editing.id })}
              >
                <BellRing className="h-4 w-4" /> Cobrar responsável
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function PriorityDot({ p }: { p: Delegation["priority"] }) {
  const cls = { low: "bg-muted", medium: "bg-sky-500", high: "bg-amber-500", critical: "bg-red-500" }[p];
  return <span className={`inline-block h-2 w-2 rounded-full ${cls}`} title={p} />;
}

function CreateForm({ onSave, saving }: { onSave: (v: Record<string, unknown>) => void; saving: boolean }) {
  const { orgId } = useCurrentOrg();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [priority, setPriority] = useState<Delegation["priority"]>("medium");
  const [doneCriteria, setDoneCriteria] = useState("");
  const [assigneeId, setAssigneeId] = useState("");

  const members = useQuery({
    queryKey: ["org", "members", orgId],
    queryFn: () => api<any[]>(`/organization/${orgId}/members`),
    enabled: !!orgId,
  });

  return (
    <div className="space-y-4">
      <DialogHeader>
        <DialogTitle>Nova delegação</DialogTitle>
      </DialogHeader>
      <div className="space-y-1.5">
        <Label>Título</Label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="O que precisa ser feito?" />
      </div>
      <div className="space-y-1.5">
        <Label>Responsável (Liderado)</Label>
        <select
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          value={assigneeId}
          onChange={(e) => setAssigneeId(e.target.value)}
          required
        >
          <option value="">Selecione um responsável...</option>
          {members.data?.map((m) => (
            <option key={m.userId} value={m.userId}>
              {m.profile.fullName}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label>Descrição</Label>
        <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Instruções e contexto..." />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Prazo</Label>
          <Input type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Prioridade</Label>
          <select
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={priority}
            onChange={(e) => setPriority(e.target.value as Delegation["priority"])}
          >
            <option value="low">Baixa</option>
            <option value="medium">Média</option>
            <option value="high">Alta</option>
            <option value="critical">Crítica</option>
          </select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Critério de concluído</Label>
        <Textarea rows={2} value={doneCriteria} onChange={(e) => setDoneCriteria(e.target.value)} placeholder="O que define esta tarefa como pronta?" />
      </div>
      <DialogFooter>
        <Button
          disabled={!title || !assigneeId || saving}
          onClick={() =>
            onSave({
              title,
              description: description || null,
              priority,
              dueAt: dueAt ? new Date(dueAt).toISOString() : null,
              doneCriteria: doneCriteria || null,
              assigneeId: assigneeId || null,
            })
          }
        >
          {saving ? "Salvando…" : "Criar"}
        </Button>
      </DialogFooter>
    </div>
  );
}
