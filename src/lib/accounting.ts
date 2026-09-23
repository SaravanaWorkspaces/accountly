import { isInflow, type PartyType, type TxnType } from "./types";

export type LedgerSide = "debit" | "credit";

/**
 * Which side of *your* books an entry falls on.
 *
 * Read from where you stand, not from the party's ledger, so the two kinds of
 * party mirror each other:
 *
 * - A **customer** paying you credits your account with them; money you hand
 *   back to a customer debits it.
 * - A **merchant** is the reverse: what you take from them is a debit, what you
 *   pay them is a credit.
 */
export function ledgerSide(party: PartyType, txn: TxnType): LedgerSide {
  return sideFor(party, isInflow(txn));
}

/**
 * The opening balance is a balance, not a movement of cash, so the cash rule
 * above does not apply to it. It follows the ordinary convention instead:
 * money owed to you is an asset and sits on the debit side, money you owe is a
 * liability and sits on the credit side — the same either way round, whether
 * the party is a customer or a merchant.
 */
export function openingSide(opening: number): LedgerSide {
  return opening > 0 ? "debit" : "credit";
}

function sideFor(party: PartyType, inflow: boolean): LedgerSide {
  const credit = party === "Customer" ? inflow : !inflow;
  return credit ? "credit" : "debit";
}
