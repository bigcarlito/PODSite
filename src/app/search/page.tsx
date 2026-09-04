import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { ProductCard } from "@/components/ProductCard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Search" };

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = q?.trim() ?? "";

  const products = query
    ? await prisma.product.findMany({
        where: {
          isActive: true,
          OR: [
            { title: { contains: query, mode: "insensitive" } },
            { description: { contains: query, mode: "insensitive" } },
          ],
        },
        include: {
          images: { orderBy: { position: "asc" }, take: 1 },
          variants: { orderBy: { priceCents: "asc" }, take: 1 },
        },
      })
    : [];

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
        Search
      </h1>

      <form className="mt-6 max-w-md">
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Search products..."
          className="w-full rounded-full border border-border bg-background px-4 py-2.5 text-sm outline-none focus:border-accent"
        />
      </form>

      {query && (
        <p className="mt-6 text-sm text-muted">
          {products.length} result{products.length === 1 ? "" : "s"} for
          &quot;{query}&quot;
        </p>
      )}

      {products.length > 0 && (
        <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
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
