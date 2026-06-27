/**
 * GET /api/branding/file/[tenantId]/[type]
 *
 * Serve o arquivo de branding (logo/bg/favicon) pro próprio tenant.
 * Valida que a sessão pertence ao tenantId.
 *
 * Cache: 1 ano, immutable (URL muda quando tenant troca o arquivo,
 * mas o path no DB é fixo; pra invalidar cache, basta adicionar
 * ?v=timestamp no consumer — feito pelo live preview).
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import {
  readBrandingFile,
  mimeFromExt,
  type BrandingFileType,
} from "@/server/store/branding";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const VALID_TYPES: BrandingFileType[] = ["logo", "bg", "favicon"];

export async function GET(
  _req: NextRequest,
  { params }: { params: { tenantId: string; type: string } }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  // Só permite ver o próprio branding
  if (session.user.tenantId !== params.tenantId) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }
  if (!VALID_TYPES.includes(params.type as BrandingFileType)) {
    return NextResponse.json({ error: "Tipo inválido" }, { status: 400 });
  }
  // Verifica se o tenant existe
  const db = getDb();
  const tenant = db
    .select({ id: schema.tenants.id })
    .from(schema.tenants)
    .where(eq(schema.tenants.id, params.tenantId))
    .get();
  if (!tenant) {
    return NextResponse.json({ error: "Tenant não encontrado" }, { status: 404 });
  }
  const file = await readBrandingFile(params.tenantId, params.type as BrandingFileType);
  if (!file) {
    return NextResponse.json({ error: "Arquivo não encontrado" }, { status: 404 });
  }
  return new NextResponse(new Uint8Array(file.buffer), {
    status: 200,
    headers: {
      "Content-Type": mimeFromExt(file.ext),
      "Cache-Control": "private, max-age=3600, must-revalidate",
    },
  });
}
