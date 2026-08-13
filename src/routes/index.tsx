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
        <section className="container px-4 py-24 md:px-6 md:py-32 lg:py-40">
          <div className="flex flex-col items-center gap-8 text-center">
            <div className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
              <Zap className="mr-2 h-4 w-4" />
              Metodologia de Alto Impacto
            </div>
            <h1 className="max-w-4xl font-display text-5xl font-extrabold tracking-tight sm:text-6xl md:text-7xl">
              O líder não entra no sistema para preencher formulários.{" "}
              <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent italic">
                Ele entra para liderar.
              </span>
            </h1>
            <p className="max-w-[700px] text-lg text-muted-foreground md:text-xl">
              Este é o seu sistema de liderança, agora você pode ter a liderança diretamente em suas mãos diariamente.
              Uma plataforma que continua útil depois do treinamento.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link to="/auth" search={{ mode: "signup" }}>
                <Button size="lg" className="h-12 px-8 text-base">
                  Começar Jornada <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link to="/auth">
                <Button variant="outline" size="lg" className="h-12 px-8 text-base">
                  Acessar Plataforma
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Pillars Section */}
        <section className="border-t bg-muted/30 py-24">
          <div className="container px-4 md:px-6">
            <div className="mb-16 text-center">
              <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Os 4 Pilares da Metodologia C.O.R.E.</h2>
              <p className="mt-4 text-muted-foreground">Tudo começa pela Consciência. Inicie com seus assessments e receba seu diagnóstico de liderança. Essa é a porta de entrada da metodologia.</p>
            </div>
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { 
                  num: "1", 
                  title: "Consciência", 
                  desc: "Faça seus assessments e receba seu diagnóstico. Identifique sabotadores e seu perfil DISC.", 
                  icon: Brain,
                  color: "var(--pilar-c)"
                },
                { 
                  num: "2", 
                  title: "Organização", 
                  desc: "Gestão de equipe, delegação e rituais claros. Onde a operação se torna estratégica.", 
                  icon: LayoutDashboard,
                  color: "var(--pilar-o)"
                },
                { 
                  num: "3", 
                  title: "Resultados", 
                  desc: "OKR, metas e indicadores. Transforme intenção em entrega real com dados precisos.", 
                  icon: Target,
                  color: "var(--pilar-r)"
                },
                { 
                  num: "4", 
                  title: "Evolução", 
                  desc: "PDI, 9-box e feedback contínuo. Sua jornada de crescimento não tem fim.", 
                  icon: TrendingUp,
                  color: "var(--pilar-e)"
                }
              ].map((pilar) => (
                <div key={pilar.num} className="group relative rounded-2xl border bg-card p-8 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md">
                  <div 
                    className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg text-white font-bold text-xl"
                    style={{ backgroundColor: pilar.color }}
                  >
                    {pilar.num}
                  </div>
                  <h3 className="mb-2 font-display text-xl font-bold">{pilar.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {pilar.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features Preview */}
        <section className="py-24">
          <div className="container px-4 md:px-6">
            <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
              <div>
                <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl mb-6">
                  Inteligência que apoia a sua tomada de decisão
                </h2>
                <div className="space-y-6">
                  <div className="flex gap-4">
                    <div className="h-10 w-10 shrink-0 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                      <Users className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="font-bold">Gestão de Pessoas Simplificada</h4>
                      <p className="text-sm text-muted-foreground">Ficha completa do liderado, histórico de 1:1s e evolução de competências em um só lugar.</p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="h-10 w-10 shrink-0 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                      <ShieldCheck className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="font-bold">Privacidade e Transparência</h4>
                      <p className="text-sm text-muted-foreground">Dados protegidos com finalidade clara, consentimento e links diretos para termos de uso.</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="relative rounded-2xl border bg-muted/50 p-6 overflow-hidden shadow-2xl">
                <div className="space-y-4">
                  <div className="rounded-xl border bg-card p-4 shadow-sm border-emerald-200 bg-emerald-50/30">
                    <h4 className="font-bold text-sm mb-2">E1 ao E4 — Performance e Agenda</h4>
                    <p className="text-xs text-muted-foreground">
                      Resultado × Meta, Snapshot 9-Box, Adesão de Agenda automática e Recalibração estratégica integrados.
                    </p>
                  </div>
                  
                  <div className="rounded-xl border bg-card p-4 shadow-sm border-emerald-200 bg-emerald-50/30">
                    <h4 className="font-bold text-sm mb-2">E5 ao E10 — Evolução e Causa Raiz</h4>
                    <p className="text-xs text-muted-foreground">
                      Planos de 90 dias, OKRs, IA Coach Estruturado, Radar HSH Integrado e Retrô com Análise de Causa Raiz.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t py-12">
        <div className="container px-4 md:px-6">
          <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
            <div className="font-display font-bold text-xl">Líder C.O.R.E.</div>
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} Líder C.O.R.E. Todos os direitos reservados.
            </p>
            <div className="flex gap-6 text-sm text-muted-foreground">
              <a href="#" className="hover:text-foreground">Privacidade</a>
              <a href="#" className="hover:text-foreground">Termos</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
