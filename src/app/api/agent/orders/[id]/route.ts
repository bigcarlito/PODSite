import { withAgentAuth } from "@/lib/store/api-helpers";
import { getOrder } from "@/lib/store/orders";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export const GET = withAgentAuth(async (_request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const order = await getOrder(id);
  return Response.json({ order });
});
