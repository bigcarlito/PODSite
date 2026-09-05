import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import { getCart, cartTotalCents } from "@/lib/cart";
import { getCurrentStore } from "@/lib/store-context";
import { formatCents } from "@/lib/money";
import { formatVariantOptions } from "@/lib/variant-label";
import { CheckoutForm } from "@/components/CheckoutForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Checkout" };

export default async function CheckoutPage() {
  const store = await getCurrentStore();
  if (!store) notFound();
  const cart = await getCart(store.id);
  if (!cart || cart.items.length === 0) {
    redirect("/cart");
  }

  const subtotal = cartTotalCents(cart.items);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
        Checkout
      </h1>

      <div className="mt-8 grid grid-cols-1 gap-10 lg:grid-cols-[1.2fr_1fr]">
        <CheckoutForm />

        <div className="order-first rounded-2xl border border-border p-5 lg:order-last lg:sticky lg:top-24 lg:self-start">
          <p className="text-sm font-semibold">Order Summary</p>
          <div className="mt-4 space-y-3">
            {cart.items.map((item) => (
              <div key={item.id} className="flex justify-between text-sm">
                <span className="text-muted">
                  {item.variant.product.title}{" "}
                  {formatVariantOptions(
                    item.variant.options as Record<string, string>
                  )}{" "}
                  × {item.quantity}
                </span>
                <span>
                  {formatCents(item.variant.priceCents * item.quantity)}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-4 flex justify-between border-t border-border pt-4 text-base font-semibold">
            <span>Subtotal</span>
            <span>{formatCents(subtotal)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
