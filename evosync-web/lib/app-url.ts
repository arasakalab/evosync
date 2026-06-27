import type { NextRequest } from "next/server";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function normalizeBase(url: string): string {
  return url.replace(/\/+$/, "");
}

function isLocalHost(hostname: string): boolean {
  return LOCAL_HOSTS.has(hostname.toLowerCase());
}

/** URL pública configurada no .env (AUTH_URL ou APP_URL). */
export function getPublicAppUrlFromEnv(): string | null {
  const raw =
    process.env.APP_URL?.trim() ||
    process.env.AUTH_URL?.trim() ||
    process.env.NEXTAUTH_URL?.trim();
  return raw ? normalizeBase(raw) : null;
}

type HeaderLike = {
  get(name: string): string | null;
};

/** Resolve a URL pública a partir de headers (server components / layout). */
export function resolvePublicAppUrl(headers: HeaderLike): string {
  const fromEnv = getPublicAppUrlFromEnv();
  if (fromEnv) return fromEnv;

  const proto =
    headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || "https";
  const host =
    headers.get("x-forwarded-host")?.split(",")[0]?.trim() ||
    headers.get("host")?.split(",")[0]?.trim();

  if (host && !isLocalHost(host.split(":")[0]!)) {
    return normalizeBase(`${proto}://${host}`);
  }

  const port = process.env.PORT || "3000";
  return `http://localhost:${port}`;
}

/** URL pública para APIs (prioriza env, depois headers da request). */
export function getPublicAppUrl(
  req?: Pick<NextRequest, "headers" | "nextUrl">
): string {
  const fromEnv = getPublicAppUrlFromEnv();
  if (fromEnv) return fromEnv;

  if (req) {
    const fromHeaders = resolvePublicAppUrl(req.headers);
    if (!fromHeaders.includes("localhost")) return fromHeaders;

    try {
      const origin = req.nextUrl.origin;
      const { hostname } = new URL(origin);
      if (!isLocalHost(hostname)) return normalizeBase(origin);
    } catch {
      /* ignore */
    }
  }

  const port = process.env.PORT || "3000";
  return `http://localhost:${port}`;
}

/** Monta URL absoluta pública para um path (ex: /invite/token). */
export function publicAppUrl(
  path: string,
  req?: Pick<NextRequest, "headers" | "nextUrl">
): string {
  const base = getPublicAppUrl(req);
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}

/** Client-side: usa data-public-app-url do layout ou origin não-local. */
export function getClientPublicAppUrl(): string {
  if (typeof document !== "undefined") {
    const fromDom = document.documentElement.dataset.publicAppUrl?.trim();
    if (fromDom) return normalizeBase(fromDom);
  }

  if (typeof window !== "undefined") {
    try {
      const { hostname, origin } = window.location;
      if (!isLocalHost(hostname)) return normalizeBase(origin);
    } catch {
      /* ignore */
    }
  }

  return "";
}

export function clientPublicAppUrl(path: string): string {
  const base =
    getClientPublicAppUrl() ||
    (typeof window !== "undefined" ? window.location.origin : "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${normalizeBase(base)}${p}`;
}
