"use client";

import React, { useState } from "react";
import Link from "next/link";
import type { z } from "zod";
import type { mastheadSchema } from "../lib/storefront-theme";
import styles from "./BrandedMasthead.module.css";

type Artwork = { src: string; mobileSrc?: string; alt: string };
function ImageSlot({ image, fallback }: { image?: Artwork; fallback: string }) {
  const [failedSrc, setFailedSrc] = useState<string>();
  return image && failedSrc !== image.src ? <picture>{image.mobileSrc && <source media="(max-width: 639px)" srcSet={image.mobileSrc} />}<img src={image.src} alt={image.alt || fallback} onError={() => setFailedSrc(image.src)} /></picture> : <span className={styles.fallback}>{fallback}</span>;
}

function BenefitIcon({ index }: { index: number }) {
  const paths = ["m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z", "m8 3-5 4 3 4 2-1v11h8V10l2 1 3-4-5-4c-2 3-6 3-8 0Z", "M12 21 3.5 12.5C-2 6 6 0 12 7c6-7 14-1 8.5 5.5Z", "M5 5c-3 0-3 7 0 7s3-7 0-7Zm14 0c-3 0-3 7 0 7s3-7 0-7ZM12 12c-7 0-8 9-4 9l4-1 4 1c4 0 3-9-4-9Z"];
  return <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"><path d={paths[index]} /></svg>;
}

export function BrandedMasthead({ config: c, name, logoUrl, count }: { config: z.infer<typeof mastheadSchema>; name: string; logoUrl?: string; count: number }) {
  return <header className={styles.header}>
    <div className={styles.inner}>
      <nav aria-label="Main navigation" className={styles.nav}>
        <Link href="/products">Shop</Link><Link href="/about">About</Link>
        <Link href="/cart" aria-label={`Cart, ${count} item${count === 1 ? "" : "s"}`}>Cart <span aria-hidden="true">({count})</span></Link>
      </nav>
      <div className={styles.brand}>
        <figure className={styles.pet}><ImageSlot image={c.sami} fallback="Sami · portrait coming soon" /><figcaption>Sami</figcaption></figure>
        <div className={styles.identity}><Link href="/" aria-label={`${name} home`} className={styles.logo}><ImageSlot image={logoUrl ? { src: logoUrl, alt: name } : undefined} fallback={name} /></Link><p className={styles.tagline}>{c.tagline}</p></div>
        <figure className={styles.pet}><ImageSlot image={c.bogey} fallback="Bogey · portrait coming soon" /><figcaption>Bogey</figcaption></figure>
      </div>
      <ul className={styles.palette} aria-label="Brand palette, not garment color options">{c.palette.map((p, i) => <li key={i}><span aria-hidden="true" style={{ backgroundColor: p.color }} /><span>{p.label}</span></li>)}</ul>
      <ul className={styles.benefits} aria-label="Our shirt collection">{c.benefits.map((benefit, i) => <li key={i}><BenefitIcon index={i} /><span>{benefit}</span></li>)}</ul>
    </div>
  </header>;
}
