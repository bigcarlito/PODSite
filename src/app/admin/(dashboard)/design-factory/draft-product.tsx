"use client";
/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import Link from "next/link";
import { FACTORY_COLORS, FACTORY_BLOCKERS } from "@/lib/design/factory-draft";
import { createDraft, editDraft } from "./actions";

type Settings = { title: string; description: string; productType: string; colors: string[]; sizes: string[]; priceCents: number; currency: string };
type Result = Awaited<ReturnType<typeof createDraft>>;
export default function DraftProductForm({ evidence, garments, initial, productId }: { evidence?: Record<string, unknown>; garments: string[]; initial?: Settings; productId?: string }) {
  const [settings, setSettings] = useState<Settings>(initial ?? { title: "", description: "", productType: "comfort-colors-1717", colors: [...FACTORY_COLORS], sizes: ["S", "M", "L", "XL"], priceCents: 3200, currency: "USD" });
  const [result, setResult] = useState<Result>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return <section className="space-y-3 rounded border p-3" aria-label="Draft product handoff">
    <h2 className="font-semibold">{productId ? "Edit draft product" : "Create Draft Product"}</h2>
    <p>Planned garment and colors only. Proposed price in integer USD cents; supplier variants, costs and availability are unverified.</p>
    <label className="block">Draft title<input className="block border p-2" value={settings.title} onChange={e => setSettings({ ...settings, title: e.target.value })} /></label>
    <label className="block">Draft description<textarea className="block w-full border p-2" value={settings.description} onChange={e => setSettings({ ...settings, description: e.target.value })} /></label>
    <label className="block">Garment<select disabled={!!productId} value={settings.productType} onChange={e => setSettings({ ...settings, productType: e.target.value })}>{Array.from(new Set(["comfort-colors-1717", ...garments])).map(g => <option key={g}>{g}</option>)}</select></label>
    {productId && <p>Changing garment requires a new version reviewed and kept on that garment.</p>}
    <fieldset><legend>Planned colors</legend>{FACTORY_COLORS.map(c => <label key={c} className="mr-3 inline-block"><input type="checkbox" checked={settings.colors.includes(c)} onChange={e => setSettings({ ...settings, colors: e.target.checked ? [...settings.colors, c] : settings.colors.filter(v => v !== c) })} /> {c}</label>)}</fieldset>
    <label className="block">Proposed price (USD cents)<input type="number" min="1" step="1" value={settings.priceCents} onChange={e => setSettings({ ...settings, priceCents: Number(e.target.value) })} /></label>
    <p>Sizes planned: {settings.sizes.join(", ")}. Individual variant prices can also be edited in the existing variants workflow.</p>
    <ul className="list-disc pl-5">{FACTORY_BLOCKERS.map(b => <li key={b}>{b}</li>)}</ul>
    <button className="rounded border p-2" disabled={busy || !settings.title.trim() || !settings.description.trim() || !settings.colors.length || (!productId && !evidence)} onClick={async () => {
      setBusy(true); setError("");
      try { setResult(productId ? await editDraft(productId, settings) : await createDraft({ ...evidence, settings })); }
      catch (e) { setError(e instanceof Error ? e.message : "Draft save failed; no automatic retry"); }
      finally { setBusy(false); }
    }}>{busy ? "Saving draft..." : productId ? "Save draft edits" : "Create Draft Product"}</button>
    <p role="alert">{error}</p>
    {result && <div><p>{result.reused ? "Existing draft returned; no duplicate created." : "Draft saved inactive and unavailable."} <Link className="underline" href={`/admin/products/${result.product.id}`}>Review and edit draft</Link> · <Link className="underline" href={`/admin/products/${result.product.id}/mockups`}>Existing gallery workflow</Link></p>
      <div className="flex flex-wrap gap-2">{result.product.images.map(img => <figure key={img.url} className="w-40"><img src={img.url} alt={img.altText ?? "Draft preview"} /><figcaption className="text-xs">{img.altText}</figcaption></figure>)}</div>
    </div>}
  </section>;
}
