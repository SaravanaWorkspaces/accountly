/**
 * Shared between the server page (which reads the cookie for the first paint)
 * and the client toggle (which writes it). It must live outside the
 * `"use client"` module: values imported from one reach a Server Component as
 * client references, not as the string itself.
 */

export type LedgerStyle = "chat" | "stmt";

export const LEDGER_STYLE_COOKIE = "accountly_ledger_style";

export function toLedgerStyle(value: string | undefined): LedgerStyle {
  return value === "chat" ? "chat" : "stmt";
}
