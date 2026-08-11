import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Grid3X3, ArrowRightLeft, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { useCurrentOrg } from "@/lib/use-current-org";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/app/ninebox")({
  ssr: false,
  component: NineBoxPage,
  head: () => ({
    meta: [
      { title: "9-Box do time · Líder C.O.R.E." },
      {
        name: "description",
        content:
          "Matriz 9-box por ciclo: potencial nasce em Organização, desempenho entra em Resultado e é consolidado em Evolução.",
      },
      { property: "og:title", content: "9-Box do time · Líder C.O.R.E." },
      {
        property: "og:description",
        content: "Potencial e desempenho de cada liderado, com histórico por ciclo.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Level = "baixo" | "medio" | "alto";
type Stage = "organizacao" | "resultado" | "evolucao";

type Entry = {
  id: string;
  cycleId: string;
  membershipId: string;
  stage: Stage;
  potential: Level | null;
  performance: Level | null;
};

type Cycle = { id: string; name: string; status: string; startAt: string; endAt: string };
type Member = { membershipId: string; userId: string; fullName: string };

const LEVELS: Level[] = ["baixo", "medio", "alto"];
const LEVEL_LABEL: Record<Level, string> = { baixo: "Baixo", medio: "Médio", alto: "Alto" };
const STAGES: Array<{ key: Stage; label: string; hint: string }> = [
  { key: "organizacao", label: "O · baseline", hint: "Só potencial — antes de existir desempenho real." },
  { key: "resultado", label: "R · desempenho real", hint: "Potencial herdado de O + desempenho medido." },
  { key: "evolucao", label: "E · consolidação", hint: "Leitura final do ciclo e quem está em risco." },
];

function NineBoxPage() {
  const { orgId } = useCurrentOrg();
  const qc = useQueryClient();
  const [stage, setStage] = useState<Stage>("organizacao");
  const [cycleId, setCycleId] = useState<string>("");

  const cycles = useQuery({
    queryKey: ["cycles", orgId],
    enabled: !!orgId,
    queryFn: () => api<Cycle[]>(`/organization/${orgId}/cycles`),
  });
  const activeCycleId =
    cycleId || cycles.data?.find((c) => c.status === "active")?.id || cycles.data?.[0]?.id || "";

  const team = useQuery({
    queryKey: ["team", orgId],
    enabled: !!orgId,
    queryFn: () => api<Member[]>(`/organization/${orgId}/team`),
  });

  const entries = useQuery({
    queryKey: ["ninebox", orgId, activeCycleId],
    enabled: !!orgId && !!activeCycleId,
    queryFn: () =>
      api<Entry[]>(`/organization/${orgId}/jornada/ninebox?cycleId=${activeCycleId}`),
  });

  const byMember = useMemo(() => {
    const map = new Map<string, Entry>();
    for (const e of entries.data ?? []) if (e.stage === stage) map.set(e.membershipId, e);
    return map;
  }, [entries.data, stage]);

  const save = useMutation({
    mutationFn: (body: {
      membershipId: string;
      subjectUserId?: string;
      subjectLabel?: string;
      potential?: Level | null;
      performance?: Level | null;
    }) =>
      api(`/organization/${orgId}/jornada/ninebox`, {
        method: "PUT",
        body: { cycleId: activeCycleId, stage, ...body },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ninebox", orgId, activeCycleId] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao salvar"),
  });

  const promote = useMutation({
    mutationFn: (to: Stage) =>
      api(`/organization/${orgId}/jornada/ninebox/promote`, {
        method: "POST",
        body: { cycleId: activeCycleId, from: stage, to },
      }),
    onSuccess: (_d, to) => {
      toast.success("Potencial herdado no próximo estágio.");
      qc.invalidateQueries({ queryKey: ["ninebox", orgId, activeCycleId] });
      setStage(to);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao herdar"),
  });

  const grid = useMemo(() => {
    const cells = new Map<string, Member[]>();
    for (const m of team.data ?? []) {
      const e = byMember.get(m.membershipId);
      if (!e?.potential || !e?.performance) continue;
      const key = `${e.potential}|${e.performance}`;
      cells.set(key, [...(cells.get(key) ?? []), m]);
    }
    return cells;
  }, [team.data, byMember]);

  if (!orgId) return null;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className="grid h-11 w-11 place-items-center rounded-2xl"
            style={{
              backgroundColor: "color-mix(in oklab, var(--pilar-o) 12%, transparent)",
              color: "var(--pilar-o)",
            }}
          >
            <Grid3X3 className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-display text-3xl font-semibold leading-tight">9-Box do time</h1>
            <p className="text-sm text-muted-foreground">
              Um dado que atravessa O → R → E, com histórico por ciclo.
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
          Crie um ciclo em Organização · Ciclos para começar o 9-box.
        </div>
      )}

      {activeCycleId && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            {STAGES.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => setStage(s.key)}
                className={
                  "rounded-full border px-4 py-2 text-[13px] transition-colors " +
                  (stage === s.key
                    ? "border-primary bg-primary/10 font-medium"
                    : "border-border hover:bg-secondary/60")
                }
              >
                {s.label}
              </button>
            ))}
            {stage !== "evolucao" && (
              <Button
                variant="outline"
                className="ml-auto gap-2"
                disabled={promote.isPending}
                onClick={() => promote.mutate(stage === "organizacao" ? "resultado" : "evolucao")}
              >
                {promote.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowRightLeft className="h-4 w-4" />
                )}
                Herdar para {stage === "organizacao" ? "Resultado" : "Evolução"}
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {STAGES.find((s) => s.key === stage)?.hint}
          </p>

          <section className="overflow-x-auto rounded-2xl border border-border bg-card">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-3">Liderado</th>
                  <th className="px-4 py-3">Potencial</th>
                  <th className="px-4 py-3">Desempenho</th>
                </tr>
              </thead>
              <tbody>
                {(team.data ?? []).map((m) => {
                  const e = byMember.get(m.membershipId);
                  return (
                    <tr key={m.membershipId} className="border-b border-border/60 last:border-0">
                      <td className="px-4 py-3 font-medium">{m.fullName}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1.5">
                          {LEVELS.map((l) => (
                            <button
                              key={l}
                              type="button"
                              onClick={() =>
                                save.mutate({
                                  membershipId: m.membershipId,
                                  subjectUserId: m.userId,
                                  subjectLabel: m.fullName,
                                  potential: e?.potential === l ? null : l,
                                })
                              }
                              className={
                                "rounded-lg border px-2.5 py-1 text-xs transition-colors " +
                                (e?.potential === l
                                  ? "border-primary bg-primary/10 font-medium"
                                  : "border-border hover:bg-secondary/60")
                              }
                            >
                              {LEVEL_LABEL[l]}
                            </button>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {stage === "organizacao" ? (
                          <span className="text-xs text-muted-foreground">
                            Em aberto até existir execução real (R)
                          </span>
                        ) : (
                          <div className="flex gap-1.5">
                            {LEVELS.map((l) => (
                              <button
                                key={l}
                                type="button"
                                onClick={() =>
                                  save.mutate({
                                    membershipId: m.membershipId,
                                    subjectUserId: m.userId,
                                    subjectLabel: m.fullName,
                                    performance: e?.performance === l ? null : l,
                                  })
                                }
                                className={
                                  "rounded-lg border px-2.5 py-1 text-xs transition-colors " +
                                  (e?.performance === l
                                    ? "border-primary bg-primary/10 font-medium"
                                    : "border-border hover:bg-secondary/60")
                                }
                              >
                                {LEVEL_LABEL[l]}
                              </button>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {(team.data ?? []).length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-6 text-sm text-muted-foreground">
                      Cadastre pessoas em Minha equipe para montar o 9-box.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-xl">Matriz</h2>
            <div className="grid gap-2 md:grid-cols-3">
              {[...LEVELS].reverse().map((pot) =>
                LEVELS.map((perf) => {
                  const people = grid.get(`${pot}|${perf}`) ?? [];
                  const risk = pot === "alto" && perf === "baixo";
                  return (
                    <div
                      key={`${pot}-${perf}`}
                      className="min-h-[104px] rounded-xl border border-border bg-card p-3"
                      style={
                        risk
                          ? {
                              borderColor: "var(--pilar-r)",
                              backgroundColor: "color-mix(in oklab, var(--pilar-r) 8%, transparent)",
                            }
                          : undefined
                      }
                    >
                      <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                        Pot. {LEVEL_LABEL[pot]} · Des. {LEVEL_LABEL[perf]}
                      </div>
                      <div className="mt-2 space-y-1">
                        {people.map((p) => (
                          <div key={p.membershipId} className="text-[13px] font-medium">
                            {p.fullName}
                          </div>
                        ))}
                        {people.length === 0 && (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </div>
                      {risk && people.length > 0 && (
                        <div className="mt-2 text-[11px]" style={{ color: "var(--pilar-r)" }}>
                          Gatilho de atenção em E
                        </div>
                      )}
                    </div>
                  );
                }),
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}