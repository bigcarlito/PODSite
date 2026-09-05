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
                  order={{
                    id: o.id,
                    orderNumber: o.orderNumber,
                    email: o.email,
                    status: o.status,
                    subtotalCents: o.subtotalCents,
                    createdAt: o.createdAt.toISOString(),
                    shippingName: o.shippingName,
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
