import "server-only";
import sharp from "sharp";

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
    .png()
    .toBuffer();

  return {
    data,
    mimeType: "image/png",
    width: MASTER_CANVAS_WIDTH,
    height: MASTER_CANVAS_HEIGHT,
  };
}
