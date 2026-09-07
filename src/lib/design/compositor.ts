import "server-only";
import sharp from "sharp";
import { DEFAULT_DESIGN_AREA, type DesignArea } from "./design-area";

export type { DesignArea };

/** How opaque the design is over the base mockup, 0-1 — a shade under fully
 *  opaque so a little of the garment's own shading/wrinkles still shows
 *  through, rather than the design looking like a flat sticker. */
export const DESIGN_OVERLAY_OPACITY = 0.85;

/**
 * Deterministically composites a design onto a pre-generated (design-free)
 * base mockup: the design is scaled to fit inside `area` — a rectangle
 * given as fractions of the base image's own pixel dimensions — without
 * distorting its own aspect ratio, then alpha-blended on at `opacity`.
 * No AI call here; this is what makes design placement reproducible
 * across colors and runs, unlike asking an image model to "place it
 * naturally" each time.
 */
export async function compositeDesignOnScene(input: {
  baseImageUrl: string;
  designUrl: string;
  area?: DesignArea | null;
  opacity?: number;
}): Promise<{ data: Buffer; mimeType: string }> {
  const area = input.area ?? DEFAULT_DESIGN_AREA;
  const opacity = input.opacity ?? DESIGN_OVERLAY_OPACITY;

  const [baseRes, designRes] = await Promise.all([
    fetch(input.baseImageUrl),
    fetch(input.designUrl),
  ]);
  if (!baseRes.ok) {
    throw new Error(`Could not fetch base mockup image (HTTP ${baseRes.status})`);
  }
  if (!designRes.ok) {
    throw new Error(`Could not fetch design image (HTTP ${designRes.status})`);
  }

  const baseBuffer = Buffer.from(await baseRes.arrayBuffer());
  const designBuffer = Buffer.from(await designRes.arrayBuffer());

  const baseImage = sharp(baseBuffer);
  const baseMeta = await baseImage.metadata();
  const baseWidth = baseMeta.width;
  const baseHeight = baseMeta.height;
  if (!baseWidth || !baseHeight) {
    throw new Error("Could not read the base mockup image's dimensions");
  }

  const areaLeft = Math.round(area.x * baseWidth);
  const areaTop = Math.round(area.y * baseHeight);
  const areaWidth = Math.max(1, Math.round(area.width * baseWidth));
  const areaHeight = Math.max(1, Math.round(area.height * baseHeight));

  // "fit: inside" contains the design within the area without stretching
  // it — a design whose own aspect ratio doesn't exactly match the area
  // (e.g. a squarer design in a taller area) gets letterboxed, not squashed.
  const resized = await sharp(designBuffer)
    .resize(areaWidth, areaHeight, { fit: "inside", withoutEnlargement: true })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  // sharp's composite() has no per-layer opacity control, so bake it into
  // the design's own alpha channel before compositing.
  const { data, info } = resized;
  for (let i = 3; i < data.length; i += info.channels) {
    data[i] = Math.round(data[i] * opacity);
  }
  const fadedDesign = await sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png()
    .toBuffer();

  // Center the (possibly letterboxed) design within the target area.
  const left = areaLeft + Math.round((areaWidth - info.width) / 2);
  const top = areaTop + Math.round((areaHeight - info.height) / 2);

  const composited = await baseImage
    .composite([{ input: fadedDesign, left, top }])
    .jpeg({ quality: 90 })
    .toBuffer();

  return { data: composited, mimeType: "image/jpeg" };
}

/** Reads an image's natural pixel dimensions — used by the design-area
 *  editor to lock the rectangle to a reference design's aspect ratio. */
export async function getImageDimensions(url: string): Promise<{ width: number; height: number }> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Could not fetch image (HTTP ${res.status})`);
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  const { width, height } = await sharp(buffer).metadata();
  if (!width || !height) {
    throw new Error("Could not read the image's dimensions");
  }
  return { width, height };
}
