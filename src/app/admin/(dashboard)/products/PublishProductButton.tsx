"use client";
import { useState, useTransition } from "react";
import { setProductPublished } from "./publication-actions";

export function PublishProductButton({ productId, isActive }: { productId: string; isActive: boolean }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  return <div>
    <button type="button" disabled={pending} className="text-sm text-accent underline disabled:opacity-50" onClick={() => {
      setError("");
      startTransition(async () => {
        try {
          const result = await setProductPublished(productId, !isActive);
          if ("error" in result) setError(result.error);
        } catch { setError("Could not update publication. Please try again."); }
      });
    }}>{pending ? (isActive ? "Unpublishing..." : "Publishing...") : isActive ? "Unpublish" : "Publish"}</button>
    {error && <p role="alert" className="max-w-xs text-xs text-red-600">{error}</p>}
  </div>;
}
