import { NextRequest, NextResponse } from "next/server";
import { loadSchedules, saveSchedules, newScheduleId, nowIso } from "@/server/store/schedules";
import { loadContacts } from "@/server/store/contacts";
import { loadSettings } from "@/server/store/settings";
import type { Schedule } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(loadSchedules());
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const settings = loadSettings();
  const all = loadSchedules();

  const scheduledAt = String(body.scheduled_at || "");
  const date = new Date(scheduledAt);
  if (Number.isNaN(date.getTime())) {
    return NextResponse.json({ error: "Data/hora inválida" }, { status: 400 });
  }
  if (date.getTime() <= Date.now()) {
    return NextResponse.json(
      { error: "Escolha uma data e hora no futuro." },
      { status: 400 }
    );
  }

  const message = String(body.message || "").trim();
  const mediaPath = String(body.media_path || "").trim();
  if (!message && !mediaPath) {
    return NextResponse.json(
      { error: "Digite uma mensagem agendada ou selecione uma mídia antes de agendar." },
      { status: 400 }
    );
  }
  if (mediaPath) {
    const fs = await import("node:fs");
    if (!fs.existsSync(mediaPath)) {
      return NextResponse.json(
        { error: `Arquivo não encontrado: ${mediaPath}` },
        { status: 400 }
      );
    }
  }

  const contactMode: "current" | "snapshot" =
    body.contact_mode === "current" ? "current" : "snapshot";
  let contacts: Schedule["contacts"] = [];
  if (contactMode === "snapshot") {
    const current = loadContacts();
    if (current.length) {
      contacts = current.map((c) => ({ number: c.number, fields: { ...c.fields } }));
    } else {
      return NextResponse.json(
        { error: "Carregue contatos antes de criar um agendamento congelado." },
        { status: 400 }
      );
    }
  }

  const schedule: Schedule = {
    id: newScheduleId(),
    created_at: nowIso(),
    updated_at: nowIso(),
    // Mantém o "Z" (UTC) — nunca usar .slice(0,19) aqui.
    scheduled_at: date.toISOString(),
    status: "pending",
    message,
    media_path: mediaPath,
    media_type: String(body.media_type || "image"),
    delay_min: Number(body.delay_min ?? settings.delay_min) || 8,
    delay_max: Number(body.delay_max ?? settings.delay_max) || 25,
    daily_limit: Number(body.daily_limit ?? settings.daily_limit) || 200,
    validate_first: body.validate_first !== false,
    skip_sent_history: !!body.skip_sent_history,
    contact_mode: contactMode,
    contacts,
    error: "",
    summary: "",
  };
  all.push(schedule);
  saveSchedules(all);
  return NextResponse.json(schedule);
}

export async function DELETE(req: NextRequest) {
  const body = await req.json();
  const ids: string[] = Array.isArray(body.ids) ? body.ids : [];
  if (!ids.length)
    return NextResponse.json({ error: "ids[] é obrigatório" }, { status: 400 });
  const all = loadSchedules();
  const next = all.filter((s) => !ids.includes(s.id));
  saveSchedules(next);
  return NextResponse.json({ removed: all.length - next.length });
}
