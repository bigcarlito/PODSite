import type { Metadata } from "next";
import Link from "next/link";
import { getCart, cartTotalCents } from "@/lib/cart";
import { CartItemRow } from "@/components/CartItemRow";
import { formatCents } from "@/lib/money";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Your Cart" };

export default async function CartPage() {
  const cart = await getCart();
  const items = cart?.items ?? [];
  const subtotal = cartTotalCents(items);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
        Your Cart
      </h1>

      {items.length === 0 ? (
        <div className="mt-10 text-center">
          <p className="text-sm text-muted">Your cart is empty.</p>
          <Link
            href="/products"
            className="mt-4 inline-block rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white hover:bg-accent-dark"
          >
            Continue Shopping
          </Link>
        </div>
      ) : (
        <>
          <div className="mt-6 divide-y divide-border">
            {items.map((item) => (
              <CartItemRow key={item.id} item={item} />
            ))}
          </div>

          <div className="mt-6 space-y-4 border-t border-border pt-6">
            <div className="flex items-center justify-between text-base font-medium">
              <span>Subtotal</span>
              <span>{formatCents(subtotal)}</span>
            </div>
            <p className="text-xs text-muted">
              Shipping and taxes calculated at checkout.
            </p>
            <Link
              href="/checkout"
              className="block w-full rounded-full bg-accent py-3.5 text-center text-sm font-semibold text-white hover:bg-accent-dark sm:text-base"
            >
              Checkout
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
