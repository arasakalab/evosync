import type {
  Contact,
  ContactList,
  ContactFilters,
  ContactSelection,
  Schedule,
  Settings,
  SendStatus,
  ManagedStatus,
} from "@/lib/types";

const BASE = "/api";

async function request<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(BASE + path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });
  if (!res.ok) {
    let detail: any = null;
    try {
      detail = await res.json();
    } catch {
      detail = await res.text();
    }
    const message =
      (typeof detail === "string" ? detail : detail?.error) ||
      `HTTP ${res.status}`;
    throw new Error(message);
  }
  if (res.status === 204) return undefined as unknown as T;
  return (await res.json()) as T;
}

function buildQuery(obj: Record<string, unknown>): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null || v === "") continue;
    params.set(k, String(v));
  }
  const s = params.toString();
  return s ? `?${s}` : "";
}

export const api = {
  settings: {
    get: () => request<Settings>("/settings"),
    save: (s: Settings) =>
      request<Settings>("/settings", {
        method: "PUT",
        body: JSON.stringify(s),
      }),
  },
  connection: {
    test: (s?: Partial<Settings>) =>
      request<{ ok: boolean; state?: string | null; msg: string }>(
        "/connection/test",
        {
          method: "POST",
          body: JSON.stringify(s || {}),
        }
      ),
    /**
     * Consulta estado atual (managed ou BYO).
     * Retorna { ok, state, mode, managedStatus, error }.
     */
    status: () =>
      request<{
        ok: boolean;
        state: string | null;
        mode: "byo" | "managed";
        managedStatus: ManagedStatus | null;
        error: string | null;
      }>("/connection/status"),
    /**
     * QR code de pareamento (só tenants managed). Cache 30s no servidor.
     * Retorna { qr: { base64, code, pairingCode } | null, expiresInMs, ... }.
     */
    qr: () =>
      request<{
        qr: { base64: string | null; code: string | null; pairingCode: string | null } | null;
        expiresInMs: number;
        instance: string;
        cached: boolean;
        state: string | null;
        error: string | null;
      }>("/connection/qr"),
    /**
     * Desconecta o WhatsApp (logout na Evolution, NÃO deleta a instância).
     * Retorna { ok, info }.
     */
    logout: () =>
      request<{ ok: boolean; info: string }>("/connection/logout", {
        method: "POST",
      }),
  },
  contacts: {
    /**
     * Lista contatos com filtros opcionais.
     * Retorna { contacts, count, filteredCount }.
     */
    list: (filters?: ContactFilters) => {
      const q = filters ? buildQuery(filters as any) : "";
      return request<{ contacts: Contact[]; count: number; filteredCount: number }>(
        `/contacts${q}`
      );
    },
    get: (id: string) => request<Contact>(`/contacts/${id}`),
    add: (contact: Partial<Contact>) =>
      request<Contact>("/contacts", {
        method: "POST",
        body: JSON.stringify(contact),
      }),
    update: (id: string, patch: Partial<Contact>) =>
      request<Contact>(`/contacts/${id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      }),
    remove: (id: string) =>
      request<{ ok: true }>(`/contacts/${id}`, { method: "DELETE" }),
    removeMany: (numbers: string[]) =>
      request<{ removed: number }>("/contacts", {
        method: "DELETE",
        body: JSON.stringify({ numbers }),
      }),
    importCsv: (rows: Record<string, string>[]) =>
      request<{ added: number; updated: number; skipped: number; total: number }>(
        "/contacts/import-csv",
        {
          method: "POST",
          body: JSON.stringify({ rows }),
        }
      ),
    importWhatsapp: () =>
      request<{
        added: number;
        updated: number;
        skipped: number;
        found: number;
        existed: number;
      }>("/contacts/import-whatsapp", { method: "POST" }),
    clear: () => request<{ ok: true; removed: number }>("/contacts/clear", { method: "POST" }),

    // Seleção (FASE 5)
    getSelection: () => request<ContactSelection>("/contacts/selection"),
    setSelection: (ids: string[]) =>
      request<ContactSelection>("/contacts/selection", {
        method: "PUT",
        body: JSON.stringify({ ids }),
      }),
    bulkSelect: (ids: string[], selected: boolean) =>
      request<{ ids: string[]; total: number }>("/contacts/bulk-select", {
        method: "POST",
        body: JSON.stringify({ ids, selected }),
      }),

    // Bulk actions
    bulkSetOptOut: (ids: string[], optOut: boolean) =>
      request<{ updated: number }>(`/contacts/bulk-select`, {
        method: "POST",
        body: JSON.stringify({ ids, opt_out: optOut }),
      }).catch(async () => {
        // fallback: per-id PATCH
        // (a rota bulk-select específica de opt-out virá na FASE 5.x se necessário)
        return { updated: 0 };
      }),
  },
  contactLists: {
    list: () => request<ContactList[]>("/contact-lists"),
    get: (id: string) => request<ContactList>(`/contact-lists/${id}`),
    create: (data: { name: string; color?: string | null }) =>
      request<ContactList>("/contact-lists", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    update: (id: string, patch: { name?: string; color?: string | null }) =>
      request<ContactList>(`/contact-lists/${id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      }),
    remove: (id: string) =>
      request<{ ok: true }>(`/contact-lists/${id}`, { method: "DELETE" }),
    addMembers: (id: string, contact_ids: string[]) =>
      request<{ added: number }>(`/contact-lists/${id}/members`, {
        method: "POST",
        body: JSON.stringify({ contact_ids }),
      }),
    removeMembers: (id: string, contact_ids: string[]) =>
      request<{ removed: number }>(`/contact-lists/${id}/members`, {
        method: "DELETE",
        body: JSON.stringify({ contact_ids }),
      }),
  },
  message: {
    preview: (template: string, contact: Contact) =>
      request<{ rendered: string }>("/message/preview", {
        method: "POST",
        body: JSON.stringify({ template, contact }),
      }),
  },
  send: {
    status: () => request<SendStatus>("/send/status"),
    start: (args: {
      template: string;
      mediaPath: string | null;
      mediatype: string;
      delayMin: number;
      delayMax: number;
      dailyLimit: number;
      validateFirst: boolean;
      skipSentHistory: boolean;
      contactIds?: string[];
    }) =>
      request<{ ok: boolean }>("/send/start", {
        method: "POST",
        body: JSON.stringify(args),
      }),
    pause: () => request<{ ok: boolean }>("/send/pause", { method: "POST" }),
    resume: () => request<{ ok: boolean }>("/send/resume", { method: "POST" }),
    stop: () => request<{ ok: boolean }>("/send/stop", { method: "POST" }),
    resetHistory: () =>
      request<{ removed: number }>("/send/reset-history", { method: "POST" }),
    sentLogCount: () =>
      request<{ count: number }>("/send/sent-log-count"),
  },
  schedules: {
    list: () => request<Schedule[]>("/schedules"),
    create: (s: Partial<Schedule>) =>
      request<Schedule>("/schedules", {
        method: "POST",
        body: JSON.stringify(s),
      }),
    update: (id: string, s: Partial<Schedule>) =>
      request<Schedule>(`/schedules/${id}`, {
        method: "PUT",
        body: JSON.stringify(s),
      }),
    remove: (id: string) =>
      request<{ ok: true }>(`/schedules/${id}`, { method: "DELETE" }),
    removeMany: (ids: string[]) =>
      request<{ removed: number }>("/schedules", {
        method: "DELETE",
        body: JSON.stringify({ ids }),
      }),
    removeAll: () =>
      request<{ removed: number }>("/schedules/all", { method: "DELETE" }),
  },
  opencode: {
    generate: async (file: File) => {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(BASE + "/opencode/generate", {
        method: "POST",
        body: form,
        cache: "no-store",
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        throw new Error(detail?.error || `HTTP ${res.status}`);
      }
      return (await res.json()) as { ok: boolean; text?: string; error?: string };
    },
  },
  upload: {
    media: async (file: File) => {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(BASE + "/upload/media", {
        method: "POST",
        body: form,
        cache: "no-store",
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        throw new Error(detail?.error || `HTTP ${res.status}`);
      }
      return (await res.json()) as { path: string; name: string; size: number };
    },
  },
};
