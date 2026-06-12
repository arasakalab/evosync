import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  getSchedule,
  updateSchedule,
  removeSchedules,
} from "@/server/store/schedules";

export const dynamic = "force-dynamic";

/**
 * PUT /api/schedules/[id] — edita 1 schedule.
 * SaaS Phase 4: escopado por tenantId da sessão.
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  if (!session.user.tenantId) {
    return NextResponse.json(
      { error: "Super admin não tem schedules" },
      { status: 403 }
    );
  }

  const id = params.id;
  const current = getSchedule(session.user.tenantId, id);
  if (!current) {
    return NextResponse.json({ error: "Agendamento não encontrado" }, { status: 404 });
  }
  if (current.status !== "pending") {
    return NextResponse.json(
      { error: "Somente agendamentos pendentes podem ser editados." },
      { status: 400 }
    );
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const date = new Date(String(body.scheduled_at || current.scheduled_at));
  if (Number.isNaN(date.getTime())) {
    return NextResponse.json({ error: "Data inválida" }, { status: 400 });
  }
  if (date.getTime() <= Date.now()) {
    return NextResponse.json(
      { error: "Escolha uma data e hora no futuro." },
      { status: 400 }
    );
  }

  const message = String(body.message ?? current.message).trim();
  const mediaPath = String(body.media_path ?? current.media_path).trim();
  if (!message && !mediaPath) {
    return NextResponse.json(
      { error: "Digite uma mensagem agendada ou selecione uma mídia antes de agendar." },
      { status: 400 }
    );
  }

  const updated = updateSchedule(session.user.tenantId, id, {
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
  });
  return NextResponse.json(updated);
}

/**
 * DELETE /api/schedules/[id] — deleta 1 schedule.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  if (!session.user.tenantId) {
    return NextResponse.json(
      { error: "Super admin não tem schedules" },
      { status: 403 }
    );
  }

  const id = params.id;
  const removed = removeSchedules(session.user.tenantId, [id]);
  return NextResponse.json({ ok: true, removed });
}
