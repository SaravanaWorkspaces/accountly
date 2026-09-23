"use client";

import { useMemo, useState } from "react";

import { FileViewer } from "./FileViewer";
import { dayLabel, shortDate, type DayContext } from "@/lib/dates";
import { LEDGER_STYLE_COOKIE, type LedgerStyle } from "@/lib/ledger-style";
import { fileBadge, isImage, shortFileName } from "@/lib/mime";
import { formatMoney } from "@/lib/money";
import { ledgerSide, openingSide } from "@/lib/accounting";
import { balanceLabel, balanceTone } from "@/lib/party";
import {
  isInflow,
  txnMeta,
  type Attachment,
  type PartyType,
  type Transaction,
} from "@/lib/types";

export function Ledger({
  entries,
  opening,
  balance,
  partyType,
  days,
  initialStyle,
}: {
  entries: Transaction[];
  /** Minor units the ledger starts from. Positive = they owe you. */
  opening: number;
  /** Minor units still outstanding, opening included. */
  balance: number;
  /** Debit and credit swap sides between a customer and a merchant. */
  partyType: PartyType;
  days: DayContext;
  initialStyle: LedgerStyle;
}) {
  const [style, setStyle] = useState<LedgerStyle>(initialStyle);
  const [viewing, setViewing] = useState<Attachment | null>(null);

  // A zero opening is not a fact worth a line; anything else is where the
  // running balance actually starts, and the statement does not add up without
  // it on the page.
  const hasOpening = opening !== 0;

  // An entry for exactly what is still owed is the one that squares the account
  // off — worth spotting without doing the arithmetic by eye.
  const outstanding = Math.abs(balance);
  const tallies = (amount: number) => outstanding > 0 && amount === outstanding;

  // Newest first, both here and in the statement.
  const recentFirst = useMemo(() => [...entries].reverse(), [entries]);

  const groups = useMemo(() => {
    const out: { date: string; entries: Transaction[] }[] = [];
    for (const entry of recentFirst) {
      const last = out[out.length - 1];
      if (last?.date === entry.date) last.entries.push(entry);
      else out.push({ date: entry.date, entries: [entry] });
    }
    return out;
  }, [recentFirst]);

  function choose(next: LedgerStyle) {
    setStyle(next);
    // Remember the preference across parties and reloads. Read back on the
    // server so the first paint already matches.
    document.cookie = `${LEDGER_STYLE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
  }

  return (
    <>
      <div className="mx-1 mb-3 flex items-center justify-between gap-3">
        <span className="text-xs uppercase tracking-[0.1em] text-subtle">Transactions</span>
        <div className="flex rounded-full bg-raised p-[3px]" role="group" aria-label="Ledger style">
          <StyleTab active={style === "chat"} onClick={() => choose("chat")}>
            Bubbles
          </StyleTab>
          <StyleTab active={style === "stmt"} onClick={() => choose("stmt")}>
            Statement
          </StyleTab>
        </div>
      </div>

      {entries.length === 0 && !hasOpening ? (
        <div className="rounded-[18px] border border-dashed border-line-dash bg-surface px-5 py-[34px] text-center text-[15px] text-muted">
          <p>No entries yet — log the first payment above.</p>
        </div>
      ) : style === "chat" ? (
        // Newest first, so the balance the ledger opened with sits at the foot.
        <div className="flex flex-col gap-5">
          {groups.map((group) => (
            <div key={group.date} className="flex flex-col gap-2.5">
              <div className="flex items-center gap-3">
                <span className="h-px flex-1 bg-line" />
                <span className="text-[11px] uppercase tracking-[0.1em] text-faint">
                  {dayLabel(group.date, days)}
                </span>
                <span className="h-px flex-1 bg-line" />
              </div>
              {group.entries.map((entry) => (
                <Bubble
                  key={entry.id}
                  entry={entry}
                  tallies={tallies(entry.amount)}
                  onOpenFile={setViewing}
                />
              ))}
            </div>
          ))}
          {hasOpening ? <OpeningMarker opening={opening} /> : null}
        </div>
      ) : (
        <Statement
          entries={recentFirst}
          opening={hasOpening ? opening : null}
          partyType={partyType}
          tallies={tallies}
          days={days}
          onOpenFile={setViewing}
        />
      )}

      {entries.length === 0 && hasOpening ? (
        <p className="mt-3 text-center text-[13px] text-muted">
          No entries yet — log the first payment above.
        </p>
      ) : null}

      <FileViewer file={viewing} onClose={() => setViewing(null)} />
    </>
  );
}

function StyleTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`tap-target rounded-full px-[13px] py-[7px] text-[13px] font-semibold transition-colors ${
        active ? "bg-ink text-canvas" : "text-muted hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

function Bubble({
  entry,
  tallies,
  onOpenFile,
}: {
  entry: Transaction;
  tallies: boolean;
  onOpenFile: (file: Attachment) => void;
}) {
  const inflow = isInflow(entry.type);

  return (
    <div className={`flex ${inflow ? "justify-start" : "justify-end"}`}>
      {/*
        The fill keeps saying which way the money went; only the outline
        changes, so a tallying entry stands out without losing that. Exactly one
        border class is applied — two would leave the winner to stylesheet
        order rather than to intent.
      */}
      <div
        className={`flex max-w-[min(88%,420px)] flex-col gap-2 rounded-[18px] px-4 py-3.5 ${
          tallies
            ? "border-2 border-accent"
            : inflow
              ? "border border-in-line"
              : "border border-out-line"
        } ${inflow ? "bg-in-bg" : "bg-out-bg"}`}
      >
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <span
            className={`text-xs font-semibold uppercase tracking-[0.06em] ${
              inflow ? "text-in" : "text-out"
            }`}
          >
            {txnMeta(entry.type).label}
            {tallies ? <TallyChip /> : null}
          </span>
          <span
            className={`font-mono text-xl font-medium ${inflow ? "text-in" : "text-out"}`}
          >
            {formatMoney(entry.amount)}
          </span>
        </div>

        {entry.note ? (
          <p className="text-sm leading-[1.4] text-body">{entry.note}</p>
        ) : null}

        {entry.attachments.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {entry.attachments.map((file) => (
              <FileChip key={file.id} file={file} onOpen={onOpenFile} />
            ))}
          </div>
        ) : null}

        <span className="text-[11px] text-faint">{shortDate(entry.date)}</span>
      </div>
    </div>
  );
}

function Statement({
  entries,
  opening,
  partyType,
  tallies,
  days,
  onOpenFile,
}: {
  entries: Transaction[];
  /** Minor units, or null when there is nothing to carry forward. */
  opening: number | null;
  partyType: PartyType;
  tallies: (amount: number) => boolean;
  days: DayContext;
  onOpenFile: (file: Attachment) => void;
}) {
  // `entries` arrives newest first. Walk it backwards so each row carries the
  // balance as it stood *after* that entry, the way a passbook reads.
  const runningAfter = new Map<string, number>();
  let running = opening ?? 0;
  for (let i = entries.length - 1; i >= 0; i -= 1) {
    const entry = entries[i];
    running += txnMeta(entry.type).dir * entry.amount;
    runningAfter.set(entry.id, running);
  }

  return (
    <div className="overflow-hidden rounded-[18px] border border-line bg-surface">
      <div className="grid grid-cols-[1fr_68px_68px_78px] gap-2 border-b border-line bg-header-row px-4 py-3 text-[11px] uppercase tracking-[0.08em] text-subtle sm:grid-cols-[1fr_88px_88px_96px]">
        <span>Entry</span>
        {/*
          Which column an amount lands in comes from `ledgerSide`, and it
          mirrors between the two kinds of party: money in from a customer is a
          credit to you, money in from a merchant is a debit. The colour still
          tracks the direction of the cash, not the column.
        */}
        <span className="text-right">Debit</span>
        <span className="text-right">Credit</span>
        <span className="text-right">Balance</span>
      </div>

      {entries.map((entry) => {
        const inflow = isInflow(entry.type);
        const side = ledgerSide(partyType, entry.type);
        const tone = inflow ? "text-in" : "text-out";
        const amount = formatMoney(entry.amount);
        const squares = tallies(entry.amount);
        return (
          <div
            key={entry.id}
            className={`grid grid-cols-[1fr_68px_68px_78px] items-center gap-2 border-b border-line-soft px-4 py-3.5 last:border-b-0 sm:grid-cols-[1fr_88px_88px_96px] ${
              squares ? "bg-accent-bg" : ""
            }`}
          >
            <span className="flex min-w-0 flex-col gap-[3px]">
              <span className="text-sm font-semibold text-ink">
                {txnMeta(entry.type).label}
                {squares ? <TallyChip /> : null}
              </span>
              <span className="truncate text-xs text-subtle">
                {entry.note ? `${entry.note} · ` : ""}
                {dayLabel(entry.date, days)}
              </span>
              {entry.attachments.length > 0 ? (
                <span className="mt-1 flex flex-wrap gap-2">
                  {entry.attachments.map((file) => (
                    <FileChip key={file.id} file={file} onOpen={onOpenFile} />
                  ))}
                </span>
              ) : null}
            </span>
            <span
              className={`text-right font-mono text-[15px] ${side === "debit" ? tone : ""}`}
            >
              {side === "debit" ? amount : ""}
            </span>
            <span
              className={`text-right font-mono text-[15px] ${side === "credit" ? tone : ""}`}
            >
              {side === "credit" ? amount : ""}
            </span>
            <span className="text-right font-mono text-[15px] text-body">
              {formatMoney(runningAfter.get(entry.id) ?? 0)}
            </span>
          </div>
        );
      })}

      {opening !== null ? <OpeningRow opening={opening} /> : null}
    </div>
  );
}

/**
 * The statement's last line. Tinted apart from the entries above it because it
 * is not something that happened on a day — it is what the ledger inherited.
 */
function OpeningRow({ opening }: { opening: number }) {
  const side = openingSide(opening);
  const tone = opening > 0 ? "text-in" : "text-out";
  const amount = formatMoney(opening);

  return (
    <div className="grid grid-cols-[1fr_68px_68px_78px] items-center gap-2 border-t border-line bg-header-row px-4 py-3.5 sm:grid-cols-[1fr_88px_88px_96px]">
      <span className="flex min-w-0 flex-col gap-[3px]">
        <span className="text-sm font-semibold text-ink">Opening balance</span>
        <span className="truncate text-xs text-subtle">Carried forward</span>
      </span>
      <span
        className={`text-right font-mono text-[15px] ${side === "debit" ? tone : ""}`}
      >
        {side === "debit" ? amount : ""}
      </span>
      <span
        className={`text-right font-mono text-[15px] ${side === "credit" ? tone : ""}`}
      >
        {side === "credit" ? amount : ""}
      </span>
      <span className="text-right font-mono text-[15px] text-body">{amount}</span>
    </div>
  );
}

/** Marks an entry whose amount is exactly what is still outstanding. */
function TallyChip() {
  return (
    <span className="ml-1.5 inline-block rounded-full border border-accent-line bg-accent-bg px-1.5 py-[1px] align-middle text-[10px] font-semibold tracking-[0.04em] text-accent">
      Tallies
    </span>
  );
}

/**
 * The bubble stream's opening. Centred rather than pushed to a side: the
 * left/right split means money in or out, and this is neither — it is where the
 * ledger starts.
 */
function OpeningMarker({ opening }: { opening: number }) {
  const tone = balanceTone(opening);

  return (
    <div className="flex flex-col items-center gap-1 rounded-[16px] border border-dashed border-line-dash bg-surface px-4 py-3.5 text-center">
      <span className="text-[11px] uppercase tracking-[0.1em] text-subtle">
        Opening balance
      </span>
      <span
        className={`font-mono text-lg font-medium ${
          tone === "in" ? "text-in" : tone === "out" ? "text-out" : "text-subtle"
        }`}
      >
        {formatMoney(opening)}
      </span>
      <span className="text-xs text-muted">{balanceLabel(opening)}</span>
    </div>
  );
}

function FileChip({
  file,
  onOpen,
}: {
  file: Attachment;
  onOpen: (file: Attachment) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(file)}
      className="tap-target flex items-center gap-[7px] rounded-[10px] border border-line bg-surface py-1.5 pr-2.5 pl-1.5 text-xs text-body transition-colors hover:border-ink"
    >
      <span
        aria-hidden
        className="flex h-[26px] w-[26px] items-center justify-center rounded-md bg-raised bg-cover bg-center text-[10px] font-semibold text-subtle"
        style={
          isImage(file.mime)
            ? { backgroundImage: `url(/api/files/${file.id})` }
            : undefined
        }
      >
        {fileBadge(file.mime)}
      </span>
      <span className="max-w-[140px] truncate">{shortFileName(file.name)}</span>
    </button>
  );
}
