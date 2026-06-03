"""Cliente HTTP para a Evolution API (v2)."""
from __future__ import annotations

import base64
import mimetypes
import re
from pathlib import Path
from typing import Optional, Tuple

import requests


def normalize_number(number: str, default_cc: str = "55") -> str:
    """Normaliza número de telefone para o formato E.164 (com DDI).

    Comportamento:
      - Mantém apenas dígitos.
      - Se começar com `+` ou DDI conhecido (default `55`), retorna como está.
      - Se tiver 13 dígitos e começar com 55, OK.
      - Se tiver 11 dígitos (DDD 2d + 9 + 8d = celular BR), prefixa 55.
      - Se tiver 10 dígitos (DDD 2d + 8d = fixo BR), prefixa 55.
      - Se tiver 12 dígitos começando com 55, OK.
      - Caso contrário, retorna os dígitos sem mexer (deixa a Evolution validar).
    """
    if not number:
        return ""
    digits = re.sub(r"\D+", "", str(number))
    if not digits:
        return ""

    if digits.startswith(default_cc):
        return digits  # já tem DDI

    if len(digits) == 13 and digits.startswith("55"):
        return digits
    if len(digits) in (10, 11):
        return default_cc + digits  # BR celular/fixo sem DDI
    if len(digits) == 12 and digits.startswith("55"):
        return digits
    # formato desconhecido — devolve como está pra Evolution validar
    return digits


def looks_like_mobile_br(digits: str) -> bool:
    """Heurística simples pra identificar se o número parece celular BR.
    55 + DDD(2d) + 9 + 8d = 13 dígitos, segundo dígito (após 55) nao pode ser 9
    (DDDs vao de 11 a 99, e o 9 após o DDD é o prefixo obrigatorio de celular).
    """
    if len(digits) != 13 or not digits.startswith("55"):
        return False
    ddd = digits[2:4]
    n9 = digits[4]
    if not ddd.isdigit() or int(ddd) < 11:
        return False
    if n9 != "9":
        return False
    return True


class EvoClient:
    def __init__(self, base_url: str, api_key: str, instance: str, timeout: int = 30):
        self.base_url = (base_url or "").rstrip("/")
        self.api_key = api_key
        self.instance = instance
        self.timeout = timeout
        self._s = requests.Session()
        self._s.headers.update({"apikey": api_key})

    def _url(self, *parts: str) -> str:
        return "/".join([self.base_url, *parts])

    def ping(self) -> Tuple[bool, str]:
        try:
            r = self._s.get(self._url(""), timeout=self.timeout)
        except Exception as e:
            return False, f"Falha de conexão: {e}"
        if r.status_code == 200:
            return True, f"OK · v{self._extract_version(r)}"
        return False, f"HTTP {r.status_code}"

    @staticmethod
    def _extract_version(resp: requests.Response) -> str:
        try:
            data = resp.json()
            return str(data.get("version", "?"))
        except Exception:
            return "?"

    def connection_state(self) -> Tuple[Optional[str], str]:
        try:
            r = self._s.get(self._url("instance", "connectionState", self.instance), timeout=self.timeout)
        except Exception as e:
            return None, f"Erro: {e}"
        if r.status_code != 200:
            return None, f"HTTP {r.status_code}: {r.text[:200]}"
        try:
            data = r.json()
        except Exception:
            return None, "Resposta inválida"
        state = (
            (data.get("instance") or {}).get("state")
            or data.get("state")
            or data.get("status")
        )
        return (str(state) if state else None), "OK"

    def send_text(self, number: str, text: str) -> Tuple[bool, str]:
        url = self._url("message", "sendText", self.instance)
        payload = {"number": number, "text": text}
        try:
            r = self._s.post(url, json=payload, timeout=self.timeout)
        except Exception as e:
            return False, f"Erro de rede: {e}"
        if r.status_code in (200, 201):
            return True, "ok"
        return False, f"HTTP {r.status_code}: {r.text[:300]}"

    def send_media(self, number: str, media_path: str, caption: str = "", mediatype: str = "image") -> Tuple[bool, str]:
        """Envia mídia. mediatype: image | video | document"""
        p = Path(media_path)
        if not p.exists():
            return False, "Arquivo de mídia não encontrado"
        mime, _ = mimetypes.guess_type(str(p))
        if not mime:
            mime = "application/octet-stream"

        url = self._url("message", "sendMedia", self.instance)
        try:
            with open(p, "rb") as f:
                files = {"file": (p.name, f, mime)}
                data = {"number": number, "mediatype": mediatype, "fileName": p.name}
                if caption:
                    data["caption"] = caption
                r = self._s.post(url, data=data, files=files, timeout=self.timeout)
        except Exception as e:
            return False, f"Erro: {e}"
        if r.status_code in (200, 201):
            return True, "ok"
        return False, f"HTTP {r.status_code}: {r.text[:300]}"

    def find_contacts_raw(self) -> Tuple[Optional[list], str]:
        """Busca contatos sincronizados desta instância.
        Endpoint: POST /chat/findContacts/{instance}
        Retorna a lista bruta (cada item: remoteJid, pushName, type, isGroup, ...).
        """
        url = self._url("chat", "findContacts", self.instance)
        try:
            r = self._s.post(url, json={}, timeout=self.timeout)
        except Exception as e:
            return None, f"Erro: {e}"
        if r.status_code != 200:
            return None, f"HTTP {r.status_code}: {r.text[:300]}"
        try:
            data = r.json()
        except Exception:
            return None, "Resposta inválida"
        if not isinstance(data, list):
            return None, f"Formato inesperado: {type(data).__name__}"
        return data, "ok"

    def find_chats_raw(self) -> Tuple[Optional[list], str]:
        """Busca conversas (chats) recentes. Útil como alternativa."""
        url = self._url("chat", "findChats", self.instance)
        try:
            r = self._s.post(url, json={}, timeout=self.timeout)
        except Exception as e:
            return None, f"Erro: {e}"
        if r.status_code != 200:
            return None, f"HTTP {r.status_code}: {r.text[:300]}"
        try:
            data = r.json()
        except Exception:
            return None, "Resposta inválida"
        if not isinstance(data, list):
            return None, f"Formato inesperado: {type(data).__name__}"
        return data, "ok"

    def check_whatsapp(self, numbers: list) -> Tuple[Optional[list], str]:
        """Valida quais números têm WhatsApp.
        Endpoint: POST /chat/whatsappNumbers/{instance}
        Body: {"numbers": ["5511..."]}
        Retorna lista de objetos com jid, exists, number.
        """
        url = self._url("chat", "whatsappNumbers", self.instance)
        try:
            r = self._s.post(url, json={"numbers": numbers}, timeout=self.timeout)
        except Exception as e:
            return None, f"Erro: {e}"
        if r.status_code != 200:
            return None, f"HTTP {r.status_code}: {r.text[:300]}"
        try:
            data = r.json()
        except Exception:
            return None, "Resposta inválida"
        if not isinstance(data, list):
            return None, f"Formato inesperado: {type(data).__name__}"
        return data, "ok"
