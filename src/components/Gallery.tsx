"use client";

import Image from "next/image";
import { useState } from "react";

export function Gallery({
  images,
  title,
  activeOptionName,
  activeOptionValue,
}: {
  images: { url: string; altText?: string | null; optionValues?: Record<string, string> | null }[];
  title: string;
  activeOptionName?: string;
  activeOptionValue?: string;
}) {
  const [active, setActive] = useState(0);

  // Adjust `active` during render (not an effect) when the selected color
  // changes, per React's guidance for syncing state to a changed prop —
  // this still lets a manual thumbnail click (setActive below) take over
  // until the color changes again.
  const [trackedOptionValue, setTrackedOptionValue] = useState(activeOptionValue);
  if (activeOptionValue !== trackedOptionValue) {
    setTrackedOptionValue(activeOptionValue);
    if (activeOptionName && activeOptionValue) {
      const index = images.findIndex(
        (img) => img.optionValues?.[activeOptionName] === activeOptionValue
      );
      if (index !== -1) setActive(index);
    }
  }

  if (images.length === 0) {
    return (
      <div className="flex aspect-square w-full items-center justify-center rounded-2xl bg-gradient-to-br from-accent/20 to-accent/5 text-accent">
        {title}
      </div>
    );
  }

  return (
    <div>
      <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-black/5">
        <Image
          src={images[active].url}
          alt={images[active].altText ?? title}
          fill
          priority
          sizes="(min-width: 1024px) 50vw, 100vw"
          className="object-cover"
        />
      </div>

      {images.length > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {images.map((img, i) => (
            <button
              key={img.url}
              type="button"
              onClick={() => setActive(i)}
              className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border ${
                i === active ? "border-accent" : "border-border"
              }`}
              aria-label={`View image ${i + 1}`}
            >
              <Image
                src={img.url}
                alt=""
                fill
                sizes="64px"
                className="object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
