"use server";

/**
 * Server action da landing pública /c/[slug].
 *
 * Fluxo:
 *  1. Recebe FormData do form cliente (nome + whatsapp).
 *  2. Re-valida no servidor (Zod) — nunca confiar no cliente.
 *  3. Aplica rate limit por IP (5/hora) para anti-spam.
 *  4. Normaliza o número (lib/phone.ts) e valida formato BR.
 *  5. Resolve tenantId via slug.
 *  6. Rejeita se tenant inativo.
 *  7. Rejeita se número já tem opt_out=true (respeita LGPD).
 *  8. Faz upsert: cria novo OU atualiza apenas o name (preserva opt_out, tags).
 *  9. Audit log.
 * 10. Retorna { ok, maskedNumber, tenantName } ou erro.
 */

import { headers } from "next/headers";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { getTenantBySlug } from "@/server/store/tenants";
import { addContact } from "@/server/store/contacts";
import { normalizeNumber, looksLikeMobileBr } from "@/lib/phone";
import { rateLimit, getRequestIp } from "@/lib/rate-limit";
import { getDb, schema } from "@/lib/db";
import { logAudit } from "@/server/store/audit";

const FormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Digite seu nome completo")
    .max(80, "Nome muito longo"),
  whatsapp: z
    .string()
    .trim()
    .min(8, "Número inválido")
    .max(20, "Número inválido"),
  slug: z.string().min(1).max(80),
});

export type SubmitState =
  | { ok: true; maskedNumber: string; tenantName: string }
  | { ok: false; error: string; field?: "name" | "whatsapp" | "_root" };

/**
 * Máscara o número para mostrar na tela de sucesso: +55 (11) 99999-9999.
 */
function maskNumber(digits: string): string {
  if (digits.length === 13 && digits.startsWith("55")) {
    const ddd = digits.slice(2, 4);
    const n9 = digits.slice(4, 5);
    const p1 = digits.slice(5, 9);
    const p2 = digits.slice(9, 13);
    return `+55 (${ddd}) ${n9}${p1}-${p2}`;
  }
  if (digits.length === 12 && digits.startsWith("55")) {
    const ddd = digits.slice(2, 4);
    const p1 = digits.slice(4, 8);
    const p2 = digits.slice(8, 12);
    return `+55 (${ddd}) ${p1}-${p2}`;
  }
  return digits;
}

export async function submitSignup(
  _prev: SubmitState | null,
  formData: FormData
): Promise<SubmitState> {
  const raw = {
    name: String(formData.get("name") || ""),
    whatsapp: String(formData.get("whatsapp") || ""),
    slug: String(formData.get("slug") || ""),
  };

  const parsed = FormSchema.safeParse(raw);
  if (!parsed.success) {
    const flat = parsed.error.flatten();
    const firstFieldErr =
      (flat.fieldErrors.name?.[0] && "name") ||
      (flat.fieldErrors.whatsapp?.[0] && "whatsapp") ||
      "_root";
    const msg =
      flat.fieldErrors.name?.[0] ||
      flat.fieldErrors.whatsapp?.[0] ||
      flat.formErrors[0] ||
      "Dados inválidos";
    return { ok: false, error: msg, field: firstFieldErr };
  }

  // Resolve tenant pelo slug antes de qualquer coisa
  const tenant = getTenantBySlug(parsed.data.slug);
  if (!tenant) {
    return { ok: false, error: "Loja não encontrada", field: "_root" };
  }
  if (tenant.status !== "active") {
    return {
      ok: false,
      error: "Cadastros pausados nesta loja. Tente novamente mais tarde.",
      field: "_root",
    };
  }

  // Rate limit por IP + slug — 5 cadastros/hora
  let ip = "unknown";
  try {
    const h = await headers();
    const fwd = h.get("x-forwarded-for") || "";
    const real = h.get("x-real-ip") || "";
    ip = getRequestIp(
      new Request("http://x", {
        headers: { "x-forwarded-for": fwd, "x-real-ip": real },
      })
    );
  } catch {
    /* headers() indisponível (raro) — segue sem IP */
  }
  const rl = rateLimit({
    key: `c-signup:${ip}:${parsed.data.slug}`,
    limit: 5,
    windowMs: 60 * 60 * 1000,
  });
  if (!rl.ok) {
    const min = Math.max(1, Math.ceil(rl.retryAfterSec / 60));
    return {
      ok: false,
      error: `Muitas tentativas. Tente novamente em ${min} min.`,
      field: "_root",
    };
  }

  // Normaliza e valida WhatsApp BR
  const digits = normalizeNumber(parsed.data.whatsapp, "55");
  if (!digits || !looksLikeMobileBr(digits)) {
    return {
      ok: false,
      error: "Informe um WhatsApp válido com DDD (ex: 11 99999-9999)",
      field: "whatsapp",
    };
  }

  // Verifica se o número já existe e se está opt-out
  const db = getDb();
  const existing = db
    .select()
    .from(schema.contacts)
    .where(
      and(
        eq(schema.contacts.tenantId, tenant.id),
        eq(schema.contacts.number, digits)
      )
    )
    .all()[0];

  if (existing?.optOut) {
    return {
      ok: false,
      error: "Este número não deseja receber mensagens desta loja.",
      field: "whatsapp",
    };
  }

  // Upsert: cria novo OU atualiza apenas o name (preserva opt_out, tags)
  try {
    if (existing) {
      if (existing.name !== parsed.data.name) {
        db.update(schema.contacts)
          .set({
            name: parsed.data.name,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(schema.contacts.id, existing.id))
          .run();
      }
    } else {
      addContact(tenant.id, {
        id: "",
        number: digits,
        name: parsed.data.name,
        fields: {},
        tags: [],
        lists: [],
        opt_out: false,
        notes: null,
        createdAt: "",
        updatedAt: "",
      });
    }
  } catch {
    return {
      ok: false,
      error: "Não foi possível concluir o cadastro. Tente novamente.",
      field: "_root",
    };
  }

  // Audit log
  logAudit({
    tenantId: tenant.id,
    action: "contact.created_via_landing",
    details: { source: "c-landing", number: digits, name: parsed.data.name },
  });

  return {
    ok: true,
    maskedNumber: maskNumber(digits),
    tenantName: tenant.landingTitle?.trim() || tenant.name,
  };
}
