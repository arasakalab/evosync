"use client";

import { CheckCircle2, MessageCircle } from "lucide-react";

/**
 * Tela de sucesso após cadastro.
 * Mostra o número mascarado + nome do tenant.
 */
export function SuccessCard({
  maskedNumber,
  tenantName,
}: {
  maskedNumber: string;
  tenantName: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8 animate-fade-in">
      <div className="space-y-5 text-center">
        {/* Check com pulse ring */}
        <div className="flex justify-center">
          <div className="relative">
            <div className="absolute inset-0 animate-pulse-ring rounded-full" />
            <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-[#25D366] to-[#128C7E] shadow-lg shadow-[#25D366]/30">
              <CheckCircle2 className="h-8 w-8 text-white" strokeWidth={2.5} />
            </div>
          </div>
        </div>

        <div className="space-y-1.5">
          <h2 className="text-xl font-bold text-foreground sm:text-2xl">
            Tudo certo! 🎉
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
            Você vai receber mensagens do{" "}
            <strong className="font-semibold text-foreground">{tenantName}</strong>{" "}
            no seu WhatsApp.
          </p>
        </div>

        {/* Card com número */}
        <div className="rounded-xl border border-[#25D366]/30 bg-[#25D366]/5 p-4">
          <p className="mb-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Número cadastrado
          </p>
          <div className="flex items-center justify-center gap-2 text-lg font-bold text-foreground">
            <MessageCircle
              className="h-5 w-5 text-[#25D366]"
              fill="#25D366"
              strokeWidth={1.5}
            />
            <span className="font-mono">{maskedNumber}</span>
          </div>
        </div>

        {/* Próximos passos */}
        <div className="space-y-2 rounded-lg bg-muted/50 p-4 text-left">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            O que acontece agora
          </p>
          <ol className="space-y-2 text-sm text-foreground/80">
            <li className="flex items-start gap-2.5">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                1
              </span>
              <span>
                {tenantName} pode enviar mensagens e novidades para você.
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                2
              </span>
              <span>
                Para parar de receber a qualquer momento, basta responder{" "}
                <code className="rounded bg-background px-1.5 py-0.5 font-mono text-xs font-semibold">
                  SAIR
                </code>
                .
              </span>
            </li>
          </ol>
        </div>
      </div>
    </div>
  );
}
