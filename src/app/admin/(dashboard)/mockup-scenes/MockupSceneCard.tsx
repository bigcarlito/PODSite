"use client";

import Link from "next/link";
import { useActionState } from "react";
import { generateMockupSceneBasesAction, type GenerateBasesState } from "../actions";
import { DeleteMockupSceneButton } from "./DeleteMockupSceneButton";

const initialState: GenerateBasesState = {};

export function MockupSceneCard({
  scene,
}: {
  scene: {
    id: string;
    productType: string;
    imageUrl: string;
    colors: Array<{ name: string; hex: string }>;
    baseImages: Record<string, string>;
    hasDesignArea: boolean;
  };
}) {
  const [state, formAction, pending] = useActionState(generateMockupSceneBasesAction, initialState);
  const baseImages = { ...scene.baseImages, ...state.result?.generated };
  const missing = scene.colors.filter((c) => !baseImages[c.name]);

  return (
    <div className="w-64 rounded-lg border border-border p-3 text-center text-xs">
      {/* eslint-disable-next-line @next/next/no-img-element -- our own asset URL */}
      <img
        src={scene.imageUrl}
        alt={scene.productType}
        className="mx-auto h-40 w-40 rounded-lg object-cover"
      />
      <p className="mt-2 font-medium">{scene.productType}</p>
      <p className="mt-1 text-muted">
        {scene.colors.map((c) => c.name).join(", ") || "No colors set"}
      </p>

      {scene.colors.length > 0 && (
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          {scene.colors.map((c) => (
            <div key={c.name} className="text-center">
              {baseImages[c.name] ? (
                // eslint-disable-next-line @next/next/no-img-element -- our own asset URL
                <img
                  src={baseImages[c.name]}
                  alt={`${c.name} base`}
                  className="h-14 w-14 rounded border border-border object-cover"
                />
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded border border-dashed border-border text-[10px] text-muted">
                  none
                </div>
              )}
              <p className="mt-0.5 text-[10px] text-muted">{c.name}</p>
            </div>
          ))}
        </div>
      )}

      {scene.colors.length > 0 && (
        <form action={formAction} className="mt-3">
          <input type="hidden" name="productType" value={scene.productType} />
          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-full border border-border px-3 py-1.5 text-xs font-medium hover:border-accent disabled:opacity-50"
          >
            {pending
              ? "Generating..."
              : missing.length > 0
                ? `Generate ${missing.length} missing base(s)`
                : "Regenerate all bases"}
          </button>
        </form>
      )}

      {state.error && (
        <p className="mt-2 text-red-600" role="alert">
          {state.error}
        </p>
      )}
      {state.result && state.result.failed.length > 0 && (
        <p className="mt-2 text-red-600">
          Failed: {state.result.failed.map((f) => f.color).join(", ")}
        </p>
      )}

      <div className="mt-3 flex items-center justify-center gap-3">
        <Link
          href={`/admin/mockup-scenes/${encodeURIComponent(scene.productType)}/design-area`}
          className="text-accent underline"
        >
          {scene.hasDesignArea ? "Edit" : "Set"} design area
        </Link>
        <DeleteMockupSceneButton productType={scene.productType} />
      </div>
    </div>
  );
}
