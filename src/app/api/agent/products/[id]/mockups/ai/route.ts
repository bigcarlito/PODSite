import { withAgentAuth } from "@/lib/store/api-helpers";
import { generateAIProductMockups } from "@/lib/store/ai-mockups";
import { aiMockupGenerateSchema } from "@/lib/store/schemas";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export const POST = withAgentAuth(async (request, store, ctx: Ctx) => {
  const { id } = await ctx.params;
  const body = await request.json();
  const input = aiMockupGenerateSchema.parse(body);
  const result = await generateAIProductMockups(store, id, input);
  return Response.json(result);
});
