"use client";

import { useActionState } from "react";
import { updateProductType, type ProductTypeState } from "../../actions";

const initialState: ProductTypeState = {};

export function ProductTypeForm({
  productId,
  productType,
}: {
  productId: string;
  productType: string;
}) {
  const [state, formAction, pending] = useActionState(updateProductType, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="productId" value={productId} />
      <label className="block">
        <span className="mb-1 block text-sm font-medium">Product type</span>
        <input
          name="productType"
          defaultValue={productType}
          placeholder="e.g. tshirt"
          className="rounded-lg border border-border bg-background px-3.5 py-2 text-sm outline-none focus:border-accent"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-full border border-border px-4 py-2 text-sm font-medium hover:border-accent disabled:opacity-50"
      >
        {pending ? "Saving..." : "Save"}
      </button>
      {state.error && (
        <p className="w-full text-sm text-red-600" role="alert">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="w-full text-sm text-green-700" role="status">
          Saved.
        </p>
      )}
    </form>
  );
}
