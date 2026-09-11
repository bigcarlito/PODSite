import { withAgentAuth } from "@/lib/store/api-helpers";
import { designRegenerateSchema } from "@/lib/store/schemas";
import { regenerateDesign } from "@/lib/design/designs";
import { originFromHeaders } from "@/lib/origin";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export const POST = withAgentAuth(async (request, store, ctx: Ctx) => {
  const { id } = await ctx.params;
  const body = await request.json().catch(() => ({}));
  const input = designRegenerateSchema.parse(body);
  const origin = originFromHeaders(request.headers);
  const design = await regenerateDesign(store, id, input, "agent", origin);
  return Response.json({ design });
});
