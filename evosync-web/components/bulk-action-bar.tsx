"use client";

import { useAppStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { CheckCheck, X, ListPlus, Tag, Ban, CheckCircle2 } from "lucide-react";

interface BulkActionBarProps {
  visible: boolean;
  onClearSelection: () => void;
  onCreateListFromSelection: () => void;
  onAddTagToSelection: () => void;
  onToggleOptOut: (optOut: boolean) => void;
  onDeleteSelection: () => void;
}

/**
 * Barra de ação em massa, aparece quando há pelo menos 1 contato selecionado.
 * Exibe a contagem de selecionados e ações rápidas.
 */
export function BulkActionBar({
  visible,
  onClearSelection,
  onCreateListFromSelection,
  onAddTagToSelection,
  onToggleOptOut,
  onDeleteSelection,
}: BulkActionBarProps) {
  const selectedIds = useAppStore((s) => s.selectedIds);
  const count = selectedIds.size;
  if (!visible || count === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-primary/40 bg-primary/10 px-3 py-2">
      <div className="flex items-center gap-2 text-sm text-text">
        <CheckCircle2 className="h-4 w-4 text-primary" />
        <span className="font-semibold tabular-nums">{count}</span>
        <span>selecionado{count !== 1 ? "s" : ""}</span>
      </div>
      <div className="mx-2 h-4 w-px bg-border" />
      <Button variant="neutral" size="sm" onClick={onCreateListFromSelection}>
        <ListPlus className="h-3.5 w-3.5" /> Criar lista
      </Button>
      <Button variant="neutral" size="sm" onClick={onAddTagToSelection}>
        <Tag className="h-3.5 w-3.5" /> Tag
      </Button>
      <Button variant="neutral" size="sm" onClick={() => onToggleOptOut(true)}>
        <Ban className="h-3.5 w-3.5" /> Marcar opt-out
      </Button>
      <Button variant="neutral" size="sm" onClick={() => onToggleOptOut(false)}>
        <CheckCheck className="h-3.5 w-3.5" /> Liberar opt-out
      </Button>
      <Button variant="danger" size="sm" onClick={onDeleteSelection}>
        <X className="h-3.5 w-3.5" /> Remover
      </Button>
      <div className="ml-auto">
        <Button variant="ghost" size="sm" onClick={onClearSelection}>
          Limpar seleção
        </Button>
      </div>
    </div>
  );
}
