"""Persistencia de campanhas agendadas."""
from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Any
from uuid import uuid4


APP_DIR = Path(__file__).resolve().parent
SCHEDULE_FILE = APP_DIR / "scheduled_messages.json"

VALID_STATUSES = {"pending", "running", "sent", "failed", "missed", "cancelled"}


def now_iso() -> str:
    return datetime.now().isoformat(timespec="seconds")


def new_schedule_id() -> str:
    return uuid4().hex


def load_schedules() -> list[dict[str, Any]]:
    if not SCHEDULE_FILE.exists():
        return []
    try:
        data = json.loads(SCHEDULE_FILE.read_text(encoding="utf-8"))
    except Exception:
        return []
    if not isinstance(data, list):
        return []
    return [_normalize_schedule(item) for item in data if isinstance(item, dict)]


def save_schedules(schedules: list[dict[str, Any]]) -> None:
    payload = [_normalize_schedule(item) for item in schedules]
    SCHEDULE_FILE.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def _normalize_schedule(item: dict[str, Any]) -> dict[str, Any]:
    status = str(item.get("status") or "pending")
    if status not in VALID_STATUSES:
        status = "pending"
    contact_mode = str(item.get("contact_mode") or "snapshot")
    if contact_mode not in {"snapshot", "current"}:
        contact_mode = "snapshot"
    contacts = item.get("contacts")
    if not isinstance(contacts, list):
        contacts = []

    return {
        "id": str(item.get("id") or new_schedule_id()),
        "created_at": str(item.get("created_at") or now_iso()),
        "updated_at": str(item.get("updated_at") or now_iso()),
        "scheduled_at": str(item.get("scheduled_at") or now_iso()),
        "status": status,
        "message": str(item.get("message") or ""),
        "media_path": str(item.get("media_path") or ""),
        "media_type": str(item.get("media_type") or "image"),
        "delay_min": _as_int(item.get("delay_min"), 8),
        "delay_max": _as_int(item.get("delay_max"), 25),
        "daily_limit": _as_int(item.get("daily_limit"), 200),
        "validate_first": bool(item.get("validate_first", True)),
        "skip_sent_history": bool(item.get("skip_sent_history", False)),
        "contact_mode": contact_mode,
        "contacts": contacts,
        "error": str(item.get("error") or ""),
        "summary": str(item.get("summary") or ""),
    }


def _as_int(value: Any, default: int) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default
