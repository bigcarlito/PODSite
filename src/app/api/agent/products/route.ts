import { withAgentAuth } from "@/lib/store/api-helpers";
import { listProducts, createProduct } from "@/lib/store/products";
import { productCreateSchema } from "@/lib/store/schemas";

export const dynamic = "force-dynamic";

export const GET = withAgentAuth(async (request) => {
  const url = new URL(request.url);
  const activeOnly = url.searchParams.get("activeOnly") === "true";
  const products = await listProducts({ activeOnly });
  return Response.json({ products });
});

export const POST = withAgentAuth(async (request) => {
  const body = await request.json();
  const input = productCreateSchema.parse(body);
  const product = await createProduct(input);
  return Response.json({ product }, { status: 201 });
});
