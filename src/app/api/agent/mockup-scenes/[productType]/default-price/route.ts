import { withAgentAuth } from "@/lib/store/api-helpers";
import { setMockupSceneDefaultPrice } from "@/lib/store/mockup-scenes";
import { mockupSceneDefaultPriceSchema } from "@/lib/store/schemas";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ productType: string }> };

/**
 * Sets an existing product type's default price alone — no photo/colors
 * required, unlike PUT /api/agent/mockup-scenes/:productType. Fails with
 * 422 NO_MOCKUP_SCENE if that product type has no scene yet.
 */
export const PUT = withAgentAuth(async (request, store, ctx: Ctx) => {
  const { productType } = await ctx.params;
  const body = await request.json();
  const input = mockupSceneDefaultPriceSchema.parse(body);

  const scene = await setMockupSceneDefaultPrice(
    store,
    decodeURIComponent(productType),
    input.priceCents,
    input.currency,
    "agent"
  );
  return Response.json({ scene });
});
