import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  BarChart3,
  Ban,
  CheckCircle2,
  Clock,
  Copy,
  Loader2,
  MessageSquareHeart,
  Plus,
  Send,
  Trash2,
  AudioLines,
  TrendingUp,
  Sparkles,
  ChevronRight,
  MoreVertical,
} from "lucide-react";
import pulseHero from "@/assets/pulse-hero.png";
import { api } from "@/lib/api";
import { useCurrentOrg } from "@/lib/use-current-org";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/app/pulses")({
  component: PulsesPage,
});

type Kind = "feedback" | "climate" | "disc" | "custom";
type Status = "pending" | "answered" | "expired" | "revoked";

type Template = {
  id: string;
  kind: Kind;
  title: string;
  intro: string | null;
  isSystem: boolean;
  questions: unknown[];
};

type PulseSend = {
  id: string;
  token: string;
  subjectUserId: string | null;
  subjectLabel: string | null;
  subjectPhone: string | null;
  message: string | null;
  status: Status;
  expiresAt: string;
  answeredAt: string | null;
  createdAt: string;
  template: Template;
  answer: {
    id: string;
    answers: Record<string, unknown>;
    aiSummary: string | null;
    discProfile: { pct: Record<string, number>; primary: string } | null;
  } | null;
};

type TeamOption = { membershipId: string; userId: string; fullName: string; whatsapp?: string };

const KIND_LABEL: Record<Kind, string> = {
  feedback: "Feedback solicitado",
  climate: "Pulse de clima",
  disc: "DISC leve",
  custom: "Pesquisa custom",
};

const STATUS_STYLE: Record<Status, string> = {
  pending: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  answered: "bg-primary/10 text-primary",
  expired: "bg-muted text-muted-foreground",
  revoked: "bg-destructive/10 text-destructive",
};

const STATUS_LABEL: Record<Status, string> = {
  pending: "Aguardando",
  answered: "Respondido",
  expired: "Expirado",
  revoked: "Cancelado",
};

type Suggestion = {
  id: string;
  title: string;
  description: string;
  kind: Kind;
  when: string;
};

const PULSE_SUGGESTIONS: Suggestion[] = [
  {
    id: "feedback-semanal",
    title: "Feedback pro líder — 1 vez por mês",
    description:
      "Peça 2 coisas que você deve manter, 2 que deve começar a fazer e 1 que deve parar. Crucial para seu desenvolvimento.",
    kind: "feedback",
    when: "Primeiro mês no cargo e depois mensal",
  },
  {
    id: "climate-semanal",
    title: "Pulso de clima semanal",
    description:
      "Como foi a semana do time: humor, carga de trabalho, clareza das prioridades. 4 perguntas que guiam sua próxima reunião.",
    kind: "climate",
    when: "Toda sexta 16h, para agir na semana seguinte",
  },
  {
    id: "disc-onboarding",
    title: "DISC leve no onboarding",
    description:
      "Entenda o estilo comportamental do novo liderado nos primeiros 15 dias: como ele prefere receber feedback, tomar decisão e se comunicar.",
    kind: "disc",
    when: "No onboarding de cada novo membro",
  },
  {
    id: "sabotadores-equipe",
    title: "Sabotadores — antes da meta importante",
    description:
      "Descubra quais padrões emocionais (Abaixador, Perfeccionista, Hiper-Racional etc.) podem atrapalhar a entrega do próximo objetivo.",
    kind: "disc",
    when: "Antes de iniciar um projeto crítico",
  },
  {
    id: "cerebral-decisao",
    title: "Predominância cerebral — antes da promoção",
    description:
      "Águia/Lobo/Gato/Tubarão: perfis de decisão e liderança. Use para ajustar seu estilo de gestão com cada pessoa.",
    kind: "disc",
    when: "Ao preparar promoções ou redistribuir papéis",
  },
  {
    id: "custom-pre-ciclo",
    title: "Pré-fechamento de ciclo",
    description:
      "Perguntas customizadas: 'Qual seu maior ganho do ciclo?', 'O que mais te bloqueou?', 'Qual apoio você precisa no próximo?'",
    kind: "custom",
    when: "1 semana antes do fechamento",
  },
];

function PulsesPage() {
  const { orgId } = useCurrentOrg();
  const qc = useQueryClient();
  const [openNew, setOpenNew] = useState(false);
  const [openSuggestions, setOpenSuggestions] = useState(false);
  const [presetKind, setPresetKind] = useState<Kind | null>(null);
  const [detail, setDetail] = useState<PulseSend | null>(null);

  const { data: sends = [], isLoading } = useQuery<PulseSend[]>({
    queryKey: ["pulses", orgId],
    enabled: !!orgId,
    queryFn: () => api<PulseSend[]>(`/organization/${orgId}/pulses`),
    refetchOnWindowFocus: true,
    refetchOnMount: "always",
    refetchInterval: 30_000,
    staleTime: 0,
  });

  const { data: team = [] } = useQuery<TeamOption[]>({
    queryKey: ["team-basic", orgId],
    enabled: !!orgId,
    queryFn: () => api<TeamOption[]>(`/organization/${orgId}/team`),
  });

  const revoke = useMutation({
    mutationFn: (id: string) =>
      api(`/organization/${orgId}/pulses/${id}/revoke`, { method: "PATCH" }),
    onSuccess: () => {
      toast.success("Link cancelado");
      qc.invalidateQueries({ queryKey: ["pulses", orgId] });
    },
  });

  const del = useMutation({
    mutationFn: (id: string) =>
      api(`/organization/${orgId}/pulses/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pulses", orgId] }),
  });

  if (!orgId) return null;

  const pending = sends.filter((s) => s.status === "pending").length;
  const answered = sends.filter((s) => s.status === "answered").length;
  const responseRate = sends.length ? Math.round((answered / sends.length) * 100) : 0;
  const totalAnswers = answered;
  const featured = sends[0];
  const rest = sends.slice(1);

  return (
    <div className="mx-auto max-w-5xl space-y-8 pb-10">
      {/* Hero */}
      <header className="relative">
        <div className="grid grid-cols-1 items-start gap-6 sm:grid-cols-[minmax(0,1fr)_240px]">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-600">
              <AudioLines className="h-3.5 w-3.5" />
              PULSOS
            </div>
            <h1 className="mt-3 font-display text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl">
              Escute com <br className="hidden sm:block" />um link<span className="text-primary">.</span>
            </h1>
            <p className="mt-4 max-w-md text-[15px] leading-relaxed text-muted-foreground">
              Envie por WhatsApp um link único e temporário. O liderado responde no celular, você
              recebe a resposta, a IA resume e vira insumo pra 1:1 e CORE.
            </p>
            <div className="mt-5 sm:hidden">
              <Dialog open={openNew} onOpenChange={(o) => { if (!o) setPresetKind(null); setOpenNew(o); }}>
                <DialogTrigger asChild>
                  <Button size="lg" className="gap-2 rounded-full bg-foreground px-5 text-background hover:bg-foreground/90">
                    <Plus className="h-4 w-4" /> Enviar pulso
                  </Button>
                </DialogTrigger>
                <NewSendDialog
                  orgId={orgId}
                  team={team}
                  presetKind={presetKind ?? undefined}
                  onDone={() => {
                    setOpenNew(false);
                    setPresetKind(null);
                    qc.invalidateQueries({ queryKey: ["pulses", orgId] });
                  }}
                />
              </Dialog>
            </div>
          </div>
          <div className="relative hidden sm:block">
            <div className="absolute right-0 top-0 hidden sm:block">
              <Dialog open={openNew} onOpenChange={(o) => { if (!o) setPresetKind(null); setOpenNew(o); }}>
                <DialogTrigger asChild>
                  <Button size="lg" className="gap-2 rounded-full bg-foreground px-5 text-background shadow-md hover:bg-foreground/90">
                    <Plus className="h-4 w-4" /> Enviar pulso
                  </Button>
                </DialogTrigger>
                <NewSendDialog
                  orgId={orgId}
                  team={team}
                  presetKind={presetKind ?? undefined}
                  onDone={() => {
                    setOpenNew(false);
                    setPresetKind(null);
                    qc.invalidateQueries({ queryKey: ["pulses", orgId] });
                  }}
                />
              </Dialog>
            </div>
            <img
              src={pulseHero}
              alt=""
              width={240}
              height={240}
              loading="lazy"
              className="mx-auto mt-10 h-56 w-56 select-none object-contain drop-shadow-[0_20px_40px_rgba(139,92,246,0.25)]"
            />
          </div>
        </div>
      </header>

      {/* Stats — 2x2 grid with colored icon tiles */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <StatTile
          label="Aguardando resposta"
          value={pending}
          footer="Pulsos enviados"
          tone="violet"
          icon={<Clock className="h-5 w-5" />}
        />
        <StatTile
          label="Respostas recebidas"
          value={answered}
          footer="Ver todas"
          tone="green"
          icon={<CheckCircle2 className="h-5 w-5" />}
        />
        <StatTile
          label="Taxa de resposta"
          value={`${responseRate}%`}
          footer={
            <div className="w-full">
              <div className="text-[11px] font-semibold text-emerald-600">
                {responseRate >= 70 ? "Excelente" : responseRate >= 40 ? "Boa" : "Melhorar"}
              </div>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-emerald-100">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all"
                  style={{ width: `${Math.min(100, responseRate)}%` }}
                />
              </div>
              <div className="mt-1 text-[10px] text-muted-foreground">Meta: 70%</div>
            </div>
          }
          tone="orange"
          icon={<TrendingUp className="h-5 w-5" />}
        />
        <StatTile
          label="Total de respostas"
          value={totalAnswers}
          footer="Todas as respostas"
          tone="blue"
          icon={<MessageSquareHeart className="h-5 w-5" />}
        />
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
        </div>
      )}

      {!isLoading && sends.length === 0 && (
        <div className="rounded-3xl border border-dashed border-border bg-secondary/30 p-10 text-center">
          <MessageSquareHeart className="mx-auto h-8 w-8 text-violet-500" />
          <div className="mt-3 font-medium">Nenhum pulso enviado ainda</div>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Comece pedindo feedback sobre você a 2 liderados. Cada resposta que chega alimenta seu
            radar de liderança.
          </p>
        </div>
      )}

      {featured && (
        <section className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-base font-semibold">Último pulso enviado</h2>
            <button className="inline-flex items-center gap-0.5 text-xs font-medium text-primary hover:underline">
              Ver todos <ChevronRight className="h-3 w-3" />
            </button>
          </div>
          <FeaturedPulseCard
            send={featured}
            onOpenAnswer={() => setDetail(featured)}
            onDelete={() => del.mutate(featured.id)}
            onRevoke={() => revoke.mutate(featured.id)}
          />
        </section>
      )}

      {/* Tip banner */}
      <div className="flex items-center gap-4 rounded-3xl border border-primary/15 bg-primary/5 p-5">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary/15 text-primary">
          <Sparkles className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-semibold leading-snug">Pulsos geram conexões reais</div>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Perguntas curtas revelam muito sobre o que realmente importa.
          </p>
        </div>
        <Dialog open={openSuggestions} onOpenChange={setOpenSuggestions}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="shrink-0 rounded-full border-primary/30 bg-background text-primary hover:bg-primary/10 hover:text-primary">
              Ver sugestões <ChevronRight className="ml-0.5 h-3 w-3" />
            </Button>
          </DialogTrigger>
          <SuggestionsDialog
            suggestions={PULSE_SUGGESTIONS}
            onApply={(s) => {
              setOpenSuggestions(false);
              setPresetKind(s.kind);
              setOpenNew(true);
            }}
          />
        </Dialog>
      </div>

      {rest.length > 0 && (
      <ul className="space-y-3">
        <li className="pt-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          Histórico
        </li>
        {rest.map((s) => (
          <li
            key={s.id}
            className="rounded-xl border border-border bg-background p-4 transition hover:border-primary/40"
          >
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 sm:flex sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={
                      "rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-widest " +
                      STATUS_STYLE[s.status]
                    }
                  >
                    {STATUS_LABEL[s.status]}
                  </span>
                  <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    {KIND_LABEL[s.template.kind]}
                  </span>
                </div>
                <div className="mt-1 truncate font-medium">
                  {s.template.title} · <span className="text-muted-foreground">{s.subjectLabel ?? "—"}</span>
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  Enviado em {new Date(s.createdAt).toLocaleDateString("pt-BR")} · Expira{" "}
                  {new Date(s.expiresAt).toLocaleDateString("pt-BR")}
                  {s.answer?.aiSummary && (
                    <> · <span className="italic">"{s.answer.aiSummary.slice(0, 80)}"</span></>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 sm:gap-2">
                {s.status === "pending" && (
                  <>
                    <ShareButtons send={s} />
                    <button
                      onClick={() => revoke.mutate(s.id)}
                      className="rounded-full p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      aria-label="Cancelar"
                    >
                      <Ban className="h-3.5 w-3.5" />
                    </button>
                  </>
                )}
                {s.status === "answered" && (
                  <Button size="sm" variant="outline" onClick={() => setDetail(s)}>
                    Ver resposta
                  </Button>
                )}
                <button
                  onClick={() => del.mutate(s.id)}
                  className="rounded-full p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  aria-label="Excluir"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
      )}

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        {detail && <AnswerDialog send={detail} />}
      </Dialog>
    </div>
  );
}

const TONE: Record<string, { bg: string; fg: string }> = {
  violet: { bg: "bg-violet-100", fg: "text-violet-600" },
  green: { bg: "bg-emerald-100", fg: "text-emerald-600" },
  orange: { bg: "bg-orange-100", fg: "text-orange-600" },
  blue: { bg: "bg-sky-100", fg: "text-sky-600" },
};

function StatTile({
  label,
  value,
  footer,
  tone,
  icon,
}: {
  label: string;
  value: number | string;
  footer: React.ReactNode;
  tone: keyof typeof TONE;
  icon: React.ReactNode;
}) {
  const t = TONE[tone];
  return (
    <div className="rounded-3xl border border-border/60 bg-background p-4 shadow-sm transition hover:shadow-md sm:p-5">
      <div className={`grid h-11 w-11 place-items-center rounded-2xl ${t.bg} ${t.fg}`}>{icon}</div>
      <div className="mt-3 text-[13px] font-medium leading-tight text-foreground">{label}</div>
      <div className="mt-1 font-display text-4xl font-bold leading-none tracking-tight">{value}</div>
      <div className="mt-3 flex items-center justify-between gap-2 text-xs text-muted-foreground">
        {typeof footer === "string" ? (
          <>
            <span>{footer}</span>
            <ChevronRight className="h-3 w-3" />
          </>
        ) : (
          footer
        )}
      </div>
    </div>
  );
}

function FeaturedPulseCard({
  send: s,
  onOpenAnswer,
  onDelete,
  onRevoke,
}: {
  send: PulseSend;
  onOpenAnswer: () => void;
  onDelete: () => void;
  onRevoke: () => void;
}) {
  const answered = s.status === "answered";
  const responded = answered ? 1 : 0;
  const rate = answered ? 100 : 0;
  return (
    <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-background p-5 shadow-sm">
      <span className="absolute left-0 top-0 h-full w-1 bg-violet-400/70" />
      <div className="flex items-start gap-4">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-violet-100 text-violet-600">
          <BarChart3 className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={
                "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest " +
                STATUS_STYLE[s.status]
              }
            >
              {STATUS_LABEL[s.status]}
            </span>
            <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
              {KIND_LABEL[s.template.kind]}
            </span>
          </div>
          <div className="mt-2 text-[17px] font-semibold leading-snug">
            {s.template.title}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            Enviado em {new Date(s.createdAt).toLocaleDateString("pt-BR")} · Expira{" "}
            {new Date(s.expiresAt).toLocaleDateString("pt-BR")}
          </div>
          {s.answer?.aiSummary && (
            <div className="mt-2 text-sm italic text-muted-foreground">"{s.answer.aiSummary}"</div>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {answered ? (
            <Button size="sm" variant="outline" className="rounded-full" onClick={onOpenAnswer}>
              Ver resposta <ChevronRight className="ml-0.5 h-3 w-3" />
            </Button>
          ) : (
            <ShareButtons send={s} />
          )}
          <MoreMenu onDelete={onDelete} onRevoke={s.status === "pending" ? onRevoke : undefined} />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 rounded-2xl bg-secondary/40 p-3 sm:grid-cols-4">
        <Metric icon={<Send className="h-3.5 w-3.5 text-sky-600" />} label="Enviado para" value={`${s.subjectLabel ? "1 pessoa" : "—"}`} />
        <Metric icon={<CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />} label="Respondidas" value={String(responded)} />
        <Metric icon={<TrendingUp className="h-3.5 w-3.5 text-orange-600" />} label="Taxa de resposta" value={`${rate}%`} />
        <Metric icon={<Clock className="h-3.5 w-3.5 text-violet-600" />} label="Tempo médio" value={answered ? "2 min" : "—"} />
      </div>
    </div>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <div className="text-sm font-semibold">{value}</div>
    </div>
  );
}

function MoreMenu({ onDelete, onRevoke }: { onDelete: () => void; onRevoke?: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className="rounded-full p-2 text-muted-foreground hover:bg-secondary"
        aria-label="Mais"
      >
        <MoreVertical className="h-4 w-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-10 mt-1 min-w-[140px] overflow-hidden rounded-xl border border-border bg-background shadow-lg">
          {onRevoke && (
            <button
              onMouseDown={(e) => {
                e.preventDefault();
                onRevoke();
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-xs text-muted-foreground hover:bg-secondary"
            >
              <Ban className="h-3.5 w-3.5" /> Cancelar link
            </button>
          )}
          <button
            onMouseDown={(e) => {
              e.preventDefault();
              onDelete();
              setOpen(false);
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-xs text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="h-3.5 w-3.5" /> Excluir
          </button>
        </div>
      )}
    </div>
  );
}

function publicUrl(token: string) {
  if (typeof window === "undefined") return `/p/${token}`;
  return `${window.location.origin}/p/${token}`;
}

function ShareButtons({ send }: { send: PulseSend }) {
  const url = publicUrl(send.token);

  function whatsapp() {
    const digits = (send.subjectPhone ?? "").replace(/\D/g, "");
    const greeting = `Oi${send.subjectLabel ? `, ${send.subjectLabel.split(" ")[0]}` : ""}!`;
    const body = send.message?.trim()
      ? send.message.trim()
      : "Consegue responder essa pesquisa rápida pra mim? Leva pouquinho.";
    const text = encodeURIComponent(`${greeting} ${body}\n\n${url}`);
    const link = digits ? `https://wa.me/${digits}?text=${text}` : `https://wa.me/?text=${text}`;
    window.open(link, "_blank", "noopener");
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copiado");
    } catch {
      toast.error("Não foi possível copiar");
    }
  }

  return (
    <>
      <button
        onClick={whatsapp}
        className="inline-flex items-center gap-1.5 rounded-full bg-[#25D366]/10 px-3 py-1.5 text-xs font-medium text-[#128C7E] transition hover:bg-[#25D366]/20"
      >
        <Send className="h-3 w-3" /> WhatsApp
      </button>
      <button
        onClick={copy}
        className="rounded-full p-2 text-muted-foreground hover:bg-secondary"
        aria-label="Copiar link"
      >
        <Copy className="h-3.5 w-3.5" />
      </button>
    </>
  );
}

function SuggestionsDialog({
  suggestions,
  onApply,
}: {
  suggestions: Suggestion[];
  onApply: (s: Suggestion) => void;
}) {
  return (
    <DialogContent className="sm:max-w-2xl max-h-[92vh] flex-col overflow-hidden">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          Sugestões de pulsos prontos
        </DialogTitle>
      </DialogHeader>
      <div className="flex-1 overflow-y-auto py-2 pr-1 space-y-3">
        {suggestions.map((s) => (
          <button
            key={s.id}
            onClick={() => onApply(s)}
            className="w-full rounded-2xl border border-border bg-background p-4 text-left transition hover:border-primary/50 hover:bg-primary/5"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-violet-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-widest text-violet-600">
                    {KIND_LABEL[s.kind]}
                  </span>
                </div>
                <div className="mt-1.5 font-semibold leading-snug">{s.title}</div>
                <p className="mt-1 text-sm text-muted-foreground">{s.description}</p>
                <div className="mt-2 text-[11px] font-medium text-primary/80">
                  🕒 {s.when}
                </div>
              </div>
              <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
            </div>
          </button>
        ))}
      </div>
      <DialogFooter>
        <p className="mr-auto text-[11px] text-muted-foreground">
          Clique em uma sugestão para abrir o envio com o modelo já selecionado.
        </p>
      </DialogFooter>
    </DialogContent>
  );
}

function NewSendDialog({
  orgId,
  team,
  onDone,
  presetSubjectUserId,
  presetKind,
}: {
  orgId: string;
  team: TeamOption[];
  onDone: () => void;
  presetSubjectUserId?: string;
  presetKind?: Kind;
}) {
  const { data: templates = [] } = useQuery<Template[]>({
    queryKey: ["pulse-templates", orgId],
    queryFn: () => api<Template[]>(`/organization/${orgId}/pulses/templates`),
  });

  const [templateId, setTemplateId] = useState("");
  const [subjectUserId, setSubjectUserId] = useState(presetSubjectUserId ?? "");
  const [subjectLabel, setSubjectLabel] = useState("");
  const [subjectPhone, setSubjectPhone] = useState("");
  const [message, setMessage] = useState("");
  const [expiresInDays, setExpiresInDays] = useState(7);

  const selected = useMemo(() => templates.find((t) => t.id === templateId), [templates, subjectUserId, templateId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (templates.length && presetKind && !templateId) {
      const match = templates.find((t) => t.kind === presetKind);
      if (match) setTemplateId(match.id);
    }
  }, [templates, presetKind, templateId]);

  const create = useMutation({
    mutationFn: () =>
      api<PulseSend>(`/organization/${orgId}/pulses`, {
        method: "POST",
        body: {
          templateId,
          subjectUserId: subjectUserId || null,
          subjectLabel: subjectLabel || null,
          subjectPhone: subjectPhone || null,
          message: message || null,
          expiresInDays,
        },
      }),
    onSuccess: (s) => {
      toast.success("Pulso criado — envie pelo WhatsApp");
      // auto-open whatsapp with the fresh link
      const digits = (s.subjectPhone ?? "").replace(/\D/g, "");
      const url = publicUrl(s.token);
      const greeting = `Oi${s.subjectLabel ? `, ${s.subjectLabel.split(" ")[0]}` : ""}!`;
      const body = (s.message ?? message)?.trim()
        ? (s.message ?? message).trim()
        : "Consegue responder essa pesquisa rápida?";
      const text = encodeURIComponent(`${greeting} ${body}\n\n${url}`);
      const link = digits ? `https://wa.me/${digits}?text=${text}` : `https://wa.me/?text=${text}`;
      window.open(link, "_blank", "noopener");
      onDone();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao criar"),
  });

  return (
    <DialogContent className="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>Enviar novo pulso</DialogTitle>
      </DialogHeader>
      <div className="space-y-4 py-2">
        <div>
          <Label>Modelo</Label>
          <Select value={templateId} onValueChange={setTemplateId}>
            <SelectTrigger>
              <SelectValue placeholder="Escolha um modelo…" />
            </SelectTrigger>
            <SelectContent>
              {templates.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  <span className="mr-2 rounded bg-secondary px-1.5 py-0.5 text-[9px] uppercase tracking-widest">
                    {KIND_LABEL[t.kind]}
                  </span>
                  {t.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selected?.intro && (
            <p className="mt-1 text-xs text-muted-foreground">{selected.intro}</p>
          )}
        </div>

        <div>
          <Label>Liderado</Label>
          <Select
            value={subjectUserId}
            onValueChange={(v) => {
              setSubjectUserId(v);
              const t = team.find((x) => x.userId === v);
              if (t) {
                setSubjectLabel(t.fullName);
                setSubjectPhone(t.whatsapp ?? "");
              }
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione ou preencha manual…" />
            </SelectTrigger>
            <SelectContent>
              {team.map((t) => (
                <SelectItem key={t.userId} value={t.userId}>
                  {t.fullName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Nome (opcional)</Label>
            <Input
              value={subjectLabel}
              onChange={(e) => setSubjectLabel(e.target.value)}
              placeholder="Ex: Ana"
            />
          </div>
          <div>
            <Label>WhatsApp</Label>
            <Input
              value={subjectPhone}
              onChange={(e) => setSubjectPhone(e.target.value)}
              placeholder="+55 11 90000-0000"
            />
          </div>
        </div>

        <div>
          <Label>Recado personalizado (opcional)</Label>
          <Textarea
            rows={3}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Ex.: Ana, tô querendo melhorar como líder e sua visão importa. Responde com sinceridade, tá tudo bem."
          />
        </div>

        <div>
          <Label>Link expira em (dias)</Label>
          <Input
            type="number"
            min={1}
            max={60}
            value={expiresInDays}
            onChange={(e) => setExpiresInDays(Number(e.target.value) || 7)}
          />
        </div>
      </div>
      <DialogFooter>
        <Button
          disabled={create.isPending || !templateId}
          onClick={() => create.mutate()}
          className="gap-2"
        >
          {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Gerar link + Abrir WhatsApp
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function AnswerDialog({ send }: { send: PulseSend }) {
  const questions = (send.template.questions as Array<{ id: string; type: string; label: string }>) ?? [];
  const answers = send.answer?.answers ?? {};
  const disc = send.answer?.discProfile;

  return (
    <DialogContent className="sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle>{send.template.title}</DialogTitle>
      </DialogHeader>
      <div className="space-y-4 py-2">
        <div className="text-xs text-muted-foreground">
          {send.subjectLabel ?? "Anônimo"} · Respondido em{" "}
          {send.answeredAt ? new Date(send.answeredAt).toLocaleString("pt-BR") : "—"}
        </div>

        {disc && (
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Perfil DISC — Predominante: <span className="text-foreground">{disc.primary}</span>
            </div>
            <div className="mt-3 space-y-2">
              {(["D", "I", "S", "C"] as const).map((k) => (
                <div key={k} className="flex items-center gap-3">
                  <div className="w-6 text-xs font-medium">{k}</div>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
                    <div className="h-full bg-primary" style={{ width: `${disc.pct[k]}%` }} />
                  </div>
                  <div className="w-10 text-right text-xs text-muted-foreground">{disc.pct[k]}%</div>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              {disc.primary === "D" && "Direto, focado em resultado, gosta de assumir riscos."}
              {disc.primary === "I" && "Comunicativo, entusiasta, gosta de convencer e inspirar."}
              {disc.primary === "S" && "Paciente, colaborativo, valoriza estabilidade e harmonia."}
              {disc.primary === "C" && "Analítico, detalhista, valoriza precisão e qualidade."}
            </p>
          </div>
        )}

        {send.answer?.aiSummary && !disc && (
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
            {send.answer.aiSummary}
          </div>
        )}

        <div className="space-y-3">
          {questions.filter((q) => q.type !== "disc_pair").map((q) => {
            const v = answers[q.id];
            return (
              <div key={q.id} className="rounded-lg border border-border bg-background p-3">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  {q.label}
                </div>
                <div className="mt-1 text-sm">
                  {typeof v === "number"
                    ? `${v}/5`
                    : Array.isArray(v)
                      ? v.join(", ")
                      : typeof v === "string" && v.trim()
                        ? v
                        : <span className="italic text-muted-foreground">(sem resposta)</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </DialogContent>
  );
}
