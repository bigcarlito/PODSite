import { matchesPaidOrder } from "@/lib/payments/checkout-validation";
import type Stripe from "stripe";
import { requireCurrentStore } from "@/lib/store-context";
import { getStripeClient, getStripeWebhookSecret } from "@/lib/payments/stripe";
import { getOrder, markOrderPaidAndFulfill } from "@/lib/store/orders";
import { clearCart } from "@/lib/cart";
import { StoreError } from "@/lib/store/errors";
import { originFromHeaders } from "@/lib/origin";

export const dynamic = "force-dynamic";

/**
 * Stripe calls this at the store's own hostname (each store points its own
 * Stripe webhook endpoint here, so the normal subdomain/domain resolution
 * in requireCurrentStore() already scopes this to the right store — same
 * as every other request). Verifies the signature with that store's own
 * webhook secret (falling back to the platform default) before acting on
 * anything, per AGENTS.md #7.
 */
export async function POST(request: Request) {
  const store = await requireCurrentStore();
  const payload = await request.text();
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return Response.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  const stripe = getStripeClient(store);
  const webhookSecret = getStripeWebhookSecret(store);

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch (err) {
    return Response.json(
      { error: `Invalid Stripe signature: ${(err as Error).message}` },
      { status: 400 }
    );
  }

  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.payment_status !== "paid") return Response.json({ received: true });
    if (session.metadata?.storeId !== store.id) return Response.json({ error: { code: "STORE_MISMATCH", message: "Payment tenant mismatch" } }, { status: 400 });
    const orderId = session.metadata?.orderId;
    const cartId = session.metadata?.cartId;

    if (orderId) {
      try {
        const order = await getOrder(store.id, orderId);
        if (!matchesPaidOrder(session, { ...order, currency: "USD" })) {
          return Response.json({ error: { code: "PAYMENT_MISMATCH", message: "Payment total or currency does not match the order" } }, { status: 400 });
        }
        // Marks the order paid and immediately attempts to submit it to
        // fulfillment — a fulfillment failure is logged as activity, not
        // thrown here, since the payment itself already succeeded (see
        // markOrderPaidAndFulfill).
        await markOrderPaidAndFulfill(store, orderId, originFromHeaders(request.headers), "system");
        if (cartId) await clearCart(store.id, cartId);
      } catch (err) {
        // A duplicate webhook delivery for an order already marked paid is
        // not an error — Stripe retries deliveries it doesn't get a 2xx
        // for, so treat "already paid" as a no-op success rather than
        // failing (which would just cause more retries).
        if (err instanceof StoreError && err.code === "INVALID_STATUS") {
          if (cartId) await clearCart(store.id, cartId);
        } else {
          throw err;
        }
      }
    }
  }

  return Response.json({ received: true });
}
