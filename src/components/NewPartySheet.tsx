"use client";

import { useActionState, useEffect, useState } from "react";

import { Field } from "./Field";
import { Sheet } from "./Sheet";
import { SubmitButton } from "./SubmitButton";

import { createParty } from "@/lib/actions";
import { idleState } from "@/lib/action-state";
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
  // A stale error under a field the user has since corrected is noise; it
  // clears on the next edit and comes back only if the server rejects again.
  const [showError, setShowError] = useState(true);

  useEffect(() => setShowError(true), [state]);

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

        <Field label="Phone" name="phone" inputMode="tel" placeholder="Optional" autoComplete="off" maxLength={40} />
        <Field label="Email" name="email" inputMode="email" placeholder="Optional" autoComplete="off" maxLength={160} />
        <Field
          label="Opening balance"
          name="opening"
          inputMode="decimal"
          placeholder="0"
          inputClassName="font-mono"
          hint="Positive if they owe you, negative if you owe them."
          maxLength={24}
        />

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
