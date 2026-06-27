"use client";

import { CheckCircle2, MessageCircle } from "lucide-react";

export function SuccessCard({
  maskedNumber,
  tenantName,
}: {
  maskedNumber: string;
  tenantName: string;
}) {
  return (
    <div className="tenant-card p-6 sm:p-8 animate-fade-up">
      <div className="space-y-6 text-center">
        <div className="flex justify-center">
          <div className="relative">
            <div className="absolute inset-0 animate-pulse-ring rounded-full" />
            <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-[#25D366] to-[#128C7E] shadow-lg shadow-[#25D366]/30">
              <CheckCircle2 className="h-10 w-10 text-white" strokeWidth={2.5} />
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">
            Cadastro confirmado!
          </h2>
          <p className="text-sm leading-relaxed text-slate-500 sm:text-base">
            Você vai receber mensagens de{" "}
            <strong className="font-semibold text-slate-800">{tenantName}</strong>{" "}
            no seu WhatsApp.
          </p>
        </div>

        <div className="rounded-xl border border-[#25D366]/25 bg-[#25D366]/5 p-5">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
            Número cadastrado
          </p>
          <div className="flex items-center justify-center gap-2.5 text-xl font-bold text-slate-900">
            <MessageCircle
              className="h-6 w-6 text-[#25D366]"
              fill="#25D366"
              strokeWidth={1.5}
            />
            <span className="font-mono tracking-tight">{maskedNumber}</span>
          </div>
        </div>

        <div className="space-y-3 rounded-xl bg-slate-50 p-4 text-left">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
            Próximos passos
          </p>
          <ol className="space-y-3 text-sm text-slate-600">
            <li className="flex items-start gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#25D366] text-xs font-bold text-white">
                1
              </span>
              <span>{tenantName} pode enviar novidades e avisos para você.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#25D366] text-xs font-bold text-white">
                2
              </span>
              <span>
                Para parar a qualquer momento, responda{" "}
                <code className="rounded bg-white px-1.5 py-0.5 font-mono text-xs font-bold text-slate-700 ring-1 ring-slate-200">
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
