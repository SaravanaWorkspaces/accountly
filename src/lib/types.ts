export type PartyType = "Customer" | "Merchant";
export type TxnType = "in" | "out" | "advin" | "advout";

export const PARTY_TYPES: readonly PartyType[] = ["Customer", "Merchant"];

/**
 * The four ledger entry kinds. `dir` is the sign the entry applies to a
 * party's balance: +1 means the party owes you more.
 */
export const TXN_TYPES: readonly {
  id: TxnType;
  label: string;
  dir: 1 | -1;
}[] = [
  { id: "in", label: "Received", dir: 1 },
  { id: "out", label: "Paid", dir: -1 },
  { id: "advin", label: "Advance received", dir: 1 },
  { id: "advout", label: "Advance paid", dir: -1 },
];

export function txnMeta(type: TxnType) {
  return TXN_TYPES.find((t) => t.id === type) ?? TXN_TYPES[0];
}

export function isInflow(type: TxnType) {
  return txnMeta(type).dir > 0;
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
