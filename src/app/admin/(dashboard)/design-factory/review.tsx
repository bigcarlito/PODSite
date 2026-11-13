"use client";
/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState, type CSSProperties, type SetStateAction } from "react";
import { factoryManifestSchema, type FactoryManifest } from "@/lib/design/factory";
import { cycle, keepReviewedVersion, constrainReviewPlacements, updateReviewPlacement, reviewFileSchema, type ReviewVersion } from "@/lib/design/factory-review";
import { DEFAULT_PLACEMENT, alphaBounds, constrainedPlacement, printAreaProfileSchema, printBoundary, mergeCalibration, sharedReviewCalibrations, type PrintAreaProfile, type ArtworkSource, type Placement } from "@/lib/design/placement";
import type { DesignArea } from "@/lib/design/design-area";
import Calibration from "./calibration";
import DraftProductForm, { type Settings } from "./draft-product";
import { generate, refine, saveCalibration } from "./actions";
import styles from "./review.module.css";

type Scene = { defaultPriceCents?: number | null; productType: string; area: DesignArea; bases: Record<string, string> };
function download(value: unknown, name: string) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }));
  const a = document.createElement("a"); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
}
export default function Review({ storeSlug, scenes, initialPrintAreas }: { storeSlug: string; scenes: Scene[]; initialPrintAreas: PrintAreaProfile[] }) {
  const [draftSettings, setDraftSettings] = useState<Record<string, Settings>>({});
  const dialog = useRef<HTMLDialogElement>(null);
  const [handoff, setHandoff] = useState<{ version: ReviewVersion; productType: string }>();
  useEffect(() => { if (handoff) dialog.current?.showModal(); }, [handoff]);
  const [storedPrintAreas, setPrintAreas] = useState<PrintAreaProfile[]>(initialPrintAreas);
  const [provider, setProvider] = useState(initialPrintAreas[0]?.provider ?? "");
  const [draft, setDraft] = useState<PrintAreaProfile>();
  const [saving, setSaving] = useState(false);
  const [configText, setConfigText] = useState("");
  const [sizes, setSizes] = useState<Record<string, ArtworkSource>>({});
  const [manifest, setManifest] = useState<FactoryManifest>();
  const [storedVersions, setStoredVersions] = useState<ReviewVersion[]>([]);
  const [selected, setSelected] = useState(0);
  const [showDecided, setShowDecided] = useState(false);
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
  const printAreas = scenes.reduce((profiles, garment) => sharedReviewCalibrations(storeSlug, profiles, garment.productType, provider, garment.bases).profiles, storedPrintAreas);
  const geometry = (item: ReviewVersion, productType: string) => {
    const src = item.image ? sizes[item.image] : undefined;
    const garment = scenes.find(s => s.productType === productType);
    const configured = garment ? sharedReviewCalibrations(storeSlug, printAreas, productType, provider, garment.bases).shared : undefined;
    const base = garment && sizes[Object.values(garment.bases)[0]];
    const target = configured?.canvas ?? (base && garment ? { width: base.width * garment.area.width, height: base.height * garment.area.height } : undefined);
    return src && target ? { source: src, canvas: target } : undefined;
  };
  const versions = constrainReviewPlacements(storedVersions, geometry);
  function setVersions(action: SetStateAction<ReviewVersion[]>) {
    setStoredVersions(items => typeof action === "function" ? action(constrainReviewPlacements(items, geometry)) : action);
  }
  const visibleIndices = versions.flatMap((item, index) => showDecided || (item.decision !== "keep" && item.decision !== "reject") ? [index] : []);
  const currentIndex = visibleIndices.includes(selected) ? selected : (visibleIndices.find(index => index >= selected) ?? visibleIndices[0]);
  const visibleIndex = visibleIndices.indexOf(currentIndex);
  const version = versions[currentIndex];
  const requested = version?.placements?.[scene?.productType] ?? DEFAULT_PLACEMENT;
  const profile = scene ? sharedReviewCalibrations(storeSlug, printAreas, scene.productType, provider, scene.bases).shared : undefined;
  const area = profile ? printBoundary(profile) : scene?.area;
  const source = version?.image ? sizes[version.image] : undefined;
  const photo = sizes[scene?.bases[color]];
  const referencePhoto = sizes[Object.values(scene?.bases ?? {})[0]];
  const canvas = profile?.canvas ?? (referencePhoto && area ? { width: referencePhoto.width * area.width, height: referencePhoto.height * area.height } : undefined);
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
  function decide(decision: "keep" | "refine" | "reject") {
    if (!version) return;
    if (decision === "keep" && (!scene || !layout || raw || !photo)) {
      setError("Load the source PNG and garment photograph, then review placement on the garment before Keep."); return;
    }
    const reviewed: ReviewVersion = decision === "keep" ? keepReviewedVersion(version, scene.productType, placement) : { ...version, decision, decisions: [...(version.decisions ?? []), { decision, at: new Date().toISOString() }] };
    setVersions(items => items.map(item => item.id === version.id ? reviewed : item));
    if (decision === "keep") setHandoff({ version: reviewed, productType: scene.productType });
  }
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
      if (saved?.printAreas?.length) { setPrintAreas(saved.printAreas); setProvider(saved.printAreas[0].provider); }
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
  return <main className={`${styles.studio} space-y-4`}>
    <div hidden aria-hidden="true">{colors.map(name => <img key={`${scene.productType}-${name}`} src={scene.bases[name]} alt="" loading="eager" onLoad={e => { const img = e.currentTarget; setSizes(items => ({ ...items, [scene.bases[name]]: { width: img.naturalWidth, height: img.naturalHeight } })); }} />)}</div>
    <h1 className="text-2xl font-bold">Design Factory review</h1>
    <p>Human decisions only. Preview artwork is not print-ready. Export review artwork and decisions before leaving. Saved photo calibrations persist in tenant configuration.</p>
    <label className={styles.importPanel}>Import manifest + preview PNGs, or an exported review <input type="file" disabled={busy} multiple accept=".json,.png" onChange={e => void importFiles(e.target.files)} /></label>
    <p role="alert">{error}</p>
    {manifest && <>
      <label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={showDecided} disabled={!!draft || busy || saving} onChange={e => { setShowDecided(e.target.checked); select(currentIndex ?? 0); }} /> Show kept/rejected designs</label>
      {!version && <p role="status">No undecided designs remaining. Turn on “Show kept/rejected designs” to review previous decisions.</p>}
      {version && <h2 className="text-lg font-semibold">{manifest.candidates.find(c => c.id === version?.candidateId)?.style.name} · {version?.id}</h2>}
      <button className={styles.primary} onClick={() => download({ format: "factory-review-1", manifest, versions, printAreas, production: { ready: false, reason: "Provider verification and physical dimensions remain required" } }, "factory-review.json")}>Export review and history</button>
      {version && <div className={styles.workspace}>
      <section className={styles.preview} aria-label="Live garment preview">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <label>Garment <select disabled={!!draft} value={sceneIndex} onChange={e => { setScene(Number(e.target.value)); setColor(0); }}>{scenes.map((s, i) => <option key={s.productType} value={i}>{s.productType}</option>)}</select></label>
        <button onClick={() => setColor(i => cycle(i, -1, colors.length))} disabled={!colors.length || !!draft} aria-label="Previous shirt color">← Color</button>
        <span aria-live="polite">{color ?? "No existing blank garment assets configured"}</span>
        <button onClick={() => setColor(i => cycle(i, 1, colors.length))} disabled={!colors.length || !!draft} aria-label="Next shirt color">Color →</button>
        <label><input type="checkbox" disabled={!!draft} checked={raw} onChange={e => setRaw(e.target.checked)} /> Raw artwork</label>
      </div>
      <div tabIndex={0} aria-label="Artwork review; left and right arrows change shirt color" onKeyDown={e => { if (!draft && (e.key === "ArrowLeft" || e.key === "ArrowRight")) { e.preventDefault(); setColor(i => cycle(i, e.key === "ArrowLeft" ? -1 : 1, colors.length)); } }} onTouchStart={e => !draft && setTouch(e.changedTouches[0].clientX)} onTouchEnd={e => { if (!draft && touch !== undefined && Math.abs(e.changedTouches[0].clientX - touch) > 40) setColor(i => cycle(i, e.changedTouches[0].clientX < touch ? 1 : -1, colors.length)); }} className={styles.frame} style={{ "--preview-width": photo ? `calc((100dvh - 12rem) * ${photo.width / photo.height})` : "28rem" } as CSSProperties}>
        {!raw && color && <img src={scene.bases[color]} alt={`${scene.productType} blank shirt in ${color}`} className="block w-full" onLoad={e => { const img = e.currentTarget; setSizes(items => ({ ...items, [scene.bases[color]]: { width: img.naturalWidth, height: img.naturalHeight } })); }} onError={() => setError("Garment photograph could not load. Choose another color or raw artwork.")} />}
        {version?.image && !raw && color ? <div className={draft ? "" : "outline outline-1 outline-dashed outline-sky-600"} style={{ position: "absolute", left: `${area.x * 100}%`, top: `${area.y * 100}%`, width: `${area.width * 100}%`, height: `${area.height * 100}%`, overflow: "visible" }}>
          <img src={version.image} alt="Candidate artwork" style={layout && canvas ? { position: "absolute", left: `${layout.left / canvas.width * 100}%`, top: `${layout.top / canvas.height * 100}%`, width: `${layout.width / canvas.width * 100}%`, height: `${layout.height / canvas.height * 100}%`, maxWidth: "none", maxHeight: "none", opacity: 0.85 } : { visibility: "hidden" }} />
        </div> : version?.image ? <img src={version.image} alt="Candidate artwork" style={{ width: "100%", background: "repeating-conic-gradient(#ddd 0% 25%, white 0% 50%) 0 / 20px 20px" }} /> : <p>Planned revision — export for explicit image generation.</p>}
        {draft && !raw && <Calibration profile={draft} onChange={setDraft} />}
      </div>
      <p className="mt-2 text-xs text-muted">Dashed blue outline: print area. Use arrow keys or swipe the preview to compare colors.</p>
      </section>
      {scene && version && <fieldset className={styles.controls}>
        <legend className="font-semibold">Artwork placement</legend>
        <label className="block">Print provider (required for calibration)<input disabled={!!draft || saving} placeholder="Enter provider name" value={provider} onChange={e => { setProvider(e.target.value); setVersions(items => items.map(item => item.decision === "keep" ? { ...item, decision: "pending" } : item)); }} /></label>
        <p id="calibration-help" className={styles.help}>{!provider.trim() ? "Enter the provider name above to enable Edit Print Area. This identifies the calibration; it does not contact a provider." : raw ? "Turn off Raw artwork to edit the print area on the garment photograph." : !photo ? "Choose a color with a loaded garment photograph to edit its print area." : "Adjust the photo boundary using handles or numeric fields, then save and apply. New calibrations use a 4494 x 5097 px canvas."}</p>
        <button className={styles.primary} aria-describedby="calibration-help" disabled={!!draft || !photo || !provider.trim() || raw || saving} onClick={() => setDraft({ ...(profile ?? { storeSlug, productType: scene.productType, provider, printAreaId: "front", mockup: photo!, canvas: { width: 4494, height: 5097 }, mapping: scene.area }), baseImageUrl: profile?.baseImageUrl ?? scene.bases[color] })}>Edit Print Area</button>
        {draft && <fieldset disabled={saving} className="space-y-2 border p-2">
          <legend>Photo boundary</legend>
          <p>Drag handles or use arrow keys (Shift: larger step). Artwork stays fixed while editing. Print canvas: {draft.canvas.width} x {draft.canvas.height} px. Photo aspect is independent.</p>
          {(["x", "y", "width", "height"] as const).map(key => <label className="block" key={key}>{key}<input type="number" min="0" max="1" step="0.001" value={draft.mapping[key]} onChange={e => { const next = printAreaProfileSchema.safeParse({ ...draft, mapping: { ...draft.mapping, [key]: Number(e.target.value) } }); if (next.success) setDraft(next.data); }} /></label>)}
          <button onClick={() => setDraft({ ...draft, mapping: profile?.mapping ?? scene.area })}>Reset boundary</button>
          <button onClick={() => setDraft(undefined)}>Cancel calibration</button>
          <p>Save explicitly remaps artwork into this boundary, retaining print-space placement and alpha containment. Photo size/position may change. Keep decisions are invalidated for review. No ink is cropped.</p>
          <button className={styles.primary} onClick={async () => { setSaving(true); setError(""); try { const saved = await saveCalibration(draft); setPrintAreas(items => mergeCalibration(storeSlug, items.map(p => p.storeSlug === saved.storeSlug && p.productType === saved.productType && p.provider === saved.provider && p.printAreaId === saved.printAreaId ? { ...p, canvas: saved.canvas, mapping: saved.mapping } : p), saved)); setStoredVersions(items => items.map(item => item.decision === "keep" ? { ...item, decision: "pending" } : item)); setDraft(undefined); } catch { setError("Calibration save failed; draft retained. Retry before leaving."); } finally { setSaving(false); } }}>{saving ? "Saving calibration..." : "Save and apply remapping"}</button>
        </fieldset>}

        <p className="text-sm">{scene.productType} ? Shared across colors</p>
        <p id="placement-help" className="text-sm text-muted">Centering, scale and the print area are shared across all colors of this design and garment. Changes preview live. Visible ink stays inside the print area. Reduce scale for more movement.</p>
        {layout?.clipped && <p role="alert">Artwork exceeds printable canvas. Reduce size or move it. Production compositing is blocked to prevent clipping.</p>}
        {(["scale", "x", "y"] as const).map(key => <label key={key} className="block">
          <span className="flex justify-between gap-2"><span>{key === "scale" ? "Scale" : key === "x" ? "Horizontal center" : "Vertical center"}</span><output htmlFor={`placement-${key}`} className="tabular-nums">{(placement[key] * 100).toFixed(1)}%</output></span>
          <input className="block min-h-11 w-full" id={`placement-${key}`} aria-describedby="placement-help" aria-valuetext={`${(placement[key] * 100).toFixed(1)} percent`} type="range" disabled={!layout || !!draft} min={layout?.limits[key].min ?? 0} max={layout?.limits[key].max ?? 1} step="0.001" value={placement[key]} onChange={e => place({ ...placement, [key]: Number(e.target.value) })} />
        </label>)}
        <button className="min-h-11 border p-2" disabled={!layout || !!draft} onClick={() => place({ ...DEFAULT_PLACEMENT })}>Reset placement</button>
        <button className="min-h-11 border p-2" disabled={!layout || !!draft} onClick={() => place(placement, true)}>Copy to versions without a placement</button>
        <p className="text-xs text-muted">Production export not ready: provider verification and physical dimensions remain required. Keep records placement in the review export; it does not approve print readiness.</p>
      </fieldset>}
      </div>}
      {scene && version && <details className="rounded-lg border p-3"><summary className="min-h-11 cursor-pointer font-medium">Canvas calibration and provider configuration (advanced JSON)</summary><div className="space-y-3 pt-3">
        <p>{profile ? `${profile.canvas.width} ? ${profile.canvas.height} px / front` : "No scoped canvas configured; legacy geometry"}</p>
        {["shihtshirt", "shihtshirts", "shihttshirts"].includes(storeSlug) && <button disabled={!provider.trim() || !sizes[scene.bases[color]]} onClick={() => setConfigText(JSON.stringify({ storeSlug, productType: scene.productType, provider, printAreaId: "front", mockup: sizes[scene.bases[color]], canvas: { width: 4494, height: 5097 }, mapping: { x: 0.29, y: 0.24, width: 0.42, height: 0.50 } }, null, 2))}>Prepare Comfort Colors front preset; verify garment and mapping before applying</button>}
        <label className="block">Canvas and mockup mapping JSON<textarea className="block w-full border" value={configText} onChange={e => setConfigText(e.target.value)} /></label>
        <button onClick={() => setConfigText(JSON.stringify(profile ?? { storeSlug, productType: scene.productType, provider, printAreaId: "front", mockup: sizes[scene.bases[color]], canvas: { width: 1, height: 1 }, mapping: scene.area }, null, 2))}>Load current mapping</button>
        <button onClick={applyProfile}>Apply canvas / mapping</button>
        <button onClick={() => { setPrintAreas(items => items.filter(p => !(p.storeSlug === storeSlug && p.productType === scene.productType && p.provider === provider && p.printAreaId === "front"))); setVersions(items => items.map(item => item.decision === "keep" ? { ...item, decision: "pending" } : item)); }}>Restore legacy boundary</button>
      </div></details>}
      <h2 className={styles.sectionTitle}>Review decisions</h2><p>Review contrast, small lettering and edges on each real shirt color. Alpha is preserved; opaque source backgrounds remain visible. This visual check grants no print readiness.</p>
      <div className="flex flex-wrap items-center gap-4"><button disabled={!version || !!draft || busy} onClick={() => select(visibleIndices[cycle(visibleIndex, -1, visibleIndices.length)])}>← Candidate/version</button><span aria-live="polite">{version ? visibleIndex + 1 : 0} / {visibleIndices.length}{version ? ` · ${version.decision}` : ""}</span><button disabled={!version || !!draft || busy} onClick={() => select(visibleIndices[cycle(visibleIndex, 1, visibleIndices.length)])}>Candidate/version →</button></div>
      <div className="flex flex-wrap items-center gap-4"><button className={styles.primary} disabled={!version || !!draft || saving} onClick={() => decide("keep")}>Keep</button><button className={styles.destructive} disabled={!version || !!draft || saving} onClick={() => decide("reject")}>Reject</button></div>
      {version?.decision === "keep" && !draft && !saving && <button onClick={() => setHandoff({ version, productType: scene.productType })}>Create Draft Product</button>}
      <dialog ref={dialog} aria-labelledby="draft-dialog-title" className={styles.draftDialog} onClose={() => setHandoff(undefined)}>
        <h2 id="draft-dialog-title">Create Draft Product</h2>
        <button autoFocus onClick={() => dialog.current?.close()} aria-label="Close Create Draft Product">Cancel / close</button>
        {handoff && <>
          <p>Version: {handoff.version.id}. Reviewed placement: {handoff.version.placements?.[handoff.productType] ? JSON.stringify(handoff.version.placements[handoff.productType]) : "Missing: close and review placement on this garment, then Keep."}</p>
          <DraftProductForm key={`${handoff.version.id}-${handoff.productType}`} garments={[handoff.productType]} initial={draftSettings[`${handoff.version.id}-${handoff.productType}`] ?? { title: "", description: "", productType: handoff.productType, colors: ["Ivory", "Blossom", "Butter", "Bay", "Espresso"].filter(c => !!scenes.find(s => s.productType === handoff.productType)?.bases[c]), sizes: ["S", "M", "L", "XL"], priceCents: scenes.find(s => s.productType === handoff.productType)?.defaultPriceCents ?? 3200, currency: "USD" }} onSettingsChange={settings => setDraftSettings(items => ({ ...items, [`${handoff.version.id}-${handoff.productType}`]: settings }))} evidence={{ manifest, version: handoff.version, ancestors: versions.filter(v => v.id !== handoff.version.id).map(v => ({ ...v, image: undefined })), printAreas: printAreas.filter(p => p.productType === handoff.productType && p.provider === provider) }} />
        </>}
      </dialog>
      <p>Draft handoff requires Keep, matching artwork hashes, explicit garment placement, and a shared reviewed front calibration for the garment. It never approves print readiness.</p>
      <label className="block">Creative feedback<textarea className="block w-full border" value={feedback} maxLength={1500} onChange={e => setFeedback(e.target.value)} /></label>
      <label className="block">Preserve these aspects<textarea className="block w-full border" value={preserve} maxLength={2000} onChange={e => setPreserve(e.target.value)} /></label>
      <button disabled={!version || busy || !feedback.trim() || !preserve.trim() || versions.length >= 50} onClick={() => void revise()}>{busy ? "Revising…" : "Refine — prepare prompt (uses text-model credits)"}</button>
      {version?.parentId && !version.image && <div className="space-y-2 border p-3"><p>Review the revised prompt below before generating. One paid image attempt; no retries or publishing. Server operator enablement required.</p><label><input type="checkbox" checked={approved} onChange={e => setApproved(e.target.checked)} /> I separately approve spending image credits for this revision.</label><button className="block" disabled={busy || !approved} onClick={() => void generateImage()}>Generate this version</button></div>}
      <details><summary>Prompt, rationale and lineage</summary><pre className="whitespace-pre-wrap">{JSON.stringify(version, (key, value) => key === "image" ? "[PNG preserved in export]" : value, 2)}</pre></details>
    </>}
  </main>;
}
