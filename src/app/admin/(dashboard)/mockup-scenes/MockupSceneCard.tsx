"use client";

import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import {
  generateMockupSceneBasesAction,
  uploadMockupSceneBaseImage,
  type GenerateBasesState,
} from "../actions";
import { DeleteMockupSceneButton } from "./DeleteMockupSceneButton";

const initialState: GenerateBasesState = {};

function ColorBaseImage({
  productType,
  color,
  imageUrl,
  onUploaded,
}: {
  productType: string;
  color: { name: string; hex: string };
  imageUrl?: string;
  onUploaded: (colorName: string, url: string) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const inputId = `base-image-${productType}-${color.name}`;

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!file) return;

    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("file", file);
      const result = await uploadMockupSceneBaseImage(productType, color.name, formData);
      if (result.error) {
        setError(result.error);
      } else if (result.url) {
        onUploaded(color.name, result.url);
      }
    });
  }

  return (
    <div className="text-center">
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- our own asset URL
        <img
          src={imageUrl}
          alt={`${color.name} base`}
          className="h-14 w-14 rounded border border-border object-cover"
        />
      ) : (
        <div className="flex h-14 w-14 items-center justify-center rounded border border-dashed border-border text-[10px] text-muted">
          {pending ? "…" : "none"}
        </div>
      )}
      <p className="mt-0.5 text-[10px] text-muted">{color.name}</p>
      <label
        htmlFor={inputId}
        className="mt-0.5 block cursor-pointer text-[10px] text-accent underline"
      >
        {pending ? "Uploading…" : "Upload"}
      </label>
      <input
        id={inputId}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        disabled={pending}
        onChange={handleFileChange}
        className="hidden"
      />
      {error && <p className="mt-0.5 max-w-[6rem] text-[10px] text-red-600">{error}</p>}
    </div>
  );
}

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
  const [uploadedOverrides, setUploadedOverrides] = useState<Record<string, string>>({});
  const baseImages = { ...scene.baseImages, ...state.result?.generated, ...uploadedOverrides };
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
            <ColorBaseImage
              key={c.name}
              productType={scene.productType}
              color={c}
              imageUrl={baseImages[c.name]}
              onUploaded={(colorName, url) =>
                setUploadedOverrides((prev) => ({ ...prev, [colorName]: url }))
              }
            />
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
      <p className="mt-1 text-[10px] text-muted">
        Generating overwrites any base you&apos;ve uploaded for that color.
      </p>

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
