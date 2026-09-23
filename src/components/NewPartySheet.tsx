"use client";

import { useActionState, useEffect, useId, useState } from "react";

import { Field } from "./Field";
import { Sheet } from "./Sheet";
import { SubmitButton } from "./SubmitButton";

import { createParty } from "@/lib/actions";
import { idleState } from "@/lib/action-state";
import { amountWordsFor } from "@/lib/amount-words";
import { parseAmount } from "@/lib/money";
import { PARTY_TYPES } from "@/lib/types";
import type { PartyType } from "@/lib/types";

export function NewPartySheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [state, formAction] = useActionState(createParty, idleState);
  const [type, setType] = useState<PartyType>("Customer");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [opening, setOpening] = useState("");
  // Most parties are a name and a figure. Phone and email are worth keeping and
  // rarely worth typing, so they start folded away instead of standing between
  // the name and the balance.
  const [showContact, setShowContact] = useState(false);
  // A stale error under a field the user has since corrected is noise; it
  // clears on the next edit and comes back only if the server rejects again.
  const [showError, setShowError] = useState(true);
  const contactId = useId();

  useEffect(() => setShowError(true), [state]);

  // Closing the sheet ends this party, so the next one starts from scratch.
  useEffect(() => {
    if (open) return;
    setPhone("");
    setEmail("");
    setOpening("");
    setShowContact(false);
  }, [open]);

  const hasContact = phone.trim() !== "" || email.trim() !== "";
  const openingWords = amountWordsFor(parseAmount(opening, { allowNegative: true }));

  return (
    <Sheet open={open} title="Add a party" onClose={onClose}>
      <form
        action={formAction}
        onChange={() => setShowError(false)}
        className="flex flex-col gap-3.5"
      >
        <Field label="Name" name="name" required placeholder="e.g. Ramesh Traders" autoComplete="off" maxLength={120} />

        <div className="flex flex-col gap-[7px] text-[13px] text-muted">
          <span id="party-type-label">Type</span>
          <div className="flex gap-2.5" role="group" aria-labelledby="party-type-label">
            {PARTY_TYPES.map((option) => {
              const active = type === option;
              return (
                <button
                  key={option}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setType(option)}
                  className={`min-h-12 flex-1 rounded-[13px] border p-3 text-[15px] font-semibold transition-colors ${
                    active
                      ? "border-ink bg-raised text-ink"
                      : "border-line bg-surface text-subtle hover:border-line-dash"
                  }`}
                >
                  {option}
                </button>
              );
            })}
          </div>
          <input type="hidden" name="type" value={type} />
        </div>

        <div className="flex flex-col gap-3.5">
          <button
            type="button"
            onClick={() => setShowContact((shown) => !shown)}
            aria-expanded={showContact}
            aria-controls={contactId}
            className="flex min-h-12 items-center justify-between gap-3 rounded-[13px] border border-dashed border-line-dash bg-surface px-3.5 py-3 text-left text-[15px] font-semibold text-body transition-colors hover:border-ink"
          >
            <span>Phone and email</span>
            <span className="text-[13px] font-normal text-subtle">
              {showContact ? "Hide ⌃" : hasContact ? "Added ⌄" : "Optional ⌄"}
            </span>
          </button>

          {/*
            Hidden rather than unmounted: a number typed and then folded away is
            still a number the party should be saved with.
          */}
          <div id={contactId} className={showContact ? "flex flex-col gap-3.5" : "hidden"}>
            <Field
              label="Phone"
              name="phone"
              inputMode="tel"
              placeholder="Optional"
              autoComplete="off"
              maxLength={40}
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
            />
            <Field
              label="Email"
              name="email"
              inputMode="email"
              placeholder="Optional"
              autoComplete="off"
              maxLength={160}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Field
            label="Opening balance"
            name="opening"
            inputMode="decimal"
            placeholder="0"
            inputClassName="font-mono"
            hint="Positive if they owe you, negative if you owe them."
            maxLength={24}
            value={opening}
            onChange={(event) => setOpening(event.target.value)}
          />
          {openingWords ? (
            // Outside the <label>, so a figure that changes on every keystroke
            // does not keep rewriting the input's accessible name.
            <p aria-live="polite" className="text-[13px] leading-snug text-muted">
              {openingWords}
            </p>
          ) : null}
        </div>

        {state.error && showError ? (
          <p role="alert" className="text-[13px] text-out">
            {state.error}
          </p>
        ) : null}

        <SubmitButton pendingLabel="Saving…">Save party</SubmitButton>
      </form>
    </Sheet>
  );
}
