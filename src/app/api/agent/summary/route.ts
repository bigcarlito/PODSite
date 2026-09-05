import { withAgentAuth } from "@/lib/store/api-helpers";
import { getStoreSummary } from "@/lib/store/summary";

export const dynamic = "force-dynamic";

export const GET = withAgentAuth(async () => {
  const summary = await getStoreSummary();
  return Response.json(summary);
});
