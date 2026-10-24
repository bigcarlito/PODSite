export function StoreArtwork({ src, mobileSrc, alt, className = "" }: { src: string; mobileSrc?: string; alt: string; className?: string }) {
  return <picture>{mobileSrc && <source media="(max-width: 639px)" srcSet={mobileSrc} />}<img src={src} alt={alt} className={className} /></picture>;
}
