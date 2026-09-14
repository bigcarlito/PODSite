import { withAgentAuth } from "@/lib/store/api-helpers";
import { listShippingRates } from "@/lib/store/shipping";

export const dynamic = "force-dynamic";

export const GET = withAgentAuth(async (_request, store) => {
  const shippingRates = await listShippingRates(store.id);
  return Response.json({ shippingRates });
});
