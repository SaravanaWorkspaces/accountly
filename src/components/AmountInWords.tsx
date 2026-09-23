"use client";

import { amountInWords } from "@/lib/amount-words";
import { formatMoneyExact } from "@/lib/money";

/**
 * Once an amount runs past three digits it stops being readable at a glance —
 * ₹125000 and ₹12500 look alike in a hurry, and a misplaced zero in a ledger is
 * an expensive mistake. That is the point at which the words earn their place.
 */
const SPELL_OUT_FROM = 1000;

const TONE = {
  in: "border-in-line bg-in-bg",
  out: "border-out-line bg-out-bg",
  flat: "border-line bg-raised",
} as const;

const NUMERAL_TONE = {
  in: "text-in",
  out: "text-out",
  flat: "text-ink",
} as const;

export function AmountInWords({
  minor,
  tone = "flat",
  caption,
}: {
  /** Minor units, or null while the field is empty or unparseable. */
  minor: number | null;
  tone?: keyof typeof TONE;
  /**
   * What the figure means, for a field where the sign carries meaning. The
   * words themselves are unsigned, so "Two lakh fifty thousand rupees" reads
   * the same whoever owes it.
   */
  caption?: string;
}) {
  if (minor === null || !Number.isFinite(minor)) return null;
  if (Math.floor(Math.abs(minor) / 100) < SPELL_OUT_FROM) return null;

  return (
    <div
      // Announced rather than silent: reading back a large figure is exactly
      // the confirmation someone not looking at the field needs.
      aria-live="polite"
      className={`animate-fade-in rounded-[13px] border px-3.5 py-2.5 ${TONE[tone]}`}
    >
      {caption ? (
        <p className="mb-1 text-[11px] uppercase tracking-[0.08em] text-subtle">
          {caption}
        </p>
      ) : null}
      <p
        className={`font-mono text-[15px] font-medium tracking-tight ${NUMERAL_TONE[tone]}`}
      >
        {minor < 0 ? "−" : ""}
        {formatMoneyExact(minor)}
      </p>
      <p className="mt-1 text-[13px] leading-snug text-body">
        {amountInWords(minor)}
      </p>
    </div>
  );
}
