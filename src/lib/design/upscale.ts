import "server-only";
import sharp from "sharp";
import { alphaBounds, constrainedPlacement, type Placement, type Dimensions } from "./placement";

/**
 * The print-ready master canvas every downstream product variant derives
 * from — 4500×5400 PNG, transparent, sRGB. Satisfies Printful's current
 * full-front tee spec (4500×5400, 150 DPI min) and every provider on the
 * near-term roadmap at once (see AGENTS.md's design-system notes), so a
 * design is generated once and upscaled once, never re-upscaled per
 * provider. Deriving a provider's exact file at publish time is a
 * crop/resize of this canvas (see print-templates.ts), never a
 * regeneration.
 */
export const MASTER_CANVAS_WIDTH = 4500;
export const MASTER_CANVAS_HEIGHT = 5400;

/** Factory artwork is rasterized at its reviewed print-canvas placement.
 * The resulting transparent canvas is also the exact source for every mockup.
 */
export async function upscaleToPrintCanvas(input: Buffer, placement: Placement, canvas: Dimensions) {
  if (!Number.isInteger(canvas.width) || !Number.isInteger(canvas.height) || canvas.width <= 0 || canvas.height <= 0 || canvas.width * canvas.height > 50_000_000) throw new Error("Print canvas must contain at most 50 million pixels");
  const { data: pixels, info } = await sharp(input, { limitInputPixels: 25_000_000 }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const source = { width: info.width, height: info.height, bounds: alphaBounds(pixels, info.width, info.height) };
  const layout = constrainedPlacement(placement, source, canvas);
  if ((["scale", "x", "y"] as const).some(key => Math.abs(layout.normalized[key] - placement[key]) > 1e-8)) throw new Error("Placement requires containment changes; review and Keep again");
  const width = Math.max(1, Math.round(layout.width)), height = Math.max(1, Math.round(layout.height));
  const left = Math.round(layout.left), top = Math.round(layout.top);
  // Only transparent source padding can extend beyond the constrained ink bounds.
  const cropLeft = Math.max(0, -left), cropTop = Math.max(0, -top);
  const visibleWidth = Math.min(width - cropLeft, canvas.width - Math.max(0, left));
  const visibleHeight = Math.min(height - cropTop, canvas.height - Math.max(0, top));
  const artwork = await sharp(input).resize(width, height, { fit: "fill", kernel: "lanczos3" }).ensureAlpha()
    .extract({ left: cropLeft, top: cropTop, width: visibleWidth, height: visibleHeight }).png().toBuffer();
  const data = await sharp({ create: { width: canvas.width, height: canvas.height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: artwork, left: Math.max(0, left), top: Math.max(0, top) }])
    .png({ compressionLevel: 9, adaptiveFiltering: true }).toBuffer();
  return { data, width: canvas.width, height: canvas.height, mimeType: "image/png", source, placement: layout.normalized, method: "lanczos3" as const };
}

/**
 * No image model generates print-ready resolution natively, so a QC-passed
 * preview still needs one upscale before it's usable. Resizes (up or down)
 * to fit within the master canvas without distorting the design's own
 * aspect ratio, then pads with transparent pixels to the canvas's exact
 * fixed dimensions — every master is the same size regardless of source
 * aspect ratio, so a `PrintTemplate` lookup at publish time is always a
 * safe crop/resize, never an upscale past what's actually there.
 */
export async function upscaleToMasterCanvas(
  imageUrl: string
): Promise<{ data: Buffer; mimeType: string; width: number; height: number }> {
  const res = await fetch(imageUrl);
  if (!res.ok) {
    throw new Error(`Could not fetch image to upscale (HTTP ${res.status})`);
  }
  const input = Buffer.from(await res.arrayBuffer());

  const data = await sharp(input)
    .resize(MASTER_CANVAS_WIDTH, MASTER_CANVAS_HEIGHT, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
      kernel: "lanczos3",
    })
    // Max zlib compression — still lossless, just smaller, which matters
    // at 4500x5400: a busy/distressed design can otherwise clear
    // MAX_ASSET_BYTES (see assets.ts) at the default compression level.
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer();

  return {
    data,
    mimeType: "image/png",
    width: MASTER_CANVAS_WIDTH,
    height: MASTER_CANVAS_HEIGHT,
  };
}
