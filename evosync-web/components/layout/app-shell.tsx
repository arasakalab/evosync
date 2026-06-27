"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

import { Sidebar } from "./sidebar";
import { Header } from "./header";
import { StatusBar } from "./status-bar";
import { MobileNav } from "./mobile-nav";
import { useAppStore } from "@/lib/store";
import { api } from "@/lib/api";
import { useWebSocket } from "@/hooks/use-websocket";
import {
  handleWsDataRefresh,
  useAppDataSync,
} from "@/hooks/use-app-data-sync";
import { refreshConnection, refreshSentHistoryCount } from "@/lib/app-data-sync";
import { APP_NAV_ITEMS } from "@/lib/nav-items";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const settings = useAppStore((s) => s.settings);
  const selectionLoaded = useAppStore((s) => s.selectionLoaded);
  const setConnection = useAppStore((s) => s.setConnection);
  const setStatus = useAppStore((s) => s.setStatus);
  const setContacts = useAppStore((s) => s.setContacts);
  const setSettings = useAppStore((s) => s.setSettings);
  const setSchedules = useAppStore((s) => s.setSchedules);
  const appendLog = useAppStore((s) => s.appendLog);
  const updateSchedule = useAppStore((s) => s.updateSchedule);
  const setContactLists = useAppStore((s) => s.setContactLists);
  const setSelectedIds = useAppStore((s) => s.setSelectedIds);
  const setSelectionLoaded = useAppStore((s) => s.setSelectionLoaded);

  // Bootstrap único
  useEffect(() => {
    (async () => {
      try {
        const [settingsRes, contactsRes, schedules, status, lists, selection] =
          await Promise.all([
            api.settings.get(),
            api.contacts.list(),
            api.schedules.list(),
            api.send.status(),
            api.contactLists.list().catch(() => []),
            api.contacts.getSelection().catch(() => ({ ids: [], updatedAt: "" })),
          ]);
        setSettings(settingsRes);
        setContacts(contactsRes.contacts, {
          count: contactsRes.count,
          filteredCount: contactsRes.filteredCount,
        });
        setSchedules(schedules);
        setStatus(status);
        setContactLists(lists);
        setSelectedIds(selection.ids);
        await Promise.all([refreshConnection(), refreshSentHistoryCount()]);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error(e);
      } finally {
        setSelectionLoaded(true);
      }
    })();
  }, [
    setSettings,
    setContacts,
    setSchedules,
    setStatus,
    setContactLists,
    setSelectedIds,
    setSelectionLoaded,
  ]);

  // Auto-refresh centralizado (poll + foco da aba)
  useAppDataSync(selectionLoaded);

  // WS: push em tempo real + refresh de domínios relacionados
  useWebSocket((event) => {
    if (event.type === "status") {
      setStatus(event.payload);
    } else if (event.type === "log") {
      appendLog(event.payload);
    } else if (event.type === "conn") {
      setConnection({
        ok: event.payload.ok,
        state: event.payload.state,
        msg: event.payload.msg,
        checkedAt: new Date().toISOString(),
      });
    } else if (event.type === "schedule_update") {
      updateSchedule(event.payload.id, {
        status: event.payload.status,
        error: event.payload.error || "",
      });
    } else if (event.type === "progress") {
      const prev = useAppStore.getState().status;
      setStatus({
        ...prev,
        current_index: event.payload.current,
        total: event.payload.total,
      });
    } else if (event.type === "done") {
      setStatus({ ...event.payload.counts, state: "idle" });
    }
    handleWsDataRefresh(event);
  });

  useEffect(() => {
    if (pathname === "/") router.replace("/conexao");
  }, [pathname, router]);

  const isManagedLocked =
    settings.evo_mode === "managed" &&
    settings.managed_status !== null &&
    settings.managed_status !== "connected";

  useEffect(() => {
    if (isManagedLocked && pathname !== "/conexao") {
      router.replace("/conexao?reason=managed_not_connected");
    }
  }, [isManagedLocked, pathname, router]);

  const itemsWithLock = APP_NAV_ITEMS.map((item) => ({
    ...item,
    locked: isManagedLocked && item.href !== "/conexao",
  }));

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden bg-bg text-text">
      <Sidebar items={itemsWithLock} pathname={pathname || "/"} />
      <div className="flex flex-1 flex-col min-w-0 min-h-0">
        <Header />
        <main className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-4 pb-20 md:px-8 md:py-8 md:pb-8">
          <div className="mx-auto w-full max-w-6xl animate-fade-in">
            {children}
          </div>
        </main>
        <div className="hidden md:block">
          <StatusBar />
        </div>
        <MobileNav items={itemsWithLock} pathname={pathname || "/"} />
      </div>
    </div>
  );
}
