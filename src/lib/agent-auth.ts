import "server-only";
import { timingSafeEqual } from "crypto";

/**
 * Auth for the agent-facing JSON API (`/api/agent/*`). Deliberately
 * separate from the human /admin session cookie: this is a bearer token
 * meant to be held by an AI agent or script, not a browser session.
 */
export function isAgentRequestAuthorized(request: Request): boolean {
  const configured = process.env.ADMIN_API_KEY;
  if (!configured) return false;

  const header = request.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return false;

  const provided = match[1];
  const a = Buffer.from(provided);
  const b = Buffer.from(configured);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function unauthorizedResponse() {
  return Response.json(
    {
      error: {
        code: "UNAUTHORIZED",
        message:
          "Missing or invalid bearer token. Send 'Authorization: Bearer <ADMIN_API_KEY>'.",
      },
    },
    { status: 401 }
  );
}
