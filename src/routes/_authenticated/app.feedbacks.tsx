import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, Compass, Loader2, MessageSquarePlus, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/app/feedbacks")({
  component: FeedbacksPage,
});

type FeedbackType =
  | "positivo"
  | "corretivo"
  | "alinhamento"
  | "cobranca"
  | "conflito"
  | "desligamento"
  | "reconhecimento"
  | "estruturado"
  | "informal";

type FeedbackStatus = "registrado" | "em_acompanhamento" | "concluido" | "reaberto";

type Feedback = {
  id: string;
  type: FeedbackType;
  subjectUserId: string | null;
  subjectLabel: string | null;
  fact: string;
  impact: string;
  expectation: string;
  agreement: string | null;
  dueAt: string | null;
  followUpAt: string | null;
  status: FeedbackStatus;
  tags: string[];
  createdAt: string;
};

type Template = {
  type: FeedbackType;
  label: string;
  fact: string;
  impact: string;
  expectation: string;
  agreement: string;
};

const TYPE_LABEL: Record<FeedbackType, string> = {
  positivo: "Positivo",
  corretivo: "Corretivo",
  alinhamento: "Alinhamento",
  cobranca: "Cobrança",
  conflito: "Conflito",
  desligamento: "Desligamento",
  reconhecimento: "Reconhecimento",
  estruturado: "Estruturado",
  informal: "Informal",
};

const STATUS_LABEL: Record<FeedbackStatus, string> = {
  registrado: "Registrado",
  em_acompanhamento: "Em acompanhamento",
  concluido: "Concluído",
  reaberto: "Reaberto",
};

function FeedbacksPage() {
  const { orgId } = useCurrentOrg();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [filterType, setFilterType] = useState<string>("");

  const { data: items = [], isLoading } = useQuery<Feedback[]>({
    queryKey: ["feedbacks", orgId, filterType],
    enabled: !!orgId,
    queryFn: () =>
      api<Feedback[]>(
        `/organization/${orgId}/feedbacks${filterType ? `?type=${filterType}` : ""}`,
      ),
  });

  const { data: templates = [] } = useQuery<Template[]>({
    queryKey: ["feedbacks", "templates", orgId],
    enabled: !!orgId,
    queryFn: () => api<Template[]>(`/organization/${orgId}/feedbacks-templates`),
  });

  const del = useMutation({
    mutationFn: (id: string) =>
      api(`/organization/${orgId}/feedbacks/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["feedbacks", orgId] }),
  });

  const patchStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: FeedbackStatus }) =>
      api(`/organization/${orgId}/feedbacks/${id}`, { method: "PATCH", body: { status } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["feedbacks", orgId] }),
  });

  if (!orgId) return null;

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <header className="flex items-start justify-between gap-6">
        <div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground">
            Tela 6 — Feedback e conversas difíceis
          </div>
          <h1 className="mt-2 font-display text-4xl leading-tight">Feedbacks</h1>
          <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
            Estrutura fixa: Fato → Impacto → Expectativa → Combinado → Prazo. Cada registro vira acompanhamento e alimenta a Sala de Liderança.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <MessageSquarePlus className="h-4 w-4" /> Registrar feedback
            </Button>
          </DialogTrigger>
          <FeedbackDialog
            orgId={orgId}
            templates={templates}
            onDone={() => {
              setOpen(false);
              qc.invalidateQueries({ queryKey: ["feedbacks", orgId] });
            }}
          />
        </Dialog>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setFilterType("")}
          className={
            "rounded-full border px-3 py-1 text-xs transition-colors " +
            (filterType === ""
              ? "border-foreground bg-foreground text-background"
              : "border-border hover:bg-secondary")
          }
        >
          Todos
        </button>
        {(Object.keys(TYPE_LABEL) as FeedbackType[]).map((t) => (
          <button
            key={t}
            onClick={() => setFilterType(t)}
            className={
              "rounded-full border px-3 py-1 text-xs transition-colors " +
              (filterType === t
                ? "border-foreground bg-foreground text-background"
                : "border-border hover:bg-secondary")
            }
          >
            {TYPE_LABEL[t]}
          </button>
        ))}
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
        </div>
      )}

      {!isLoading && items.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border bg-secondary/30 p-8 text-center">
          <Compass className="mx-auto h-8 w-8 text-muted-foreground" />
          <div className="mt-3 font-medium">Nenhum feedback registrado ainda</div>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Comece com um modelo pronto. A estrutura garante que a conversa vira combinado, não desabafo.
          </p>
        </div>
      )}

      <ul className="space-y-3">
        {items.map((f) => (
          <li key={f.id} className="rounded-xl border border-border bg-background p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-foreground">
                    {TYPE_LABEL[f.type]}
                  </span>
                  <span>{STATUS_LABEL[f.status]}</span>
                  {f.subjectLabel && <span>· {f.subjectLabel}</span>}
                  <span>· {new Date(f.createdAt).toLocaleDateString("pt-BR")}</span>
                </div>
                <div className="mt-3 grid gap-2 text-sm md:grid-cols-2">
                  <div>
                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Fato</div>
                    <div>{f.fact}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Impacto</div>
                    <div>{f.impact}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Expectativa</div>
                    <div>{f.expectation}</div>
                  </div>
                  {f.agreement && (
                    <div>
                      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Combinado</div>
                      <div>{f.agreement}</div>
                    </div>
                  )}
                </div>
                {(f.dueAt || f.followUpAt) && (
                  <div className="mt-3 text-xs text-muted-foreground">
                    {f.dueAt && <>Prazo: {new Date(f.dueAt).toLocaleDateString("pt-BR")} · </>}
                    {f.followUpAt && <>Acompanhamento: {new Date(f.followUpAt).toLocaleDateString("pt-BR")}</>}
                  </div>
                )}
              </div>
              <div className="flex flex-col items-end gap-1">
                <Select
                  value={f.status}
                  onValueChange={(v) => patchStatus.mutate({ id: f.id, status: v as FeedbackStatus })}
                >
                  <SelectTrigger className="h-8 w-40 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(STATUS_LABEL) as FeedbackStatus[]).map((s) => (
                      <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <button
                  onClick={() => del.mutate(f.id)}
                  className="rounded-full p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  aria-label="Excluir"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function FeedbackDialog({
  orgId,
  templates,
  onDone,
}: {
  orgId: string;
  templates: Template[];
  onDone: () => void;
}) {
  const [type, setType] = useState<FeedbackType>("alinhamento");
  const [subjectLabel, setSubjectLabel] = useState("");
  const [fact, setFact] = useState("");
  const [impact, setImpact] = useState("");
  const [expectation, setExpectation] = useState("");
  const [agreement, setAgreement] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [followUpAt, setFollowUpAt] = useState("");

  const applyTemplate = (t: FeedbackType) => {
    const tpl = templates.find((x) => x.type === t);
    if (!tpl) return;
    setFact(tpl.fact);
    setImpact(tpl.impact);
    setExpectation(tpl.expectation);
    setAgreement(tpl.agreement);
  };

  const create = useMutation({
    mutationFn: () =>
      api(`/organization/${orgId}/feedbacks`, {
        method: "POST",
        body: {
          type,
          subjectLabel: subjectLabel || null,
          fact,
          impact,
          expectation,
          agreement: agreement || null,
          dueAt: dueAt ? new Date(dueAt).toISOString() : null,
          followUpAt: followUpAt ? new Date(followUpAt).toISOString() : null,
        },
      }),
    onSuccess: () => {
      toast.success("Feedback registrado");
      onDone();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao salvar"),
  });

  return (
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle>Registrar feedback</DialogTitle>
      </DialogHeader>
      <div className="space-y-4 py-2">
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <Label>Tipo</Label>
            <Select
              value={type}
              onValueChange={(v) => {
                setType(v as FeedbackType);
                applyTemplate(v as FeedbackType);
              }}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(TYPE_LABEL) as FeedbackType[]).map((t) => (
                  <SelectItem key={t} value={t}>{TYPE_LABEL[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Para quem (livre)</Label>
            <Input
              value={subjectLabel}
              onChange={(e) => setSubjectLabel(e.target.value)}
              placeholder="Nome ou papel"
            />
          </div>
        </div>

        <div>
          <Label>Fato observável</Label>
          <Textarea value={fact} onChange={(e) => setFact(e.target.value)} className="min-h-[70px]" />
        </div>
        <div>
          <Label>Impacto</Label>
          <Textarea value={impact} onChange={(e) => setImpact(e.target.value)} className="min-h-[70px]" />
        </div>
        <div>
          <Label>Expectativa</Label>
          <Textarea value={expectation} onChange={(e) => setExpectation(e.target.value)} className="min-h-[70px]" />
        </div>
        <div>
          <Label>Combinado</Label>
          <Textarea value={agreement} onChange={(e) => setAgreement(e.target.value)} className="min-h-[70px]" />
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <Label>Prazo</Label>
            <Input type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
          </div>
          <div>
            <Label>Acompanhamento</Label>
            <Input type="date" value={followUpAt} onChange={(e) => setFollowUpAt(e.target.value)} />
          </div>
        </div>
      </div>
      <DialogFooter>
        <Button
          onClick={() => create.mutate()}
          disabled={create.isPending || !fact || !impact || !expectation}
        >
          {create.isPending ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
          Salvar
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
