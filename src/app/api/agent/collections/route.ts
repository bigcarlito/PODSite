import { withAgentAuth } from "@/lib/store/api-helpers";
import { listCollections, createCollection } from "@/lib/store/collections";
import { collectionCreateSchema } from "@/lib/store/schemas";

export const dynamic = "force-dynamic";

export const GET = withAgentAuth(async (_request, store) => {
  const collections = await listCollections(store.id);
  return Response.json({ collections });
});

export const POST = withAgentAuth(async (request, store) => {
  const body = await request.json();
  const input = collectionCreateSchema.parse(body);
  const collection = await createCollection(store.id, input);
  return Response.json({ collection }, { status: 201 });
});
