"use client";

import { useMemo, useState } from "react";

import { FileViewer } from "./FileViewer";
import { dayLabel, shortDate, type DayContext } from "@/lib/dates";
import { LEDGER_STYLE_COOKIE, type LedgerStyle } from "@/lib/ledger-style";
import { fileBadge, isImage, shortFileName } from "@/lib/mime";
import { formatMoney } from "@/lib/money";
import { balanceLabel, balanceTone } from "@/lib/party";
import { isInflow, txnMeta, type Attachment, type Transaction } from "@/lib/types";

export function Ledger({
  entries,
  opening,
  days,
  initialStyle,
}: {
  entries: Transaction[];
  /** Minor units the ledger starts from. Positive = they owe you. */
  opening: number;
  days: DayContext;
  initialStyle: LedgerStyle;
}) {
  const [style, setStyle] = useState<LedgerStyle>(initialStyle);
  const [viewing, setViewing] = useState<Attachment | null>(null);

  // A zero opening is not a fact worth a line; anything else is where the
  // running balance actually starts, and the statement does not add up without
  // it on the page.
  const hasOpening = opening !== 0;

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
                <Bubble key={entry.id} entry={entry} onOpenFile={setViewing} />
              ))}
            </div>
          ))}
          {hasOpening ? <OpeningMarker opening={opening} /> : null}
        </div>
      ) : (
        <Statement
          entries={recentFirst}
          opening={hasOpening ? opening : null}
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
  onOpenFile,
}: {
  entry: Transaction;
  onOpenFile: (file: Attachment) => void;
}) {
  const inflow = isInflow(entry.type);

  return (
    <div className={`flex ${inflow ? "justify-start" : "justify-end"}`}>
      <div
        className={`flex max-w-[min(88%,420px)] flex-col gap-2 rounded-[18px] border px-4 py-3.5 ${
          inflow ? "border-in-line bg-in-bg" : "border-out-line bg-out-bg"
        }`}
      >
        <div className="flex items-baseline justify-between gap-3">
          <span
            className={`text-xs font-semibold uppercase tracking-[0.06em] ${
              inflow ? "text-in" : "text-out"
            }`}
          >
            {txnMeta(entry.type).label}
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
  days,
  onOpenFile,
}: {
  entries: Transaction[];
  /** Minor units, or null when there is nothing to carry forward. */
  opening: number | null;
  days: DayContext;
  onOpenFile: (file: Attachment) => void;
}) {
  return (
    <div className="overflow-hidden rounded-[18px] border border-line bg-surface">
      <div className="grid grid-cols-[1fr_76px_76px] gap-2 border-b border-line bg-header-row px-4 py-3 text-[11px] uppercase tracking-[0.08em] text-subtle sm:grid-cols-[1fr_96px_96px]">
        <span>Entry</span>
        <span className="text-right">Received</span>
        <span className="text-right">Paid</span>
      </div>

      {entries.map((entry) => {
        const inflow = isInflow(entry.type);
        const amount = formatMoney(entry.amount);
        return (
          <div
            key={entry.id}
            className="grid grid-cols-[1fr_76px_76px] items-center gap-2 border-b border-line-soft px-4 py-3.5 last:border-b-0 sm:grid-cols-[1fr_96px_96px]"
          >
            <span className="flex min-w-0 flex-col gap-[3px]">
              <span className="text-sm font-semibold text-ink">
                {txnMeta(entry.type).label}
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
            <span className="text-right font-mono text-[15px] text-in">
              {inflow ? amount : ""}
            </span>
            <span className="text-right font-mono text-[15px] text-out">
              {inflow ? "" : amount}
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
  const owed = opening > 0;
  const amount = formatMoney(opening);

  return (
    <div className="grid grid-cols-[1fr_76px_76px] items-center gap-2 border-t border-line bg-header-row px-4 py-3.5 sm:grid-cols-[1fr_96px_96px]">
      <span className="flex min-w-0 flex-col gap-[3px]">
        <span className="text-sm font-semibold text-ink">Opening balance</span>
        <span className="truncate text-xs text-subtle">Carried forward</span>
      </span>
      <span className="text-right font-mono text-[15px] text-in">
        {owed ? amount : ""}
      </span>
      <span className="text-right font-mono text-[15px] text-out">
        {owed ? "" : amount}
      </span>
    </div>
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
