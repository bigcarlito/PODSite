import "server-only";
import sharp from "sharp";

/** Below this Euclidean RGB distance from the background color, a pixel
 * is treated as pure background (alpha 0). */
const FULLY_BACKGROUND_DISTANCE = 16;
/** Above this distance, a pixel is left fully opaque (its own alpha
 * unchanged) — also the flood-fill traversal radius, so antialiased
 * pixels between the two thresholds are reached and faded, not just the
 * solid fill. Between the two thresholds, alpha ramps up (see the t*t
 * easing below) rather than snapping straight to 255, so an antialiased
 * edge fades out instead of leaving a ring of fully-opaque near-
 * background pixels — which would otherwise both read as an extra
 * "color" and tank a contrast check against a similarly light garment,
 * since the QC gate's palette extraction (see palette.ts) only ignores
 * pixels below alpha 128, not merely non-zero ones. The eased (rather
 * than linear) ramp keeps more of the fringe under that 128 cutoff. */
const FULLY_FOREGROUND_DISTANCE = 55;

/**
 * Some image models (e.g. Nano Banana / gemini-2.5-flash-image) don't
 * reliably honor a "transparent background" instruction the way GPT
 * Image 1 or Ideogram do — they render a solid flat background instead
 * (see AGENTS.md's design-system provider-reconciliation notes). Rather
 * than trust the prompt, detect this after the fact and fix it: if the
 * image has no real alpha variation, flood-fill inward from every edge
 * pixel, keying out anything close enough to the border's own color —
 * with a smooth falloff across the antialiased boundary, not a hard cut.
 * A no-op (returns the input unchanged) if the image already has
 * meaningful transparency, so a provider that *does* honor the
 * instruction is never touched.
 */
export async function ensureTransparentBackground(data: Buffer): Promise<Buffer> {
  const { data: raw, info } = await sharp(data).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;

  const index = (x: number, y: number) => (y * width + x) * channels;

  let hasTransparency = false;
  for (let i = 3; i < raw.length; i += channels) {
    if (raw[i] < 250) {
      hasTransparency = true;
      break;
    }
  }
  if (hasTransparency) return data;

  const backgroundColor: [number, number, number] = [raw[0], raw[1], raw[2]];
  const colorDistance = (x: number, y: number): number => {
    const i = index(x, y);
    const dr = raw[i] - backgroundColor[0];
    const dg = raw[i + 1] - backgroundColor[1];
    const db = raw[i + 2] - backgroundColor[2];
    return Math.sqrt(dr * dr + dg * dg + db * db);
  };

  const visited = new Uint8Array(width * height);
  const stack: number[] = [];
  const pushIfInBounds = (x: number, y: number) => {
    if (x >= 0 && y >= 0 && x < width && y < height) stack.push(x, y);
  };
  for (let x = 0; x < width; x++) {
    pushIfInBounds(x, 0);
    pushIfInBounds(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    pushIfInBounds(0, y);
    pushIfInBounds(width - 1, y);
  }

  while (stack.length > 0) {
    const y = stack.pop()!;
    const x = stack.pop()!;
    const visitedIndex = y * width + x;
    if (visited[visitedIndex]) continue;
    visited[visitedIndex] = 1;

    const distance = colorDistance(x, y);
    if (distance > FULLY_FOREGROUND_DISTANCE) continue; // don't traverse past the fringe

    const alphaIndex = index(x, y) + 3;
    if (distance <= FULLY_BACKGROUND_DISTANCE) {
      raw[alphaIndex] = 0;
    } else {
      const t = (distance - FULLY_BACKGROUND_DISTANCE) / (FULLY_FOREGROUND_DISTANCE - FULLY_BACKGROUND_DISTANCE);
      raw[alphaIndex] = Math.round(raw[alphaIndex] * t * t);
    }

    pushIfInBounds(x + 1, y);
    pushIfInBounds(x - 1, y);
    pushIfInBounds(x, y + 1);
    pushIfInBounds(x, y - 1);
  }

  return sharp(raw, { raw: { width, height, channels } }).png().toBuffer();
}
