import "server-only";
import sharp from "sharp";
import { PRINT_RATIO_DIMENSIONS, type PrintRatio } from "./aspects";

/** Alpha below this is treated as empty canvas, not content, when finding
 * the artwork's bounding box. */
const ALPHA_FLOOR = 16;
/** Uniform breathing room added around the tight content bounding box,
 * as a fraction of that box's own (larger) dimension. */
const MARGIN_RATIO = 0.08;

/**
 * Image models tend to render with generous, inconsistent margins around
 * the actual artwork — a design might end up using only a fraction of its
 * own canvas. Rather than trust the prompt (see AGENTS.md's design-system
 * notes on why placement is deterministic, not AI-decided, throughout
 * this pipeline), this crops to the artwork's real content bounding box
 * plus a small fixed margin, then pads back out to the design's own
 * aspect ratio — so every design consistently fills its frame regardless
 * of how the model chose to compose it, and every downstream mockup
 * placement (any garment type, any MockupScene) benefits without needing
 * its own compensating adjustment. A no-op if the image is fully
 * transparent (nothing to tighten around).
 */
export async function tightenComposition(data: Buffer, aspectRatioBucket: PrintRatio): Promise<Buffer> {
  const { data: raw, info } = await sharp(data).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (raw[(y * width + x) * channels + 3] > ALPHA_FLOOR) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return data; // fully transparent — nothing to tighten around

  const contentWidth = maxX - minX + 1;
  const contentHeight = maxY - minY + 1;
  const centerX = minX + contentWidth / 2;
  const centerY = minY + contentHeight / 2;

  const margin = Math.max(contentWidth, contentHeight) * MARGIN_RATIO;
  let targetWidth = contentWidth + margin * 2;
  let targetHeight = contentHeight + margin * 2;

  const { width: ratioW, height: ratioH } = PRINT_RATIO_DIMENSIONS[aspectRatioBucket];
  const targetRatio = ratioW / ratioH;
  if (targetWidth / targetHeight > targetRatio) {
    targetHeight = targetWidth / targetRatio;
  } else {
    targetWidth = targetHeight * targetRatio;
  }

  const left = Math.round(centerX - targetWidth / 2);
  const top = Math.round(centerY - targetHeight / 2);
  const w = Math.round(targetWidth);
  const h = Math.round(targetHeight);

  // The desired crop rectangle can extend past the source image's own
  // bounds (a design whose content already sits near an edge) — extract
  // only the overlapping region, then pad the shortfall on each side
  // with transparency, rather than failing or silently clamping content
  // off-center.
  const extractLeft = Math.max(0, left);
  const extractTop = Math.max(0, top);
  const extractWidth = Math.max(1, Math.min(width, left + w) - extractLeft);
  const extractHeight = Math.max(1, Math.min(height, top + h) - extractTop);

  const cropped = await sharp(raw, { raw: { width, height, channels } })
    .extract({ left: extractLeft, top: extractTop, width: extractWidth, height: extractHeight })
    .png()
    .toBuffer();

  const padLeft = Math.max(0, extractLeft - left);
  const padTop = Math.max(0, extractTop - top);
  const padRight = Math.max(0, w - extractWidth - padLeft);
  const padBottom = Math.max(0, h - extractHeight - padTop);

  return sharp(cropped)
    .extend({
      top: padTop,
      bottom: padBottom,
      left: padLeft,
      right: padRight,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();
}
