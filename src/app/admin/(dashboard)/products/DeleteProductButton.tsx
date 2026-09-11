"use client";

import { useTransition } from "react";
import { deleteProductAction } from "../actions";

export function DeleteProductButton({
  productId,
  productTitle,
}: {
  productId: string;
  productTitle: string;
}) {
  const [pending, startTransition] = useTransition();

  function handleClick() {
    if (!window.confirm(`Delete "${productTitle}"? It will drop off the storefront immediately.`)) {
      return;
    }
    startTransition(() => deleteProductAction(productId));
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={handleClick}
      className="text-sm text-red-600 underline disabled:opacity-50"
    >
      {pending ? "Deleting..." : "Delete"}
    </button>
  );
}
