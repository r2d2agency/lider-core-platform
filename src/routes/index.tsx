import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    title: "Líder C.O.R.E. | Sistema Operacional do Líder",
    meta: [
      {
        name: "description",
        content: "Metodologia C.O.R.E. para desenvolvimento de liderança de alta performance.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-6 text-center">
      <div className="max-w-2xl space-y-6">
        <h1 className="font-display text-5xl font-bold tracking-tight md:text-6xl">
          Líder <span style={{ color: "var(--pilar-c)" }}>C</span>
          <span style={{ color: "var(--pilar-o)" }}>O</span>
          <span style={{ color: "var(--pilar-r)" }}>R</span>
          <span style={{ color: "var(--pilar-e)" }}>E</span>
        </h1>
        <p className="text-xl text-muted-foreground">
          O seu sistema operacional de liderança. Transforme desenvolvimento em rotina com a jornada 
          Consciência, Organização, Resultado e Evolução.
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <a
            href="/auth"
            className="rounded-full bg-primary px-8 py-3 font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Entrar no App
          </a>
          <a
            href="/auth?signup=true"
            className="rounded-full border border-border bg-card px-8 py-3 font-semibold transition-colors hover:bg-secondary"
          >
            Começar Agora
          </a>
        </div>
      </div>
    </div>
  );
}
