/** Validate the signed payment against our tenant-scoped, locked order totals. */
export function matchesPaidOrder(session: { payment_status: string; currency: string | null; amount_total: number | null; metadata: { [key: string]: string } | null }, order: { id: string; storeId: string; currency: string; subtotalCents: number; shippingCents: number }) {
  return session.payment_status === "paid" && session.metadata?.storeId === order.storeId && session.metadata?.orderId === order.id && session.currency?.toUpperCase() === order.currency && session.amount_total === order.subtotalCents + order.shippingCents;
}
