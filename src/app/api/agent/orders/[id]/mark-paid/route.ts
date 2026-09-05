import { withAgentAuth } from "@/lib/store/api-helpers";
import { markOrderPaid } from "@/lib/store/orders";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export const POST = withAgentAuth(async (_request, store, ctx: Ctx) => {
  const { id } = await ctx.params;
  const order = await markOrderPaid(store.id, id);
  return Response.json({ order });
});
