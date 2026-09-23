/**
 * Empties the ledger: `npm run db:clear`.
 *
 * Deletes rows rather than dropping tables, so a running dev server sees the
 * empty ledger on its very next query without needing a migration first.
 * Receipts already in Vercel Blob are left alone; only rows and the local
 * upload directory are cleared.
 */
import "dotenv/config";

import fs from "node:fs";

import { db, closeDb, connectionString } from "./index";
import { attachments, parties, transactions } from "./schema";
import { UPLOAD_DIR } from "../lib/paths";

async function main() {
  const before = (await db.select({ id: parties.id }).from(parties)).length;

  // Order matters only for clarity; the foreign keys cascade anyway.
  await db.transaction(async (tx) => {
    await tx.delete(attachments);
    await tx.delete(transactions);
    await tx.delete(parties);
  });

  let removedFiles = 0;
  if (fs.existsSync(UPLOAD_DIR)) {
    for (const name of fs.readdirSync(UPLOAD_DIR)) {
      fs.rmSync(`${UPLOAD_DIR}/${name}`, { force: true });
      removedFiles += 1;
    }
  }

  const shown = connectionString().replace(/\/\/([^:]+):[^@]+@/, "//$1:***@");
  console.log(
    `Cleared ${before} ${before === 1 ? "party" : "parties"} and ${removedFiles} ` +
      `attachment file${removedFiles === 1 ? "" : "s"} from ${shown}`,
  );

  await closeDb();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
