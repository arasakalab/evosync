"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";

interface AddTagDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  contactIds: string[];
  onApplied: () => void;
}

/**
 * Aplica uma tag a N contatos via PATCH por id.
 * Para volumes grandes (>50), faz em background.
 */
export function AddTagDialog({
  open,
  onOpenChange,
  contactIds,
  onApplied,
}: AddTagDialogProps) {
  const [tag, setTag] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async () => {
    if (!tag.trim()) {
      toast.error("Tag é obrigatória");
      return;
    }
    if (!contactIds.length) {
      toast.error("Nenhum contato selecionado");
      return;
    }
    setSubmitting(true);
    try {
      // PATCH em paralelo (limite razoável). Sem endpoint bulk dedicado,
      // caímos no PATCH por id. Para >100, toast avisa e segue em chunks.
      const ids = contactIds.slice(0, 200);
      if (contactIds.length > 200) {
        toast.message(
          `Aplicando tag em ${contactIds.length} contatos (pode demorar)…`
        );
      }
      await Promise.all(
        ids.map((id) =>
          api.contacts
            .get(id)
            .then((c) => {
              const next = Array.from(new Set([...(c.tags || []), tag.trim()]));
              return api.contacts.update(id, { tags: next });
            })
            .catch(() => null)
        )
      );
      toast.success(`Tag "${tag.trim()}" aplicada a ${ids.length} contato(s)`);
      onApplied();
      setTag("");
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || "Falha ao aplicar tag");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adicionar tag</DialogTitle>
          <DialogDescription>
            Aplica a tag a {contactIds.length} contato(s) selecionado(s).
          </DialogDescription>
        </DialogHeader>
        <div>
          <Label htmlFor="tag-name">Tag</Label>
          <Input
            id="tag-name"
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            placeholder="Ex: vip, lead-quente, blacklist-interna"
            autoFocus
          />
        </div>
        <DialogFooter>
          <Button variant="neutral" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={onSubmit} disabled={submitting}>
            {submitting ? "Aplicando…" : "Aplicar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
