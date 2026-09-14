import "server-only";
import { prisma } from "@/lib/prisma";
import { logActivity, type ActivityActor } from "./activity";
import type { ShippingRateUpsertInput } from "./schemas";

export function listShippingRates(storeId: string) {
  return prisma.shippingRate.findMany({
    where: { storeId },
    orderBy: { productType: "asc" },
  });
}

export function getShippingRate(storeId: string, productType: string) {
  return prisma.shippingRate.findUnique({
    where: { storeId_productType: { storeId, productType } },
  });
}

/**
 * Sets (creating or replacing) the shipping rate for one productType on
 * this store — productType "default" is the fallback used for any type
 * with no row of its own (see ShippingRate in schema.prisma).
 */
export async function setShippingRate(
  storeId: string,
  productType: string,
  input: ShippingRateUpsertInput,
  actor: ActivityActor
) {
  const rate = await prisma.shippingRate.upsert({
    where: { storeId_productType: { storeId, productType } },
    update: input,
    create: { storeId, productType, ...input },
  });

  await logActivity(storeId, {
    actor,
    category: "shipping",
    summary: `Set shipping rate for "${productType}": ${input.baseCents}¢ first item, ${input.additionalItemCents}¢ each additional`,
    details: { productType, ...input },
  });

  return rate;
}

/** Whether this store has configured any shipping rate at all — the
 * signal GET /api/agent/summary uses to flag a store that would
 * otherwise ship for free indefinitely without anyone noticing. */
export async function hasAnyShippingRate(storeId: string): Promise<boolean> {
  const count = await prisma.shippingRate.count({ where: { storeId } });
  return count > 0;
}

type ShippableCartItem = {
  quantity: number;
  variant: { product: { productType: string | null } };
};

/**
 * Groups cart items by Product.productType (null falls into the
 * "default" bucket, same as a type with no row of its own), charges each
 * group's own rate — baseCents for the first unit + additionalItemCents
 * per extra unit of that same type — falling back to a "default" row,
 * or $0 for a type with neither. A $0 fallback is deliberate (never
 * blocks checkout), but — only when `logGaps` is set, i.e. for a real
 * order rather than the checkout page's own live preview of the same
 * total — logs an activity note so the gap gets noticed (AGENTS.md
 * #8/#12) rather than silently under-charging forever. `logGaps`
 * defaults to false so simply rendering the checkout page doesn't spam
 * the activity log on every visit.
 */
export async function calculateShippingCents(
  storeId: string,
  items: ShippableCartItem[],
  opts?: { logGaps?: boolean }
): Promise<number> {
  if (items.length === 0) return 0;

  const rates = await listShippingRates(storeId);
  const byType = new Map(rates.map((r) => [r.productType, r]));

  const groups = new Map<string, number>();
  for (const item of items) {
    const type = item.variant.product.productType ?? "default";
    groups.set(type, (groups.get(type) ?? 0) + item.quantity);
  }

  let totalCents = 0;
  const missing: string[] = [];
  for (const [type, quantity] of groups) {
    const rate = byType.get(type) ?? byType.get("default");
    if (!rate) {
      missing.push(type);
      continue;
    }
    totalCents += rate.baseCents + Math.max(0, quantity - 1) * rate.additionalItemCents;
  }

  if (missing.length > 0 && opts?.logGaps) {
    await logActivity(storeId, {
      actor: "system",
      category: "shipping",
      summary: `No shipping rate configured for "${missing.join('", "')}" — charged $0 for ${
        missing.length === 1 ? "that product type" : "those product types"
      } this order`,
      details: { productTypes: missing },
    });
  }

  return totalCents;
}
