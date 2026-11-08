import DraftProductForm from "../../design-factory/draft-product";
import { factoryDraftSettingsSchema } from "@/lib/design/factory-draft";
import type { Metadata } from "next";
import Link from "next/link";
import { getProductById } from "@/lib/store/products";
import { requireCurrentStore } from "@/lib/store-context";
import { VariantProviderIdsForm } from "./VariantProviderIdsForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Admin — Product variants" };

export default async function ProductVariantsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const store = await requireCurrentStore();
  const product = await getProductById(store.id, id);

  const variants = product.variants.map((v) => ({
    id: v.id,
    sku: v.sku,
    options: (v.options as Record<string, string> | null) ?? {},
    priceCents: v.priceCents,
    currency: v.currency,
    provider: v.provider,
    providerVariantId: v.providerVariantId ?? "",
    inStock: v.inStock,
  }));

  return (
    <div>
      <p className="text-xs text-muted">
        <Link href="/admin/products" className="underline">
          Products
        </Link>{" "}
        / Variants
      </p>
      <h1 className="mt-1 text-xl font-semibold">{product.title}</h1>
      <p className="mt-1 text-xs text-muted">
        Sets each variant&apos;s <code>providerVariantId</code> — the fulfillment
        provider&apos;s own variant id (e.g. a Printful catalog variant) — the
        same field <code>PATCH /api/agent/products/{id}</code> can set (see
        docs/AGENT_API.md). Required before{" "}
        <Link href={`/admin/products/${id}/mockups`} className="underline">
          mockups
        </Link>{" "}
        from a supplier can render for a color, or an order can be submitted to fulfillment.
        Scene-based mockups using uploaded blank images do not require supplier IDs.
      </p>

      {product.factoryDraft && (() => {
        const evidence = product.factoryDraft as Record<string, unknown>;
        const settings = factoryDraftSettingsSchema.parse(evidence.settings);
        const colors = Array.from(new Set(variants.map(v => v.options.color).filter(Boolean)));
        return <><p className="mt-4 font-semibold">Factory draft: inactive, preview-only. Supplier data unverified.</p>
          <DraftProductForm productId={product.id} garments={[product.productType!]} initial={{ ...settings, title: product.title, description: product.description, colors, priceCents: variants[0]?.priceCents ?? settings.priceCents }} />
          <details><summary>Preserved artwork, version, placement and calibration evidence</summary><pre className="whitespace-pre-wrap break-all text-xs">{JSON.stringify(evidence, null, 2)}</pre></details></>;
      })()}
      <VariantProviderIdsForm productId={product.id} variants={variants} />
    </div>
  );
}
