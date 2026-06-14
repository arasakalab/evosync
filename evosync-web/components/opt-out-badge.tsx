"use client";

import { Badge } from "@/components/ui/badge";
import { Ban } from "lucide-react";

/**
 * Badge "Opt-out" usada em linhas da tabela e em cards.
 * - Vermelha quando opt_out=true
 * - Tracejada "—" quando false (não chama atenção)
 */
export function OptOutBadge({ value }: { value: boolean }) {
  if (!value) {
    return <span className="text-xs text-muted/60">—</span>;
  }
  return (
    <Badge variant="danger" className="gap-1">
      <Ban className="h-3 w-3" />
      Opt-out
    </Badge>
  );
}
