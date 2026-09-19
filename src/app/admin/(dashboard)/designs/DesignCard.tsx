"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  rejectDesignAction,
  quickPublishDesignAction,
  regenerateDesignAction,
  deleteDesignAction,
} from "../actions";

type QcCheck = { pass: boolean; detail: string };

function PencilIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" aria-hidden="true">
      <path
        d="M11.5 2.5a1.5 1.5 0 0 1 2.12 2.12l-7.4 7.4-2.83.7.7-2.83 7.4-7.4Z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function RetryIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" aria-hidden="true">
      <path
        d="M13 8A5 5 0 1 1 11.5 4.3M13 2.5V5h-2.5"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" aria-hidden="true">
      <path
        d="M3 4.5h10M6.5 4.5v-1a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1v1M6.5 7.5v4M9.5 7.5v4M4 4.5l.6 8a1 1 0 0 0 1 .9h4.8a1 1 0 0 0 1-.9l.6-8"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

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
  const [deleted, setDeleted] = useState(false);
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

  function handlePublish(force = false) {
    setError(null);
    startTransition(async () => {
      const result = await quickPublishDesignAction(design.id, force);
      if (result.error) {
        setError(result.error);
      } else if (result.productId) {
        setPublishedProductId(result.productId);
      }
    });
  }

  function handleDelete() {
    if (!window.confirm("Delete this rejected design permanently?")) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteDesignAction(design.id);
      if (result.error) {
        setError(result.error);
      } else {
        setDeleted(true);
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

  if (deleted) return null;

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
            onClick={() => handlePublish()}
            className="flex-1 rounded-full bg-accent px-3 py-1.5 font-medium text-white hover:bg-accent-dark disabled:opacity-50"
          >
            {pending ? "Working…" : "Make product →"}
          </button>
        </div>
      )}

      {status === "generated" && (
        <div className="mt-2">
          <button
            type="button"
            onClick={() => setShowEdit((v) => !v)}
            className="text-[11px] text-accent underline"
          >
            {showEdit ? "Cancel edit" : "Edit & regenerate"}
          </button>
        </div>
      )}

      {status === "rejected" && (
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => setShowEdit((v) => !v)}
            title="Edit & regenerate"
            aria-label="Edit & regenerate"
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border disabled:opacity-50 ${
              showEdit ? "border-accent text-accent" : "border-border hover:border-accent"
            }`}
          >
            <PencilIcon />
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => handleRegenerate()}
            title="Retry"
            aria-label="Retry"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border hover:border-accent disabled:opacity-50"
          >
            <RetryIcon />
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={handleDelete}
            title="Delete"
            aria-label="Delete"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border hover:border-red-500 hover:text-red-600 disabled:opacity-50"
          >
            <TrashIcon />
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => handlePublish(true)}
            title="Publishes using this design's existing preview even though it failed QC"
            className="flex-1 rounded-full bg-accent px-3 py-1.5 font-medium text-white hover:bg-accent-dark disabled:opacity-50"
          >
            {pending ? "Working…" : "Publish"}
          </button>
        </div>
      )}

      {(status === "generated" || status === "rejected") && showEdit && (
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
