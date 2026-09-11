import "server-only";
import sharp from "sharp";

/** How close a pixel's color has to be to the sampled background color
 * (Euclidean distance in RGB) to be keyed out as background. */
const COLOR_TOLERANCE = 30;

/**
 * Some image models (e.g. Nano Banana / gemini-2.5-flash-image) don't
 * reliably honor a "transparent background" instruction the way GPT
 * Image 1 or Ideogram do — they render a solid flat background instead
 * (see AGENTS.md's design-system provider-reconciliation notes). Rather
 * than trust the prompt, detect this after the fact and fix it: if the
 * image has no real alpha variation, flood-fill inward from every edge
 * pixel, keying out anything close enough to the border's own color.
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
    if (colorDistance(x, y) > COLOR_TOLERANCE) continue;

    raw[index(x, y) + 3] = 0;
    pushIfInBounds(x + 1, y);
    pushIfInBounds(x - 1, y);
    pushIfInBounds(x, y + 1);
    pushIfInBounds(x, y - 1);
  }

  return sharp(raw, { raw: { width, height, channels } }).png().toBuffer();
}
