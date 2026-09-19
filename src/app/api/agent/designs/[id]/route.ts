import { withAgentAuth } from "@/lib/store/api-helpers";
import { getDesign, deleteDesign } from "@/lib/design/designs";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export const GET = withAgentAuth(async (_request, store, ctx: Ctx) => {
  const { id } = await ctx.params;
  const design = await getDesign(store.id, id);
  return Response.json({ design });
});

/**
 * Permanently deletes a "rejected" design — see deleteDesign() in
 * src/lib/design/designs.ts. Fails with 409 DESIGN_NOT_DELETABLE on any
 * other status.
 */
export const DELETE = withAgentAuth(async (_request, store, ctx: Ctx) => {
  const { id } = await ctx.params;
  const result = await deleteDesign(store, id, "agent");
  return Response.json(result);
});
