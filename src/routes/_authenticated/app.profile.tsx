import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { UserCircle2, Brain, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/profile")({
  ssr: false,
  component: ProfilePage,
});

type DNA = {
  scores: Record<string, number> | null;
  strengths: string[];
  improvements: string[];
  updatedAt: string;
};

function ProfilePage() {
  const { user } = useAuth();
  const q = useQuery({
    queryKey: ["me", "dna"],
    queryFn: () => api<{ dna: DNA | null }>("/me/dna"),
  });
  const dna = q.data?.dna;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-2xl bg-accent/10 text-accent">
          <UserCircle2 className="h-5 w-5" />
        </div>
        <div>
          <h1 className="font-display text-3xl font-semibold leading-tight">Perfil</h1>
          <p className="text-sm text-muted-foreground">
            {user?.fullName ?? user?.email} · {user?.jobTitle ?? "sem cargo definido"}
            <br />
            WhatsApp: {user?.whatsapp ? (user.whatsapp.startsWith("55") ? user.whatsapp : `55 ${user.whatsapp}`) : "não informado"}
          </p>
        </div>
      </header>

      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <Brain className="h-4 w-4 text-accent" />
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            CORE DNA
          </h2>
        </div>
        {!dna && (
          <div className="text-sm text-muted-foreground">
            Seu CORE DNA ainda não foi gerado. Complete a Jornada Inicial para desbloquear.
          </div>
        )}
        {dna && (
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <div className="mb-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
                Pontos fortes
              </div>
              <ul className="space-y-1 text-sm">
                {(dna.strengths ?? []).slice(0, 6).map((s) => (
                  <li key={s} className="rounded-lg bg-accent/5 px-3 py-1.5">{s}</li>
                ))}
              </ul>
            </div>
            <div>
              <div className="mb-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
                Áreas de evolução
              </div>
              <ul className="space-y-1 text-sm">
                {(dna.improvements ?? []).slice(0, 6).map((s) => (
                  <li key={s} className="rounded-lg bg-muted px-3 py-1.5">{s}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </section>

      <Link
        to="/app/consciencia"
        className="flex items-center justify-between rounded-2xl border border-border bg-card px-5 py-4 text-sm font-medium shadow-sm hover:bg-secondary/40"
      >
        Abrir diagnóstico completo <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}