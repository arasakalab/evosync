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
from typing import Any, List, Optional

import customtkinter as ctk

from config import Settings, load_settings, save_settings
from evo_client import EvoClient, normalize_number
from opencode_client import OpenCodeMessageClient
from scheduler_store import load_schedules, new_schedule_id, now_iso, save_schedules
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
        screen_w = self.winfo_screenwidth()
        screen_h = self.winfo_screenheight()
        start_w = min(1120, max(760, screen_w - 80))
        start_h = min(760, max(560, screen_h - 120))
        self.geometry(f"{start_w}x{start_h}")
        self.minsize(720, 560)
        self.configure(fg_color=BG)

        self.settings: Settings = load_settings()
        self.contacts: List[Contact] = []
        self.worker: Optional[SenderWorker] = None
        self.client: Optional[EvoClient] = None
        self._csv_columns: List[str] = []
        self._run_active = False
        self.schedules: list[dict[str, Any]] = load_schedules()
        self._app_started_at = datetime.now()
        self._active_schedule_id: Optional[str] = None
        self._compact_layout: Optional[bool] = None
        self._active_scroll_canvas = None
        self._mousewheel_bound = False
        self._editing_schedule_id: Optional[str] = None

        self._build_ui()
        self._load_into_ui()
        self._mark_missed_schedules_on_startup()
        self._refresh_schedule_tree()
        self.bind("<Configure>", self._on_window_resize)
        self.after(1000, self._schedule_loop)

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
            width=1,
            height=1,
            fg_color=PANEL,
            segmented_button_fg_color=PANEL_ALT,
            segmented_button_selected_color=PRIMARY,
            segmented_button_selected_hover_color=PRIMARY_HOVER,
            segmented_button_unselected_color=PANEL_ALT,
            segmented_button_unselected_hover_color=NEUTRAL,
            text_color=TEXT,
        )
        self.tabs.pack(fill="both", expand=True, padx=12, pady=8)
        self.tab_conn = self._add_scroll_tab("Conexão")
        self.tab_contacts = self._add_scroll_tab("Contatos")
        self.tab_msg = self._add_scroll_tab("Mensagem")
        self.tab_send = self._add_scroll_tab("Disparo")
        self.tab_schedule = self._add_scroll_tab("Agenda")

        self._build_conn_tab()
        self._build_contacts_tab()
        self._build_msg_tab()
        self._build_send_tab()
        self._build_schedule_tab()

        self.statusbar = ctk.CTkLabel(
            self,
            text="Pronto",
            anchor="w",
            text_color=MUTED,
            font=ctk.CTkFont(size=12),
        )
        self.statusbar.pack(fill="x", padx=20, pady=(0, 10))

    def _add_scroll_tab(self, name: str):
        outer = self.tabs.add(name)
        outer.configure(fg_color=PANEL)
        scroll = ctk.CTkScrollableFrame(outer, fg_color=PANEL, corner_radius=0)
        scroll.pack(fill="both", expand=True)
        self._bind_mousewheel(scroll)
        return scroll

    def _bind_mousewheel(self, widget):
        canvas = getattr(widget, "_parent_canvas", None)
        if canvas is None:
            return

        if not self._mousewheel_bound:
            self.bind_all("<MouseWheel>", self._on_mousewheel, add="+")
            self.bind_all("<Button-4>", self._on_mousewheel, add="+")
            self.bind_all("<Button-5>", self._on_mousewheel, add="+")
            self._mousewheel_bound = True

        def activate(_event=None):
            self._active_scroll_canvas = canvas

        def deactivate(_event=None):
            if self._active_scroll_canvas is canvas:
                self._active_scroll_canvas = None

        for target in (widget, canvas):
            target.bind("<Enter>", activate, add="+")
            target.bind("<Leave>", deactivate, add="+")

    def _on_mousewheel(self, event):
        canvas = self._active_scroll_canvas
        if canvas is None:
            return None
        try:
            if getattr(event, "num", None) == 4:
                delta = -3
            elif getattr(event, "num", None) == 5:
                delta = 3
            else:
                delta = -1 * int(event.delta / 120) if event.delta else 0
                if delta == 0 and event.delta:
                    delta = -1 if event.delta > 0 else 1
            canvas.yview_scroll(delta, "units")
            return "break"
        except tk.TclError:
            self._active_scroll_canvas = None
            return None

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

    def _flow_button(self, parent, text: str, command, row: int, column: int, color=NEUTRAL, hover=NEUTRAL_HOVER, width=132, **kwargs):
        btn = self._button(parent, text, command, color=color, hover=hover, width=width, **kwargs)
        btn.grid(row=row, column=column, padx=6, pady=6, sticky="ew")
        return btn

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
        for col in range(6):
            top.grid_columnconfigure(col, weight=1)

        self.contact_toolbar_buttons = [
            self._flow_button(top, "Importar CSV", self._on_import_csv, 0, 0, color=PRIMARY, hover=PRIMARY_HOVER),
            self._flow_button(top, "Importar WhatsApp", self._on_import_from_whatsapp, 0, 1, color=BLUE, hover=BLUE_HOVER, width=158),
            self._flow_button(top, "Adicionar", self._on_add_manual, 0, 2, width=112),
            self._flow_button(top, "Remover", self._on_remove_selected, 0, 3, width=112),
            self._flow_button(top, "Limpar", self._on_clear_contacts, 0, 4, color=DANGER, hover=DANGER_HOVER, width=96),
        ]
        self.lbl_contacts_count = ctk.CTkLabel(top, text="0 contatos", text_color=TEXT, font=ctk.CTkFont(size=13, weight="bold"))
        self.lbl_contacts_count.grid(row=0, column=5, padx=12, pady=6, sticky="e")
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
        media.grid_columnconfigure(6, weight=1)
        ctk.CTkLabel(media, text="Mídia opcional", text_color=MUTED).grid(row=0, column=0, padx=(16, 8), pady=14, sticky="w")
        self.entry_media = ctk.CTkEntry(media, placeholder_text="caminho do arquivo...", fg_color="#0d1713", border_color=BORDER, height=36)
        self.entry_media.grid(row=0, column=1, columnspan=4, padx=8, pady=14, sticky="ew")
        self._button(media, "Procurar", self._on_pick_media, width=104).grid(row=0, column=5, padx=(6, 16), pady=14)
        ctk.CTkLabel(media, text="Tipo", text_color=MUTED).grid(row=1, column=0, padx=(16, 4), pady=(0, 14), sticky="w")
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
        self.media_type.grid(row=1, column=1, padx=6, pady=(0, 14), sticky="w")
        self._button(media, "Pré-visualizar", self._on_preview, color=BLUE, hover=BLUE_HOVER, width=130).grid(row=1, column=2, padx=6, pady=(0, 14), sticky="ew")
        self._button(media, "OpenCode IA", self._on_generate_opencode_message, color=PRIMARY, hover=PRIMARY_HOVER, width=140).grid(row=1, column=3, padx=(6, 16), pady=(0, 14), sticky="ew")
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
        for col in range(6):
            params.grid_columnconfigure(col, weight=1)
        ctk.CTkLabel(params, text="Delay mínimo (s)", text_color=MUTED).grid(row=0, column=0, padx=(16, 6), pady=(16, 8), sticky="w")
        self.spin_min = ctk.CTkEntry(params, width=86, height=36, fg_color="#0d1713", border_color=BORDER)
        self.spin_min.grid(row=0, column=1, padx=6, pady=(16, 8), sticky="ew")
        ctk.CTkLabel(params, text="Delay máximo (s)", text_color=MUTED).grid(row=0, column=2, padx=(18, 6), pady=(16, 8), sticky="w")
        self.spin_max = ctk.CTkEntry(params, width=86, height=36, fg_color="#0d1713", border_color=BORDER)
        self.spin_max.grid(row=0, column=3, padx=6, pady=(16, 8), sticky="ew")
        ctk.CTkLabel(params, text="Limite diário", text_color=MUTED).grid(row=0, column=4, padx=(18, 6), pady=(16, 8), sticky="w")
        self.spin_limit = ctk.CTkEntry(params, width=86, height=36, fg_color="#0d1713", border_color=BORDER)
        self.spin_limit.grid(row=0, column=5, padx=(6, 16), pady=(16, 8), sticky="ew")

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
        self.var_resend_sent = tk.BooleanVar(value=True)
        ctk.CTkCheckBox(
            params,
            text="Reenviar números já no histórico (não precisa resetar)",
            variable=self.var_resend_sent,
            fg_color=PRIMARY,
            hover_color=PRIMARY_HOVER,
            border_color=BORDER,
            text_color=TEXT,
        ).grid(row=2, column=0, columnspan=6, padx=16, pady=(0, 16), sticky="w")

        btns = ctk.CTkFrame(f, fg_color="transparent")
        btns.pack(fill="x", padx=18, pady=8)
        for col in range(6):
            btns.grid_columnconfigure(col, weight=1)
        self.btn_start = self._button(btns, "Iniciar", self._on_start, color=PRIMARY, hover=PRIMARY_HOVER, width=112)
        self.btn_start.grid(row=0, column=0, padx=6, pady=6, sticky="ew")
        self.btn_pause = self._button(btns, "Pausar", self._on_pause, state="disabled", width=112)
        self.btn_pause.grid(row=0, column=1, padx=6, pady=6, sticky="ew")
        self.btn_resume = self._button(btns, "Retomar", self._on_resume, state="disabled", width=112)
        self.btn_resume.grid(row=0, column=2, padx=6, pady=6, sticky="ew")
        self.btn_stop = self._button(btns, "Parar", self._on_stop, color=DANGER, hover=DANGER_HOVER, state="disabled", width=112)
        self.btn_stop.grid(row=0, column=3, padx=6, pady=6, sticky="ew")
        self.btn_reset_history = self._button(btns, "Resetar histórico", self._on_reset_history, width=150)
        self.btn_reset_history.grid(row=0, column=5, padx=6, pady=6, sticky="ew")
        self.send_buttons = [self.btn_start, self.btn_pause, self.btn_resume, self.btn_stop, self.btn_reset_history]

        self.progress = ctk.CTkProgressBar(f, fg_color="#0d1713", progress_color=PRIMARY)
        self.progress.set(0)
        self.progress.pack(fill="x", padx=18, pady=(8, 6))

        counters = self._panel(f)
        for col in range(5):
            counters.grid_columnconfigure(col, weight=1)
        self.lbl_sent = ctk.CTkLabel(counters, text="Enviados: 0", text_color="#7ee787", font=ctk.CTkFont(size=13, weight="bold"))
        self.lbl_sent.grid(row=0, column=0, padx=8, pady=10, sticky="w")
        self.lbl_failed = ctk.CTkLabel(counters, text="Falharam: 0", text_color="#ff8b86", font=ctk.CTkFont(size=13, weight="bold"))
        self.lbl_failed.grid(row=0, column=1, padx=8, pady=10, sticky="w")
        self.lbl_pending = ctk.CTkLabel(counters, text="Pendentes: 0", text_color="#f4d06f", font=ctk.CTkFont(size=13, weight="bold"))
        self.lbl_pending.grid(row=0, column=2, padx=8, pady=10, sticky="w")
        self.lbl_history = ctk.CTkLabel(counters, text="Histórico: 0", text_color=MUTED, font=ctk.CTkFont(size=13, weight="bold"))
        self.lbl_history.grid(row=0, column=3, padx=8, pady=10, sticky="w")
        self.lbl_state = ctk.CTkLabel(counters, text="Estado: idle", text_color=TEXT, font=ctk.CTkFont(size=13, weight="bold"))
        self.lbl_state.grid(row=0, column=4, padx=8, pady=10, sticky="e")
        self.counter_labels = [self.lbl_sent, self.lbl_failed, self.lbl_pending, self.lbl_history, self.lbl_state]

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

    def _build_schedule_tab(self):
        f = self.tab_schedule
        self._section_title(
            f,
            "Agenda",
            "Programe um disparo único com mensagem própria e envio automático.",
        )

        form = self._panel(f)
        form.grid_columnconfigure(5, weight=1)

        ctk.CTkLabel(form, text="Data", text_color=MUTED).grid(row=0, column=0, padx=(16, 6), pady=(16, 8), sticky="w")
        self.entry_schedule_date = ctk.CTkEntry(form, width=120, height=36, placeholder_text="DD/MM/AAAA", fg_color="#0d1713", border_color=BORDER)
        self.entry_schedule_date.grid(row=0, column=1, padx=6, pady=(16, 8), sticky="w")
        self.entry_schedule_date.insert(0, datetime.now().strftime("%d/%m/%Y"))

        ctk.CTkLabel(form, text="Hora", text_color=MUTED).grid(row=0, column=2, padx=(14, 6), pady=(16, 8), sticky="w")
        self.entry_schedule_time = ctk.CTkEntry(form, width=90, height=36, placeholder_text="HH:MM", fg_color="#0d1713", border_color=BORDER)
        self.entry_schedule_time.grid(row=0, column=3, padx=6, pady=(16, 8), sticky="w")
        self.entry_schedule_time.insert(0, datetime.now().strftime("%H:%M"))

        ctk.CTkLabel(form, text="Contatos", text_color=MUTED).grid(row=0, column=4, padx=(14, 6), pady=(16, 8), sticky="w")
        self.schedule_contact_mode = ctk.CTkOptionMenu(
            form,
            values=["Congelar contatos atuais", "Usar contatos da tela no horário"],
            fg_color=NEUTRAL,
            button_color=PRIMARY,
            button_hover_color=PRIMARY_HOVER,
            dropdown_fg_color=PANEL_ALT,
            dropdown_hover_color=NEUTRAL,
            width=240,
        )
        self.schedule_contact_mode.grid(row=0, column=5, padx=(6, 16), pady=(16, 8), sticky="w")

        ctk.CTkLabel(form, text="Mensagem agendada", text_color=MUTED).grid(row=1, column=0, columnspan=6, padx=16, pady=(8, 4), sticky="w")
        self.txt_schedule_msg = ctk.CTkTextbox(
            form,
            height=130,
            font=ctk.CTkFont(size=14),
            fg_color="#0d1713",
            border_color=BORDER,
            border_width=1,
            corner_radius=8,
        )
        self.txt_schedule_msg.grid(row=2, column=0, columnspan=6, padx=16, pady=(0, 10), sticky="ew")

        actions = ctk.CTkFrame(form, fg_color="transparent")
        actions.grid(row=3, column=0, columnspan=6, padx=16, pady=(0, 14), sticky="ew")
        for col in range(4):
            actions.grid_columnconfigure(col, weight=1)
        self.btn_schedule_copy = self._button(actions, "Copiar mensagem atual", self._copy_current_message_to_schedule, width=178)
        self.btn_schedule_save = self._button(actions, "Agendar", self._on_save_schedule_form, color=PRIMARY, hover=PRIMARY_HOVER, width=112)
        self.btn_schedule_edit = self._button(actions, "Editar pendente", self._on_edit_schedule, color=BLUE, hover=BLUE_HOVER, width=140)
        self.btn_schedule_delete = self._button(actions, "Excluir selecionadas", self._on_delete_selected_schedules, color=DANGER, hover=DANGER_HOVER, width=168)
        self.btn_schedule_delete_all = self._button(actions, "Excluir todas", self._on_delete_all_schedules, color=DANGER, hover=DANGER_HOVER, width=126)
        self.btn_schedule_refresh = self._button(actions, "Atualizar lista", self._refresh_schedule_tree, width=130)
        self.schedule_action_buttons = [
            self.btn_schedule_copy,
            self.btn_schedule_save,
            self.btn_schedule_edit,
            self.btn_schedule_delete,
            self.btn_schedule_delete_all,
            self.btn_schedule_refresh,
        ]
        for col, button in enumerate(self.schedule_action_buttons):
            button.grid(row=0, column=col, padx=6, pady=6, sticky="ew")

        self.lbl_schedule_hint = ctk.CTkLabel(
            f,
            text="O agendamento usa os delays, limite diário, validação e mídia configurados atualmente nas abas Mensagem e Disparo.",
            text_color=MUTED,
        )
        self.lbl_schedule_hint.pack(anchor="w", padx=18, pady=(0, 4))

        cols = ("when", "status", "contacts", "mode", "message")
        self.schedule_tree = ttk.Treeview(f, columns=cols, show="headings", height=12, selectmode="extended")
        self.schedule_tree.heading("when", text="Data/Hora")
        self.schedule_tree.heading("status", text="Status")
        self.schedule_tree.heading("contacts", text="Contatos")
        self.schedule_tree.heading("mode", text="Modo")
        self.schedule_tree.heading("message", text="Mensagem")
        self.schedule_tree.column("when", width=150, anchor="w")
        self.schedule_tree.column("status", width=100, anchor="w")
        self.schedule_tree.column("contacts", width=90, anchor="center")
        self.schedule_tree.column("mode", width=170, anchor="w")
        self.schedule_tree.column("message", width=560, anchor="w")
        self.schedule_tree.pack(fill="both", expand=True, padx=18, pady=(4, 16))

    # --------------------- Helpers ---------------------
    def _load_into_ui(self):
        self.entry_url.insert(0, self.settings.url)
        self.entry_key.insert(0, self.settings.api_key)
        self.entry_instance.insert(0, self.settings.instance)
        self.entry_opencode_model.insert(0, self.settings.opencode_model)
        self.spin_min.insert(0, str(self.settings.delay_min))
        self.spin_max.insert(0, str(self.settings.delay_max))
        self.spin_limit.insert(0, str(self.settings.daily_limit))
        self.var_resend_sent.set(self.settings.resend_sent)
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
        s.resend_sent = self.var_resend_sent.get()
        return s

    def _get_client(self) -> Optional[EvoClient]:
        s = self._collect_settings()
        if not s.api_key or not s.instance:
            self._dialog("Faltam dados", "Preencha API Key e Nome da Instância na aba Conexão.", kind="neutral")
            return None
        return EvoClient(s.url, s.api_key, s.instance)

    def _get_client_silent(self) -> Optional[EvoClient]:
        s = self._collect_settings()
        if not s.api_key or not s.instance:
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

    def _on_window_resize(self, event):
        if event.widget is not self:
            return
        width = max(720, int(event.width))
        compact = width < 860
        if compact != self._compact_layout:
            self._compact_layout = compact
            self._apply_responsive_layout(compact)

        wrap = max(360, width - 150)
        if hasattr(self, "lbl_preview"):
            self.lbl_preview.configure(wraplength=wrap)
        if hasattr(self, "tree"):
            self.tree.column("numero", width=160 if compact else 200)
            self.tree.column("preview", width=max(360, width - 340))
        if hasattr(self, "schedule_tree"):
            self.schedule_tree.column("when", width=130 if compact else 150)
            self.schedule_tree.column("status", width=90 if compact else 100)
            self.schedule_tree.column("contacts", width=80 if compact else 90)
            self.schedule_tree.column("mode", width=125 if compact else 170)
            self.schedule_tree.column("message", width=max(300, width - (500 if compact else 620)))

    def _apply_responsive_layout(self, compact: bool):
        if hasattr(self, "contact_toolbar_buttons"):
            if compact:
                positions = [(0, 0), (0, 1), (0, 2), (1, 0), (1, 1)]
                for button, (row, col) in zip(self.contact_toolbar_buttons, positions):
                    button.grid_configure(row=row, column=col, sticky="ew")
                self.lbl_contacts_count.grid_configure(row=1, column=2, sticky="e")
            else:
                for col, button in enumerate(self.contact_toolbar_buttons):
                    button.grid_configure(row=0, column=col, sticky="ew")
                self.lbl_contacts_count.grid_configure(row=0, column=5, sticky="e")

        if hasattr(self, "send_buttons"):
            if compact:
                positions = [(0, 0), (0, 1), (0, 2), (1, 0), (1, 1)]
            else:
                positions = [(0, 0), (0, 1), (0, 2), (0, 3), (0, 5)]
            for button, (row, col) in zip(self.send_buttons, positions):
                button.grid_configure(row=row, column=col, sticky="ew")

        if hasattr(self, "counter_labels"):
            if compact:
                positions = [(0, 0), (0, 1), (0, 2), (1, 0), (1, 1)]
            else:
                positions = [(0, 0), (0, 1), (0, 2), (0, 3), (0, 4)]
            for label, (row, col) in zip(self.counter_labels, positions):
                label.grid_configure(row=row, column=col, sticky="w")

        if hasattr(self, "schedule_action_buttons"):
            positions = (
                [(0, 0), (0, 1), (1, 0), (1, 1), (2, 0), (2, 1)]
                if compact
                else [(0, 0), (0, 1), (0, 2), (0, 3), (1, 0), (1, 1)]
            )
            for button, (row, col) in zip(self.schedule_action_buttons, positions):
                button.grid_configure(row=row, column=col, sticky="ew")

    def _save_schedules(self):
        save_schedules(self.schedules)
        self._refresh_schedule_tree()

    def _schedule_by_id(self, schedule_id: str) -> Optional[dict[str, Any]]:
        for schedule in self.schedules:
            if schedule.get("id") == schedule_id:
                return schedule
        return None

    def _contact_to_dict(self, contact: Contact) -> dict[str, Any]:
        return {"number": contact.number, "fields": dict(contact.fields)}

    def _contact_from_dict(self, data: dict[str, Any]) -> Contact:
        fields = data.get("fields") if isinstance(data.get("fields"), dict) else {}
        return Contact(number=str(data.get("number") or ""), fields=fields)

    def _parse_schedule_datetime(self) -> Optional[datetime]:
        raw_date = self.entry_schedule_date.get().strip()
        raw_time = self.entry_schedule_time.get().strip()
        try:
            return datetime.strptime(f"{raw_date} {raw_time}", "%d/%m/%Y %H:%M")
        except ValueError:
            self._dialog("Data inválida", "Use data no formato DD/MM/AAAA e hora no formato HH:MM.", kind="neutral")
            return None

    def _format_schedule_datetime(self, value: str) -> str:
        try:
            dt = datetime.fromisoformat(value)
            return dt.strftime("%d/%m/%Y %H:%M")
        except ValueError:
            return value

    def _copy_current_message_to_schedule(self):
        message = self.txt_msg.get("1.0", "end-1c")
        self.txt_schedule_msg.delete("1.0", "end")
        self.txt_schedule_msg.insert("1.0", message)
        self._set_status("Mensagem atual copiada para a agenda")

    def _on_save_schedule_form(self):
        if self._editing_schedule_id:
            self._on_update_schedule()
        else:
            self._on_add_schedule()

    def _schedule_form_payload(self, existing: Optional[dict[str, Any]] = None) -> Optional[dict[str, Any]]:
        scheduled_at = self._parse_schedule_datetime()
        if scheduled_at is None:
            return None
        if scheduled_at <= datetime.now():
            self._dialog("Horário inválido", "Escolha uma data e hora no futuro.", kind="neutral")
            return None

        message = self.txt_schedule_msg.get("1.0", "end-1c").strip()
        media_path = self.entry_media.get().strip()
        if not message and not media_path:
            self._dialog("Sem mensagem", "Digite uma mensagem agendada ou selecione uma mídia antes de agendar.", kind="neutral")
            return None
        if media_path and not os.path.exists(media_path):
            self._dialog("Mídia inválida", f"Arquivo não encontrado:\n{media_path}", kind="danger")
            return None

        mode_label = self.schedule_contact_mode.get()
        contact_mode = "current" if "tela" in mode_label.lower() else "snapshot"
        contacts_snapshot = []
        if contact_mode == "snapshot":
            if self.contacts:
                contacts_snapshot = [self._contact_to_dict(contact) for contact in self.contacts]
            elif existing and existing.get("contact_mode") == "snapshot" and existing.get("contacts"):
                contacts_snapshot = list(existing.get("contacts") or [])
            else:
                self._dialog("Sem contatos", "Carregue contatos antes de criar um agendamento congelado.", kind="neutral")
                return None

        s = self._collect_settings()
        return {
            "id": new_schedule_id(),
            "created_at": now_iso(),
            "updated_at": now_iso(),
            "scheduled_at": scheduled_at.isoformat(timespec="seconds"),
            "status": "pending",
            "message": message,
            "media_path": media_path,
            "media_type": self.media_type.get(),
            "delay_min": s.delay_min,
            "delay_max": s.delay_max,
            "daily_limit": s.daily_limit,
            "validate_first": self.var_validate.get(),
            "skip_sent_history": not self.var_resend_sent.get(),
            "contact_mode": contact_mode,
            "contacts": contacts_snapshot,
            "error": "",
            "summary": "",
        }

    def _on_add_schedule(self):
        schedule = self._schedule_form_payload()
        if schedule is None:
            return
        self.schedules.append(schedule)
        self._save_schedules()
        contact_text = "contatos da tela no horário" if schedule["contact_mode"] == "current" else f"{len(schedule['contacts'])} contatos congelados"
        self._set_status(f"Agendamento criado para {self._format_schedule_datetime(schedule['scheduled_at'])} com {contact_text}")

    def _on_update_schedule(self):
        schedule = self._schedule_by_id(self._editing_schedule_id or "")
        if not schedule:
            self._finish_schedule_editing()
            self._dialog("Agenda", "Agendamento em edição não foi encontrado.", kind="danger")
            return
        if schedule.get("status") != "pending":
            self._finish_schedule_editing()
            self._dialog("Agenda", "Somente agendamentos pendentes podem ser editados.", kind="neutral")
            return
        payload = self._schedule_form_payload(existing=schedule)
        if payload is None:
            return
        keep = {"id": schedule["id"], "created_at": schedule.get("created_at") or now_iso()}
        schedule.clear()
        schedule.update(payload)
        schedule.update(keep)
        schedule["updated_at"] = now_iso()
        self._finish_schedule_editing()
        self._save_schedules()
        self._set_status("Agendamento pendente atualizado")

    def _selected_schedule(self) -> Optional[dict[str, Any]]:
        if not hasattr(self, "schedule_tree"):
            return None
        selection = self.schedule_tree.selection()
        if not selection:
            self._dialog("Agenda", "Selecione um agendamento na lista.", kind="neutral")
            return None
        return self._schedule_by_id(selection[0])

    def _selected_schedule_ids(self) -> list[str]:
        if not hasattr(self, "schedule_tree"):
            return []
        return [str(item) for item in self.schedule_tree.selection()]

    def _on_edit_schedule(self):
        schedule = self._selected_schedule()
        if not schedule:
            return
        if schedule.get("status") != "pending":
            self._dialog("Editar agendamento", "Somente mensagens pendentes podem ser editadas.", kind="neutral")
            return

        try:
            scheduled_at = datetime.fromisoformat(str(schedule.get("scheduled_at")))
        except ValueError:
            self._dialog("Editar agendamento", "Este agendamento está com data inválida.", kind="danger")
            return

        self._editing_schedule_id = str(schedule.get("id"))
        self.entry_schedule_date.delete(0, "end")
        self.entry_schedule_date.insert(0, scheduled_at.strftime("%d/%m/%Y"))
        self.entry_schedule_time.delete(0, "end")
        self.entry_schedule_time.insert(0, scheduled_at.strftime("%H:%M"))
        self.txt_schedule_msg.delete("1.0", "end")
        self.txt_schedule_msg.insert("1.0", str(schedule.get("message") or ""))
        self.schedule_contact_mode.set(
            "Usar contatos da tela no horário"
            if schedule.get("contact_mode") == "current"
            else "Congelar contatos atuais"
        )
        self.entry_media.delete(0, "end")
        if schedule.get("media_path"):
            self.entry_media.insert(0, str(schedule.get("media_path")))
        self.media_type.set(str(schedule.get("media_type") or "image"))
        self.var_validate.set(bool(schedule.get("validate_first", True)))
        self.var_resend_sent.set(not bool(schedule.get("skip_sent_history", False)))
        self.btn_schedule_save.configure(text="Salvar edição")
        self._set_status("Editando agendamento pendente")

    def _finish_schedule_editing(self):
        self._editing_schedule_id = None
        if hasattr(self, "btn_schedule_save"):
            self.btn_schedule_save.configure(text="Agendar")

    def _on_delete_selected_schedules(self):
        selected_ids = self._selected_schedule_ids()
        if not selected_ids:
            self._dialog("Excluir agendamento", "Selecione uma ou mais mensagens agendadas para excluir.", kind="neutral")
            return
        selected = [schedule for schedule in self.schedules if schedule.get("id") in selected_ids]
        running = [schedule for schedule in selected if schedule.get("status") == "running"]
        if running:
            self._dialog("Excluir agendamento", "Não é possível excluir uma mensagem agendada que está em execução.", kind="neutral")
            return
        count = len(selected)
        if not self._dialog(
            "Excluir agendamento",
            f"Excluir {count} mensagem(ns) agendada(s) selecionada(s)?",
            kind="danger",
            confirm=True,
        ):
            return
        self.schedules = [schedule for schedule in self.schedules if schedule.get("id") not in selected_ids]
        if self._editing_schedule_id in selected_ids:
            self._finish_schedule_editing()
        self._save_schedules()
        self._set_status(f"{count} mensagem(ns) agendada(s) excluída(s)")

    def _on_delete_all_schedules(self):
        if not self.schedules:
            self._dialog("Excluir todas", "Não há mensagens agendadas para excluir.", kind="neutral")
            return
        if any(schedule.get("status") == "running" for schedule in self.schedules):
            self._dialog("Excluir todas", "Não é possível excluir tudo enquanto há agendamento em execução.", kind="neutral")
            return
        count = len(self.schedules)
        if not self._dialog(
            "Excluir todas",
            f"Excluir todas as {count} mensagens agendadas da lista?",
            kind="danger",
            confirm=True,
        ):
            return
        self.schedules.clear()
        self._finish_schedule_editing()
        self._save_schedules()
        self._set_status("Todas as mensagens agendadas foram excluídas")

    def _on_cancel_schedule(self):
        schedule = self._selected_schedule()
        if not schedule:
            return
        if schedule.get("status") not in {"pending", "failed", "missed"}:
            self._dialog("Agenda", "Somente agendamentos pendentes, perdidos ou com falha podem ser cancelados.", kind="neutral")
            return
        schedule["status"] = "cancelled"
        schedule["updated_at"] = now_iso()
        schedule["error"] = "Cancelado pelo usuário"
        self._save_schedules()
        self._set_status("Agendamento cancelado")

    def _refresh_schedule_tree(self):
        if not hasattr(self, "schedule_tree"):
            return
        for item in self.schedule_tree.get_children():
            self.schedule_tree.delete(item)
        ordered = sorted(self.schedules, key=lambda item: item.get("scheduled_at", ""))
        for schedule in ordered:
            mode = "Lista atual" if schedule.get("contact_mode") == "current" else "Congelado"
            contacts_count = "atual" if schedule.get("contact_mode") == "current" else str(len(schedule.get("contacts") or []))
            message = (schedule.get("message") or schedule.get("summary") or schedule.get("error") or "").replace("\n", " ")
            if len(message) > 90:
                message = message[:87] + "..."
            self.schedule_tree.insert(
                "",
                "end",
                iid=schedule.get("id"),
                values=(
                    self._format_schedule_datetime(str(schedule.get("scheduled_at") or "")),
                    schedule.get("status", ""),
                    contacts_count,
                    mode,
                    message,
                ),
            )

    def _mark_missed_schedules_on_startup(self):
        changed = False
        for schedule in self.schedules:
            if schedule.get("status") == "running":
                schedule["status"] = "failed"
                schedule["updated_at"] = now_iso()
                schedule["error"] = "O app foi fechado durante este agendamento."
                changed = True
                continue
            if schedule.get("status") != "pending":
                continue
            try:
                scheduled_at = datetime.fromisoformat(str(schedule.get("scheduled_at")))
            except ValueError:
                continue
            if scheduled_at < self._app_started_at:
                schedule["status"] = "missed"
                schedule["updated_at"] = now_iso()
                schedule["error"] = "O app estava fechado no horário agendado."
                changed = True
        if changed:
            save_schedules(self.schedules)

    def _schedule_loop(self):
        try:
            self._check_due_schedules()
        finally:
            self.after(30000, self._schedule_loop)

    def _check_due_schedules(self):
        if self.worker and self.worker.is_alive():
            return
        now = datetime.now()
        due = []
        for schedule in self.schedules:
            if schedule.get("status") != "pending":
                continue
            try:
                scheduled_at = datetime.fromisoformat(str(schedule.get("scheduled_at")))
            except ValueError:
                continue
            if scheduled_at <= now:
                due.append(schedule)
        if not due:
            return
        due.sort(key=lambda item: item.get("scheduled_at", ""))
        self._start_scheduled_send(due[0])

    def _fail_schedule(self, schedule: dict[str, Any], message: str):
        schedule["status"] = "failed"
        schedule["updated_at"] = now_iso()
        schedule["error"] = message
        self._save_schedules()
        self._append_log(f"Agendamento falhou: {message}")
        self._set_status(f"Agendamento falhou: {message}")

    def _start_scheduled_send(self, schedule: dict[str, Any]):
        if schedule.get("contact_mode") == "current":
            contacts = list(self.contacts)
        else:
            contacts = [self._contact_from_dict(item) for item in schedule.get("contacts") or [] if isinstance(item, dict)]
        if not contacts:
            self._fail_schedule(schedule, "Nenhum contato disponível para o envio agendado.")
            return

        media_path = str(schedule.get("media_path") or "").strip() or None
        if media_path and not os.path.exists(media_path):
            self._fail_schedule(schedule, f"Arquivo de mídia não encontrado: {media_path}")
            return

        if not str(schedule.get("message") or "").strip() and not media_path:
            self._fail_schedule(schedule, "Mensagem e mídia vazias.")
            return

        client = self._get_client_silent()
        if not client:
            self._fail_schedule(schedule, "Credenciais da Evolution ausentes ou inválidas.")
            return

        schedule["status"] = "running"
        schedule["updated_at"] = now_iso()
        schedule["error"] = ""
        self._active_schedule_id = str(schedule.get("id"))
        self._save_schedules()
        self._append_log(f"Iniciando agendamento de {self._format_schedule_datetime(str(schedule.get('scheduled_at')))}")

        started = self._start_send_job(
            client=client,
            contacts=contacts,
            template=str(schedule.get("message") or ""),
            media_path=media_path,
            mediatype=str(schedule.get("media_type") or "image"),
            delay_min=int(schedule.get("delay_min") or 8),
            delay_max=int(schedule.get("delay_max") or 25),
            daily_limit=int(schedule.get("daily_limit") or 200),
            validate_first=bool(schedule.get("validate_first", True)),
            skip_sent_history=bool(schedule.get("skip_sent_history", False)),
            source="schedule",
        )
        if not started:
            self._active_schedule_id = None
            self._fail_schedule(schedule, "Não foi possível iniciar o envio agendado.")

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
        self._bind_mousewheel(list_box)

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
                if self._active_schedule_id:
                    schedule = self._schedule_by_id(self._active_schedule_id)
                    if schedule:
                        incomplete = st.failed > 0 or st.pending > 0 or st.limit_reached or st.state == State.STOPPED
                        schedule["status"] = "failed" if incomplete else "sent"
                        schedule["updated_at"] = now_iso()
                        schedule["summary"] = summary
                        schedule["error"] = st.error if incomplete else ""
                        self._save_schedules()
                    self._active_schedule_id = None
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

    def _start_send_job(
        self,
        client: EvoClient,
        contacts: list[Contact],
        template: str,
        media_path: Optional[str],
        mediatype: str,
        delay_min: int,
        delay_max: int,
        daily_limit: int,
        validate_first: bool,
        skip_sent_history: bool,
        source: str = "manual",
    ) -> bool:
        if self.worker and self.worker.is_alive():
            self._dialog("Disparo em andamento", "Aguarde o disparo atual terminar antes de iniciar outro.", kind="neutral")
            return False
        self.worker = SenderWorker(
            client=client,
            contacts=list(contacts),
            template=template,
            media_path=media_path,
            mediatype=mediatype,
            delay_min=delay_min,
            delay_max=delay_max,
            daily_limit=daily_limit,
            on_status=self._on_status_update,
            validate_first=validate_first,
            skip_sent_history=skip_sent_history,
        )
        self.client = client
        self._run_active = True
        self.worker.start()

        self.btn_start.configure(state="disabled")
        self.btn_pause.configure(state="normal")
        self.btn_resume.configure(state="disabled")
        self.btn_stop.configure(state="normal")
        self._set_status("Disparando…")
        prefix = "agendado" if source == "schedule" else "manual"
        self._append_log(f"Iniciando disparo {prefix}: {len(contacts)} contatos, delay {delay_min}-{delay_max}s, limite {daily_limit}/dia")
        return True

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
        self._active_schedule_id = None
        self._start_send_job(
            client=client,
            contacts=list(self.contacts),
            template=template,
            media_path=media_path,
            mediatype=self.media_type.get(),
            delay_min=s.delay_min,
            delay_max=s.delay_max,
            daily_limit=s.daily_limit,
            validate_first=self.var_validate.get(),
            skip_sent_history=not self.var_resend_sent.get(),
        )

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
