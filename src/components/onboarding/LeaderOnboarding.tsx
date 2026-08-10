import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  Brain,
  Briefcase,
  CheckCircle2,
  Compass,
  Gauge,
  Lock,
  MessageSquare,
  Phone,
  ShieldCheck,
  Sparkles,
  Target,
  User as UserIcon,
  Users,
  X,
} from "lucide-react";

type Step = {
  key: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  cta?: { label: string; to: string };
};

const MENTORED_STEPS: Step[] = [
  {
    key: "welcome",
    title: "Bem-vindo de volta à metodologia",
    description:
      "Você chegou por convite da Neo, então já conhece a metodologia C.O.R.E. Vamos ativar a jornada completa em poucos passos.",
    icon: Sparkles,
  },
  {
    key: "profile",
    title: "Confirme seus dados",
    description:
      "Essas informações ajudam a IA Coach a personalizar suas orientações e recomendações.",
    icon: Brain,
  },
  {
    key: "consciencia",
    title: "Consciência — sua base",
    description:
      "No módulo 'Meu perfil' você faz o diagnóstico de estilo e recebe seus pontos fortes e riscos.",
    icon: Brain,
    cta: { label: "Abrir Meu perfil", to: "/app/consciencia" },
  },
  {
    key: "organizacao",
    title: "Organização — sua operação",
    description:
      "Cadastre rituais (1:1, semanal, mensal), delegações e decisões. É a base do seu score.",
    icon: Users,
    cta: { label: "Abrir Organização", to: "/app/organization" },
  },
  {
    key: "resultado",
    title: "Resultado — seus indicadores",
    description:
      "Registre indicadores chave. O Coach cruza com rituais e delegações para gerar insights.",
    icon: Target,
    cta: { label: "Abrir Indicadores", to: "/app/indicators" },
  },
  {
    key: "evolucao",
    title: "Evolução — seu crescimento",
    description:
      "Acompanhe seu score, PDIs e feedbacks. Converse com o IA Coach quando quiser.",
    icon: Gauge,
    cta: { label: "Falar com IA Coach", to: "/app/ai" },
  },
  {
    key: "done",
    title: "Tudo pronto",
    description:
      "Você já pode começar. Se quiser rever esta introdução, o menu 'Ajuda' tem tudo.",
    icon: CheckCircle2,
  },
];

// Trilha básica (cadastro aberto): só o essencial. O restante vai sendo
// liberado conforme o líder usa o app.
const BASIC_STEPS: Step[] = [
  {
    key: "welcome",
    title: "Bem-vindo ao Líder C.O.R.E.",
    description:
      "Vamos começar simples: confirme seus dados e faça seu primeiro diagnóstico. O resto do sistema abre conforme você avança.",
    icon: Sparkles,
  },
  {
    key: "profile",
    title: "Confirme seus dados",
    description:
      "Essas informações ajudam a IA Coach a personalizar suas orientações e recomendações.",
    icon: Brain,
  },
  {
    key: "consciencia",
    title: "Comece pela Consciência",
    description:
      "Faça os assessments e receba seu radar Hard / Soft / Heart. É a porta de entrada da metodologia.",
    icon: Compass,
    cta: { label: "Abrir Meu perfil", to: "/app/consciencia" },
  },
  {
    key: "done",
    title: "Pronto para começar",
    description:
      "Conforme você conclui a Consciência, os próximos módulos aparecem no seu app. Em 'Ajuda' você acompanha o que já está liberado.",
    icon: CheckCircle2,
  },
];

const LOCAL_SKIP_KEY = "lc_onboarding_skipped";

export function LeaderOnboarding() {
  const { user, refresh } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [idx, setIdx] = useState(0);
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [whatsapp, setWhatsapp] = useState("");

  useEffect(() => {
    if (!user) return;
    if (user.onboardingCompletedAt) return;
    const skipped = typeof window !== "undefined" && window.sessionStorage.getItem(LOCAL_SKIP_KEY);
    if (skipped) return;
    setFullName(user.fullName ?? "");
    setJobTitle(user.jobTitle ?? "");
    setWhatsapp(user.whatsapp ?? "");
    setOpen(true);
  }, [user]);

  const isMentored = user?.onboardingTrack === "mentored" || user?.didNeoMentorship === true;
  const steps = useMemo(
    () => (isMentored ? MENTORED_STEPS : BASIC_STEPS),
    [isMentored],
  );
  const step = steps[Math.min(idx, steps.length - 1)];
  const total = steps.length;
  const isLast = idx === total - 1;
  const Icon = step.icon;

  const percent = useMemo(() => Math.round(((idx + 1) / total) * 100), [idx, total]);
  void percent;

  const persist = async (payload: {
    step?: string;
    completed?: boolean;
    profile?: Record<string, string>;
  }) => {
    await api("/auth/me/onboarding", { method: "POST", body: payload });
  };

  const skip = () => {
    if (typeof window !== "undefined") window.sessionStorage.setItem(LOCAL_SKIP_KEY, "1");
    setOpen(false);
    void persist({ step: "skipped" }).catch(() => null);
  };

  const next = async () => {
    setSaving(true);
    try {
      if (step.key === "profile") {
        let phoneVal = whatsapp.trim();
        // Garante o prefixo 55 se não houver
        if (phoneVal && !phoneVal.startsWith("55") && phoneVal.length >= 10) {
          phoneVal = "55" + phoneVal.replace(/\D/g, "");
        }
        await persist({
          step: step.key,
          profile: {
            fullName: fullName.trim(),
            jobTitle: jobTitle.trim(),
            whatsapp: phoneVal,
          },
        });
      } else {
        await persist({ step: step.key });
      }
      if (isLast) {
        await persist({ step: "done", completed: true });
        await refresh();
        toast.success("Onboarding concluído!");
        setOpen(false);
      } else {
        setIdx((i) => i + 1);
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const goCta = () => {
    if (!step.cta) return;
    setOpen(false);
    navigate({ to: step.cta.to });
  };

  if (!open || !user) return null;

  return (
    <div className="fixed inset-x-0 top-[60px] bottom-[68px] z-40 overflow-y-auto bg-background md:top-[68px] md:bottom-0">
      <div className="mx-auto flex min-h-full w-full max-w-2xl flex-col px-5 py-6 md:px-8 md:py-10">
        {/* Stepper */}
        <div className="mb-6 flex items-center justify-between gap-2">
          <div className="flex flex-1 items-center">
            {steps.map((_, i) => {
              const done = i < idx;
              const active = i === idx;
              return (
                <div key={i} className="flex flex-1 items-center last:flex-none">
                  <div
                    className={
                      "grid h-7 w-7 shrink-0 place-items-center rounded-full text-[11px] font-semibold transition-colors " +
                      (done
                        ? "bg-accent text-accent-foreground"
                        : active
                        ? "bg-accent text-accent-foreground ring-4 ring-accent/20"
                        : "bg-secondary text-muted-foreground")
                    }
                  >
                    {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : i + 1}
                  </div>
                  {i < total - 1 && (
                    <div
                      className={
                        "h-[2px] flex-1 " + (done ? "bg-accent" : "bg-secondary")
                      }
                    />
                  )}
                </div>
              );
            })}
          </div>
          <button
            onClick={skip}
            aria-label="Fechar"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-border text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Header */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">
              Passo {idx + 1} de {total}
            </div>
            <h2 className="font-display text-4xl font-bold leading-[1.05] tracking-tight text-foreground md:text-5xl">
              {step.title}
            </h2>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-muted-foreground">
              {step.description}
            </p>
          </div>
          <div className="relative hidden shrink-0 sm:block">
            <div
              aria-hidden
              className="absolute -inset-4 rounded-3xl bg-[radial-gradient(circle_at_center,theme(colors.accent/25),transparent_70%)]"
            />
            <div className="relative grid h-24 w-24 place-items-center rounded-3xl border border-border bg-card shadow-lg">
              <Icon className="h-11 w-11 text-accent" />
              <div className="absolute -bottom-2 -right-2 grid h-8 w-8 place-items-center rounded-full bg-accent text-accent-foreground shadow-md">
                <CheckCircle2 className="h-4 w-4" />
              </div>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1">
          {step.key === "profile" && (
            <div className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-sm md:p-6">
              <FieldRow
                icon={UserIcon}
                label="Nome completo"
                value={fullName}
                onChange={setFullName}
                placeholder="Seu nome"
              />
              <FieldRow
                icon={Briefcase}
                label="Cargo / Função"
                value={jobTitle}
                onChange={setJobTitle}
                placeholder="Ex.: Líder de célula, Pastor, Gerente…"
              />
              <FieldRow
                icon={Phone}
                label="WhatsApp (com DDD)"
                value={whatsapp}
                onChange={setWhatsapp}
                placeholder="11 99999-9999"
                hint="DDI 55 (Brasil) será adicionado automaticamente."
              />
            </div>
          )}

          {step.key === "welcome" && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[
                { i: Brain, t: "Consciência" },
                { i: Users, t: "Organização" },
                { i: Target, t: "Resultado" },
                { i: Gauge, t: "Evolução" },
                { i: MessageSquare, t: "1:1s" },
                { i: Compass, t: "Feedbacks" },
              ].map(({ i: I, t }) => (
                <div
                  key={t}
                  className="flex items-center gap-2.5 rounded-2xl border border-border bg-card px-4 py-3 shadow-sm"
                >
                  <div className="grid h-8 w-8 place-items-center rounded-full bg-accent/10">
                    <I className="h-4 w-4 text-accent" />
                  </div>
                  <span className="text-sm font-medium">{t}</span>
                </div>
              ))}
            </div>
          )}

          {step.cta && step.key !== "welcome" && step.key !== "profile" && (
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm md:p-6">
              <p className="mb-4 text-sm text-muted-foreground">
                Você pode abrir esta seção agora para explorar antes de continuar.
              </p>
              <Button variant="outline" onClick={goCta}>
                {step.cta.label}
              </Button>
            </div>
          )}

          {/* Privacy card */}
          <div className="mt-5 flex items-start gap-3 rounded-2xl border border-accent/20 bg-accent/5 p-4">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent/15">
              <Lock className="h-4 w-4 text-accent" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold">Seus dados estão protegidos</div>
              <p className="text-xs text-muted-foreground">
                Suas informações são seguras e não compartilhadas com terceiros.
              </p>
            </div>
            <ShieldCheck className="h-5 w-5 shrink-0 text-accent/70" />
          </div>
        </div>

        {/* Footer buttons */}
        <div className="sticky bottom-0 mt-6 flex items-center justify-between gap-3 bg-background pt-4">
          <Button
            variant="outline"
            className="h-12 rounded-2xl px-5"
            onClick={() => (idx === 0 ? skip() : setIdx((i) => i - 1))}
            disabled={saving}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            {idx === 0 ? "Pular" : "Voltar"}
          </Button>
          <Button
            className="h-12 flex-1 rounded-2xl bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={next}
            disabled={saving}
          >
            {saving ? "Salvando…" : isLast ? "Concluir" : "Próximo"}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function FieldRow({
  icon: Icon,
  label,
  value,
  onChange,
  placeholder,
  hint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-6 grid h-11 w-11 shrink-0 place-items-center rounded-full bg-accent/10 text-accent">
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 space-y-1.5">
        <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="h-12 rounded-xl border-border bg-background"
        />
        {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
      </div>
    </div>
  );
}