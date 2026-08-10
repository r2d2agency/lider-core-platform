import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { Logo } from "@/components/brand/Logo";
import { ArrowLeftRight, LogOut, type LucideIcon } from "lucide-react";
import { NotificationBell } from "@/components/notifications/NotificationBell";

export type TenantNavItem = { to: string; label: string; icon: LucideIcon };

export function TenantShell({
  scopeLabel,
  scopeName,
  nav,
}: {
  scopeLabel: string;
  scopeName: string;
  nav: TenantNavItem[];
}) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const signOutAll = async () => {
    await qc.cancelQueries();
    qc.clear();
    signOut();
    toast.success("Até logo.");
    navigate({ to: "/auth", search: {}, replace: true } as any);
  };

  const isRoot = (to: string) =>
    (to === "/franchise" && (pathname === "/franchise" || pathname === "/franchise/")) ||
    (to === "/company" && (pathname === "/company" || pathname === "/company/"));

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="flex min-h-screen">
        <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-card md:flex">
          <div className="border-b border-border px-5 py-4">
            <div className="flex items-center gap-3">
              <Logo className="h-6 w-auto max-w-[140px]" />
              <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-accent">
                {scopeLabel}
              </span>
            </div>
            <div className="mt-3 truncate text-sm font-medium">{scopeName}</div>
          </div>
          <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
            {nav.map((item) => {
              const isActive =
                isRoot(item.to) ||
                (item.to !== "/franchise" && item.to !== "/company" && pathname.startsWith(item.to));
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                    isActive
                      ? "bg-secondary text-foreground"
                      : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                  }`}
                >
                  <item.icon className="h-4 w-4" strokeWidth={1.5} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="border-t border-border p-3">
            <div className="mb-2 truncate px-3 text-xs text-muted-foreground">{user?.email}</div>
            <div className="grid gap-1">
              <Link to="/app" className="flex items-center gap-2 rounded-md px-3 py-2 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground">
                <ArrowLeftRight className="h-3.5 w-3.5" /> Ver como líder
              </Link>
              <button onClick={signOutAll} className="flex items-center gap-2 rounded-md px-3 py-2 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground">
                <LogOut className="h-3.5 w-3.5" /> Sair
              </button>
            </div>
          </div>
        </aside>

        <main className="flex-1 overflow-x-hidden">
          <header className="flex items-center justify-between border-b border-border bg-background/80 px-6 py-3 backdrop-blur md:hidden">
            <Logo className="h-6 w-auto max-w-[120px]" />
            <div className="flex items-center gap-2">
              <NotificationBell variant="tenant" />
              <button onClick={signOutAll} className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground">
                <LogOut className="h-3.5 w-3.5" /> Sair
              </button>
            </div>
          </header>
          <div className="mx-auto max-w-6xl px-6 py-8 md:px-10 md:py-10">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

export function TenantPageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <div className="text-xs uppercase tracking-widest text-muted-foreground">{eyebrow}</div>
        <h1 className="mt-1 font-display text-3xl md:text-4xl">{title}</h1>
        {description && <p className="mt-2 max-w-xl text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function KpiCard({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="text-xs uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="mt-2 font-display text-3xl">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}
