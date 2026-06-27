/**
 * POST /api/branding/favicon — upload do favicon.
 * DELETE /api/branding/favicon — remove o favicon.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  uploadBrandingFile,
  removeBrandingFile,
} from "@/server/store/branding";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function requireTenant() {
  const session = await auth();
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
        { error: "Super admin não pode customizar branding" },
        { status: 403 }
      ),
      tenantId: null,
      userId: null,
    };
  }
  return {
    error: null,
    tenantId: session.user.tenantId,
    userId: session.user.id,
  };
}

export async function POST(req: NextRequest) {
  const { error, tenantId, userId } = await requireTenant();
  if (error) return error;

  const form = await req.formData();
  const file = form.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json(
      { error: "Arquivo não enviado" },
      { status: 400 }
    );
  }
  try {
    const buf = Buffer.from(await file.arrayBuffer());
    const r = await uploadBrandingFile(
      tenantId!,
      "favicon",
      buf,
      file.type,
      file.name
    );
    return NextResponse.json(r);
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Erro no upload" },
      { status: 400 }
    );
  }
}

export async function DELETE(_req: NextRequest) {
  const { error, tenantId, userId } = await requireTenant();
  if (error) return error;
  try {
    await removeBrandingFile(tenantId!, "favicon", userId);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Erro ao remover" },
      { status: 500 }
    );
  }
}
