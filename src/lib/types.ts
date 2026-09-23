export type PartyType = "Customer" | "Merchant";
export type TxnType = "in" | "out" | "advin" | "advout";

export const PARTY_TYPES: readonly PartyType[] = ["Customer", "Merchant"];

/**
 * The four ledger entry kinds.
 *
 * `flow` is which way the cash moved — it drives the colours and which side of
 * the bubble stream an entry sits on.
 *
 * `dir` is the sign the entry applies to the party's balance, where +1 means
 * the party owes you more. The two are **opposites**, and deliberately so:
 * money coming in from a customer settles part of what they owe, so it lowers
 * the balance. Keeping them as separate fields is what stops "cash in" and
 * "balance up" being confused for each other.
 */
export const TXN_TYPES: readonly {
  id: TxnType;
  label: string;
  flow: "in" | "out";
  dir: 1 | -1;
}[] = [
  { id: "in", label: "Received", flow: "in", dir: -1 },
  { id: "out", label: "Paid", flow: "out", dir: 1 },
  { id: "advin", label: "Advance received", flow: "in", dir: -1 },
  { id: "advout", label: "Advance paid", flow: "out", dir: 1 },
];

export function txnMeta(type: TxnType) {
  return TXN_TYPES.find((t) => t.id === type) ?? TXN_TYPES[0];
}

/** Did the cash come in? Not the same question as "did the balance go up". */
export function isInflow(type: TxnType) {
  return txnMeta(type).flow === "in";
}

export type Attachment = {
  id: string;
  name: string;
  mime: string;
  size: number;
};

export type Transaction = {
  id: string;
  partyId: string;
  type: TxnType;
  /** Minor units, always positive. */
  amount: number;
  /** YYYY-MM-DD */
  date: string;
  note: string;
  attachments: Attachment[];
};

export type Party = {
  id: string;
  name: string;
  type: PartyType;
  phone: string;
  email: string;
  /** Minor units; positive means they owe you. */
  opening: number;
};

export type PartySummary = Party & {
  /** Minor units; positive means they owe you. */
  balance: number;
  /** YYYY-MM-DD of the most recent entry, or null. */
  lastDate: string | null;
  entryCount: number;
};
