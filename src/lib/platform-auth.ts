import "server-only";
import { timingSafeEqual } from "crypto";

/**
 * Auth for /api/platform/* — the one set of endpoints that operate above
 * any single store (today: creating a new store). Gated by a single
 * platform-wide secret, distinct from any store's own agent API key.
 */
export function isPlatformRequestAuthorized(request: Request): boolean {
  const configured = process.env.PLATFORM_API_KEY;
  if (!configured) return false;

  const header = request.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return false;

  const provided = match[1];
  const a = Buffer.from(provided);
  const b = Buffer.from(configured);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function platformUnauthorizedResponse() {
  return Response.json(
    {
      error: {
        code: "UNAUTHORIZED",
        message:
          "Missing or invalid bearer token. Send 'Authorization: Bearer <PLATFORM_API_KEY>'.",
      },
    },
    { status: 401 }
  );
}
