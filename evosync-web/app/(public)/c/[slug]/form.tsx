"use client";

import { useFormState, useFormStatus } from "react-dom";
import { useState, useTransition } from "react";
import { Loader2, MessageCircle, User, ArrowRight, Lock } from "lucide-react";
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

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="tenant-cta group flex items-center justify-center gap-2.5 px-6 py-4"
    >
      {pending ? (
        <>
          <Loader2 className="h-5 w-5 animate-spin" />
          Cadastrando…
        </>
      ) : (
        <>
          <MessageCircle className="h-5 w-5" fill="white" strokeWidth={1.5} />
          <span>Quero Receber Ofertas</span>
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
        </>
      )}
    </button>
  );
}

export function SignupForm({
  displayName,
  slug,
  accentColor = "#25D366",
}: {
  displayName: string;
  slug: string;
  accentColor?: string;
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
    <div className="tenant-card p-6 sm:p-8">
      <header className="mb-6 flex items-start gap-3.5">
        <div className="tenant-wpp-icon animate-pulse-ring">
          <MessageCircle className="h-5 w-5" fill="white" strokeWidth={1.5} />
        </div>
        <div>
          <h2 className="text-xl font-bold leading-tight text-slate-900 sm:text-2xl">
            Cadastre seu WhatsApp
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Preencha abaixo para receber mensagens de{" "}
            <strong className="font-semibold text-slate-700">{displayName}</strong>
          </p>
        </div>
      </header>

      <form
        className="space-y-5"
        action={(fd) => startTransition(() => formAction(fd))}
      >
        <div>
          <label
            htmlFor="name"
            className="mb-2 ml-0.5 flex items-center gap-1.5 text-sm font-semibold text-slate-700"
          >
            <User className="h-3.5 w-3.5 text-slate-400" />
            Seu nome
          </label>
          <div className="relative">
            <User
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden
            />
            <input
              id="name"
              name="name"
              type="text"
              autoComplete="name"
              required
              placeholder="Como podemos te chamar?"
              className="tenant-input"
              aria-invalid={!!fieldError("name")}
              maxLength={80}
            />
          </div>
          {fieldError("name") && (
            <p className="ml-0.5 mt-1.5 text-xs font-medium text-red-600">
              {fieldError("name")}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="whatsapp"
            className="mb-2 ml-0.5 flex items-center gap-1.5 text-sm font-semibold text-slate-700"
          >
            <MessageCircle
              className="h-3.5 w-3.5"
              style={{ color: accentColor }}
              fill={accentColor}
            />
            WhatsApp
          </label>
          <div className="relative">
            <MessageCircle
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2"
              style={{ color: accentColor }}
              fill={accentColor}
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
              className="tenant-input"
              aria-invalid={!!fieldError("whatsapp")}
              value={whatsappDisplay}
              onChange={(e) => setWhatsappDisplay(formatWhatsapp(e.target.value))}
              maxLength={20}
            />
          </div>
          {fieldError("whatsapp") ? (
            <p className="ml-0.5 mt-1.5 text-xs font-medium text-red-600">
              {fieldError("whatsapp")}
            </p>
          ) : (
            <p className="ml-0.5 mt-1.5 text-xs text-slate-400">
              Código +55 do Brasil incluído automaticamente.
            </p>
          )}
        </div>

        {state && !state.ok && state.field === "_root" && (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
          >
            <span className="mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full bg-red-500" />
            {state.error}
          </div>
        )}

        <SubmitButton />

        <div className="flex items-start gap-2 rounded-xl bg-slate-50 px-3.5 py-3 text-xs leading-relaxed text-slate-500">
          <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
          <p>
            Ao cadastrar, você concorda em receber mensagens de{" "}
            <strong className="font-semibold text-slate-700">{displayName}</strong>.
            Para cancelar, responda{" "}
            <code className="rounded bg-white px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-600 ring-1 ring-slate-200">
              SAIR
            </code>
            .
          </p>
        </div>

        <input type="hidden" name="slug" value={slug} />
      </form>
    </div>
  );
}
