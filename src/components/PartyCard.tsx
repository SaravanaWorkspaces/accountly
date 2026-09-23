import Link from "next/link";

import { Avatar } from "./Avatar";
import { dayLabel, type DayContext } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { balanceLabel, balanceTone } from "@/lib/party";
import type { PartySummary } from "@/lib/types";

const TONE_TEXT = {
  in: "text-in",
  out: "text-out",
  flat: "text-subtle",
} as const;

export function PartyCard({
  party,
  days,
}: {
  party: PartySummary;
  days: DayContext;
}) {
  const tone = balanceTone(party.balance);

  return (
    <Link
      href={`/p/${party.id}`}
      className="flex flex-col gap-3.5 rounded-[18px] border border-line bg-surface p-4 text-left no-underline transition-colors hover:border-ink hover:no-underline"
    >
      <span className="flex items-center gap-3">
        <Avatar name={party.name} />
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate text-base font-semibold tracking-[-0.01em] text-ink">
            {party.name}
          </span>
          <span className="text-xs uppercase tracking-[0.06em] text-subtle">
            {party.type}
          </span>
        </span>
      </span>

      <span className="flex items-end justify-between gap-2.5">
        <span className="flex flex-col gap-[3px]">
          <span className="text-[11px] uppercase tracking-[0.08em] text-subtle">
            {balanceLabel(party.balance)}
          </span>
          <span className={`font-mono text-[19px] font-medium ${TONE_TEXT[tone]}`}>
            {formatMoney(party.balance)}
          </span>
        </span>
        <span className="shrink-0 text-xs text-faint">
          {party.lastDate ? dayLabel(party.lastDate, days) : "No entries"}
        </span>
      </span>
    </Link>
  );
}
