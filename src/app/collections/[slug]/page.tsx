import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentStore } from "@/lib/store-context";
import { ProductCard } from "@/components/ProductCard";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const store = await getCurrentStore();
  if (!store) return { title: "Collection" };
  const collection = await prisma.collection.findUnique({
    where: { storeId_slug: { storeId: store.id, slug } },
  });
  return { title: collection?.title ?? "Collection" };
}

export default async function CollectionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const store = await getCurrentStore();
  if (!store) notFound();

  const collection = await prisma.collection.findUnique({
    where: { storeId_slug: { storeId: store.id, slug } },
    include: {
      products: {
        include: {
          product: {
            include: {
              images: { orderBy: { position: "asc" }, take: 1 },
              variants: { orderBy: { priceCents: "asc" }, take: 1 },
            },
          },
        },
      },
    },
  });

  if (!collection) notFound();

  const products = collection.products
    .map((pc) => pc.product)
    .filter((p) => p.isActive);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
        {collection.title}
      </h1>
      {collection.description && (
        <p className="mt-2 max-w-2xl text-sm text-muted">
          {collection.description}
        </p>
      )}

      {products.length === 0 ? (
        <p className="mt-8 text-sm text-muted">
          No products in this collection yet.
        </p>
      ) : (
        <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
          {products.map((p) => (
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
      )}
    </div>
  );
}
