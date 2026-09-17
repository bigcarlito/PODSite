import { withAgentAuth } from "@/lib/store/api-helpers";
import { designBatchCreateSchema } from "@/lib/store/schemas";
import { createDesignBatch } from "@/lib/design/design-batches";
import { originFromHeaders } from "@/lib/origin";

export const dynamic = "force-dynamic";

export const POST = withAgentAuth(async (request, store) => {
  const body = await request.json();
  const input = designBatchCreateSchema.parse(body);
  const origin = originFromHeaders(request.headers);
  const result = await createDesignBatch(store, input, "agent", origin);
  return Response.json(result, { status: 201 });
});
