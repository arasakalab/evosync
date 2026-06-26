import Link from "next/link";
import { Home } from "lucide-react";

/**
 * 404 estilizado para /promocoes/[slug] quando o slug não corresponde a
 * nenhum tenant ativo.
 */
export default function NotFound() {
  return (
    <div className="brand-landing flex min-h-screen items-center justify-center px-4 py-12">
      <div className="brand-card w-full max-w-md p-8 text-center">
        <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-red/10">
          <span className="text-3xl font-bold text-brand-red">404</span>
        </div>
        <h1 className="mb-2 text-2xl font-bold text-brand-ink">
          Página não encontrada
        </h1>
        <p className="mb-6 text-sm leading-relaxed text-brand-ink/70">
          Esta loja não está cadastrada ou o link está incorreto.
          Confira o endereço e tente novamente.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-xl border border-brand-teal/40 bg-white px-4 py-2.5 text-sm font-semibold text-brand-ink transition-colors hover:bg-brand-teal-soft"
        >
          <Home className="h-4 w-4" />
          Voltar ao início
        </Link>
      </div>
    </div>
  );
}
