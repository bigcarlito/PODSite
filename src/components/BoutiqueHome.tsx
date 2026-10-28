"use client";

import { useState } from "react";
import Link from "next/link";
import type { z } from "zod";
import type { boutiqueSchema, storefrontSchema } from "@/lib/storefront-theme";
import { formatCents } from "@/lib/money";
import type { ProductCardData } from "./ProductCard";
import styles from "./BoutiqueHome.module.css";

type Artwork = { src: string; mobileSrc?: string; alt: string };
export function BoutiqueImage({ image, fallback }: { image?: Artwork; fallback: string }) {
  const [failed, setFailed] = useState(false);
  return image && !failed ? <picture>{image.mobileSrc && <source media="(max-width: 639px)" srcSet={image.mobileSrc} />}<img src={image.src} alt={image.alt} onError={() => setFailed(true)} /></picture> : <div className={styles.placeholder}><span aria-hidden="true">✦</span><p>{fallback}</p></div>;
}

export function BoutiqueHome({ config: c, artwork: a, products }: { config: z.infer<typeof boutiqueSchema>; artwork: z.infer<typeof storefrontSchema>; products: ProductCardData[] }) {
  const s = c.sections;
  const button = (label: string) => <Link className={styles.button} href="/products">{label}<span aria-hidden="true"> ↗</span></Link>;
  return <div className={styles.home}>
    {s.hero && <section className={styles.hero} aria-labelledby="boutique-title"><div><p className={styles.eyebrow}>{a.eyebrow ?? "For the love of little dogs"}</p><h1 id="boutique-title">{c.heroTitle}</h1><p className={styles.intro}>{c.heroText}</p>{button(a.shopLabel ?? "Shop the Collection")}</div><div className={styles.heroArt}><BoutiqueImage image={a.hero} fallback="A little space for a big personality. Approved campaign photography coming soon." /></div></section>}
    {s.featured && <section className={styles.section} aria-labelledby="featured-title"><div className={styles.heading}><h2 id="featured-title">{a.featuredTitle ?? "Little dogs. Good taste."}</h2></div>{products.length ? <div className={styles.products}>{products.map(p => <Link className={styles.product} key={p.slug} href={`/products/${p.slug}`}><div className={styles.productImage}><BoutiqueImage image={p.imageUrl ? { src: p.imageUrl, alt: p.title } : undefined} fallback="Product photo coming soon" /></div><h3>{p.title}</h3><p>{formatCents(p.priceCents, p.currency)}</p></Link>)}</div> : <p className={styles.empty}>{c.emptyText}</p>}</section>}
    {s.personality && <section className={styles.personality}><span aria-hidden="true">✳</span><h2>{c.personalityTitle}</h2><p>{c.personalityText}</p></section>}
    {s.mascots && <section className={styles.section} aria-labelledby="mascots-title"><h2 id="mascots-title">{c.mascotsTitle}</h2><div className={styles.mascots}>{[{ name: "Sami", image: c.sami, text: c.samiText }, { name: "Bogey", image: c.bogey, text: c.bogeyText }].map(m => <figure key={m.name}><div className={styles.portrait}><BoutiqueImage image={m.image} fallback={`${m.name}’s portrait is coming soon`} /></div><figcaption>{m.text}</figcaption></figure>)}</div></section>}
    {s.values && <section className={styles.section} aria-labelledby="values-title"><h2 id="values-title">{c.valueTitle}</h2><div className={styles.values}>{c.values.map((v, i) => <div key={i}><p className={styles.eyebrow}>0{i + 1}</p><h3>{v.title}</h3><p>{v.text}</p></div>)}</div></section>}
    {s.final && <section className={styles.final}><h2>{c.finalTitle}</h2><p>{c.finalText}</p>{button(c.finalLabel)}</section>}
  </div>;
}
