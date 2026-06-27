import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { auth } from "@/lib/auth";
import { UPLOADS_DIR } from "@/server/paths";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".pdf": "application/pdf",
};

function resolveUpload(name: string): string | null {
  const safe = path.basename(name);
  if (!safe || safe !== name) return null;
  const full = path.resolve(UPLOADS_DIR, safe);
  const root = path.resolve(UPLOADS_DIR);
  if (!full.startsWith(root + path.sep) && full !== root) return null;
  return full;
}

/** GET /api/upload/media/file?f=<filename> — serve mídia do uploads/ (auth). */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const name = req.nextUrl.searchParams.get("f")?.trim();
  if (!name) {
    return NextResponse.json({ error: "Arquivo não informado" }, { status: 400 });
  }

  const full = resolveUpload(name);
  if (!full || !fs.existsSync(full) || !fs.statSync(full).isFile()) {
    return NextResponse.json({ error: "Arquivo não encontrado" }, { status: 404 });
  }

  const ext = path.extname(full).toLowerCase();
  const type = MIME[ext] || "application/octet-stream";
  const buf = fs.readFileSync(full);

  return new NextResponse(buf, {
    headers: {
      "Content-Type": type,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
