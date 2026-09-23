/** Client-safe MIME helpers (the server-only counterparts live in storage.ts). */

export function isImage(mime: string): boolean {
  return mime.toLowerCase().startsWith("image/");
}

/** Short badge shown on a thumbnail when there is no image to preview. */
export function fileBadge(mime: string): string {
  return isImage(mime) ? "" : "PDF";
}

/** Truncate a filename for a chip, keeping it recognisable. */
export function shortFileName(name: string, max = 18): string {
  return name.length > max ? `${name.slice(0, max - 2)}…` : name;
}
