"use client";

import { useActionState, useEffect, useId, useState } from "react";

import { INPUT_CLASS } from "./Field";
import { Sheet } from "./Sheet";

import { deleteParty } from "@/lib/actions";
import { idleState } from "@/lib/action-state";
import { formatMoney } from "@/lib/money";
import { balanceLabel } from "@/lib/party";

/**
 * Deleting a party destroys money history and there is no undo, so the friction
 * is scaled to what is at stake: an empty party goes in a single confirm, one
 * holding entries or an unsettled balance asks for its name back first. The
 * sheet spends its words on what will be lost — the counts, and the balance
 * about to be written off — rather than on asking whether the user is sure.
 */
export function DeleteParty({
  partyId,
  partyName,
  entryCount,
  attachmentCount,
  balance,
}: {
  partyId: string;
  partyName: string;
  entryCount: number;
  attachmentCount: number;
  balance: number;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(deleteParty, idleState);
  const [typed, setTyped] = useState("");
  // A rejection the user has since typed past is noise; it comes back only if
  // the server rejects again.
  const [showError, setShowError] = useState(true);
  const summaryId = useId();

  // Entries or an unsettled balance both put real money at stake; either one
  // is enough to ask for the name. Mirrored in `deleteParty` on the server.
  const needsName = entryCount > 0 || balance !== 0;
  const matches = normalise(typed) === normalise(partyName);

  useEffect(() => setShowError(true), [state]);

  function close() {
    setOpen(false);
    // Never leave a half-typed confirmation waiting for the next visit.
    setTyped("");
  }

  return (
    <>
      {/*
        Right-aligned with `text-right` rather than a flex row: the bubble
        ledger's alignment test counts `justify-end` boxes on the page.
      */}
      <div className="mt-[18px] border-t border-line-soft pt-3.5 text-right">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="tap-target rounded-[10px] px-1.5 py-1 text-[13px] text-subtle transition-colors hover:text-out"
        >
          Delete party
        </button>
      </div>

      <Sheet
        open={open}
        role="alertdialog"
        title={`Delete ${partyName}?`}
        describedBy={summaryId}
        onClose={close}
      >
        <form
          action={formAction}
          onChange={() => setShowError(false)}
          className="flex flex-col gap-4"
        >
          <input type="hidden" name="partyId" value={partyId} />

          <div id={summaryId} className="flex flex-col gap-3">
            <p className="text-[15px] leading-relaxed text-body">
              {entryCount > 0 ? (
                <>
                  {plural(entryCount, "entry", "entries")}
                  {attachmentCount > 0
                    ? ` and ${plural(attachmentCount, "receipt", "receipts")}`
                    : ""}{" "}
                  will be deleted along with this party. This cannot be undone.
                </>
              ) : (
                <>
                  This party has no entries yet. Deleting it takes it off your
                  ledger for good.
                </>
              )}
            </p>

            {balance !== 0 ? (
              <p className="rounded-[13px] border border-out-line bg-out-bg px-3.5 py-3 text-[13px] leading-relaxed text-out">
                <span className="font-semibold">
                  {balanceLabel(balance)} {formatMoney(balance)}.
                </span>{" "}
                That balance goes with the ledger — settle it or write it down
                somewhere else first.
              </p>
            ) : null}
          </div>

          {needsName ? (
            <label className="flex flex-col gap-[7px] text-[13px] text-muted">
              <span>
                Type <span className="font-semibold text-ink">{partyName}</span>{" "}
                to confirm
              </span>
              <input
                name="confirm"
                value={typed}
                onChange={(event) => setTyped(event.target.value)}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                maxLength={160}
                aria-label={`Type ${partyName} to confirm deletion`}
                className={INPUT_CLASS}
              />
            </label>
          ) : null}

          {state.error && showError ? (
            <p role="alert" className="text-[13px] text-out">
              {state.error}
            </p>
          ) : null}

          {/*
            Keeping comes first in the DOM so focus and the Tab order reach the
            safe choice before the destructive one.
          */}
          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={close}
              className="min-h-[52px] flex-1 rounded-[14px] border border-line bg-surface px-4 py-[15px] text-base font-semibold text-ink transition-colors hover:bg-raised"
            >
              Keep party
            </button>
            <button
              type="submit"
              disabled={pending || (needsName && !matches)}
              className="min-h-[52px] flex-1 rounded-[14px] bg-out px-4 py-[15px] text-base font-semibold text-canvas transition-colors hover:bg-out-strong disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending ? "Deleting…" : "Delete"}
            </button>
          </div>
        </form>
      </Sheet>
    </>
  );
}

/** Confirmation is about intent, not typing precision: fold case and spacing. */
function normalise(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}
