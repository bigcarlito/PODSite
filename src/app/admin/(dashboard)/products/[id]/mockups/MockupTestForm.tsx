"use client";

import { useActionState } from "react";
import { generateMockupsAction, type MockupTestState } from "../../../actions";

const initialState: MockupTestState = {};

const inputClass =
  "w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-accent";
const textareaClass = `${inputClass} font-mono text-xs`;

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

export function MockupTestForm({ productId }: { productId: string }) {
  const [state, formAction, pending] = useActionState(generateMockupsAction, initialState);

  return (
    <div className="mt-6 max-w-2xl">
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="productId" value={productId} />

        <Field label="Design URL" hint="Publicly reachable transparent PNG at print resolution.">
          <input
            name="designUrl"
            type="url"
            required
            placeholder="https://.../design.png"
            className={inputClass}
          />
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Placement" hint="Provider placement key.">
            <input name="placement" defaultValue="front" className={inputClass} />
          </Field>
          <Field label="Color option name">
            <input name="colorOptionName" defaultValue="color" className={inputClass} />
          </Field>
        </div>

        <Field label="Colors" hint="Comma-separated; leave blank for every color the product has.">
          <input name="colors" placeholder="Black, White" className={inputClass} />
        </Field>

        <Field
          label="Garments (optional)"
          hint='Supply hexes directly instead of a provider lookup — the only way to preview with no Printful credentials. JSON array: [{"name": "Black", "hex": "#101010"}]'
        >
          <textarea name="garments" rows={3} spellCheck={false} className={textareaClass} />
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Catalog product ID" hint="Only if it can't be looked up.">
            <input name="catalogProductId" className={inputClass} />
          </Field>
          <Field label="Min contrast" hint="Default 2.">
            <input name="minContrast" type="number" step="0.1" min="1" className={inputClass} />
          </Field>
          <Field label="Min coverage" hint="Default 0.05.">
            <input
              name="minCoverage"
              type="number"
              step="0.01"
              min="0"
              max="1"
              className={inputClass}
            />
          </Field>
        </div>

        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" name="dryRun" defaultChecked />
          Dry run (score colors only — no renders, no images written)
        </label>

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
          {pending ? "Running..." : "Run"}
        </button>
      </form>

      {state.result && (
        <div className="mt-8">
          <h2 className="text-sm font-semibold uppercase text-muted">
            {state.result.dryRun ? "Dry-run result" : "Generated"}
          </h2>
          <p className="mt-2 text-xs text-muted">
            Opaque ratio: {state.result.design.opaqueRatio.toFixed(2)}
            {state.result.design.opaqueRatio > 0.9 && (
              <span className="text-red-600">
                {" "}
                — near 1 usually means the background wasn&apos;t removed.
              </span>
            )}
          </p>

          <div className="mt-2 flex flex-wrap gap-2">
            {state.result.design.palette.map((c) => (
              <span
                key={c.hex}
                className="flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs"
              >
                <span
                  className="h-3 w-3 rounded-full border border-border"
                  style={{ backgroundColor: c.hex }}
                />
                {c.hex} ({Math.round(c.coverage * 100)}%)
              </span>
            ))}
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase text-muted">
                  <th className="pb-2 pr-4 font-medium">Color</th>
                  <th className="pb-2 pr-4 font-medium">Min contrast</th>
                  <th className="pb-2 pr-4 font-medium">Worst design color</th>
                  <th className="pb-2 pr-4 font-medium">Fits</th>
                  <th className="pb-2 font-medium">Mockup</th>
                </tr>
              </thead>
              <tbody>
                {state.result.colors.map((c) => (
                  <tr key={c.color} className="border-b border-border align-top">
                    <td className="py-3 pr-4">
                      <span className="flex items-center gap-1.5">
                        {c.hex && (
                          <span
                            className="h-3 w-3 rounded-full border border-border"
                            style={{ backgroundColor: c.hex }}
                          />
                        )}
                        {c.color}
                      </span>
                    </td>
                    <td className="py-3 pr-4">{c.minContrast || "—"}</td>
                    <td className="py-3 pr-4">{c.worstColor || "—"}</td>
                    <td className="py-3 pr-4">
                      {c.fits ? "Yes" : <span className="text-muted">{c.skipped ?? "No"}</span>}
                    </td>
                    <td className="py-3">
                      {c.mockupUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element -- provider CDN URL
                        <img
                          src={c.mockupUrl}
                          alt={`${c.color} mockup`}
                          className="h-20 w-20 rounded-lg border border-border object-cover"
                        />
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
