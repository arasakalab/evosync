import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import crypto from "crypto";
import { logAudit } from "@/server/store/audit";
import { provisionManagedTenant } from "@/server/store/managed-evo";
import { CENTRAL_EVO_ENABLED } from "@/server/paths";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/tenants
 * Lista todos os tenants (super_admin only). Usado por outros painéis
 * admin pra popular dropdowns etc.
 */
export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  if (session.user.role !== "super_admin") {
    return NextResponse.json({ error: "Acesso restrito" }, { status: 403 });
  }
  const db = getDb();
  const tenants = db.select().from(schema.tenants).all();
  return NextResponse.json({ tenants });
}

/**
 * POST /api/admin/tenants
 * Body: { name, slug, licenseDays?, evoMode?: "byo" | "managed" }
 * Cria tenant + licença inicial. Se evoMode="managed" e o servidor
 * estiver configurado (CENTRAL_EVO_ENABLED), provisiona a instância
 * automaticamente na Evolution central e grava credenciais criptografadas.
 * Não cria usuário (faça via invite).
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  if (session.user.role !== "super_admin") {
    return NextResponse.json({ error: "Acesso restrito" }, { status: 403 });
  }
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const { name, slug, licenseDays, evoMode } = body;
  if (!name || !slug) {
    return NextResponse.json(
      { error: "name e slug são obrigatórios" },
      { status: 400 }
    );
  }
  if (!/^[a-z0-9-]{2,40}$/.test(slug)) {
    return NextResponse.json(
      { error: "slug deve ter 2-40 chars: letras minúsculas, números e hífen" },
      { status: 400 }
    );
  }
  // Resolved evoMode: default byo. managed só se explicitamente pedido.
  const requestedMode: "byo" | "managed" =
    evoMode === "managed" ? "managed" : "byo";
  if (requestedMode === "managed" && !CENTRAL_EVO_ENABLED) {
    return NextResponse.json(
      {
        error:
          "evoMode=managed solicitado mas servidor não está configurado (EVOLUTION_CENTRAL_URL/APIKEY ausentes). Use 'byo' ou rode installer/setup_central_evo.sh.",
      },
      { status: 503 }
    );
  }
  const db = getDb();
  const existing = db
    .select()
    .from(schema.tenants)
    .where(eq(schema.tenants.slug, slug))
    .get();
  if (existing) {
    return NextResponse.json(
      { error: "Já existe um tenant com este slug" },
      { status: 409 }
    );
  }
  const id = "t-" + crypto.randomBytes(10).toString("hex");
  const now = new Date().toISOString();
  const days = Number(licenseDays) > 0 ? Number(licenseDays) : 30;
  const exp = new Date(Date.now() + days * 86400_000).toISOString();

  db.insert(schema.tenants)
    .values({
      id,
      name: String(name).trim(),
      slug: String(slug).trim(),
      status: "active",
      evoUrl: null,
      evoApiKeyEncrypted: null,
      evoInstance: null,
      evoMode: requestedMode,
      evoManagedStatus: requestedMode === "managed" ? "pending" : null,
      evoManagedError: null,
      opencodeModel: "",
      delayMin: 8,
      delayMax: 25,
      dailyLimit: 200,
      resendSent: true,
      createdAt: now,
      updatedAt: now,
    })
    .run();

  db.insert(schema.licenses)
    .values({
      id: "lic-" + id,
      tenantId: id,
      issuedAt: now,
      expiresAt: exp,
      status: "active",
      notes: "Licença inicial na criação do tenant",
      createdBy: session.user.id,
    })
    .run();

  logAudit({
    tenantId: id,
    userId: session.user.id,
    action: "tenant.created",
    details: { name, slug, licenseDays: days, expiresAt: exp, evoMode: requestedMode },
  });

  // Se for managed, auto-provisiona agora (não bloqueia a response — se
  // falhar, o admin pode reprovisionar pelo botão "Provisionar" depois).
  let provisionResult: { ok: boolean; alreadyExisted: boolean; message: string } | null = null;
  if (requestedMode === "managed") {
    const t = db
      .select()
      .from(schema.tenants)
      .where(eq(schema.tenants.id, id))
      .get();
    if (t) {
      try {
        provisionResult = await provisionManagedTenant(t, session.user.id);
      } catch (e: any) {
        provisionResult = {
          ok: false,
          alreadyExisted: false,
          message: e?.message || String(e),
        };
      }
    }
  }

  return NextResponse.json({
    ok: true,
    id,
    evoMode: requestedMode,
    provision: provisionResult,
  });
}
