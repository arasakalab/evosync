import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { nowIso } from "@/server/store/schedules";
import {
  listSchedules,
  createSchedule,
  removeSchedules,
} from "@/server/store/schedules";
import { listContacts } from "@/server/store/contacts";
import { loadTenantSettings } from "@/server/store/settings";
import type { Schedule } from "@/lib/types";

export const dynamic = "force-dynamic";

/** Helper: extrai tenantId da sessão */
async function requireTenantId() {
  const session = await auth();
  if (!session?.user) {
    return {
      error: NextResponse.json({ error: "Não autenticado" }, { status: 401 }),
      tenantId: null,
    };
  }
  if (!session.user.tenantId) {
    return {
      error: NextResponse.json(
        { error: "Super admin não tem schedules" },
        { status: 403 }
      ),
      tenantId: null,
    };
  }
  return { error: null, tenantId: session.user.tenantId };
}

/**
 * GET /api/schedules — lista schedules do tenant.
 */
export async function GET() {
  const { error, tenantId } = await requireTenantId();
  if (error) return error;
  return NextResponse.json(listSchedules(tenantId!));
}

/**
 * POST /api/schedules — cria novo schedule.
 */
export async function POST(req: NextRequest) {
  const { error, tenantId } = await requireTenantId();
  if (error) return error;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

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
    const current = listContacts(tenantId!);
    if (current.length) {
      contacts = current.map((c) => ({
        number: c.number,
        fields: { ...c.fields },
      }));
    } else {
      return NextResponse.json(
        { error: "Carregue contatos antes de criar um agendamento congelado." },
        { status: 400 }
      );
    }
  }

  // Defaults vêm das settings do tenant
  const settings = loadTenantSettings(tenantId!);

  try {
    const schedule = createSchedule(tenantId!, {
      scheduled_at: date.toISOString(),
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
      status: "pending",
    });
    return NextResponse.json(schedule);
  } catch (e: any) {
    return NextResponse.json(
      { error: "Falha ao criar schedule", details: e?.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/schedules — remove schedules pelos ids.
 */
export async function DELETE(req: NextRequest) {
  const { error, tenantId } = await requireTenantId();
  if (error) return error;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const ids: string[] = Array.isArray(body.ids) ? body.ids : [];
  if (!ids.length) {
    return NextResponse.json(
      { error: "ids[] é obrigatório" },
      { status: 400 }
    );
  }
  const removed = removeSchedules(tenantId!, ids);
  return NextResponse.json({ removed });
}
