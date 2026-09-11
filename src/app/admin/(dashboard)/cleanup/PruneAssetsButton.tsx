"use client";

import { useState, useTransition } from "react";
import { pruneAssetsAction, type PruneAssetsState } from "../actions";

export function PruneAssetsButton({ count }: { count: number }) {
  const [state, setState] = useState<PruneAssetsState>({});
  const [pending, startTransition] = useTransition();

  if (count === 0 && !state.result) {
    return <p className="text-sm text-muted">Nothing to prune.</p>;
  }

  function handleClick() {
    if (!window.confirm(`Permanently delete ${count} orphaned asset(s)? This can't be undone.`)) {
      return;
    }
    startTransition(async () => {
      setState(await pruneAssetsAction());
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
        {pending ? "Deleting..." : `Delete ${count} orphaned asset(s)`}
      </button>

      {state.error && (
        <p className="mt-2 text-sm text-red-600" role="alert">
          {state.error}
        </p>
      )}
      {state.result && (
        <p className="mt-2 text-sm text-green-700" role="status">
          Deleted {state.result.deleted} of {state.result.total} asset(s).
        </p>
      )}
    </div>
  );
}
