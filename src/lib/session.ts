import { SignJWT, jwtVerify } from "jose";

/**
 * Edge-safe half of the auth layer: signing and verifying the session cookie.
 * Kept free of Node built-ins so middleware can import it.
 */

export const SESSION_COOKIE = "accountly_session";
const SESSION_DAYS = 30;

/**
 * Accountly is a single-owner ledger, so the gate is deliberately one shared
 * passcode rather than a user table. Leave `APP_PASSCODE` unset and the app
 * runs open — fine on localhost, never on a public host.
 */
export function authEnabled(): boolean {
  return Boolean(process.env.APP_PASSCODE);
}

function secretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "AUTH_SECRET must be set to at least 32 characters when APP_PASSCODE is in use.",
    );
  }
  return new TextEncoder().encode(secret);
}

export async function issueSession(): Promise<string> {
  return new SignJWT({ sub: "owner" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secretKey());
}

export async function verifySession(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  try {
    await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    return true;
  } catch {
    return false;
  }
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  };
}
