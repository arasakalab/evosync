import { NextRequest, NextResponse } from "next/server";
import { OpenCodeMessageClient } from "@/server/opencode/client";
import { auth } from "@/lib/auth";
import { loadTenantSettings, saveTenantSettings } from "@/server/store/settings";
import fs from "node:fs";
import path from "node:path";
import { UPLOADS_DIR } from "@/server/paths";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const file = form.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json(
      { error: "Arquivo não enviado" },
      { status: 400 }
    );
  }
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
  const safe = file.name.replace(/[^\w.\-]+/g, "_");
  const filename = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${safe}`;
  const dest = path.join(UPLOADS_DIR, filename);
  const buf = Buffer.from(await file.arrayBuffer());
  fs.writeFileSync(dest, buf);

  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  if (!session.user.tenantId) {
    return NextResponse.json(
      { error: "Super admin não pode usar OpenCode" },
      { status: 403 }
    );
  }

  const settings = loadTenantSettings(session.user.tenantId);
  // Garante persistência do model
  saveTenantSettings(session.user.tenantId, settings);
  const client = new OpenCodeMessageClient(settings.opencode_model);
  const { ok, result } = await client.generateFromFile(dest);
  // Mantém o arquivo para reuso (preview, OpenCode repetido)
  if (!ok) {
    return NextResponse.json({ ok: false, error: result }, { status: 500 });
  }
  return NextResponse.json({ ok: true, text: result, path: dest });
}
