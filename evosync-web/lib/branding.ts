/**
 * Types e constants de branding — client-safe (sem dependência de DB).
 *
 * Separado de `server/store/branding.ts` pra que componentes client
 * possam importar tipos e constants sem trazer better-sqlite3 junto
 * (que causa erro de bundling no client).
 */

export type BrandingFileType = "logo" | "bg" | "favicon";

export interface BrandingConfig {
  logoPath: string | null;
  bgImagePath: string | null;
  faviconPath: string | null;
  primaryColor: string;
  accentColor: string;
  bgColor: string;
  fgColor: string;
  fontFamily: string;
  landingTitle: string | null;
  landingSubtitle: string | null;
  landingUpdatedAt: string | null;
}

export interface UpdateBrandingInput {
  primaryColor?: string;
  accentColor?: string;
  bgColor?: string;
  fgColor?: string;
  fontFamily?: string;
  landingTitle?: string | null;
  landingSubtitle?: string | null;
}

export const FONT_FAMILIES = [
  "Inter",
  "Roboto",
  "Poppins",
  "System",
] as const;
export type FontFamily = (typeof FONT_FAMILIES)[number];

export const COLOR_PRESETS = [
  "#0F9D58", // WhatsApp verde
  "#25D366", // WhatsApp claro
  "#3B82F6", // Azul
  "#EF4444", // Vermelho
  "#F59E0B", // Âmbar
  "#8B5CF6", // Roxo
  "#EC4899", // Rosa
  "#0F172A", // Slate-900
  "#F8FAFC", // Slate-50
  "#0EA5E9", // Sky
];

export const HEX_REGEX = /^#[0-9a-fA-F]{6}$/;

/** Nome público na landing — landingTitle personalizado ou fallback do tenant. */
export function getLandingDisplayName(
  branding: Pick<BrandingConfig, "landingTitle">,
  tenantName: string
): string {
  const custom = branding.landingTitle?.trim();
  return custom || tenantName;
}
