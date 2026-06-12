import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { UPLOADS_DIR } from "@/server/paths";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const file = form.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "Arquivo não enviado" }, { status: 400 });
  }
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
  const safe = file.name.replace(/[^\w.\-]+/g, "_");
  const filename = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${safe}`;
  const dest = path.join(UPLOADS_DIR, filename);
  const buf = Buffer.from(await file.arrayBuffer());
  fs.writeFileSync(dest, buf);
  return NextResponse.json({
    path: dest,
    name: file.name,
    size: buf.length,
  });
}
