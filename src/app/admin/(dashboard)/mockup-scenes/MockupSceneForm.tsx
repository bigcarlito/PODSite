"use client";

import { useActionState } from "react";
import { uploadMockupScene, type MockupSceneUploadState } from "../actions";

const initialState: MockupSceneUploadState = {};

export function MockupSceneForm() {
  const [state, formAction, pending] = useActionState(uploadMockupScene, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <label className="block">
        <span className="mb-1 block text-sm font-medium">Product type</span>
        <input
          name="productType"
          required
          placeholder="e.g. tshirt"
          className="w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-accent"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium">Scene photo</span>
        <input
          type="file"
          name="file"
          required
          accept="image/png,image/jpeg,image/webp"
          className="block w-full text-sm text-muted file:mr-3 file:rounded-full file:border-0 file:bg-accent file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-accent-dark"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium">Colors</span>
        <span className="mb-1 block text-xs text-muted">
          The garment colors this product type comes in — required before
          this type can be used to auto-generate a product. Leave blank
          when just replacing the photo to keep the existing lineup.
        </span>
        <textarea
          name="colors"
          rows={3}
          spellCheck={false}
          placeholder='[{"name": "Black", "hex": "#101010"}, {"name": "White", "hex": "#ffffff"}]'
          className="w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm font-mono text-xs outline-none focus:border-accent"
        />
      </label>

      {state.error && (
        <p className="text-sm text-red-600" role="alert">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="text-sm text-green-700" role="status">
          Saved.
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white hover:bg-accent-dark disabled:opacity-50"
      >
        {pending ? "Uploading..." : "Save scene"}
      </button>
    </form>
  );
}
