import { withAgentAuth } from "@/lib/store/api-helpers";
import { submitOrderToFulfillment } from "@/lib/store/orders";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export const POST = withAgentAuth(async (_request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const order = await submitOrderToFulfillment(id);
  return Response.json({ order });
});
