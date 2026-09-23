import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/** A person or shop you deal with. */
export const parties = sqliteTable(
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
    opening: integer("opening").notNull().default(0),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [index("parties_name_idx").on(t.name)],
);

/**
 * A ledger entry. `in`/`advin` move the balance up (they owe you more),
 * `out`/`advout` move it down. `amount` is always positive minor units.
 */
export const transactions = sqliteTable(
  "transactions",
  {
    id: text("id").primaryKey(),
    partyId: text("party_id")
      .notNull()
      .references(() => parties.id, { onDelete: "cascade" }),
    type: text("type", { enum: ["in", "out", "advin", "advout"] }).notNull(),
    amount: integer("amount").notNull(),
    /** ISO calendar date, YYYY-MM-DD. */
    date: text("date").notNull(),
    note: text("note").notNull().default(""),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [
    index("transactions_party_idx").on(t.partyId),
    index("transactions_party_date_idx").on(t.partyId, t.date),
  ],
);

/** A receipt or bill photo/PDF attached to an entry. */
export const attachments = sqliteTable(
  "attachments",
  {
    id: text("id").primaryKey(),
    transactionId: text("transaction_id")
      .notNull()
      .references(() => transactions.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    mime: text("mime").notNull(),
    size: integer("size").notNull(),
    /** Filename on disk, relative to the uploads directory. */
    storageKey: text("storage_key").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [index("attachments_transaction_idx").on(t.transactionId)],
);

export type PartyRow = typeof parties.$inferSelect;
export type TransactionRow = typeof transactions.$inferSelect;
export type AttachmentRow = typeof attachments.$inferSelect;
