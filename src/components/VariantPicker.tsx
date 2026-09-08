"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
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
  colorSwatches,
  onOptionChange,
}: {
  optionNames: string[];
  variants: VariantOption[];
  colorSwatches?: Record<string, string>;
  onOptionChange?: (name: string, value: string) => void;
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

  useEffect(() => {
    for (const [name, value] of Object.entries(selection)) {
      onOptionChange?.(name, value);
    }
    // Sync the initial default selection to the parent once on mount;
    // subsequent changes are reported directly from each option's onClick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        const isColor = name.toLowerCase().includes("color");
        return (
          <div key={name}>
            <p className="mb-2 text-sm font-medium">{humanize(name)}</p>
            <div className="flex flex-wrap gap-2">
              {values.map((value) => {
                const isSelected = selection[name] === value;
                if (!isColor) {
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => {
                        setSelection((prev) => ({ ...prev, [name]: value }));
                        onOptionChange?.(name, value);
                      }}
                      className={`min-w-11 rounded-full border px-4 py-2 text-sm transition-colors ${
                        isSelected
                          ? "border-accent bg-accent text-white"
                          : "border-border hover:border-accent"
                      }`}
                    >
                      {value}
                    </button>
                  );
                }
                return (
                  <button
                    key={value}
                    type="button"
                    title={value}
                    aria-label={value}
                    aria-pressed={isSelected}
                    onClick={() => {
                      setSelection((prev) => ({ ...prev, [name]: value }));
                      onOptionChange?.(name, value);
                    }}
                    className={`relative h-9 w-9 rounded-full border-2 transition-all ${
                      isSelected
                        ? "border-white ring-2 ring-accent ring-offset-2 ring-offset-background"
                        : "border-border hover:border-accent"
                    }`}
                  >
                    <span
                      className="absolute inset-0 rounded-full"
                      style={{ backgroundColor: colorSwatches?.[value] ?? value.toLowerCase() }}
                    />
                    {isSelected && (
                      <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-accent ring-2 ring-white">
                        <svg viewBox="0 0 20 20" fill="none" className="h-2.5 w-2.5">
                          <path
                            d="M5 10l3 3 7-7"
                            stroke="white"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </span>
                    )}
                  </button>
                );
              })}
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
