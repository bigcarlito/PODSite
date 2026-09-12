import "server-only";
import { prisma } from "@/lib/prisma";
import { getFulfillmentProvider } from "@/lib/fulfillment/registry";
import { formatVariantOptions } from "@/lib/variant-label";
import { StoreError, notFound } from "./errors";
import { logActivity, type ActivityActor } from "./activity";
import type { Cart, CartItem, OrderStatus, ProductVariant, Product, Store } from "@prisma/client";

const orderInclude = {
  items: { include: { variant: true } },
} as const;

export type ShippingDetails = {
  email: string;
  shippingName: string;
  shippingAddress1: string;
  shippingAddress2?: string | null;
  shippingCity: string;
  shippingState: string;
  shippingZip: string;
  shippingCountry: string;
};

type CartWithItems = Cart & {
  items: (CartItem & { variant: ProductVariant & { product: Product } })[];
};

/**
 * Creates an order from a cart's current contents, in PENDING_PAYMENT
 * status — the cart itself is left untouched (see checkout/actions.ts and
 * the Stripe webhook: the cart is only cleared once payment actually
 * succeeds, so an abandoned checkout doesn't silently lose the customer's
 * items).
 */
export async function createPendingOrder(
  storeId: string,
  storeSlug: string,
  cart: CartWithItems,
  shipping: ShippingDetails,
  subtotalCents: number
) {
  const prefix = storeSlug.replace(/[^a-z0-9]/gi, "").slice(0, 3).toUpperCase() || "ORD";
  const orderNumber = `${prefix}-${Date.now().toString(36).toUpperCase()}`;

  const order = await prisma.order.create({
    data: {
      storeId,
      orderNumber,
      email: shipping.email,
      shippingName: shipping.shippingName,
      shippingAddress1: shipping.shippingAddress1,
      shippingAddress2: shipping.shippingAddress2 || null,
      shippingCity: shipping.shippingCity,
      shippingState: shipping.shippingState,
      shippingZip: shipping.shippingZip,
      shippingCountry: shipping.shippingCountry,
      subtotalCents,
      status: "PENDING_PAYMENT",
      items: {
        create: cart.items.map((item) => ({
          variantId: item.variantId,
          quantity: item.quantity,
          priceCents: item.variant.priceCents,
          productName: item.variant.product.title,
          variantName: formatVariantOptions(
            item.variant.options as Record<string, string>
          ),
        })),
      },
    },
    include: orderInclude,
  });

  await logActivity(storeId, {
    actor: "customer",
    category: "order",
    summary: `New order ${order.orderNumber} placed ($${(subtotalCents / 100).toFixed(2)})`,
    details: { orderId: order.id, orderNumber: order.orderNumber, subtotalCents },
  });

  return order;
}

export function listOrders(
  storeId: string,
  opts?: { status?: OrderStatus; take?: number }
) {
  return prisma.order.findMany({
    where: { storeId, ...(opts?.status ? { status: opts.status } : {}) },
    include: orderInclude,
    orderBy: { createdAt: "desc" },
    take: opts?.take ?? 100,
  });
}

export async function getOrder(storeId: string, idOrNumber: string) {
  const order = await prisma.order.findFirst({
    where: {
      storeId,
      OR: [{ id: idOrNumber }, { orderNumber: idOrNumber }],
    },
    include: orderInclude,
  });
  if (!order) throw notFound(`Order "${idOrNumber}"`);
  return order;
}

export async function markOrderPaid(
  storeId: string,
  idOrNumber: string,
  actor: ActivityActor = "agent"
) {
  const order = await getOrder(storeId, idOrNumber);
  if (order.status !== "PENDING_PAYMENT") {
    throw new StoreError(
      "INVALID_STATUS",
      `Order is "${order.status}", expected "PENDING_PAYMENT"`,
      { status: 409 }
    );
  }
  const updated = await prisma.order.update({
    where: { id: order.id },
    data: { status: "PAID" },
    include: orderInclude,
  });

  await logActivity(storeId, {
    actor,
    category: "order",
    summary: `Marked order ${order.orderNumber} paid`,
    details: { orderId: order.id, orderNumber: order.orderNumber },
  });

  return updated;
}

export async function submitOrderToFulfillment(
  store: Store,
  idOrNumber: string,
  actor: ActivityActor = "agent"
) {
  const order = await getOrder(store.id, idOrNumber);

  if (order.status === "SUBMITTED_TO_FULFILLMENT") {
    throw new StoreError(
      "ALREADY_SUBMITTED",
      "Order was already submitted to fulfillment",
      { status: 409 }
    );
  }

  const missing = order.items.filter((i) => !i.variant.providerVariantId);
  if (missing.length > 0) {
    throw new StoreError(
      "MISSING_PROVIDER_VARIANT",
      `Some items are missing a fulfillment provider variant: ${missing
        .map((m) => m.productName)
        .join(", ")}`,
      { status: 422 }
    );
  }

  const provider = getFulfillmentProvider(
    order.items[0].variant.provider,
    store.printfulApiKey,
    store.printfulStoreId
  );

  const result = await provider.submitOrder(
    order.items.map((i) => ({
      providerVariantId: i.variant.providerVariantId as string,
      quantity: i.quantity,
    })),
    {
      name: order.shippingName,
      address1: order.shippingAddress1,
      address2: order.shippingAddress2 ?? undefined,
      city: order.shippingCity,
      state: order.shippingState,
      zip: order.shippingZip,
      country: order.shippingCountry,
    },
    order.orderNumber
  );

  const updated = await prisma.order.update({
    where: { id: order.id },
    data: {
      status: "SUBMITTED_TO_FULFILLMENT",
      providerOrderId: result.providerOrderId,
    },
    include: orderInclude,
  });

  await logActivity(store.id, {
    actor,
    category: "fulfillment",
    summary: `Submitted order ${order.orderNumber} to ${order.items[0].variant.provider}`,
    details: {
      orderId: order.id,
      orderNumber: order.orderNumber,
      providerOrderId: result.providerOrderId,
    },
  });

  return updated;
}
