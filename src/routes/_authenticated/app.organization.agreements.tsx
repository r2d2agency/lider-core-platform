import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Handshake, Loader2, Package, Plus, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { useCurrentOrg } from "@/lib/use-current-org";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/app/organization/agreements")({
  ssr: false,
  component: AgreementsPage,
  head: () => ({
    meta: [
      { title: "Acordos do time · Organização · Líder C.O.R.E." },
      {
        name: "description",
        content:
          "Combinados de comportamento e de entrega que o time não abre mão para cumprir os objetivos do ciclo.",
      },
      { property: "og:title", content: "Acordos do time · Líder C.O.R.E." },
      {
        property: "og:description",
        content: "Registre os combinados de comportamento e entrega do seu time.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Agreement = { id: string; kind: "comportamento" | "entrega"; text: string; createdAt: string };

const KINDS = [
  {
    key: "comportamento" as const,
    label: "Comportamentos",
    icon: Handshake,
    color: "var(--pilar-o)",
    examples: [
      "Problema vem acompanhado de proposta",
      "Erro é comunicado rapidamente",
      "Pedimos ajuda antes de estourar o prazo",
    ],
  },
  {
    key: "entrega" as const,
    label: "Entregas",
    icon: Package,
    color: "var(--pilar-r)",
    examples: [
      "Toda demanda tem responsável e prazo",
      "O combinado precisa estar registrado",
    ],
  },
];

function AgreementsPage() {
  const { orgId } = useCurrentOrg();
  const qc = useQueryClient();
  const [drafts, setDrafts] = useState<Record<string, string>>({ comportamento: "", entrega: "" });

  const list = useQuery({
    queryKey: ["agreements", orgId],
    enabled: !!orgId,
    queryFn: () => api<Agreement[]>(`/organization/${orgId}/jornada/agreements`),
  });

  const add = useMutation({
    mutationFn: (kind: "comportamento" | "entrega") =>
      api(`/organization/${orgId}/jornada/agreements`, {
        method: "POST",
        body: { kind, text: drafts[kind].trim() },
      }),
    onSuccess: (_d, kind) => {
      setDrafts((d) => ({ ...d, [kind]: "" }));
      qc.invalidateQueries({ queryKey: ["agreements", orgId] });
      toast.success("Acordo registrado.");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Não foi possível salvar."),
  });

  const remove = useMutation({
    mutationFn: (id: string) =>
      api(`/organization/${orgId}/jornada/agreements/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["agreements", orgId] }),
  });

  return (
    <div className="space-y-6 pb-6">
      <p className="text-sm text-muted-foreground">
        Os acordos são a parte do módulo Organização que sustenta a execução: comportamentos-padrão e
        entregas que o time não abre mão. Em Evolução eles viram referência para leitura de causa raiz.
      </p>

      <div className="grid gap-4 lg:grid-cols-2">
        {KINDS.map(({ key, label, icon: Icon, color, examples }) => {
          const rows = (list.data ?? []).filter((a) => a.kind === key);
          return (
            <section key={key} className="space-y-4 rounded-2xl border border-border bg-card p-6">
              <h2 className="flex items-center gap-2 font-display text-xl">
                <Icon className="h-5 w-5" style={{ color }} /> {label}
              </h2>

              {list.isLoading && <div className="text-sm text-muted-foreground">Carregando…</div>}
              {!list.isLoading && rows.length === 0 && (
                <div className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                  Nenhum acordo ainda. Sugestões: {examples.join(" · ")}
                </div>
              )}

              <ul className="space-y-2">
                {rows.map((a) => (
                  <li
                    key={a.id}
                    className="flex items-start justify-between gap-3 rounded-xl border border-border/70 p-3 text-sm"
                  >
                    <span>{a.text}</span>
                    <Button variant="ghost" size="icon" onClick={() => remove.mutate(a.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>

              <div className="space-y-2">
                <Textarea
                  rows={2}
                  value={drafts[key]}
                  placeholder={`Novo acordo de ${label.toLowerCase()}`}
                  onChange={(e) => setDrafts((d) => ({ ...d, [key]: e.target.value }))}
                />
                <Button
                  variant="outline"
                  className="gap-2"
                  disabled={drafts[key].trim().length < 3 || add.isPending}
                  onClick={() => add.mutate(key)}
                >
                  {add.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  Adicionar
                </Button>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
