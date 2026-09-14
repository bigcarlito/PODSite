import { withAgentAuth } from "@/lib/store/api-helpers";
import { setMockupSceneBaseImage } from "@/lib/store/mockup-scenes";
import { mockupSceneBaseImageUploadSchema } from "@/lib/store/schemas";
import { originFromHeaders } from "@/lib/origin";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ productType: string; colorName: string }> };

export const PUT = withAgentAuth(async (request, store, ctx: Ctx) => {
  const { productType, colorName } = await ctx.params;
  const body = await request.json();
  const input = mockupSceneBaseImageUploadSchema.parse(body);
  const data = Buffer.from(input.data, "base64");

  const scene = await setMockupSceneBaseImage(
    store,
    decodeURIComponent(productType),
    decodeURIComponent(colorName),
    { data, mimeType: input.mimeType },
    "agent",
    originFromHeaders(request.headers)
  );
  return Response.json({ scene });
});
