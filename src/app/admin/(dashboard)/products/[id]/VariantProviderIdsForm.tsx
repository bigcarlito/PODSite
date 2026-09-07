"use client";

import { useActionState } from "react";
import { updateProviderVariantIds, type VariantProviderIdsState } from "../../actions";
import { formatCents } from "@/lib/money";

const initialState: VariantProviderIdsState = {};

const inputClass =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent font-mono";

type Variant = {
  id: string;
  sku: string;
  options: Record<string, string>;
  priceCents: number;
  currency: string;
  provider: string;
  providerVariantId: string;
  inStock: boolean;
};

export function VariantProviderIdsForm({
  productId,
  variants,
}: {
  productId: string;
  variants: Variant[];
}) {
  const [state, formAction, pending] = useActionState(updateProviderVariantIds, initialState);

  return (
    <form action={formAction} className="mt-6 max-w-3xl">
      <input type="hidden" name="productId" value={productId} />

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs uppercase text-muted">
              <th className="pb-2 pr-4 font-medium">SKU</th>
              <th className="pb-2 pr-4 font-medium">Options</th>
              <th className="pb-2 pr-4 font-medium">Price</th>
              <th className="pb-2 font-medium">Provider variant ID</th>
            </tr>
          </thead>
          <tbody>
            {variants.map((v) => (
              <tr key={v.id} className="border-b border-border">
                <td className="py-3 pr-4 align-top font-mono text-xs">{v.sku}</td>
                <td className="py-3 pr-4 align-top text-xs text-muted">
                  {Object.entries(v.options)
                    .map(([k, val]) => `${k}: ${val}`)
                    .join(", ") || "—"}
                </td>
                <td className="py-3 pr-4 align-top text-xs">
                  {formatCents(v.priceCents, v.currency)}
                </td>
                <td className="py-3 align-top">
                  <input type="hidden" name="variantId" value={v.id} />
                  <input type="hidden" name={`sku_${v.id}`} value={v.sku} />
                  <input
                    type="hidden"
                    name={`options_${v.id}`}
                    value={JSON.stringify(v.options)}
                  />
                  <input
                    type="hidden"
                    name={`priceCents_${v.id}`}
                    value={v.priceCents}
                  />
                  <input type="hidden" name={`currency_${v.id}`} value={v.currency} />
                  <input type="hidden" name={`provider_${v.id}`} value={v.provider} />
                  <input
                    type="hidden"
                    name={`inStock_${v.id}`}
                    value={v.inStock ? "on" : "off"}
                  />
                  <input
                    type="text"
                    name={`providerVariantId_${v.id}`}
                    defaultValue={v.providerVariantId}
                    placeholder="e.g. 4012"
                    className={inputClass}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {state.error && (
        <p className="mt-4 text-sm text-red-600" role="alert">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="mt-4 text-sm text-green-700" role="status">
          Saved.
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-4 rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white hover:bg-accent-dark disabled:opacity-50"
      >
        {pending ? "Saving..." : "Save provider variant IDs"}
      </button>
    </form>
  );
}
