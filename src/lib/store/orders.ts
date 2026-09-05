import "server-only";
import { prisma } from "@/lib/prisma";
import { getFulfillmentProvider } from "@/lib/fulfillment/registry";
import { StoreError, notFound } from "./errors";
import type { OrderStatus } from "@prisma/client";

const orderInclude = {
  items: { include: { variant: true } },
} as const;

export function listOrders(opts?: { status?: OrderStatus; take?: number }) {
  return prisma.order.findMany({
    where: opts?.status ? { status: opts.status } : undefined,
    include: orderInclude,
    orderBy: { createdAt: "desc" },
    take: opts?.take ?? 100,
  });
}

export async function getOrder(idOrNumber: string) {
  const order = await prisma.order.findFirst({
    where: { OR: [{ id: idOrNumber }, { orderNumber: idOrNumber }] },
    include: orderInclude,
  });
  if (!order) throw notFound(`Order "${idOrNumber}"`);
  return order;
}

export async function markOrderPaid(idOrNumber: string) {
  const order = await getOrder(idOrNumber);
  if (order.status !== "PENDING_PAYMENT") {
    throw new StoreError(
      "INVALID_STATUS",
      `Order is "${order.status}", expected "PENDING_PAYMENT"`,
      { status: 409 }
    );
  }
  return prisma.order.update({
    where: { id: order.id },
    data: { status: "PAID" },
    include: orderInclude,
  });
}

export async function submitOrderToFulfillment(idOrNumber: string) {
  const order = await getOrder(idOrNumber);

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

  const provider = getFulfillmentProvider(order.items[0].variant.provider);

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

  return prisma.order.update({
    where: { id: order.id },
    data: {
      status: "SUBMITTED_TO_FULFILLMENT",
      providerOrderId: result.providerOrderId,
    },
    include: orderInclude,
  });
}
