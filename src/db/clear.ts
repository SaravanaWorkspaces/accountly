/**
 * Empties the ledger: `npm run db:clear`.
 *
 * Deletes rows rather than unlinking the database file. Removing the file out
 * from under a running dev server leaves that process holding a handle to the
 * deleted inode — it keeps serving and writing stale data that never reaches
 * disk. Clearing in place means a running server sees the empty ledger on its
 * very next query.
 */
import "dotenv/config";

import fs from "node:fs";

import { db } from "./index";
import { attachments, parties, transactions } from "./schema";
import { DB_PATH, UPLOAD_DIR } from "../lib/paths";

const before = db.select({ id: parties.id }).from(parties).all().length;

// Order matters only for clarity; the foreign keys cascade anyway.
db.transaction((tx) => {
  tx.delete(attachments).run();
  tx.delete(transactions).run();
  tx.delete(parties).run();
});

// Reclaim the pages the deleted rows were using.
db.$client.exec("VACUUM");

let removedFiles = 0;
if (fs.existsSync(UPLOAD_DIR)) {
  for (const name of fs.readdirSync(UPLOAD_DIR)) {
    fs.rmSync(`${UPLOAD_DIR}/${name}`, { force: true });
    removedFiles += 1;
  }
}

console.log(
  `Cleared ${before} ${before === 1 ? "party" : "parties"} and ${removedFiles} ` +
    `attachment file${removedFiles === 1 ? "" : "s"} from ${DB_PATH}`,
);
