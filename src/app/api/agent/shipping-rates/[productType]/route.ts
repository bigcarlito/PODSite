import { withAgentAuth } from "@/lib/store/api-helpers";
import { setShippingRate } from "@/lib/store/shipping";
import { shippingRateUpsertSchema } from "@/lib/store/schemas";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ productType: string }> };

export const PUT = withAgentAuth(async (request, store, ctx: Ctx) => {
  const { productType } = await ctx.params;
  const body = await request.json();
  const input = shippingRateUpsertSchema.parse(body);

  const shippingRate = await setShippingRate(
    store.id,
    decodeURIComponent(productType),
    input,
    "agent"
  );
  return Response.json({ shippingRate });
});
