import { NextResponse, type NextRequest } from "next/server";

import { isAuthenticated } from "@/lib/auth";
import { getAttachment } from "@/lib/queries";
import { etagFor, readStoredFile } from "@/lib/storage";

/**
 * Attachments are served from outside the public directory so the auth gate
 * applies to them too, and so uploads never end up in the build output.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isAuthenticated())) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const file = await getAttachment((await params).id);
  if (!file) return new NextResponse("Not found", { status: 404 });

  const etag = etagFor(file.storageKey, file.size);
  if (request.headers.get("if-none-match") === etag) {
    return new NextResponse(null, { status: 304, headers: { ETag: etag } });
  }

  let bytes: Buffer;
  try {
    bytes = await readStoredFile(file.storageKey);
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }

  const download = request.nextUrl.searchParams.get("download") === "1";

  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": file.mime,
      "Content-Length": String(bytes.byteLength),
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(file.name)}`,
      // Stored bytes never change under a given id, so this can be immutable.
      "Cache-Control": "private, max-age=31536000, immutable",
      // No `sandbox` here: it would disable Chrome's built-in PDF viewer,
      // and these bytes are only ever images or PDFs the owner uploaded.
      "Content-Security-Policy": "default-src 'none'; frame-ancestors 'self'",
      "X-Content-Type-Options": "nosniff",
      ETag: etag,
    },
  });
}
