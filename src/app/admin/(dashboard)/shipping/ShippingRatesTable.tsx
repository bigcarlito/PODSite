"use client";

import { useState, useTransition } from "react";
import { saveShippingRate } from "../actions";

export type ShippingRateRow = {
  productType: string;
  baseCents: number;
  additionalItemCents: number;
};

function centsToDollarsString(cents: number): string {
  return (cents / 100).toFixed(2);
}

function dollarsStringToCents(value: string): number {
  return Math.round(parseFloat(value || "0") * 100);
}

function RateRow({
  productType,
  baseCents,
  additionalItemCents,
  editableProductType,
  onSaved,
}: {
  productType: string;
  baseCents: number;
  additionalItemCents: number;
  editableProductType?: boolean;
  onSaved: (row: ShippingRateRow) => void;
}) {
  const [type, setType] = useState(productType);
  const [base, setBase] = useState(centsToDollarsString(baseCents));
  const [additional, setAdditional] = useState(centsToDollarsString(additionalItemCents));
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  return (
    <tr className="border-b border-border">
      <td className="py-2 pr-4">
        {editableProductType ? (
          <input
            value={type}
            onChange={(e) => setType(e.target.value)}
            placeholder='e.g. "tshirt" or "default"'
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
          />
        ) : (
          <code className="text-sm">{type}</code>
        )}
      </td>
      <td className="py-2 pr-4">
        <input
          type="number"
          step="0.01"
          min="0"
          value={base}
          onChange={(e) => setBase(e.target.value)}
          className="w-24 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
        />
      </td>
      <td className="py-2 pr-4">
        <input
          type="number"
          step="0.01"
          min="0"
          value={additional}
          onChange={(e) => setAdditional(e.target.value)}
          className="w-24 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
        />
      </td>
      <td className="py-2">
        <button
          type="button"
          disabled={pending || !type.trim()}
          onClick={() => {
            setError(null);
            setSaved(false);
            startTransition(async () => {
              try {
                await saveShippingRate(type.trim(), {
                  baseCents: dollarsStringToCents(base),
                  additionalItemCents: dollarsStringToCents(additional),
                });
                setSaved(true);
                onSaved({
                  productType: type.trim(),
                  baseCents: dollarsStringToCents(base),
                  additionalItemCents: dollarsStringToCents(additional),
                });
              } catch (e) {
                setError(e instanceof Error ? e.message : "Failed to save");
              }
            });
          }}
          className="rounded-full bg-accent px-4 py-2 text-xs font-semibold text-white hover:bg-accent-dark disabled:opacity-50"
        >
          {pending ? "Saving..." : "Save"}
        </button>
        {saved && !pending && <span className="ml-2 text-xs text-green-700">Saved</span>}
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      </td>
    </tr>
  );
}

export function ShippingRatesTable({ initialRates }: { initialRates: ShippingRateRow[] }) {
  const [rates, setRates] = useState(initialRates);
  const [addingKey, setAddingKey] = useState(0);

  function handleSaved(row: ShippingRateRow) {
    setRates((prev) => {
      const exists = prev.some((r) => r.productType === row.productType);
      return exists
        ? prev.map((r) => (r.productType === row.productType ? row : r))
        : [...prev, row];
    });
    // A fresh "add new" row for the next entry, keyed to remount and clear.
    setAddingKey((k) => k + 1);
  }

  return (
    <div className="mt-6 overflow-x-auto">
      <table className="w-full min-w-[520px] text-left text-sm">
        <thead>
          <tr className="border-b border-border text-xs uppercase text-muted">
            <th className="pb-2 pr-4 font-medium">Product type</th>
            <th className="pb-2 pr-4 font-medium">First item</th>
            <th className="pb-2 pr-4 font-medium">Each additional</th>
            <th className="pb-2 font-medium">&nbsp;</th>
          </tr>
        </thead>
        <tbody>
          {rates.map((r) => (
            <RateRow
              key={r.productType}
              productType={r.productType}
              baseCents={r.baseCents}
              additionalItemCents={r.additionalItemCents}
              onSaved={handleSaved}
            />
          ))}
          <RateRow
            key={`new-${addingKey}`}
            productType=""
            baseCents={0}
            additionalItemCents={0}
            editableProductType
            onSaved={handleSaved}
          />
        </tbody>
      </table>
    </div>
  );
}
