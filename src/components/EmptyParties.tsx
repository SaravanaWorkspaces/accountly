"use client";

import { useNewParty } from "./NewPartyProvider";

export function EmptyParties() {
  const openNewParty = useNewParty();

  return (
    <div className="rounded-[20px] border border-dashed border-line-dash bg-surface px-6 py-11 text-center">
      <p className="mb-2 font-serif text-2xl text-ink">Nobody here yet</p>
      <p className="mb-5 text-[15px] text-muted">
        Add the people and shops you deal with, then log what you received or paid.
      </p>
      <button
        type="button"
        onClick={openNewParty}
        className="min-h-11 rounded-full bg-ink px-5 py-3 text-sm font-semibold text-canvas transition-colors hover:bg-accent"
      >
        Add your first party
      </button>
    </div>
  );
}
