import Link from "next/link";
import { Store } from "lucide-react";

/**
 * 404 amigável quando o slug do tenant não existe ou está inativo.
 */
export default function NotFound({ slug }: { slug: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-950 p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 text-center shadow-sm sm:p-8">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
          <Store className="h-7 w-7 text-muted-foreground" />
        </div>
        <h1 className="text-xl font-bold text-foreground">Loja não encontrada</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          O link <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{`/c/${slug}`}</code>{" "}
          não corresponde a nenhuma loja ativa.
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Verifique se você digitou o link corretamente ou contate a loja que
          te indicou.
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <Link
            href="/"
            className="inline-flex w-full items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Voltar ao início
          </Link>
        </div>
      </div>
    </div>
  );
}
