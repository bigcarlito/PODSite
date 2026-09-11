"use client";

import { useMemo, useState } from "react";
import { Gallery } from "./Gallery";
import { VariantPicker, type VariantOption } from "./VariantPicker";

export function ProductPurchasePanel({
  title,
  description,
  images,
  optionNames,
  variants,
  colorSwatches,
}: {
  title: string;
  description: string;
  images: { url: string; altText?: string | null; optionValues?: Record<string, string> | null }[];
  optionNames: string[];
  variants: VariantOption[];
  colorSwatches?: Record<string, string>;
}) {
  const colorOptionName = useMemo(
    () => optionNames.find((name) => name.toLowerCase().includes("color")),
    [optionNames]
  );
  const [selectedColor, setSelectedColor] = useState<string | undefined>();

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-12">
      <Gallery
        images={images}
        title={title}
        activeOptionName={colorOptionName}
        activeOptionValue={selectedColor}
      />

      <div className="lg:sticky lg:top-24 lg:self-start">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>

        <div className="mt-6">
          <VariantPicker
            optionNames={optionNames}
            variants={variants}
            colorSwatches={colorSwatches}
            onOptionChange={(name, value) => {
              if (name === colorOptionName) setSelectedColor(value);
            }}
          />
        </div>

        <div className="mt-8 border-t border-border pt-6">
          <p className="text-sm font-medium">Description</p>
          <p className="mt-2 whitespace-pre-line text-sm text-muted">{description}</p>
        </div>
      </div>
    </div>
  );
}
