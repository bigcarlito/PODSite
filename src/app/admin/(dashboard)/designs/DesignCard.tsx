"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { rejectDesignAction, quickPublishDesignAction } from "../actions";

export function DesignCard({
  design,
}: {
  design: {
    id: string;
    slug: string;
    status: string;
    previewImageUrl: string | null;
    batchLabel: string | null;
    aspects: Record<string, unknown>;
    params: Record<string, unknown>;
  };
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [publishedProductId, setPublishedProductId] = useState<string | null>(null);
  const [rejected, setRejected] = useState(false);

  const name = typeof design.params.name === "string" ? design.params.name : design.slug;
  const whySells = typeof design.params.whySells === "string" ? design.params.whySells : null;
  const hook = typeof design.aspects.hook === "string" ? design.aspects.hook : null;
  const designType = typeof design.aspects.designType === "string" ? design.aspects.designType : null;
  const archetype = typeof design.aspects.archetype === "string" ? design.aspects.archetype : null;
  const phrase = typeof design.aspects.phrase === "string" ? design.aspects.phrase : null;

  function handleReject() {
    setError(null);
    startTransition(async () => {
      await rejectDesignAction(design.id);
      setRejected(true);
    });
  }

  function handlePublish() {
    setError(null);
    startTransition(async () => {
      const result = await quickPublishDesignAction(design.id);
      if (result.error) {
        setError(result.error);
      } else if (result.productId) {
        setPublishedProductId(result.productId);
      }
    });
  }

  const status = rejected ? "rejected" : publishedProductId ? "published" : design.status;

  return (
    <div className="w-64 rounded-lg border border-border p-3 text-xs">
      {design.previewImageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- our own asset URL
        <img
          src={design.previewImageUrl}
          alt={name}
          className="mx-auto h-48 w-48 rounded-lg object-contain"
        />
      ) : (
        <div className="mx-auto flex h-48 w-48 items-center justify-center rounded-lg border border-dashed border-border text-muted">
          No preview
        </div>
      )}

      <p className="mt-2 font-medium">{name}</p>
      {phrase && <p className="mt-1 text-muted">&quot;{phrase}&quot;</p>}
      {whySells && <p className="mt-1 text-[11px] text-muted">{whySells}</p>}
      <p className="mt-1 flex flex-wrap gap-1 text-[10px] text-muted">
        {[hook, designType, archetype].filter(Boolean).map((tag) => (
          <span key={tag} className="rounded-full border border-border px-1.5 py-0.5">
            {tag}
          </span>
        ))}
      </p>
      <p className="mt-1 text-[10px] uppercase tracking-wide text-muted">{status}</p>

      {status === "generated" && (
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={handleReject}
            className="flex-1 rounded-full border border-border px-3 py-1.5 font-medium hover:border-red-500 hover:text-red-600 disabled:opacity-50"
          >
            Reject
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={handlePublish}
            className="flex-1 rounded-full bg-accent px-3 py-1.5 font-medium text-white hover:bg-accent-dark disabled:opacity-50"
          >
            {pending ? "Working…" : "Make product →"}
          </button>
        </div>
      )}

      {publishedProductId && (
        <p className="mt-2 text-green-700">
          <Link href={`/admin/products/${publishedProductId}`} className="underline">
            View product
          </Link>
        </p>
      )}
      {error && (
        <p className="mt-2 text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
