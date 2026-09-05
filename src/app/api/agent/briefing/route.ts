import { withAgentAuth } from "@/lib/store/api-helpers";
import { getStoreSummary } from "@/lib/store/summary";
import { listActivity } from "@/lib/store/activity";
import { toSafeStore } from "@/lib/store/public";

export const dynamic = "force-dynamic";

/**
 * One call to fully orient a fresh agent session on this store: brand/
 * business knowledge, live operational state, and recent history. Call
 * this first, before making any changes — see AGENTS.md and
 * docs/AGENT_API.md.
 */
export const GET = withAgentAuth(async (_request, store) => {
  const [summary, activity] = await Promise.all([
    getStoreSummary(store.id),
    listActivity(store.id, { take: 25 }),
  ]);

  return Response.json({
    store: toSafeStore(store),
    summary,
    recentActivity: activity,
  });
});
