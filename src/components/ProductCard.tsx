import Image from "next/image";
import Link from "next/link";
import { formatCents } from "@/lib/money";

export type ProductCardData = {
  slug: string;
  title: string;
  imageUrl?: string | null;
  priceCents: number;
  currency?: string;
  compareAtCents?: number | null;
};

export function ProductCard({ product }: { product: ProductCardData }) {
  return (
    <Link href={`/products/${product.slug}`} className="group block">
      <div className="relative aspect-[4/5] w-full overflow-hidden rounded-2xl bg-black/5">
        {product.imageUrl ? (
          <Image
            src={product.imageUrl}
            alt={product.title}
            fill
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-accent/20 to-accent/5 text-accent">
            <span className="text-sm font-medium">{product.title}</span>
          </div>
        )}
        {product.compareAtCents && product.compareAtCents > product.priceCents && (
          <span className="absolute left-3 top-3 rounded-full bg-accent px-2.5 py-1 text-xs font-semibold text-white">
            Sale
          </span>
        )}
      </div>
      <div className="mt-3 space-y-1">
        <h3 className="text-sm font-medium sm:text-base">{product.title}</h3>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted sm:text-base">
            {formatCents(product.priceCents, product.currency)}
          </span>
          {product.compareAtCents && product.compareAtCents > product.priceCents && (
            <span className="text-sm text-muted line-through">
              {formatCents(product.compareAtCents, product.currency)}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
