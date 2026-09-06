import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentStore } from "@/lib/store-context";
import { getStoreBranding } from "@/lib/store-branding";
import { ProductCard } from "@/components/ProductCard";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const store = await getCurrentStore();
  if (!store) notFound();
  const branding = getStoreBranding(store);

  const featured = await prisma.product.findMany({
    where: { storeId: store.id, isActive: true, isFeatured: true },
    include: {
      images: { orderBy: { position: "asc" }, take: 1 },
      variants: { orderBy: { priceCents: "asc" }, take: 1 },
    },
    take: 8,
  });

  return (
    <div>
      <section className="relative overflow-hidden bg-accent/5">
        <div
          className={`mx-auto grid max-w-6xl grid-cols-1 ${
            branding.theme.heroImageUrl ? "lg:grid-cols-2 lg:items-stretch" : ""
          }`}
        >
          <div className="flex flex-col items-start justify-center gap-6 px-4 py-16 sm:px-6 sm:py-24 lg:py-28">
            <p className="text-xs font-semibold uppercase tracking-widest text-accent">
              New season, new gear
            </p>
            <h1 className="max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
              {branding.tagline}
            </h1>
            <p className="max-w-xl text-base text-muted sm:text-lg">
              {branding.description}
            </p>
            <Link
              href="/products"
              className="rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-dark sm:text-base"
            >
              Shop All Products
            </Link>
          </div>

          {branding.theme.heroImageUrl && (
            <div className="order-first h-56 w-full sm:h-80 lg:order-last lg:h-auto">
              {/* Plain <img>, not next/image: heroImageUrl can be any
                  agent-supplied host, and next/image requires each host
                  allowlisted in next.config.ts's images.remotePatterns. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={branding.theme.heroImageUrl}
                alt=""
                className="h-full w-full object-cover"
              />
            </div>
          )}
        </div>
      </section>

      {branding.trustBadges.length > 0 && (
        <section className="border-y border-border bg-background">
          <div className="mx-auto grid max-w-6xl grid-cols-1 gap-4 px-4 py-6 text-center sm:grid-cols-3 sm:px-6">
            {branding.trustBadges.map((badge) => (
              <p key={badge} className="text-sm font-medium text-muted">
                {badge}
              </p>
            ))}
          </div>
        </section>
      )}

      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
        <div className="mb-8 flex items-end justify-between">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Best Sellers
          </h2>
          <Link
            href="/products"
            className="text-sm font-medium text-accent hover:underline"
          >
            View all
          </Link>
        </div>

        {featured.length === 0 ? (
          <p className="text-sm text-muted">
            No featured products yet — add some via the admin dashboard or
            seed script.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
            {featured.map((p) => (
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
      </section>

      <section className="bg-accent/5">
        <div className="mx-auto max-w-6xl px-4 py-16 text-center sm:px-6 sm:py-20">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Made for the obsessed. Printed on demand.
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-muted sm:text-base">
            Every piece is printed fresh when you order it — no overproduction,
            no warehouses full of unsold stock. Just your gear, made for you.
          </p>
        </div>
      </section>
    </div>
  );
}
