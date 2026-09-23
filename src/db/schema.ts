import { bigint, index, integer, pgTable, text } from "drizzle-orm/pg-core";

/**
 * Money and timestamps are `bigint`, not `integer`. SQLite's INTEGER was 64-bit,
 * Postgres's is 32-bit and tops out at 2,147,483,647 — which `createdAt` blows
 * straight past, since epoch milliseconds are already past 1.7e12. `mode:
 * "number"` keeps them arriving as JS numbers rather than strings, which is
 * exact up to 2^53: about 90 thousand crore rupees in paise.
 */
const money = (name: string) => bigint(name, { mode: "number" });
const epochMs = (name: string) => bigint(name, { mode: "number" });

/** A person or shop you deal with. */
export const parties = pgTable(
  "parties",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    type: text("type", { enum: ["Customer", "Merchant"] })
      .notNull()
      .default("Customer"),
    phone: text("phone").notNull().default(""),
    email: text("email").notNull().default(""),
    /** Opening balance in minor units. Positive = they owe you. */
    opening: money("opening").notNull().default(0),
    createdAt: epochMs("created_at").notNull(),
  },
  (t) => [index("parties_name_idx").on(t.name)],
);

/**
 * A ledger entry. `in`/`advin` move the balance up (they owe you more),
 * `out`/`advout` move it down. `amount` is always positive minor units.
 */
export const transactions = pgTable(
  "transactions",
  {
    id: text("id").primaryKey(),
    partyId: text("party_id")
      .notNull()
      .references(() => parties.id, { onDelete: "cascade" }),
    type: text("type", { enum: ["in", "out", "advin", "advout"] }).notNull(),
    amount: money("amount").notNull(),
    /** ISO calendar date, YYYY-MM-DD. Kept as text so every date calculation
     *  stays in `src/lib/dates.ts` and none of it depends on a server zone. */
    date: text("date").notNull(),
    note: text("note").notNull().default(""),
    createdAt: epochMs("created_at").notNull(),
  },
  (t) => [
    index("transactions_party_idx").on(t.partyId),
    index("transactions_party_date_idx").on(t.partyId, t.date),
  ],
);

/** A receipt or bill photo/PDF attached to an entry. */
export const attachments = pgTable(
  "attachments",
  {
    id: text("id").primaryKey(),
    transactionId: text("transaction_id")
      .notNull()
      .references(() => transactions.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    mime: text("mime").notNull(),
    /** Bytes. Capped well under 2 GB by MAX_FILE_BYTES, so 32 bits is plenty. */
    size: integer("size").notNull(),
    /** `blob:`-prefixed for Vercel Blob, otherwise a filename in UPLOAD_DIR. */
    storageKey: text("storage_key").notNull(),
    createdAt: epochMs("created_at").notNull(),
  },
  (t) => [index("attachments_transaction_idx").on(t.transactionId)],
);

export type PartyRow = typeof parties.$inferSelect;
export type TransactionRow = typeof transactions.$inferSelect;
export type AttachmentRow = typeof attachments.$inferSelect;
