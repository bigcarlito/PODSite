"use client";

import { useState, useTransition } from "react";
import { formatCents } from "@/lib/money";
import { markOrderPaid, submitOrderToFulfillment } from "./actions";

export type AdminOrderItem = {
  id: string;
  productName: string;
  variantName: string;
  quantity: number;
  priceCents: number;
};

export type AdminOrder = {
  id: string;
  orderNumber: string;
  email: string;
  status: string;
  subtotalCents: number;
  createdAt: string;
  shippingName: string;
  items: AdminOrderItem[];
};

export function OrderRow({ order }: { order: AdminOrder }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <tr className="border-b border-border align-top">
        <td className="py-3 pr-4">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="flex items-start gap-1.5 text-left"
            aria-expanded={expanded}
          >
            <span
              className="mt-0.5 inline-block text-xs text-muted transition-transform"
              style={{ transform: expanded ? "rotate(90deg)" : "rotate(0deg)" }}
            >
              ▶
            </span>
            <span>
              <p className="font-medium">{order.orderNumber}</p>
              <p className="text-xs text-muted">{order.shippingName}</p>
              <p className="text-xs text-muted">{order.email}</p>
            </span>
          </button>
        </td>
        <td className="py-3 pr-4">{formatCents(order.subtotalCents)}</td>
        <td className="py-3 pr-4">
          <span className="rounded-full bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent">
            {order.status.replaceAll("_", " ")}
          </span>
        </td>
        <td className="py-3">
          <div className="flex flex-wrap gap-2">
            {order.status === "PENDING_PAYMENT" && (
              <button
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    setError(null);
                    await markOrderPaid(order.id);
                  })
                }
                className="rounded-full border border-border px-3 py-1.5 text-xs font-medium hover:border-accent"
              >
                Mark Paid
              </button>
            )}
            {order.status !== "SUBMITTED_TO_FULFILLMENT" && (
              <button
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    setError(null);
                    try {
                      await submitOrderToFulfillment(order.id);
                    } catch (e) {
                      setError(e instanceof Error ? e.message : "Failed");
                    }
                  })
                }
                className="rounded-full bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-dark disabled:opacity-50"
              >
                {pending ? "Submitting..." : "Submit to Printful"}
              </button>
            )}
          </div>
          {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
        </td>
      </tr>
      {expanded && (
        <tr className="border-b border-border bg-black/[0.02]">
          <td colSpan={4} className="py-3 pl-8 pr-4">
            <table className="w-full text-left text-xs">
              <tbody>
                {order.items.map((item) => (
                  <tr key={item.id}>
                    <td className="py-1 pr-4 text-muted">
                      {item.productName}
                      {item.variantName ? ` — ${item.variantName}` : ""}
                    </td>
                    <td className="py-1 pr-4 text-muted">× {item.quantity}</td>
                    <td className="py-1 text-right">
                      {formatCents(item.priceCents * item.quantity)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </td>
        </tr>
      )}
    </>
  );
}
