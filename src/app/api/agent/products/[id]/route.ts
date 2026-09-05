import { withAgentAuth } from "@/lib/store/api-helpers";
import {
  getProductById,
  updateProduct,
  deactivateProduct,
} from "@/lib/store/products";
import { productUpdateSchema } from "@/lib/store/schemas";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export const GET = withAgentAuth(async (_request, store, ctx: Ctx) => {
  const { id } = await ctx.params;
  const product = await getProductById(store.id, id);
  return Response.json({ product });
});

export const PATCH = withAgentAuth(async (request, store, ctx: Ctx) => {
  const { id } = await ctx.params;
  const body = await request.json();
  const input = productUpdateSchema.parse(body);
  const product = await updateProduct(store.id, id, input);
  return Response.json({ product });
});

export const DELETE = withAgentAuth(async (_request, store, ctx: Ctx) => {
  const { id } = await ctx.params;
  const product = await deactivateProduct(store.id, id);
  return Response.json({ product });
});
