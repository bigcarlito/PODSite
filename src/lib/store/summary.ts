import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * A single-call snapshot of store state, built specifically for an agent
 * deciding what to do next — not just a metrics dump. Add a new signal
 * here (see AGENTS.md #8) whenever it would help answer "what should I
 * fix or optimize right now?".
 */
export async function getStoreSummary() {
  const [
    productCount,
    activeProductCount,
    ordersByStatus,
    outOfStockVariants,
    zeroPriceVariants,
    revenue,
    recentOrders,
  ] = await Promise.all([
    prisma.product.count(),
    prisma.product.count({ where: { isActive: true } }),
    prisma.order.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.productVariant.findMany({
      where: { inStock: false },
      select: {
        id: true,
        sku: true,
        size: true,
        color: true,
        product: { select: { title: true, slug: true } },
      },
    }),
    prisma.productVariant.findMany({
      where: { priceCents: 0 },
      select: {
        id: true,
        sku: true,
        product: { select: { title: true, slug: true } },
      },
    }),
    prisma.order.aggregate({
      where: { status: { in: ["PAID", "SUBMITTED_TO_FULFILLMENT", "SHIPPED"] } },
      _sum: { subtotalCents: true },
    }),
    prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        orderNumber: true,
        status: true,
        subtotalCents: true,
        createdAt: true,
      },
    }),
  ]);

  const stuckOrders = await prisma.order.findMany({
    where: {
      status: "PENDING_PAYMENT",
      createdAt: { lt: new Date(Date.now() - 1000 * 60 * 60 * 24) },
    },
    select: { orderNumber: true, createdAt: true, email: true },
  });

  return {
    products: {
      total: productCount,
      active: activeProductCount,
      inactive: productCount - activeProductCount,
    },
    orders: {
      byStatus: Object.fromEntries(
        ordersByStatus.map((o) => [o.status, o._count._all])
      ),
      stuckPendingPaymentOver24h: stuckOrders,
      recent: recentOrders,
    },
    revenueCents: revenue._sum.subtotalCents ?? 0,
    attention: {
      outOfStockVariants,
      variantsMissingPrice: zeroPriceVariants,
    },
  };
}
