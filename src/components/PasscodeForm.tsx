"use client";

import { useActionState } from "react";

import { SubmitButton } from "./SubmitButton";
import { signIn } from "@/lib/actions";
import { idleState } from "@/lib/action-state";

export function PasscodeForm({ next }: { next: string }) {
  const [state, formAction] = useActionState(signIn, idleState);

  return (
    <form action={formAction} className="flex flex-col gap-3.5">
      <input type="hidden" name="next" value={next} />
      <label className="flex flex-col gap-[7px] text-[13px] text-muted">
        Passcode
        <input
          name="passcode"
          type="password"
          autoComplete="current-password"
          autoFocus
          required
          className="min-h-12 w-full rounded-[13px] border border-line bg-surface px-3.5 py-3 font-mono text-base text-ink"
        />
      </label>

      {state.error ? (
        <p role="alert" className="text-[13px] text-out">
          {state.error}
        </p>
      ) : null}

      <SubmitButton pendingLabel="Checking…">Open ledger</SubmitButton>
    </form>
  );
}
