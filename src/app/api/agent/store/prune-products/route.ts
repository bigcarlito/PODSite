import { withAgentAuth } from "@/lib/store/api-helpers";
import { deleteOrphanedInactiveProducts } from "@/lib/store/cleanup";
import { pruneSchema } from "@/lib/store/schemas";

export const dynamic = "force-dynamic";

export const POST = withAgentAuth(async (request, store) => {
  const body = await request.json().catch(() => ({}));
  const input = pruneSchema.parse(body);
  const result = await deleteOrphanedInactiveProducts(store.id, "agent", input.dryRun);
  return Response.json(result);
});
