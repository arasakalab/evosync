"use client";

import { useFormState, useFormStatus } from "react-dom";
import { useState, useTransition } from "react";
import { Loader2, MessageCircle, User, ArrowRight } from "lucide-react";
import { submitSignup, type SubmitState } from "./actions";
import { SuccessCard } from "./success";

const INITIAL: SubmitState | null = null;

function formatWhatsapp(raw: string): string {
  const d = raw.replace(/\D+/g, "").slice(0, 13);
  if (d.length === 0) return "";
  const safe = d.startsWith("55") ? d : "55" + d;
  const cc = safe.slice(0, 2);
  const rest = safe.slice(2);
  if (rest.length === 0) return `+${cc}`;
  if (rest.length <= 2) return `+${cc} (${rest}`;
  if (rest.length <= 7) {
    return `+${cc} (${rest.slice(0, 2)}) ${rest.slice(2)}`;
  }
  const ddd = rest.slice(0, 2);
  const num = rest.slice(2);
  if (num.length <= 4) return `+${cc} (${ddd}) ${num}`;
  if (num.length <= 8) {
    return `+${cc} (${ddd}) ${num.slice(0, 4)}-${num.slice(4)}`;
  }
  return `+${cc} (${ddd}) ${num.slice(0, 5)}-${num.slice(5, 9)}`;
}

function SubmitButton({ tenantName }: { tenantName: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="group flex w-full items-center justify-center gap-2.5 rounded-lg bg-primary px-6 py-3.5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:opacity-60"
    >
      {pending ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Cadastrando…
        </>
      ) : (
        <>
          <span>Quero receber mensagens de {tenantName}</span>
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
        </>
      )}
    </button>
  );
}

export function SignupForm({
  tenantName,
  slug,
}: {
  tenantName: string;
  slug: string;
}) {
  const [state, formAction] = useFormState(submitSignup, INITIAL);
  const [, startTransition] = useTransition();
  const [whatsappDisplay, setWhatsappDisplay] = useState("");

  if (state && state.ok) {
    return (
      <SuccessCard
        maskedNumber={state.maskedNumber}
        tenantName={state.tenantName}
      />
    );
  }

  const fieldError = (field: "name" | "whatsapp" | "_root") =>
    state && !state.ok && state.field === field ? state.error : null;

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
      <header className="mb-6 text-center">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Receba mensagens no WhatsApp
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Cadastre-se para receber novidades de{" "}
          <strong className="font-semibold text-foreground">{tenantName}</strong>
        </p>
      </header>

      <form
        className="space-y-4"
        action={(fd) => startTransition(() => formAction(fd))}
      >
        {/* Nome */}
        <div>
          <label
            htmlFor="name"
            className="mb-1.5 ml-1 flex items-center gap-1.5 text-sm font-medium text-foreground"
          >
            <User className="h-3.5 w-3.5 text-muted-foreground" />
            Seu nome
          </label>
          <div className="relative">
            <User
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <input
              id="name"
              name="name"
              type="text"
              autoComplete="name"
              required
              placeholder="Como podemos te chamar?"
              className="w-full rounded-lg border border-input bg-background pl-10 pr-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 aria-[invalid=true]:border-destructive"
              aria-invalid={!!fieldError("name")}
              maxLength={80}
            />
          </div>
          {fieldError("name") && (
            <p className="ml-1 mt-1 text-xs font-medium text-destructive">
              {fieldError("name")}
            </p>
          )}
        </div>

        {/* WhatsApp */}
        <div>
          <label
            htmlFor="whatsapp"
            className="mb-1.5 ml-1 flex items-center gap-1.5 text-sm font-medium text-foreground"
          >
            <MessageCircle className="h-3.5 w-3.5 text-[#25D366]" />
            WhatsApp
          </label>
          <div className="relative">
            <MessageCircle
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#25D366]"
              fill="#25D366"
              aria-hidden
            />
            <input
              id="whatsapp"
              name="whatsapp"
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              required
              placeholder="(11) 99999-9999"
              className="w-full rounded-lg border border-input bg-background pl-10 pr-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 aria-[invalid=true]:border-destructive"
              aria-invalid={!!fieldError("whatsapp")}
              value={whatsappDisplay}
              onChange={(e) => setWhatsappDisplay(formatWhatsapp(e.target.value))}
              maxLength={20}
            />
          </div>
          {fieldError("whatsapp") && (
            <p className="ml-1 mt-1 text-xs font-medium text-destructive">
              {fieldError("whatsapp")}
            </p>
          )}
          {!fieldError("whatsapp") && (
            <p className="ml-1 mt-1 text-xs text-muted-foreground">
              O DDD 55 do Brasil é incluído automaticamente.
            </p>
          )}
        </div>

        {/* Erro geral */}
        {state && !state.ok && state.field === "_root" && (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive"
          >
            <span className="mt-0.5 inline-block h-2 w-2 shrink-0 rounded-full bg-destructive" />
            {state.error}
          </div>
        )}

        <SubmitButton tenantName={tenantName} />

        {/* LGPD inline */}
        <p className="pt-1 text-center text-xs text-muted-foreground">
          Ao cadastrar, você concorda em receber mensagens de{" "}
          <strong className="font-medium text-foreground">{tenantName}</strong> no
          seu WhatsApp. Para parar de receber, responda{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] font-semibold">
            SAIR
          </code>
          .
        </p>

        <input type="hidden" name="slug" value={slug} />
      </form>
    </div>
  );
}
