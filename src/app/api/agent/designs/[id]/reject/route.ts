import { withAgentAuth } from "@/lib/store/api-helpers";
import { rejectDesign } from "@/lib/design/designs";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export const POST = withAgentAuth(async (_request, store, ctx: Ctx) => {
  const { id } = await ctx.params;
  const design = await rejectDesign(store, id, "agent");
  return Response.json({ design });
});
