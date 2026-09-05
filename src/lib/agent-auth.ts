import "server-only";
import { verifyApiKey } from "@/lib/credentials";
import type { Store } from "@prisma/client";

/**
 * Auth for the agent-facing JSON API (`/api/agent/*`). Deliberately
 * separate from the human /admin session cookie: this is a bearer token
 * meant to be held by an AI agent or script, not a browser session.
 *
 * Store-scoped: the token is checked against the *resolved* store's own
 * agentApiKeyHash (see src/lib/store-context.ts), not a global secret — a
 * key for one store cannot authenticate requests against another.
 */
export function isAgentRequestAuthorized(request: Request, store: Store): boolean {
  const header = request.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return false;

  return verifyApiKey(match[1], store.agentApiKeyHash);
}

export function unauthorizedResponse() {
  return Response.json(
    {
      error: {
        code: "UNAUTHORIZED",
        message:
          "Missing or invalid bearer token, or no store resolved for this host. " +
          "Send 'Authorization: Bearer <store's agent API key>'.",
      },
    },
    { status: 401 }
  );
}
