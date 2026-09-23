/**
 * Upload limits, kept out of `storage.ts` so the entry sheet can import them
 * without pulling in that module's `server-only` guard. The sheet checks them
 * for immediate feedback; `storeUpload` checks them again because the client
 * is not a boundary.
 */

/** 2 MB — a phone photo usually clears it, and it keeps one entry's worth of
 *  receipts inside the request body limits a Server Action has to live with. */
export const MAX_FILE_BYTES = 2 * 1024 * 1024;
export const MAX_FILE_LABEL = "2 MB";
export const MAX_FILES_PER_ENTRY = 6;

export const TOO_LARGE_MESSAGE = `Each file must be under ${MAX_FILE_LABEL}.`;
export const TOO_MANY_MESSAGE = `Attach at most ${MAX_FILES_PER_ENTRY} files to one entry.`;
export const WRONG_KIND_MESSAGE = "Only images and PDFs can be attached.";

export function isOversize(size: number): boolean {
  return size <= 0 || size > MAX_FILE_BYTES;
}
