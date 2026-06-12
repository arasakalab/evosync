/**
 * Persistência da lista de contatos (persisted_contacts.json).
 * Port direto de contacts_store.py.
 */
import fs from "node:fs";
import { CONTACTS_FILE } from "@/server/paths";
import type { Contact } from "@/lib/types";

export function loadContacts(): Contact[] {
  if (!fs.existsSync(CONTACTS_FILE)) return [];
  try {
    const data = JSON.parse(fs.readFileSync(CONTACTS_FILE, "utf-8"));
    if (!Array.isArray(data)) return [];
    const out: Contact[] = [];
    for (const item of data) {
      if (!item || typeof item !== "object") continue;
      const number = String(item.number || "").trim();
      if (!number) continue;
      const fields =
        item.fields && typeof item.fields === "object" ? item.fields : {};
      out.push({ number, fields });
    }
    return out;
  } catch {
    return [];
  }
}

export function saveContacts(contacts: Contact[]): void {
  const payload = contacts.map((c) => ({
    number: c.number,
    fields: { ...c.fields },
  }));
  fs.writeFileSync(
    CONTACTS_FILE,
    JSON.stringify(payload, null, 2),
    "utf-8"
  );
}
