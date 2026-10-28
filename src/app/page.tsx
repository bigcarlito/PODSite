import { StoreArtwork } from "@/components/StoreArtwork";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentStore } from "@/lib/store-context";
import { getStoreBranding } from "@/lib/store-branding";
import { ProductCard } from "@/components/ProductCard";
import { BoutiqueHome } from "@/components/BoutiqueHome";
import { boutiqueSchema, featuredProductsQuery, isBoutiqueTenant } from "@/lib/storefront-theme";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const store = await getCurrentStore();
  if (!store) notFound();
  const branding = getStoreBranding(store);
  const boutique = isBoutiqueTenant(store.slug) ? boutiqueSchema.parse(branding.storefront.boutique ?? {}) : null;

  const featured = await prisma.product.findMany({
    ...featuredProductsQuery(store.id, boutique?.featuredCount ?? 8),
    include: {
      images: { orderBy: { position: "asc" }, take: 1 },
      variants: { orderBy: { priceCents: "asc" }, take: 1 },
    },
  });

  const art = branding.storefront;
  const hero = art.hero ?? (branding.theme.heroImageUrl ? { src: branding.theme.heroImageUrl, alt: "" } : undefined);
  if (boutique) return <BoutiqueHome config={boutique} artwork={{ ...art, hero }} products={featured.map(p => ({ slug: p.slug, title: p.title, imageUrl: p.images[0]?.url, priceCents: p.variants[0]?.priceCents ?? 0, currency: p.variants[0]?.currency }))} />;
  return (
    <div>
      <section className="relative overflow-hidden bg-accent/5">
        <div
          className={`mx-auto grid max-w-6xl grid-cols-1 ${
            hero ? "lg:grid-cols-2 lg:items-stretch" : ""
          }`}
        >
          <div className="flex flex-col items-start justify-center gap-6 px-4 py-16 sm:px-6 sm:py-24 lg:py-28">
            <p className="text-xs font-semibold uppercase tracking-widest text-accent">
              {art.eyebrow ?? "New season, new gear"}
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
              {art.shopLabel ?? "Shop All Products"}
            </Link>
          </div>

          {hero && <div className="order-first aspect-[4/3] w-full lg:order-last lg:aspect-auto lg:min-h-96"><StoreArtwork {...hero} className="h-full w-full object-cover" /></div>}
          {art.decorations?.map((decoration, index) => <div key={index} aria-hidden="true" className="pointer-events-none absolute hidden sm:block" style={{ [decoration.side]: 0, bottom: `${decoration.bottomPercent}%`, width: `${decoration.widthPercent}%`, maxWidth: 240 }}><StoreArtwork {...decoration} alt="" className="w-full object-contain" /></div>)}
        </div>
      </section>

      {art.promos && art.promos.length > 0 && <section className="mx-auto grid max-w-6xl gap-6 px-4 py-12 sm:grid-cols-2 sm:px-6 lg:grid-cols-3" aria-label="Explore collections">{art.promos.map(promo => <Link key={promo.collectionSlug} href={`/collections/${promo.collectionSlug}`} className="group overflow-hidden rounded-3xl bg-accent/5"><StoreArtwork {...promo} className="aspect-[4/3] w-full object-cover transition-transform group-hover:scale-105" /><h2 className="p-6 text-xl font-semibold">{promo.title} <span aria-hidden="true">&rarr;</span></h2></Link>)}</section>}
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
            {art.featuredTitle ?? "Featured favorites"}
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
            Our first drop is getting ready. Check back soon.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
            {featured.map((p) => (
              <ProductCard
                key={p.id}
                product={{
                  badge: art.productBadges?.[p.slug],
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
      </section>

      {art.story && <section className="mx-auto grid max-w-6xl items-center gap-10 px-6 py-16 sm:grid-cols-2"><StoreArtwork {...art.story} className="aspect-square w-full rounded-3xl object-cover" /><div><h2 className="text-3xl font-semibold tracking-tight">{art.story.title}</h2><p className="mt-5 leading-relaxed text-muted">{art.story.text}</p></div></section>}
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
