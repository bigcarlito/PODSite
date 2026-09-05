import { withAgentAuth } from "@/lib/store/api-helpers";
import { listCollections, createCollection } from "@/lib/store/collections";
import { collectionCreateSchema } from "@/lib/store/schemas";

export const dynamic = "force-dynamic";

export const GET = withAgentAuth(async () => {
  const collections = await listCollections();
  return Response.json({ collections });
});

export const POST = withAgentAuth(async (request) => {
  const body = await request.json();
  const input = collectionCreateSchema.parse(body);
  const collection = await createCollection(input);
  return Response.json({ collection }, { status: 201 });
});
