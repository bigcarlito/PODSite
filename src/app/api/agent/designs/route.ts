import { withAgentAuth } from "@/lib/store/api-helpers";
import { designCreateSchema } from "@/lib/store/schemas";
import { createDesign, listDesigns } from "@/lib/design/designs";
import { originFromHeaders } from "@/lib/origin";

export const dynamic = "force-dynamic";

export const GET = withAgentAuth(async (request, store) => {
  const url = new URL(request.url);
  const status = url.searchParams.get("status") ?? undefined;
  const takeParam = url.searchParams.get("take");
  const take = takeParam ? Number(takeParam) : undefined;
  const designs = await listDesigns(store.id, { status, take });
  return Response.json({ designs });
});

export const POST = withAgentAuth(async (request, store) => {
  const body = await request.json();
  const input = designCreateSchema.parse(body);
  const origin = originFromHeaders(request.headers);
  const design = await createDesign(store, input, "agent", origin);
  return Response.json({ design }, { status: 201 });
});
