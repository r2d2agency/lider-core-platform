import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { History, Layers, Loader2, Save } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type Snapshot = {
  id: string;
  version: number;
  createdAt: string;
  selfDevelopment: string[];
  teamFront: string[];
  ritualsFront: string[];
  goalsFront: string[];
  radarSnapshot: Record<string, number> | null;
};

const FRONTS = [
  { key: "selfDevelopment", label: "Autodesenvolvimento", hint: "Ex: delegação estruturada, escuta ativa" },
  { key: "teamFront", label: "Equipe", hint: "Ex: retomar 1:1 com Carla e Pedro" },
  { key: "ritualsFront", label: "Rituais", hint: "Ex: gestão à vista toda sexta, sem exceção" },
  { key: "goalsFront", label: "Metas", hint: "Ex: recuperar -12% do trimestre" },
] as const;

type FrontKey = (typeof FRONTS)[number]["key"];

export function PdiSnapshotPanel({ orgId, cycleId }: { orgId?: string; cycleId?: string }) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState<Record<FrontKey, string>>({
    selfDevelopment: "",
    teamFront: "",
    ritualsFront: "",
    goalsFront: "",
  });

  const list = useQuery({
    queryKey: ["pdi-snapshots", orgId],
    enabled: !!orgId,
    queryFn: () => api<Snapshot[]>(`/organization/${orgId}/jornada/pdi-snapshots`),
  });

  const toLines = (v: string) => v.split("\n").map((s) => s.trim()).filter(Boolean);

  const me = useQuery({
    queryKey: ["consciencia", "me", orgId],
    enabled: !!orgId,
    queryFn: () => api<any>(`/organization/${orgId}/consciencia/me`),
  });

  const save = useMutation({
    mutationFn: () =>
      api(`/organization/${orgId}/jornada/pdi-snapshots`, {
        method: "POST",
        body: {
          cycleId: cycleId || null,
          selfDevelopment: toLines(draft.selfDevelopment),
          teamFront: toLines(draft.teamFront),
          ritualsFront: toLines(draft.ritualsFront),
          goalsFront: toLines(draft.goalsFront),
          radarSnapshot: {
            hard: me.data?.profile?.hardSelfScore ?? 0,
            soft: me.data?.profile?.softSelfScore ?? 0,
            heart: me.data?.profile?.heartSelfScore ?? 0,
          },
        },
      }),
    onSuccess: () => {
      toast.success("PDI atualizado — nova versão registrada.");
      setDraft({ selfDevelopment: "", teamFront: "", ritualsFront: "", goalsFront: "" });
      qc.invalidateQueries({ queryKey: ["pdi-snapshots", orgId] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Não foi possível salvar."),
  });

  const filled = FRONTS.some((f) => toLines(draft[f.key]).length > 0);
  const last = list.data?.[0];

  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display text-xl">
          <Layers className="h-5 w-5" style={{ color: "var(--pilar-e)" }} />
          PDI atualizado — 4 frentes
        </h2>
        {last && (
          <span className="rounded-full border border-border px-3 py-1 text-[11px] text-muted-foreground">
            versão atual: v{last.version}
          </span>
        )}
      </div>
      <p className="text-sm text-muted-foreground">
        O PDI nasce em Consciência e nunca é recriado: cada fechamento de ciclo grava uma nova versão,
        preservando o histórico para comparar sua evolução.
      </p>

      <div className="grid gap-3 md:grid-cols-2">
        {FRONTS.map((f) => (
          <div key={f.key}>
            <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              {f.label}
            </label>
            <Textarea
              rows={3}
              value={draft[f.key]}
              placeholder={`${f.hint} (uma ação por linha)`}
              onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
            />
          </div>
        ))}
      </div>

      <Button className="gap-2" disabled={!filled || save.isPending} onClick={() => save.mutate()}>
        {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        Registrar nova versão do PDI
      </Button>

      <div className="space-y-2 border-t border-border pt-4">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          <History className="h-3.5 w-3.5" /> Histórico
        </div>
        {list.isLoading && <div className="text-sm text-muted-foreground">Carregando…</div>}
        {!list.isLoading && (list.data ?? []).length === 0 && (
          <div className="text-sm text-muted-foreground">
            Nenhuma versão registrada ainda. A primeira versão nasce ao fechar este ciclo.
          </div>
        )}
        {(list.data ?? []).map((s, idx) => {
          const prev = list.data?.[idx + 1];
          const hasRadar = s.radarSnapshot && typeof s.radarSnapshot === "object";
          return (
            <div key={s.id} className="rounded-xl border border-border/70 p-3 text-sm">
              <div className="mb-2 flex items-center justify-between gap-2 border-b border-border/50 pb-2">
                <div className="flex items-center gap-3">
                  <span className="font-bold">v{s.version}</span>
                  {hasRadar && (
                    <div className="flex gap-2">
                      {["hard", "soft", "heart"].map((k) => {
                        const val = (s.radarSnapshot as any)[k] ?? 0;
                        const old = prev?.radarSnapshot ? (prev.radarSnapshot as any)[k] : null;
                        return (
                          <div key={k} className="flex items-center gap-1 text-[10px] font-medium">
                            <span className="uppercase opacity-60">{k[0]}:</span>
                            <span>{val}</span>
                            {old != null && old !== val && (
                              <span className={val > old ? "text-emerald-500" : "text-rose-500"}>
                                {val > old ? "↑" : "↓"}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">
                  {new Date(s.createdAt).toLocaleDateString("pt-BR")}
                </span>
              </div>
              <div className="grid gap-1 text-muted-foreground md:grid-cols-2">
                {FRONTS.map((f) => (
                  <div key={f.key}>
                    <span className="text-[11px] font-bold uppercase tracking-widest">{f.label}: </span>
                    {(s[f.key] ?? []).join(" · ") || "—"}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
