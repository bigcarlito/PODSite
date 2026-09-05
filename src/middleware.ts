import { NextRequest, NextResponse } from "next/server";

const STORE_HINT_COOKIE = "store_hint";

/**
 * Resolves which store a request is for and forwards it downstream as a
 * header, without touching the database here (middleware runs on the Edge
 * runtime). `getCurrentStore()` (src/lib/store-context.ts) does the actual
 * lookup. Resolution order there: subdomain/custom domain (production) →
 * `?store=` query param, remembered in a cookie so it survives a
 * server-side redirect that drops the query string (e.g. checkout →
 * confirmation) when testing locally without real subdomains → the
 * DEV_STORE_SLUG env fallback.
 */
export function middleware(request: NextRequest) {
  const queryStore = request.nextUrl.searchParams.get("store");
  const host = request.headers.get("host") ?? "";
  const hostname = host.split(":")[0];
  const cookieHint = request.cookies.get(STORE_HINT_COOKIE)?.value ?? "";

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-store-hint", queryStore || hostname);
  requestHeaders.set("x-store-hint-cookie", cookieHint);

  const response = NextResponse.next({ request: { headers: requestHeaders } });

  if (queryStore && queryStore !== cookieHint) {
    response.cookies.set(STORE_HINT_COOKIE, queryStore, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24,
    });
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
