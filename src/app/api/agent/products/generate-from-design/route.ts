import { withAgentAuth } from "@/lib/store/api-helpers";
import { generateProductFromDesign } from "@/lib/store/ai-product-create";
import { aiProductCreateSchema } from "@/lib/store/schemas";

export const dynamic = "force-dynamic";

export const POST = withAgentAuth(async (request, store) => {
  const body = await request.json();
  const input = aiProductCreateSchema.parse(body);
  const result = await generateProductFromDesign(store, input);
  return Response.json(result);
});
