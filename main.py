"""EvoTeste — Disparador em massa via Evolution API."""
from __future__ import annotations

import csv
import json
import os
import re
import threading
import tkinter as tk
from dataclasses import replace
from datetime import datetime
from pathlib import Path
from tkinter import ttk
from typing import List, Optional

import customtkinter as ctk

from config import Settings, load_settings, save_settings
from evo_client import EvoClient, normalize_number
from opencode_client import OpenCodeMessageClient
from sender_worker import Contact, SenderWorker, State, Status


APP_DIR = Path(__file__).resolve().parent
LOG_FILE = APP_DIR / "send_run.log"

ctk.set_appearance_mode("dark")
ctk.set_default_color_theme("green")

BG = "#0b1411"
PANEL = "#101c18"
PANEL_ALT = "#13221d"
BORDER = "#243b33"
TEXT = "#e8f5ef"
MUTED = "#8ea39a"
PRIMARY = "#1f9d65"
PRIMARY_HOVER = "#188251"
BLUE = "#2f81f7"
BLUE_HOVER = "#1f6feb"
DANGER = "#c2413d"
DANGER_HOVER = "#9f302d"
NEUTRAL = "#26352f"
NEUTRAL_HOVER = "#31473f"


class App(ctk.CTk):
    def __init__(self):
        super().__init__()
        self.title("EvoTeste — Disparador em massa")
        self.geometry("1120x760")
        self.minsize(980, 700)
        self.configure(fg_color=BG)

        self.settings: Settings = load_settings()
        self.contacts: List[Contact] = []
        self.worker: Optional[SenderWorker] = None
        self.client: Optional[EvoClient] = None
        self._csv_columns: List[str] = []
        self._run_active = False

        self._build_ui()
        self._load_into_ui()

    # --------------------- UI ---------------------
    def _build_ui(self):
        self._configure_ttk_style()

        header = ctk.CTkFrame(self, fg_color="transparent")
        header.pack(fill="x", padx=18, pady=(16, 4))
        ctk.CTkLabel(
            header,
            text="EvoTeste",
            text_color=TEXT,
            font=ctk.CTkFont(size=28, weight="bold"),
        ).pack(side="left")
        ctk.CTkLabel(
            header,
            text="Disparador via Evolution API",
            text_color=MUTED,
            font=ctk.CTkFont(size=13),
        ).pack(side="left", padx=(12, 0), pady=(8, 0))

        self.tabs = ctk.CTkTabview(
            self,
            width=1040,
            height=650,
            fg_color=PANEL,
            segmented_button_fg_color=PANEL_ALT,
            segmented_button_selected_color=PRIMARY,
            segmented_button_selected_hover_color=PRIMARY_HOVER,
            segmented_button_unselected_color=PANEL_ALT,
            segmented_button_unselected_hover_color=NEUTRAL,
            text_color=TEXT,
        )
        self.tabs.pack(fill="both", expand=True, padx=18, pady=10)
        self.tab_conn = self.tabs.add("Conexão")
        self.tab_contacts = self.tabs.add("Contatos")
        self.tab_msg = self.tabs.add("Mensagem")
        self.tab_send = self.tabs.add("Disparo")

        for tab in (self.tab_conn, self.tab_contacts, self.tab_msg, self.tab_send):
            tab.configure(fg_color=PANEL)

        self._build_conn_tab()
        self._build_contacts_tab()
        self._build_msg_tab()
        self._build_send_tab()

        self.statusbar = ctk.CTkLabel(
            self,
            text="Pronto",
            anchor="w",
            text_color=MUTED,
            font=ctk.CTkFont(size=12),
        )
        self.statusbar.pack(fill="x", padx=20, pady=(0, 10))

    def _configure_ttk_style(self):
        style = ttk.Style()
        style.theme_use("clam")
        style.configure(
            "Treeview",
            background="#0f1916",
            foreground=TEXT,
            fieldbackground="#0f1916",
            bordercolor=BORDER,
            rowheight=34,
            font=("TkDefaultFont", 10),
        )
        style.configure(
            "Treeview.Heading",
            background=PANEL_ALT,
            foreground=TEXT,
            relief="flat",
            font=("TkDefaultFont", 10, "bold"),
        )
        style.map(
            "Treeview",
            background=[("selected", PRIMARY)],
            foreground=[("selected", "#ffffff")],
        )

    def _section_title(self, parent, title: str, subtitle: str = ""):
        ctk.CTkLabel(
            parent,
            text=title,
            text_color=TEXT,
            font=ctk.CTkFont(size=20, weight="bold"),
        ).pack(anchor="w", padx=18, pady=(18, 2))
        if subtitle:
            ctk.CTkLabel(
                parent,
                text=subtitle,
                text_color=MUTED,
                font=ctk.CTkFont(size=12),
            ).pack(anchor="w", padx=18, pady=(0, 10))

    def _panel(self, parent):
        frame = ctk.CTkFrame(parent, fg_color=PANEL_ALT, border_width=1, border_color=BORDER, corner_radius=8)
        frame.pack(fill="x", padx=18, pady=8)
        return frame

    def _button(self, parent, text: str, command, color=NEUTRAL, hover=NEUTRAL_HOVER, width=132, **kwargs):
        return ctk.CTkButton(
            parent,
            text=text,
            command=command,
            fg_color=color,
            hover_color=hover,
            text_color="#ffffff",
            corner_radius=6,
            height=36,
            width=width,
            **kwargs,
        )

    def _build_conn_tab(self):
        f = self.tab_conn
        self._section_title(
            f,
            "Conexão",
            "Configure a API, salve suas credenciais e confira o status da instância.",
        )

        form = self._panel(f)
        form.grid_columnconfigure(1, weight=1)

        ctk.CTkLabel(form, text="URL da Evolution", text_color=MUTED).grid(row=0, column=0, padx=16, pady=(18, 8), sticky="w")
        self.entry_url = ctk.CTkEntry(form, height=38, placeholder_text="http://localhost:8080", fg_color="#0d1713", border_color=BORDER)
        self.entry_url.grid(row=0, column=1, padx=16, pady=(18, 8), sticky="ew")

        ctk.CTkLabel(form, text="API Key", text_color=MUTED).grid(row=1, column=0, padx=16, pady=8, sticky="w")
        self.entry_key = ctk.CTkEntry(form, height=38, show="*", placeholder_text="cole aqui", fg_color="#0d1713", border_color=BORDER)
        self.entry_key.grid(row=1, column=1, padx=16, pady=8, sticky="ew")

        ctk.CTkLabel(form, text="Nome da instância", text_color=MUTED).grid(row=2, column=0, padx=16, pady=8, sticky="w")
        self.entry_instance = ctk.CTkEntry(form, height=38, placeholder_text="ex: minha-instancia", fg_color="#0d1713", border_color=BORDER)
        self.entry_instance.grid(row=2, column=1, padx=16, pady=8, sticky="ew")

        ctk.CTkLabel(form, text="Modelo OpenCode", text_color=MUTED).grid(row=3, column=0, padx=16, pady=8, sticky="w")
        self.entry_opencode_model = ctk.CTkEntry(form, height=38, placeholder_text="vazio usa nvidia/meta/llama-3.2-90b-vision-instruct", fg_color="#0d1713", border_color=BORDER)
        self.entry_opencode_model.grid(row=3, column=1, padx=16, pady=8, sticky="ew")

        ctk.CTkLabel(form, text="As credenciais da Evolution são gravadas em .env com permissões 600.", text_color=MUTED).grid(
            row=4, column=1, padx=16, pady=(0, 16), sticky="w"
        )

        btnrow = ctk.CTkFrame(f, fg_color="transparent")
        btnrow.pack(fill="x", padx=18, pady=10)
        self._button(btnrow, "Testar conexão", self._on_test, color=BLUE, hover=BLUE_HOVER, width=150).pack(side="left", padx=(0, 8))
        self._button(btnrow, "Salvar", self._on_save_conn, color=PRIMARY, hover=PRIMARY_HOVER, width=110).pack(side="left")
        self.lbl_conn_status = ctk.CTkLabel(btnrow, text="—", text_color=MUTED)
        self.lbl_conn_status.pack(side="left", padx=14)

    def _build_contacts_tab(self):
        f = self.tab_contacts
        self._section_title(
            f,
            "Contatos",
            "Importe listas, puxe contatos da instância ou adicione números manualmente.",
        )

        top = self._panel(f)

        self._button(top, "Importar CSV", self._on_import_csv, color=PRIMARY, hover=PRIMARY_HOVER).pack(side="left", padx=(14, 6), pady=12)
        self._button(top, "Importar WhatsApp", self._on_import_from_whatsapp, color=BLUE, hover=BLUE_HOVER, width=158).pack(side="left", padx=6, pady=12)
        self._button(top, "Adicionar", self._on_add_manual, width=112).pack(side="left", padx=6, pady=12)
        self._button(top, "Remover", self._on_remove_selected, width=112).pack(side="left", padx=6, pady=12)
        self._button(top, "Limpar", self._on_clear_contacts, color=DANGER, hover=DANGER_HOVER, width=96).pack(side="left", padx=6, pady=12)
        self.lbl_contacts_count = ctk.CTkLabel(top, text="0 contatos", text_color=TEXT, font=ctk.CTkFont(size=13, weight="bold"))
        self.lbl_contacts_count.pack(side="right", padx=16)
        self.lbl_contacts_hint = ctk.CTkLabel(
            f,
            text="Nenhum contato carregado. Importe um CSV, busque no WhatsApp ou adicione manualmente.",
            text_color=MUTED,
        )
        self.lbl_contacts_hint.pack(anchor="w", padx=18, pady=(0, 4))

        cols = ("numero", "preview")
        self.tree = ttk.Treeview(f, columns=cols, show="headings", height=18, selectmode="extended")
        self.tree.heading("numero", text="Número")
        self.tree.heading("preview", text="Campos extras (preview)")
        self.tree.column("numero", width=200, anchor="w")
        self.tree.column("preview", width=620, anchor="w")
        self.tree.pack(fill="both", expand=True, padx=18, pady=(4, 16))
        self.tree.bind("<Delete>", lambda _event: self._on_remove_selected())

    def _build_msg_tab(self):
        f = self.tab_msg
        self._section_title(
            f,
            "Mensagem",
            "Monte o texto, use campos do CSV e anexe uma mídia opcional.",
        )

        ctk.CTkLabel(f, text="Placeholders disponíveis seguem o cabeçalho do CSV, como {nome} e {empresa}.", text_color=MUTED).pack(anchor="w", padx=18)

        self.txt_msg = ctk.CTkTextbox(
            f,
            height=230,
            font=ctk.CTkFont(size=14),
            fg_color="#0d1713",
            border_color=BORDER,
            border_width=1,
            corner_radius=8,
        )
        self.txt_msg.pack(fill="x", padx=18, pady=10)

        media = self._panel(f)
        media.grid_columnconfigure(1, weight=1)
        ctk.CTkLabel(media, text="Mídia opcional", text_color=MUTED).grid(row=0, column=0, padx=(16, 8), pady=14, sticky="w")
        self.entry_media = ctk.CTkEntry(media, placeholder_text="caminho do arquivo...", fg_color="#0d1713", border_color=BORDER, height=36)
        self.entry_media.grid(row=0, column=1, padx=8, pady=14, sticky="ew")
        self._button(media, "Procurar", self._on_pick_media, width=104).grid(row=0, column=2, padx=6, pady=14)
        ctk.CTkLabel(media, text="Tipo", text_color=MUTED).grid(row=0, column=3, padx=(12, 4), pady=14)
        self.media_type = ctk.CTkOptionMenu(
            media,
            values=["image", "video", "document"],
            fg_color=NEUTRAL,
            button_color=PRIMARY,
            button_hover_color=PRIMARY_HOVER,
            dropdown_fg_color=PANEL_ALT,
            dropdown_hover_color=NEUTRAL,
            width=120,
        )
        self.media_type.grid(row=0, column=4, padx=6, pady=14)
        self._button(media, "Pré-visualizar", self._on_preview, color=BLUE, hover=BLUE_HOVER, width=130).grid(row=0, column=5, padx=6, pady=14)
        self._button(media, "OpenCode IA", self._on_generate_opencode_message, color=PRIMARY, hover=PRIMARY_HOVER, width=140).grid(row=0, column=6, padx=(6, 16), pady=14)
        self.lbl_media_status = ctk.CTkLabel(f, text="Nenhuma mídia selecionada.", text_color=MUTED)
        self.lbl_media_status.pack(anchor="w", padx=18, pady=(0, 4))

        preview_box = ctk.CTkFrame(f, fg_color="#0d1713", border_width=1, border_color=BORDER, corner_radius=8)
        preview_box.pack(fill="x", padx=18, pady=8)
        self.lbl_preview = ctk.CTkLabel(
            preview_box,
            text="",
            justify="left",
            wraplength=980,
            anchor="w",
            text_color=TEXT,
        )
        self.lbl_preview.pack(fill="x", padx=14, pady=12)

    def _build_send_tab(self):
        f = self.tab_send
        self._section_title(
            f,
            "Disparo",
            "Controle velocidade, validação, execução e acompanhe o andamento em tempo real.",
        )

        params = self._panel(f)
        ctk.CTkLabel(params, text="Delay mínimo (s)", text_color=MUTED).grid(row=0, column=0, padx=(16, 6), pady=(16, 8), sticky="w")
        self.spin_min = ctk.CTkEntry(params, width=86, height=36, fg_color="#0d1713", border_color=BORDER)
        self.spin_min.grid(row=0, column=1, padx=6, pady=(16, 8))
        ctk.CTkLabel(params, text="Delay máximo (s)", text_color=MUTED).grid(row=0, column=2, padx=(18, 6), pady=(16, 8), sticky="w")
        self.spin_max = ctk.CTkEntry(params, width=86, height=36, fg_color="#0d1713", border_color=BORDER)
        self.spin_max.grid(row=0, column=3, padx=6, pady=(16, 8))
        ctk.CTkLabel(params, text="Limite diário", text_color=MUTED).grid(row=0, column=4, padx=(18, 6), pady=(16, 8), sticky="w")
        self.spin_limit = ctk.CTkEntry(params, width=86, height=36, fg_color="#0d1713", border_color=BORDER)
        self.spin_limit.grid(row=0, column=5, padx=6, pady=(16, 8))

        self.var_validate = tk.BooleanVar(value=True)
        ctk.CTkCheckBox(
            params,
            text="Validar números no WhatsApp antes (recomendado)",
            variable=self.var_validate,
            fg_color=PRIMARY,
            hover_color=PRIMARY_HOVER,
            border_color=BORDER,
            text_color=TEXT,
        ).grid(row=1, column=0, columnspan=6, padx=16, pady=(4, 16), sticky="w")

        btns = ctk.CTkFrame(f, fg_color="transparent")
        btns.pack(fill="x", padx=18, pady=8)
        self.btn_start = self._button(btns, "Iniciar", self._on_start, color=PRIMARY, hover=PRIMARY_HOVER, width=112)
        self.btn_start.pack(side="left", padx=(0, 8))
        self.btn_pause = self._button(btns, "Pausar", self._on_pause, state="disabled", width=112)
        self.btn_pause.pack(side="left", padx=8)
        self.btn_resume = self._button(btns, "Retomar", self._on_resume, state="disabled", width=112)
        self.btn_resume.pack(side="left", padx=8)
        self.btn_stop = self._button(btns, "Parar", self._on_stop, color=DANGER, hover=DANGER_HOVER, state="disabled", width=112)
        self.btn_stop.pack(side="left", padx=8)
        self._button(btns, "Resetar histórico", self._on_reset_history, width=150).pack(side="right")

        self.progress = ctk.CTkProgressBar(f, fg_color="#0d1713", progress_color=PRIMARY)
        self.progress.set(0)
        self.progress.pack(fill="x", padx=18, pady=(8, 6))

        counters = self._panel(f)
        self.lbl_sent = ctk.CTkLabel(counters, text="Enviados: 0", text_color="#7ee787", font=ctk.CTkFont(size=13, weight="bold"))
        self.lbl_sent.pack(side="left", padx=16, pady=12)
        self.lbl_failed = ctk.CTkLabel(counters, text="Falharam: 0", text_color="#ff8b86", font=ctk.CTkFont(size=13, weight="bold"))
        self.lbl_failed.pack(side="left", padx=16, pady=12)
        self.lbl_pending = ctk.CTkLabel(counters, text="Pendentes: 0", text_color="#f4d06f", font=ctk.CTkFont(size=13, weight="bold"))
        self.lbl_pending.pack(side="left", padx=16, pady=12)
        self.lbl_history = ctk.CTkLabel(counters, text="Histórico: 0", text_color=MUTED, font=ctk.CTkFont(size=13, weight="bold"))
        self.lbl_history.pack(side="left", padx=16, pady=12)
        self.lbl_state = ctk.CTkLabel(counters, text="Estado: idle", text_color=TEXT, font=ctk.CTkFont(size=13, weight="bold"))
        self.lbl_state.pack(side="right", padx=16, pady=12)

        ctk.CTkLabel(f, text="Log", text_color=MUTED, font=ctk.CTkFont(size=12, weight="bold")).pack(anchor="w", padx=18, pady=(4, 0))
        self.txt_log = ctk.CTkTextbox(
            f,
            height=220,
            font=ctk.CTkFont(family="monospace", size=12),
            fg_color="#0d1713",
            border_color=BORDER,
            border_width=1,
            corner_radius=8,
        )
        self.txt_log.pack(fill="both", expand=True, padx=18, pady=(6, 16))

    # --------------------- Helpers ---------------------
    def _load_into_ui(self):
        self.entry_url.insert(0, self.settings.url)
        self.entry_key.insert(0, self.settings.api_key)
        self.entry_instance.insert(0, self.settings.instance)
        self.entry_opencode_model.insert(0, self.settings.opencode_model)
        self.spin_min.insert(0, str(self.settings.delay_min))
        self.spin_max.insert(0, str(self.settings.delay_max))
        self.spin_limit.insert(0, str(self.settings.daily_limit))
        if self.settings.last_message:
            self.txt_msg.insert("1.0", self.settings.last_message)
        self._refresh_history_count()

    def _collect_settings(self) -> Settings:
        s = Settings()
        s.url = self.entry_url.get().strip() or "http://localhost:8080"
        s.api_key = self.entry_key.get().strip()
        s.instance = self.entry_instance.get().strip()
        s.opencode_model = self.entry_opencode_model.get().strip()
        try:
            s.delay_min = int(self.spin_min.get() or 8)
        except ValueError:
            s.delay_min = 8
        try:
            s.delay_max = int(self.spin_max.get() or 25)
        except ValueError:
            s.delay_max = 25
        try:
            s.daily_limit = int(self.spin_limit.get() or 200)
        except ValueError:
            s.daily_limit = 200
        s.last_message = self.txt_msg.get("1.0", "end-1c")
        return s

    def _get_client(self) -> Optional[EvoClient]:
        s = self._collect_settings()
        if not s.api_key or not s.instance:
            self._dialog("Faltam dados", "Preencha API Key e Nome da Instância na aba Conexão.", kind="neutral")
            return None
        return EvoClient(s.url, s.api_key, s.instance)

    def _set_status(self, text: str):
        self.statusbar.configure(text=text)

    def _append_log(self, line: str):
        ts = datetime.now().strftime("%H:%M:%S")
        self.txt_log.insert("end", f"[{ts}] {line}\n")
        self.txt_log.see("end")
        try:
            with open(LOG_FILE, "a", encoding="utf-8") as f:
                f.write(f"[{datetime.now().isoformat(timespec='seconds')}] {line}\n")
        except Exception:
            pass

    def _refresh_contacts_count(self):
        self.lbl_contacts_count.configure(text=f"{len(self.contacts)} contatos")
        if hasattr(self, "lbl_contacts_hint"):
            if self.contacts:
                self.lbl_contacts_hint.configure(text="Selecione uma ou mais linhas para remover contatos antes do disparo.")
            else:
                self.lbl_contacts_hint.configure(text="Nenhum contato carregado. Importe um CSV, busque no WhatsApp ou adicione manualmente.")

    def _history_count(self) -> int:
        from sender_worker import SENT_LOG
        if not SENT_LOG.exists():
            return 0
        try:
            data = json.loads(SENT_LOG.read_text(encoding="utf-8"))
        except Exception:
            return 0
        if isinstance(data, list):
            return len(data)
        if isinstance(data, dict):
            return len(data)
        return 0

    def _refresh_history_count(self):
        if hasattr(self, "lbl_history"):
            self.lbl_history.configure(text=f"Histórico: {self._history_count()}")

    def _dialog(self, title: str, message: str, kind: str = "info", confirm: bool = False) -> bool:
        result = tk.BooleanVar(value=False)
        done = tk.BooleanVar(value=False)
        color = {
            "danger": DANGER,
            "success": PRIMARY,
            "info": BLUE,
            "neutral": NEUTRAL,
        }.get(kind, BLUE)
        hover = {
            "danger": DANGER_HOVER,
            "success": PRIMARY_HOVER,
            "info": BLUE_HOVER,
            "neutral": NEUTRAL_HOVER,
        }.get(kind, BLUE_HOVER)

        overlay = ctk.CTkFrame(self, fg_color=BG, corner_radius=0)
        overlay.place(relx=0, rely=0, relwidth=1, relheight=1)
        overlay.lift()

        box = ctk.CTkFrame(overlay, fg_color=PANEL_ALT, border_width=1, border_color=BORDER, corner_radius=8)
        box.place(relx=0.5, rely=0.5, anchor="center", relwidth=0.46)

        ctk.CTkLabel(
            box,
            text=title,
            text_color=TEXT,
            font=ctk.CTkFont(size=18, weight="bold"),
        ).pack(anchor="w", padx=18, pady=(18, 6))
        ctk.CTkLabel(
            box,
            text=message,
            text_color=MUTED,
            justify="left",
            wraplength=430,
            font=ctk.CTkFont(size=13),
        ).pack(anchor="w", fill="x", padx=18, pady=(0, 18))

        actions = ctk.CTkFrame(box, fg_color="transparent")
        actions.pack(fill="x", padx=18, pady=(0, 18))

        def close(value: bool):
            result.set(value)
            done.set(True)
            overlay.destroy()

        if confirm:
            self._button(actions, "Cancelar", lambda: close(False), width=110).pack(side="right", padx=(8, 0))
            self._button(actions, "Confirmar", lambda: close(True), color=color, hover=hover, width=120).pack(side="right")
        else:
            self._button(actions, "OK", lambda: close(True), color=color, hover=hover, width=100).pack(side="right")

        self.wait_variable(done)
        return result.get()

    def _form_dialog(self, title: str, fields: list[tuple[str, str]]) -> Optional[dict[str, str]]:
        result: dict[str, str] | None = None
        done = tk.BooleanVar(value=False)

        overlay = ctk.CTkFrame(self, fg_color=BG, corner_radius=0)
        overlay.place(relx=0, rely=0, relwidth=1, relheight=1)
        overlay.lift()

        box = ctk.CTkFrame(overlay, fg_color=PANEL_ALT, border_width=1, border_color=BORDER, corner_radius=8)
        box.place(relx=0.5, rely=0.5, anchor="center", relwidth=0.48)

        ctk.CTkLabel(
            box,
            text=title,
            text_color=TEXT,
            font=ctk.CTkFont(size=18, weight="bold"),
        ).pack(anchor="w", padx=18, pady=(18, 10))

        entries: dict[str, ctk.CTkEntry] = {}
        for key, label in fields:
            ctk.CTkLabel(box, text=label, text_color=MUTED).pack(anchor="w", padx=18, pady=(6, 4))
            entry = ctk.CTkEntry(box, height=38, fg_color="#0d1713", border_color=BORDER)
            entry.pack(fill="x", padx=18, pady=(0, 4))
            entries[key] = entry

        actions = ctk.CTkFrame(box, fg_color="transparent")
        actions.pack(fill="x", padx=18, pady=(16, 18))

        def close(value: Optional[dict[str, str]]):
            nonlocal result
            result = value
            done.set(True)
            overlay.destroy()

        def submit():
            close({key: entry.get().strip() for key, entry in entries.items()})

        self._button(actions, "Cancelar", lambda: close(None), width=110).pack(side="right", padx=(8, 0))
        self._button(actions, "Adicionar", submit, color=PRIMARY, hover=PRIMARY_HOVER, width=120).pack(side="right")

        if entries:
            first_entry = next(iter(entries.values()))
            first_entry.focus_set()
            first_entry.bind("<Return>", lambda _event: submit())
        self.wait_variable(done)
        return result

    def _progress_overlay(self, title: str, message: str):
        overlay = ctk.CTkFrame(self, fg_color=BG, corner_radius=0)
        overlay.place(relx=0, rely=0, relwidth=1, relheight=1)
        overlay.lift()

        box = ctk.CTkFrame(overlay, fg_color=PANEL_ALT, border_width=1, border_color=BORDER, corner_radius=8)
        box.place(relx=0.5, rely=0.5, anchor="center", relwidth=0.42)
        ctk.CTkLabel(box, text=title, text_color=TEXT, font=ctk.CTkFont(size=18, weight="bold")).pack(anchor="w", padx=18, pady=(18, 6))
        ctk.CTkLabel(box, text=message, text_color=MUTED).pack(anchor="w", padx=18, pady=(0, 12))
        bar = ctk.CTkProgressBar(box, mode="indeterminate", fg_color="#0d1713", progress_color=PRIMARY)
        bar.pack(fill="x", padx=18, pady=(0, 18))
        bar.start()

        def close():
            try:
                bar.stop()
            except Exception:
                pass
            overlay.destroy()

        return close

    def _file_dialog(self, title: str, extensions: Optional[set[str]] = None) -> Optional[str]:
        selected = tk.StringVar(value="")
        done = tk.BooleanVar(value=False)
        result: str | None = None
        current_dir = Path.home()

        overlay = ctk.CTkFrame(self, fg_color=BG, corner_radius=0)
        overlay.place(relx=0, rely=0, relwidth=1, relheight=1)
        overlay.lift()

        box = ctk.CTkFrame(overlay, fg_color=PANEL_ALT, border_width=1, border_color=BORDER, corner_radius=8)
        box.place(relx=0.5, rely=0.5, anchor="center", relwidth=0.68, relheight=0.72)

        ctk.CTkLabel(box, text=title, text_color=TEXT, font=ctk.CTkFont(size=18, weight="bold")).pack(anchor="w", padx=18, pady=(18, 6))
        lbl_dir = ctk.CTkLabel(box, text="", text_color=MUTED, anchor="w")
        lbl_dir.pack(fill="x", padx=18, pady=(0, 8))

        entry = ctk.CTkEntry(box, textvariable=selected, height=38, fg_color="#0d1713", border_color=BORDER)
        entry.pack(fill="x", padx=18, pady=(0, 10))

        list_box = ctk.CTkScrollableFrame(box, fg_color="#0d1713", border_width=1, border_color=BORDER, corner_radius=8)
        list_box.pack(fill="both", expand=True, padx=18, pady=(0, 12))

        def set_result(value: Optional[str]):
            nonlocal result
            result = value
            done.set(True)
            overlay.destroy()

        def accept():
            raw = selected.get().strip()
            if not raw:
                self._dialog("Selecione um arquivo", "Escolha um arquivo da lista ou informe o caminho completo.", kind="neutral")
                return
            path = Path(raw).expanduser()
            if not path.exists() or not path.is_file():
                self._dialog("Arquivo inválido", f"Arquivo não encontrado:\n{path}", kind="danger")
                return
            if extensions and path.suffix.lower() not in extensions:
                allowed = ", ".join(sorted(extensions))
                self._dialog("Tipo inválido", f"Selecione um arquivo com extensão: {allowed}", kind="danger")
                return
            set_result(str(path))

        def render(path: Path):
            nonlocal current_dir
            current_dir = path
            lbl_dir.configure(text=str(current_dir))
            for child in list_box.winfo_children():
                child.destroy()

            if current_dir.parent != current_dir:
                self._button(list_box, ".. voltar", lambda: render(current_dir.parent), width=140).pack(anchor="w", padx=10, pady=(10, 4))

            try:
                items = sorted(current_dir.iterdir(), key=lambda p: (p.is_file(), p.name.lower()))
            except Exception as e:
                ctk.CTkLabel(list_box, text=f"Não foi possível abrir esta pasta: {e}", text_color="#ff8b86").pack(anchor="w", padx=10, pady=10)
                return

            shown = 0
            for item in items:
                if item.name.startswith("."):
                    continue
                if item.is_file() and extensions and item.suffix.lower() not in extensions:
                    continue
                label = f"[Pasta] {item.name}" if item.is_dir() else item.name
                command = (lambda p=item: render(p)) if item.is_dir() else (lambda p=item: selected.set(str(p)))
                self._button(list_box, label, command, width=520).pack(fill="x", padx=10, pady=4)
                shown += 1
            if shown == 0:
                ctk.CTkLabel(list_box, text="Nenhum arquivo compatível nesta pasta.", text_color=MUTED).pack(anchor="w", padx=10, pady=10)

        actions = ctk.CTkFrame(box, fg_color="transparent")
        actions.pack(fill="x", padx=18, pady=(0, 18))
        self._button(actions, "Cancelar", lambda: set_result(None), width=110).pack(side="right", padx=(8, 0))
        self._button(actions, "Usar arquivo", accept, color=PRIMARY, hover=PRIMARY_HOVER, width=130).pack(side="right")

        render(current_dir)
        entry.bind("<Return>", lambda _event: accept())
        self.wait_variable(done)
        return result

    # --------------------- Ações ---------------------
    def _on_test(self):
        c = self._get_client()
        if not c:
            return
        ok, msg = c.ping()
        if ok:
            state, _ = c.connection_state()
            self.lbl_conn_status.configure(text=f"{msg} · instância: {state or '?'}", text_color="#7ee787")
            self._set_status("Conexão OK")
        else:
            self.lbl_conn_status.configure(text=msg, text_color="#ff7b72")
            self._set_status("Falha na conexão")

    def _on_save_conn(self):
        s = self._collect_settings()
        save_settings(s)
        self.settings = s
        self._set_status("Configuração salva")
        self._dialog("Salvo", "Configurações gravadas. A API Key fica no .env com permissões 600.", kind="success")

    def _on_import_csv(self):
        path = self._file_dialog("Importar CSV", extensions={".csv"})
        if not path:
            return
        try:
            with open(path, "r", encoding="utf-8-sig", newline="") as f:
                reader = csv.DictReader(f)
                cols = reader.fieldnames or []
                if "numero" not in [c.lower() for c in cols]:
                    self._dialog("CSV inválido", "O CSV precisa ter uma coluna chamada numero.", kind="danger")
                    return
                added = 0
                for row in reader:
                    num = (row.get("numero") or row.get("Número") or "").strip()
                    if not num:
                        continue
                    fields = {k: (v or "").strip() for k, v in row.items() if k.lower() != "numero"}
                    self.contacts.append(Contact(number=num, fields=fields))
                    added += 1
                self._csv_columns = cols
                self._refresh_tree()
                self._refresh_contacts_count()
                self._set_status(f"{added} contatos importados de {Path(path).name}")
        except Exception as e:
            self._dialog("Erro", f"Falha ao ler CSV:\n{e}", kind="danger")

    def _on_import_from_whatsapp(self):
        client = self._get_client()
        if not client:
            return
        if not self._dialog(
            "Importar do WhatsApp",
            "Buscar todos os contatos sincronizados na instância?\n"
            "Grupos e contatos sem JID válido serão ignorados.",
            kind="info",
            confirm=True,
        ):
            return

        close_progress = self._progress_overlay("Importando contatos", "Buscando contatos na Evolution API...")

        def worker():
            data, err = client.find_contacts_raw()
            def finish():
                close_progress()
                if data is None:
                    self._dialog("Erro", f"Falha ao buscar contatos:\n{err}", kind="danger")
                    return
                # filtra: type=contact, nao grupo, JID @s.whatsapp.net ou @lid
                valid = []
                seen_nums = set()
                for d in data:
                    if d.get("isGroup"):
                        continue
                    if d.get("type") not in ("contact", None):
                        continue
                    jid = d.get("remoteJid") or ""
                    if "@" not in jid:
                        continue
                    suffix = jid.split("@", 1)[1]
                    if suffix not in ("s.whatsapp.net", "lid"):
                        continue
                    num = jid.split("@", 1)[0]
                    # ignora numeros invalidos (curto demais, só zeros, etc.)
                    digits = re.sub(r"\D+", "", num)
                    if len(digits) < 7 or digits == "0":
                        continue
                    if digits in seen_nums:
                        continue
                    seen_nums.add(digits)
                    name = (d.get("pushName") or d.get("verifiedName") or "").strip() or "(sem nome)"
                    valid.append(Contact(number=digits, fields={"nome": name}))
                if not valid:
                    self._dialog("Vazio", "Nenhum contato válido encontrado na instância.", kind="neutral")
                    return
                added = 0
                # deduz contra os ja existentes pelo numero
                existing = {re.sub(r"\D+", "", c.number) for c in self.contacts}
                for c in valid:
                    if c.number not in existing:
                        self.contacts.append(c)
                        existing.add(c.number)
                        added += 1
                self._refresh_tree()
                self._refresh_contacts_count()
                self._set_status(f"{added} contatos importados do WhatsApp ({len(valid)} encontrados, {len(valid)-added} já existiam)")
                if added:
                    self._append_log(f"Importados {added} contatos do WhatsApp")
                self._dialog(
                    "Concluído",
                    f"Total encontrado: {len(valid)}\n"
                    f"Novos adicionados: {added}\n"
                    f"Já existiam: {len(valid) - added}",
                    kind="success",
                )
            self.after(0, finish)
        threading.Thread(target=worker, daemon=True).start()

    def _on_add_manual(self):
        fields_spec = [("numero", "Número com DDD")]
        for c in self._csv_columns:
            if c.lower() != "numero":
                fields_spec.append((c, c))
        values = self._form_dialog("Adicionar contato", fields_spec)
        if values is None:
            return
        num = (values.get("numero") or "").strip()
        if not num:
            self._dialog("Número obrigatório", "Informe um número para adicionar o contato.", kind="neutral")
            return
        fields: dict = {
            key: value.strip()
            for key, value in values.items()
            if key != "numero"
        }
        self.contacts.append(Contact(number=num, fields=fields))
        self._refresh_tree()
        self._refresh_contacts_count()
        self._set_status("1 contato adicionado")

    def _on_remove_selected(self):
        sel = self.tree.selection()
        if not sel:
            self._dialog(
                "Remover contato",
                "Selecione um ou mais contatos na lista antes de remover.",
                kind="neutral",
            )
            return
        selected_indexes: set[int] = set()
        for item_id in sel:
            try:
                selected_indexes.add(int(item_id))
            except ValueError:
                continue
        selected_indexes = {
            index
            for index in selected_indexes
            if 0 <= index < len(self.contacts)
        }
        if not selected_indexes:
            self._dialog(
                "Remover contato",
                "Não foi possível identificar os contatos selecionados.",
                kind="danger",
            )
            return

        removed_count = len(selected_indexes)
        self.contacts = [
            contact
            for index, contact in enumerate(self.contacts)
            if index not in selected_indexes
        ]
        self._refresh_tree()
        self._refresh_contacts_count()
        suffix = "removido" if removed_count == 1 else "removidos"
        self._set_status(f"{removed_count} contato{'s' if removed_count != 1 else ''} {suffix}")

    def _on_clear_contacts(self):
        if not self.contacts:
            self._dialog("Limpar contatos", "A lista de contatos já está vazia.", kind="neutral")
            return
        if self._dialog("Limpar contatos", "Limpar toda a lista de contatos carregada na tela?", kind="danger", confirm=True):
            self.contacts.clear()
            self._refresh_tree()
            self._refresh_contacts_count()
            self._set_status("Lista de contatos limpa")

    def _refresh_tree(self):
        for i in self.tree.get_children():
            self.tree.delete(i)
        for index, c in enumerate(self.contacts):
            preview = ", ".join(f"{k}={v}" for k, v in list(c.fields.items())[:3])
            self.tree.insert("", "end", iid=str(index), values=(c.number, preview))

    def _on_pick_media(self):
        path = self._file_dialog("Selecionar mídia")
        if path:
            self.entry_media.delete(0, "end")
            self.entry_media.insert(0, path)
            self.lbl_media_status.configure(text=f"Mídia selecionada: {Path(path).name}", text_color=TEXT)

    def _on_preview(self):
        template = self.txt_msg.get("1.0", "end-1c")
        if not self.contacts:
            self.lbl_preview.configure(text="(sem contatos — adicione ou importe um CSV)")
            return
        c = self.contacts[0]
        self.lbl_preview.configure(text="Pré-visualização para " + c.number + ":\n\n" + c.render(template))

    def _selected_media_path(self) -> Optional[Path]:
        media_path = self.entry_media.get().strip()
        if not media_path:
            self._dialog("Sem mídia", "Selecione uma imagem ou PDF antes de gerar texto.", kind="neutral")
            return None

        path = Path(media_path)
        if not path.exists() or not path.is_file():
            self._dialog("Mídia inválida", f"Arquivo não encontrado:\n{media_path}", kind="danger")
            self.lbl_media_status.configure(text="Arquivo de mídia não encontrado.", text_color="#ff8b86")
            return None
        return path

    def _apply_generated_message(self, text: str):
        settings = self._collect_settings()
        self.txt_msg.delete("1.0", "end")
        self.txt_msg.insert("1.0", text)
        settings.last_message = text
        save_settings(settings)
        self.settings = settings
        self.lbl_preview.configure(text="")

    def _on_generate_opencode_message(self):
        path = self._selected_media_path()
        if path is None:
            return

        settings = self._collect_settings()
        save_settings(settings)
        self.settings = settings
        close_progress = self._progress_overlay("Gerando com OpenCode", "Enviando mídia para o modelo configurado...")
        self._set_status("Gerando texto com OpenCode...")

        def worker():
            ok, result = OpenCodeMessageClient(settings.opencode_model).generate_from_file(str(path))

            def finish():
                close_progress()
                if not ok:
                    self._dialog("OpenCode IA", result, kind="danger")
                    self._set_status("Falha ao gerar texto com OpenCode")
                    return
                self._apply_generated_message(result)
                self._set_status("Texto gerado com OpenCode. Revise antes de disparar.")
                self._dialog("Texto gerado", "A mensagem foi preenchida pelo OpenCode. Revise antes de iniciar o disparo.", kind="success")

            self.after(0, finish)

        threading.Thread(target=worker, daemon=True).start()

    def _on_status_update(self, st: Status):
        st = replace(st)
        # chamado pela thread; usa after() para atualizar a UI
        def apply():
            total = max(1, st.total)
            done = st.sent + st.failed + st.skipped
            self.progress.set(min(1.0, done / total))
            self.lbl_sent.configure(text=f"Enviados: {st.sent}")
            self.lbl_failed.configure(text=f"Falharam: {st.failed}")
            self.lbl_pending.configure(text=f"Pendentes: {st.pending}")
            self._refresh_history_count()
            idx = f" [{st.current_index}/{st.total}]" if st.current_index else ""
            self.lbl_state.configure(text=f"Estado: {st.state.value}{idx}")
            if st.state == State.PAUSED:
                self.lbl_state.configure(text_color="#f4d06f")
            elif st.stage in ("auth", "limit", "validating") or st.error:
                self.lbl_state.configure(text_color="#ff8b86")
            elif st.state == State.RUNNING:
                self.lbl_state.configure(text_color="#7ee787")
            else:
                self.lbl_state.configure(text_color=TEXT)

            stage = st.stage
            num = st.current_number
            err = st.error

            # logs por estagio
            if stage == "prevalidating":
                self._append_log("… validando números no WhatsApp (em lote)…")
            elif stage == "prevalidated" and err:
                self._append_log(f"⚠ {err}")
            elif stage == "no_whatsapp" and num:
                self._append_log(f"✗ {num} não tem WhatsApp — pulando")
            elif stage == "connecting" and num:
                self._append_log(f"... verificando conexao para {num}")
            elif stage == "sending" and num:
                self._append_log(f"-> enviando para {num}…")
            elif stage == "sent" and num:
                self._append_log(f"✓ {num} enviado (aceito pela API)")
            elif stage == "skip":
                self._append_log(f"-- {num or 'contato'} pulado (ja enviado antes)")
            elif stage == "limit":
                self._append_log(f"!! {err}")
            elif stage == "auth":
                self._append_log(f"!! {err}")
            elif stage == "validating" and err:
                self._append_log(f"!! {err}")
            elif stage and stage.startswith("waiting "):
                self._append_log(f"   aguardando {stage.split(' ',1)[1]} antes do proximo…")
            elif stage == "done" and st.state in (State.IDLE, State.STOPPED):
                pass  # log final tratado abaixo
            elif err and not num:
                self._append_log(f"!! {err}")

            if st.state in (State.IDLE, State.STOPPED):
                self.btn_start.configure(state="normal")
                self.btn_pause.configure(state="disabled")
                self.btn_resume.configure(state="disabled")
                self.btn_stop.configure(state="disabled")
            if st.stage == "done" and st.state in (State.IDLE, State.STOPPED):
                summary = (
                    f"Finalizado: {st.sent} enviados, {st.failed} falharam, "
                    f"{st.skipped} pulados, {st.pending} pendentes"
                )
                self._append_log(summary)
                self._set_status(summary)
                if self._run_active:
                    self._run_active = False
                    detail = (
                        f"Enviados: {st.sent}\n"
                        f"Falharam: {st.failed}\n"
                        f"Pulados por histórico: {st.skipped}\n"
                        f"Sem WhatsApp: {st.no_whatsapp}\n"
                        f"Números inválidos: {st.invalid}\n"
                        f"Pendentes: {st.pending}"
                    )
                    if st.limit_reached:
                        detail += "\n\nLimite diário atingido."
                    self._dialog("Disparo finalizado", detail, kind="success" if st.failed == 0 else "info")
        self.after(0, apply)

    def _on_start(self):
        if not self.contacts:
            self._dialog("Sem contatos", "Importe ou adicione contatos antes de iniciar.", kind="neutral")
            return
        client = self._get_client()
        if not client:
            return
        template = self.txt_msg.get("1.0", "end-1c").strip()
        if not template and not self.entry_media.get().strip():
            self._dialog("Sem mensagem", "Digite uma mensagem ou selecione uma mídia antes de iniciar.", kind="neutral")
            return
        media_path = self.entry_media.get().strip() or None
        if media_path and not os.path.exists(media_path):
            self._dialog("Mídia inválida", f"Arquivo não encontrado:\n{media_path}", kind="danger")
            self.lbl_media_status.configure(text="Arquivo de mídia não encontrado.", text_color="#ff8b86")
            return

        s = self._collect_settings()
        save_settings(s)

        self.worker = SenderWorker(
            client=client,
            contacts=list(self.contacts),
            template=template,
            media_path=media_path,
            mediatype=self.media_type.get(),
            delay_min=s.delay_min,
            delay_max=s.delay_max,
            daily_limit=s.daily_limit,
            on_status=self._on_status_update,
            validate_first=self.var_validate.get(),
        )
        self.client = client
        self._run_active = True
        self.worker.start()

        self.btn_start.configure(state="disabled")
        self.btn_pause.configure(state="normal")
        self.btn_resume.configure(state="disabled")
        self.btn_stop.configure(state="normal")
        self._set_status("Disparando…")
        self._append_log(f"Iniciando disparo: {len(self.contacts)} contatos, delay {s.delay_min}-{s.delay_max}s, limite {s.daily_limit}/dia")

    def _on_pause(self):
        if self.worker:
            self.worker.pause()
            self.btn_pause.configure(state="disabled")
            self.btn_resume.configure(state="normal")
            self._append_log("Pausado pelo usuário")

    def _on_resume(self):
        if self.worker:
            self.worker.resume()
            self.btn_pause.configure(state="normal")
            self.btn_resume.configure(state="disabled")
            self._append_log("Retomado pelo usuário")

    def _on_stop(self):
        if self._dialog("Parar disparo", "Encerrar o disparo? O que já foi enviado permanece no histórico.", kind="danger", confirm=True):
            if self.worker:
                self.worker.stop()
                self._append_log("Parada solicitada pelo usuário")

    def _on_reset_history(self):
        from sender_worker import SENT_LOG
        if not SENT_LOG.exists():
            self._dialog("Resetar histórico", "Não há histórico para limpar.", kind="neutral")
            return
        try:
            with SENT_LOG.open("r", encoding="utf-8") as f:
                data = json.load(f)
            qtd = len(data) if isinstance(data, list) else 0
        except Exception:
            qtd = 0
        if not self._dialog(
            "Resetar histórico",
            f"Isto apaga o sent_log.json ({qtd} número(s)).\n"
            "Os números serão REENVIADOS no próximo disparo.\n"
            "Tem certeza?",
            kind="danger",
            confirm=True,
        ):
            return
        try:
            SENT_LOG.unlink()
            self._append_log(f"Histórico de envios resetado ({qtd} número(s) removido(s))")
            self._set_status("Histórico resetado")
            self._refresh_history_count()
            self._dialog(
                "Histórico resetado",
                f"{qtd} número(s) removido(s) do histórico de envios.",
                kind="success",
            )
        except Exception as e:
            self._dialog("Erro", f"Falha ao apagar:\n{e}", kind="danger")


def main():
    app = App()
    app.mainloop()


if __name__ == "__main__":
    main()
