"use client";
import { useRef } from "react";
import { resizeBoundary, type CalibrationHandle, type PrintAreaProfile } from "@/lib/design/placement";

export default function Calibration({ profile, onChange }: { profile: PrintAreaProfile; onChange: (p: PrintAreaProfile) => void }) {
  const drag = useRef<{ x: number; y: number; mapping: PrintAreaProfile["mapping"]; handle: CalibrationHandle; width: number; height: number } | null>(null);
  const m = profile.mapping;
  return <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }} aria-label="Print boundary calibration">
    <div style={{ position: "absolute", left: `${m.x * 100}%`, top: `${m.y * 100}%`, width: `${m.width * 100}%`, height: `${m.height * 100}%`, border: "2px dashed #0284c7" }}>
      <span style={{ position: "absolute", bottom: "100%", background: "white", color: "#075985", fontSize: 12 }}>Front print boundary</span>
      {(["nw", "n", "ne", "e", "se", "s", "sw", "w"] as CalibrationHandle[]).map(handle => <button key={handle} type="button" aria-label={`Resize print boundary ${handle}; arrow keys move edge, shift for larger steps`} style={{ position: "absolute", pointerEvents: "auto", touchAction: "none", padding: 0, minHeight: 24, width: 24, height: 24, border: "2px solid #075985", background: "white", color: "#075985", fontSize: 10, left: handle.includes("w") ? "0%" : handle.includes("e") ? "100%" : "50%", top: handle.includes("n") ? "0%" : handle.includes("s") ? "100%" : "50%", transform: "translate(-50%, -50%)" }}
        onPointerDown={e => { e.stopPropagation(); const rect = e.currentTarget.parentElement!.parentElement!.getBoundingClientRect(); drag.current = { x: e.clientX, y: e.clientY, mapping: m, handle, width: rect.width, height: rect.height }; e.currentTarget.setPointerCapture(e.pointerId); }}
        onPointerMove={e => { const d = drag.current; if (d) onChange({ ...profile, mapping: resizeBoundary(d.mapping, d.handle, (e.clientX - d.x) / d.width, (e.clientY - d.y) / d.height) }); }}
        onPointerUp={e => { e.stopPropagation(); drag.current = null; }} onPointerCancel={() => { drag.current = null; }}
        onKeyDown={e => { if (!e.key.startsWith("Arrow")) return; e.preventDefault(); e.stopPropagation(); const step = e.shiftKey ? .01 : .001; onChange({ ...profile, mapping: resizeBoundary(m, handle, e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0, e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0) }); }}>{handle.toUpperCase()}</button>)}
    </div>
  </div>;
}
