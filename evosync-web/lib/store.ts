"use client";

import { create } from "zustand";
import type {
  LogEntry,
  SendStatus,
  Contact,
  Schedule,
  Settings,
} from "@/lib/types";

interface AppState {
  // Connection
  connection: { ok: boolean; state?: string | null; msg: string; checkedAt?: string };

  // Contacts
  contacts: Contact[];
  contactsCount: number;
  filteredContacts: Contact[];

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
  setContacts: (contacts: Contact[]) => void;
  setFilteredContacts: (contacts: Contact[]) => void;
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

export const useAppStore = create<AppState>((set) => ({
  connection: { ok: false, msg: "—", checkedAt: undefined },
  contacts: [],
  contactsCount: 0,
  filteredContacts: [],
  status: defaultStatus,
  logs: [],
  settings: defaultSettings,
  schedules: [],
  setConnection: (c) => set({ connection: c }),
  setContacts: (contacts) =>
    set({ contacts, contactsCount: contacts.length }),
  setFilteredContacts: (filteredContacts) => set({ filteredContacts }),
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
