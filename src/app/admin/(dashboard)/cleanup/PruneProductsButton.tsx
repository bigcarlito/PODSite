"use client";

import { useState, useTransition } from "react";
import { pruneProductsAction, type PruneProductsState } from "../actions";

export function PruneProductsButton({ count }: { count: number }) {
  const [state, setState] = useState<PruneProductsState>({});
  const [pending, startTransition] = useTransition();

  if (count === 0 && !state.result) {
    return <p className="text-sm text-muted">Nothing to delete.</p>;
  }

  function handleClick() {
    if (
      !window.confirm(
        `Permanently delete ${count} inactive product(s) and all their variants/images? This can't be undone.`
      )
    ) {
      return;
    }
    startTransition(async () => {
      setState(await pruneProductsAction());
    });
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        disabled={pending || count === 0}
        className="rounded-full bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
      >
        {pending ? "Deleting..." : `Delete ${count} product(s)`}
      </button>

      {state.error && (
        <p className="mt-2 text-sm text-red-600" role="alert">
          {state.error}
        </p>
      )}
      {state.result && (
        <p className="mt-2 text-sm text-green-700" role="status">
          Deleted {state.result.deleted} of {state.result.total} product(s).
        </p>
      )}
      {state.result && state.result.failed.length > 0 && (
        <div className="mt-2 space-y-1">
          {state.result.failed.map((f) => (
            <p key={f.title} className="text-xs text-red-600">
              {f.title}: {f.error}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
