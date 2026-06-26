"use client";

import { CheckCircle2, MessageCircle, Tag, ArrowRight } from "lucide-react";

/**
 * Tela de sucesso após cadastro.
 * Mostra o número mascarado + nome do tenant + ícone WhatsApp turquesa.
 */
export function SuccessCard({
  maskedNumber,
  tenantName,
}: {
  maskedNumber: string;
  tenantName: string;
}) {
  return (
    <div className="space-y-5 py-2 text-center animate-bounce-in">
      {/* Check com pulse ring */}
      <div className="flex justify-center">
        <div className="relative">
          <div className="absolute inset-0 animate-pulse-ring rounded-full" />
          <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-[#25D366] to-[#128C7E] shadow-lg shadow-[#25D366]/30">
            <CheckCircle2 className="h-10 w-10 text-white" strokeWidth={2.5} />
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <h2 className="text-2xl font-extrabold text-brand-ink sm:text-3xl">
          Tudo certo! 🎉
        </h2>
        <p className="text-sm leading-relaxed text-brand-ink/70 sm:text-base">
          Você vai receber as{" "}
          <strong className="font-semibold text-brand-ink">
            ofertas exclusivas
          </strong>{" "}
          do <strong>{tenantName}</strong> no seu WhatsApp.
        </p>
      </div>

      {/* Card com número */}
      <div className="rounded-2xl border-2 border-[#25D366]/30 bg-gradient-to-br from-[#25D366]/8 to-[#25D366]/3 p-4">
        <p className="mb-1 text-2xs font-bold uppercase tracking-wider text-brand-teal">
          Número cadastrado
        </p>
        <div className="flex items-center justify-center gap-2 text-lg font-bold text-brand-ink">
          <MessageCircle
            className="h-5 w-5 text-[#25D366]"
            fill="#25D366"
            strokeWidth={1.5}
          />
          <span className="font-mono">{maskedNumber}</span>
        </div>
      </div>

      {/* Próximos passos */}
      <div className="space-y-2 rounded-xl bg-brand-cream/60 p-4 text-left">
        <p className="text-2xs font-bold uppercase tracking-wider text-brand-ink/60">
          O que acontece agora
        </p>
        <ol className="space-y-2 text-sm text-brand-ink/80">
          <li className="flex items-start gap-2.5">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-yellow text-xs font-bold text-brand-red">
              1
            </span>
            <span>
              Vamos enviar uma mensagem de{" "}
              <strong className="font-semibold text-brand-ink">
                boas-vindas
              </strong>{" "}
              no seu WhatsApp em instantes.
            </span>
          </li>
          <li className="flex items-start gap-2.5">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-yellow text-xs font-bold text-brand-red">
              2
            </span>
            <span>
              A partir de agora, você recebe{" "}
              <strong className="font-semibold text-brand-ink">
                ofertas exclusivas
              </strong>{" "}
              antes de todo mundo.
            </span>
          </li>
          <li className="flex items-start gap-2.5">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-yellow text-xs font-bold text-brand-red">
              3
            </span>
            <span>
              Para parar de receber, basta responder{" "}
              <em className="not-italic rounded bg-white px-1.5 py-0.5 font-mono text-xs font-semibold text-brand-red">
                SAIR
              </em>
              .
            </span>
          </li>
        </ol>
      </div>

      {/* CTA secundário: WhatsApp direto */}
      <a
        href={`https://wa.me/${maskedNumber.replace(/\D/g, "")}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl border-2 border-[#25D366] bg-white px-4 py-3 text-sm font-bold text-[#128C7E] transition-colors hover:bg-[#25D366] hover:text-white"
      >
        <MessageCircle className="h-4 w-4" fill="currentColor" />
        Abrir conversa no WhatsApp
        <ArrowRight className="h-3.5 w-3.5" />
      </a>
    </div>
  );
}
