"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Cable, Users, MessageSquare, Send, CalendarClock } from "lucide-react";

import { Sidebar } from "./sidebar";
import { Header } from "./header";
import { StatusBar } from "./status-bar";
import { useAppStore } from "@/lib/store";
import { api } from "@/lib/api";
import { useWebSocket } from "@/hooks/use-websocket";

const navItems = [
  { href: "/conexao", label: "Conexão", icon: Cable },
  { href: "/contatos", label: "Contatos", icon: Users },
  { href: "/mensagem", label: "Mensagem", icon: MessageSquare },
  { href: "/disparo", label: "Disparo", icon: Send },
  { href: "/agenda", label: "Agenda", icon: CalendarClock },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
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

  // Carrega estado inicial
  useEffect(() => {
    (async () => {
      try {
        const [settings, contactsRes, schedules, status, lists, selection] =
          await Promise.all([
            api.settings.get(),
            api.contacts.list(),
            api.schedules.list(),
            api.send.status(),
            api.contactLists.list().catch(() => []),
            api.contacts.getSelection().catch(() => ({ ids: [], updatedAt: "" })),
          ]);
        setSettings(settings);
        setContacts(contactsRes.contacts, {
          count: contactsRes.count,
          filteredCount: contactsRes.filteredCount,
        });
        setSchedules(schedules);
        setStatus(status);
        setContactLists(lists);
        setSelectedIds(selection.ids);
      } catch (e) {
        // silencioso — o usuário verá erros nos formulários
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

  // WS: alimenta store
  useWebSocket((event) => {
    if (event.type === "status") {
      setStatus(event.payload);
    } else if (event.type === "log") {
      appendLog(event.payload);
    } else if (event.type === "conn") {
      setConnection({ ok: event.payload.ok, state: event.payload.state, msg: event.payload.msg, checkedAt: new Date().toISOString() });
    } else if (event.type === "schedule_update") {
      updateSchedule(event.payload.id, { status: event.payload.status, error: event.payload.error || "" });
    }
  });

  // Redireciona / para /conexao na primeira carga
  useEffect(() => {
    if (pathname === "/") router.replace("/conexao");
  }, [pathname, router]);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-bg text-text">
      <Sidebar items={navItems} pathname={pathname || "/"} />
      <div className="flex flex-1 flex-col min-w-0">
        <Header />
        <main className="flex-1 overflow-y-auto px-4 py-6 md:px-8 md:py-8">
          <div className="mx-auto w-full max-w-6xl animate-fade-in">
            {children}
          </div>
        </main>
        <StatusBar />
      </div>
    </div>
  );
}
