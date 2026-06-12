export function normalizeNumber(number: string, defaultCc = "55"): string {
  if (!number) return "";
  const digits = (number || "").replace(/\D+/g, "");
  if (!digits) return "";

  if (digits.startsWith(defaultCc)) return digits;

  if (digits.length === 13 && digits.startsWith("55")) return digits;
  if (digits.length === 10 || digits.length === 11)
    return defaultCc + digits;
  if (digits.length === 12 && digits.startsWith("55")) return digits;
  return digits;
}

export function looksLikeMobileBr(digits: string): boolean {
  if (digits.length !== 13 || !digits.startsWith("55")) return false;
  const ddd = digits.slice(2, 4);
  const n9 = digits[4];
  if (!ddd || !ddd.match(/^\d+$/) || parseInt(ddd, 10) < 11) return false;
  if (n9 !== "9") return false;
  return true;
}
