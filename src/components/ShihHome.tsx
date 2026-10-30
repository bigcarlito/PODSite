import Link from "next/link";
import { StoreArtwork } from "./StoreArtwork";
import { formatCents } from "@/lib/money";
import type { StoreBranding } from "@/lib/store-branding";
import { shihStorefront } from "@/lib/shih-storefront";

export function BenefitIcon({ kind }: { kind: number }) {
  if (kind === 4) return <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M3 8h25v28H3zM28 19h10l7 9v8H28zM31 20v10h13"/><circle cx="12" cy="37" r="5" fill="var(--background)"/><circle cx="36" cy="37" r="5" fill="var(--background)"/></svg>;
  return <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    {kind % 4 === 0 ? <g fill="currentColor" stroke="none"><ellipse cx="13" cy="13" rx="5" ry="7" transform="rotate(-25 13 13)"/><ellipse cx="24" cy="9" rx="5" ry="7"/><ellipse cx="35" cy="14" rx="5" ry="7" transform="rotate(25 35 14)"/><ellipse cx="7" cy="25" rx="4" ry="6"/><path d="M13 35c0-8 7-15 12-15s13 8 13 15c0 11-10 4-13 4s-12 7-12-4"/></g> : kind % 4 === 1 ? <path d="M24 41 6 23C-5 8 15-2 24 12 33-2 53 8 42 23Z"/> : kind % 4 === 2 ? <><path d="M7 20h34v23H7zM4 13h40v8H4zM21 13v30M27 13v30"/><path d="M24 13C3 16 13-7 24 13c11-20 21 3 0 0Z"/></> : <><circle cx="24" cy="24" r="20"/><path d="M13 27q11 16 22 0"/><circle cx="17" cy="18" r="1"/><circle cx="31" cy="18" r="1"/></>}
  </svg>;
}

type Product = { id: string; slug: string; title: string; images: { url: string }[]; variants: { priceCents: number; currency: string; options: unknown }[] };
const colors: Record<string, string> = { cream: "#f7e8cf", ivory: "#f7e8cf", peach: "#f69a80", pink: "#f4bcb0", sage: "#899174", green: "#899174", espresso: "#48291d", brown: "#48291d", black: "#252321", white: "#fff", yellow: "#ffcd55" };

export function ShihHome({ branding, products }: { branding: StoreBranding; products: Product[] }) {
  const art = branding.storefront;
  const hero = art.hero ?? (branding.theme.heroImageUrl ? { src: branding.theme.heroImageUrl, alt: "" } : undefined);
  return <div className="shih-home">
    <section className="shih-image-strip" aria-label="Meet the personalities">
      <div className="shih-main-art">{hero ? <StoreArtwork {...hero} className="shih-cover" /> : <ArtworkPlaceholder label="Walk time. Their way." />}</div>
      <div className="shih-side-art">{art.promos?.[0] ? <StoreArtwork {...art.promos[0]} className="shih-cover" /> : <ArtworkPlaceholder label="Walk? I thought you said carry." />}</div>
      <div className="shih-side-art">{art.story ? <StoreArtwork {...art.story} className="shih-cover" /> : <ArtworkPlaceholder label="Different personalities. Same big attitude." />}</div>
    </section>
    <section className="shih-benefits" aria-label="Why shop with us">{branding.trustBadges.map((badge, i) => <div key={badge}><BenefitIcon kind={i}/><span>{badge}</span></div>)}</section>
    <section className="shih-collection" aria-labelledby="shih-collection-title">
      <div className="shih-section-heading"><h1 id="shih-collection-title">{art.featuredTitle}</h1><p>{art.featuredSubtitle ?? branding.description}</p></div>
      <div className="shih-product-grid">{products.length ? products.map(product => {
        const variant = product.variants[0];
        const colorNames = [...new Set(product.variants.flatMap(v => { const opts = v.options as Record<string, string> | null; const color = opts && Object.entries(opts).find(([key]) => key.toLowerCase() === "color")?.[1]; return color ? [color] : []; }))].slice(0, 4);
        return <article className="shih-product" key={product.id}><Link href={`/products/${product.slug}`} className="shih-product-image" aria-label={product.title}>{product.images[0] ? <StoreArtwork src={product.images[0].url} alt={product.title} className="shih-cover"/> : <ArtworkPlaceholder label={product.title}/>}</Link><div className="shih-product-detail"><h2><Link href={`/products/${product.slug}`}>{product.title}</Link></h2>{variant && <p className="shih-price">{formatCents(variant.priceCents, variant.currency)}</p>}<div className="shih-swatches" aria-label="Available colors">{colorNames.map(color => <span key={color} title={color} aria-label={color} style={{ background: colors[color.toLowerCase()] ?? "#d7cbbd" }}/>)}</div><Link href={`/products/${product.slug}`} className="shih-button">View Product</Link></div></article>;
      }) : Array.from({length: 6}, (_, i) => <article className="shih-product" key={i}><div className="shih-product-image shih-tee-preview"><ShirtPlaceholder index={i}/></div><div className="shih-placeholder-detail"><h2>New design coming soon</h2><p>Design preview</p><Link href="/products" className="shih-button">Explore Shirts</Link></div></article>)}</div>
      <Link href="/products" className="shih-button shih-desktop-shop">{art.shopLabel} <span aria-hidden="true">→</span></Link>
    </section>
    <section className="shih-mobile-story">{art.story ? <StoreArtwork {...art.story} className="shih-cover"/> : <ArtworkPlaceholder label="Different personalities. Same big attitude."/>}<Link href="/products" className="shih-button">{art.shopLabel} <span aria-hidden="true">→</span></Link></section>
    <section className="shih-closing-benefits" aria-label="Made for dog people">{shihStorefront.closingBadges.map((badge, i) => <div key={badge}><BenefitIcon kind={[4, 1, 2][i]}/><span>{badge}</span></div>)}</section>
  </div>;
}

export function ArtworkPlaceholder({ label }: { label: string }) {
  return <div className="shih-art-placeholder"><BenefitIcon kind={0}/><span>{label}</span><small>Image coming soon</small></div>;
}

function ShirtPlaceholder({ index }: { index: number }) {
  const fills = ["#fff1d9", "#f5a084", "#929d78", "#593a2a", "#f3beb5", "#f7c859"];
  return <svg viewBox="0 0 260 320" role="img" aria-label="T-shirt artwork placeholder">
    <path d="M82 19 38 34 5 96 48 118 64 88 56 303Q130 311 204 303L196 88 212 118 255 96 222 34 178 19Q130 36 82 19Z" fill={fills[index % fills.length]} stroke="#382417" strokeOpacity=".1" strokeWidth="2"/>
    <path d="M96 23Q130 65 164 23M65 88 70 45M196 88 190 45" fill="none" stroke="#382417" strokeOpacity=".12" strokeWidth="3"/>
    <g fill={index === 3 ? "#fff1d9" : "#382417"} opacity=".35"><ellipse cx="111" cy="132" rx="9" ry="12" transform="rotate(-20 111 132)"/><ellipse cx="133" cy="125" rx="9" ry="12"/><ellipse cx="153" cy="135" rx="9" ry="12" transform="rotate(20 153 135)"/><path d="M109 166q0-20 23-24 24 6 24 24t-24 10q-23 12-23-10Z"/></g>
    <text x="130" y="214" textAnchor="middle" fill={index === 3 ? "#fff1d9" : "#382417"} fontFamily="sans-serif" fontSize="12" letterSpacing="2">DESIGN COMING SOON</text>
  </svg>;
}
