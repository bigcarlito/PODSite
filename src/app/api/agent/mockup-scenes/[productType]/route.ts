import { withAgentAuth } from "@/lib/store/api-helpers";
import { setMockupScene, deleteMockupScene } from "@/lib/store/mockup-scenes";
import { mockupSceneUploadSchema } from "@/lib/store/schemas";
import { originFromHeaders } from "@/lib/origin";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ productType: string }> };

export const PUT = withAgentAuth(async (request, store, ctx: Ctx) => {
  const { productType } = await ctx.params;
  const body = await request.json();
  const input = mockupSceneUploadSchema.parse(body);
  const data = Buffer.from(input.data, "base64");
  const origin = originFromHeaders(request.headers);

  const scene = await setMockupScene(
    store,
    decodeURIComponent(productType),
    { data, mimeType: input.mimeType },
    "agent",
    origin,
    input.colors
  );
  return Response.json({ scene });
});

export const DELETE = withAgentAuth(async (_request, store, ctx: Ctx) => {
  const { productType } = await ctx.params;
  await deleteMockupScene(store.id, decodeURIComponent(productType), "agent");
  return Response.json({ ok: true });
});
