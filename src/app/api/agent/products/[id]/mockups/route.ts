import { withAgentAuth } from "@/lib/store/api-helpers";
import { generateProductMockups } from "@/lib/store/mockups";
import { mockupGenerateSchema } from "@/lib/store/schemas";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export const POST = withAgentAuth(async (request, store, ctx: Ctx) => {
  const { id } = await ctx.params;
  const body = await request.json();
  const input = mockupGenerateSchema.parse(body);
  const result = await generateProductMockups(store, id, input);
  return Response.json(result);
});
