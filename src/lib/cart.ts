import "server-only";
import { cookies } from "next/headers";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";

const CART_COOKIE = "cart_token";

export async function getOrCreateCart() {
  const cookieStore = await cookies();
  let token = cookieStore.get(CART_COOKIE)?.value;

  if (token) {
    const existing = await prisma.cart.findUnique({ where: { token } });
    if (existing) return existing;
  }

  token = randomUUID();
  const cart = await prisma.cart.create({ data: { token } });
  cookieStore.set(CART_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
  return cart;
}

export async function getCart() {
  const cookieStore = await cookies();
  const token = cookieStore.get(CART_COOKIE)?.value;
  if (!token) return null;

  return prisma.cart.findUnique({
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
}

export function cartTotalCents(
  items: { quantity: number; variant: { priceCents: number } }[]
) {
  return items.reduce((sum, i) => sum + i.quantity * i.variant.priceCents, 0);
}

export function cartItemCount(items: { quantity: number }[]) {
  return items.reduce((sum, i) => sum + i.quantity, 0);
}
