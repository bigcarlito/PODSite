import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Gallery } from "@/components/Gallery";
import { VariantPicker } from "@/components/VariantPicker";
import { ProductCard } from "@/components/ProductCard";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = await prisma.product.findUnique({ where: { slug } });
  return { title: product?.title ?? "Product" };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const product = await prisma.product.findUnique({
    where: { slug, isActive: true },
    include: {
      images: { orderBy: { position: "asc" } },
      variants: true,
    },
  });

  if (!product) notFound();

  const related = await prisma.product.findMany({
    where: { isActive: true, id: { not: product.id } },
    include: {
      images: { orderBy: { position: "asc" }, take: 1 },
      variants: { orderBy: { priceCents: "asc" }, take: 1 },
    },
    take: 4,
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-12">
        <Gallery images={product.images} title={product.title} />

        <div className="lg:sticky lg:top-24 lg:self-start">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {product.title}
          </h1>

          <div className="mt-6">
            <VariantPicker
              optionNames={product.optionNames}
              variants={product.variants.map((v) => ({
                id: v.id,
                options: v.options as Record<string, string>,
                priceCents: v.priceCents,
                currency: v.currency,
                inStock: v.inStock,
              }))}
            />
          </div>

          <div className="mt-8 border-t border-border pt-6">
            <p className="text-sm font-medium">Description</p>
            <p className="mt-2 whitespace-pre-line text-sm text-muted">
              {product.description}
            </p>
          </div>
        </div>
      </div>

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
