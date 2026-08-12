import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Compass, CheckCircle2, Circle, PlayCircle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/journey")({
  ssr: false,
  component: JourneyPage,
});

type Step = {
  id: string;
  title: string;
  description: string | null;
  kind: string;
  orderIndex: number;
};
type Journey = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  steps: Step[];
};

function JourneyPage() {
  const q = useQuery({
    queryKey: ["me", "journey", "initial"],
    queryFn: () => api<{ journey: Journey | null }>("/me/journey/initial"),
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-2xl" style={{ backgroundColor: 'color-mix(in oklab, var(--pilar-c) 12%, transparent)', color: 'var(--pilar-c)' }}>
          <Compass className="h-5 w-5" />
        </div>
        <div>
          <h1 className="font-display text-3xl font-semibold leading-tight">Jornada</h1>
          <p className="text-sm text-muted-foreground">
            A trilha inicial e as próximas etapas da sua metodologia.
          </p>
        </div>
      </header>

      {q.isLoading && <p className="text-sm text-muted-foreground">Carregando jornada…</p>}
      {!q.isLoading && !q.data?.journey && (
        <div className="rounded-2xl border border-dashed border-border bg-secondary/20 p-12 text-center">
          <Compass className="mx-auto h-12 w-12 text-muted-foreground/30" />
          <h3 className="mt-4 text-lg font-medium">Sua jornada está sendo preparada</h3>
          <p className="mt-2 text-sm text-muted-foreground mx-auto max-w-sm">
            Nenhuma jornada inicial publicada pelo administrador ainda. Fale com seu consultor Neo para ativar seu roteiro de desenvolvimento.
          </p>
        </div>
      )}


      {q.data?.journey && (
        <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h2 className="font-display text-xl">{q.data.journey.name}</h2>
          {q.data.journey.description && (
            <p className="mt-2 text-sm text-muted-foreground">{q.data.journey.description}</p>
          )}
          <ol className="mt-6 space-y-3">
            {q.data.journey.steps.map((s, i) => (
              <li
                key={s.id}
                className="flex items-start gap-3 rounded-xl border border-border/70 bg-background/60 p-4"
              >
                <div className="mt-0.5">
                  {i === 0 ? (
                    <PlayCircle className="h-5 w-5 text-accent" />
                  ) : (
                    <Circle className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                      {s.kind}
                    </span>
                    <span className="text-xs text-muted-foreground">Passo {i + 1}</span>
                  </div>
                  <div className="mt-1 font-medium">{s.title}</div>
                  {s.description && (
                    <p className="mt-1 text-sm text-muted-foreground">{s.description}</p>
                  )}
                </div>
                <CheckCircle2 className="mt-0.5 h-5 w-5 opacity-0" />
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}