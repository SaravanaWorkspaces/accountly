import "server-only";

import { asc, eq, inArray, or, sql } from "drizzle-orm";

import { db } from "@/db";
import { attachments, parties, transactions } from "@/db/schema";
import type { Party, PartySummary, Transaction, TxnType } from "./types";
import { TXN_TYPES } from "./types";

/**
 * `SUM(dir * amount)` expressed in SQL so a party's balance is computed by the
 * database rather than by pulling every entry into the process.
 */
const signedAmount = sql<number>`sum(case ${sql.join(
  TXN_TYPES.map(
    (t) => sql`when ${transactions.type} = ${t.id} then ${transactions.amount} * ${t.dir}`,
  ),
  sql` `,
)} else 0 end)`;

export async function listParties(query = ""): Promise<PartySummary[]> {
  const term = query.trim();
  // Escape LIKE wildcards so a literal "%" in the box searches for "%".
  const pattern = `%${term.replace(/[\\%_]/g, "\\$&")}%`;

  const filter = term
    ? or(
        // SQLite's LIKE is case-insensitive for ASCII, which matches the
        // design's lowercase name search; phone stays a substring match.
        sql`${parties.name} like ${pattern} escape '\\'`,
        sql`${parties.phone} like ${pattern} escape '\\'`,
      )
    : undefined;

  const rows = await db
    .select({
      id: parties.id,
      name: parties.name,
      type: parties.type,
      phone: parties.phone,
      email: parties.email,
      opening: parties.opening,
      movement: signedAmount,
      lastDate: sql<string | null>`max(${transactions.date})`,
      entryCount: sql<number>`count(${transactions.id})`,
    })
    .from(parties)
    .leftJoin(transactions, eq(transactions.partyId, parties.id))
    .where(filter)
    .groupBy(parties.id)
    // Most recently active first, then alphabetical; parties with no entries
    // sort to the bottom rather than to the top.
    .orderBy(sql`max(${transactions.date}) desc nulls last`, asc(parties.name));

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    type: row.type,
    phone: row.phone,
    email: row.email,
    opening: row.opening,
    balance: row.opening + (row.movement ?? 0),
    lastDate: row.lastDate,
    entryCount: Number(row.entryCount ?? 0),
  }));
}

export async function getParty(id: string): Promise<Party | null> {
  const [row] = await db.select().from(parties).where(eq(parties.id, id)).limit(1);
  return row ?? null;
}

/**
 * What a party would take with it if it were deleted: its name, how many
 * entries it holds, and the balance those entries and the opening figure come
 * to. Read before a delete so the confirmation can name the stakes.
 */
export async function getPartyStakes(
  id: string,
): Promise<{ name: string; entryCount: number; balance: number } | null> {
  const party = await getParty(id);
  if (!party) return null;

  // An aggregate over no rows still returns a row: count 0, sum null.
  const [row] = await db
    .select({
      movement: signedAmount,
      entryCount: sql<number>`count(${transactions.id})`,
    })
    .from(transactions)
    .where(eq(transactions.partyId, id));

  return {
    name: party.name,
    entryCount: Number(row?.entryCount ?? 0),
    balance: party.opening + Number(row?.movement ?? 0),
  };
}

export async function getPartyLedger(
  id: string,
): Promise<{ party: Party; entries: Transaction[]; balance: number } | null> {
  const party = await getParty(id);
  if (!party) return null;

  // Oldest first: the statement and the bubble stream both read top-down as a
  // running history, and the newest-first views just reverse this.
  const txnRows = await db
    .select()
    .from(transactions)
    .where(eq(transactions.partyId, id))
    .orderBy(asc(transactions.date), asc(transactions.createdAt));

  const files = txnRows.length
    ? await db
        .select()
        .from(attachments)
        .where(
          inArray(
            attachments.transactionId,
            txnRows.map((t) => t.id),
          ),
        )
        .orderBy(asc(attachments.createdAt))
    : [];

  const byTxn = new Map<string, Transaction["attachments"]>();
  for (const file of files) {
    const list = byTxn.get(file.transactionId) ?? [];
    list.push({ id: file.id, name: file.name, mime: file.mime, size: file.size });
    byTxn.set(file.transactionId, list);
  }

  const entries: Transaction[] = txnRows.map((t) => ({
    id: t.id,
    partyId: t.partyId,
    type: t.type as TxnType,
    amount: t.amount,
    date: t.date,
    note: t.note,
    attachments: byTxn.get(t.id) ?? [],
  }));

  const balance = entries.reduce((total, entry) => {
    const dir = TXN_TYPES.find((t) => t.id === entry.type)?.dir ?? 1;
    return total + dir * entry.amount;
  }, party.opening);

  return { party, entries, balance };
}

export async function getAttachment(id: string) {
  const [row] = await db
    .select()
    .from(attachments)
    .where(eq(attachments.id, id))
    .limit(1);
  return row ?? null;
}
