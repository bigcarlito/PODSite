import { withAgentAuth } from "@/lib/store/api-helpers";
import { listOrders } from "@/lib/store/orders";
import type { OrderStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

const VALID_STATUSES: OrderStatus[] = [
  "PENDING_PAYMENT",
  "PAID",
  "SUBMITTED_TO_FULFILLMENT",
  "IN_PRODUCTION",
  "SHIPPED",
  "CANCELED",
];

export const GET = withAgentAuth(async (request) => {
  const url = new URL(request.url);
  const statusParam = url.searchParams.get("status");
  const status =
    statusParam && VALID_STATUSES.includes(statusParam as OrderStatus)
      ? (statusParam as OrderStatus)
      : undefined;
  const take = Number(url.searchParams.get("take") ?? "100");

  const orders = await listOrders({ status, take });
  return Response.json({ orders });
});
