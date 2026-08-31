import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Loader2, MessageCircleHeart, ShieldCheck, Sparkles } from "lucide-react";
import { Logo } from "@/components/brand/Logo";

/**
 * Public pulse response page — no auth required.
 * URL: /p/:token
 */

export const Route = createFileRoute("/p/$token")({
  ssr: false,
  component: PublicPulsePage,
});

const API_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ?? "";

type Question =
  | { id: string; type: "scale"; label: string; min?: number; max?: number; minLabel?: string; maxLabel?: string; required?: boolean }
  | { id: string; type: "text"; label: string; placeholder?: string; required?: boolean }
  | { id: string; type: "choice"; label: string; options: string[]; multi?: boolean; required?: boolean }
  | { id: string; type: "disc_pair"; label: string; options: { text: string; dim: "D" | "I" | "S" | "C" }[] };

type Payload = {
  id: string;
  token: string;
  subjectLabel: string | null;
  message: string | null;
  senderName: string;
  template: {
    kind: "feedback" | "climate" | "disc" | "custom";
    title: string;
    intro: string | null;
    questions: Question[];
  };
  expiresAt: string;
};

function PublicPulsePage() {
  const { token } = Route.useParams();
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/public/pulse/${token}`);
        const json = await res.json();
        if (cancel) return;
        if (!res.ok) setError(json.error ?? "Não foi possível abrir a pesquisa.");
        else setData(json as Payload);
      } catch {
        if (!cancel) setError("Erro de conexão. Tente novamente.");
      }
    })();
    return () => {
      cancel = true;
    };
  }, [token]);

  const questions = data?.template.questions ?? [];
  const isDisc = data?.template.kind === "disc";
  const totalSteps = isDisc ? questions.length : 1;
  const current = isDisc ? questions[step] : null;
  const progress = isDisc ? Math.round(((step + 1) / totalSteps) * 100) : 0;

  const allRequiredFilled = useMemo(() => {
    if (!data) return false;
    for (const q of questions) {
      if ("required" in q && q.required) {
        const v = answers[q.id];
        if (v === undefined || v === null || v === "") return false;
      }
      if (q.type === "disc_pair") {
        // all pairs required
        if (!answers[q.id]) return false;
      }
    }
    return true;
  }, [answers, questions, data]);

  async function submit() {
    if (!data) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/api/public/pulse/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Falha ao enviar.");
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao enviar.");
    } finally {
      setSubmitting(false);
    }
  }

  if (error) {
    return (
      <Shell>
        <div className="animate-fade-in rounded-3xl border border-border bg-card p-8 text-center shadow-xl">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-destructive/10 text-2xl font-bold text-destructive">
            !
          </div>
          <h1 className="mt-4 text-lg font-semibold">{error}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Se precisar, peça à pessoa que enviou pra gerar um novo link.
          </p>
        </div>
      </Shell>
    );
  }

  if (!data) {
    return (
      <Shell>
        <div className="flex flex-col items-center justify-center gap-3 py-20 text-muted-foreground">
          <div className="relative">
            <div className="absolute inset-0 animate-ping rounded-full bg-accent/30" />
            <div className="relative grid h-12 w-12 place-items-center rounded-full bg-accent-gradient text-white shadow-lg">
              <Sparkles className="h-5 w-5" />
            </div>
          </div>
          <span className="text-sm font-medium">Preparando sua pesquisa…</span>
        </div>
      </Shell>
    );
  }

  if (done) {
    return (
      <Shell>
        <div className="animate-scale-in relative overflow-hidden rounded-3xl border border-border bg-card p-10 text-center shadow-2xl">
          <div className="pointer-events-none absolute -top-20 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-accent/20 blur-3xl" />
          <div className="relative mx-auto grid h-20 w-20 place-items-center rounded-full bg-accent-gradient text-white shadow-xl ring-8 ring-accent/10">
            <CheckCircle2 className="h-10 w-10" />
          </div>
          <h1 className="relative mt-5 font-display text-3xl">Obrigado! 🎉</h1>
          <p className="relative mt-2 text-sm text-muted-foreground">
            Sua resposta foi enviada com segurança. Você pode fechar esta página.
          </p>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <header className="animate-fade-in relative mb-6 overflow-hidden rounded-3xl border border-border bg-card p-6 shadow-xl sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-accent/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-16 h-56 w-56 rounded-full bg-accent/15 blur-3xl" />
        <div className="relative">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-gradient px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white shadow-md">
            <Sparkles className="h-3 w-3" />
            {data.template.kind === "feedback"
              ? "Feedback"
              : data.template.kind === "climate"
                ? "Pulse rápido"
                : data.template.kind === "disc"
                  ? "Perfil DISC"
                  : "Pesquisa"}
          </span>
          <h1 className="mt-3 font-display text-3xl leading-tight sm:text-4xl">{data.template.title}</h1>
          {data.template.intro && (
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{data.template.intro}</p>
          )}
          {data.message && (
            <div className="mt-5 rounded-2xl border border-accent/30 bg-accent/10 p-4 text-sm backdrop-blur">
              <div className="flex items-start gap-3">
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent-gradient text-white shadow">
                  <MessageCircleHeart className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-widest text-accent-foreground/70">
                    Recado de {data.senderName}
                  </div>
                  <div className="mt-1 whitespace-pre-wrap font-medium">{data.message}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </header>

      {isDisc && (
        <div className="mb-5">
          <div className="mb-2 flex items-center justify-between text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            <span>Par {step + 1} de {totalSteps}</span>
            <span className="text-accent">{progress}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-secondary shadow-inner">
            <div
              className="h-full rounded-full bg-accent-gradient shadow-[0_0_12px_var(--accent)] transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      <div key={isDisc ? step : "all"} className="animate-fade-in space-y-5">
        {isDisc && current
          ? [current].map((q, i) => renderQuestion(q, answers, setAnswers, i))
          : questions.map((q, i) => renderQuestion(q, answers, setAnswers, i))}
      </div>

      <footer className="mt-8 flex flex-col gap-3">
        {isDisc ? (
          <div className="flex items-center justify-between gap-3">
            <button
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0}
              className="rounded-full border border-border bg-card px-5 py-2.5 text-sm font-medium transition hover:border-accent/50 hover:bg-accent/5 disabled:opacity-40"
            >
              ← Voltar
            </button>
            {step < totalSteps - 1 ? (
              <button
                onClick={() => setStep((s) => s + 1)}
                disabled={!answers[current!.id]}
                className="rounded-full bg-accent-gradient px-6 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:scale-105 hover:shadow-xl active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
              >
                Continuar →
              </button>
            ) : (
              <button
                onClick={submit}
                disabled={!allRequiredFilled || submitting}
                className="inline-flex items-center gap-2 rounded-full bg-accent-gradient px-6 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:scale-105 hover:shadow-xl active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Enviar respostas
              </button>
            )}
          </div>
        ) : (
          <button
            onClick={submit}
            disabled={!allRequiredFilled || submitting}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-accent-gradient px-6 py-3.5 text-base font-semibold text-white shadow-xl transition hover:scale-[1.02] hover:shadow-2xl active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Enviar respostas
          </button>
        )}
        <div className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
          <ShieldCheck className="h-3 w-3" /> Suas respostas ficam registradas apenas para {data.senderName}.
        </div>
      </footer>
    </Shell>
  );
}

function renderQuestion(
  q: Question,
  answers: Record<string, unknown>,
  setAnswers: React.Dispatch<React.SetStateAction<Record<string, unknown>>>,
  index = 0,
) {
  const set = (v: unknown) => setAnswers((s) => ({ ...s, [q.id]: v }));
  const delay = { animationDelay: `${index * 80}ms` };
  if (q.type === "scale") {
    const val = answers[q.id] as number | undefined;
    return (
      <div
        key={q.id}
        style={delay}
        className="animate-fade-in rounded-2xl border border-border bg-card p-5 shadow-sm transition hover:shadow-md"
      >
        <label className="text-sm font-semibold">
          {q.label} {q.required && <span className="text-destructive">*</span>}
        </label>
        <div className="mt-4 flex items-center justify-between gap-2">
          {Array.from(
            { length: (q.type === "scale" ? (q.max ?? 5) - (q.min ?? 1) + 1 : 0) },
            (_, i) => (q.min ?? 1) + i,
          ).map((n) => (
            <button
              key={n}
              onClick={() => set(n)}
              className={
                "h-14 flex-1 rounded-xl border text-base font-bold transition-all duration-200 " +
                (val === n
                  ? "scale-110 border-transparent bg-accent-gradient text-white shadow-lg shadow-accent/40"
                  : "border-border bg-background hover:-translate-y-0.5 hover:border-accent/50 hover:bg-accent/5")
              }
            >
              {n}
            </button>
          ))}
        </div>
        <div className="mt-3 flex justify-between text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          <span>{q.minLabel ?? "Baixo"}</span>
          <span>{q.maxLabel ?? "Alto"}</span>
        </div>
      </div>
    );
  }
  if (q.type === "text") {
    return (
      <div
        key={q.id}
        style={delay}
        className="animate-fade-in rounded-2xl border border-border bg-card p-5 shadow-sm transition focus-within:border-accent/60 focus-within:shadow-md"
      >
        <label className="text-sm font-semibold">
          {q.label} {q.required && <span className="text-destructive">*</span>}
        </label>
        <textarea
          rows={4}
          value={(answers[q.id] as string) ?? ""}
          onChange={(e) => set(e.target.value)}
          placeholder={q.placeholder ?? "Escreva aqui…"}
          className="mt-3 w-full resize-none rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
        />
      </div>
    );
  }
  if (q.type === "choice") {
    const val = answers[q.id];
    return (
      <div
        key={q.id}
        style={delay}
        className="animate-fade-in rounded-2xl border border-border bg-card p-5 shadow-sm"
      >
        <label className="text-sm font-semibold">
          {q.label} {q.required && <span className="text-destructive">*</span>}
        </label>
        <div className="mt-4 grid gap-2.5">
          {q.options.map((opt) => {
            const selected = q.multi
              ? Array.isArray(val) && (val as string[]).includes(opt)
              : val === opt;
            return (
              <button
                key={opt}
                onClick={() => {
                  if (q.multi) {
                    const arr = Array.isArray(val) ? [...(val as string[])] : [];
                    set(selected ? arr.filter((x) => x !== opt) : [...arr, opt]);
                  } else set(opt);
                }}
                className={
                  "group relative flex items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm font-medium transition-all duration-200 " +
                  (selected
                    ? "translate-x-1 border-accent bg-accent/15 shadow-md shadow-accent/20"
                    : "border-border bg-background hover:translate-x-1 hover:border-accent/40 hover:bg-accent/5")
                }
              >
                <span
                  className={
                    "grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 transition " +
                    (selected ? "border-transparent bg-accent-gradient text-white" : "border-border")
                  }
                >
                  {selected && <CheckCircle2 className="h-3.5 w-3.5" />}
                </span>
                <span>{opt}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }
  if (q.type === "disc_pair") {
    const val = answers[q.id] as string | undefined;
    return (
      <div
        key={q.id}
        style={delay}
        className="animate-fade-in relative overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-md"
      >
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-accent/10 blur-2xl" />
        <div className="relative text-[11px] font-bold uppercase tracking-widest text-accent">
          ✨ Qual frase MAIS te descreve?
        </div>
        <div className="relative mt-5 grid gap-3 sm:grid-cols-2">
          {q.options.map((opt) => {
            const selected = val === opt.text;
            return (
              <button
                key={opt.text}
                onClick={() => set(opt.text)}
                className={
                  "group relative overflow-hidden rounded-2xl border p-5 text-left text-sm font-medium transition-all duration-300 " +
                  (selected
                    ? "-translate-y-1 border-accent bg-accent-gradient text-white shadow-xl shadow-accent/40"
                    : "border-border bg-background hover:-translate-y-1 hover:border-accent/50 hover:bg-accent/5 hover:shadow-lg")
                }
              >
                <span className="relative">{opt.text}</span>
                {selected && (
                  <span className="absolute right-3 top-3 grid h-6 w-6 place-items-center rounded-full bg-white/25 backdrop-blur">
                    <CheckCircle2 className="h-4 w-4" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  }
  return null;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      {/* Ambient background */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-32 top-0 h-96 w-96 rounded-full bg-accent/20 blur-3xl" />
        <div className="absolute right-0 top-40 h-[28rem] w-[28rem] rounded-full bg-accent/15 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-accent/10 blur-3xl" />
      </div>
      <div className="relative mx-auto max-w-2xl px-4 py-8 sm:py-12">
        <div className="animate-fade-in mb-8 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Logo variant="mark" className="h-9 w-9 rounded-xl shadow-md" />
            <div>
              <div className="font-display text-base font-bold uppercase leading-none tracking-tight">Líder C.O.R.E.</div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Neo Pessoas</div>
            </div>
          </div>
          <span className="hidden items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-accent sm:inline-flex">
            <ShieldCheck className="h-3 w-3" /> Seguro
          </span>
        </div>
        {children}
        <div className="mt-10 text-center text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
          Powered by Neo Pessoas · Metodologia C.O.R.E.
        </div>
      </div>
    </div>
  );
}
