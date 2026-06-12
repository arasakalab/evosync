"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Users,
  FileUp,
  Download,
  UserPlus,
  Trash2,
  Eraser,
  Search,
  Loader2,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import Papa from "papaparse";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useAppStore } from "@/lib/store";
import { api } from "@/lib/api";
import type { Contact } from "@/lib/types";
import { cn, onlyDigits } from "@/lib/utils";

export default function ContatosPage() {
  const contacts = useAppStore((s) => s.contacts);
  const setContacts = useAppStore((s) => s.setContacts);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [showAdd, setShowAdd] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [importingWa, setImportingWa] = useState(false);
  const [csvColumns, setCsvColumns] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSelected(new Set());
  }, [contacts.length]);

  useEffect(() => {
    const cols = new Set<string>(["numero"]);
    for (const c of contacts) {
      for (const k of Object.keys(c.fields || {})) cols.add(k);
    }
    setCsvColumns(Array.from(cols));
  }, [contacts]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const digits = onlyDigits(search);
    if (!term) return contacts;
    return contacts.filter((c) => {
      const haystack = [
        c.number,
        ...Object.entries(c.fields || {}).flatMap(([k, v]) => [k, v]),
      ]
        .join(" ")
        .toLowerCase();
      const digitsN = onlyDigits(c.number);
      if (term && haystack.includes(term)) return true;
      if (digits && digitsN.includes(digits)) return true;
      return false;
    });
  }, [contacts, search]);

  const onImportCsv = async (file: File) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (res) => {
        const rows = (res.data || []) as Record<string, string>[];
        if (!rows.length) {
          toast.error("CSV vazio");
          return;
        }
        const cols = Object.keys(rows[0] || {});
        if (!cols.some((c) => c.toLowerCase() === "numero")) {
          toast.error("CSV inválido — precisa ter coluna 'numero'");
          return;
        }
        try {
          const r = await api.contacts.importCsv(rows);
          const all = await api.contacts.list();
          setContacts(all.contacts);
          toast.success(`${r.added} contatos importados (${r.total} no total)`);
        } catch (e: any) {
          toast.error(e?.message || "Falha ao importar");
        }
      },
      error: (err) => toast.error("Erro ao ler CSV: " + err.message),
    });
  };

  const onImportWhatsapp = async () => {
    setImportingWa(true);
    try {
      const r = await api.contacts.importWhatsapp();
      const all = await api.contacts.list();
      setContacts(all.contacts);
      toast.success(
        `Total: ${r.found} · Novos: ${r.added} · Já existiam: ${r.existed}`
      );
    } catch (e: any) {
      toast.error(e?.message || "Falha ao importar do WhatsApp");
    } finally {
      setImportingWa(false);
    }
  };

  const onRemove = async () => {
    const numbers = Array.from(selected).map((i) => contacts[i].number);
    if (!numbers.length) return;
    try {
      const r = await api.contacts.remove(numbers);
      const all = await api.contacts.list();
      setContacts(all.contacts);
      toast.success(`${r.removed} contato(s) removido(s)`);
    } catch (e: any) {
      toast.error(e?.message || "Falha ao remover");
    } finally {
      setConfirmRemove(false);
    }
  };

  const onClear = async () => {
    try {
      await api.contacts.clear();
      setContacts([]);
      toast.success("Lista limpa");
    } catch (e: any) {
      toast.error(e?.message || "Falha ao limpar");
    } finally {
      setConfirmClear(false);
    }
  };

  const onSelectAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((_, i) => contacts.indexOf(_))));
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="section-title flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" />
            Contatos
          </h1>
          <p className="section-subtitle">
            Importe listas, puxe contatos da instância ou adicione números manualmente.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-sm px-3 py-1">
            {filtered.length === contacts.length
              ? `${contacts.length} contatos`
              : `${filtered.length}/${contacts.length} contatos`}
          </Badge>
        </div>
      </header>

      <Card>
        <CardContent className="pt-6 flex flex-wrap items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onImportCsv(f);
              e.target.value = "";
            }}
          />
          <Button onClick={() => fileInputRef.current?.click()}>
            <FileUp className="h-4 w-4" /> Importar CSV
          </Button>
          <Button variant="blue" onClick={onImportWhatsapp} disabled={importingWa}>
            {importingWa ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Importar WhatsApp
          </Button>
          <Button variant="neutral" onClick={() => setShowAdd(true)}>
            <UserPlus className="h-4 w-4" /> Adicionar
          </Button>
          <Button
            variant="neutral"
            disabled={!selected.size}
            onClick={() => setConfirmRemove(true)}
          >
            <Trash2 className="h-4 w-4" /> Remover
          </Button>
          <Button
            variant="danger"
            disabled={!contacts.length}
            onClick={() => setConfirmClear(true)}
          >
            <Eraser className="h-4 w-4" /> Limpar
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <Search className="h-4 w-4 text-muted" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Pesquisar por nome, número ou campo extra..."
              className="flex-1"
            />
            {search && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSearch("")}
                className="text-muted"
              >
                Limpar busca
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5 text-xs text-muted">
            <div>
              {contacts.length === 0
                ? "Nenhum contato carregado. Importe um CSV, busque no WhatsApp ou adicione manualmente."
                : search
                ? "Busca aplicada. Selecione uma ou mais linhas filtradas para remover contatos."
                : "Selecione uma ou mais linhas para remover contatos antes do disparo."}
            </div>
            {contacts.length > 0 && (
              <button
                className="text-primary hover:underline"
                onClick={onSelectAll}
              >
                {selected.size === filtered.length && filtered.length > 0
                  ? "Limpar seleção"
                  : "Selecionar todos (visíveis)"}
              </button>
            )}
          </div>

          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-muted">
              <Users className="h-10 w-10 opacity-40" />
              <p className="text-sm">
                {contacts.length === 0
                  ? "Sem contatos ainda"
                  : "Nenhum contato corresponde à busca"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto max-h-[60vh]">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10 bg-panel-alt">
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted">
                    <th className="w-10 px-3 py-2.5">
                      <span className="sr-only">Selecionar</span>
                    </th>
                    <th className="px-3 py-2.5 font-semibold">Número</th>
                    <th className="px-3 py-2.5 font-semibold">Campos extras</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c, idx) => {
                    const realIdx = contacts.indexOf(c);
                    const isSel = selected.has(realIdx);
                    return (
                      <tr
                        key={`${c.number}-${realIdx}`}
                        className={cn(
                          "border-b border-border/60 transition-colors hover:bg-neutral/30",
                          isSel && "bg-primary/10"
                        )}
                        onClick={() => {
                          setSelected((prev) => {
                            const next = new Set(prev);
                            if (next.has(realIdx)) next.delete(realIdx);
                            else next.add(realIdx);
                            return next;
                          });
                        }}
                      >
                        <td className="px-3 py-2.5">
                          <input
                            type="checkbox"
                            checked={isSel}
                            onChange={() => {}}
                            className="h-4 w-4 rounded border-border bg-[#0d1713] accent-primary"
                          />
                        </td>
                        <td className="px-3 py-2.5 font-mono text-text">
                          {c.number}
                        </td>
                        <td className="px-3 py-2.5 text-muted">
                          {Object.entries(c.fields || {})
                            .slice(0, 4)
                            .map(([k, v]) => (
                              <span
                                key={k}
                                className="mr-2 inline-flex items-center gap-1"
                              >
                                <span className="text-muted/70">{k}=</span>
                                <span className="text-text/90">{v || "—"}</span>
                              </span>
                            ))}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted">
        <AlertTriangle className="inline h-3 w-3 mr-1 -mt-0.5" />
        Pressione Delete após selecionar linhas para remover rapidamente.
      </p>

      {/* Diálogo: adicionar */}
      <AddContactDialog
        open={showAdd}
        onOpenChange={setShowAdd}
        columns={csvColumns}
        onAdded={(c) => {
          setContacts([...contacts, c]);
        }}
      />

      {/* Confirmação: limpar */}
      <AlertDialog open={confirmClear} onOpenChange={setConfirmClear}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Limpar contatos</AlertDialogTitle>
            <AlertDialogDescription>
              Limpar toda a lista de contatos carregada na tela?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={onClear}
              className="bg-danger text-white hover:bg-danger-hover"
            >
              Limpar tudo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmação: remover selecionados */}
      <AlertDialog open={confirmRemove} onOpenChange={setConfirmRemove}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover contatos</AlertDialogTitle>
            <AlertDialogDescription>
              Remover {selected.size} contato(s) selecionado(s)?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={onRemove}
              className="bg-danger text-white hover:bg-danger-hover"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function AddContactDialog({
  open,
  onOpenChange,
  columns,
  onAdded,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  columns: string[];
  onAdded: (c: Contact) => void;
}) {
  const [number, setNumber] = useState("");
  const [extras, setExtras] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setNumber("");
      setExtras({});
    }
  }, [open]);

  const extraCols = columns.filter((c) => c.toLowerCase() !== "numero");

  const onSubmit = async () => {
    if (!number.trim()) {
      toast.error("Número é obrigatório");
      return;
    }
    setSubmitting(true);
    try {
      const fields: Record<string, string> = {};
      for (const [k, v] of Object.entries(extras)) {
        if (v.trim()) fields[k] = v.trim();
      }
      const created = await api.contacts.add({ number: number.trim(), fields });
      onAdded(created);
      toast.success("Contato adicionado");
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || "Falha ao adicionar");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adicionar contato</DialogTitle>
          <DialogDescription>
            Informe o número e os campos extras opcionais.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label htmlFor="numero">Número com DDD</Label>
            <Input
              id="numero"
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              placeholder="5511999990001"
              className="font-mono"
            />
          </div>
          {extraCols.length > 0 && (
            <>
              <p className="text-xs text-muted">
                Campos extras detectados no CSV atual:
              </p>
              {extraCols.map((col) => (
                <div key={col}>
                  <Label htmlFor={col}>{col}</Label>
                  <Input
                    id={col}
                    value={extras[col] || ""}
                    onChange={(e) =>
                      setExtras((p) => ({ ...p, [col]: e.target.value }))
                    }
                    placeholder={col}
                  />
                </div>
              ))}
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="neutral" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={onSubmit} disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Adicionar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
