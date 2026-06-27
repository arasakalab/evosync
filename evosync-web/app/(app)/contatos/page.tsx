"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Users,
  FileUp,
  Download,
  UserPlus,
  Trash2,
  Eraser,
  Search,
  Loader2,
  AlertTriangle,
  Hash,
  Link2,
  Check,
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
import { useAppStore } from "@/lib/store";
import { api } from "@/lib/api";
import type { Contact, ContactFilters } from "@/lib/types";
import { cn, onlyDigits } from "@/lib/utils";
import { clientPublicAppUrl } from "@/lib/app-url";

import { ContactModeToggle } from "@/components/contact-mode-toggle";
import { ContactsHeaderStats } from "@/components/contacts/contacts-header-stats";
import { ContactsSendPanel } from "@/components/contacts/contacts-send-panel";
import { TagChips } from "@/components/tag-chips";
import { ListChips } from "@/components/list-chips";
import { BulkActionBar } from "@/components/bulk-action-bar";
import { OptOutBadge } from "@/components/opt-out-badge";
import { CreateListDialog } from "@/components/create-list-dialog";
import { AddTagDialog } from "@/components/add-tag-dialog";
import { refetchContactsWithActiveFilters } from "@/lib/contacts-refetch";

const SELECTION_SYNC_DEBOUNCE_MS = 300;
const SEARCH_DEBOUNCE_MS = 300;

export default function ContatosPage() {
  const searchParams = useSearchParams();
  const contacts = useAppStore((s) => s.contacts);
  const setContacts = useAppStore((s) => s.setContacts);
  const contactsCount = useAppStore((s) => s.contactsCount);
  const mode = useAppStore((s) => s.contactsMode);
  const setMode = useAppStore((s) => s.setContactsMode);
  const tagFilter = useAppStore((s) => s.contactsTagFilter);
  const setTagFilter = useAppStore((s) => s.setContactsTagFilter);
  const listFilter = useAppStore((s) => s.contactsListFilter);
  const setListFilter = useAppStore((s) => s.setContactsListFilter);
  const search = useAppStore((s) => s.contactsSearch);
  const setSearch = useAppStore((s) => s.setContactsSearch);

  const selectedIds = useAppStore((s) => s.selectedIds);
  const toggleSelected = useAppStore((s) => s.toggleSelected);
  const selectMany = useAppStore((s) => s.selectMany);
  const clearSelection = useAppStore((s) => s.clearSelection);
  const setSelectedIds = useAppStore((s) => s.setSelectedIds);
  const selectionLoaded = useAppStore((s) => s.selectionLoaded);

  const contactLists = useAppStore((s) => s.contactLists);
  const setContactLists = useAppStore((s) => s.setContactLists);
  const tenantSlug = useAppStore((s) => s.settings.slug);

  const [importingWa, setImportingWa] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [createListOpen, setCreateListOpen] = useState(false);
  const [addTagOpen, setAddTagOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (searchParams.get("panel") === "send" && mode !== "selected") {
      setMode("selected");
    }
  }, [searchParams, mode, setMode]);

  const copySignupLink = async () => {
    if (!tenantSlug) return;
    const link = clientPublicAppUrl(`/c/${tenantSlug}`);
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast.success("Link copiado!", { description: link });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Não foi possível copiar. Selecione e copie manualmente:", {
        description: link,
      });
    }
  };

  // Carrega a lista inicial (catálogo) e hidrata listas
  useEffect(() => {
    (async () => {
      try {
        const r = await api.contacts.list();
        setContacts(r.contacts, { count: r.count, filteredCount: r.filteredCount });
      } catch {
        /* silencioso */
      }
      try {
        const lists = await api.contactLists.list();
        setContactLists(lists);
      } catch {
        /* silencioso */
      }
      // Carrega seleção persistida
      try {
        const sel = await api.contacts.getSelection();
        setSelectedIds(sel.ids);
      } catch {
        /* silencioso */
      } finally {
        useAppStore.getState().setSelectionLoaded(true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refetch quando filtros/modo mudam
  useEffect(() => {
    if (!selectionLoaded) return;
    const filters: ContactFilters = {
      q: debouncedSearch || undefined,
      mode: mode === "all" ? undefined : mode,
      tag: tagFilter || undefined,
      list: listFilter || undefined,
    };
    (async () => {
      try {
        const r = await api.contacts.list(filters);
        setContacts(r.contacts, { count: r.count, filteredCount: r.filteredCount });
      } catch {
        /* silencioso */
      }
    })();
  }, [mode, tagFilter, listFilter, debouncedSearch, selectionLoaded, setContacts]);

  // Sincroniza seleção com backend (debounced)
  useEffect(() => {
    if (!selectionLoaded) return;
    const t = setTimeout(() => {
      api.contacts
        .setSelection(Array.from(selectedIds))
        .catch(() => {
          /* silencioso — seleção é otimista */
        });
    }, SELECTION_SYNC_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [selectedIds, selectionLoaded]);

  // Tags derivadas do catálogo (para os chips)
  const tagFacets = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of contacts) {
      for (const t of c.tags || []) {
        map.set(t, (map.get(t) || 0) + 1);
      }
    }
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [contacts]);

  const selectedCount = selectedIds.size;

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
          await refetchContactsWithActiveFilters();
          toast.success(
            `${r.added} adicionados · ${r.updated} atualizados · ${r.skipped} inalterados (total ${r.total})`
          );
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
      await refetchContactsWithActiveFilters();
      toast.success(
        `WhatsApp: ${r.added} novos · ${r.updated} atualizados · ${r.existed} já existiam`
      );
    } catch (e: any) {
      toast.error(e?.message || "Falha ao importar do WhatsApp");
    } finally {
      setImportingWa(false);
    }
  };

  const onDeleteSelection = async () => {
    if (!selectedCount) return;
    try {
      // PATCH backend remove selection → API por id
      const ids = Array.from(selectedIds);
      await Promise.all(ids.map((id) => api.contacts.remove(id).catch(() => null)));
      clearSelection();
      await refetchContactsWithActiveFilters();
      toast.success(`${ids.length} contato(s) removido(s)`);
    } catch (e: any) {
      toast.error(e?.message || "Falha ao remover");
    } finally {
      setConfirmRemove(false);
    }
  };

  const onClear = async () => {
    try {
      await api.contacts.clear();
      clearSelection();
      setContacts([], { count: 0, filteredCount: 0 });
      toast.success("Lista limpa");
    } catch (e: any) {
      toast.error(e?.message || "Falha ao limpar");
    } finally {
      setConfirmClear(false);
    }
  };

  const onSelectAllVisible = () => {
    const ids = contacts.filter((c) => !c.opt_out).map((c) => c.id);
    const allSelected = ids.every((id) => selectedIds.has(id));
    if (allSelected) {
      // Remove visíveis
      selectMany(ids, false);
    } else {
      // Adiciona visíveis
      selectMany(ids, true);
    }
  };

  const onCreateListFromSelection = async () => {
    setCreateListOpen(true);
  };

  const onAddTagToSelection = () => {
    setAddTagOpen(true);
  };

  const onToggleOptOut = async (optOut: boolean) => {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    // PATCH em paralelo (sem endpoint bulk dedicado; volume razoável aqui)
    await Promise.all(
      ids.map((id) =>
        api.contacts.update(id, { opt_out: optOut }).catch(() => null)
      )
    );
    await refetchContactsWithActiveFilters();
    toast.success(
      optOut
        ? `${ids.length} marcado(s) como opt-out`
        : `${ids.length} liberado(s) do opt-out`
    );
  };

  // Quando uma lista é criada, já popula com a seleção atual
  const onListCreated = async (listId: string) => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    try {
      await api.contactLists.addMembers(listId, ids);
      // Atualiza memberCount
      const lists = await api.contactLists.list();
      setContactLists(lists);
      toast.success(
        `Lista criada com ${ids.length} contato(s) da seleção`
      );
    } catch (e: any) {
      toast.error(e?.message || "Falha ao popular lista");
    }
  };

  // Wrapper que abre o diálogo, e ao criar popula com a seleção
  const [pendingListId, setPendingListId] = useState<string | null>(null);
  useEffect(() => {
    if (pendingListId) {
      onListCreated(pendingListId).finally(() => setPendingListId(null));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contactLists, pendingListId]);

  const refreshAfterTag = async () => {
    await refetchContactsWithActiveFilters();
  };

  return (
    <div className="space-y-4">
      {/* Header + contador inteligente */}
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="section-title flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" />
            Contatos
          </h1>
          <p className="section-subtitle">
            Catálogo persistente. Marque quem receberá a próxima campanha — desmarcados nunca recebem.
          </p>
        </div>
        <ContactsHeaderStats />
      </header>

      <ContactsSendPanel
        onViewSelected={() => setMode("selected")}
        onClearSelection={clearSelection}
      />

      {/* Catálogo */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <ContactModeToggle />
        <div className="flex items-center gap-2 flex-wrap">
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
          <Button
            variant="blue"
            onClick={onImportWhatsapp}
            disabled={importingWa}
          >
            {importingWa ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Importar WhatsApp
          </Button>
          <Button
            variant="outline"
            onClick={copySignupLink}
            disabled={!tenantSlug}
            title={
              tenantSlug
                ? `Copiar link público: /c/${tenantSlug}`
                : "Carregando…"
            }
          >
            {copied ? (
              <Check className="h-4 w-4 text-success" />
            ) : (
              <Link2 className="h-4 w-4" />
            )}
            Copiar link de cadastro
          </Button>
          <Button variant="neutral" onClick={() => setShowAdd(true)}>
            <UserPlus className="h-4 w-4" /> Adicionar
          </Button>
          <Button
            variant="danger"
            disabled={!contactsCount}
            onClick={() => setConfirmClear(true)}
          >
            <Eraser className="h-4 w-4" /> Limpar tudo
          </Button>
        </div>
      </div>

      {/* Busca */}
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

      {/* Filtros por tag e lista */}
      {(tagFacets.length > 0 || contactLists.length > 0) && (
        <div className="space-y-2">
          <TagChips
            tags={tagFacets}
            active={tagFilter}
            onSelect={setTagFilter}
          />
          <ListChips onCreateClick={() => setCreateListOpen(true)} />
        </div>
      )}

      {/* Barra de ação em massa */}
      <BulkActionBar
        visible={selectedCount > 0}
        onClearSelection={clearSelection}
        onCreateListFromSelection={onCreateListFromSelection}
        onAddTagToSelection={onAddTagToSelection}
        onToggleOptOut={onToggleOptOut}
        onDeleteSelection={() => setConfirmRemove(true)}
      />

      {/* Tabela */}
      <Card>
        <CardContent className="p-0">
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5 text-xs text-muted">
            <div>
              {contactsCount === 0
                ? "Nenhum contato carregado. Importe um CSV, busque no WhatsApp ou adicione manualmente."
                : mode === "selected" && selectedCount === 0
                ? "Nenhum contato marcado para envio. Volte ao catálogo e marque os desejados."
                : search || tagFilter || listFilter
                ? "Filtros aplicados. Use a barra de ação em massa ou marque linhas para selecionar."
                : "Selecione linhas para adicionar à campanha."}
            </div>
            {contactsCount > 0 && (
              <button
                className="text-primary hover:underline"
                onClick={onSelectAllVisible}
              >
                {contacts.every((c) => selectedIds.has(c.id)) && contacts.length > 0
                  ? "Limpar seleção (visíveis)"
                  : "Selecionar visíveis"}
              </button>
            )}
          </div>

          {contacts.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-muted">
              <Users className="h-10 w-10 opacity-40" />
              <p className="text-sm">
                {contactsCount === 0
                  ? "Sem contatos ainda"
                  : "Nenhum contato corresponde ao filtro"}
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
                    <th className="px-3 py-2.5 font-semibold">Nome</th>
                    <th className="px-3 py-2.5 font-semibold">Tags</th>
                    <th className="px-3 py-2.5 font-semibold">Listas</th>
                    <th className="px-3 py-2.5 font-semibold">Opt-out</th>
                    <th className="px-3 py-2.5 font-semibold">Campos extras</th>
                  </tr>
                </thead>
                <tbody>
                  {contacts.map((c) => {
                    const isSel = selectedIds.has(c.id);
                    return (
                      <tr
                        key={c.id}
                        className={cn(
                          "border-b border-border/60 transition-colors hover:bg-neutral/30 cursor-pointer",
                          isSel && "bg-primary/10",
                          c.opt_out && "opacity-60"
                        )}
                        onClick={() => !c.opt_out && toggleSelected(c.id)}
                      >
                        <td className="px-3 py-2.5">
                          <input
                            type="checkbox"
                            checked={isSel}
                            disabled={c.opt_out}
                            title={
                              c.opt_out
                                ? "Opt-out — não pode ser marcado para envio"
                                : undefined
                            }
                            onChange={() => !c.opt_out && toggleSelected(c.id)}
                            onClick={(e) => e.stopPropagation()}
                            className="h-4 w-4 rounded border-border bg-[#0d1713] accent-primary disabled:opacity-40"
                          />
                        </td>
                        <td className="px-3 py-2.5 font-mono text-text">
                          {c.number}
                        </td>
                        <td className="px-3 py-2.5 text-text">
                          {c.name || (
                            <span className="text-muted/60">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex flex-wrap gap-1">
                            {(c.tags || []).slice(0, 3).map((t) => (
                              <span
                                key={t}
                                className="inline-flex items-center gap-0.5 rounded bg-panel-alt px-1.5 py-0.5 text-[11px] text-muted"
                              >
                                <Hash className="h-2.5 w-2.5" />
                                {t}
                              </span>
                            ))}
                            {(c.tags || []).length > 3 && (
                              <span className="text-[11px] text-muted">
                                +{c.tags.length - 3}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-muted text-xs">
                          {(c.lists || []).length > 0
                            ? (c.lists || [])
                                .map(
                                  (id) =>
                                    contactLists.find((l) => l.id === id)
                                      ?.name || id.slice(0, 6)
                                )
                                .join(", ")
                            : "—"}
                        </td>
                        <td className="px-3 py-2.5">
                          <OptOutBadge value={!!c.opt_out} />
                        </td>
                        <td className="px-3 py-2.5 text-muted text-xs">
                          {Object.entries(c.fields || {})
                            .slice(0, 4)
                            .map(([k, v]) => (
                              <span
                                key={k}
                                className="mr-2 inline-flex items-center gap-1"
                              >
                                <span className="text-muted/70">{k}=</span>
                                <span className="text-text/90">
                                  {v || "—"}
                                </span>
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
        Contatos com opt-out são automaticamente pulados em qualquer disparo.
        Reimportar CSV não reseta opt-out nem tags do operador.
      </p>

      {/* Diálogos */}
      <AddContactDialog
        open={showAdd}
        onOpenChange={setShowAdd}
        onAdded={async () => {
          await refetchContactsWithActiveFilters();
        }}
      />

      <CreateListDialog
        open={createListOpen}
        onOpenChange={(v) => {
          setCreateListOpen(v);
          if (!v) {
            // Ao fechar (após criar), recarrega listas e popula
            // O upsertContactList já fez. Aqui disparamos onListCreated:
            const last = useAppStore.getState().contactLists.slice(-1)[0];
            if (last && useAppStore.getState().selectedIds.size > 0) {
              setPendingListId(last.id);
            }
          }
        }}
      />

      <AddTagDialog
        open={addTagOpen}
        onOpenChange={setAddTagOpen}
        contactIds={Array.from(selectedIds)}
        onApplied={refreshAfterTag}
      />

      <AlertDialog open={confirmClear} onOpenChange={setConfirmClear}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Limpar contatos</AlertDialogTitle>
            <AlertDialogDescription>
              Limpar toda a lista de contatos? Esta ação não pode ser desfeita.
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

      <AlertDialog open={confirmRemove} onOpenChange={setConfirmRemove}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover contatos</AlertDialogTitle>
            <AlertDialogDescription>
              Remover {selectedCount} contato(s) selecionado(s)? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={onDeleteSelection}
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
  onAdded,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onAdded: () => void;
}) {
  const [number, setNumber] = useState("");
  const [name, setName] = useState("");
  const [tagsText, setTagsText] = useState("");
  const [optOut, setOptOut] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setNumber("");
      setName("");
      setTagsText("");
      setOptOut(false);
    }
  }, [open]);

  const onSubmit = async () => {
    if (!number.trim()) {
      toast.error("Número é obrigatório");
      return;
    }
    setSubmitting(true);
    try {
      const tags = tagsText
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      await api.contacts.add({
        number: number.trim(),
        name: name.trim() || null,
        fields: {},
        tags,
        opt_out: optOut,
      });
      toast.success("Contato adicionado");
      onOpenChange(false);
      onAdded();
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
            Adicione um contato manualmente ao catálogo.
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
              autoFocus
            />
          </div>
          <div>
            <Label htmlFor="nome">Nome (opcional)</Label>
            <Input
              id="nome"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: João Silva"
            />
          </div>
          <div>
            <Label htmlFor="tags">Tags (opcional, separadas por vírgula)</Label>
            <Input
              id="tags"
              value={tagsText}
              onChange={(e) => setTagsText(e.target.value)}
              placeholder="Ex: vip, lead-quente"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-muted">
            <input
              type="checkbox"
              checked={optOut}
              onChange={(e) => setOptOut(e.target.checked)}
              className="h-4 w-4 rounded border-border bg-[#0d1713] accent-primary"
            />
            Marcar como opt-out (nunca enviar)
          </label>
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
