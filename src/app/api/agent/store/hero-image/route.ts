import { withAgentAuth } from "@/lib/store/api-helpers";
import { setHeroImage } from "@/lib/store/settings";
import { heroImageUploadSchema } from "@/lib/store/schemas";
import { toSafeStore } from "@/lib/store/public";

export const dynamic = "force-dynamic";

export const POST = withAgentAuth(async (request, store) => {
  const body = await request.json();
  const input = heroImageUploadSchema.parse(body);
  const data = Buffer.from(input.data, "base64");

  const updated = await setHeroImage(store, { data, mimeType: input.mimeType }, "agent");
  return Response.json({ store: toSafeStore(updated) });
});
