import { withAgentAuth } from "@/lib/store/api-helpers";
import { designPublishSchema } from "@/lib/store/schemas";
import { publishDesign } from "@/lib/design/designs";
import { originFromHeaders } from "@/lib/origin";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export const POST = withAgentAuth(async (request, store, ctx: Ctx) => {
  const { id } = await ctx.params;
  const body = await request.json();
  const input = designPublishSchema.parse(body);
  const origin = originFromHeaders(request.headers);
  const result = await publishDesign(store, id, input, "agent", origin);
  return Response.json(result);
});
