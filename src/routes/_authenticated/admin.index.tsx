import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { useAuth } from "@/lib/auth-context";
import {
  Building2, Store, Users, CreditCard, ArrowUpRight, KeyRound, Brain,
  TrendingUp, ClipboardCheck, DollarSign, BookOpen, Library,
  ClipboardList, Route as RouteIcon, FileText, History,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: AdminHome,
});

type KPIs = {
  organizations: number;
  organizationsActive: number;
  organizationsImplantation: number;
  users: number;
  franchises: number;
  leaders: number;
  activeSubscriptions: number;
  activeLicenses: number;
  mrrCents: number;
  aiTokens30d: number;
  aiCostCents30d: number;
};

type NeoOverview = {
  methodology: number; knowledge: number; templates: number;
  assessments: number; journeys: number; audit: number;
};

function fmtBRL(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function AdminHome() {
  const { user } = useAuth();
  const kpis = useQuery({
    queryKey: ["admin", "kpis"],
    queryFn: () => api<KPIs>("/platform/kpis").catch(() => null),
  });
  const neo = useQuery({
    queryKey: ["admin", "neo-overview"],
    queryFn: () => api<NeoOverview>("/admin/neo/overview").catch(() => null),
  });
  const d = kpis.data;
  const n = neo.data;

  return (
    <>
      <AdminPageHeader
        eyebrow={new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}
        title={`Olá, ${user?.fullName?.split(" ")[0] ?? "admin"}.`}
        description="Briefing da inteligência Neo — metodologia, base de conhecimento, receita e uso de IA em uma leitura só."
      />

      <section className="mb-12">
        <div className="mb-4 neo-eyebrow">Inteligência Neo</div>
        <div className="grid gap-px overflow-hidden rounded-2xl border neo-hairline bg-[color:var(--neo-line)] md:grid-cols-3">
          <NeoTile to="/admin/neo/methodology" icon={BookOpen} label="Metodologia" value={n?.methodology} hint="competências, valores, rituais" />
          <NeoTile to="/admin/neo/knowledge" icon={Library} label="Conhecimento" value={n?.knowledge} hint="playbooks e recomendações" />
          <NeoTile to="/admin/neo/assessments" icon={ClipboardList} label="Assessments" value={n?.assessments} hint="biblioteca versionada" />
          <NeoTile to="/admin/neo/journeys" icon={RouteIcon} label="Jornadas" value={n?.journeys} hint="trilhas encadeadas" />
          <NeoTile to="/admin/neo/templates" icon={FileText} label="Templates" value={n?.templates} hint="feedback, PDI, 1:1" />
          <NeoTile to="/admin/neo/audit" icon={History} label="Auditoria" value={n?.audit} hint="mudanças registradas" />
        </div>
      </section>

      <section>
        <div className="mb-4 neo-eyebrow">Plataforma</div>
        <div className="grid gap-4 md:grid-cols-4">
          <Kpi icon={DollarSign} label="MRR" value={d ? fmtBRL(d.mrrCents) : "—"} accent />
          <Kpi icon={Store} label="Franquias" value={d?.franchises ?? "—"} />
          <Kpi icon={Building2} label="Empresas ativas" value={d ? `${d.organizationsActive} / ${d.organizations}` : "—"} />
          <Kpi icon={ClipboardCheck} label="Em implantação" value={d?.organizationsImplantation ?? "—"} />
          <Kpi icon={Users} label="Usuários" value={d?.users ?? "—"} />
          <Kpi icon={TrendingUp} label="Líderes" value={d?.leaders ?? "—"} />
          <Kpi icon={KeyRound} label="Licenças ativas" value={d?.activeLicenses ?? "—"} />
          <Kpi icon={CreditCard} label="Assinaturas" value={d?.activeSubscriptions ?? "—"} />
        </div>
      </section>

      <section className="mt-12 grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border neo-hairline bg-white p-6">
          <div className="flex items-center justify-between neo-eyebrow">
            Consumo IA · 30 dias
            <Brain className="h-4 w-4" strokeWidth={1.4} />
          </div>
          <div className="mt-5 flex items-baseline gap-8">
            <div>
              <div className="text-4xl">{d ? d.aiTokens30d.toLocaleString("pt-BR") : "—"}</div>
              <div className="mt-1 text-xs text-[color:var(--neo-muted)]">tokens</div>
            </div>
            <div>
              <div className="text-4xl">{d ? fmtBRL(d.aiCostCents30d) : "—"}</div>
              <div className="mt-1 text-xs text-[color:var(--neo-muted)]">custo estimado</div>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border neo-hairline bg-white p-6">
          <div className="neo-eyebrow">Atalhos</div>
          <div className="mt-4 grid gap-1">
            <Action to="/admin/neo/methodology" label="Editar metodologia Neo" />
            <Action to="/admin/neo/knowledge" label="Publicar novo playbook" />
            <Action to="/admin/organizations" label="Cadastrar empresa" />
            <Action to="/admin/neo/audit" label="Ver trilha de auditoria" />
          </div>
        </div>
      </section>
    </>
  );
}

function Kpi({ icon: Icon, label, value, accent }: { icon: typeof Building2; label: string; value: string | number; accent?: boolean }) {
  return (
    <div className={`rounded-2xl border p-5 ${accent ? "border-[color:var(--neo-accent)]/40 bg-[color:var(--neo-accent)]/5" : "neo-hairline bg-white"}`}>
      <div className="flex items-center justify-between neo-eyebrow">
        {label}
        <Icon className="h-3.5 w-3.5" strokeWidth={1.4} />
      </div>
      <div className="mt-4 text-3xl">{value}</div>
    </div>
  );
}

function NeoTile({ to, icon: Icon, label, value, hint }: {
  to: string; icon: typeof Building2; label: string; value: number | undefined; hint: string;
}) {
  return (
    <Link
      to={to}
      className="group flex flex-col justify-between gap-6 bg-white p-6 transition-colors hover:bg-[color:var(--neo-cream)]"
    >
      <div className="flex items-start justify-between">
        <Icon className="h-5 w-5 text-[color:var(--neo-accent)]" strokeWidth={1.4} />
        <ArrowUpRight className="h-4 w-4 text-[color:var(--neo-muted)] transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" strokeWidth={1.4} />
      </div>
      <div>
        <div className="text-4xl leading-none">{value ?? "—"}</div>
        <div className="mt-3 font-editorial text-xl">{label}</div>
        <div className="mt-1 text-xs text-[color:var(--neo-muted)]">{hint}</div>
      </div>
    </Link>
  );
}

function Action({ to, label }: { to: string; label: string }) {
  return (
    <Link to={to} className="group flex items-center justify-between rounded-lg px-3 py-2.5 text-sm hover:bg-[color:var(--neo-cream)]">
      <span>{label}</span>
      <ArrowUpRight className="h-4 w-4 text-[color:var(--neo-muted)] transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" strokeWidth={1.4} />
    </Link>
  );
}