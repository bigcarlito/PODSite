"use client";

import React, { useState } from "react";
import Link from "next/link";
import type { z } from "zod";
import type { boutiqueSchema, storefrontSchema } from "@/lib/storefront-theme";
import { formatCents } from "@/lib/money";
import styles from "./BoutiqueHome.module.css";

type Artwork = { src: string; mobileSrc?: string; alt: string };
export type BoutiqueProduct = { slug: string; title: string; imageUrl?: string | null; secondaryImageUrl?: string | null; priceCents?: number; currency?: string };
export function BoutiqueImage({ image, fallback }: { image?: Artwork; fallback: string }) {
  const [failed, setFailed] = useState(false);
  return image && !failed ? <picture>{image.mobileSrc && <source media="(max-width: 639px)" srcSet={image.mobileSrc} />}<img src={image.src} alt={image.alt} onError={() => setFailed(true)} /></picture> : <div className={styles.placeholder}><p>{fallback}</p></div>;
}

export function BoutiqueHome({ config: c, artwork: a, products, preview }: { config: z.infer<typeof boutiqueSchema>; artwork: z.infer<typeof storefrontSchema>; products: BoutiqueProduct[]; preview?: BoutiqueProduct }) {
  const s = c.sections;
  const lead = products.find(p => p.imageUrl) ?? preview ?? products[0];
  const comingSoon = lead === preview && !!preview;
  const photo = (p: BoutiqueProduct | undefined, secondary = false) => {
    const src = secondary ? p?.secondaryImageUrl ?? p?.imageUrl : p?.imageUrl;
    return src ? { src, alt: `${p?.title}${secondary ? " — another view of the same design" : ""}` } : undefined;
  };
  const button = (label: string) => <Link className={styles.button} href="#collection">{label}<span aria-hidden="true"> →</span></Link>;
  return <div className={styles.home}>
    {s.hero && <section className={styles.hero} aria-labelledby="boutique-title"><div><p className={styles.eyebrow}>{a.eyebrow ?? "Tees for little-dog people"}</p><h1 id="boutique-title">{c.heroTitle}</h1><p className={styles.intro}>{c.heroText}</p>{button(a.shopLabel ?? "Shop the collection")}{comingSoon && <p className={styles.status}>Coming Soon · {lead.title} · Not available to purchase</p>}</div><div className={styles.heroArt}><BoutiqueImage image={photo(lead)} fallback="Our first tees are getting ready. Product photography coming soon." /></div></section>}
    <section id="collection" className={styles.section} aria-labelledby="featured-title"><div className={styles.heading}><h2 id="featured-title">{a.featuredTitle ?? "Shop the collection"}</h2></div>{products.length ? <div className={styles.products}>{products.map(p => <Link className={styles.product} key={p.slug} href={`/products/${p.slug}`}><div className={styles.productImage}><BoutiqueImage image={photo(p)} fallback="Product photo coming soon" /></div><h3>{p.title}</h3>{p.priceCents !== undefined && p.currency ? <p>From {formatCents(p.priceCents, p.currency)}</p> : <p>Pricing coming soon</p>}</Link>)}</div> : <p className={styles.empty}>{c.emptyText}</p>}
      {preview && <article className={styles.preview} aria-labelledby="preview-title"><div className={styles.productImage}><BoutiqueImage image={photo(preview)} fallback="Preview photography coming soon" /></div><div><p className={styles.eyebrow}>Coming Soon</p><h3 id="preview-title">{preview.title}</h3><p>A preview of one design. Not available to purchase.</p></div></article>}
    </section>
    {s.personality && lead && <section className={`${styles.section} ${styles.merchandising}`} aria-labelledby="personality-title"><div className={styles.productImage}><BoutiqueImage image={photo(lead, true)} fallback="Product photography coming soon" /></div><div><p className={styles.eyebrow}>{lead.title}{comingSoon ? " · Coming Soon" : ""}</p><h2 id="personality-title">{c.personalityTitle}</h2><p>{c.personalityText}</p><p>Another look at the same design.</p>{comingSoon ? <p>Not available to purchase.</p> : <Link href={`/products/${lead.slug}`}>Explore {lead.title} →</Link>}</div></section>}
    {s.values && <section className={styles.benefits} aria-labelledby="values-title"><h2 id="values-title">{c.valueTitle}</h2><div className={styles.values}>{c.values.map((v, i) => <div key={i}><h3>{v.title}</h3><p>{v.text}</p></div>)}</div></section>}
    {s.mascots && <aside className={styles.note}><p>{c.mascotsTitle}: {c.samiText} {c.bogeyText}</p></aside>}
    {s.final && <section className={styles.final}><h2>{c.finalTitle}</h2><p>{c.finalText}</p>{button(c.finalLabel)}</section>}
  </div>;
}

