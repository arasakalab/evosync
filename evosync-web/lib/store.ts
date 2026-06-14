"use client";

import { create } from "zustand";
import type {
  LogEntry,
  SendStatus,
  Contact,
  ContactList,
  Schedule,
  Settings,
} from "@/lib/types";

/**
 * Modo de visualização da tela de contatos.
 * - all: catálogo inteiro (exceto opt-out se o usuário filtrar)
 * - selected: apenas os marcados para envio
 * - opt_out: auditoria de quem pediu para sair
 */
export type ContactsViewMode = "all" | "selected" | "opt_out";

interface AppState {
  // Connection
  connection: { ok: boolean; state?: string | null; msg: string; checkedAt?: string };

  // Contacts (catálogo)
  contacts: Contact[];
  contactsCount: number; // total sem filtros
  filteredContactsCount: number; // total com filtros (sem LIMIT)

  // Contacts view state (FASE 5)
  contactsMode: ContactsViewMode;
  contactsTagFilter: string | null;
  contactsListFilter: string | null;
  contactsSearch: string;

  // Selection (FASE 5) — Set de IDs selecionados para envio
  selectedIds: Set<string>;
  selectionLoaded: boolean; // true após primeira sincronização com backend

  // Listas de contatos (FASE 5)
  contactLists: ContactList[];

  // Send job (live)
  status: SendStatus;

  // Logs (ring buffer)
  logs: LogEntry[];

  // Settings (UI mirror)
  settings: Settings;

  // Schedules
  schedules: Schedule[];

  // Setters
  setConnection: (c: AppState["connection"]) => void;
  setContacts: (contacts: Contact[], counts?: { count: number; filteredCount: number }) => void;
  setContactsMode: (mode: ContactsViewMode) => void;
  setContactsTagFilter: (tag: string | null) => void;
  setContactsListFilter: (listId: string | null) => void;
  setContactsSearch: (q: string) => void;

  // Selection actions (FASE 5)
  setSelectedIds: (ids: string[]) => void;
  toggleSelected: (id: string) => void;
  selectMany: (ids: string[], selected?: boolean) => void;
  clearSelection: () => void;
  setSelectionLoaded: (loaded: boolean) => void;

  // Lists
  setContactLists: (lists: ContactList[]) => void;
  upsertContactList: (list: ContactList) => void;
  removeContactList: (id: string) => void;

  setStatus: (s: SendStatus) => void;
  appendLog: (entry: LogEntry) => void;
  clearLogs: () => void;
  setSettings: (s: Settings) => void;
  setSchedules: (s: Schedule[]) => void;
  updateSchedule: (id: string, patch: Partial<Schedule>) => void;
}

const MAX_LOGS = 500;

const defaultStatus: SendStatus = {
  state: "idle",
  total: 0,
  sent: 0,
  failed: 0,
  pending: 0,
  skipped: 0,
  no_whatsapp: 0,
  invalid: 0,
  opt_out: 0,
  current_number: "",
  current_index: 0,
  last_message: "",
  error: "",
  stage: "",
  limit_reached: false,
};

const defaultSettings: Settings = {
  url: "http://localhost:8080",
  api_key: "",
  instance: "",
  opencode_model: "",
  delay_min: 8,
  delay_max: 25,
  daily_limit: 200,
  last_message: "",
  resend_sent: true,
};

export const useAppStore = create<AppState>((set, get) => ({
  connection: { ok: false, msg: "—", checkedAt: undefined },
  contacts: [],
  contactsCount: 0,
  filteredContactsCount: 0,
  contactsMode: "all",
  contactsTagFilter: null,
  contactsListFilter: null,
  contactsSearch: "",
  selectedIds: new Set<string>(),
  selectionLoaded: false,
  contactLists: [],
  status: defaultStatus,
  logs: [],
  settings: defaultSettings,
  schedules: [],

  setConnection: (c) => set({ connection: c }),

  setContacts: (contacts, counts) =>
    set({
      contacts,
      contactsCount: counts?.count ?? contacts.length,
      filteredContactsCount: counts?.filteredCount ?? contacts.length,
    }),

  setContactsMode: (mode) => set({ contactsMode: mode }),
  setContactsTagFilter: (tag) => set({ contactsTagFilter: tag }),
  setContactsListFilter: (listId) => set({ contactsListFilter: listId }),
  setContactsSearch: (q) => set({ contactsSearch: q }),

  setSelectedIds: (ids) => set({ selectedIds: new Set(ids) }),
  toggleSelected: (id) => {
    const next = new Set(get().selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    set({ selectedIds: next });
  },
  selectMany: (ids, selected = true) => {
    const next = new Set(get().selectedIds);
    for (const id of ids) {
      if (selected) next.add(id);
      else next.delete(id);
    }
    set({ selectedIds: next });
  },
  clearSelection: () => set({ selectedIds: new Set() }),
  setSelectionLoaded: (loaded) => set({ selectionLoaded: loaded }),

  setContactLists: (lists) => set({ contactLists: lists }),
  upsertContactList: (list) => {
    const exists = get().contactLists.find((l) => l.id === list.id);
    if (exists) {
      set({
        contactLists: get().contactLists.map((l) => (l.id === list.id ? list : l)),
      });
    } else {
      set({ contactLists: [...get().contactLists, list] });
    }
  },
  removeContactList: (id) =>
    set({ contactLists: get().contactLists.filter((l) => l.id !== id) }),

  setStatus: (status) => set({ status }),
  appendLog: (entry) =>
    set((s) => {
      const next = [...s.logs, entry];
      if (next.length > MAX_LOGS) next.splice(0, next.length - MAX_LOGS);
      return { logs: next };
    }),
  clearLogs: () => set({ logs: [] }),
  setSettings: (settings) => set({ settings }),
  setSchedules: (schedules) => set({ schedules }),
  updateSchedule: (id, patch) =>
    set((s) => ({
      schedules: s.schedules.map((x) => (x.id === id ? { ...x, ...patch } : x)),
    })),
}));
