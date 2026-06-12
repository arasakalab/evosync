"""Persistencia da lista de contatos carregada na tela."""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from sender_worker import Contact


APP_DIR = Path(__file__).resolve().parent
CONTACTS_FILE = APP_DIR / "persisted_contacts.json"


def load_contacts() -> list[Contact]:
    if not CONTACTS_FILE.exists():
        return []
    try:
        data = json.loads(CONTACTS_FILE.read_text(encoding="utf-8"))
    except Exception:
        return []
    if not isinstance(data, list):
        return []
    contacts: list[Contact] = []
    for item in data:
        if not isinstance(item, dict):
            continue
        number = str(item.get("number") or "").strip()
        if not number:
            continue
        fields = item.get("fields")
        contacts.append(Contact(number=number, fields=fields if isinstance(fields, dict) else {}))
    return contacts


def save_contacts(contacts: list[Contact]) -> None:
    payload: list[dict[str, Any]] = [
        {"number": contact.number, "fields": dict(contact.fields)}
        for contact in contacts
    ]
    CONTACTS_FILE.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
