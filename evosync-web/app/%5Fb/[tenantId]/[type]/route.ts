/**
 * GET /_b/[tenantId]/[type]
 *
 * Endpoint PÚBLICO pra servir arquivos de branding na landing /c/[slug].
 * Pasta `%5Fb` no filesystem → URL `/_b/...` (Next.js trata `_` como privado).
 *
 * Valida apenas que o tenant está active (não expõe arquivos de
 * tenants suspensos/cancelados).
 *
 * Cache: 1 dia, public (a landing precisa desses arquivos sem auth).
 */
import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
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
  if (!VALID_TYPES.includes(params.type as BrandingFileType)) {
    return NextResponse.json({ error: "Tipo inválido" }, { status: 400 });
  }
  const db = getDb();
  const tenant = db
    .select({ id: schema.tenants.id, status: schema.tenants.status })
    .from(schema.tenants)
    .where(eq(schema.tenants.id, params.tenantId))
    .get();
  if (!tenant) {
    return NextResponse.json({ error: "Tenant não encontrado" }, { status: 404 });
  }
  if (tenant.status !== "active") {
    return NextResponse.json({ error: "Loja indisponível" }, { status: 404 });
  }
  const file = await readBrandingFile(
    params.tenantId,
    params.type as BrandingFileType
  );
  if (!file) {
    return NextResponse.json({ error: "Arquivo não encontrado" }, { status: 404 });
  }
  return new NextResponse(new Uint8Array(file.buffer), {
    status: 200,
    headers: {
      "Content-Type": mimeFromExt(file.ext),
      "Cache-Control": "public, max-age=86400, must-revalidate",
    },
  });
}
