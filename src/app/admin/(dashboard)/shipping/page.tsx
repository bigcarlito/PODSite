import type { Metadata } from "next";
import { requireCurrentStore } from "@/lib/store-context";
import { listShippingRates } from "@/lib/store/shipping";
import { ShippingRatesTable } from "./ShippingRatesTable";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Admin — Shipping" };

export default async function AdminShippingPage() {
  const store = await requireCurrentStore();
  const rates = await listShippingRates(store.id);

  return (
    <div>
      <h1 className="text-xl font-semibold">Shipping Rates</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted">
        A flat charge per product type — the base price for the first item of
        that type in a cart, plus a per-item price for each additional one of
        the same type. A row named <code>default</code> is used as the
        fallback for any product type with no row of its own. A product type
        with neither a specific row nor a <code>default</code> row ships
        free — set at least a <code>default</code> row to avoid that.
      </p>

      <ShippingRatesTable
        initialRates={rates.map((r) => ({
          productType: r.productType,
          baseCents: r.baseCents,
          additionalItemCents: r.additionalItemCents,
        }))}
      />
    </div>
  );
}
