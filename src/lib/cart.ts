import "server-only";
import { cookies } from "next/headers";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";

const CART_COOKIE = "cart_token";

export async function getOrCreateCart(storeId: string) {
  const cookieStore = await cookies();
  let token = cookieStore.get(CART_COOKIE)?.value;

  if (token) {
    const existing = await prisma.cart.findUnique({ where: { token } });
    // Cookie may belong to a different store (shared apex domain, dev
    // ?store= override, etc.) — a mismatch means it's not this cart.
    if (existing && existing.storeId === storeId) return existing;
  }

  token = randomUUID();
  const cart = await prisma.cart.create({ data: { token, storeId } });
  cookieStore.set(CART_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
  return cart;
}

export async function getCart(storeId: string) {
  const cookieStore = await cookies();
  const token = cookieStore.get(CART_COOKIE)?.value;
  if (!token) return null;

  const cart = await prisma.cart.findUnique({
    where: { token },
    include: {
      items: {
        include: {
          variant: {
            include: {
              product: { include: { images: { orderBy: { position: "asc" } } } },
            },
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  return cart && cart.storeId === storeId ? cart : null;
}

export function cartTotalCents(
  items: { quantity: number; variant: { priceCents: number } }[]
) {
  return items.reduce((sum, i) => sum + i.quantity * i.variant.priceCents, 0);
}

export function cartItemCount(items: { quantity: number }[]) {
  return items.reduce((sum, i) => sum + i.quantity, 0);
}

/**
 * Clears a cart's items once its order has actually been paid for (see
 * the Stripe webhook) — deliberately not called at order-creation time,
 * so an abandoned checkout leaves the cart intact instead of silently
 * losing the customer's items.
 */
export async function clearCart(cartId: string) {
  await prisma.cartItem.deleteMany({ where: { cartId } });
}
