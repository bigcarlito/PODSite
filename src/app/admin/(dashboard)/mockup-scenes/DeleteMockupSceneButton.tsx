"use client";

import { useTransition } from "react";
import { deleteMockupSceneAction } from "../actions";

export function DeleteMockupSceneButton({ productType }: { productType: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => deleteMockupSceneAction(productType))}
      className="mt-1 text-xs text-red-600 underline disabled:opacity-50"
    >
      {pending ? "Removing..." : "Remove"}
    </button>
  );
}
