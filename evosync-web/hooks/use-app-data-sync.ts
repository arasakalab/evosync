"use client";

import { useEffect, useRef } from "react";
import { SYNC_INTERVALS } from "@/lib/sync-intervals";
import {
  refreshConnection,
  refreshContactsFiltered,
  refreshContactLists,
  refreshOnExternalChange,
  refreshSchedules,
  refreshSelection,
  refreshSendStatus,
  refreshSentHistoryCount,
  refreshSettings,
} from "@/lib/app-data-sync";
import { useAppStore } from "@/lib/store";
import type { WsEvent } from "@/lib/types";

function useInterval(callback: () => void, ms: number, enabled = true) {
  const saved = useRef(callback);
  useEffect(() => {
    saved.current = callback;
  }, [callback]);
  useEffect(() => {
    if (!enabled) return;
    saved.current();
    const id = setInterval(() => saved.current(), ms);
    return () => clearInterval(id);
  }, [ms, enabled]);
}

/** Polling centralizado + refresh ao focar aba. */
export function useAppDataSync(enabled: boolean) {
  const selectionLoaded = useAppStore((s) => s.selectionLoaded);

  useInterval(refreshConnection, SYNC_INTERVALS.connection, enabled);
  useInterval(refreshSentHistoryCount, SYNC_INTERVALS.sentHistory, enabled);
  useInterval(refreshSchedules, SYNC_INTERVALS.schedules, enabled);
  useInterval(refreshSettings, SYNC_INTERVALS.settings, enabled);
  useInterval(
    () => {
      void refreshContactLists();
      void refreshSelection();
      void refreshContactsFiltered();
    },
    SYNC_INTERVALS.contacts,
    enabled && selectionLoaded
  );

  // Enquanto disparo ativo, status mais frequente via poll leve
  const sendState = useAppStore((s) => s.status.state);
  useInterval(
    refreshSendStatus,
    SYNC_INTERVALS.connection,
    enabled && (sendState === "running" || sendState === "paused")
  );

  useEffect(() => {
    if (!enabled) return;
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void refreshOnExternalChange();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [enabled]);
}

/** Handler WS estendido — refresh de domínios além do push direto. */
export function handleWsDataRefresh(event: WsEvent): void {
  if (event.type === "done") {
    void refreshSentHistoryCount();
    void refreshSendStatus();
    void refreshContactsFiltered();
  } else if (event.type === "schedule_update") {
    void refreshSchedules();
  } else if (event.type === "conn") {
    void refreshConnection();
  }
}
