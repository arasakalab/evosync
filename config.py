"""Persistencia simples de configuracao da Evolution API."""
from __future__ import annotations

import json
import os
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Optional

from dotenv import dotenv_values, set_key


APP_DIR = Path(__file__).resolve().parent
ENV_FILE = APP_DIR / ".env"
SETTINGS_FILE = APP_DIR / "config.json"


@dataclass
class Settings:
    url: str = "http://localhost:8080"
    api_key: str = ""
    instance: str = ""
    opencode_model: str = ""
    delay_min: int = 8
    delay_max: int = 25
    daily_limit: int = 200
    last_message: str = ""


def load_settings() -> Settings:
    if ENV_FILE.exists():
        values = dotenv_values(ENV_FILE)
    else:
        values = {}

    json_data: dict = {}
    if SETTINGS_FILE.exists():
        try:
            json_data = json.loads(SETTINGS_FILE.read_text(encoding="utf-8"))
        except Exception:
            json_data = {}

    s = Settings(
        url=values.get("EVO_URL", "http://localhost:8080") or "http://localhost:8080",
        api_key=values.get("EVO_APIKEY", "") or "",
        instance=values.get("EVO_INSTANCE", "") or "",
        opencode_model=json_data.get("opencode_model", ""),
        delay_min=int(json_data.get("delay_min", 8)),
        delay_max=int(json_data.get("delay_max", 25)),
        daily_limit=int(json_data.get("daily_limit", 200)),
        last_message=json_data.get("last_message", ""),
    )
    if s.delay_min < 1:
        s.delay_min = 1
    if s.delay_max < s.delay_min:
        s.delay_max = s.delay_min
    return s


def save_settings(s: Settings) -> None:
    if not ENV_FILE.exists():
        ENV_FILE.touch(mode=0o600)
    else:
        try:
            os.chmod(ENV_FILE, 0o600)
        except Exception:
            pass

    set_key(str(ENV_FILE), "EVO_URL", s.url)
    set_key(str(ENV_FILE), "EVO_APIKEY", s.api_key)
    set_key(str(ENV_FILE), "EVO_INSTANCE", s.instance)

    payload = asdict(s)
    for k in ("url", "api_key", "instance"):
        payload.pop(k, None)
    SETTINGS_FILE.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def get_credential_path() -> Optional[Path]:
    return ENV_FILE if ENV_FILE.exists() else None
