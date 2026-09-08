import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentStore } from "@/lib/store-context";
import { ProductPurchasePanel } from "@/components/ProductPurchasePanel";
import { ProductCard } from "@/components/ProductCard";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const store = await getCurrentStore();
  if (!store) return { title: "Product" };
  const product = await prisma.product.findUnique({
    where: { storeId_slug: { storeId: store.id, slug } },
  });
  return { title: product?.title ?? "Product" };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const store = await getCurrentStore();
  if (!store) notFound();

  const product = await prisma.product.findUnique({
    where: { storeId_slug: { storeId: store.id, slug }, isActive: true },
    include: {
      images: { orderBy: { position: "asc" } },
      variants: true,
    },
  });

  if (!product) notFound();

  const colorSwatches: Record<string, string> = {};
  if (product.productType) {
    const scene = await prisma.mockupScene.findUnique({
      where: { storeId_productType: { storeId: store.id, productType: product.productType } },
    });
    const colors = (scene?.colors as unknown as { name: string; hex: string }[]) ?? [];
    for (const c of colors) colorSwatches[c.name] = c.hex;
  }

  const related = await prisma.product.findMany({
    where: { storeId: store.id, isActive: true, id: { not: product.id } },
    include: {
      images: { orderBy: { position: "asc" }, take: 1 },
      variants: { orderBy: { priceCents: "asc" }, take: 1 },
    },
    take: 4,
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <ProductPurchasePanel
        title={product.title}
        description={product.description}
        images={product.images.map((img) => ({
          url: img.url,
          altText: img.altText,
          optionValues: img.optionValues as Record<string, string> | null,
        }))}
        optionNames={product.optionNames}
        variants={product.variants.map((v) => ({
          id: v.id,
          options: v.options as Record<string, string>,
          priceCents: v.priceCents,
          currency: v.currency,
          inStock: v.inStock,
        }))}
        colorSwatches={colorSwatches}
      />

      {related.length > 0 && (
        <section className="mt-16 sm:mt-20">
          <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
            You might also like
          </h2>
          <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
            {related.map((p) => (
              <ProductCard
                key={p.id}
                product={{
                  slug: p.slug,
                  title: p.title,
                  imageUrl: p.images[0]?.url,
                  priceCents: p.variants[0]?.priceCents ?? 0,
                }}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
