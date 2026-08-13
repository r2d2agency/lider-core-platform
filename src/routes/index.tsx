import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { 
  ArrowRight, 
  Brain, 
  LayoutDashboard, 
  Target, 
  TrendingUp,
  ShieldCheck,
  Zap,
  Users
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    title: "Líder C.O.R.E. | Seu Sistema Operacional de Liderança",
    meta: [
      {
        name: "description",
        content: "O líder não entra no sistema para preencher formulários. Ele entra para liderar. Transforme sua liderança com a metodologia C.O.R.E.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-2 font-display text-xl font-bold">
            <span style={{ color: "var(--pilar-c)" }}>C</span>
            <span style={{ color: "var(--pilar-o)" }}>O</span>
            <span style={{ color: "var(--pilar-r)" }}>R</span>
            <span style={{ color: "var(--pilar-e)" }}>E</span>
            <span className="ml-1">Líder</span>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/auth">
              <Button variant="ghost" size="sm">Entrar</Button>
            </Link>
            <Link to="/auth" search={{ mode: "signup" }}>
              <Button size="sm">Começar Agora</Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative overflow-hidden py-24 md:py-32">
          <div className="absolute inset-0 bg-grid opacity-5" />
          <div className="container relative z-10 mx-auto px-4 text-center md:px-6">
            <div className="mx-auto max-w-3xl space-y-6">
              <h1 className="font-display text-4xl font-bold tracking-tight sm:text-6xl">
                O Sistema Operacional do <span className="text-primary">Líder do Futuro</span>
              </h1>
              <p className="mx-auto max-w-2xl text-lg text-muted-foreground md:text-xl">
                Não gaste tempo preenchendo formulários. Use a tecnologia para potencializar sua influência, acelerar rituais e desenvolver pessoas com precisão cirúrgica.
              </p>
              <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
                <Link to="/auth" search={{ mode: "signup" }}>
                  <Button size="lg" className="h-14 gap-2 px-8 text-lg">
                    Iniciar Minha Jornada <ArrowRight className="h-5 w-5" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Pillars Section */}
        <section className="border-y bg-muted/30 py-24">
          <div className="container mx-auto px-4 md:px-6">
            <div className="grid gap-12 lg:grid-cols-4">
              <div className="space-y-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0EA5E9]/10 text-[#0EA5E9]">
                  <Brain className="h-6 w-6" />
                </div>
                <h3 className="font-display text-xl font-bold">Consciência</h3>
                <p className="text-sm text-muted-foreground">
                  Autoconhecimento profundo. Entenda seu estilo de liderança, sabotadores e pontos cegos.
                </p>
              </div>
              <div className="space-y-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#10B981]/10 text-[#10B981]">
                  <LayoutDashboard className="h-6 w-6" />
                </div>
                <h3 className="font-display text-xl font-bold">Organização</h3>
                <p className="text-sm text-muted-foreground">
                  Gestão impecável de rituais, acordos de time e delegação. Sua agenda a serviço dos resultados.
                </p>
              </div>
              <div className="space-y-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#EF4444]/10 text-[#EF4444]">
                  <Target className="h-6 w-6" />
                </div>
                <h3 className="font-display text-xl font-bold">Resultado</h3>
                <p className="text-sm text-muted-foreground">
                  Métricas que importam. Acompanhamento em tempo real de OKRs e performance da equipe.
                </p>
              </div>
              <div className="space-y-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F59E0B]/10 text-[#F59E0B]">
                  <TrendingUp className="h-6 w-6" />
                </div>
                <h3 className="font-display text-xl font-bold">Evolução</h3>
                <p className="text-sm text-muted-foreground">
                  Crescimento contínuo. PDIs dinâmicos e desenvolvimento acelerado de liderados.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Spec Section (Temporary Info for Dev/Review) */}
        <section className="container mx-auto py-12 px-4 md:px-6">
          <div className="rounded-3xl border border-dashed border-border p-8 bg-card/50">
            <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-6">Especificações Técnicas (Modo Review)</h2>
            <div className="grid gap-8 text-sm">
              <div className="space-y-2">
                <h3 className="font-bold text-primary">E7 — Recomendação da IA Coach</h3>
                <p className="text-muted-foreground">No fechamento de ciclo E, exibimos a recomendação da IA Coach e capturamos a resposta do líder (Concordo/Ajustar/Discordo).</p>
              </div>
              <div className="space-y-2">
                <h3 className="font-bold text-primary">E8 — Radar HSH Integrado</h3>
                <p className="text-muted-foreground">O reteste do Radar Hard·Soft·Heart agora é parte do fluxo de fechamento, registrando o novo score associado ao ciclo.</p>
              </div>
              <div className="space-y-2">
                <h3 className="font-bold text-primary">E9 — PDI em 4 Frentes</h3>
                <p className="text-muted-foreground">Reorganização do formulário de PDI nas 4 frentes: Autodesenvolvimento, Equipe, Rituais e Metas.</p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t py-12">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground md:px-6">
          <p>© 2026 Líder C.O.R.E. · Metodologia Neo Pessoas</p>
        </div>
      </footer>
    </div>
  );
}
