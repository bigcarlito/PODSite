import { withAgentAuth } from "@/lib/store/api-helpers";
import { quickPublishDesign } from "@/lib/design/designs";
import { originFromHeaders } from "@/lib/origin";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * The agent-facing equivalent of the /admin/designs review queue's
 * one-click "make product" button — publishes using the design's own
 * targetProductType and that product type's MockupScene defaults (every
 * color it has, its defaultPriceCents). For per-call control over price,
 * sizes, or provider, use POST /api/agent/designs/:id/publish directly.
 */
export const POST = withAgentAuth(async (request, store, ctx: Ctx) => {
  const { id } = await ctx.params;
  const origin = originFromHeaders(request.headers);
  const result = await quickPublishDesign(store, id, "agent", origin);
  return Response.json(result);
});
