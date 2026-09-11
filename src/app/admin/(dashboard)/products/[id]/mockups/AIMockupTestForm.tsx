"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { generateAIMockupsAction, uploadDesignImage, type AIMockupTestState } from "../../../actions";

const initialState: AIMockupTestState = {};

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

export function AIMockupTestForm({ productId }: { productId: string }) {
  const [state, formAction, pending] = useActionState(generateAIMockupsAction, initialState);

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
        <input type="hidden" name="productId" value={productId} />

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

        <Field label="Color option name">
          <input name="colorOptionName" defaultValue="color" className={inputClass} />
        </Field>

        <Field label="Colors" hint="Comma-separated; leave blank for every color the product has.">
          <input name="colors" placeholder="Black, White" className={inputClass} />
        </Field>

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
          {pending ? "Generating..." : "Generate"}
        </button>
      </form>

      {state.result && (
        <div className="mt-8">
          <h2 className="text-sm font-semibold uppercase text-muted">Generated</h2>

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
        </div>
      )}
    </div>
  );
}
