import { withAgentAuth } from "@/lib/store/api-helpers";
import { submitOrderToFulfillment } from "@/lib/store/orders";
import { originFromHeaders } from "@/lib/origin";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export const POST = withAgentAuth(async (request, store, ctx: Ctx) => {
  const { id } = await ctx.params;
  const order = await submitOrderToFulfillment(store, id, originFromHeaders(request.headers));
  return Response.json({ order });
});
