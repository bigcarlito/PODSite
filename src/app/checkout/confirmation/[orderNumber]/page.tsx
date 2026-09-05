import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatCents } from "@/lib/money";

export const dynamic = "force-dynamic";

export const metadata = { title: "Order Confirmed" };

export default async function ConfirmationPage({
  params,
}: {
  params: Promise<{ orderNumber: string }>;
}) {
  const { orderNumber } = await params;

  const order = await prisma.order.findUnique({
    where: { orderNumber },
    include: { items: true },
  });

  if (!order) notFound();

  return (
    <div className="mx-auto max-w-xl px-4 py-16 text-center sm:px-6">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-accent/10 text-accent">
        ✓
      </div>
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
        Thanks, {order.shippingName.split(" ")[0]}!
      </h1>
      <p className="mt-2 text-sm text-muted">
        Your order <span className="font-medium">{order.orderNumber}</span> has
        been received.
      </p>

      <div className="mt-8 space-y-3 rounded-2xl border border-border p-5 text-left">
        {order.items.map((item) => (
          <div key={item.id} className="flex justify-between text-sm">
            <span className="text-muted">
              {item.productName} {item.variantName} × {item.quantity}
            </span>
            <span>{formatCents(item.priceCents * item.quantity)}</span>
          </div>
        ))}
        <div className="flex justify-between border-t border-border pt-3 text-base font-semibold">
          <span>Total</span>
          <span>{formatCents(order.subtotalCents)}</span>
        </div>
      </div>

      <Link
        href="/products"
        className="mt-8 inline-block rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white hover:bg-accent-dark"
      >
        Continue Shopping
      </Link>
    </div>
  );
}
