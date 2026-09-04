"use server";

import { redirect } from "next/navigation";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { getCart, cartTotalCents } from "@/lib/cart";
import { cookies } from "next/headers";

export type CheckoutState = {
  error?: string;
};

export async function placeOrder(
  _prevState: CheckoutState,
  formData: FormData
): Promise<CheckoutState> {
  const cart = await getCart();
  if (!cart || cart.items.length === 0) {
    return { error: "Your cart is empty." };
  }

  const email = String(formData.get("email") ?? "").trim();
  const shippingName = String(formData.get("name") ?? "").trim();
  const shippingAddress1 = String(formData.get("address1") ?? "").trim();
  const shippingAddress2 = String(formData.get("address2") ?? "").trim();
  const shippingCity = String(formData.get("city") ?? "").trim();
  const shippingState = String(formData.get("state") ?? "").trim();
  const shippingZip = String(formData.get("zip") ?? "").trim();
  const shippingCountry = String(formData.get("country") ?? "US").trim();

  if (
    !email ||
    !shippingName ||
    !shippingAddress1 ||
    !shippingCity ||
    !shippingState ||
    !shippingZip
  ) {
    return { error: "Please fill in all required fields." };
  }

  const subtotalCents = cartTotalCents(cart.items);
  const orderNumber = `WL-${Date.now().toString(36).toUpperCase()}`;

  const order = await prisma.order.create({
    data: {
      orderNumber,
      email,
      shippingName,
      shippingAddress1,
      shippingAddress2: shippingAddress2 || null,
      shippingCity,
      shippingState,
      shippingZip,
      shippingCountry,
      subtotalCents,
      status: "PENDING_PAYMENT",
      items: {
        create: cart.items.map((item) => ({
          variantId: item.variantId,
          quantity: item.quantity,
          priceCents: item.variant.priceCents,
          productName: item.variant.product.title,
          variantName: [item.variant.color, item.variant.size]
            .filter(Boolean)
            .join(" / "),
        })),
      },
    },
  });

  await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });

  const cookieStore = await cookies();
  cookieStore.set("cart_token", randomUUID(), {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });

  redirect(`/checkout/confirmation/${order.orderNumber}`);
}
