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
import { useAppStore } from "@/lib/store";
import { api } from "@/lib/api";

interface CreateListDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initialName?: string;
}

export function CreateListDialog({
  open,
  onOpenChange,
  initialName = "",
}: CreateListDialogProps) {
  const [name, setName] = useState(initialName);
  const [color, setColor] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const upsert = useAppStore((s) => s.upsertContactList);

  const onSubmit = async () => {
    if (!name.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }
    setSubmitting(true);
    try {
      const list = await api.contactLists.create({
        name: name.trim(),
        color,
      });
      upsert(list);
      toast.success(`Lista "${list.name}" criada`);
      setName("");
      setColor(null);
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || "Falha ao criar lista");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova lista</DialogTitle>
          <DialogDescription>
            Listas agrupam contatos para facilitar filtros e ações em massa.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="list-name">Nome</Label>
            <Input
              id="list-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: VIP, Black Friday, Inadimplentes"
              autoFocus
            />
          </div>
          <div>
            <Label htmlFor="list-color">Cor (opcional)</Label>
            <Input
              id="list-color"
              type="color"
              value={color || "#1f9d65"}
              onChange={(e) => setColor(e.target.value)}
              className="h-10 w-20 p-1"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="neutral" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={onSubmit} disabled={submitting}>
            {submitting ? "Criando…" : "Criar lista"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
