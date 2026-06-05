"""Worker de envio em background com fila, delays aleatorios, retry e persistencia."""
from __future__ import annotations

import json
import random
import threading
import time
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Callable, List, Optional

from evo_client import EvoClient, normalize_number


APP_DIR = Path(__file__).resolve().parent
SENT_LOG = APP_DIR / "sent_log.json"


class State(str, Enum):
    IDLE = "idle"
    RUNNING = "running"
    PAUSED = "paused"
    STOPPED = "stopped"


@dataclass
class Contact:
    number: str
    fields: dict = field(default_factory=dict)

    def render(self, template: str) -> str:
        out = template
        for k, v in self.fields.items():
            out = out.replace("{" + k + "}", str(v))
        return out


@dataclass
class Status:
    state: State = State.IDLE
    total: int = 0
    sent: int = 0
    failed: int = 0
    pending: int = 0
    current_number: str = ""
    current_index: int = 0
    last_message: str = ""
    error: str = ""
    stage: str = ""  # "connecting" | "validating" | "sending" | "waiting" | ""
    skipped: int = 0
    no_whatsapp: int = 0
    invalid: int = 0
    limit_reached: bool = False


class SenderWorker(threading.Thread):
    """Thread que consome uma fila de contatos respeitando delays e limites."""

    def __init__(
        self,
        client: EvoClient,
        contacts: List[Contact],
        template: str,
        media_path: Optional[str],
        mediatype: str,
        delay_min: int,
        delay_max: int,
        daily_limit: int,
        on_status: Callable[[Status], None],
        validate_first: bool = True,
        skip_sent_history: bool = True,
    ):
        super().__init__(daemon=True)
        self.client = client
        self.contacts = contacts
        self.template = template
        self.media_path = media_path
        self.mediatype = mediatype
        self.delay_min = max(1, int(delay_min))
        self.delay_max = max(self.delay_min, int(delay_max))
        self.daily_limit = max(1, int(daily_limit))
        self.on_status = on_status
        self.validate_first = validate_first
        self.skip_sent_history = skip_sent_history
        self._pause_evt = threading.Event()
        self._pause_evt.set()  # set = not paused
        self._stop_evt = threading.Event()
        self.status = Status(total=len(contacts), pending=len(contacts))
        self._sent_today: set[str] = self._load_sent_log()

    def _load_sent_log(self) -> set[str]:
        if SENT_LOG.exists():
            try:
                data = json.loads(SENT_LOG.read_text(encoding="utf-8"))
                if isinstance(data, list):
                    return {str(x) for x in data}
            except Exception:
                pass
        return set()

    def _save_sent_log(self) -> None:
        try:
            SENT_LOG.write_text(json.dumps(sorted(self._sent_today), indent=2), encoding="utf-8")
        except Exception:
            pass

    def pause(self) -> None:
        if self.status.state == State.RUNNING:
            self._pause_evt.clear()
            self.status.state = State.PAUSED
            self.on_status(self.status)

    def resume(self) -> None:
        if self.status.state == State.PAUSED:
            self._pause_evt.set()
            self.status.state = State.RUNNING
            self.on_status(self.status)

    def stop(self) -> None:
        self._stop_evt.set()
        self._pause_evt.set()  # libera caso esteja pausado
        self.status.state = State.STOPPED
        self.on_status(self.status)

    def _wait_if_paused(self) -> bool:
        """Bloqueia enquanto pausado. Retorna True se foi solicitado stop."""
        self._pause_evt.wait()
        return self._stop_evt.is_set()

    def _interruptible_sleep(self, seconds: float) -> bool:
        """Dorme em fatias curtas para reagir a pause/stop mais rapido.
        Retorna True se foi solicitado stop."""
        deadline = time.time() + max(0.0, seconds)
        while time.time() < deadline:
            if self._stop_evt.is_set():
                return True
            if not self._pause_evt.is_set():
                # se pausou no meio do delay, espera liberacao
                if self._wait_if_paused():
                    return True
            time.sleep(min(0.5, max(0.05, deadline - time.time())))
        return self._stop_evt.is_set()

    def _delay(self, sent_count: int) -> float:
        # warm-up: primeiros 50 envios usam 2x o delay
        if sent_count < 50:
            base_min = self.delay_min * 2
            base_max = self.delay_max * 2
        else:
            base_min = self.delay_min
            base_max = self.delay_max
        return random.uniform(base_min, base_max)

    def _send_one(self, contact: Contact, number: str) -> bool:
        text = contact.render(self.template)
        if self.media_path:
            ok, msg = self.client.send_media(number, self.media_path, text, self.mediatype)
        else:
            ok, msg = self.client.send_text(number, text)
        if not ok:
            self.status.error = msg
        return ok

    def run(self) -> None:
        self.status.state = State.RUNNING
        self.status.error = ""
        self.on_status(self.status)
        sent_in_session = 0
        try:
            invalid: set[str] = set()
            if self.validate_first:
                # ---- Pré-validação em lote: descobre quem tem/não tem WhatsApp ----
                self.status.stage = "prevalidating"
                self.on_status(self.status)
                to_validate: list[str] = []
                seen_validate: set[str] = set()
                for c in self.contacts:
                    n = normalize_number(c.number)
                    if not n:
                        continue
                    if n not in seen_validate:
                        seen_validate.add(n)
                        to_validate.append(n)
                # batch de ate 50 por chamada
                for i in range(0, len(to_validate), 50):
                    if self._stop_evt.is_set():
                        break
                    if self._wait_if_paused():
                        break
                    batch = to_validate[i:i + 50]
                    data, err = self.client.check_whatsapp(batch)
                    if data is None:
                        self.status.error = f"Falha na validação prévia: {err}"
                        self.on_status(self.status)
                        # se a validacao falhou, nao bloqueia — tenta enviar mesmo assim
                        break
                    for d in data:
                        num = (d.get("number") or "").lstrip("+")
                        if d.get("exists"):
                            pass
                        else:
                            invalid.add(num)
                if invalid:
                    preview = ", ".join(sorted(invalid)[:5])
                    suffix = "..." if len(invalid) > 5 else ""
                    self.status.error = f"{len(invalid)} número(s) sem WhatsApp: {preview}{suffix}"
                    self.on_status(self.status)
                self.status.stage = "prevalidated"
                self.on_status(self.status)

            for idx, c in enumerate(self.contacts):
                if self._stop_evt.is_set():
                    break

                self.status.current_index = idx + 1

                number = normalize_number(c.number)
                if not number:
                    self.status.current_number = str(c.number)
                    self.status.error = f"numero invalido: {c.number!r}"
                    self.status.stage = "validating"
                    self.status.failed += 1
                    self.status.invalid += 1
                    self.status.pending = max(0, self.status.pending - 1)
                    self.on_status(self.status)
                    continue
                self.status.current_number = number

                # se pre-validamos e o numero nao tem WhatsApp, pula com erro claro
                if number in invalid:
                    self.status.error = f"{number} não tem WhatsApp — pulando"
                    self.status.stage = "no_whatsapp"
                    self.status.failed += 1
                    self.status.no_whatsapp += 1
                    self.status.pending = max(0, self.status.pending - 1)
                    self.on_status(self.status)
                    continue

                # checa se já enviou antes
                if self.skip_sent_history and number in self._sent_today:
                    self.status.error = ""
                    self.status.stage = "skip"
                    self.status.skipped += 1
                    self.status.pending = max(0, self.status.pending - 1)
                    self.on_status(self.status)
                    continue

                # checa limite diario
                if sent_in_session >= self.daily_limit:
                    self.status.error = "Limite diário atingido"
                    self.status.stage = "limit"
                    self.status.limit_reached = True
                    self.on_status(self.status)
                    break

                if self._wait_if_paused():
                    break

                # checa conexão da instância
                self.status.stage = "connecting"
                self.status.last_message = c.render(self.template)[:120]
                self.on_status(self.status)
                state, err = self.client.connection_state()
                if state and state.lower() not in ("open", "connected", "online"):
                    self.status.error = f"Instância {state}; aguardando 30s"
                    self.on_status(self.status)
                    if self._interruptible_sleep(30):
                        break
                    continue

                if self._wait_if_paused():
                    break

                # envia
                self.status.stage = "sending"
                self.status.error = ""
                self.on_status(self.status)
                ok = self._send_one(c, number)
                if ok:
                    self.status.sent += 1
                    self._sent_today.add(number)
                    self._save_sent_log()
                    sent_in_session += 1
                    self.status.error = ""
                else:
                    self.status.failed += 1
                    # auto-pausa em caso de erro para nao iterar rapido
                    if "401" in self.status.error or "403" in self.status.error:
                        self.status.stage = "auth"
                        self.status.error = "Auth/ban — verifique a conta"
                        self.on_status(self.status)
                        break
                    self.on_status(self.status)
                    if self._interruptible_sleep(5):
                        break
                    continue

                self.status.pending = max(0, self.status.pending - 1)
                self.status.stage = "sent"
                self.on_status(self.status)

                if self._stop_evt.is_set():
                    break

                # NAO dorme se for o ultimo contato (evita o "travamento")
                is_last = (idx == len(self.contacts) - 1)
                if is_last or self.status.pending == 0:
                    break

                # dorme entre contatos
                delay_s = self._delay(sent_in_session)
                self.status.stage = f"waiting {delay_s:.0f}s"
                self.status.error = ""
                self.on_status(self.status)
                if self._interruptible_sleep(delay_s):
                    break
        finally:
            if self.status.state != State.STOPPED:
                self.status.state = State.IDLE
            self.status.current_number = ""
            self.status.stage = "done"
            self.status.error = ""
            self.on_status(self.status)
