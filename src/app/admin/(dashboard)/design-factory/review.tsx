"use client";
/* eslint-disable @next/next/no-img-element */
import { useEffect, useState, type SetStateAction } from "react";
import { factoryManifestSchema, type FactoryManifest } from "@/lib/design/factory";
import { cycle, constrainReviewPlacements, updateReviewPlacement, reviewFileSchema, type ReviewVersion } from "@/lib/design/factory-review";
import { DEFAULT_PLACEMENT, alphaBounds, constrainedPlacement, printAreaProfileSchema, printBoundary, type PrintAreaProfile, type ArtworkSource, type Placement } from "@/lib/design/placement";
import type { DesignArea } from "@/lib/design/design-area";
import { generate, refine } from "./actions";

type Scene = { productType: string; area: DesignArea; bases: Record<string, string> };
function download(value: unknown, name: string) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }));
  const a = document.createElement("a"); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
}
export default function Review({ storeSlug, scenes }: { storeSlug: string; scenes: Scene[] }) {
  const [printAreas, setPrintAreas] = useState<PrintAreaProfile[]>([]);
  const [provider, setProvider] = useState("");
  const [configText, setConfigText] = useState("");
  const [sizes, setSizes] = useState<Record<string, ArtworkSource>>({});
  const [manifest, setManifest] = useState<FactoryManifest>();
  const [storedVersions, setStoredVersions] = useState<ReviewVersion[]>([]);
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
  const geometry = (item: ReviewVersion, productType: string) => {
    const src = item.image ? sizes[item.image] : undefined;
    const garment = scenes.find(s => s.productType === productType);
    const configured = printAreas.find(p => p.productType === productType && p.storeSlug === storeSlug && p.provider === provider && p.printAreaId === "front");
    const base = garment && Object.values(garment.bases).map(url => sizes[url]).find(Boolean);
    const target = configured?.canvas ?? (base && garment ? { width: base.width * garment.area.width, height: base.height * garment.area.height } : undefined);
    return src && target ? { source: src, canvas: target } : undefined;
  };
  const versions = constrainReviewPlacements(storedVersions, geometry);
  function setVersions(action: SetStateAction<ReviewVersion[]>) {
    setStoredVersions(items => typeof action === "function" ? action(constrainReviewPlacements(items, geometry)) : action);
  }
  const version = versions[selected];
  const requested = version?.placements?.[scene?.productType] ?? DEFAULT_PLACEMENT;
  const profile = printAreas.find(p => p.storeSlug === storeSlug && p.productType === scene?.productType && p.provider === provider && p.printAreaId === "front");
  const area = profile ? printBoundary(profile) : scene?.area;
  const source = version?.image ? sizes[version.image] : undefined;
  const photo = sizes[scene?.bases[color]];
  const canvas = profile?.canvas ?? (photo && area ? { width: photo.width * area.width, height: photo.height * area.height } : undefined);
  const layout = source && canvas ? constrainedPlacement(requested, source, canvas) : undefined;
  const placement = layout?.normalized ?? requested;
  useEffect(() => {
    let cancelled = false;
    for (const item of versions) if (item.image && !sizes[item.image]) {
      const url = item.image, img = new Image();
      img.onload = () => {
        try {
          const c = document.createElement("canvas"); c.width = img.naturalWidth; c.height = img.naturalHeight;
          const ctx = c.getContext("2d"); if (!ctx) throw new Error("Cannot measure artwork alpha");
          ctx.drawImage(img, 0, 0);
          const bounds = alphaBounds(ctx.getImageData(0, 0, c.width, c.height).data, c.width, c.height);
          if (!cancelled) setSizes(items => ({ ...items, [url]: { width: c.width, height: c.height, bounds } }));
        } catch (e) { if (!cancelled) setError(e instanceof Error ? e.message : "Cannot measure artwork"); }
      };
      img.onerror = () => { if (!cancelled) setError("Artwork could not load"); };
      img.src = url;
    }
    return () => { cancelled = true; };
  }, [versions, sizes]);
  function applyProfile() {
    try {
      const next = printAreaProfileSchema.parse(JSON.parse(configText));
      if (next.storeSlug !== storeSlug || next.productType !== scene?.productType) throw new Error("Profile must match tenant and garment");
      setPrintAreas(items => [...items.filter(p => !(p.productType === next.productType && p.provider === next.provider && p.printAreaId === next.printAreaId)), next]);
      setProvider(next.provider); setError("");
      setVersions(items => items.map(item => item.decision === "keep" ? { ...item, decision: "pending" } : item));
    } catch (e) { setError(e instanceof Error ? e.message : "Invalid profile"); }
  }
  function place(next: Placement, copy = false) {
    if (!scene || !version) return;
    if (!source || !canvas) return;
    setVersions(items => updateReviewPlacement(items, version.id, scene.productType, constrainedPlacement(next, source, canvas).normalized, copy));
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
      if (saved?.printAreas?.some(p => p.storeSlug !== storeSlug)) throw new Error("Profile belongs to another store");
      setPrintAreas(saved?.printAreas ?? []); setProvider(saved?.printAreas?.[0]?.provider ?? "");
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
      <button onClick={() => download({ format: "factory-review-1", manifest, versions, printAreas, production: { ready: false, reason: "Provider verification and physical dimensions remain required" } }, "factory-review.json")}>Export review and history</button>
      <div className="flex flex-wrap gap-3">
        <label>Garment <select value={sceneIndex} onChange={e => { setScene(Number(e.target.value)); setColor(0); }}>{scenes.map((s, i) => <option key={s.productType} value={i}>{s.productType}</option>)}</select></label>
        <button onClick={() => setColor(i => cycle(i, -1, colors.length))} disabled={!colors.length} aria-label="Previous shirt color">← Color</button>
        <span aria-live="polite">{color ?? "No existing blank garment assets configured"}</span>
        <button onClick={() => setColor(i => cycle(i, 1, colors.length))} disabled={!colors.length} aria-label="Next shirt color">Color →</button>
        <label><input type="checkbox" checked={raw} onChange={e => setRaw(e.target.checked)} /> Raw artwork</label>
      </div>
      <div tabIndex={0} aria-label="Artwork review; left and right arrows change shirt color" onKeyDown={e => { if (e.key === "ArrowLeft" || e.key === "ArrowRight") { e.preventDefault(); setColor(i => cycle(i, e.key === "ArrowLeft" ? -1 : 1, colors.length)); } }} onTouchStart={e => setTouch(e.changedTouches[0].clientX)} onTouchEnd={e => { if (touch !== undefined && Math.abs(e.changedTouches[0].clientX - touch) > 40) setColor(i => cycle(i, e.changedTouches[0].clientX < touch ? 1 : -1, colors.length)); }} className="relative mx-auto max-w-lg border">
        {!raw && color && <img src={scene.bases[color]} alt={`${scene.productType} blank shirt in ${color}`} className="block w-full" onLoad={e => { const img = e.currentTarget; setSizes(items => ({ ...items, [scene.bases[color]]: { width: img.naturalWidth, height: img.naturalHeight } })); }} onError={() => setError("Garment photograph could not load. Choose another color or raw artwork.")} />}
        {version?.image && !raw && color ? <div className="outline outline-1 outline-dashed outline-black/30" style={{ position: "absolute", left: `${area.x * 100}%`, top: `${area.y * 100}%`, width: `${area.width * 100}%`, height: `${area.height * 100}%`, overflow: "visible" }}>
          <img src={version.image} alt="Candidate artwork" style={layout && canvas ? { position: "absolute", left: `${layout.left / canvas.width * 100}%`, top: `${layout.top / canvas.height * 100}%`, width: `${layout.width / canvas.width * 100}%`, height: `${layout.height / canvas.height * 100}%`, maxWidth: "none", maxHeight: "none", opacity: 0.85 } : { visibility: "hidden" }} />
        </div> : version?.image ? <img src={version.image} alt="Candidate artwork" style={{ width: "100%", background: "repeating-conic-gradient(#ddd 0% 25%, white 0% 50%) 0 / 20px 20px" }} /> : <p>Planned revision — export for explicit image generation.</p>}
      </div>
      {scene && version && <fieldset className="space-y-3 border p-3">
        <legend>Artwork placement / {scene.productType} / shared across colors</legend>
        <p>Dashed boundary is the printable canvas. Visible artwork stays inside it, including faint alpha edges. Size and center values stop at the available limits; transparent PNG padding may extend outside. Imported out-of-range values are clamped. Reduce size to allow more movement.</p>
        {layout?.clipped && <p role="alert">Artwork exceeds printable canvas. Reduce size or move it. Production compositing is blocked to prevent clipping.</p>}
        <label className="block">Print provider (explicit identity)<input value={provider} onChange={e => { setProvider(e.target.value); setVersions(items => items.map(item => item.decision === "keep" ? { ...item, decision: "pending" } : item)); }} /></label>
        <p>{profile ? `${profile.canvas.width} ? ${profile.canvas.height} px / front` : "No scoped canvas configured; legacy geometry"}</p>
        {["shihtshirt", "shihtshirts", "shihttshirts"].includes(storeSlug) && <button disabled={!provider.trim() || !sizes[scene.bases[color]]} onClick={() => setConfigText(JSON.stringify({ storeSlug, productType: scene.productType, provider, printAreaId: "front", mockup: sizes[scene.bases[color]], canvas: { width: 4494, height: 5097 }, mapping: { x: 0.29, y: 0.24, width: 0.42, height: 0.50 } }, null, 2))}>Prepare Comfort Colors front preset; verify garment and mapping before applying</button>}
        <label className="block">Canvas and mockup mapping JSON<textarea className="block w-full border" value={configText} onChange={e => setConfigText(e.target.value)} /></label>
        <button onClick={() => setConfigText(JSON.stringify(profile ?? { storeSlug, productType: scene.productType, provider, printAreaId: "front", mockup: sizes[scene.bases[color]], canvas: { width: 1, height: 1 }, mapping: scene.area }, null, 2))}>Load current mapping</button>
        <button onClick={applyProfile}>Apply canvas / mapping</button>
        <button onClick={() => { setPrintAreas(items => items.filter(p => p !== profile)); setVersions(items => items.map(item => item.decision === "keep" ? { ...item, decision: "pending" } : item)); }}>Restore legacy boundary</button>
        {(["scale", "x", "y"] as const).map(key => <label key={key} className="block">
          {key === "scale" ? "Size" : key === "x" ? "Horizontal center" : "Vertical center"}: {Math.round(placement[key] * 100)}%
          <input className="block min-h-11 w-full" type="range" disabled={!layout} min={layout?.limits[key].min ?? 0} max={layout?.limits[key].max ?? 1} step="0.001" value={placement[key]} onChange={e => place({ ...placement, [key]: Number(e.target.value) })} />
        </label>)}
        <button className="min-h-11 border p-2" onClick={() => place({ ...DEFAULT_PLACEMENT })}>Reset placement</button>
        <button className="min-h-11 border p-2" onClick={() => place(placement, true)}>Copy to versions without a placement</button>
        <p>Production export not ready: provider verification and physical dimensions remain required. Keep records placement in the review export; it does not approve print readiness.</p>
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
