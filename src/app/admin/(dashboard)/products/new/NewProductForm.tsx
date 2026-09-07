"use client";

import Link from "next/link";
import { useActionState, useRef, useState, useTransition } from "react";
import { generateProductAction, uploadDesignImage, type GenerateProductState } from "../../actions";

const initialState: GenerateProductState = {};

const inputClass =
  "w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-accent";

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">{label}</span>
      {hint && <span className="mb-1 block text-xs text-muted">{hint}</span>}
      {children}
    </label>
  );
}

export function NewProductForm({
  productTypes,
}: {
  productTypes: Array<{ productType: string; colorCount: number }>;
}) {
  const [state, formAction, pending] = useActionState(generateProductAction, initialState);

  const [designUrl, setDesignUrl] = useState("");
  const [uploadError, setUploadError] = useState<string>();
  const [uploading, startUpload] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleDesignFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setUploadError(undefined);
    startUpload(async () => {
      const formData = new FormData();
      formData.set("file", file);
      const result = await uploadDesignImage(formData);
      if (result.error) {
        setUploadError(result.error);
      } else if (result.url) {
        setDesignUrl(result.url);
      }
    });
  }

  return (
    <div className="mt-6 max-w-2xl">
      <form action={formAction} className="space-y-4">
        <Field label="Product type">
          <select name="productType" required className={inputClass}>
            {productTypes.map((t) => (
              <option key={t.productType} value={t.productType} disabled={t.colorCount === 0}>
                {t.productType}
                {t.colorCount === 0 ? " (no colors set)" : ` (${t.colorCount} colors)`}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Design URL" hint="Publicly reachable transparent PNG at print resolution.">
          <div className="flex items-center gap-2">
            <input
              name="designUrl"
              type="url"
              required
              value={designUrl}
              onChange={(e) => setDesignUrl(e.target.value)}
              placeholder="https://.../design.png"
              className={inputClass}
            />
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              title="Upload a design image"
              aria-label="Upload a design image"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border text-muted hover:border-accent hover:text-accent disabled:opacity-50"
            >
              {uploading ? (
                <span className="text-xs">…</span>
              ) : (
                <svg
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  className="h-4 w-4"
                  aria-hidden="true"
                >
                  <path
                    d="M10 13V3m0 0L6.5 6.5M10 3l3.5 3.5M4 14v1a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-1"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleDesignFileChange}
              className="hidden"
            />
          </div>
          {uploadError && (
            <p className="mt-1 text-xs text-red-600" role="alert">
              {uploadError}
            </p>
          )}
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Price" hint="Applies to every size/color.">
            <input
              name="price"
              type="number"
              step="0.01"
              min="0.01"
              required
              placeholder="24.99"
              className={inputClass}
            />
          </Field>
          <Field label="Sizes" hint="Comma-separated.">
            <input name="sizes" defaultValue="S, M, L, XL" className={inputClass} />
          </Field>
        </div>

        {state.error && (
          <p className="text-sm text-red-600" role="alert">
            {state.error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white hover:bg-accent-dark disabled:opacity-50"
        >
          {pending ? "Generating..." : "Generate product"}
        </button>
      </form>

      {state.result && (
        <div className="mt-8">
          <h2 className="text-sm font-semibold uppercase text-muted">
            Created:{" "}
            <Link href={`/admin/products/${state.result.productId}`} className="text-accent underline">
              {state.result.title}
            </Link>
          </h2>
          <p className="mt-2 text-sm">{state.result.description}</p>

          <div className="mt-4 flex flex-wrap gap-4">
            {state.result.rendered.map((r) => (
              <div key={r.color} className="text-center text-xs">
                {/* eslint-disable-next-line @next/next/no-img-element -- our own asset URL */}
                <img
                  src={r.mockupUrl}
                  alt={`${r.color} mockup`}
                  className="h-40 w-40 rounded-lg border border-border object-cover"
                />
                <p className="mt-1">{r.color}</p>
              </div>
            ))}
          </div>

          {state.result.failed.length > 0 && (
            <div className="mt-4 space-y-1">
              {state.result.failed.map((f) => (
                <p key={f.color} className="text-xs text-red-600">
                  {f.color}: {f.error}
                </p>
              ))}
            </div>
          )}

          <p className="mt-4 text-xs text-muted">
            Set each variant&apos;s provider (Printful) IDs on{" "}
            <Link href={`/admin/products/${state.result.productId}`} className="underline">
              the product&apos;s Variants page
            </Link>{" "}
            before it can be fulfilled.
          </p>
        </div>
      )}
    </div>
  );
}
