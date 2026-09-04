"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { destroyAdminSession } from "@/lib/admin-auth";
import { getFulfillmentProvider } from "@/lib/fulfillment/registry";

export async function logoutAdmin() {
  await destroyAdminSession();
  redirect("/admin/login");
}

export async function submitOrderToFulfillment(orderId: string) {
  const order = await prisma.order.findUniqueOrThrow({
    where: { id: orderId },
    include: { items: { include: { variant: true } } },
  });

  const missing = order.items.filter((i) => !i.variant.providerVariantId);
  if (missing.length > 0) {
    throw new Error(
      `Some items are missing a fulfillment provider variant: ${missing
        .map((m) => m.productName)
        .join(", ")}`
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

  await prisma.order.update({
    where: { id: order.id },
    data: {
      status: "SUBMITTED_TO_FULFILLMENT",
      providerOrderId: result.providerOrderId,
    },
  });

  revalidatePath("/admin");
}

export async function markOrderPaid(orderId: string) {
  await prisma.order.update({
    where: { id: orderId },
    data: { status: "PAID" },
  });
  revalidatePath("/admin");
}
