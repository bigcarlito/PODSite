import type Stripe from "stripe";
import { requireCurrentStore } from "@/lib/store-context";
import { getStripeClient, getStripeWebhookSecret } from "@/lib/payments/stripe";
import { markOrderPaid } from "@/lib/store/orders";
import { clearCart } from "@/lib/cart";
import { StoreError } from "@/lib/store/errors";

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

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const orderId = session.metadata?.orderId;
    const cartId = session.metadata?.cartId;

    if (orderId) {
      try {
        await markOrderPaid(store.id, orderId, "system");
        if (cartId) await clearCart(cartId);
      } catch (err) {
        // A duplicate webhook delivery for an order already marked paid is
        // not an error — Stripe retries deliveries it doesn't get a 2xx
        // for, so treat "already paid" as a no-op success rather than
        // failing (which would just cause more retries).
        if (!(err instanceof StoreError && err.code === "INVALID_STATUS")) {
          throw err;
        }
      }
    }
  }

  return Response.json({ received: true });
}
