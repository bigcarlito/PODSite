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

/** Local review configuration; pixel dimensions do not imply inches, DPI or verification. */
export const printAreaProfileSchema = z.object({
  storeSlug: z.string().min(1), productType: z.string().min(1),
  provider: z.string().trim().min(1), printAreaId: z.string().trim().min(1),
  mockup: dimensionsSchema,
  canvas: z.object({ width: z.number().int().positive().max(30000), height: z.number().int().positive().max(30000) }).strict(),
  mapping: z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1), width: z.number().positive().max(1), height: z.number().positive().max(1) }).strict()
    .refine(m => m.x + m.width <= 1 && m.y + m.height <= 1, "Boundary must fit the mockup"),
}).strict();
export type PrintAreaProfile = z.infer<typeof printAreaProfileSchema>;

/** Fit canvas inside the editable calibration rectangle without distorting artwork. */
export function printBoundary(profile: PrintAreaProfile) {
  const { canvas, mapping: m, mockup } = printAreaProfileSchema.parse(profile);
  const fit = Math.min(m.width * mockup.width / canvas.width, m.height * mockup.height / canvas.height);
  const width = canvas.width * fit / mockup.width, height = canvas.height * fit / mockup.height;
  return { x: m.x + (m.width - width) / 2, y: m.y, width, height };
}

/** Reversible affine mapping. Canvas and photograph have independent aspect ratios. */
export function mapPrintPoint(point: { x: number; y: number }, profile: PrintAreaProfile, inverse = false) {
  const { canvas: c } = printAreaProfileSchema.parse(profile);
  const m = printBoundary(profile);
  return inverse ? { x: (point.x - m.x) / m.width * c.width, y: (point.y - m.y) / m.height * c.height }
    : { x: m.x + point.x / c.width * m.width, y: m.y + point.y / c.height * m.height };
}

/** One geometry for preview and future transparent PNG padding. Refuse clipping. */
export function printCanvasLayout(value: Placement, source: Dimensions, profile: PrintAreaProfile) {
  const { canvas } = printAreaProfileSchema.parse(profile);
  return placementLayout(value, source, canvas);
}
export function printArtworkStyle(value: Placement, source: Dimensions, profile: PrintAreaProfile) {
  const box = printCanvasLayout(value, source, profile);
  return { position: "absolute" as const, left: `${box.left / profile.canvas.width * 100}%`, top: `${box.top / profile.canvas.height * 100}%`,
    width: `${box.width / profile.canvas.width * 100}%`, height: `${box.height / profile.canvas.height * 100}%`, maxWidth: "none", opacity: 0.85 };
}
export function productionCanvasPlan(value: Placement, source: Dimensions, profile: PrintAreaProfile) {
  const layout = printCanvasLayout(value, source, profile);
  if (layout.clipped) throw new Error("Artwork exceeds printable canvas; reduce size or move it before compositing");
  return { canvas: profile.canvas, layout, background: { r: 0, g: 0, b: 0, alpha: 0 }, ready: false as const,
    reason: "Provider verification and physical print dimensions remain required; artwork is not production-ready" };
}
