import { isManualFulfillment } from "@/lib/storefront-theme";
import type { Metadata } from "next";
import { listOrders } from "@/lib/store/orders";
import { requireCurrentStore } from "@/lib/store-context";
import { OrderRow } from "./OrderRow";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Admin — Orders" };

export default async function AdminOrdersPage() {
  const store = await requireCurrentStore();
  const orders = await listOrders(store.id);

  return (
    <div>
      <h1 className="text-xl font-semibold">Orders</h1>
      {isManualFulfillment(store) && <p className="mt-4 rounded-xl border border-border p-4 text-sm">Manual fulfillment: monitor PAID orders below. Supplier submission is disabled. Expand an order for its shipping address and items; arrange fulfillment and tracking with the customer outside this dashboard.</p>}

      {orders.length === 0 ? (
        <p className="mt-6 text-sm text-muted">No orders yet.</p>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase text-muted">
                <th className="pb-2 pr-4 font-medium">Order</th>
                <th className="pb-2 pr-4 font-medium">Total</th>
                <th className="pb-2 pr-4 font-medium">Status</th>
                <th className="pb-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <OrderRow
                  key={o.id}
                  manualFulfillment={isManualFulfillment(store)}
                  order={{
                    id: o.id,
                    orderNumber: o.orderNumber,
                    email: o.email,
                    status: o.status,
                    subtotalCents: o.subtotalCents,
                    shippingCents: o.shippingCents,
                    createdAt: o.createdAt.toISOString(),
                    shippingName: o.shippingName,
                    shippingAddress: [o.shippingAddress1, o.shippingAddress2, o.shippingCity, o.shippingState, o.shippingZip, o.shippingCountry].filter(Boolean).join(", "),
                    items: o.items.map((item) => ({
                      id: item.id,
                      productName: item.productName,
                      variantName: item.variantName,
                      quantity: item.quantity,
                      priceCents: item.priceCents,
                    })),
                  }}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
