import { NextRequest, NextResponse } from "next/server";
import { loadSchedules, saveSchedules, nowIso } from "@/server/store/schedules";

export const dynamic = "force-dynamic";

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = params.id;
  const body = await req.json();
  const all = loadSchedules();
  const idx = all.findIndex((s) => s.id === id);
  if (idx < 0)
    return NextResponse.json({ error: "Agendamento não encontrado" }, { status: 404 });
  const current = all[idx];
  if (current.status !== "pending")
    return NextResponse.json(
      { error: "Somente agendamentos pendentes podem ser editados." },
      { status: 400 }
    );

  const date = new Date(String(body.scheduled_at || current.scheduled_at));
  if (Number.isNaN(date.getTime()))
    return NextResponse.json({ error: "Data inválida" }, { status: 400 });
  if (date.getTime() <= Date.now())
    return NextResponse.json(
      { error: "Escolha uma data e hora no futuro." },
      { status: 400 }
    );

  const message = String(body.message ?? current.message).trim();
  const mediaPath = String(body.media_path ?? current.media_path).trim();
  if (!message && !mediaPath)
    return NextResponse.json(
      { error: "Digite uma mensagem agendada ou selecione uma mídia antes de agendar." },
      { status: 400 }
    );

  const updated = {
    ...current,
    // Mantém o "Z" (UTC) — nunca usar .slice(0,19) aqui.
    scheduled_at: date.toISOString(),
    message,
    media_path: mediaPath,
    media_type: String(body.media_type ?? current.media_type),
    delay_min: Number(body.delay_min ?? current.delay_min),
    delay_max: Number(body.delay_max ?? current.delay_max),
    daily_limit: Number(body.daily_limit ?? current.daily_limit),
    validate_first:
      body.validate_first === undefined
        ? current.validate_first
        : !!body.validate_first,
    skip_sent_history:
      body.skip_sent_history === undefined
        ? current.skip_sent_history
        : !!body.skip_sent_history,
    contact_mode:
      body.contact_mode === "current" || body.contact_mode === "snapshot"
        ? body.contact_mode
        : current.contact_mode,
    updated_at: nowIso(),
  };
  all[idx] = updated;
  saveSchedules(all);
  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = params.id;
  const all = loadSchedules();
  const next = all.filter((s) => s.id !== id);
  saveSchedules(next);
  return NextResponse.json({ ok: true, removed: all.length - next.length });
}
