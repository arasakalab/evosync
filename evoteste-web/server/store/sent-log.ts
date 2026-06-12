/**
 * Persistência do sent_log.json (histórico de números já enviados).
 * Port direto de sender_worker._load_sent_log / _save_sent_log.
 */
import fs from "node:fs";
import { SENT_LOG } from "@/server/paths";

export function loadSentLog(): Set<string> {
  if (!fs.existsSync(SENT_LOG)) return new Set();
  try {
    const data = JSON.parse(fs.readFileSync(SENT_LOG, "utf-8"));
    if (Array.isArray(data)) return new Set(data.map(String));
  } catch {
    /* noop */
  }
  return new Set();
}

export function saveSentLog(set: Set<string>): void {
  const arr = Array.from(set).sort();
  fs.writeFileSync(SENT_LOG, JSON.stringify(arr, null, 2), "utf-8");
}

export function sentLogCount(): number {
  if (!fs.existsSync(SENT_LOG)) return 0;
  try {
    const data = JSON.parse(fs.readFileSync(SENT_LOG, "utf-8"));
    if (Array.isArray(data)) return data.length;
  } catch {
    /* noop */
  }
  return 0;
}

export function resetSentLog(): number {
  const count = sentLogCount();
  try {
    if (fs.existsSync(SENT_LOG)) fs.unlinkSync(SENT_LOG);
  } catch {
    /* noop */
  }
  return count;
}
