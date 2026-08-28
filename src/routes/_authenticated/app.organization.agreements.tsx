import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Handshake,
  Loader2,
  Package,
  Plus,
  Trash2,
  UploadCloud,
  FileText,
  Image as ImageIcon,
  Download,
  Eye,
  X,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { api, uploadFile } from "@/lib/api";
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

type AgreementAttachment = {
  id: string;
  url: string;
  path: string;
  name: string;
  originalName: string;
  size: number;
  mimeType: string;
  uploadedAt: string;
};

type Agreement = {
  id: string;
  kind: "comportamento" | "entrega";
  text: string;
  description: string | null;
  attachments: AgreementAttachment[] | null;
  createdAt: string;
};

type DraftAttachment = Omit<AgreementAttachment, "uploadedAt"> & { uploading?: boolean };

const MAX_FILES = 3;
const ACCEPTED = "application/pdf,image/png,image/jpeg,image/jpg,image/webp,image/gif";

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

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isImage(mime: string): boolean {
  return mime.startsWith("image/");
}
function isPdf(mime: string): boolean {
  return mime === "application/pdf";
}

function FileIcon({ mime }: { mime: string }) {
  if (isImage(mime)) return <ImageIcon className="h-4 w-4 text-emerald-600" />;
  if (isPdf(mime)) return <FileText className="h-4 w-4 text-red-600" />;
  return <FileText className="h-4 w-4 text-muted-foreground" />;
}

function AttachmentList({
  attachments,
  onRemove,
  compact = false,
}: {
  attachments: AgreementAttachment[] | DraftAttachment[];
  onRemove?: (id: string) => void;
  compact?: boolean;
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  return (
    <ul className="space-y-1.5">
      {attachments.map((a) => {
        const uploading = (a as DraftAttachment).uploading;
        return (
          <li
            key={a.id}
            className="flex items-center justify-between gap-2 rounded-lg border border-border/70 bg-background/50 px-3 py-2 text-sm"
          >
            <div className="flex min-w-0 flex-1 items-center gap-2.5">
              {uploading ? (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
              ) : (
                <FileIcon mime={a.mimeType} />
              )}
              <div className="min-w-0 flex-1">
                <div className={`truncate font-medium ${uploading ? "text-muted-foreground" : ""}`}>
                  {a.originalName}
                </div>
                {!compact && (
                  <div className="truncate text-xs text-muted-foreground">{formatSize(a.size)}</div>
                )}
              </div>
            </div>
            {!uploading && (
              <div className="flex items-center gap-0.5">
                {previewUrl && previewUrl === a.url && (
                  <button
                    type="button"
                    className="rounded p-1 hover:bg-muted"
                    onClick={() => setPreviewUrl(null)}
                    title="Fechar prévia"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  className="rounded p-1 hover:bg-muted"
                  onClick={() => window.open(a.url, "_blank", "noopener,noreferrer")}
                  title={isPdf(a.mimeType) || isImage(a.mimeType) ? "Visualizar" : "Abrir"}
                >
                  <Eye className="h-3.5 w-3.5" />
                </button>
                <a
                  href={a.url}
                  download={a.originalName}
                  className="rounded p-1 hover:bg-muted"
                  title="Baixar"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Download className="h-3.5 w-3.5" />
                </a>
                {onRemove && (
                  <button
                    type="button"
                    className="rounded p-1 text-destructive hover:bg-destructive/10"
                    onClick={() => onRemove(a.id)}
                    title="Remover anexo"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            )}
          </li>
        );
      })}
      {previewUrl && isImage(
        attachments.find((a) => a.url === previewUrl)?.mimeType ?? "",
      ) && (
        <li className="overflow-hidden rounded-lg border border-border">
          <img src={previewUrl} alt="preview" className="max-h-80 w-full object-contain bg-muted/30" />
        </li>
      )}
    </ul>
  );
}

type DraftState = {
  text: string;
  description: string;
  attachments: DraftAttachment[];
  expanded: boolean;
};

function AgreementsPage() {
  const { orgId } = useCurrentOrg();
  const qc = useQueryClient();
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});
  const [drafts, setDrafts] = useState<Record<string, DraftState>>({
    comportamento: { text: "", description: "", attachments: [], expanded: false },
    entrega: { text: "", description: "", attachments: [], expanded: false },
  });

  const list = useQuery({
    queryKey: ["agreements", orgId],
    enabled: !!orgId,
    queryFn: () => api<Agreement[]>(`/organization/${orgId}/jornada/agreements`),
  });

  const uploadOne = useMutation({
    mutationFn: async (file: File): Promise<AgreementAttachment> => {
      const resp = (await uploadFile(
        `/organization/${orgId}/jornada/agreements/upload`,
        file,
      )) as unknown as AgreementAttachment;
      return resp;
    },
  });

  const add = useMutation({
    mutationFn: (kind: "comportamento" | "entrega") =>
      api<Agreement>(`/organization/${orgId}/jornada/agreements`, {
        method: "POST",
        body: {
          kind,
          text: drafts[kind].text.trim(),
          description: drafts[kind].description.trim() || null,
          attachments: (drafts[kind].attachments.filter(
            (a) => !(a as DraftAttachment).uploading,
          ) as AgreementAttachment[]).length
            ? (drafts[kind].attachments as AgreementAttachment[])
            : null,
        },
      }),
    onSuccess: (_d, kind) => {
      setDrafts((d) => ({ ...d, [kind]: { text: "", description: "", attachments: [], expanded: false } }));
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

  function handleSelectFiles(kind: "comportamento" | "entrega", files: FileList | null) {
    if (!files) return;
    const arr = Array.from(files);
    const current = drafts[kind].attachments.length;
    if (current + arr.length > MAX_FILES) {
      toast.error(`Só são permitidos até ${MAX_FILES} arquivos por acordo.`);
      return;
    }
    const accepted = arr.filter(
      (f) => ACCEPTED.split(",").some((m) => m.trim() === f.type) || /\.(pdf|png|jpe?g|webp|gif)$/i.test(f.name),
    );
    if (accepted.length !== arr.length) {
      toast.warning("Alguns arquivos foram ignorados. Use PDF ou imagem (PNG, JPG, WEBP, GIF).");
    }
    if (!accepted.length) return;

    const uploading: DraftAttachment[] = accepted.map((f) => ({
      id: `pending-${Date.now()}-${f.name}-${Math.random().toString(36).slice(2, 7)}`,
      url: "",
      path: "",
      name: "",
      originalName: f.name,
      size: f.size,
      mimeType: f.type || "application/octet-stream",
      uploading: true,
    }));
    setDrafts((d) => ({
      ...d,
      [kind]: { ...d[kind], attachments: [...d[kind].attachments, ...uploading] },
    }));
    accepted.forEach((f, idx) => {
      const pendingId = uploading[idx].id;
      uploadOne.mutate(f, {
        onSuccess: (att) => {
          setDrafts((d) => ({
            ...d,
            [kind]: {
              ...d[kind],
              attachments: d[kind].attachments.map((a) => (a.id === pendingId ? att : a)),
            },
          }));
        },
        onError: (err) => {
          setDrafts((d) => ({
            ...d,
            [kind]: {
              ...d[kind],
              attachments: d[kind].attachments.filter((a) => a.id !== pendingId),
            },
          }));
          toast.error(
            `Erro no upload de "${f.name}": ${err instanceof Error ? err.message : "tente novamente"}`,
          );
        },
      });
    });
  }

  function removeAttachment(kind: "comportamento" | "entrega", attId: string) {
    setDrafts((d) => ({
      ...d,
      [kind]: { ...d[kind], attachments: d[kind].attachments.filter((a) => a.id !== attId) },
    }));
  }

  function toggleExpand(kind: "comportamento" | "entrega") {
    setDrafts((d) => ({ ...d, [kind]: { ...d[kind], expanded: !d[kind].expanded } }));
  }

  const hasExtraFields = (kind: "comportamento" | "entrega") =>
    drafts[kind].description.trim().length > 0 || drafts[kind].attachments.length > 0;

  return (
    <div className="space-y-6 pb-6">
      <div className="rounded-2xl border border-border bg-card/60 p-5">
        <p className="text-sm text-muted-foreground">
          Os acordos são os combinados que sustentam a execução do time: comportamentos que todo mundo segue e
          regras de entrega que não abrem mão. Cada acordo pode ter uma <b>descrição detalhada</b> e{" "}
          <b>até {MAX_FILES} arquivos anexos</b> (PDF, PNG, JPG, WEBP ou GIF) para consulta online ou download.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {KINDS.map(({ key, label, icon: Icon, color, examples }) => {
          const rows = (list.data ?? []).filter((a) => a.kind === key);
          const draft = drafts[key];
          const hasPendingUpload = draft.attachments.some((a) => (a as DraftAttachment).uploading);
          const expandBtn = (
            <button
              type="button"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => toggleExpand(key)}
            >
              {draft.expanded ? (
                <>
                  <ChevronUp className="h-3.5 w-3.5" /> Simplificar
                </>
              ) : (
                <>
                  <ChevronDown className="h-3.5 w-3.5" /> Adicionar descrição / arquivos
                </>
              )}
            </button>
          );
          return (
            <section key={key} className="space-y-4 rounded-2xl border border-border bg-card p-5">
              <div className="flex items-center justify-between gap-2">
                <h2 className="flex items-center gap-2 font-display text-xl">
                  <Icon className="h-5 w-5" style={{ color }} /> {label}
                </h2>
                <span className="text-xs text-muted-foreground">{rows.length} registrado(s)</span>
              </div>

              {list.isLoading && <div className="text-sm text-muted-foreground">Carregando…</div>}
              {!list.isLoading && rows.length === 0 && (
                <div className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                  Nenhum acordo ainda. Sugestões: <span className="font-medium">{examples.join(" · ")}</span>
                </div>
              )}

              <ul className="space-y-2.5">
                {rows.map((a) => (
                  <li
                    key={a.id}
                    className="space-y-2 rounded-xl border border-border/70 p-3.5 text-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="font-medium leading-snug">{a.text}</div>
                        {a.description && (
                          <p className="whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">
                            {a.description}
                          </p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => remove.mutate(a.id)}
                        title="Remover acordo"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    {a.attachments && a.attachments.length > 0 && (
                      <div className="rounded-lg bg-muted/30 p-2">
                        <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                          Anexos · {a.attachments.length}
                        </div>
                        <AttachmentList attachments={a.attachments} compact />
                      </div>
                    )}
                  </li>
                ))}
              </ul>

              <div className="space-y-2 rounded-xl border border-border/60 bg-muted/20 p-3">
                <div className="space-y-2">
                  <Textarea
                    rows={2}
                    value={draft.text}
                    placeholder={`Novo acordo de ${label.toLowerCase()}…`}
                    onChange={(e) => setDrafts((d) => ({ ...d, [key]: { ...d[key], text: e.target.value } }))}
                  />
                  {draft.expanded && (
                    <>
                      <div className="space-y-1.5">
                        <div className="text-xs font-medium text-muted-foreground">
                          Descrição detalhada (opcional)
                        </div>
                        <Textarea
                          rows={3}
                          value={draft.description}
                          placeholder="Contexto, condições, datas, responsáveis envolvidos…"
                          onChange={(e) =>
                            setDrafts((d) => ({ ...d, [key]: { ...d[key], description: e.target.value } }))
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="text-xs font-medium text-muted-foreground">
                            Anexos ({draft.attachments.length}/{MAX_FILES})
                          </div>
                          <span className="text-[11px] text-muted-foreground">PDF ou imagem · até 10MB</span>
                        </div>
                        {draft.attachments.length > 0 && (
                          <AttachmentList
                            attachments={draft.attachments}
                            onRemove={(id) => removeAttachment(key, id)}
                          />
                        )}
                        {draft.attachments.length < MAX_FILES && (
                          <>
                            <input
                              ref={(el) => {
                                fileInputs.current[key] = el;
                              }}
                              type="file"
                              accept={ACCEPTED}
                              multiple
                              className="hidden"
                              onChange={(e) => handleSelectFiles(key, e.target.files)}
                            />
                            <Button
                              type="button"
                              variant="outline"
                              className="w-full gap-2"
                              disabled={uploadOne.isPending || hasPendingUpload}
                              onClick={() => fileInputs.current[key]?.click()}
                            >
                              <UploadCloud className="h-4 w-4" />
                              Adicionar arquivo
                            </Button>
                          </>
                        )}
                      </div>
                    </>
                  )}
                </div>

                {!draft.expanded && <div className="px-1">{expandBtn}</div>}

                <div className="flex items-center justify-between pt-1">
                  {draft.expanded ? expandBtn : <span />}
                  <Button
                    variant="outline"
                    className="gap-2"
                    disabled={
                      draft.text.trim().length < 3 ||
                      add.isPending ||
                      hasPendingUpload
                    }
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
                {hasExtraFields(key) && !draft.expanded && (
                  <div className="rounded-lg border border-dashed border-border/70 bg-background/50 px-2.5 py-1.5 text-[11px] text-muted-foreground">
                    {!!draft.description.trim() && <>Descrição preenchida · </>}
                    {draft.attachments.length > 0 && <>
                      {draft.attachments.length} anexo(s)
                    </>}
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
