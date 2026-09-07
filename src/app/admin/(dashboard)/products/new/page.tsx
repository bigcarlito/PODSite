import type { Metadata } from "next";
import Link from "next/link";
import { listMockupScenes } from "@/lib/store/mockup-scenes";
import { requireCurrentStore } from "@/lib/store-context";
import { NewProductForm } from "./NewProductForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Admin — New product" };

export default async function NewProductPage() {
  const store = await requireCurrentStore();
  const scenes = await listMockupScenes(store.id);
  const productTypes = scenes.map((s) => ({
    productType: s.productType,
    colorCount: ((s.colors as unknown[]) ?? []).length,
  }));

  return (
    <div>
      <p className="text-xs text-muted">
        <Link href="/admin/products" className="underline">
          Products
        </Link>{" "}
        / New
      </p>
      <h1 className="mt-1 text-xl font-semibold">New product from a design</h1>
      <p className="mt-1 text-xs text-muted">
        Pick a product type and upload a design — the title, description,
        and a mockup for every color that type comes in are all generated
        automatically via OpenRouter. Calls the same{" "}
        <code>generateProductFromDesign</code> function as{" "}
        <code>POST /api/agent/products/generate-from-design</code>. Manage
        product types and their colors on{" "}
        <Link href="/admin/mockup-scenes" className="underline">
          Mockup scenes
        </Link>
        .
      </p>

      {productTypes.length === 0 ? (
        <p className="mt-6 text-sm text-muted">
          No product types set up yet — add one on{" "}
          <Link href="/admin/mockup-scenes" className="underline">
            Mockup scenes
          </Link>{" "}
          first (a scene photo plus its color lineup).
        </p>
      ) : (
        <NewProductForm productTypes={productTypes} />
      )}
    </div>
  );
}
