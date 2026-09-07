import type { Metadata } from "next";
import Link from "next/link";
import { getProductById } from "@/lib/store/products";
import { requireCurrentStore } from "@/lib/store-context";
import { MockupTestForm } from "./MockupTestForm";
import { AIMockupTestForm } from "./AIMockupTestForm";
import { ProductTypeForm } from "../ProductTypeForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Admin — Mockups" };

export default async function ProductMockupsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const store = await requireCurrentStore();
  const product = await getProductById(store.id, id);

  const colorsByOption = new Map<string, Set<string>>();
  for (const variant of product.variants) {
    const options = (variant.options as Record<string, string> | null) ?? {};
    for (const name of product.optionNames) {
      if (!options[name]) continue;
      if (!colorsByOption.has(name)) colorsByOption.set(name, new Set());
      colorsByOption.get(name)!.add(options[name]);
    }
  }

  return (
    <div>
      <p className="text-xs text-muted">
        <Link href="/admin/products" className="underline">
          Products
        </Link>{" "}
        / Mockups
      </p>
      <h1 className="mt-1 text-xl font-semibold">{product.title}</h1>
      <p className="mt-1 text-xs text-muted">
        Calls the same <code>generateProductMockups</code> function as{" "}
        <code>POST /api/agent/products/{id}/mockups</code> (see docs/AGENT_API.md).
        Start with <strong>dry run</strong> — it scores each garment color&apos;s
        contrast against the design without spending a provider render call,
        and with explicit garment hexes below it needs no Printful
        credentials at all.
      </p>

      <p className="mt-4 text-xs text-muted">
        Option names on this product: <code>{product.optionNames.join(", ") || "(none)"}</code>
        {[...colorsByOption.entries()].map(([name, values]) => (
          <span key={name}>
            {" — "}
            <code>{name}</code>: {[...values].join(", ")}
          </span>
        ))}
      </p>

      <MockupTestForm productId={product.id} />

      <hr className="my-10 border-border" />

      <h2 className="text-lg font-semibold">AI mockup (custom scene)</h2>
      <p className="mt-1 text-xs text-muted">
        Recolors a shared scene photo for this product&apos;s type and
        composites the design onto it via OpenRouter — an alternative to the
        Printful mockup above for a non-generic, non-white-background result.
        Calls the same <code>generateAIProductMockups</code> function as{" "}
        <code>POST /api/agent/products/{id}/mockups/ai</code>. Manage scene
        photos per product type on{" "}
        <Link href="/admin/mockup-scenes" className="underline">
          Mockup scenes
        </Link>
        .
      </p>

      <div className="mt-4">
        <ProductTypeForm productId={product.id} productType={product.productType ?? ""} />
      </div>

      <AIMockupTestForm productId={product.id} />
    </div>
  );
}
