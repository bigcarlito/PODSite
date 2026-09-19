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
 * An optional `{"force": true}` body also publishes a "rejected" design
 * (upscales its existing QC-failed preview instead of refusing) — see
 * publishDesign's `force` handling in src/lib/design/designs.ts.
 */
export const POST = withAgentAuth(async (request, store, ctx: Ctx) => {
  const { id } = await ctx.params;
  const origin = originFromHeaders(request.headers);
  const body = await request.json().catch(() => ({}));
  const force = typeof body?.force === "boolean" ? body.force : false;
  const result = await quickPublishDesign(store, id, "agent", origin, force);
  return Response.json(result);
});
