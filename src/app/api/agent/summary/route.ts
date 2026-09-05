import { withAgentAuth } from "@/lib/store/api-helpers";
import { getStoreSummary } from "@/lib/store/summary";

export const dynamic = "force-dynamic";

export const GET = withAgentAuth(async (_request, store) => {
  const summary = await getStoreSummary(store.id);
  return Response.json(summary);
});
