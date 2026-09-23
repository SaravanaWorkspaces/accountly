/** Fills an empty database with the sample ledger from the design. */
import "dotenv/config";

import { randomUUID } from "node:crypto";

import { db, pool } from "./index";
import { parties, transactions } from "./schema";
import { toIsoDate } from "../lib/dates";

function daysAgo(n: number): string {
  const date = new Date();
  date.setDate(date.getDate() - n);
  return toIsoDate(date);
}

async function main() {
  const existing = await db.select({ id: parties.id }).from(parties);
  if (existing.length > 0) {
    console.log(`Skipping seed: ${existing.length} parties already present.`);
    await pool.end();
    process.exit(0);
  }

  const ids = {
    ramesh: randomUUID(),
    sunrise: randomUUID(),
    anita: randomUUID(),
    kumar: randomUUID(),
  };

  const now = Date.now();

  await db.insert(parties)
    .values([
      { id: ids.ramesh, name: "Ramesh Traders", type: "Customer", phone: "98450 11234", email: "", opening: 0, createdAt: now },
      { id: ids.sunrise, name: "Sunrise Stationery", type: "Merchant", phone: "90080 44120", email: "orders@sunrise.in", opening: 0, createdAt: now + 1 },
      { id: ids.anita, name: "Anita Sharma", type: "Customer", phone: "", email: "anita@example.com", opening: 250000, createdAt: now + 2 },
      { id: ids.kumar, name: "Kumar Transport", type: "Merchant", phone: "99001 27788", email: "", opening: 0, createdAt: now + 3 },
    ]);

  await db.insert(transactions)
    .values([
      { id: randomUUID(), partyId: ids.ramesh, type: "in", amount: 1200000, date: daysAgo(1), note: "UPI against bill 118", createdAt: now },
      { id: randomUUID(), partyId: ids.ramesh, type: "advin", amount: 500000, date: daysAgo(6), note: "Advance for next order", createdAt: now + 1 },
      { id: randomUUID(), partyId: ids.ramesh, type: "out", amount: 150000, date: daysAgo(9), note: "Damage adjustment", createdAt: now + 2 },
      { id: randomUUID(), partyId: ids.sunrise, type: "out", amount: 840000, date: daysAgo(2), note: "Cash, bill 4471", createdAt: now + 3 },
      { id: randomUUID(), partyId: ids.sunrise, type: "advout", amount: 200000, date: daysAgo(11), note: "Advance booking", createdAt: now + 4 },
      { id: randomUUID(), partyId: ids.anita, type: "in", amount: 320000, date: daysAgo(4), note: "Cheque cleared", createdAt: now + 5 },
      { id: randomUUID(), partyId: ids.kumar, type: "out", amount: 600000, date: daysAgo(3), note: "Freight — Hubli trip", createdAt: now + 6 },
    ]);

  console.log("Seeded 4 parties and 7 entries.");

  await pool.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
