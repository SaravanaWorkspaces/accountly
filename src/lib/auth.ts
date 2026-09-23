import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

import { SESSION_COOKIE, authEnabled, verifySession } from "./session";

export {
  SESSION_COOKIE,
  authEnabled,
  issueSession,
  sessionCookieOptions,
  verifySession,
} from "./session";

/** True when the current request may read and write the ledger. */
export async function isAuthenticated(): Promise<boolean> {
  if (!authEnabled()) return true;
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return verifySession(token);
}

/**
 * Constant-time passcode comparison. Both sides are hashed first so the
 * comparison length never leaks the real passcode's length.
 */
export function passcodeMatches(candidate: string): boolean {
  const expected = process.env.APP_PASSCODE;
  if (!expected) return false;

  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(candidate), digest(expected));
}
