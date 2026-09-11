"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getCart, cartTotalCents } from "@/lib/cart";
import { formatVariantOptions } from "@/lib/variant-label";
import { requireCurrentStore } from "@/lib/store-context";
import { createPendingOrder } from "@/lib/store/orders";
import { getStripeClient } from "@/lib/payments/stripe";
import { originFromHeaders } from "@/lib/origin";

export type CheckoutState = {
  error?: string;
};

export async function placeOrder(
  _prevState: CheckoutState,
  formData: FormData
): Promise<CheckoutState> {
  const store = await requireCurrentStore();
  const cart = await getCart(store.id);
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

  const order = await createPendingOrder(
    store.id,
    store.slug,
    cart,
    {
      email,
      shippingName,
      shippingAddress1,
      shippingAddress2,
      shippingCity,
      shippingState,
      shippingZip,
      shippingCountry,
    },
    subtotalCents
  );

  let sessionUrl: string | null;
  try {
    const stripe = getStripeClient(store);
    const origin = originFromHeaders(await headers());
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: email,
      line_items: cart.items.map((item) => ({
        price_data: {
          currency: "usd",
          product_data: {
            name: `${item.variant.product.title} — ${formatVariantOptions(
              item.variant.options as Record<string, string>
            )}`,
          },
          unit_amount: item.variant.priceCents,
        },
        quantity: item.quantity,
      })),
      metadata: { orderId: order.id, storeId: store.id, cartId: cart.id },
      success_url: `${origin}/checkout/confirmation/${order.orderNumber}`,
      cancel_url: `${origin}/checkout`,
    });
    sessionUrl = session.url;
  } catch {
    return {
      error:
        "We couldn't start payment for your order. Please try again in a moment.",
    };
  }

  if (!sessionUrl) {
    return {
      error:
        "We couldn't start payment for your order. Please try again in a moment.",
    };
  }

  redirect(sessionUrl);
}
