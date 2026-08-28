import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useCurrentOrg } from "@/lib/use-current-org";
import { Building2, Network, Users2, ChevronRight } from "lucide-react";
import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

export const Route = createFileRoute("/_authenticated/app/organization/map")({
  component: OrgMap,
});

type Member = { id: string; name: string; email: string; role: string; avatar: string | null };
type Team = { id: string; name: string; objectives: string | null; mission: string | null; peopleCount: number; members: Member[] };
type Area = { id: string; name: string; mission: string | null; objective: string | null; kpis: string[]; peopleCount: number; teams: Team[] };
type Branch = { id: string; name: string; code: string | null; city: string | null; peopleCount: number; areas: Area[] };
type MapData = {
  organization: { id: string; name: string; slug: string; logoUrl: string | null };
  totals: { branches: number; areas: number; teams: number; people: number; leaders: number };
  branches: Branch[];
  areasWithoutBranch: Area[];
};

function OrgMap() {
  const { orgId } = useCurrentOrg();
  const [selected, setSelected] = useState<{ kind: "area" | "team"; data: Area | Team } | null>(null);
  const q = useQuery({
    queryKey: ["org", "map", orgId],
    queryFn: () => api<MapData>(`/organization/${orgId}/map`),
    enabled: !!orgId,
  });

  if (!orgId) return null;
  if (q.isLoading) return <div className="text-sm text-muted-foreground">Carregando…</div>;
  if (!q.data) return null;

  const { totals, branches, areasWithoutBranch } = q.data;

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-border bg-card p-5">
        <div className="flex items-start gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-secondary text-foreground">
            <Network className="h-5 w-5" />
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Organograma
            </div>
            <h1 className="mt-1 font-display text-2xl leading-tight">Mapa vivo da empresa</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Aqui você navega pela estrutura da empresa por filiais, áreas e equipes. Clique nos blocos para ver
              detalhes e, dentro dos times, abra o perfil das pessoas quando quiser aprofundar.
            </p>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Total label="Filiais" value={totals.branches} />
        <Total label="Áreas" value={totals.areas} />
        <Total label="Equipes" value={totals.teams} />
        <Total label="Pessoas" value={totals.people} />
        <Total label="Líderes" value={totals.leaders} />
      </div>

      <div className="space-y-8">
        {branches.map((b) => (
          <BranchBlock key={b.id} branch={b} onSelect={setSelected} />
        ))}
        {areasWithoutBranch.length > 0 && (
          <div>
            <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
              <Building2 className="h-3.5 w-3.5" /> Matriz
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {areasWithoutBranch.map((a) => (
                <AreaBlock key={a.id} area={a} onSelect={setSelected} />
              ))}
            </div>
          </div>
        )}
      </div>

      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{selected?.data.name}</SheetTitle>
          </SheetHeader>
          {selected?.kind === "area" && <AreaPanel area={selected.data as Area} />}
          {selected?.kind === "team" && <TeamPanel team={selected.data as Team} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Total({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="mt-1 font-display text-2xl">{value}</div>
    </div>
  );
}

function BranchBlock({ branch, onSelect }: { branch: Branch; onSelect: (v: { kind: "area" | "team"; data: Area | Team }) => void }) {
  return (
    <div>
      <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
        <Building2 className="h-3.5 w-3.5" /> {branch.name}
        {branch.city && <span className="text-muted-foreground/70">· {branch.city}</span>}
        <span className="ml-2 rounded-full bg-secondary px-2 py-0.5 text-[10px]">{branch.peopleCount} pessoas</span>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {branch.areas.map((a) => <AreaBlock key={a.id} area={a} onSelect={onSelect} />)}
        {branch.areas.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
            Esta filial ainda não tem áreas estruturadas no organograma.
          </div>
        )}
      </div>
    </div>
  );
}

function AreaBlock({ area, onSelect }: { area: Area; onSelect: (v: { kind: "area" | "team"; data: Area | Team }) => void }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 transition hover:border-accent/30 hover:shadow-sm">
      <button
        onClick={() => onSelect({ kind: "area", data: area })}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <div>
          <div className="text-sm font-medium">{area.name}</div>
          <div className="text-xs text-muted-foreground">{area.mission ?? "Sem missão definida"}</div>
          <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] text-muted-foreground">
            <span className="rounded-full bg-secondary px-2 py-0.5">{area.peopleCount} pessoas</span>
            <span className="rounded-full bg-secondary px-2 py-0.5">{area.teams.length} equipes</span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2 text-xs font-medium text-primary">
          Ver área <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </div>
      </button>
      {area.teams.length > 0 && (
        <div className="mt-3 space-y-1.5 border-t border-border pt-3">
          {area.teams.map((t) => (
            <button
              key={t.id}
              onClick={() => onSelect({ kind: "team", data: t })}
              className="flex w-full items-center justify-between rounded-xl px-2 py-2 text-left text-xs hover:bg-secondary"
            >
              <span className="flex items-center gap-2"><Users2 className="h-3 w-3" /> {t.name}</span>
              <span className="flex items-center gap-2 text-muted-foreground">
                {t.peopleCount}
                <ChevronRight className="h-3.5 w-3.5" />
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function AreaPanel({ area }: { area: Area }) {
  return (
    <div className="mt-4 space-y-4 text-sm">
      <div className="rounded-2xl border border-border bg-secondary/30 px-4 py-3 text-sm text-muted-foreground">
        Esta área reúne {area.peopleCount} pessoa(s) distribuídas em {area.teams.length} equipe(s).
      </div>
      <Row label="Missão" value={area.mission ?? "—"} />
      <Row label="Objetivo" value={area.objective ?? "—"} />
      <div>
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">KPIs</div>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {area.kpis.length ? area.kpis.map((k) => <span key={k} className="rounded-full bg-secondary px-2 py-0.5 text-xs">{k}</span>) : <span className="text-muted-foreground">Nenhum</span>}
        </div>
      </div>
      <Row label="Pessoas" value={String(area.peopleCount)} />
      <Row label="Equipes" value={String(area.teams.length)} />
    </div>
  );
}

function TeamPanel({ team }: { team: Team }) {
  return (
    <div className="mt-4 space-y-4 text-sm">
      <div className="rounded-2xl border border-border bg-secondary/30 px-4 py-3 text-sm text-muted-foreground">
        Este time tem {team.members.length} pessoa(s). Clique em alguém abaixo para abrir o detalhe do liderado.
      </div>
      <Row label="Missão" value={team.mission ?? "—"} />
      <Row label="Objetivos" value={team.objectives ?? "—"} />
      <div>
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Membros ({team.members.length})</div>
        <ul className="mt-2 space-y-1">
          {team.members.map((m) => (
            <li key={m.id}>
              <Link
                to="/app/team/$membershipId"
                params={{ membershipId: m.id }}
                className="flex items-center justify-between rounded-xl px-3 py-2 transition hover:bg-secondary"
              >
                <div className="min-w-0">
                  <div className="truncate font-medium text-foreground">{m.name}</div>
                  <div className="truncate text-xs text-muted-foreground">{m.email}</div>
                </div>
                <div className="ml-3 flex shrink-0 items-center gap-2">
                  <span className="text-xs text-muted-foreground">{m.role}</span>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="mt-0.5">{value}</div>
    </div>
  );
}
