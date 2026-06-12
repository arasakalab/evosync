/**
 * Persistência de configurações (.env + config.json).
 * Port direto de config.py: as credenciais (URL, API Key, instance)
 * ficam em .env; o resto vai em config.json.
 */
import fs from "node:fs";
import path from "node:path";
import { ENV_FILE, SETTINGS_FILE, DEFAULT_EVO_URL } from "@/server/paths";
import type { Settings } from "@/lib/types";

const defaults: Settings = {
  url: DEFAULT_EVO_URL,
  api_key: "",
  instance: "",
  opencode_model: "",
  delay_min: 8,
  delay_max: 25,
  daily_limit: 200,
  last_message: "",
  resend_sent: true,
};

function ensureFile(file: string) {
  if (!fs.existsSync(file)) return;
  try {
    fs.chmodSync(file, 0o600);
  } catch {
    /* noop */
  }
}

function readDotenv(): Record<string, string> {
  if (!fs.existsSync(ENV_FILE)) return {};
  const text = fs.readFileSync(ENV_FILE, "utf-8");
  const out: Record<string, string> = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

function writeDotenv(values: Record<string, string>) {
  if (!fs.existsSync(ENV_FILE)) {
    fs.writeFileSync(ENV_FILE, "", { mode: 0o600 });
  } else {
    ensureFile(ENV_FILE);
  }

  const existing = fs.existsSync(ENV_FILE)
    ? fs.readFileSync(ENV_FILE, "utf-8")
    : "";
  const map: Record<string, string> = {};
  for (const rawLine of existing.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    map[key] = line.slice(eq + 1);
  }
  Object.assign(map, values);
  const out = Object.entries(map)
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");
  fs.writeFileSync(ENV_FILE, out + "\n", { mode: 0o600 });
  ensureFile(ENV_FILE);
}

function readConfigJson(): Record<string, any> {
  if (!fs.existsSync(SETTINGS_FILE)) return {};
  try {
    return JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf-8"));
  } catch {
    return {};
  }
}

function writeConfigJson(payload: Record<string, any>) {
  fs.writeFileSync(
    SETTINGS_FILE,
    JSON.stringify(payload, null, 2),
    "utf-8"
  );
}

export function loadSettings(): Settings {
  const env = readDotenv();
  const json = readConfigJson();
  const s: Settings = {
    url: env.EVO_URL || defaults.url,
    api_key: env.EVO_APIKEY || "",
    instance: env.EVO_INSTANCE || "",
    opencode_model: json.opencode_model ?? defaults.opencode_model,
    delay_min: Number(json.delay_min ?? defaults.delay_min) || 8,
    delay_max: Number(json.delay_max ?? defaults.delay_max) || 25,
    daily_limit: Number(json.daily_limit ?? defaults.daily_limit) || 200,
    last_message: json.last_message ?? defaults.last_message,
    resend_sent:
      json.resend_sent === undefined
        ? defaults.resend_sent
        : !!json.resend_sent,
  };
  if (s.delay_min < 1) s.delay_min = 1;
  if (s.delay_max < s.delay_min) s.delay_max = s.delay_min;
  return s;
}

export function saveSettings(s: Settings): void {
  writeDotenv({
    EVO_URL: s.url,
    EVO_APIKEY: s.api_key,
    EVO_INSTANCE: s.instance,
  });
  const json = { ...readConfigJson() };
  json.opencode_model = s.opencode_model;
  json.delay_min = s.delay_min;
  json.delay_max = s.delay_max;
  json.daily_limit = s.daily_limit;
  json.last_message = s.last_message;
  json.resend_sent = s.resend_sent;
  writeConfigJson(json);
}
