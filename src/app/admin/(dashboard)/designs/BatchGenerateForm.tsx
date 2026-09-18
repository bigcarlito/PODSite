"use client";

import { useActionState } from "react";
import { generateDesignBatchAction, type BatchGenerateState } from "../actions";
import { DESIGN_TYPE_VALUES } from "@/lib/design/aspects";

const initialState: BatchGenerateState = {};

export function BatchGenerateForm({ defaultNiche }: { defaultNiche: string }) {
  const [state, formAction, pending] = useActionState(generateDesignBatchAction, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <p className="text-sm font-medium">Generate a batch of concepts</p>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-muted">
          Niche / target customer
        </span>
        <input
          name="niche"
          defaultValue={defaultNiche}
          placeholder="e.g. disc golfers who take it too seriously"
          className="w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-accent"
        />
        <span className="mt-1 block text-[11px] text-muted">
          Defaults to this store&apos;s own audience — override for a
          sub-niche experiment.
        </span>
      </label>
      <div className="flex gap-4">
        <label className="block flex-1">
          <span className="mb-1 block text-xs font-medium text-muted">Count</span>
          <input
            name="count"
            type="number"
            min={1}
            max={5}
            defaultValue={5}
            className="w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-accent"
          />
        </label>
        <label className="block flex-1">
          <span className="mb-1 block text-xs font-medium text-muted">Product type</span>
          <input
            name="productType"
            defaultValue="tshirt"
            className="w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-accent"
          />
        </label>
      </div>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-muted">
          Lock design type (optional)
        </span>
        <select
          name="lockDesignType"
          defaultValue=""
          className="w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-accent"
        >
          <option value="">Vary across the batch</option>
          {DESIGN_TYPE_VALUES.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      </label>
      <div className="flex gap-4">
        <label className="block flex-1">
          <span className="mb-1 block text-xs font-medium text-muted">
            Image model (optional)
          </span>
          <input
            name="model"
            list="design-image-models"
            placeholder="google/gemini-2.5-flash-image"
            className="w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-accent"
          />
          <datalist id="design-image-models">
            <option value="google/gemini-2.5-flash-image" />
            <option value="openai/gpt-image-1" />
          </datalist>
        </label>
        <label className="block flex-1">
          <span className="mb-1 block text-xs font-medium text-muted">
            Text model (optional)
          </span>
          <input
            name="textModel"
            list="design-text-models"
            placeholder="google/gemini-2.5-flash"
            className="w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-accent"
          />
          <datalist id="design-text-models">
            <option value="google/gemini-2.5-flash" />
            <option value="anthropic/claude-sonnet-4.5" />
            <option value="openai/gpt-5" />
          </datalist>
        </label>
      </div>
      <p className="text-[11px] text-muted">
        Any OpenRouter model slug — leave blank to use this store&apos;s
        configured default for each. Image model generates each design;
        text model writes the concepts themselves.
      </p>

      {state.error && (
        <p className="text-sm text-red-600" role="alert">
          {state.error}
        </p>
      )}
      {state.result && (
        <div className="text-sm text-green-700" role="status">
          <p>
            Generated {state.result.succeeded} design(s), {state.result.failed} failed
            (batch &quot;{state.result.batchLabel}&quot;).
          </p>
          {state.result.failures.length > 0 && (
            <ul className="mt-1 list-disc pl-4 text-xs text-red-600">
              {state.result.failures.map((f, i) => (
                <li key={i}>
                  {f.name}: {f.error}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white hover:bg-accent-dark disabled:opacity-50"
      >
        {pending ? "Generating batch… this can take a few minutes" : "Generate batch"}
      </button>
    </form>
  );
}
