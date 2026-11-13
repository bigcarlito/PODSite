"use client";
/* eslint-disable @next/next/no-img-element */
import { useRef, useState } from "react";
import Link from "next/link";
import { FACTORY_COLORS, FACTORY_BLOCKERS } from "@/lib/design/factory-draft";
import { createDraft, editDraft } from "./actions";

export type Settings = { title: string; description: string; productType: string; colors: string[]; sizes: string[]; priceCents: number; currency: string };
type Result = Exclude<Awaited<ReturnType<typeof createDraft>>, { error: unknown }>;
export default function DraftProductForm({ evidence, garments, initial, productId, onSettingsChange }: { evidence?: Record<string, unknown>; garments: string[]; initial?: Settings; productId?: string; onSettingsChange?: (settings: Settings) => void }) {
  const [settings, storeSettings] = useState<Settings>(initial ?? { title: "", description: "", productType: garments[0] ?? "", colors: [...FACTORY_COLORS], sizes: ["S", "M", "L", "XL"], priceCents: 3200, currency: "USD" });
  function setSettings(next: Settings) { storeSettings(next); onSettingsChange?.(next); }
  const [result, setResult] = useState<Result>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  return <section className="space-y-3 rounded border p-3" aria-label="Draft product handoff">
    <h2 className="font-semibold">{productId ? "Edit draft product" : "Create Draft Product"}</h2>
    <p>Planned garment and colors only. Proposed price in integer USD cents; supplier variants, costs and availability are unverified.</p>
    <label className="block">Draft title<input className="block border p-2" value={settings.title} onChange={e => setSettings({ ...settings, title: e.target.value })} /></label>
    <label className="block">Draft description<textarea className="block w-full border p-2" value={settings.description} onChange={e => setSettings({ ...settings, description: e.target.value })} /></label>
    <p>Garment: <strong>{settings.productType}</strong></p>
    {productId && <p>Changing garment requires a new version reviewed and kept on that garment.</p>}
    <fieldset><legend>Planned colors</legend>{FACTORY_COLORS.map(c => <label key={c} className="mr-3 inline-block"><input type="checkbox" checked={settings.colors.includes(c)} onChange={e => setSettings({ ...settings, colors: e.target.checked ? [...settings.colors, c] : settings.colors.filter(v => v !== c) })} /> {c}</label>)}</fieldset>
    <label className="block">Proposed price (USD cents)<input type="number" min="1" step="1" value={settings.priceCents} onChange={e => setSettings({ ...settings, priceCents: Number(e.target.value) })} /></label>
    <p>Sizes planned: {settings.sizes.join(", ")}. Individual variant prices can also be edited in the existing variants workflow.</p>
    <ul className="list-disc pl-5">{FACTORY_BLOCKERS.map(b => <li key={b}>{b}</li>)}</ul>
    <button className="rounded border p-2" disabled={busy || (!productId && !!result) || !settings.title.trim() || !settings.description.trim() || !settings.colors.length || (!productId && !evidence)} onClick={async () => {
      if (submitting.current || (!productId && result)) return;
      submitting.current = true; setBusy(true); setError("");
      try {
        const saved = productId ? await editDraft(productId, settings) : await createDraft({ ...evidence, settings });
        if ("error" in saved) { setError(saved.error.message); return; }
        setResult(saved);
      }
      catch (e) { setError(e instanceof Error ? e.message : "Draft save failed; no automatic retry"); }
      finally { submitting.current = false; setBusy(false); }
    }}>{busy ? (productId ? "Saving draft..." : "Upscaling artwork and generating mockups...") : productId ? "Save draft edits" : "Create Draft Product"}</button>
    <p role="alert">{error}</p>
    {result && <div><p>{result.reused ? "Existing draft returned; no duplicate created." : "Draft saved inactive and unavailable."} <Link className="underline" href={`/admin/products/${result.product.id}`}>Review and edit draft</Link> · <Link className="underline" href={`/admin/products/${result.product.id}/mockups`}>Existing gallery workflow</Link></p>
      <div className="flex flex-wrap gap-2">{result.product.images.map(img => <figure key={img.url} className="w-40"><img src={img.url} alt={img.altText ?? "Draft preview"} /><figcaption className="text-xs">{img.altText}</figcaption></figure>)}</div>
    </div>}
  </section>;
}
