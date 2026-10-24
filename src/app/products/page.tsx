import { getStoreBranding } from "@/lib/store-branding";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentStore } from "@/lib/store-context";
import { ProductCard } from "@/components/ProductCard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "All Products" };

export default async function ProductsPage() {
  const store = await getCurrentStore();
  if (!store) notFound();

  const products = await prisma.product.findMany({
    where: { storeId: store.id, isActive: true },
    include: {
      images: { orderBy: { position: "asc" }, take: 1 },
      variants: { orderBy: { priceCents: "asc" }, take: 1 },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
        All Products
      </h1>
      <p className="mt-2 text-sm text-muted">
        {products.length} product{products.length === 1 ? "" : "s"}
      </p>

      {products.length === 0 ? (
        <p className="mt-8 text-sm text-muted">
          Our first drop is getting ready. Check back soon.
        </p>
      ) : (
        <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
          {products.map((p) => (
            <ProductCard
              key={p.id}
              product={{
                badge: getStoreBranding(store).storefront.productBadges?.[p.slug],
                currency: p.variants[0]?.currency,
                slug: p.slug,
                title: p.title,
                imageUrl: p.images[0]?.url,
                priceCents: p.variants[0]?.priceCents ?? 0,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
