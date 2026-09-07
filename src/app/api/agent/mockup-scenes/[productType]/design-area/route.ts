import { withAgentAuth } from "@/lib/store/api-helpers";
import { setDesignArea } from "@/lib/store/mockup-scenes";
import { designAreaSchema } from "@/lib/store/schemas";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ productType: string }> };

export const PUT = withAgentAuth(async (request, store, ctx: Ctx) => {
  const { productType } = await ctx.params;
  const body = await request.json();
  const input = designAreaSchema.parse(body);

  const scene = await setDesignArea(store.id, decodeURIComponent(productType), input, "agent");
  return Response.json({ scene });
});
