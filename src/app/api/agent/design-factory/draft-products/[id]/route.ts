import { withAgentAuth } from "@/lib/store/api-helpers";
import { updateFactoryDraft } from "@/lib/store/factory-draft";
export const PATCH = withAgentAuth(async (request, store, context: { params: Promise<{ id: string }> }) => {
  const { id } = await context.params;
  return Response.json(await updateFactoryDraft(store, id, await request.json(), "agent"));
});
