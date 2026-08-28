import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useCurrentOrg } from "@/lib/use-current-org";
import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { LayoutGrid, Plus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/organization/areas")({
  component: AreasPage,
});

type Area = {
  id: string; name: string;
  description?: string | null;
  mission: string | null; objective: string | null; kpis: string[];
  purpose: string | null; deliverables: string[];
  contextMd: string | null;
  branch?: { id: string; name: string } | null;
  _count?: { memberships: number; teams?: number };
};

function AreasPage() {
  const { orgId } = useCurrentOrg();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Area | null>(null);
  const [creating, setCreating] = useState(false);

  const q = useQuery({
    queryKey: ["platform", "areas", orgId],
    queryFn: () => api<Area[]>(`/platform/organizations/${orgId}/areas`),
    enabled: !!orgId,
  });

  const save = useMutation({
    mutationFn: (patch: Partial<Area>) =>
      api(`/organization/${orgId}/areas/${editing!.id}`, { method: "PATCH", body: patch }),
    onSuccess: () => {
      toast.success("Área atualizada.");
      qc.invalidateQueries({ queryKey: ["platform", "areas", orgId] });
      qc.invalidateQueries({ queryKey: ["org"] });
      setEditing(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const create = useMutation({
    mutationFn: (payload: { name: string; description?: string | null }) =>
      api(`/platform/organizations/${orgId}/areas`, { method: "POST", body: payload }),
    onSuccess: () => {
      toast.success("Área criada.");
      qc.invalidateQueries({ queryKey: ["platform", "areas", orgId] });
      qc.invalidateQueries({ queryKey: ["org"] });
      setCreating(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!orgId) return null;

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-border bg-card p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              <LayoutGrid className="h-3.5 w-3.5" /> Áreas da empresa
            </div>
            <h1 className="mt-2 font-display text-2xl leading-tight">O que é uma área?</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Área é um agrupador organizacional acima das equipes. Ela serve para separar grandes frentes do negócio,
              como Marketing, Comercial, Operações, Financeiro ou RH, e ajuda a organizar missão, objetivo e indicadores
              de cada núcleo.
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Se você ainda não estruturou isso, comece criando as áreas principais da empresa e depois distribua as equipes
              dentro delas.
            </p>
          </div>
          <Button className="gap-2 self-start" onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" /> Criar área
          </Button>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {q.data?.map((a) => (
          <button
            key={a.id}
            onClick={() => setEditing(a)}
            className="rounded-2xl border border-border bg-card p-5 text-left transition-shadow hover:shadow-md"
          >
            <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
              <LayoutGrid className="h-3.5 w-3.5" /> Área
            </div>
            <div className="mt-2 font-display text-xl">{a.name}</div>
            <div className="mt-2 line-clamp-2 text-sm text-muted-foreground">
              {a.purpose ?? a.mission ?? a.description ?? "Sem propósito definido."}
            </div>
            {a.branch?.name && (
              <div className="mt-2 text-[11px] text-muted-foreground">
                Vinculada à filial {a.branch.name}
              </div>
            )}
            {a.deliverables?.length > 0 && (
              <div className="mt-2 text-[11px] text-muted-foreground">
                {a.deliverables.length} entrega{a.deliverables.length === 1 ? "" : "s"} esperada{a.deliverables.length === 1 ? "" : "s"}
              </div>
            )}
            <div className="mt-4 flex flex-wrap gap-1.5">
              {a.kpis.slice(0, 3).map((k) => (
                <span key={k} className="rounded-full bg-secondary px-2 py-0.5 text-[11px]">{k}</span>
              ))}
              {a.kpis.length > 3 && <span className="text-[11px] text-muted-foreground">+{a.kpis.length - 3}</span>}
            </div>
          </button>
        ))}
        {q.data && q.data.length === 0 && (
          <div className="col-span-full rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            Você ainda não criou nenhuma área. Use o botão <b>Criar área</b> para começar a estruturar a empresa.
          </div>
        )}
      </div>

      <Sheet open={creating} onOpenChange={setCreating}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader><SheetTitle>Nova área</SheetTitle></SheetHeader>
          <CreateAreaForm onSave={(v) => create.mutate(v)} saving={create.isPending} />
        </SheetContent>
      </Sheet>

      <Sheet open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader><SheetTitle>{editing?.name}</SheetTitle></SheetHeader>
          {editing && <AreaForm key={editing.id} area={editing} onSave={(v) => save.mutate(v)} saving={save.isPending} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function CreateAreaForm({
  onSave,
  saving,
}: {
  onSave: (v: { name: string; description?: string | null }) => void;
  saving: boolean;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  return (
    <div className="mt-4 space-y-4">
      <div className="rounded-2xl border border-border bg-secondary/30 px-4 py-3 text-sm text-muted-foreground">
        Crie uma área para representar uma frente maior da empresa. Exemplo: Comercial, Marketing, Operações, Financeiro ou RH.
      </div>
      <div className="space-y-1.5">
        <Label>Nome da área</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Comercial" />
      </div>
      <div className="space-y-1.5">
        <Label>Descrição curta</Label>
        <Textarea
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Ex.: Área responsável pela geração de receita, gestão do funil e expansão de clientes."
        />
      </div>
      <div className="flex justify-end">
        <Button disabled={saving || !name.trim()} onClick={() => onSave({ name: name.trim(), description: description.trim() || null })}>
          {saving ? "Criando…" : "Criar área"}
        </Button>
      </div>
    </div>
  );
}

function AreaForm({ area, onSave, saving }: { area: Area; onSave: (v: Partial<Area>) => void; saving: boolean }) {
  const [purpose, setPurpose] = useState(area.purpose ?? "");
  const [deliverablesText, setDeliverablesText] = useState((area.deliverables ?? []).join("\n"));
  const [mission, setMission] = useState(area.mission ?? "");
  const [objective, setObjective] = useState(area.objective ?? "");
  const [kpisText, setKpisText] = useState(area.kpis.join(", "));
  const [contextMd, setContextMd] = useState(area.contextMd ?? "");

  return (
    <div className="mt-4 space-y-4">
      <div className="space-y-1.5">
        <Label>Propósito da área</Label>
        <Textarea rows={2} value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="Pra que essa área existe — em uma frase." />
      </div>
      <div className="space-y-1.5">
        <Label>Entregas esperadas (uma por linha)</Label>
        <Textarea rows={4} value={deliverablesText} onChange={(e) => setDeliverablesText(e.target.value)} placeholder={"Ex.:\nRelatório mensal de vendas\nOnboarding de novos clientes"} />
        <p className="text-xs text-muted-foreground">O que precisa acontecer aqui, sempre — independente de quem estiver.</p>
      </div>
      <div className="space-y-1.5">
        <Label>Missão</Label>
        <Textarea rows={2} value={mission} onChange={(e) => setMission(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label>Objetivo</Label>
        <Textarea rows={2} value={objective} onChange={(e) => setObjective(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label>KPIs (separados por vírgula)</Label>
        <Input value={kpisText} onChange={(e) => setKpisText(e.target.value)} placeholder="NPS, Turnover, OKR-1" />
      </div>
      <div className="space-y-1.5">
        <Label>Contexto (IA)</Label>
        <Textarea rows={4} value={contextMd} onChange={(e) => setContextMd(e.target.value)} placeholder="Contexto livre em Markdown para alimentar diagnósticos futuros da IA." />
      </div>
      <div className="flex justify-end">
        <Button
          disabled={saving}
          onClick={() => onSave({
            purpose: purpose || null,
            deliverables: deliverablesText.split("\n").map((s) => s.trim()).filter(Boolean),
            mission: mission || null,
            objective: objective || null,
            kpis: kpisText.split(",").map((s) => s.trim()).filter(Boolean),
            contextMd: contextMd || null,
          })}
        >
          {saving ? "Salvando…" : "Salvar"}
        </Button>
      </div>
    </div>
  );
}
