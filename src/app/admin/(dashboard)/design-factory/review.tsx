"use client";
/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import { factoryManifestSchema, type FactoryManifest } from "@/lib/design/factory";
import { cycle, updateReviewPlacement, reviewFileSchema, type ReviewVersion } from "@/lib/design/factory-review";
import { DEFAULT_PLACEMENT, placementStyle, type Placement } from "@/lib/design/placement";
import type { DesignArea } from "@/lib/design/design-area";
import { generate, refine } from "./actions";

type Scene = { productType: string; area: DesignArea; bases: Record<string, string> };
function download(value: unknown, name: string) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }));
  const a = document.createElement("a"); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
}
export default function Review({ storeSlug, scenes }: { storeSlug: string; scenes: Scene[] }) {
  const [manifest, setManifest] = useState<FactoryManifest>();
  const [versions, setVersions] = useState<ReviewVersion[]>([]);
  const [selected, setSelected] = useState(0);
  const [sceneIndex, setScene] = useState(0);
  const [colorIndex, setColor] = useState(0);
  const [raw, setRaw] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [preserve, setPreserve] = useState("Exact lettering, subject, composition and palette unless explicitly changed in feedback");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [approved, setApproved] = useState(false);
  function select(next: number | ((index: number) => number)) { setSelected(next); setApproved(false); }
  const [touch, setTouch] = useState<number>();
  const scene = scenes[sceneIndex];
  const colors = Object.keys(scene?.bases ?? {});
  const color = colors[colorIndex % (colors.length || 1)];
  const version = versions[selected];
  const placement = version?.placements?.[scene?.productType] ?? DEFAULT_PLACEMENT;
  function place(next: Placement, copy = false) {
    if (!scene || !version) return;
    setVersions(items => updateReviewPlacement(items, version.id, scene.productType, next, copy));
  }
  function decide(decision: "keep" | "refine" | "reject") { setVersions(v => v.map((item, i) => i === selected ? { ...item, decision, decisions: [...(item.decisions ?? []), { decision, at: new Date().toISOString() }] } : item)); }
  async function importFiles(files: FileList | null) {
    if (!files) return;
    setError("");
    try {
      const all = Array.from(files);
      if (all.reduce((sum, f) => sum + f.size, 0) > 40 * 1024 * 1024) throw new Error("Import limit: 40 MB");
      const json = all.find(f => f.name.endsWith(".json"));
      if (!json) throw new Error("Select a manifest JSON and its PNG previews together");
      const data = JSON.parse(await json.text());
      const saved = data.format ? reviewFileSchema.parse(data) : undefined;
      const m = saved?.manifest ?? factoryManifestSchema.parse(data);
      if (m.brief.storeSlug !== storeSlug) throw new Error("Manifest belongs to another store");
      const next: ReviewVersion[] = [];
      for (const c of m.candidates) {
        let image: string | undefined;
        if (c.preview) {
          const file = all.find(f => f.name === c.preview!.file.split(/[\\/]/).pop());
          if (!file && !saved) throw new Error(`Missing PNG: ${c.preview.file}`);
          if (file) {
            const bytes = await file.arrayBuffer();
            const digest = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), b => b.toString(16).padStart(2, "0")).join("");
            if (digest !== c.preview.sha256) throw new Error(`Hash mismatch: ${file.name}`);
            image = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(`data:image/png;base64,${String(reader.result).split(",")[1]}`); reader.onerror = reject; reader.readAsDataURL(file); });
          }
        }
        next.push({ id: c.id, candidateId: c.id, parentId: null, prompt: c.prompt, rationale: "Imported original", preserved: [], feedback: "", image, decision: c.review.status === "selected" ? "keep" : c.review.status === "rejected" ? "reject" : "pending", createdAt: new Date().toISOString(), provenance: c.provenance });
      }
      setManifest(m); setVersions(saved?.versions ?? next); select(0);
    } catch (e) { setError(e instanceof Error ? e.message : "Import failed"); }
  }
  async function revise() {
    if (!manifest || !version || versions.length >= 50) return;
    setBusy(true); setError("");
    try {
      const result = await refine({ manifest, candidateId: version.candidateId, currentPrompt: version.prompt, feedback, preserve });
      const child: ReviewVersion = { ...result, id: crypto.randomUUID(), candidateId: version.candidateId, parentId: version.id, feedback, placements: version.placements ? structuredClone(version.placements) : undefined, decision: "pending", createdAt: new Date().toISOString() };
      setVersions(v => [...v.map(item => item.id === version.id ? { ...item, decision: "refine" as const, decisions: [...(item.decisions ?? []), { decision: "refine" as const, at: new Date().toISOString() }] } : item), child]); select(versions.length);
    } catch { setError("Revision failed. Check server configuration; no artwork generation was attempted."); }
    finally { setBusy(false); }
  }
  async function generateImage() {
    if (!manifest || !version || !approved || busy) return;
    setBusy(true); setError(""); setApproved(false);
    try {
      const result = await generate({ manifest, version: { ...version, image: undefined }, approvePaidGeneration: true });
      setVersions(v => v.map(item => item.id === version.id ? { ...item, image: result.image, provenance: result.provenance } : item));
    } catch { setError("Generation unavailable or failed. Check operator enablement and attempt logs. No automatic retries; credits may have been spent."); }
    finally { setBusy(false); }
  }
  return <main className="space-y-4">
    <div hidden aria-hidden="true">{colors.map(name => <img key={`${scene.productType}-${name}`} src={scene.bases[name]} alt="" loading="eager" />)}</div>
    <h1 className="text-2xl font-bold">Design Factory review</h1>
    <p>Human decisions only. Preview artwork is not print-ready. Export your review before leaving; this session is held in memory.</p>
    <label className="block">Import manifest + preview PNGs, or an exported review <input type="file" disabled={busy} multiple accept=".json,.png" onChange={e => void importFiles(e.target.files)} /></label>
    <p role="alert">{error}</p>
    {manifest && <>
      <h2 className="text-lg font-semibold">{manifest.candidates.find(c => c.id === version?.candidateId)?.style.name} · {version?.id}</h2>
      <button onClick={() => download({ format: "factory-review-1", manifest, versions, production: { ready: false, reason: "Provider print-area dimensions are not configured" } }, "factory-review.json")}>Export review and history</button>
      <div className="flex flex-wrap gap-3">
        <label>Garment <select value={sceneIndex} onChange={e => { setScene(Number(e.target.value)); setColor(0); }}>{scenes.map((s, i) => <option key={s.productType} value={i}>{s.productType}</option>)}</select></label>
        <button onClick={() => setColor(i => cycle(i, -1, colors.length))} disabled={!colors.length} aria-label="Previous shirt color">← Color</button>
        <span aria-live="polite">{color ?? "No existing blank garment assets configured"}</span>
        <button onClick={() => setColor(i => cycle(i, 1, colors.length))} disabled={!colors.length} aria-label="Next shirt color">Color →</button>
        <label><input type="checkbox" checked={raw} onChange={e => setRaw(e.target.checked)} /> Raw artwork</label>
      </div>
      <div tabIndex={0} aria-label="Artwork review; left and right arrows change shirt color" onKeyDown={e => { if (e.key === "ArrowLeft" || e.key === "ArrowRight") { e.preventDefault(); setColor(i => cycle(i, e.key === "ArrowLeft" ? -1 : 1, colors.length)); } }} onTouchStart={e => setTouch(e.changedTouches[0].clientX)} onTouchEnd={e => { if (touch !== undefined && Math.abs(e.changedTouches[0].clientX - touch) > 40) setColor(i => cycle(i, e.changedTouches[0].clientX < touch ? 1 : -1, colors.length)); }} className="relative mx-auto max-w-lg border">
        {!raw && color && <img src={scene.bases[color]} alt={`${scene.productType} blank shirt in ${color}`} className="block w-full" onError={() => setError("Garment photograph could not load. Choose another color or raw artwork.")} />}
        {version?.image && !raw && color ? <div className="outline outline-1 outline-dashed outline-black/30" style={{ position: "absolute", left: `${scene.area.x * 100}%`, top: `${scene.area.y * 100}%`, width: `${scene.area.width * 100}%`, height: `${scene.area.height * 100}%`, overflow: "hidden" }}>
          <img src={version.image} alt="Candidate artwork" style={placementStyle(placement)} />
        </div> : version?.image ? <img src={version.image} alt="Candidate artwork" style={{ width: "100%", background: "repeating-conic-gradient(#ddd 0% 25%, white 0% 50%) 0 / 20px 20px" }} /> : <p>Planned revision — export for explicit image generation.</p>}
      </div>
      {scene && version && <fieldset className="space-y-3 border p-3">
        <legend>Artwork placement / {scene.productType} / shared across colors</legend>
        <p>Artwork outside the print area is clipped. Raw artwork remains unchanged.</p>
        {(["scale", "x", "y"] as const).map(key => <label key={key} className="block">
          {key === "scale" ? "Size" : key === "x" ? "Horizontal center" : "Vertical center"}: {Math.round(placement[key] * 100)}%
          <input className="block min-h-11 w-full" type="range" min={key === "scale" ? 0.1 : 0} max={key === "scale" ? 2 : 1} step="0.01" value={placement[key]} onChange={e => place({ ...placement, [key]: Number(e.target.value) })} />
        </label>)}
        <button className="min-h-11 border p-2" onClick={() => place({ ...DEFAULT_PLACEMENT })}>Reset placement</button>
        <button className="min-h-11 border p-2" onClick={() => place(placement, true)}>Copy to versions without a placement</button>
        <p>Production export not ready: provider print-area dimensions are not configured. Keep records placement in the review export; it does not approve print readiness.</p>
      </fieldset>}
      <p>Review contrast, small lettering and edges on each real shirt color. Alpha is preserved; opaque source backgrounds remain visible. This visual check grants no print readiness.</p>
      <div className="flex gap-4"><button onClick={() => select(i => cycle(i, -1, versions.length))}>← Candidate/version</button><span aria-live="polite">{selected + 1} / {versions.length} · {version?.decision}</span><button onClick={() => select(i => cycle(i, 1, versions.length))}>Candidate/version →</button></div>
      <div className="flex gap-4"><button onClick={() => decide("keep")}>Keep</button><button onClick={() => decide("reject")}>Reject</button></div>
      <label className="block">Creative feedback<textarea className="block w-full border" value={feedback} maxLength={1500} onChange={e => setFeedback(e.target.value)} /></label>
      <label className="block">Preserve these aspects<textarea className="block w-full border" value={preserve} maxLength={2000} onChange={e => setPreserve(e.target.value)} /></label>
      <button disabled={busy || !feedback.trim() || !preserve.trim() || versions.length >= 50} onClick={() => void revise()}>{busy ? "Revising…" : "Refine — prepare prompt (uses text-model credits)"}</button>
      {version?.parentId && !version.image && <div className="space-y-2 border p-3"><p>Review the revised prompt below before generating. One paid image attempt; no retries or publishing. Server operator enablement required.</p><label><input type="checkbox" checked={approved} onChange={e => setApproved(e.target.checked)} /> I separately approve spending image credits for this revision.</label><button className="block" disabled={busy || !approved} onClick={() => void generateImage()}>Generate this version</button></div>}
      <details><summary>Prompt, rationale and lineage</summary><pre className="whitespace-pre-wrap">{JSON.stringify(version, (key, value) => key === "image" ? "[PNG preserved in export]" : value, 2)}</pre></details>
    </>}
  </main>;
}
