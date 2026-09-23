/**
 * Money is stored and passed around as integer minor units (paise/cents) so no
 * balance ever depends on float arithmetic. Display rounds to whole major
 * units, matching the ledger's design.
 */

export const CURRENCY = process.env.NEXT_PUBLIC_CURRENCY?.trim() || "₹";
export const LOCALE = process.env.NEXT_PUBLIC_LOCALE?.trim() || "en-IN";

/** `"1,234"` — absolute value, no sign. Colour carries the direction. */
export function formatAmount(minor: number): string {
  return Math.abs(Math.round(minor / 100)).toLocaleString(LOCALE);
}

/** `"₹1,234"` — absolute value with the currency symbol. */
export function formatMoney(minor: number): string {
  return CURRENCY + formatAmount(minor);
}

/**
 * Parse user input into minor units. Mirrors the tolerant behaviour of the
 * design: strip anything that is not a digit, dot or leading minus.
 */
export function parseAmount(
  raw: string,
  { allowNegative = false }: { allowNegative?: boolean } = {},
): number | null {
  const cleaned = raw.replace(allowNegative ? /[^0-9.\-]/g : /[^0-9.]/g, "");
  if (!cleaned || cleaned === "-" || cleaned === ".") return null;

  const negative = allowNegative && cleaned.trimStart().startsWith("-");
  // Keep only the first dot so "1.2.3" does not become NaN.
  const digits = cleaned.replace(/-/g, "");
  const [whole, ...rest] = digits.split(".");
  const normalised = rest.length ? `${whole}.${rest.join("")}` : whole;

  const value = Number(normalised);
  if (!Number.isFinite(value)) return null;

  const minor = Math.round(value * 100);
  return negative ? -minor : minor;
}
