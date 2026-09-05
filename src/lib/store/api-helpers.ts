import "server-only";
import { ZodError } from "zod";
import { isAgentRequestAuthorized, unauthorizedResponse } from "@/lib/agent-auth";
import {
  isPlatformRequestAuthorized,
  platformUnauthorizedResponse,
} from "@/lib/platform-auth";
import { getCurrentStore } from "@/lib/store-context";
import { StoreError } from "./errors";
import type { Store } from "@prisma/client";

export function errorResponse(error: unknown): Response {
  if (error instanceof StoreError) {
    return Response.json(
      { error: { code: error.code, message: error.message, field: error.field } },
      { status: error.status }
    );
  }
  if (error instanceof ZodError) {
    return Response.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Request body failed validation",
          issues: error.issues,
        },
      },
      { status: 400 }
    );
  }
  console.error(error);
  return Response.json(
    { error: { code: "INTERNAL_ERROR", message: "Unexpected server error" } },
    { status: 500 }
  );
}

/**
 * Wrap an /api/agent/* route handler: resolves which store the request is
 * for (by hostname/subdomain — see store-context.ts), checks the bearer
 * token against *that store's* agent API key, then passes the resolved
 * store to the handler so it can scope every query by store.id. Also
 * catches any thrown StoreError/ZodError into a structured JSON error
 * response so an agent never has to parse an HTML 500 page.
 */
export function withAgentAuth<Args extends unknown[]>(
  handler: (request: Request, store: Store, ...args: Args) => Promise<Response>
) {
  return async (request: Request, ...args: Args): Promise<Response> => {
    const store = await getCurrentStore();
    if (!store || !isAgentRequestAuthorized(request, store)) {
      return unauthorizedResponse();
    }
    try {
      return await handler(request, store, ...args);
    } catch (error) {
      return errorResponse(error);
    }
  };
}

/**
 * Wrap an /api/platform/* route handler: checks the platform-wide bearer
 * token (not tied to any single store), then catches thrown
 * StoreError/ZodError the same way withAgentAuth does.
 */
export function withPlatformAuth<Args extends unknown[]>(
  handler: (request: Request, ...args: Args) => Promise<Response>
) {
  return async (request: Request, ...args: Args): Promise<Response> => {
    if (!isPlatformRequestAuthorized(request)) {
      return platformUnauthorizedResponse();
    }
    try {
      return await handler(request, ...args);
    } catch (error) {
      return errorResponse(error);
    }
  };
}
