import { withAgentAuth } from "@/lib/store/api-helpers";
import { generateMockupSceneBases } from "@/lib/store/mockup-scenes";
import { generateMockupSceneBasesSchema } from "@/lib/store/schemas";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ productType: string }> };

export const POST = withAgentAuth(async (request, store, ctx: Ctx) => {
  const { productType } = await ctx.params;
  const body = await request.json().catch(() => ({}));
  const input = generateMockupSceneBasesSchema.parse(body);

  const result = await generateMockupSceneBases(
    store,
    decodeURIComponent(productType),
    "agent",
    input.model
  );
  return Response.json(result);
});
