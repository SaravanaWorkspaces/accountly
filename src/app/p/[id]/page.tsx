import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { Avatar } from "@/components/Avatar";
import { DeleteParty } from "@/components/DeleteParty";
import { EntryActions } from "@/components/EntryActions";
import { Ledger } from "@/components/Ledger";
import { dayContext } from "@/lib/dates";
import { LEDGER_STYLE_COOKIE, toLedgerStyle } from "@/lib/ledger-style";
import { formatMoney } from "@/lib/money";
import { balanceLabel, balanceTone, partyMeta } from "@/lib/party";
import { getParty, getPartyLedger } from "@/lib/queries";

export const dynamic = "force-dynamic";

const TONE_TEXT = {
  in: "text-in",
  out: "text-out",
  flat: "text-subtle",
} as const;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const party = await getParty((await params).id);
  return { title: party?.name ?? "Party" };
}

export default async function PartyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ledger = await getPartyLedger((await params).id);
  if (!ledger) notFound();

  const { party, entries, balance } = ledger;
  const attachmentCount = entries.reduce((n, entry) => n + entry.attachments.length, 0);
  const days = dayContext();
  const style = toLedgerStyle((await cookies()).get(LEDGER_STYLE_COOKIE)?.value);

  return (
    <div>
      <Link
        href="/"
        className="flex min-h-11 items-center gap-1.5 py-1.5 text-sm text-muted no-underline transition-colors hover:text-ink hover:no-underline"
      >
        ← All parties
      </Link>

      <section className="my-1.5 mb-4 rounded-[22px] border border-line bg-surface p-[22px]">
        <div className="flex flex-wrap items-center gap-3.5">
          <Avatar name={party.name} size="lg" />
          <div className="flex min-w-0 flex-[1_1_160px] flex-col gap-[3px]">
            <h1 className="font-serif text-[27px] leading-[1.15] tracking-[-0.01em] text-ink">
              {party.name}
            </h1>
            <p className="text-[13px] text-subtle">{partyMeta(party)}</p>
          </div>
          <div className="flex flex-col items-end gap-[3px]">
            <span className="text-[11px] uppercase tracking-[0.08em] text-subtle">
              {balanceLabel(balance)}
            </span>
            <span
              className={`font-mono text-[26px] font-medium ${TONE_TEXT[balanceTone(balance)]}`}
            >
              {formatMoney(balance)}
            </span>
          </div>
        </div>

        <EntryActions
          partyId={party.id}
          partyName={party.name}
          today={days.today}
        />

        <DeleteParty
          partyId={party.id}
          partyName={party.name}
          entryCount={entries.length}
          attachmentCount={attachmentCount}
          balance={balance}
        />
      </section>

      <Ledger
        entries={entries}
        opening={party.opening}
        days={days}
        initialStyle={style}
      />
    </div>
  );
}
