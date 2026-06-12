import { NextRequest, NextResponse } from "next/server";
import { loadSettings, saveSettings } from "@/server/store/settings";

export const dynamic = "force-dynamic";

export async function GET() {
  const s = loadSettings();
  return NextResponse.json(s);
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const current = loadSettings();
  const next = {
    ...current,
    ...body,
    delay_min: Number(body.delay_min ?? current.delay_min) || 8,
    delay_max: Number(body.delay_max ?? current.delay_max) || 25,
    daily_limit: Number(body.daily_limit ?? current.daily_limit) || 200,
  };
  if (next.delay_min < 1) next.delay_min = 1;
  if (next.delay_max < next.delay_min) next.delay_max = next.delay_min;
  saveSettings(next);
  return NextResponse.json(next);
}
