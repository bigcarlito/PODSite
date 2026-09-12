import "server-only";
import Stripe from "stripe";
import type { Store } from "@prisma/client";
import { StoreError } from "@/lib/store/errors";

/**
 * Resolves a Stripe client for a given store. Each store may supply its
 * own secret key (Store.stripeSecretKey) — clients are constructed per
 * call rather than shared singletons so credentials never leak across
 * stores, same pattern as src/lib/fulfillment/registry.ts for Printful
 * (AGENTS.md #6/#7).
 */
export function getStripeClient(store: Store): Stripe {
  const apiKey = store.stripeSecretKey?.trim() || process.env.STRIPE_SECRET_KEY;
  if (!apiKey) {
    throw new StoreError(
      "MISSING_PROVIDER_CREDENTIALS",
      "No Stripe secret key configured for this store.",
      { status: 422 }
    );
  }
  return new Stripe(apiKey);
}

/**
 * Resolves the webhook signing secret for a given store, falling back to
 * the platform default. Used by /api/webhooks/stripe to verify a delivery
 * actually came from Stripe before acting on it.
 */
export function getStripeWebhookSecret(store: Store): string {
  const secret = store.stripeWebhookSecret?.trim() || process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    throw new StoreError(
      "MISSING_PROVIDER_CREDENTIALS",
      "No Stripe webhook secret configured for this store.",
      { status: 422 }
    );
  }
  return secret;
}
