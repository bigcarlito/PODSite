import "server-only";
import { prisma } from "@/lib/prisma";
import { getFulfillmentProvider } from "@/lib/fulfillment/registry";
import { StoreError, notFound } from "./errors";
import { logActivity, type ActivityActor } from "./activity";
import type { OrderStatus, Store } from "@prisma/client";

const orderInclude = {
  items: { include: { variant: true } },
} as const;

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
    store.printfulApiKey
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
