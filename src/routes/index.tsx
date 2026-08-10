/**
 * LÍDER CORE — Landing Page & Manifesto
 * "O líder não entra no sistema para preencher formulários. Ele entra para liderar."
 *
 * ESPECIFICAÇÃO MÓDULO C (CONSCIÊNCIA):
 * 1. Escalas 1–5: exibir âncoras semânticas visíveis e tornar pergunta/seleção acessíveis no teclado e mobile.
 * 2. Relatório 1: cruzamento integrado de todos os resultados (Perfil, Sabotadores, HSH, Radar) após conclusão do Módulo C.
 * 3. Relatório 2: cruzamento do Relatório 1 com a Descrição de Cargo (Job Desc) validada para aquele líder.
 * 4. CORE Score: fórmula agregada (Hard/Soft/Heart + Engajamento + Evolução). Exibir score geral e por pilar.
 * 5. PDI & Copiloto: IA sugere ações de desenvolvimento baseada no PDI e nos Relatórios 1 e 2.
 * 6. Ecossistema: Conectar 1:1s, feedbacks e compromissos à Agenda e ao Painel de Atenção.
 * 
 * PADRONIZAÇÃO E QUALIDADE:
 * - Padronizar carregamento, vazio, erro, sucesso e indisponibilidade para todas as telas.
 * - Criar administração de instrumentos: versão, vigência, público, perguntas, pesos, faixas e publicação controlada.
 * - Validar isolamento de dados por empresa, perfis de acesso e visibilidade gestor/liderado.
 * - Instrumentar funil: onboarding concluído, diagnóstico iniciado/concluído, abandono, relatório aberto, PDI criado e retorno semanal.
 * - Revisar desktop, tablet e celular; eliminar títulos cortados, rolagem horizontal e CTAs fora da área visível.
 */
import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Brain, Compass, Sparkles, Target } from "lucide-react";
import { Logo } from "@/components/brand/Logo";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "LÍDER C.O.R.E. — Sistema Operacional para Liderança" },
      {
        name: "description",
        content:
          "O sistema onde o líder entra para liderar. Uma plataforma que continua útil depois do treinamento.",
      },
    ],
  }),
  component: Index,
});

const pillars = [
  {
    key: "C",
    title: "Consciência",
    text: "Organize internamente o líder. Perfil, propósito e clareza sobre onde ele pisa.",
    icon: Brain,
  },
  {
    key: "O",
    title: "Organização",
    text: "Estruture a liderança em rituais, 1:1s, delegações e agenda que respeita a rotina real.",
    icon: Compass,
  },
  {
    key: "R",
    title: "Resultado",
    text: "Execute. KPIs, metas e indicadores do time em um só lugar — sem planilha paralela.",
    icon: Target,
  },
  {
    key: "E",
    title: "Evolução",
    text: "Melhoria contínua com PDI, feedbacks e IA que aprende com cada interação do time.",
    icon: Sparkles,
  },
];

function Index() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Link to="/" className="flex items-center" aria-label="LÍDER C.O.R.E. — home">
          <Logo className="h-8 w-auto max-w-[200px]" />
        </Link>
        <nav className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
          <a href="#metodologia" className="hover:text-foreground">Metodologia</a>
          <a href="#plataforma" className="hover:text-foreground">Plataforma</a>
          <a href="#quem" className="hover:text-foreground">Para quem é</a>
        </nav>
        <Link
          to="/auth"
          search={{}}
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium transition-colors hover:bg-secondary"
        >
          Entrar
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </header>

      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-grid opacity-60 [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" />
        <div className="relative mx-auto max-w-6xl px-6 pb-24 pt-20 md:pt-32">
          <div className="flex items-center gap-3 text-xs uppercase tracking-[0.22em] text-muted-foreground">
            <span className="h-px w-8 bg-foreground/40" />
            Programa de Desenvolvimento de Liderança
          </div>
          <h1 className="mt-8 text-5xl font-extrabold leading-[1.02] tracking-tight md:text-7xl">
            O líder não entra no sistema para preencher formulários.
            <br />
            Ele entra para <span className="italic font-black text-accent">liderar</span>.
          </h1>
          <p className="mt-6 max-w-xl text-lg text-muted-foreground">
            LÍDER C.O.R.E. transforma a metodologia da Neo Pessoas em rotina
            diária de gestão de pessoas — com IA que interpreta comportamento
            e mostra quem precisa da sua atenção agora.
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-3">
            <Link
              to="/auth"
              search={{}}
              className="inline-flex items-center gap-2 rounded-sm bg-accent px-7 py-3.5 text-sm font-semibold uppercase tracking-wider text-accent-foreground transition-transform hover:-translate-y-0.5"
            >
              Acessar a plataforma
              <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="#metodologia"
              className="inline-flex items-center gap-2 rounded-sm border border-border px-7 py-3.5 text-sm font-semibold uppercase tracking-wider hover:bg-secondary"
            >
              Ver a metodologia
            </a>
          </div>
        </div>
      </section>

      {/* PILARES */}
      <section id="metodologia" className="mx-auto max-w-6xl px-6 py-24">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
              O Método
            </div>
            <h2 className="mt-3 text-4xl font-extrabold tracking-tight md:text-5xl">
              O método <span className="italic text-accent">C.O.R.E.</span>
              <br />
              <span className="text-muted-foreground">Quatro pilares fundamentais.</span>
            </h2>
          </div>
          <p className="max-w-sm text-sm text-muted-foreground">
            Cada módulo da plataforma respeita o ciclo C.O.R.E. — do
            autoconhecimento do líder até a evolução contínua do time.
          </p>
        </div>

        <div className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-border bg-border md:grid-cols-2 lg:grid-cols-4">
          {pillars.map(({ key, title, text, icon: Icon }, idx) => (
            <div key={key} className="group relative flex flex-col gap-6 bg-card p-8 transition-colors hover:bg-secondary">
              <div className="flex items-center justify-between">
                <span className="text-6xl font-black text-accent">{idx + 1}</span>
                <Icon className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
              </div>
              <div>
                <h3 className="text-2xl font-bold">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {text}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* PLATAFORMA */}
      <section id="plataforma" className="border-y border-border bg-secondary/40">
        <div className="mx-auto grid max-w-6xl gap-16 px-6 py-24 md:grid-cols-[1.1fr_1fr] md:items-center">
          <div>
            <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
              A plataforma
            </div>
            <h2 className="mt-3 text-4xl font-extrabold tracking-tight md:text-5xl">
              Este é o seu sistema de liderança.
              <br />
              <span className="italic text-accent">Diretamente em suas mãos</span> diariamente.
            </h2>
            <p className="mt-5 max-w-lg text-muted-foreground">
              Rituais de 1:1, delegações, feedbacks e check-ins alimentam um
              modelo comportamental que prioriza a atenção do líder. Ao abrir a
              plataforma, ele vê ações — não gráficos.
            </p>
            <ul className="mt-8 space-y-3 text-sm">
              {[
                "Home do líder: quem precisa da minha atenção hoje",
                "Rituais recorrentes que substituem planilhas de gestão",
                "PDIs e feedbacks alimentados por conversas reais",
                "CORE Score: leitura de saúde da liderança em tempo real",
                "Multiempresa, RBAC e IA com controle de consumo por tenant",
              ].map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* mock card */}
          <div className="relative">
            <div className="rounded-2xl border border-border bg-card p-6 shadow-2xl shadow-black/5">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Hoje · Segunda-feira</span>
                <span className="rounded-full bg-attention/10 px-2 py-0.5 text-[11px] font-medium text-accent">
                  3 ações
                </span>
              </div>
              <h3 className="mt-3 text-xl font-bold">Quem precisa da sua atenção</h3>
              <div className="mt-5 space-y-3">
                {[
                  { name: "Marina Alves", note: "Sem 1:1 há 21 dias", tone: "attention" },
                  { name: "Rafael Souza", note: "Feedback pendente há 5 dias", tone: "attention" },
                  { name: "Time Comercial", note: "Ritual semanal em 2h", tone: "muted" },
                ].map((r) => (
                  <div key={r.name} className="flex items-center justify-between rounded-xl border border-border bg-background/60 p-3">
                    <div>
                      <div className="text-sm font-medium">{r.name}</div>
                      <div className="text-xs text-muted-foreground">{r.note}</div>
                    </div>
                    <span
                      className={
                        r.tone === "attention"
                          ? "h-2 w-2 rounded-full bg-accent"
                          : "h-2 w-2 rounded-full bg-muted-foreground/40"
                      }
                    />
                  </div>
                ))}
              </div>
              <div className="mt-6 flex items-center justify-between border-t border-border pt-4 text-xs text-muted-foreground">
                <span>CORE Score</span>
                <span className="text-lg font-bold text-foreground">78</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section id="quem" className="mx-auto max-w-6xl px-6 py-24">
        <div className="rounded-3xl border border-border bg-primary p-10 text-primary-foreground md:p-16">
          <h2 className="max-w-2xl text-4xl font-extrabold leading-[1.05] tracking-tight md:text-5xl">
            Uma plataforma que continua útil{" "}
            <span className="italic text-accent">depois do treinamento.</span>
          </h2>
          <p className="mt-4 max-w-xl text-primary-foreground/70">
            Tudo começa pela Consciência. Inicie com seus assessments e receba
            seu diagnóstico de liderança. Essa é a porta de entrada da
            metodologia.
          </p>
          <Link
            to="/auth"
            search={{}}
            className="mt-8 inline-flex items-center gap-2 rounded-sm bg-accent px-7 py-3.5 text-sm font-semibold uppercase tracking-wider text-accent-foreground transition-transform hover:-translate-y-0.5"
          >
            Acessar a plataforma
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-6 py-10 text-xs text-muted-foreground md:flex-row md:items-center">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-4">
              <Logo className="h-6 w-auto max-w-[140px] opacity-80" />
              <span>© {new Date().getFullYear()} Neo Pessoas</span>
            </div>
            <p className="max-w-md opacity-60">
              Seus dados são protegidos com a finalidade exclusiva de suporte ao
              seu desenvolvimento de liderança. Ao utilizar a plataforma, você
              consente com o processamento de suas informações conforme nossos{" "}
              <a href="#" className="underline">
                Termos de Uso
              </a>{" "}
              e{" "}
              <a href="#" className="underline">
                Política de Privacidade
              </a>.
            </p>
          </div>
          <div>lidercore.com.br</div>
        </div>
      </footer>
    </div>
  );
}
