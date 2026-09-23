import "server-only";

import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import { del, get, put } from "@vercel/blob";

import { UPLOAD_DIR } from "./paths";
import { TOO_LARGE_MESSAGE, WRONG_KIND_MESSAGE, isOversize } from "./upload-limits";

export { UPLOAD_DIR } from "./paths";
export { MAX_FILE_BYTES, MAX_FILES_PER_ENTRY } from "./upload-limits";

/**
 * Receipts live in one of two places. With `BLOB_READ_WRITE_TOKEN` set they go
 * to Vercel Blob, which is what a deployment needs: serverless filesystems are
 * ephemeral, so anything written to `data/uploads` there is gone by the next
 * request. Without the token they stay on local disk, so `npm run dev` and the
 * test suites need no cloud account.
 *
 * Which store holds a file is recorded in the key itself rather than in a new
 * column, so rows written before this existed still resolve to disk.
 */
const BLOB_PREFIX = "blob:";

/** Folder inside the store, so the bucket is not a flat pile of UUIDs. */
const BLOB_FOLDER = "accountly/receipts";

export function blobEnabled(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

/**
 * Handed to the SDK explicitly. Left to its own lookup it first probes Vercel's
 * OIDC endpoint over the network on every call before falling back to this
 * variable — a round-trip this app never needs, since the token is the only
 * credential it authenticates with.
 */
function blobToken(): string {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) throw new Error("BLOB_READ_WRITE_TOKEN is not set");
  return token;
}

function blobPathname(storageKey: string): string | null {
  return storageKey.startsWith(BLOB_PREFIX)
    ? storageKey.slice(BLOB_PREFIX.length)
    : null;
}

const ALLOWED_MIME = new Map<string, string>([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"],
  ["image/heic", ".heic"],
  ["image/heif", ".heif"],
  ["image/gif", ".gif"],
  ["application/pdf", ".pdf"],
]);

export class UploadError extends Error {}

export function isAllowedMime(mime: string): boolean {
  return ALLOWED_MIME.has(mime.toLowerCase());
}

export function isImage(mime: string): boolean {
  return mime.toLowerCase().startsWith("image/");
}

/**
 * Strip directory separators and control characters from a user-supplied
 * filename. The result is only ever used as a display label and as the
 * `filename` in a Content-Disposition header — never as a path.
 */
export function safeDisplayName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "file";
  const cleaned = base.replace(/[\u0000-\u001f\u007f]/g, "").trim();
  return (cleaned || "file").slice(0, 120);
}

export type StoredFile = {
  storageKey: string;
  size: number;
  mime: string;
  name: string;
};

/**
 * Write an upload to the configured store under a generated key. The caller's
 * filename is never trusted as a path — it is kept only as a display label.
 */
export async function storeUpload(file: File): Promise<StoredFile> {
  const mime = file.type.toLowerCase();
  if (!isAllowedMime(mime)) {
    throw new UploadError(WRONG_KIND_MESSAGE);
  }
  // The declared size is checked before the bytes are pulled into memory, and
  // the real length again afterwards, because the declared one is a claim.
  if (isOversize(file.size)) {
    throw new UploadError(TOO_LARGE_MESSAGE);
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  if (isOversize(bytes.byteLength)) {
    throw new UploadError(TOO_LARGE_MESSAGE);
  }
  if (!hasExpectedMagic(bytes, mime)) {
    throw new UploadError("That file does not look like an image or a PDF.");
  }

  const name = safeDisplayName(file.name);
  const filename = `${randomUUID()}${ALLOWED_MIME.get(mime)}`;

  if (blobEnabled()) {
    // `private`, not `public`: a public blob URL would hand out bills and
    // invoices to anyone who ever saw the link, outliving the passcode. These
    // are read back through /api/files/[id], which sits behind the auth gate.
    const stored = await put(`${BLOB_FOLDER}/${filename}`, bytes, {
      access: "private",
      contentType: mime,
      addRandomSuffix: false,
      token: blobToken(),
    });

    return {
      storageKey: `${BLOB_PREFIX}${stored.pathname}`,
      size: bytes.byteLength,
      mime,
      name,
    };
  }

  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  await fs.writeFile(path.join(UPLOAD_DIR, filename), bytes, { mode: 0o600 });

  return { storageKey: filename, size: bytes.byteLength, mime, name };
}

export async function readStoredFile(storageKey: string): Promise<Buffer> {
  const pathname = blobPathname(storageKey);
  if (pathname !== null) {
    const found = await get(pathname, { access: "private", token: blobToken() });
    if (!found || found.statusCode !== 200) {
      throw new Error("Blob not found");
    }
    // Buffered rather than streamed: nothing here is bigger than the 2 MB cap,
    // and the route still answers with the length and ETag held in the row.
    return Buffer.from(await new Response(found.stream).arrayBuffer());
  }

  // Defence in depth: the key comes from our own database, but resolve it and
  // confirm it still lands inside the uploads directory before reading.
  const resolved = path.resolve(UPLOAD_DIR, storageKey);
  if (path.dirname(resolved) !== UPLOAD_DIR) {
    throw new Error("Refusing to read outside the uploads directory");
  }
  return fs.readFile(resolved);
}

export async function deleteStoredFile(storageKey: string): Promise<void> {
  const pathname = blobPathname(storageKey);
  if (pathname !== null) {
    // A blob that is already gone is the state we wanted; deleting a party
    // should not fail on it.
    await del(pathname, { token: blobToken() }).catch(() => {});
    return;
  }

  const resolved = path.resolve(UPLOAD_DIR, storageKey);
  if (path.dirname(resolved) !== UPLOAD_DIR) return;
  await fs.rm(resolved, { force: true });
}

export function etagFor(storageKey: string, size: number): string {
  return `"${createHash("sha1").update(`${storageKey}:${size}`).digest("hex")}"`;
}

/** Cheap sniff so a renamed executable cannot masquerade as a JPEG. */
function hasExpectedMagic(bytes: Buffer, mime: string): boolean {
  const startsWith = (...sig: number[]) =>
    sig.every((byte, i) => bytes[i] === byte);

  switch (mime) {
    case "image/jpeg":
      return startsWith(0xff, 0xd8, 0xff);
    case "image/png":
      return startsWith(0x89, 0x50, 0x4e, 0x47);
    case "image/gif":
      return bytes.subarray(0, 3).toString("ascii") === "GIF";
    case "image/webp":
      return (
        bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
        bytes.subarray(8, 12).toString("ascii") === "WEBP"
      );
    case "image/heic":
    case "image/heif":
      return bytes.subarray(4, 8).toString("ascii") === "ftyp";
    case "application/pdf":
      return bytes.subarray(0, 5).toString("ascii") === "%PDF-";
    default:
      return false;
  }
}
