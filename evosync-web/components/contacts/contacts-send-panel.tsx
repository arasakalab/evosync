"use client";

import Link from "next/link";
import { Send, CheckCheck, Eraser, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";

type Props = {
  onViewSelected: () => void;
  onClearSelection: () => void;
};

export function ContactsSendPanel({ onViewSelected, onClearSelection }: Props) {
  const selectedIds = useAppStore((s) => s.selectedIds);
  const count = selectedIds.size;

  return (
    <Card
      className={cn(
        "border-2",
        count > 0 ? "border-primary/40 bg-primary/5" : "border-border bg-panel/40"
      )}
    >
      <CardContent className="pt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <CheckCheck
              className={cn(
                "h-5 w-5 shrink-0 mt-0.5",
                count > 0 ? "text-primary" : "text-muted"
              )}
            />
            <div>
              <p className="text-sm font-medium text-text">
                {count > 0
                  ? `${count} contato${count !== 1 ? "s" : ""} marcado${count !== 1 ? "s" : ""} para envio`
                  : "Nenhum contato marcado para envio"}
              </p>
              <p className="text-xs text-muted mt-0.5">
                Marque quem receberá a próxima campanha. Desmarcados nunca recebem.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {count > 0 && (
              <>
                <Button variant="outline" size="sm" onClick={onViewSelected}>
                  <Eye className="h-4 w-4" /> Ver selecionados
                </Button>
                <Button variant="ghost" size="sm" onClick={onClearSelection}>
                  <Eraser className="h-4 w-4" /> Limpar seleção
                </Button>
              </>
            )}
            <Button size="sm" asChild disabled={count === 0}>
              <Link href="/disparo">
                <Send className="h-4 w-4" /> Ir para Disparo
              </Link>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
