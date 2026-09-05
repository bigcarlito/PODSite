"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getOrCreateCart } from "@/lib/cart";
import { requireCurrentStore } from "@/lib/store-context";

export async function addToCart(variantId: string, quantity: number = 1) {
  const store = await requireCurrentStore();

  const variant = await prisma.productVariant.findFirst({
    where: { id: variantId, storeId: store.id },
  });
  if (!variant) throw new Error("Variant not found for this store");

  const cart = await getOrCreateCart(store.id);

  await prisma.cartItem.upsert({
    where: { cartId_variantId: { cartId: cart.id, variantId } },
    update: { quantity: { increment: quantity } },
    create: { cartId: cart.id, variantId, quantity },
  });

  revalidatePath("/cart");
}

export async function updateCartItemQuantity(
  itemId: string,
  quantity: number
) {
  const store = await requireCurrentStore();
  const item = await prisma.cartItem.findFirst({
    where: { id: itemId, cart: { storeId: store.id } },
  });
  if (!item) return;

  if (quantity <= 0) {
    await prisma.cartItem.delete({ where: { id: itemId } });
  } else {
    await prisma.cartItem.update({
      where: { id: itemId },
      data: { quantity },
    });
  }
  revalidatePath("/cart");
}

export async function removeCartItem(itemId: string) {
  const store = await requireCurrentStore();
  const item = await prisma.cartItem.findFirst({
    where: { id: itemId, cart: { storeId: store.id } },
  });
  if (!item) return;

  await prisma.cartItem.delete({ where: { id: itemId } });
  revalidatePath("/cart");
}
