"use client";

import { useState } from "react";

import { TxnSheet } from "./TxnSheet";
import type { TxnType } from "@/lib/types";

/** The Received / Paid pair on a party, plus the sheet they open. */
export function EntryActions({
  partyId,
  partyName,
  today,
}: {
  partyId: string;
  partyName: string;
  today: string;
}) {
  const [openType, setOpenType] = useState<TxnType | null>(null);

  return (
    <>
      <div className="mt-5 flex flex-wrap gap-2.5">
        <button
          type="button"
          onClick={() => setOpenType("in")}
          className="min-h-12 flex-[1_1_150px] rounded-[14px] border border-in-line bg-in-bg p-3.5 text-[15px] font-semibold text-in transition-colors hover:bg-in-hover"
        >
          ↓ Received
        </button>
        <button
          type="button"
          onClick={() => setOpenType("out")}
          className="min-h-12 flex-[1_1_150px] rounded-[14px] border border-out-line bg-out-bg p-3.5 text-[15px] font-semibold text-out transition-colors hover:bg-out-hover"
        >
          ↑ Paid
        </button>
      </div>

      <TxnSheet
        open={openType !== null}
        partyId={partyId}
        partyName={partyName}
        initialType={openType ?? "in"}
        today={today}
        onClose={() => setOpenType(null)}
      />
    </>
  );
}
