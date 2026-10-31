import { z } from "zod";

/** Center and scale relative to the garment print area, never scene pixels. */
export const placementSchema = z.object({
  version: z.literal(1),
  scale: z.number().finite().min(0.1).max(2),
  x: z.number().finite().min(0).max(1),
  y: z.number().finite().min(0).max(1),
}).strict();
export type Placement = z.infer<typeof placementSchema>;
export const DEFAULT_PLACEMENT: Placement = { version: 1, scale: 1, x: 0.5, y: 0.5 };
const dimensionsSchema = z.object({ width: z.number().finite().positive(), height: z.number().finite().positive() });
export type Dimensions = z.infer<typeof dimensionsSchema>;

/** Contain at scale=1, then translate. Clip to the area, preserving source aspect. */
export function placementLayout(value: Placement, source: Dimensions, area: Dimensions) {
  const p = placementSchema.parse(value);
  dimensionsSchema.parse(source); dimensionsSchema.parse(area);
  const ratio = Math.min(area.width / source.width, area.height / source.height) * p.scale;
  const width = source.width * ratio, height = source.height * ratio;
  const left = p.x * area.width - width / 2, top = p.y * area.height - height / 2;
  const clip = { left: Math.max(0, left), top: Math.max(0, top), right: Math.min(area.width, left + width), bottom: Math.min(area.height, top + height) };
  return { left, top, width, height, clip, clipped: left < 0 || top < 0 || left + width > area.width || top + height > area.height };
}

/** Metadata only. Ready coordinates do not certify artwork as print-ready. */
export function productionPlacement(placement: Placement, source: Dimensions, configured?: Dimensions & { provider: string; printAreaId: string }) {
  const normalized = placementSchema.parse(placement);
  dimensionsSchema.parse(source);
  if (!configured) return { normalized, ready: false as const, reason: "Provider print-area dimensions are not configured" };
  dimensionsSchema.parse(configured);
  if (!configured.provider.trim() || !configured.printAreaId.trim()) throw new Error("Provider and print area identity required");
  return { normalized, ready: true as const, provider: configured.provider, printAreaId: configured.printAreaId, canvas: { width: configured.width, height: configured.height }, layout: placementLayout(normalized, source, configured) };
}
export function serializePlacement(value: Placement) { return JSON.stringify(placementSchema.parse(value)); }

/** CSS equivalent of placementLayout; containment uses the image's native ratio. */
export function placementStyle(value: Placement) {
  const p = placementSchema.parse(value);
  return { position: "absolute" as const, left: `${p.x * 100}%`, top: `${p.y * 100}%`, width: `${p.scale * 100}%`, height: `${p.scale * 100}%`, transform: "translate(-50%, -50%)", objectFit: "contain" as const, opacity: 0.85 };
}
