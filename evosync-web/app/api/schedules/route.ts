import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  requireTenantId,
  parseJsonBody,
  validateWith,
  jsonError,
} from "@/lib/api-helpers";
import {
  listSchedules,
  createSchedule,
  removeSchedules,
} from "@/server/store/schedules";
import { listContacts } from "@/server/store/contacts";
import { loadTenantSettings } from "@/server/store/settings";
import type { Schedule } from "@/lib/types";

export const dynamic = "force-dynamic";

const CreateScheduleSchema = z.object({
  scheduled_at: z.string().min(1),
  message: z.string().default(""),
  media_path: z.string().optional(),
  media_type: z.string().optional(),
  contact_mode: z.enum(["snapshot", "current"]).optional(),
  contact_ids: z.array(z.string()).optional(), // FASE 3: ids selecionados (modo current)
  delay_min: z.number().int().positive().optional(),
  delay_max: z.number().int().positive().optional(),
  daily_limit: z.number().int().positive().optional(),
  validate_first: z.boolean().optional(),
  skip_sent_history: z.boolean().optional(),
});

const DeleteSchedulesSchema = z.object({
  ids: z.array(z.string()).min(1),
});

/**
 * GET /api/schedules — lista schedules do tenant.
 */
export async function GET() {
  const { error, tenantId } = await requireTenantId("schedules");
  if (error) return error;
  return NextResponse.json(listSchedules(tenantId!));
}

/**
 * POST /api/schedules — cria novo schedule.
 */
export async function POST(req: NextRequest) {
  const { error, tenantId } = await requireTenantId("schedules");
  if (error) return error;

  const body = await parseJsonBody(req);
  if (!body.ok) return body.error;
  const validated = validateWith(CreateScheduleSchema, body.data);
  if (!validated.ok) return validated.error;
  const data = validated.data;

  const date = new Date(data.scheduled_at);
  if (Number.isNaN(date.getTime())) {
    return jsonError("Data/hora inválida", 400);
  }
  if (date.getTime() <= Date.now()) {
    return jsonError("Escolha uma data e hora no futuro.", 400);
  }

  const message = (data.message || "").trim();
  const mediaPath = (data.media_path || "").trim();
  if (!message && !mediaPath) {
    return jsonError(
      "Digite uma mensagem agendada ou selecione uma mídia antes de agendar.",
      400
    );
  }
  if (mediaPath) {
    const fs = await import("node:fs");
    if (!fs.existsSync(mediaPath)) {
      return jsonError(`Arquivo não encontrado: ${mediaPath}`, 400);
    }
  }

  const contactMode: "current" | "snapshot" =
    data.contact_mode === "current" ? "current" : "snapshot";

  // FASE 3: contactIds persistido em selected_contact_ids.
  // No modo current, o scheduler loop filtra no SQL usando esses IDs.
  const contactIds: string[] = Array.isArray(data.contact_ids)
    ? data.contact_ids
    : [];

  if (contactMode === "current" && contactIds.length === 0) {
    return jsonError(
      "Marque contatos em Contatos antes de agendar com seleção atual.",
      400
    );
  }

  let contacts: Schedule["contacts"] = [];
  if (contactMode === "snapshot") {
    const current = listContacts(tenantId!);
    let source = current.contacts;
    if (contactIds.length > 0) {
      const idSet = new Set(contactIds);
      source = source.filter((c) => idSet.has(c.id));
    }
    if (source.length) {
      contacts = source.map((c) => ({
        id: c.id,
        number: c.number,
        name: c.name,
        tags: [...c.tags],
        lists: [...c.lists],
        opt_out: c.opt_out,
        notes: c.notes,
        fields: { ...c.fields },
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      }));
    } else {
      return jsonError(
        contactIds.length
          ? "Nenhum contato selecionado encontrado no catálogo."
          : "Carregue contatos antes de criar um agendamento congelado.",
        400
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
      media_type: data.media_type || "image",
      delay_min: data.delay_min ?? settings.delay_min,
      delay_max: data.delay_max ?? settings.delay_max,
      daily_limit: data.daily_limit ?? settings.daily_limit,
      validate_first: data.validate_first !== false,
      skip_sent_history: !!data.skip_sent_history,
      contact_mode: contactMode,
      contacts,
      selected_contact_ids: contactIds,
      error: "",
      summary: "",
      status: "pending",
    });
    return NextResponse.json(schedule);
  } catch (e: any) {
    return jsonError(
      `Falha ao criar schedule: ${e?.message || e}`,
      500
    );
  }
}

/**
 * DELETE /api/schedules — remove schedules pelos ids.
 */
export async function DELETE(req: NextRequest) {
  const { error, tenantId } = await requireTenantId("schedules");
  if (error) return error;

  const body = await parseJsonBody(req);
  if (!body.ok) return body.error;
  const validated = validateWith(DeleteSchedulesSchema, body.data);
  if (!validated.ok) return validated.error;

  const removed = removeSchedules(tenantId!, validated.data.ids);
  return NextResponse.json({ removed });
}
