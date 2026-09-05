import { withAgentAuth } from "@/lib/store/api-helpers";
import { updateStoreBrand } from "@/lib/store/settings";
import { storeUpdateSchema } from "@/lib/store/schemas";
import { toSafeStore } from "@/lib/store/public";

export const dynamic = "force-dynamic";

export const GET = withAgentAuth(async (_request, store) => {
  return Response.json({ store: toSafeStore(store) });
});

export const PATCH = withAgentAuth(async (request, store) => {
  const body = await request.json();
  const input = storeUpdateSchema.parse(body);
  const updated = await updateStoreBrand(store.id, input);
  return Response.json({ store: toSafeStore(updated) });
});
