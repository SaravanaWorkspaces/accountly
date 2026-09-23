import type { PartySummary } from "./types";

/** First letter of the first two words, e.g. "Ramesh Traders" -> "RT". */
export function initialsOf(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((word) => [...word][0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

export type BalanceTone = "in" | "out" | "flat";

export function balanceTone(balance: number): BalanceTone {
  if (balance === 0) return "flat";
  return balance > 0 ? "in" : "out";
}

export function balanceLabel(balance: number): string {
  return balance >= 0 ? "They owe you" : "You owe them";
}

export function partyMeta(party: Pick<PartySummary, "type" | "phone" | "email">) {
  return [party.type, party.phone, party.email].filter(Boolean).join(" · ");
}
