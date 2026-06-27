import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function onlyDigits(s: string): string {
  return (s || "").replace(/\D+/g, "");
}

export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

/** Nome do arquivo a partir do path absoluto gravado no upload. */
export function mediaFileName(mediaPath: string): string | null {
  const name = mediaPath.trim().split(/[\\/]/).pop();
  return name || null;
}

/** URL autenticada para pré-visualizar mídia em uploads/. */
export function mediaPreviewUrl(mediaPath: string): string | null {
  const name = mediaFileName(mediaPath);
  if (!name) return null;
  return `/api/upload/media/file?f=${encodeURIComponent(name)}`;
}

/** Rótulo amigável do estado WhatsApp no header. */
export function formatConnectionState(
  ok: boolean,
  state?: string | null
): string {
  if (!ok) return "—";
  if (state === "open") return "Conectado";
  if (state === "connecting") return "Conectando…";
  if (state === "close") return "Desconectado";
  return state || "OK";
}
