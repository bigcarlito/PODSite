"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  rejectDesignAction,
  quickPublishDesignAction,
  regenerateDesignAction,
} from "../actions";

type QcCheck = { pass: boolean; detail: string };

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
  const [editPrompt, setEditPrompt] = useState("");
  const [showEdit, setShowEdit] = useState(false);
  const [current, setCurrent] = useState({
    previewImageUrl: design.previewImageUrl,
    status: design.status,
    params: design.params,
  });

  const name = typeof current.params.name === "string" ? current.params.name : design.slug;
  const whySells = typeof current.params.whySells === "string" ? current.params.whySells : null;
  const hook = typeof design.aspects.hook === "string" ? design.aspects.hook : null;
  const designType = typeof design.aspects.designType === "string" ? design.aspects.designType : null;
  const archetype = typeof design.aspects.archetype === "string" ? design.aspects.archetype : null;
  const phrase = typeof design.aspects.phrase === "string" ? design.aspects.phrase : null;

  const qcChecks = current.params.qc as Record<string, QcCheck> | undefined;
  const failedChecks = qcChecks
    ? Object.values(qcChecks).filter((c) => c && c.pass === false)
    : [];

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

  function handleRegenerate(prompt?: string) {
    setError(null);
    startTransition(async () => {
      const result = await regenerateDesignAction(design.id, prompt);
      if (result.error) {
        setError(result.error);
      } else if (result.design) {
        setCurrent(result.design);
        setRejected(false);
        setEditPrompt("");
        setShowEdit(false);
      }
    });
  }

  const status = rejected ? "rejected" : publishedProductId ? "published" : current.status;

  return (
    <div className="w-64 rounded-lg border border-border p-3 text-xs">
      {current.previewImageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- our own asset URL
        <img
          src={current.previewImageUrl}
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

      {status === "rejected" && failedChecks.length > 0 && (
        <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[11px] text-red-600">
          {failedChecks.map((c, i) => (
            <li key={i}>{c.detail}</li>
          ))}
        </ul>
      )}

      {(status === "generated" || status === "rejected") && (
        <div className="mt-3 flex gap-2">
          {status === "generated" && (
            <button
              type="button"
              disabled={pending}
              onClick={handleReject}
              className="flex-1 rounded-full border border-border px-3 py-1.5 font-medium hover:border-red-500 hover:text-red-600 disabled:opacity-50"
            >
              Reject
            </button>
          )}
          {status === "rejected" && (
            <button
              type="button"
              disabled={pending}
              onClick={() => handleRegenerate()}
              className="flex-1 rounded-full border border-border px-3 py-1.5 font-medium hover:border-accent disabled:opacity-50"
            >
              {pending ? "Working…" : "Try again"}
            </button>
          )}
          {status === "generated" && (
            <button
              type="button"
              disabled={pending}
              onClick={handlePublish}
              className="flex-1 rounded-full bg-accent px-3 py-1.5 font-medium text-white hover:bg-accent-dark disabled:opacity-50"
            >
              {pending ? "Working…" : "Make product →"}
            </button>
          )}
        </div>
      )}

      {(status === "generated" || status === "rejected") && (
        <div className="mt-2">
          <button
            type="button"
            onClick={() => setShowEdit((v) => !v)}
            className="text-[11px] text-accent underline"
          >
            {showEdit ? "Cancel edit" : "Edit & regenerate"}
          </button>
          {showEdit && (
            <div className="mt-1.5 flex gap-1.5">
              <input
                type="text"
                value={editPrompt}
                onChange={(e) => setEditPrompt(e.target.value)}
                placeholder="e.g. remove the outer keyline, add more distress"
                className="flex-1 rounded border border-border bg-background px-2 py-1 text-[11px] outline-none focus:border-accent"
              />
              <button
                type="button"
                disabled={pending || !editPrompt.trim()}
                onClick={() => handleRegenerate(editPrompt)}
                className="rounded border border-border px-2 py-1 text-[11px] font-medium hover:border-accent disabled:opacity-50"
              >
                Go
              </button>
            </div>
          )}
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
