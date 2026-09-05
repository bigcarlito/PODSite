"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatCents } from "@/lib/money";
import { addToCart } from "@/app/cart/actions";

export type VariantOption = {
  id: string;
  options: Record<string, string>;
  priceCents: number;
  currency: string;
  inStock: boolean;
};

function humanize(optionName: string) {
  return optionName
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (c) => c.toUpperCase());
}

export function VariantPicker({
  optionNames,
  variants,
}: {
  optionNames: string[];
  variants: VariantOption[];
}) {
  const valuesByOption = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const name of optionNames) {
      map.set(
        name,
        Array.from(new Set(variants.map((v) => v.options[name]).filter(Boolean)))
      );
    }
    return map;
  }, [optionNames, variants]);

  const [selection, setSelection] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const name of optionNames) {
      const first = valuesByOption.get(name)?.[0];
      if (first) initial[name] = first;
    }
    return initial;
  });
  const [added, setAdded] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const selected = variants.find((v) =>
    optionNames.every((name) => v.options[name] === selection[name])
  );

  return (
    <div className="space-y-6">
      <p className="text-2xl font-semibold">
        {selected ? formatCents(selected.priceCents, selected.currency) : "—"}
      </p>

      {optionNames.map((name) => {
        const values = valuesByOption.get(name) ?? [];
        if (values.length === 0) return null;
        return (
          <div key={name}>
            <p className="mb-2 text-sm font-medium">{humanize(name)}</p>
            <div className="flex flex-wrap gap-2">
              {values.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() =>
                    setSelection((prev) => ({ ...prev, [name]: value }))
                  }
                  className={`min-w-11 rounded-full border px-4 py-2 text-sm transition-colors ${
                    selection[name] === value
                      ? "border-accent bg-accent text-white"
                      : "border-border hover:border-accent"
                  }`}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>
        );
      })}

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
