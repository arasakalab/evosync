/**
 * Branding store (Fase C) — personalização da landing pública /c/[slug].
 *
 * O tenant configura logo, background, favicon, cores, font e textos
 * da sua landing. A landing lê do DB e injeta via CSS variables.
 *
 * Estrutura de arquivos:
 *   - uploads/branding/<tenantId>/logo.<ext>
 *   - uploads/branding/<tenantId>/bg.<ext>
 *   - uploads/branding/<tenantId>/favicon.<ext>
 *
 * Servidos publicamente via:
 *   GET /api/branding/file/[tenantId]/[type]  (autenticado, tenant só vê o seu)
 *   GET /_b/[tenantId]/[type]                  (público, valida tenant ativo)
 */

import path from "node:path";
import fsSync from "node:fs";
import fs from "node:fs/promises";
import sharp from "sharp";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { UPLOADS_DIR } from "@/server/paths";
import { logAudit } from "@/server/store/audit";
import { logger } from "@/lib/logger";
import {
  type BrandingFileType,
  type BrandingConfig,
  type UpdateBrandingInput,
  type FontFamily,
  FONT_FAMILIES,
  COLOR_PRESETS,
  HEX_REGEX,
} from "@/lib/branding";

// Re-export pra compat com código que importa do server/store
export type { BrandingFileType, BrandingConfig, UpdateBrandingInput, FontFamily };
export { FONT_FAMILIES, COLOR_PRESETS };

// ============================================================================
// Defaults
// ============================================================================

const DEFAULTS: BrandingConfig = {
  logoPath: null,
  bgImagePath: null,
  faviconPath: null,
  primaryColor: "#0F9D58",
  accentColor: "#25D366",
  bgColor: "#F8FAFC",
  fgColor: "#0F172A",
  fontFamily: "Inter",
  landingTitle: null,
  landingSubtitle: null,
  landingUpdatedAt: null,
};

// ============================================================================
// File constraints
// ============================================================================

const FILE_CONSTRAINTS: Record<
  BrandingFileType,
  {
    allowedMime: string[];
    maxBytes: number;
    maxWidth: number;
    maxHeight: number;
    folder: string;
    label: string;
  }
> = {
  logo: {
    allowedMime: ["image/png", "image/jpeg", "image/svg+xml", "image/webp"],
    maxBytes: 2 * 1024 * 1024, // 2MB
    maxWidth: 1200,
    maxHeight: 400,
    folder: "logo",
    label: "Logo",
  },
  bg: {
    allowedMime: ["image/png", "image/jpeg", "image/webp"],
    maxBytes: 5 * 1024 * 1024, // 5MB
    maxWidth: 1920,
    maxHeight: 1080,
    folder: "bg",
    label: "Background",
  },
  favicon: {
    allowedMime: ["image/png", "image/x-icon", "image/vnd.microsoft.icon"],
    maxBytes: 100 * 1024, // 100KB
    maxWidth: 64,
    maxHeight: 64,
    folder: "favicon",
    label: "Favicon",
  },
};

const MIME_TO_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/svg+xml": "svg",
  "image/webp": "webp",
  "image/x-icon": "ico",
  "image/vnd.microsoft.icon": "ico",
};

const MIME_ALIASES: Record<string, string> = {
  "image/jpg": "image/jpeg",
  "image/pjpeg": "image/jpeg",
};

const EXT_TO_MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  svg: "image/svg+xml",
  webp: "image/webp",
  ico: "image/x-icon",
};

const SHARP_FORMAT_TO_MIME: Record<string, string> = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  svg: "image/svg+xml",
};

/**
 * Navegadores nem sempre enviam MIME correto (vazio, image/jpg, etc.).
 * Normaliza via alias, extensão do arquivo e detecção com sharp.
 */
async function resolveMime(
  buffer: Buffer,
  mime: string,
  allowedMime: string[],
  filename?: string
): Promise<string> {
  let resolved = MIME_ALIASES[mime.trim()] ?? mime.trim();

  if (!resolved && filename) {
    const ext = path.extname(filename).slice(1).toLowerCase();
    resolved = EXT_TO_MIME[ext] ?? "";
  }

  if (!resolved || !allowedMime.includes(resolved)) {
    try {
      const meta = await sharp(buffer).metadata();
      if (meta.format && SHARP_FORMAT_TO_MIME[meta.format]) {
        resolved = SHARP_FORMAT_TO_MIME[meta.format];
      }
    } catch {
      /* sharp não conseguiu ler — cai no erro de tipo abaixo */
    }
  }

  return resolved;
}

// ============================================================================
// Read
// ============================================================================

/**
 * Lê o branding de um tenant. Retorna defaults se campos não estão setados.
 */
function fileExistsOnDisk(tenantId: string, type: BrandingFileType): boolean {
  const dir = path.join(UPLOADS_DIR, "branding", tenantId);
  try {
    return fsSync.readdirSync(dir).some((f) => f.startsWith(type));
  } catch {
    return false;
  }
}

export function getBranding(tenantId: string): BrandingConfig {
  const db = getDb();
  const row = db
    .select({
      logoPath: schema.tenants.logoPath,
      bgImagePath: schema.tenants.bgImagePath,
      faviconPath: schema.tenants.faviconPath,
      primaryColor: schema.tenants.primaryColor,
      accentColor: schema.tenants.accentColor,
      bgColor: schema.tenants.bgColor,
      fgColor: schema.tenants.fgColor,
      fontFamily: schema.tenants.fontFamily,
      landingTitle: schema.tenants.landingTitle,
      landingSubtitle: schema.tenants.landingSubtitle,
      landingUpdatedAt: schema.tenants.landingUpdatedAt,
    })
    .from(schema.tenants)
    .where(eq(schema.tenants.id, tenantId))
    .get();
  if (!row) return DEFAULTS;
  return {
    logoPath: row.logoPath && fileExistsOnDisk(tenantId, "logo") ? row.logoPath : null,
    bgImagePath: row.bgImagePath && fileExistsOnDisk(tenantId, "bg") ? row.bgImagePath : null,
    faviconPath: row.faviconPath && fileExistsOnDisk(tenantId, "favicon") ? row.faviconPath : null,
    primaryColor: row.primaryColor || DEFAULTS.primaryColor,
    accentColor: row.accentColor || DEFAULTS.accentColor,
    bgColor: row.bgColor || DEFAULTS.bgColor,
    fgColor: row.fgColor || DEFAULTS.fgColor,
    fontFamily: row.fontFamily || DEFAULTS.fontFamily,
    landingTitle: row.landingTitle,
    landingSubtitle: row.landingSubtitle,
    landingUpdatedAt: row.landingUpdatedAt,
  };
}

/**
 * Helper pra landing pública — busca o branding direto do tenant row.
 */
export function getBrandingFromRow(tenant: typeof schema.tenants.$inferSelect): BrandingConfig {
  return {
    logoPath: tenant.logoPath,
    bgImagePath: tenant.bgImagePath,
    faviconPath: tenant.faviconPath,
    primaryColor: tenant.primaryColor || DEFAULTS.primaryColor,
    accentColor: tenant.accentColor || DEFAULTS.accentColor,
    bgColor: tenant.bgColor || DEFAULTS.bgColor,
    fgColor: tenant.fgColor || DEFAULTS.fgColor,
    fontFamily: tenant.fontFamily || DEFAULTS.fontFamily,
    landingTitle: tenant.landingTitle,
    landingSubtitle: tenant.landingSubtitle,
    landingUpdatedAt: tenant.landingUpdatedAt,
  };
}

// ============================================================================
// Update (textos + cores + font)
// ============================================================================

/**
 * Atualiza campos de texto/cor/font do branding. Valida hex e font.
 * Não mexe em arquivos (logo/bg/favicon) — use as funções específicas.
 */
export function updateBranding(
  tenantId: string,
  input: UpdateBrandingInput,
  actorUserId?: string | null
): BrandingConfig {
  const db = getDb();
  const updates: Record<string, any> = {
    landingUpdatedAt: new Date().toISOString(),
  };

  if (input.primaryColor !== undefined) {
    if (!HEX_REGEX.test(input.primaryColor)) {
      throw new Error("Cor primária inválida (use hex: #RRGGBB)");
    }
    updates.primaryColor = input.primaryColor;
  }
  if (input.accentColor !== undefined) {
    if (!HEX_REGEX.test(input.accentColor)) {
      throw new Error("Cor de acento inválida (use hex: #RRGGBB)");
    }
    updates.accentColor = input.accentColor;
  }
  if (input.bgColor !== undefined) {
    if (!HEX_REGEX.test(input.bgColor)) {
      throw new Error("Cor de fundo inválida (use hex: #RRGGBB)");
    }
    updates.bgColor = input.bgColor;
  }
  if (input.fgColor !== undefined) {
    if (!HEX_REGEX.test(input.fgColor)) {
      throw new Error("Cor de texto inválida (use hex: #RRGGBB)");
    }
    updates.fgColor = input.fgColor;
  }
  if (input.fontFamily !== undefined) {
    if (!FONT_FAMILIES.includes(input.fontFamily as FontFamily)) {
      throw new Error(`Fonte inválida. Use uma de: ${FONT_FAMILIES.join(", ")}`);
    }
    updates.fontFamily = input.fontFamily;
  }
  if (input.landingTitle !== undefined) {
    const v = (input.landingTitle || "").trim();
    if (v.length > 100) throw new Error("Título muito longo (max 100 chars)");
    updates.landingTitle = v || null;
  }
  if (input.landingSubtitle !== undefined) {
    const v = (input.landingSubtitle || "").trim();
    if (v.length > 200) throw new Error("Subtítulo muito longo (max 200 chars)");
    updates.landingSubtitle = v || null;
  }

  db.update(schema.tenants)
    .set(updates)
    .where(eq(schema.tenants.id, tenantId))
    .run();

  logAudit({
    tenantId,
    userId: actorUserId ?? null,
    action: "branding.updated",
    details: { fields: Object.keys(input) },
  });

  return getBranding(tenantId);
}

/**
 * Restaura o branding para os defaults.
 */
export function resetBranding(
  tenantId: string,
  actorUserId?: string | null
): BrandingConfig {
  const db = getDb();
  db.update(schema.tenants)
    .set({
      primaryColor: DEFAULTS.primaryColor,
      accentColor: DEFAULTS.accentColor,
      bgColor: DEFAULTS.bgColor,
      fgColor: DEFAULTS.fgColor,
      fontFamily: DEFAULTS.fontFamily,
      landingTitle: null,
      landingSubtitle: null,
      landingUpdatedAt: new Date().toISOString(),
    })
    .where(eq(schema.tenants.id, tenantId))
    .run();
  logAudit({
    tenantId,
    userId: actorUserId ?? null,
    action: "branding.reset",
  });
  return getBranding(tenantId);
}

// ============================================================================
// File upload (logo / bg / favicon)
// ============================================================================

/**
 * Caminho absoluto do diretório de branding para um tenant.
 */
function brandingDir(tenantId: string): string {
  return path.join(UPLOADS_DIR, "branding", tenantId);
}

/**
 * Caminho absoluto de um arquivo de branding.
 */
export function brandingFilePath(tenantId: string, type: BrandingFileType, ext: string): string {
  return path.join(brandingDir(tenantId), `${FILE_CONSTRAINTS[type].folder}.${ext}`);
}

/**
 * Caminho relativo (como guardado no DB). Ex: "branding/<tenantId>/logo.png"
 */
function brandingDbPath(tenantId: string, type: BrandingFileType, ext: string): string {
  return `branding/${tenantId}/${FILE_CONSTRAINTS[type].folder}.${ext}`;
}

/**
 * Faz upload de um arquivo de branding (logo, bg ou favicon).
 * Valida MIME e tamanho; redimensiona automaticamente se exceder limites.
 * Substitui o arquivo anterior.
 */
export async function uploadBrandingFile(
  tenantId: string,
  type: BrandingFileType,
  buffer: Buffer,
  mime: string,
  filename?: string
): Promise<{ path: string; size: number; width: number; height: number }> {
  const constraints = FILE_CONSTRAINTS[type];
  mime = await resolveMime(buffer, mime, constraints.allowedMime, filename);
  if (!mime || !constraints.allowedMime.includes(mime)) {
    throw new Error(
      `${constraints.label}: tipo não permitido. Use PNG, JPEG, SVG ou WebP.`
    );
  }
  if (buffer.length > constraints.maxBytes) {
    const mb = (constraints.maxBytes / 1024 / 1024).toFixed(1);
    throw new Error(`${constraints.label}: arquivo muito grande (max ${mb}MB)`);
  }

  // SVG não tem dimensões intrínsecas — pula processamento raster
  let width = 0;
  let height = 0;
  if (mime !== "image/svg+xml") {
    try {
      const meta = await sharp(buffer).metadata();
      if (!meta.width || !meta.height) {
        throw new Error(`${constraints.label}: imagem inválida`);
      }
      width = meta.width;
      height = meta.height;
      if (width > constraints.maxWidth || height > constraints.maxHeight) {
        buffer = Buffer.from(
          await sharp(buffer)
            .resize(constraints.maxWidth, constraints.maxHeight, {
              fit: "inside",
              withoutEnlargement: true,
            })
            .toBuffer()
        );
        const resized = await sharp(buffer).metadata();
        width = resized.width ?? width;
        height = resized.height ?? height;
      }
    } catch (e: any) {
      if (e?.message?.includes("inválida")) throw e;
      throw new Error(`${constraints.label}: não foi possível ler a imagem`);
    }
  }

  const ext = MIME_TO_EXT[mime];
  if (!ext) throw new Error("Tipo MIME não suportado");

  const dir = brandingDir(tenantId);
  await fs.mkdir(dir, { recursive: true });

  // Remove arquivo anterior (se extensão diferente)
  try {
    const files = await fs.readdir(dir);
    for (const f of files) {
      if (f.startsWith(`${constraints.folder}.`)) {
        await fs.unlink(path.join(dir, f));
      }
    }
  } catch {
    /* dir pode não existir ainda */
  }

  const storedFilename = `${constraints.folder}.${ext}`;
  const fullPath = path.join(dir, storedFilename);
  await fs.writeFile(fullPath, buffer);

  const dbPath = brandingDbPath(tenantId, type, ext);
  const dbField: Record<BrandingFileType, any> = {
    logo: { logoPath: dbPath, landingUpdatedAt: new Date().toISOString() },
    bg: { bgImagePath: dbPath, landingUpdatedAt: new Date().toISOString() },
    favicon: { faviconPath: dbPath, landingUpdatedAt: new Date().toISOString() },
  };

  const db = getDb();
  db.update(schema.tenants)
    .set(dbField[type])
    .where(eq(schema.tenants.id, tenantId))
    .run();

  logAudit({
    tenantId,
    action: `branding.${type}_uploaded`,
    details: { size: buffer.length, mime, width, height },
  });

  return { path: dbPath, size: buffer.length, width, height };
}

/**
 * Remove o arquivo de branding de um tipo.
 */
export async function removeBrandingFile(
  tenantId: string,
  type: BrandingFileType,
  actorUserId?: string | null
): Promise<void> {
  const dir = brandingDir(tenantId);
  const constraints = FILE_CONSTRAINTS[type];

  try {
    const files = await fs.readdir(dir);
    for (const f of files) {
      if (f.startsWith(`${constraints.folder}.`)) {
        await fs.unlink(path.join(dir, f));
      }
    }
  } catch {
    /* pode não existir */
  }

  const dbField: Record<BrandingFileType, any> = {
    logo: { logoPath: null, landingUpdatedAt: new Date().toISOString() },
    bg: { bgImagePath: null, landingUpdatedAt: new Date().toISOString() },
    favicon: { faviconPath: null, landingUpdatedAt: new Date().toISOString() },
  };
  const db = getDb();
  db.update(schema.tenants)
    .set(dbField[type])
    .where(eq(schema.tenants.id, tenantId))
    .run();

  logAudit({
    tenantId,
    userId: actorUserId ?? null,
    action: `branding.${type}_removed`,
  });
}

/**
 * Lê o arquivo de branding do disco. Retorna null se não existir.
 */
export async function readBrandingFile(
  tenantId: string,
  type: BrandingFileType
): Promise<{ buffer: Buffer; ext: string } | null> {
  const dir = brandingDir(tenantId);
  const constraints = FILE_CONSTRAINTS[type];
  try {
    const files = await fs.readdir(dir);
    const found = files.find((f) => f.startsWith(`${constraints.folder}.`));
    if (!found) return null;
    const ext = found.split(".").pop() || "";
    const buffer = await fs.readFile(path.join(dir, found));
    return { buffer, ext };
  } catch {
    return null;
  }
}

/**
 * Resolve MIME type a partir da extensão.
 */
export function mimeFromExt(ext: string): string {
  const map: Record<string, string> = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    svg: "image/svg+xml",
    webp: "image/webp",
    ico: "image/x-icon",
  };
  return map[ext.toLowerCase()] || "application/octet-stream";
}
