import { withAgentAuth } from "@/lib/store/api-helpers";
import { listMockupScenes } from "@/lib/store/mockup-scenes";

export const dynamic = "force-dynamic";

export const GET = withAgentAuth(async (_request, store) => {
  const scenes = await listMockupScenes(store.id);
  return Response.json({ scenes });
});
