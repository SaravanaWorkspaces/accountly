"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { attachments, parties, transactions } from "@/db/schema";
import {
  SESSION_COOKIE,
  authEnabled,
  isAuthenticated,
  issueSession,
  passcodeMatches,
  sessionCookieOptions,
} from "./auth";
import { isIsoDate, toIsoDate } from "./dates";
import { parseAmount } from "./money";
import {
  MAX_FILES_PER_ENTRY,
  UploadError,
  deleteStoredFile,
  storeUpload,
} from "./storage";
import { getPartyStakes } from "./queries";
import { idleState, type ActionState } from "./action-state";
import { PARTY_TYPES, TXN_TYPES } from "./types";

const partySchema = z.object({
  name: z.string().trim().min(1, "A name is needed to save this party.").max(120),
  type: z.enum(["Customer", "Merchant"]),
  phone: z.string().trim().max(40),
  email: z.string().trim().max(160),
  opening: z.string().max(24),
});

const txnSchema = z.object({
  partyId: z.string().min(1),
  type: z.enum(["in", "out", "advin", "advout"]),
  amount: z.string().max(24),
  date: z.string().max(10),
  note: z.string().trim().max(280),
});

const deletePartySchema = z.object({
  partyId: z.string().min(1),
  confirm: z.string().max(160),
});

async function guard() {
  if (!(await isAuthenticated())) redirect("/login");
}

export async function createParty(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await guard();

  const parsed = partySchema.safeParse({
    name: formData.get("name") ?? "",
    type: pick(formData.get("type"), PARTY_TYPES, "Customer"),
    phone: formData.get("phone") ?? "",
    email: formData.get("email") ?? "",
    opening: formData.get("opening") ?? "",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "That party could not be saved." };
  }

  const id = randomUUID();
  db.insert(parties)
    .values({
      id,
      name: parsed.data.name,
      type: parsed.data.type,
      phone: parsed.data.phone,
      email: parsed.data.email,
      // Positive if they owe you, negative if you owe them.
      opening: parseAmount(parsed.data.opening, { allowNegative: true }) ?? 0,
      createdAt: Date.now(),
    })
    .run();

  revalidatePath("/");
  redirect(`/p/${id}`);
}

export async function createTransaction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await guard();

  const parsed = txnSchema.safeParse({
    partyId: formData.get("partyId") ?? "",
    type: pick(
      formData.get("type"),
      TXN_TYPES.map((t) => t.id),
      "in",
    ),
    amount: formData.get("amount") ?? "",
    date: formData.get("date") ?? "",
    note: formData.get("note") ?? "",
  });

  if (!parsed.success) return { error: "That entry could not be saved." };

  const amount = parseAmount(parsed.data.amount);
  if (amount === null || amount <= 0) {
    return { error: "Enter an amount above zero." };
  }

  const party = db
    .select({ id: parties.id })
    .from(parties)
    .where(eq(parties.id, parsed.data.partyId))
    .get();
  if (!party) return { error: "That party no longer exists." };

  const files = formData
    .getAll("files")
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);
  if (files.length > MAX_FILES_PER_ENTRY) {
    return { error: `Attach at most ${MAX_FILES_PER_ENTRY} files to one entry.` };
  }

  let stored;
  try {
    stored = await Promise.all(files.map(storeUpload));
  } catch (error) {
    if (error instanceof UploadError) return { error: error.message };
    throw error;
  }

  const txnId = randomUUID();
  const now = Date.now();

  // One transaction so an entry and its receipts are never half-written.
  db.transaction((tx) => {
    tx.insert(transactions)
      .values({
        id: txnId,
        partyId: parsed.data.partyId,
        type: parsed.data.type,
        amount,
        date: isIsoDate(parsed.data.date) ? parsed.data.date : toIsoDate(new Date()),
        note: parsed.data.note,
        createdAt: now,
      })
      .run();

    for (const [index, file] of stored.entries()) {
      tx.insert(attachments)
        .values({
          id: randomUUID(),
          transactionId: txnId,
          name: file.name,
          mime: file.mime,
          size: file.size,
          storageKey: file.storageKey,
          createdAt: now + index,
        })
        .run();
    }
  });

  revalidatePath("/");
  revalidatePath(`/p/${parsed.data.partyId}`);
  return { error: null, savedAt: Date.now() };
}

/**
 * Removes a party, its entries and its receipts. `on delete cascade` clears the
 * rows; the files come off disk afterwards.
 *
 * A party holding entries or an unsettled balance also has to have its name
 * typed back. That is checked here and not only in the sheet: a Server Action
 * answers a direct POST just as readily as it answers our own UI.
 */
export async function deleteParty(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await guard();

  const parsed = deletePartySchema.safeParse({
    partyId: formData.get("partyId") ?? "",
    confirm: formData.get("confirm") ?? "",
  });
  if (!parsed.success) return { error: "That party could not be deleted." };

  const partyId = parsed.data.partyId;
  const stakes = await getPartyStakes(partyId);
  if (!stakes) return { error: "That party no longer exists." };

  // Entries or an unsettled balance both mean real money is being written off,
  // and either one is enough to ask for the name back.
  const atStake = stakes.entryCount > 0 || stakes.balance !== 0;
  if (atStake && !namesMatch(parsed.data.confirm, stakes.name)) {
    return { error: "Type the party's name exactly as it is written to confirm." };
  }

  // Read the storage keys while the rows are still there to read them from.
  const keys = db
    .select({ storageKey: attachments.storageKey })
    .from(attachments)
    .innerJoin(transactions, eq(attachments.transactionId, transactions.id))
    .where(eq(transactions.partyId, partyId))
    .all();

  db.delete(parties).where(eq(parties.id, partyId)).run();

  // Files after the commit, never before: a stray file on disk costs some
  // bytes, whereas a row pointing at a file that is already gone is a broken
  // receipt the ledger can no longer explain.
  await Promise.all(keys.map((file) => deleteStoredFile(file.storageKey)));

  revalidatePath("/");
  revalidatePath(`/p/${partyId}`);
  redirect("/");
}

export async function signIn(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!authEnabled()) redirect("/");

  const passcode = String(formData.get("passcode") ?? "");
  if (!passcode || !passcodeMatches(passcode)) {
    // Blunt the brute-force rate a little without holding a request forever.
    await new Promise((resolve) => setTimeout(resolve, 400));
    return { error: "That passcode does not match." };
  }

  (await cookies()).set(SESSION_COOKIE, await issueSession(), sessionCookieOptions());

  const next = String(formData.get("next") ?? "/");
  // Only ever bounce back to our own paths.
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/");
}

export async function signOut(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}

/** Confirmation is about intent, not typing precision: fold case and spacing. */
function namesMatch(typed: string, name: string): boolean {
  const normalise = (value: string) => value.trim().replace(/\s+/g, " ").toLowerCase();
  return normalise(typed) === normalise(name);
}

function pick<T extends string>(
  value: FormDataEntryValue | null,
  allowed: readonly T[],
  fallback: T,
): T {
  const asString = String(value ?? "");
  return (allowed as readonly string[]).includes(asString) ? (asString as T) : fallback;
}
