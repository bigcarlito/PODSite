import { withAgentAuth } from "@/lib/store/api-helpers";
import { getDesign } from "@/lib/design/designs";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export const GET = withAgentAuth(async (_request, store, ctx: Ctx) => {
  const { id } = await ctx.params;
  const design = await getDesign(store.id, id);
  return Response.json({ design });
});
