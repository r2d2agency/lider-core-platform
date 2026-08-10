import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import {
  ArrowUp,
  BotMessageSquare,
  CalendarClock,
  Loader2,
  MessageCircleQuestion,
  Mic,
  Plus,
  RefreshCw,
  Sparkles,
  TrendingUp,
  Users,
  AlertTriangle,
  ArrowUpRight,
  CalendarCheck2,
} from "lucide-react";
import { toast } from "sonner";
import { api, getToken } from "@/lib/api";
import { useCurrentOrg } from "@/lib/use-current-org";
import { useAuth } from "@/lib/auth-context";
import { FadeIn } from "@/components/motion";
import { Button } from "@/components/ui/button";

const API_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ?? "";

const QUICK_ACTIONS: { label: string; prompt: string; icon: typeof TrendingUp }[] = [
  { label: "Resumo do dia", prompt: "Me dê um resumo executivo do meu dia — o que priorizar agora.", icon: TrendingUp },
  { label: "Responder dúvida", prompt: "Tenho uma dúvida sobre liderança e quero pensar em voz alta com você.", icon: MessageCircleQuestion },
  { label: "Preparar reunião", prompt: "Me ajude a preparar o roteiro da minha próxima reunião com a equipe.", icon: CalendarClock },
  { label: "Analisar equipe", prompt: "Analise a saúde da minha equipe e diga onde devo agir primeiro.", icon: Users },
];

const REPLY_CHIPS = [
  "Ver detalhes",
  "Quem mais evoluiu?",
  "O que melhorar?",
];

type ChatMsg = { role: "user" | "assistant"; content: string };

export const Route = createFileRoute("/_authenticated/app/ai")({
  component: AICoachPage,
});

function AICoachPage() {
  const { orgId } = useCurrentOrg();
  const { user } = useAuth();
  const firstName = (user?.fullName ?? "").trim().split(/\s+/)[0] || "líder";
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [insight, setInsight] = useState<string | null>(null);
  const [insightUpdatedAt, setInsightUpdatedAt] = useState<Date | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);

  const insightMut = useMutation({
    mutationFn: () => api<{ insight: string }>(`/organization/${orgId}/ai/coach/insight`, { method: "POST" }),
    onSuccess: (d) => {
      setInsight(d.insight);
      setInsightUpdatedAt(new Date());
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao gerar insight"),
  });

  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, streaming]);

  async function send(text?: string) {
    const content = (text ?? input).trim();
    if (!content || streaming || !orgId) return;
    setInput("");
    const next: ChatMsg[] = [...messages, { role: "user", content }, { role: "assistant", content: "" }];
    setMessages(next);
    setStreaming(true);

    const ac = new AbortController();
    abortRef.current = ac;
    try {
      const token = getToken();
      const res = await fetch(`${API_URL}/organization/${orgId}/ai/coach/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          messages: next
            .filter((m, i) => !(i === next.length - 1 && m.role === "assistant" && !m.content))
            .map(({ role, content }) => ({ role, content })),
        }),
        signal: ac.signal,
      });
      if (!res.ok || !res.body) {
        throw new Error(`Falha (${res.status})`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let acc = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";
        for (const part of parts) {
          const lines = part.split("\n");
          const eventLine = lines.find((l) => l.startsWith("event:"));
          const dataLine = lines.find((l) => l.startsWith("data:"));
          if (!eventLine || !dataLine) continue;
          const event = eventLine.slice(6).trim();
          const data = JSON.parse(dataLine.slice(5).trim());
          if (event === "delta") {
            acc += (data as { text: string }).text;
            setMessages((prev) => {
              const copy = prev.slice();
              copy[copy.length - 1] = { role: "assistant", content: acc };
              return copy;
            });
          } else if (event === "error") {
            throw new Error((data as { message: string }).message);
          }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Falha no streaming";
      toast.error(msg);
      setMessages((prev) => {
        const copy = prev.slice();
        if (copy[copy.length - 1]?.role === "assistant" && !copy[copy.length - 1].content) {
          copy[copy.length - 1] = { role: "assistant", content: `_${msg}_` };
        }
        return copy;
      });
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-6">
      {/* Header saudação */}
      <FadeIn>
        <header className="space-y-2">
          <div className="eyebrow inline-flex items-center gap-1.5 text-accent">
            <Sparkles className="h-3 w-3" /> IA Coach
          </div>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Oi, {firstName}! <span className="inline-block">👋</span>
          </h1>
          <p className="text-sm text-muted-foreground">Como posso te ajudar hoje?</p>
        </header>
      </FadeIn>

      {/* Ações rápidas */}
      <FadeIn delay={0.05}>
        <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {QUICK_ACTIONS.map(({ label, prompt, icon: Icon }) => (
            <button
              key={label}
              onClick={() => send(prompt)}
              disabled={streaming}
              className="group flex min-w-[128px] shrink-0 flex-col items-start gap-2 rounded-2xl border border-border bg-card px-3 py-3 text-left transition-all hover:border-accent/40 hover:shadow-[var(--shadow-accent)] disabled:opacity-60"
            >
              <span className="grid h-8 w-8 place-items-center rounded-xl bg-accent/12 text-accent transition-colors group-hover:bg-accent/20">
                <Icon className="h-4 w-4" />
              </span>
              <span className="text-sm font-medium leading-tight text-foreground">{label}</span>
            </button>
          ))}
          <button
            className="grid h-[76px] w-11 shrink-0 place-items-center rounded-2xl border border-dashed border-border bg-card text-muted-foreground transition-colors hover:border-accent/50 hover:text-accent"
            aria-label="Mais ações"
            type="button"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </FadeIn>

      {/* Insight rápido */}
      <FadeIn delay={0.1}>
        <section className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-accent/8 via-card to-card p-5">
          <div className="pointer-events-none absolute -right-16 -top-20 h-44 w-44 rounded-full bg-accent/20 blur-3xl" />
          <div className="relative flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-accent" />
              <h2 className="text-sm font-semibold text-foreground">Seu insight rápido</h2>
            </div>
            <button
              onClick={() => insightMut.mutate()}
              disabled={insightMut.isPending || !orgId}
              className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground disabled:opacity-50"
            >
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-success" />
              {insightMut.isPending ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" /> gerando…
                </>
              ) : insightUpdatedAt ? (
                <>
                  <RefreshCw className="h-3 w-3" /> atualizar
                </>
              ) : (
                <>
                  <RefreshCw className="h-3 w-3" /> gerar agora
                </>
              )}
            </button>
          </div>

          <div className="relative mt-4 grid grid-cols-3 gap-2">
            <InsightChip
              icon={<AlertTriangle className="h-4 w-4" />}
              tone="warning"
              headline="3 pontos"
              subline="de atenção"
              caption="na equipe"
            />
            <InsightChip
              icon={<ArrowUpRight className="h-4 w-4" />}
              tone="success"
              headline="2 boas"
              subline="evoluções"
              caption="esta semana"
            />
            <InsightChip
              icon={<CalendarCheck2 className="h-4 w-4" />}
              tone="accent"
              headline="Rituais"
              subline="em dia"
              caption="86% concluídos"
            />
          </div>

          {insight && (
            <article className="prose prose-sm relative mt-4 max-w-none rounded-2xl bg-background/70 p-3 text-sm leading-relaxed text-foreground/90 prose-headings:font-display prose-headings:font-semibold prose-strong:text-foreground">
              <ReactMarkdown>{insight}</ReactMarkdown>
            </article>
          )}
        </section>
      </FadeIn>

      {/* Chat */}
      <FadeIn delay={0.15}>
        <section className="flex min-h-[420px] flex-col">
          <div ref={scrollerRef} className="flex-1 space-y-5 overflow-y-auto py-2">
            {messages.length === 0 ? (
              <EmptyConversation firstName={firstName} onPick={send} />
            ) : (
              messages.map((m, i) => (
                <MessageRow
                  key={i}
                  msg={m}
                  streaming={streaming && i === messages.length - 1}
                  onChip={send}
                  showChips={!streaming && i === messages.length - 1 && m.role === "assistant" && !!m.content}
                />
              ))
            )}
          </div>

          {/* Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
            className="sticky bottom-0 mt-3 flex items-center gap-2"
          >
            <div className="flex flex-1 items-center gap-2 rounded-full border border-border bg-card px-4 py-2 shadow-sm transition-all focus-within:border-accent/50 focus-within:shadow-[var(--shadow-accent)]">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder="Pergunte algo para o seu coach…"
                rows={1}
                className="max-h-32 min-h-[24px] flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                disabled={streaming}
              />
              <Button
                type="submit"
                size="sm"
                disabled={streaming || !input.trim()}
                className="h-9 w-9 shrink-0 rounded-full bg-primary p-0 text-primary-foreground hover:bg-primary/90"
              >
                {streaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
              </Button>
            </div>
            <button
              type="button"
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:border-accent/50 hover:text-accent"
              aria-label="Ditar mensagem"
            >
              <Mic className="h-4 w-4" />
            </button>
          </form>
        </section>
      </FadeIn>
    </div>
  );
}

function InsightChip({
  icon,
  tone,
  headline,
  subline,
  caption,
}: {
  icon: React.ReactNode;
  tone: "warning" | "success" | "accent";
  headline: string;
  subline: string;
  caption: string;
}) {
  const toneMap = {
    warning: "bg-attention/12 text-attention",
    success: "bg-success/12 text-success",
    accent: "bg-accent/12 text-accent",
  } as const;
  return (
    <div className="rounded-2xl border border-border bg-background/70 p-3">
      <span className={"mb-2 inline-grid h-8 w-8 place-items-center rounded-xl " + toneMap[tone]}>
        {icon}
      </span>
      <div className="text-sm font-semibold leading-tight text-foreground">
        {headline}
        <div className="font-normal text-foreground">{subline}</div>
      </div>
      <div className="mt-1 text-[11px] text-muted-foreground">{caption}</div>
    </div>
  );
}

function CoachAvatar() {
  return (
    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-accent to-[color-mix(in_oklab,var(--accent)_55%,var(--primary))] text-primary-foreground shadow-[var(--shadow-accent)]">
      <BotMessageSquare className="h-4 w-4" />
    </div>
  );
}

function EmptyConversation({ firstName, onPick }: { firstName: string; onPick: (t: string) => void }) {
  const starters = [
    `Olá, ${firstName}! 👋\nAqui está o que mais importa agora:`,
  ];
  const highlights = [
    { icon: <AlertTriangle className="h-3.5 w-3.5 text-attention" />, text: "João Pedro está há 42 dias sem feedback." },
    { icon: <CalendarCheck2 className="h-3.5 w-3.5 text-accent" />, text: "PDI de Lucas Martins está parado há 60 dias." },
    { icon: <ArrowUpRight className="h-3.5 w-3.5 text-success" />, text: "Maria Clara está evoluindo bem! 👏" },
  ];
  return (
    <div className="space-y-4">
      <div className="text-center text-[11px] uppercase tracking-wider text-muted-foreground">
        Hoje às {new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
      </div>
      <div className="flex items-end gap-2">
        <CoachAvatar />
        <div className="max-w-[85%] rounded-2xl rounded-bl-md border border-border bg-card px-4 py-3 text-sm leading-relaxed text-foreground shadow-sm whitespace-pre-line">
          {starters[0]}
        </div>
      </div>
      <div className="ml-11 space-y-2">
        {highlights.map((h) => (
          <button
            key={h.text}
            onClick={() => onPick(`Fale mais sobre: ${h.text}`)}
            className="group flex w-full max-w-[420px] items-center gap-3 rounded-2xl border border-border bg-card px-3 py-2.5 text-left text-sm text-foreground shadow-sm transition-all hover:border-accent/40 hover:shadow-[var(--shadow-accent)]"
          >
            <span className="grid h-6 w-6 place-items-center rounded-lg bg-background">{h.icon}</span>
            <span className="flex-1">{h.text}</span>
            <ArrowUpRight className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-accent" />
          </button>
        ))}
      </div>
    </div>
  );
}

function MessageRow({
  msg,
  streaming,
  showChips,
  onChip,
}: {
  msg: ChatMsg;
  streaming: boolean;
  showChips: boolean;
  onChip: (t: string) => void;
}) {
  const isUser = msg.role === "user";
  const time = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return (
    <FadeIn y={4}>
      {isUser ? (
        <div className="flex justify-end">
          <div className="max-w-[85%]">
            <div className="rounded-2xl rounded-br-md bg-accent/15 px-4 py-3 text-sm leading-relaxed text-foreground">
              <div className="whitespace-pre-wrap">{msg.content}</div>
            </div>
            <div className="mt-1 text-right text-[10px] text-muted-foreground">{time} ✓✓</div>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-end gap-2">
            <CoachAvatar />
            <div className="max-w-[85%] rounded-2xl rounded-bl-md border border-border bg-card px-4 py-3 text-sm leading-relaxed text-foreground shadow-sm">
              <article className="prose prose-sm max-w-none prose-p:my-1.5 prose-ul:my-1.5 prose-headings:font-display prose-headings:font-semibold prose-strong:text-foreground">
                <ReactMarkdown>{msg.content || (streaming ? "…" : "")}</ReactMarkdown>
                {streaming && msg.content && (
                  <span className="ml-0.5 inline-block h-4 w-1 animate-pulse bg-accent" />
                )}
              </article>
            </div>
          </div>
          <div className="ml-11 text-[10px] text-muted-foreground">{time}</div>
          {showChips && (
            <div className="ml-11 flex flex-wrap gap-2 pt-1">
              {REPLY_CHIPS.map((chip) => (
                <button
                  key={chip}
                  onClick={() => onChip(chip)}
                  className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-accent/50 hover:text-accent"
                >
                  {chip}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </FadeIn>
  );
}
