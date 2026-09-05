import { withAgentAuth } from "@/lib/store/api-helpers";
import { listActivity, logActivity } from "@/lib/store/activity";
import { activityCreateSchema } from "@/lib/store/schemas";

export const dynamic = "force-dynamic";

export const GET = withAgentAuth(async (request, store) => {
  const url = new URL(request.url);
  const sinceParam = url.searchParams.get("since");
  const since = sinceParam ? new Date(sinceParam) : undefined;
  const take = Number(url.searchParams.get("take") ?? "50");

  const activity = await listActivity(store.id, { since, take });
  return Response.json({ activity });
});

export const POST = withAgentAuth(async (request, store) => {
  const body = await request.json();
  const input = activityCreateSchema.parse(body);
  const entry = await logActivity(store.id, { actor: "agent", ...input });
  return Response.json({ activity: entry }, { status: 201 });
});
