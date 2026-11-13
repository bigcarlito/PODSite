import { withAgentAuth } from "@/lib/store/api-helpers";
import { unpublishProduct } from "@/lib/store/product-publication";

export const dynamic = "force-dynamic";
export const maxDuration = 120;
type Ctx = { params: Promise<{ id: string }> };
export const POST = withAgentAuth(async (request, store, ctx: Ctx) => {
  const { id } = await ctx.params;
  const text = await request.text();
  return Response.json(await unpublishProduct(store, id, text.trim() ? JSON.parse(text) : {}, "agent"));
});
