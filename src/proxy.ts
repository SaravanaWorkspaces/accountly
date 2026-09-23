import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE, verifySession } from "@/lib/session";

/**
 * The gate lives in the proxy so every route — pages, server actions and the
 * attachment endpoint — is covered by one check instead of a per-file guard.
 */
export default async function proxy(request: NextRequest) {
  if (!process.env.APP_PASSCODE) return NextResponse.next();

  const { pathname, search } = request.nextUrl;
  const onLogin = pathname === "/login";
  const signedIn = await verifySession(request.cookies.get(SESSION_COOKIE)?.value);

  if (signedIn && onLogin) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  if (signedIn || onLogin) {
    return NextResponse.next();
  }

  const login = new URL("/login", request.url);
  // Preserve wherever they were headed, including a search on the list page.
  if (pathname !== "/" || search) login.searchParams.set("next", pathname + search);
  return NextResponse.redirect(login);
}

export const config = {
  // Everything except Next's own assets and the favicon.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|manifest.webmanifest).*)"],
};
