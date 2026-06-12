export interface Contact {
  number: string;
  fields: Record<string, string>;
}

export type SendState = "idle" | "running" | "paused" | "stopped";

export interface SendStatus {
  state: SendState;
  total: number;
  sent: number;
  failed: number;
  pending: number;
  skipped: number;
  no_whatsapp: number;
  invalid: number;
  current_number: string;
  current_index: number;
  last_message: string;
  error: string;
  stage: string;
  limit_reached: boolean;
}

export interface Settings {
  url: string;
  api_key: string;
  instance: string;
  opencode_model: string;
  delay_min: number;
  delay_max: number;
  daily_limit: number;
  last_message: string;
  resend_sent: boolean;
}

export type ScheduleStatus =
  | "pending"
  | "running"
  | "sent"
  | "failed"
  | "missed"
  | "cancelled";

export type ContactMode = "snapshot" | "current";

export interface Schedule {
  id: string;
  tenantId?: string; // SaaS Phase 4 — populated when loaded from DB
  created_at: string;
  updated_at: string;
  scheduled_at: string;
  status: ScheduleStatus;
  message: string;
  media_path: string;
  media_type: string;
  delay_min: number;
  delay_max: number;
  daily_limit: number;
  validate_first: boolean;
  skip_sent_history: boolean;
  contact_mode: ContactMode;
  contacts: Contact[];
  error: string;
  summary: string;
}

export interface LogEntry {
  ts: string;
  line: string;
  level: "info" | "ok" | "warn" | "error" | "raw";
}

export type WsEvent =
  | { type: "status"; payload: SendStatus }
  | { type: "log"; payload: LogEntry }
  | { type: "progress"; payload: { percent: number; current: number; total: number } }
  | { type: "done"; payload: { summary: string; counts: SendStatus } }
  | { type: "conn"; payload: { ok: boolean; state?: string | null; msg: string } }
  | {
      type: "schedule_update";
      payload: { id: string; status: ScheduleStatus; error?: string };
    }
  | { type: "hello"; payload: { ts: string } };

export type WsClientEvent =
  | { type: "subscribe" }
  | { type: "ping" };
