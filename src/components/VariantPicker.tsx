"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatCents } from "@/lib/money";
import { addToCart } from "@/app/cart/actions";

export type VariantOption = {
  id: string;
  size?: string | null;
  color?: string | null;
  priceCents: number;
  currency: string;
  inStock: boolean;
};

export function VariantPicker({ variants }: { variants: VariantOption[] }) {
  const sizes = useMemo(
    () => Array.from(new Set(variants.map((v) => v.size).filter(Boolean))) as string[],
    [variants]
  );
  const colors = useMemo(
    () => Array.from(new Set(variants.map((v) => v.color).filter(Boolean))) as string[],
    [variants]
  );

  const [size, setSize] = useState<string | undefined>(sizes[0]);
  const [color, setColor] = useState<string | undefined>(colors[0]);
  const [added, setAdded] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const selected = variants.find(
    (v) => (sizes.length === 0 || v.size === size) && (colors.length === 0 || v.color === color)
  );

  return (
    <div className="space-y-6">
      <p className="text-2xl font-semibold">
        {selected ? formatCents(selected.priceCents, selected.currency) : "—"}
      </p>

      {colors.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-medium">Color</p>
          <div className="flex flex-wrap gap-2">
            {colors.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`rounded-full border px-4 py-2 text-sm transition-colors ${
                  color === c
                    ? "border-accent bg-accent text-white"
                    : "border-border hover:border-accent"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      )}

      {sizes.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-medium">Size</p>
          <div className="flex flex-wrap gap-2">
            {sizes.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSize(s)}
                className={`min-w-11 rounded-full border px-4 py-2 text-sm transition-colors ${
                  size === s
                    ? "border-accent bg-accent text-white"
                    : "border-border hover:border-accent"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      <button
        type="button"
        disabled={!selected || !selected.inStock || pending}
        onClick={() => {
          if (!selected) return;
          startTransition(async () => {
            await addToCart(selected.id, 1);
            setAdded(true);
            router.refresh();
          });
        }}
        className="w-full rounded-full bg-accent py-3.5 text-sm font-semibold text-white transition-colors hover:bg-accent-dark disabled:cursor-not-allowed disabled:opacity-50 sm:text-base"
      >
        {!selected
          ? "Select options"
          : !selected.inStock
          ? "Out of stock"
          : pending
          ? "Adding..."
          : added
          ? "Added to cart ✓"
          : "Add to Cart"}
      </button>
    </div>
  );
}
