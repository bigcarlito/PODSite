import { withAgentAuth } from "@/lib/store/api-helpers";
import { designConceptsGenerateSchema } from "@/lib/store/schemas";
import { generateDesignConcepts } from "@/lib/design/concepts";

export const dynamic = "force-dynamic";

export const POST = withAgentAuth(async (request, store) => {
  const body = await request.json();
  const input = designConceptsGenerateSchema.parse(body);
  const concepts = await generateDesignConcepts(store, input);
  return Response.json({ concepts });
});
