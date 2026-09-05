import { withPlatformAuth } from "@/lib/store/api-helpers";
import { createStore } from "@/lib/platform";
import { storeCreateSchema } from "@/lib/platform-schemas";
import { toSafeStore } from "@/lib/store/public";

export const dynamic = "force-dynamic";

export const POST = withPlatformAuth(async (request) => {
  const body = await request.json();
  const input = storeCreateSchema.parse(body);
  const { store, credentials } = await createStore(input);

  return Response.json({ store: toSafeStore(store), credentials }, { status: 201 });
});
