"use client";

import Image from "next/image";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatCents } from "@/lib/money";
import { removeCartItem, updateCartItemQuantity } from "@/app/cart/actions";

export type CartLine = {
  id: string;
  quantity: number;
  variant: {
    size?: string | null;
    color?: string | null;
    priceCents: number;
    currency: string;
    product: {
      title: string;
      slug: string;
      images: { url: string }[];
    };
  };
};

export function CartItemRow({ item }: { item: CartLine }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const image = item.variant.product.images[0]?.url;

  return (
    <div className="flex gap-4 border-b border-border py-5 first:pt-0 last:border-b-0">
      <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-black/5 sm:h-24 sm:w-24">
        {image ? (
          <Image src={image} alt="" fill sizes="96px" className="object-cover" />
        ) : (
          <div className="h-full w-full bg-accent/10" />
        )}
      </div>

      <div className="flex flex-1 flex-col justify-between">
        <div className="flex justify-between gap-2">
          <div>
            <p className="text-sm font-medium sm:text-base">
              {item.variant.product.title}
            </p>
            <p className="text-xs text-muted sm:text-sm">
              {[item.variant.color, item.variant.size].filter(Boolean).join(" / ")}
            </p>
          </div>
          <p className="shrink-0 text-sm font-medium sm:text-base">
            {formatCents(item.variant.priceCents * item.quantity, item.variant.currency)}
          </p>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center rounded-full border border-border">
            <button
              type="button"
              disabled={pending}
              className="flex h-8 w-8 items-center justify-center text-lg"
              onClick={() =>
                startTransition(async () => {
                  await updateCartItemQuantity(item.id, item.quantity - 1);
                  router.refresh();
                })
              }
            >
              −
            </button>
            <span className="w-6 text-center text-sm">{item.quantity}</span>
            <button
              type="button"
              disabled={pending}
              className="flex h-8 w-8 items-center justify-center text-lg"
              onClick={() =>
                startTransition(async () => {
                  await updateCartItemQuantity(item.id, item.quantity + 1);
                  router.refresh();
                })
              }
            >
              +
            </button>
          </div>

          <button
            type="button"
            disabled={pending}
            className="text-xs text-muted underline sm:text-sm"
            onClick={() =>
              startTransition(async () => {
                await removeCartItem(item.id);
                router.refresh();
              })
            }
          >
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}
