import type { Contact, Schedule, Settings, SendStatus } from "@/lib/types";

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
  },
  contacts: {
    list: () =>
      request<{ contacts: Contact[]; count: number }>("/contacts"),
    importCsv: (rows: Record<string, string>[]) =>
      request<{ added: number; total: number }>("/contacts/import-csv", {
        method: "POST",
        body: JSON.stringify({ rows }),
      }),
    importWhatsapp: () =>
      request<{ added: number; found: number; existed: number }>(
        "/contacts/import-whatsapp",
        { method: "POST" }
      ),
    add: (contact: Contact) =>
      request<Contact>("/contacts", {
        method: "POST",
        body: JSON.stringify(contact),
      }),
    remove: (numbers: string[]) =>
      request<{ removed: number }>("/contacts", {
        method: "DELETE",
        body: JSON.stringify({ numbers }),
      }),
    clear: () => request<{ ok: true }>("/contacts/clear", { method: "POST" }),
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
