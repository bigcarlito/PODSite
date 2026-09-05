import "server-only";
import { ZodError } from "zod";
import { isAgentRequestAuthorized, unauthorizedResponse } from "@/lib/agent-auth";
import { StoreError } from "./errors";

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
 * Wrap an /api/agent/* route handler: checks the bearer token, then
 * catches any thrown StoreError/ZodError into a structured JSON error
 * response so an agent never has to parse an HTML 500 page.
 */
export function withAgentAuth<Args extends unknown[]>(
  handler: (request: Request, ...args: Args) => Promise<Response>
) {
  return async (request: Request, ...args: Args): Promise<Response> => {
    if (!isAgentRequestAuthorized(request)) {
      return unauthorizedResponse();
    }
    try {
      return await handler(request, ...args);
    } catch (error) {
      return errorResponse(error);
    }
  };
}
