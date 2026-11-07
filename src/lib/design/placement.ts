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

/** Pixel bounds include every nonzero-alpha pixel, including faint edge pixels. */
export type ArtworkSource = Dimensions & { bounds?: { left: number; top: number; width: number; height: number } };
export function alphaBounds(rgba: ArrayLike<number>, width: number, height: number) {
  dimensionsSchema.parse({ width, height });
  if (!Number.isInteger(width) || !Number.isInteger(height) || rgba.length !== width * height * 4) throw new Error("Invalid RGBA pixels");
  let left = width, top = height, right = 0, bottom = 0;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (rgba[(y * width + x) * 4 + 3] > 0) {
      left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x + 1); bottom = Math.max(bottom, y + 1);
    }
  }
  if (right <= left || bottom <= top) throw new Error("Artwork is fully transparent; choose a visible PNG");
  return { left, top, width: right - left, height: bottom - top };
}

/** Preserve v1 scale/center semantics; clamp the visible bounds, never clip pixels.
 * Missing alpha metadata conservatively treats the entire source as visible.
 * Use this same source metadata and layout for future production mapping.
 */
export function constrainedPlacement(value: Placement, source: ArtworkSource, area: Dimensions) {
  const p = placementSchema.parse(value);
  dimensionsSchema.parse(source); dimensionsSchema.parse(area);
  const b = source.bounds ?? { left: 0, top: 0, ...source };
  if (![b.left, b.top, b.width, b.height].every(Number.isFinite) || b.left < 0 || b.top < 0 || b.width <= 0 || b.height <= 0 || b.left + b.width > source.width || b.top + b.height > source.height) throw new Error("Invalid artwork alpha bounds");
  const base = Math.min(area.width / source.width, area.height / source.height);
  const maxScale = Math.min(2, area.width / (b.width * base), area.height / (b.height * base));
  const scale = Math.min(p.scale, maxScale), ratio = base * scale;
  const limits = {
    scale: { min: 0.1, max: maxScale },
    x: { min: (source.width / 2 - b.left) * ratio / area.width, max: 1 - (b.left + b.width - source.width / 2) * ratio / area.width },
    y: { min: (source.height / 2 - b.top) * ratio / area.height, max: 1 - (b.top + b.height - source.height / 2) * ratio / area.height },
  };
  for (const key of ["x", "y"] as const) { limits[key].min = Math.max(0, limits[key].min); limits[key].max = Math.min(1, limits[key].max); }
  const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
  const normalized: Placement = { ...p, scale, x: clamp(p.x, limits.x.min, limits.x.max), y: clamp(p.y, limits.y.min, limits.y.max) };
  const width = source.width * ratio, height = source.height * ratio;
  const left = normalized.x * area.width - width / 2, top = normalized.y * area.height - height / 2;
  return { normalized, limits, left, top, width, height,
    clip: { left: left + b.left * ratio, top: top + b.top * ratio, right: left + (b.left + b.width) * ratio, bottom: top + (b.top + b.height) * ratio }, clipped: false };
}

/** Metadata only. Ready coordinates do not certify artwork as print-ready. */
export function productionPlacement(placement: Placement, source: ArtworkSource, configured?: Dimensions & { provider: string; printAreaId: string }) {
  const normalized = placementSchema.parse(placement);
  dimensionsSchema.parse(source);
  if (!configured) return { normalized, ready: false as const, reason: "Provider print-area dimensions are not configured" };
  dimensionsSchema.parse(configured);
  if (!configured.provider.trim() || !configured.printAreaId.trim()) throw new Error("Provider and print area identity required");
  const layout = constrainedPlacement(normalized, source, configured);
  return { normalized: layout.normalized, ready: true as const, provider: configured.provider, printAreaId: configured.printAreaId, canvas: { width: configured.width, height: configured.height }, layout };
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
  baseImageUrl: z.string().min(1).optional(),
  mockup: dimensionsSchema,
  canvas: z.object({ width: z.number().int().positive().max(30000), height: z.number().int().positive().max(30000) }).strict(),
  mapping: z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1), width: z.number().positive().max(1), height: z.number().positive().max(1) }).strict()
    .refine(m => m.x + m.width <= 1 && m.y + m.height <= 1, "Boundary must fit the mockup"),
}).strict();
export type PrintAreaProfile = z.infer<typeof printAreaProfileSchema>;

/** Photograph mapping is independent of the provider pixel aspect. */
export function printBoundary(profile: PrintAreaProfile) {
  return printAreaProfileSchema.parse(profile).mapping;
}

export type CalibrationHandle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";
export function resizeBoundary(m: PrintAreaProfile["mapping"], handle: CalibrationHandle, dx: number, dy: number) {
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  let left = m.x, top = m.y, right = m.x + m.width, bottom = m.y + m.height;
  if (handle.includes("w")) left = clamp(left + dx, 0, right - .02);
  if (handle.includes("e")) right = clamp(right + dx, left + .02, 1);
  if (handle.includes("n")) top = clamp(top + dy, 0, bottom - .02);
  if (handle.includes("s")) bottom = clamp(bottom + dy, top + .02, 1);
  return { x: left, y: top, width: right - left, height: bottom - top };
}

export function mergeCalibration(storeSlug: string, profiles: PrintAreaProfile[], raw: unknown) {
  const next = printAreaProfileSchema.parse(raw);
  if (next.storeSlug !== storeSlug || profiles.some(p => p.storeSlug !== storeSlug)) throw new Error("Calibration belongs to another tenant");
  return [...profiles.filter(p => !(p.productType === next.productType && p.provider === next.provider && p.printAreaId === next.printAreaId && p.baseImageUrl === next.baseImageUrl)), next];
}

/** Reversible affine mapping. Canvas and photograph have independent aspect ratios. */
export function mapPrintPoint(point: { x: number; y: number }, profile: PrintAreaProfile, inverse = false) {
  const { canvas: c } = printAreaProfileSchema.parse(profile);
  const m = printBoundary(profile);
  return inverse ? { x: (point.x - m.x) / m.width * c.width, y: (point.y - m.y) / m.height * c.height }
    : { x: m.x + point.x / c.width * m.width, y: m.y + point.y / c.height * m.height };
}

/** One geometry for preview and future transparent PNG padding. Refuse clipping. */
export function printCanvasLayout(value: Placement, source: ArtworkSource, profile: PrintAreaProfile) {
  const { canvas } = printAreaProfileSchema.parse(profile);
  return constrainedPlacement(value, source, canvas);
}
export function printArtworkStyle(value: Placement, source: ArtworkSource, profile: PrintAreaProfile) {
  const box = printCanvasLayout(value, source, profile);
  return { position: "absolute" as const, left: `${box.left / profile.canvas.width * 100}%`, top: `${box.top / profile.canvas.height * 100}%`,
    width: `${box.width / profile.canvas.width * 100}%`, height: `${box.height / profile.canvas.height * 100}%`, maxWidth: "none", maxHeight: "none", opacity: 0.85 };
}
export function productionCanvasPlan(value: Placement, source: ArtworkSource, profile: PrintAreaProfile) {
  const layout = printCanvasLayout(value, source, profile);
  if (layout.clipped) throw new Error("Artwork exceeds printable canvas; reduce size or move it before compositing");
  return { canvas: profile.canvas, layout, background: { r: 0, g: 0, b: 0, alpha: 0 }, ready: false as const,
    reason: "Provider verification and physical print dimensions remain required; artwork is not production-ready" };
}
