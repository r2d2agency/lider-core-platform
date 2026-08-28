import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  Home, Brain, Users, Building, MessageSquare, Target, Gauge, BookOpen,
  Compass, Sparkles, ChevronDown, HelpCircle, Download, Smartphone, Search, LayoutGrid,
} from "lucide-react";
import { FadeIn } from "@/components/motion";
import { SectionHeader } from "@/components/ui/metric-card";
import { InstallButton } from "@/components/pwa/InstallButton";

export const Route = createFileRoute("/_authenticated/app/help")({
  component: AppHelpPage,
});

type Item = {
  icon: typeof Home;
  title: string;
  path: string;
  summary: string;
  steps: string[];
  tip?: string;
};

const groups: { section: string; items: Item[] }[] = [
  {
    section: "Consciência — quem eu sou como líder",
    items: [
      {
        icon: Home, title: "Hoje", path: "/app",
        summary: "Sua tela inicial: o que exige atenção agora — rituais do dia, delegações vencendo, sinais recentes.",
        steps: [
          "Comece o dia por aqui antes de abrir qualquer módulo.",
          "Marque rituais como feitos direto dos cards.",
          "Clique em um sinal para ver o contexto completo.",
        ],
      },
      {
        icon: Brain, title: "Meu perfil", path: "/app/consciencia",
        summary: "Suas forças, riscos, estilo de comunicação e sabotagens — base para todas as recomendações da plataforma.",
        steps: [
          "Preencha o assessment inicial (leva ~15 min).",
          "Revise a cada 3 meses ou após feedback relevante.",
          "O IA Coach usa este perfil ao responder.",
        ],
        tip: "Seja honesto: ninguém além de você vê as respostas cruas.",
      },
      {
        icon: Users, title: "Minha equipe", path: "/app/team",
        summary: "Perfil de cada liderado direto: momento, prontidão, próximos passos.",
        steps: [
          "Clique em uma pessoa para abrir o painel individual.",
          "Registre observações rápidas — viram insumo para 1:1s.",
        ],
      },
    ],
  },
  {
    section: "Organização — como o trabalho acontece",
    items: [
      {
        icon: Building, title: "Organização", path: "/app/organization",
        summary: "Mapa da sua área: filiais, times, papéis, agenda, rituais, delegações, decisões, documentos.",
        steps: [
          "Comece pelo Mapa para visualizar a estrutura.",
          "Depois configure Rituais recorrentes (1:1, reunião de time, revisão semanal).",
          "Registre Delegações claras — quem, o quê, quando.",
        ],
        tip: "Uma organização saudável tem no mínimo 1 ritual semanal ativo por área.",
      },
      {
        icon: LayoutGrid, title: "Áreas", path: "/app/organization/areas",
        summary: "Áreas são os grandes núcleos da empresa, acima das equipes. Ex.: Comercial, Marketing, Operações, RH.",
        steps: [
          "Abra Áreas para entender a estrutura atual da empresa.",
          "Use o botão Criar área para cadastrar uma nova frente organizacional.",
          "Defina um nome claro e uma descrição curta para deixar a finalidade daquele núcleo explícita.",
          "Depois distribua equipes e responsabilidades dentro dessa área.",
        ],
        tip: "Pense em Área como um agrupador organizacional de várias equipes com a mesma função de negócio.",
      },
      {
        icon: MessageSquare, title: "1:1s", path: "/app/one-on-ones",
        summary: "Roteiros e histórico das conversas individuais com cada liderado.",
        steps: [
          "Agende recorrência quinzenal ou mensal.",
          "Use o roteiro sugerido — evita reunião só sobre tarefa.",
          "Anote combinados no fim; viram itens de acompanhamento.",
        ],
      },
    ],
  },
  {
    section: "Resultado — o que estamos entregando",
    items: [
      {
        icon: Target, title: "Indicadores", path: "/app/indicators",
        summary: "KPIs que você acompanha (financeiros, operacionais, de pessoas).",
        steps: [
          "Defina meta, unidade, frequência (semanal/mensal).",
          "Atualize os valores no ritual de revisão.",
          "Cores mostram tendência: verde subindo, âmbar estável, vermelho caindo.",
        ],
      },
    ],
  },
  {
    section: "Evolução — como estamos crescendo",
    items: [
      {
        icon: Gauge, title: "Evolução", path: "/app/evolution",
        summary: "Seu score de liderança composto: rituais + delegações + indicadores + consciência.",
        steps: [
          "Score atualiza mensalmente.",
          "Clique nas barras para ver o que puxou o score para cima ou para baixo.",
        ],
      },
      {
        icon: BookOpen, title: "PDIs", path: "/app/pdis",
        summary: "Planos de Desenvolvimento Individual — seus e dos liderados.",
        steps: [
          "Um PDI = 1 objetivo + 3 ações + prazo.",
          "Revise no 1:1 mensal.",
        ],
      },
      {
        icon: Compass, title: "Feedbacks", path: "/app/feedbacks",
        summary: "Enviar e receber feedbacks estruturados (SBI: Situação, Comportamento, Impacto).",
        steps: [
          "Envie feedback logo após o evento — não guarde para o 1:1.",
          "Peça feedback ativamente; o app envia lembretes.",
        ],
      },
      {
        icon: Sparkles, title: "IA Coach", path: "/app/ai",
        summary: "Seu coach executivo apoiado por IA — usa os fatos que você já registrou na plataforma.",
        steps: [
          "Gere o Insight da semana no painel lateral.",
          "Converse no chat: peça análise de rotina, roteiro de 1:1, decisões difíceis.",
          "As respostas usam SEUS dados (rituais, delegações, score) — nunca inventa números.",
        ],
        tip: "Se falar 'não há evidência ainda', significa que falta você registrar aquele fato.",
      },
    ],
  },
];

function AppHelpPage() {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  const filtered = groups
    .map((g) => ({
      ...g,
      items: g.items.filter((i) =>
        (i.title + i.summary + i.steps.join(" ")).toLowerCase().includes(q.toLowerCase()),
      ),
    }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <FadeIn>
        <SectionHeader
          eyebrow="Central de ajuda"
          title="Como usar o Líder C.O.R.E."
          description="Tudo que você precisa saber sobre cada área do app. Comece pelo topo ou busque um assunto."
        />
      </FadeIn>

      {/* Instalação */}
      <FadeIn delay={0.05}>
        <section className="card-elevated relative overflow-hidden p-6">
          <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-accent/25 blur-3xl" />
          <div className="relative flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="eyebrow flex items-center gap-1.5">
                <Smartphone className="h-3 w-3 text-accent" /> Instalar no celular
              </div>
              <h2 className="mt-1 font-display text-xl">Use como um app</h2>
              <p className="mt-2 max-w-xl text-sm text-muted-foreground">
                O Líder C.O.R.E. é web — não precisa loja. Instale como ícone e abra em 1 toque.
              </p>
              <div className="mt-4 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                <div className="rounded-xl border border-border bg-background/60 p-3">
                  <div className="text-[11px] font-semibold uppercase tracking-widest text-foreground">iPhone</div>
                  <p className="mt-1">Safari → Compartilhar → Adicionar à Tela de Início.</p>
                </div>
                <div className="rounded-xl border border-border bg-background/60 p-3">
                  <div className="text-[11px] font-semibold uppercase tracking-widest text-foreground">Android</div>
                  <p className="mt-1">Chrome → menu ⋮ → Instalar app.</p>
                </div>
              </div>
            </div>
            <InstallButton />
          </div>
        </section>
      </FadeIn>

      {/* Busca */}
      <FadeIn delay={0.08}>
        <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 focus-within:border-accent/50">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por assunto (ex.: ritual, 1:1, IA Coach, score)…"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
      </FadeIn>

      {/* Seções */}
      <div className="space-y-10">
        {filtered.map((g) => (
          <FadeIn key={g.section} delay={0.1}>
            <section>
              <h2 className="eyebrow mb-4">{g.section}</h2>
              <div className="space-y-2">
                {g.items.map((item) => {
                  const isOpen = open === item.path;
                  return (
                    <div
                      key={item.path}
                      className="rounded-2xl border border-border bg-card transition-all hover:border-accent/40"
                    >
                      <button
                        onClick={() => setOpen(isOpen ? null : item.path)}
                        className="flex w-full items-start gap-4 p-5 text-left"
                      >
                        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-accent/10 text-accent">
                          <item.icon className="h-4 w-4" strokeWidth={1.75} />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-medium">{item.title}</h3>
                          <p className="mt-1 text-sm text-muted-foreground">{item.summary}</p>
                        </div>
                        <ChevronDown
                          className={
                            "mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform " +
                            (isOpen ? "rotate-180" : "")
                          }
                        />
                      </button>
                      {isOpen && (
                        <div className="border-t border-border px-5 pb-5 pt-4">
                          <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                            Como usar
                          </div>
                          <ul className="mt-2 space-y-1.5 text-sm text-foreground/90">
                            {item.steps.map((s, i) => (
                              <li key={i} className="flex gap-2">
                                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-accent" />
                                <span>{s}</span>
                              </li>
                            ))}
                          </ul>
                          {item.tip && (
                            <div className="mt-3 rounded-lg border border-accent/30 bg-accent/5 p-3 text-xs text-foreground/80">
                              <strong className="text-accent">Dica:</strong> {item.tip}
                            </div>
                          )}
                          <div className="mt-4">
                            <Link
                              to={item.path}
                              className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
                            >
                              Abrir {item.title} →
                            </Link>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          </FadeIn>
        ))}
        {filtered.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            Nada encontrado para "{q}". Tente outra palavra.
          </div>
        )}
      </div>

      <FadeIn delay={0.15}>
        <section className="rounded-2xl border border-border bg-card p-6">
          <div className="flex items-center gap-2">
            <HelpCircle className="h-4 w-4 text-accent" />
            <h2 className="font-display text-lg">Ainda com dúvida?</h2>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Fale com o administrador da sua empresa ou pergunte ao{" "}
            <Link to="/app/ai" search={{ q: undefined }} className="font-medium text-accent hover:underline">
              IA Coach
            </Link>{" "}
            — ele conhece a metodologia e o seu contexto.
          </p>
        </section>
      </FadeIn>
    </div>
  );
}
