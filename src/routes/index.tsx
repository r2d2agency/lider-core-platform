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
      <div className="max-w-4xl space-y-8">
        <h1 className="font-display text-5xl font-bold tracking-tight md:text-6xl">
          Líder <span style={{ color: "var(--pilar-c)" }}>C</span>
          <span style={{ color: "var(--pilar-o)" }}>O</span>
          <span style={{ color: "var(--pilar-r)" }}>R</span>
          <span style={{ color: "var(--pilar-e)" }}>E</span>
        </h1>
        
        <p className="mx-auto max-w-2xl text-xl text-muted-foreground">
          O seu sistema operacional de liderança. Transforme desenvolvimento em rotina com a jornada 
          Consciência, Organização, Resultado e Evolução.
        </p>

        <div className="grid gap-6 text-left md:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <h3 className="mb-2 font-display text-lg font-bold">Item 9 — Recomendação da IA Coach</h3>
            <p className="text-sm text-muted-foreground">
              Recomendação estruturada da IA (trilha sugerida) com resposta explícita do líder: 
              concorda, ajusta ou discorda — vinculada ao ciclo de Evolução.
            </p>
          </div>
          
          <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <h3 className="mb-2 font-display text-lg font-bold">Item 10 — 9-box com Histórico</h3>
            <p className="text-sm text-muted-foreground">
              Entidade própria com histórico por ciclo para comparar posição atual com posições anteriores 
              (potencial × desempenho), integrado à visão de equipe.
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <h3 className="mb-2 font-display text-lg font-bold">Item 11 — Dados de Organização</h3>
            <p className="text-sm text-muted-foreground">
              Telas de Áreas, Cargos e Ciclos funcionais. Recomenda-se popular com dados reais para validar 
              fluxos de ponta a ponta (ex: metas alimentando Resultados).
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <h3 className="mb-2 font-display text-lg font-bold">Observação de Módulos</h3>
            <p className="text-sm text-muted-foreground">
              Delegações, 1:1s e Pulsos integrados. Estrutura validada conforme seções 3.2 e 4.2 da 
              especificação, garantindo cobertura total dos campos pedidos.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap justify-center gap-4 pt-4">
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
