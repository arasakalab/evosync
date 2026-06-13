"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import Link from "next/link";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error("[ErrorPage]", error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <Card className="max-w-md w-full">
        <CardContent className="pt-8 pb-8 text-center">
          <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto mb-3" />
          <h1 className="text-xl font-semibold mb-1">Erro ao carregar a página</h1>
          <p className="text-sm text-slate-500 mb-5">
            Não conseguimos processar sua solicitação. Tente novamente ou volte
            ao início.
          </p>
          {error.digest && (
            <code className="inline-block text-[11px] bg-slate-100 dark:bg-slate-900 px-2 py-1 rounded mb-4">
              ref: {error.digest}
            </code>
          )}
          <div className="flex items-center justify-center gap-2">
            <Button onClick={reset} variant="default">
              <RefreshCw className="h-4 w-4 mr-1.5" />
              Tentar de novo
            </Button>
            <Button asChild variant="outline">
              <Link href="/">
                <Home className="h-4 w-4 mr-1.5" />
                Início
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
