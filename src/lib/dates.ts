/**
 * Day handling is deliberately string-based (YYYY-MM-DD). "Today" is resolved
 * once on the server and threaded through as props so the server-rendered
 * markup and the client hydration always agree, whatever timezone the viewer
 * is in. Set the `TZ` env var to pin the server's idea of today.
 */
import { LOCALE } from "./money";

export type DayContext = { today: string; yesterday: string };

export function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function dayContext(now = new Date()): DayContext {
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  return { today: toIsoDate(now), yesterday: toIsoDate(yesterday) };
}

export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00`);
  return !Number.isNaN(parsed.getTime()) && toIsoDate(parsed) === value;
}

/** "Today" / "Yesterday" / "5 Sep 2026" */
export function dayLabel(date: string, ctx: DayContext): string {
  if (date === ctx.today) return "Today";
  if (date === ctx.yesterday) return "Yesterday";
  return new Date(`${date}T00:00:00`).toLocaleDateString(LOCALE, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** "5 Sep" — the compact stamp inside a bubble. */
export function shortDate(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString(LOCALE, {
    day: "numeric",
    month: "short",
  });
}
