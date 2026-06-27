import { api } from "@/lib/api";
import { refetchContactsWithActiveFilters } from "@/lib/contacts-refetch";
import { useAppStore } from "@/lib/store";

/** Atualiza contagem do histórico de envios. */
export async function refreshSentHistoryCount(): Promise<void> {
  try {
    const r = await api.send.sentLogCount();
    useAppStore.getState().setSentHistoryCount(r.count);
  } catch {
    /* silencioso */
  }
}

/** Recarrega agendamentos. */
export async function refreshSchedules(): Promise<void> {
  try {
    const list = await api.schedules.list();
    useAppStore.getState().setSchedules(list);
  } catch {
    /* silencioso */
  }
}

/** Recarrega settings (managed_status, evo_mode, etc.). */
export async function refreshSettings(): Promise<void> {
  try {
    const fresh = await api.settings.get();
    useAppStore.getState().setSettings(fresh);
  } catch {
    /* silencioso */
  }
}

/** Recarrega seleção persistida (IDs para envio). */
export async function refreshSelection(): Promise<void> {
  if (useAppStore.getState().selectionDirty) return;
  try {
    const sel = await api.contacts.getSelection();
    useAppStore.getState().setSelectedIds(sel.ids);
  } catch {
    /* silencioso */
  }
}

/** Recarrega listas de contatos. */
export async function refreshContactLists(): Promise<void> {
  try {
    const lists = await api.contactLists.list();
    useAppStore.getState().setContactLists(lists);
  } catch {
    /* silencioso */
  }
}

/** Recarrega contatos respeitando filtros ativos da tela. */
export async function refreshContactsFiltered(): Promise<void> {
  try {
    await refetchContactsWithActiveFilters();
  } catch {
    /* silencioso */
  }
}

/** Status do disparo em andamento. */
export async function refreshSendStatus(): Promise<void> {
  try {
    const status = await api.send.status();
    useAppStore.getState().setStatus(status);
  } catch {
    /* silencioso */
  }
}

/** Conexão WhatsApp + managed_status. */
export async function refreshConnection(): Promise<void> {
  try {
    const s = await api.connection.status();
    useAppStore.getState().setConnection({
      ok: s.ok,
      state: s.state,
      msg: s.error || (s.ok ? "Conectado" : "Desconectado"),
      checkedAt: new Date().toISOString(),
    });
    if (s.mode === "managed" && s.managedStatus) {
      const current = useAppStore.getState().settings;
      if (current.managed_status !== s.managedStatus) {
        useAppStore.getState().setSettings({
          ...current,
          managed_status: s.managedStatus,
        });
      }
    }
  } catch {
    /* silencioso */
  }
}

/** Refresh leve ao voltar para a aba ou receber evento WS. */
export async function refreshOnExternalChange(): Promise<void> {
  const { selectionLoaded } = useAppStore.getState();
  await Promise.all([
    refreshSettings(),
    refreshSchedules(),
    refreshSentHistoryCount(),
    refreshSendStatus(),
    refreshConnection(),
    refreshContactLists(),
    selectionLoaded ? refreshSelection() : Promise.resolve(),
    selectionLoaded ? refreshContactsFiltered() : Promise.resolve(),
  ]);
}
