"use client";

import { useFormState, useFormStatus } from "react-dom";
import { useState, useTransition } from "react";
import {
  Loader2,
  ShoppingBag,
  MessageCircle,
  User,
  CheckCircle2,
  Lock,
  ArrowRight,
} from "lucide-react";
import { submitPromoSignup, type SubmitState } from "./actions";
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

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="brand-cta group flex w-full items-center justify-center gap-2.5 rounded-2xl px-6 py-4 text-base"
    >
      {pending ? (
        <>
          <Loader2 className="h-5 w-5 animate-spin" />
          Cadastrando…
        </>
      ) : (
        <>
          <ShoppingBag className="h-5 w-5 transition-transform group-hover:scale-110" />
          <span>Quero receber ofertas</span>
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
        </>
      )}
    </button>
  );
}

export function PromoForm({ slug, tenantName }: { slug: string; tenantName: string }) {
  const [state, formAction] = useFormState(submitPromoSignup, INITIAL);
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

  const fieldError = (field: "name" | "whatsapp" | "lgpd") =>
    state && !state.ok && state.field === field ? state.error : null;

  return (
    <form
      className="space-y-4"
      action={(fd) => startTransition(() => formAction(fd))}
    >
      {/* Nome */}
      <div>
        <label
          htmlFor="name"
          className="mb-1.5 ml-1 flex items-center gap-1.5 text-sm font-semibold text-brand-ink"
        >
          <User className="h-3.5 w-3.5 text-brand-ink/50" />
          Seu nome
        </label>
        <div className="relative">
          <User
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-ink/40"
            aria-hidden
          />
          <input
            id="name"
            name="name"
            type="text"
            autoComplete="name"
            required
            placeholder="Como podemos te chamar?"
            className="brand-input"
            aria-invalid={!!fieldError("name")}
            maxLength={80}
          />
        </div>
        {fieldError("name") && (
          <p className="ml-1 mt-1 text-xs font-medium text-brand-red">
            {fieldError("name")}
          </p>
        )}
      </div>

      {/* WhatsApp */}
      <div>
        <label
          htmlFor="whatsapp"
          className="mb-1.5 ml-1 flex items-center gap-1.5 text-sm font-semibold text-brand-ink"
        >
          <MessageCircle className="h-3.5 w-3.5 text-[#25D366]" />
          WhatsApp
        </label>
        <div className="relative">
          <div
            className="pointer-events-none absolute left-3.5 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-md bg-[#25D366] text-white"
            aria-hidden
          >
            <MessageCircle className="h-3 w-3" fill="white" />
          </div>
          <input
            id="whatsapp"
            name="whatsapp"
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            required
            placeholder="(11) 99999-9999"
            className="brand-input"
            aria-invalid={!!fieldError("whatsapp")}
            value={whatsappDisplay}
            onChange={(e) => setWhatsappDisplay(formatWhatsapp(e.target.value))}
            maxLength={20}
          />
        </div>
        {fieldError("whatsapp") && (
          <p className="ml-1 mt-1 text-xs font-medium text-brand-red">
            {fieldError("whatsapp")}
          </p>
        )}
        {!fieldError("whatsapp") && (
          <p className="ml-1 mt-1 text-xs text-brand-ink/55">
            O DDD 55 do Brasil é incluído automaticamente.
          </p>
        )}
      </div>

      {/* LGPD */}
      <div>
        <label className="brand-checkbox">
          <input
            type="checkbox"
            name="lgpd"
            value="on"
            aria-invalid={!!fieldError("lgpd")}
          />
          <span className="flex-1 text-sm leading-snug text-brand-ink/85">
            Concordo em receber{" "}
            <strong className="font-semibold text-brand-ink">
              promoções e ofertas
            </strong>{" "}
            do {tenantName} no meu WhatsApp. Posso cancelar a qualquer
            momento respondendo{" "}
            <em className="not-italic rounded bg-brand-cream px-1.5 py-0.5 font-mono text-xs font-semibold text-brand-red">
              SAIR
            </em>
            .
          </span>
        </label>
        {fieldError("lgpd") && (
          <p className="ml-1 mt-1 text-xs font-medium text-brand-red">
            {fieldError("lgpd")}
          </p>
        )}
      </div>

      {/* Erro geral */}
      {state && !state.ok && state.field === "_root" && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-xl border-2 border-brand-red/40 bg-brand-red/10 px-4 py-3 text-sm font-medium text-brand-red"
        >
          <span className="mt-0.5 inline-block h-2 w-2 shrink-0 rounded-full bg-brand-red" />
          {state.error}
        </div>
      )}

      <SubmitButton />

      {/* Trust line */}
      <p className="flex items-center justify-center gap-1.5 pt-1 text-center text-xs text-brand-ink/60">
        <Lock className="h-3 w-3" />
        Conexão criptografada · Não compartilhamos seus dados
      </p>

      <input type="hidden" name="slug" value={slug} />
    </form>
  );
}
