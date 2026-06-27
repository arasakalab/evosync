/**
 * GET /api/branding — lê o branding do tenant logado.
 * PUT /api/branding — atualiza cores, textos, font.
 *
 * Auth: operator/owner/super_admin com tenantId.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  getBranding,
  updateBranding,
  resetBranding,
  type UpdateBrandingInput,
} from "@/server/store/branding";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function requireTenant(req: NextRequest) {
  return auth().then((session) => {
    if (!session?.user) {
      return {
        error: NextResponse.json({ error: "Não autenticado" }, { status: 401 }),
        tenantId: null,
        userId: null,
      };
    }
    if (!session.user.tenantId) {
      return {
        error: NextResponse.json(
          { error: "Super admin não tem branding de tenant" },
          { status: 403 }
        ),
        tenantId: null,
        userId: null,
      };
    }
    return { error: null, tenantId: session.user.tenantId, userId: session.user.id };
  });
}

export async function GET(_req: NextRequest) {
  const { error, tenantId } = await requireTenant(_req);
  if (error) return error;
  const b = getBranding(tenantId!);
  return NextResponse.json(b);
}

export async function PUT(req: NextRequest) {
  const { error, tenantId, userId } = await requireTenant(req);
  if (error) return error;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  try {
    if (body?.reset === true) {
      const b = resetBranding(tenantId!, userId);
      return NextResponse.json(b);
    }
    const input: UpdateBrandingInput = {
      primaryColor: body.primaryColor,
      accentColor: body.accentColor,
      bgColor: body.bgColor,
      fgColor: body.fgColor,
      fontFamily: body.fontFamily,
      landingTitle: body.landingTitle,
      landingSubtitle: body.landingSubtitle,
    };
    // Remove undefined pra não enviar null acidental
    for (const k of Object.keys(input) as (keyof UpdateBrandingInput)[]) {
      if (input[k] === undefined) delete input[k];
    }
    const b = updateBranding(tenantId!, input, userId);
    return NextResponse.json(b);
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Erro ao salvar" },
      { status: 400 }
    );
  }
}
