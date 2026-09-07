import "server-only";
import sharp from "sharp";

export type DesignColor = {
  hex: string;
  /** Share of the design's *opaque* pixels this color accounts for, 0-1. */
  coverage: number;
};

export type DesignPalette = {
  colors: DesignColor[];
  /** Share of the whole canvas that is opaque — a sanity check that the
   *  background was actually removed (a value near 1 means it wasn't). */
  opaqueRatio: number;
};

export type GarmentColor = { name: string; hex: string };

export type GarmentFit = {
  garment: string;
  hex: string;
  /** Worst contrast between this garment and any significant design color. */
  minContrast: number;
  /** The design color responsible for that worst contrast. */
  worstColor: string;
  fits: boolean;
};

/** Minimum WCAG contrast for a design to count as legible on a garment. */
export const DEFAULT_MIN_CONTRAST = 2;
/** Design colors below this share of the artwork can't veto a garment. */
export const DEFAULT_MIN_COVERAGE = 0.05;

/** Pixels below this alpha are treated as background, not design. */
const ALPHA_FLOOR = 128;
/** Channel values are bucketed this coarsely so near-identical shades merge. */
const BUCKET = 32;

function toHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

function parseHex(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) {
    throw new Error(`Invalid hex color: "${hex}"`);
  }
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

/** WCAG relative luminance (sRGB, gamma-corrected). */
export function relativeLuminance(hex: string): number {
  const [r, g, b] = parseHex(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two colors, 1 (identical) to 21 (black/white). */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Reads a design image (typically a transparent PNG) and returns its
 * dominant colors by share of opaque pixels. Transparent pixels are
 * ignored so the background never counts as a design color — that
 * distinction is the whole point: a design's *ink* is what has to stand
 * out against a garment, not its empty space.
 */
export async function extractDesignPalette(
  imageUrl: string,
  opts?: { maxColors?: number }
): Promise<DesignPalette> {
  const res = await fetch(imageUrl);
  if (!res.ok) {
    throw new Error(`Could not fetch design image (HTTP ${res.status})`);
  }
  const input = Buffer.from(await res.arrayBuffer());

  // Downsampled: we want color distribution, not detail, and this keeps
  // the pixel loop bounded regardless of the source being print-res.
  const { data, info } = await sharp(input)
    .resize(200, 200, { fit: "inside", withoutEnlargement: true })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const buckets = new Map<number, { count: number; r: number; g: number; b: number }>();
  let opaque = 0;

  for (let i = 0; i < data.length; i += info.channels) {
    const alpha = data[i + 3];
    if (alpha < ALPHA_FLOOR) continue;
    opaque++;

    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const key =
      (Math.floor(r / BUCKET) << 10) |
      (Math.floor(g / BUCKET) << 5) |
      Math.floor(b / BUCKET);

    const bucket = buckets.get(key);
    if (bucket) {
      bucket.count++;
      bucket.r += r;
      bucket.g += g;
      bucket.b += b;
    } else {
      buckets.set(key, { count: 1, r, g, b });
    }
  }

  const totalPixels = data.length / info.channels;
  if (opaque === 0) {
    return { colors: [], opaqueRatio: 0 };
  }

  const colors = [...buckets.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, opts?.maxColors ?? 6)
    .map((bucket) => ({
      // Average the bucket's real pixels rather than snapping to the
      // bucket corner, so the reported hex matches what's actually there.
      hex: toHex(
        Math.round(bucket.r / bucket.count),
        Math.round(bucket.g / bucket.count),
        Math.round(bucket.b / bucket.count)
      ),
      coverage: bucket.count / opaque,
    }));

  return { colors, opaqueRatio: opaque / totalPixels };
}

/**
 * Decides which garment colors a design reads well on. Checks *every*
 * significant color in the design, not just the dominant one: a design
 * whose main body is dark but which is outlined in white still disappears
 * at the edges on a white shirt, and only the per-color minimum catches
 * that.
 */
export function scoreGarmentColors(
  palette: DesignPalette,
  garments: GarmentColor[],
  opts?: { minContrast?: number; minCoverage?: number }
): GarmentFit[] {
  const minContrast = opts?.minContrast ?? DEFAULT_MIN_CONTRAST;
  const minCoverage = opts?.minCoverage ?? DEFAULT_MIN_COVERAGE;

  // Ignore trace colors (antialiased edges, stray pixels) — otherwise a
  // handful of blended pixels would veto an otherwise fine garment.
  const significant = palette.colors.filter((c) => c.coverage >= minCoverage);

  return garments.map((garment) => {
    if (significant.length === 0) {
      return {
        garment: garment.name,
        hex: garment.hex,
        minContrast: 0,
        worstColor: "",
        fits: false,
      };
    }

    let worst = significant[0];
    let worstRatio = contrastRatio(worst.hex, garment.hex);
    for (const color of significant.slice(1)) {
      const ratio = contrastRatio(color.hex, garment.hex);
      if (ratio < worstRatio) {
        worst = color;
        worstRatio = ratio;
      }
    }

    return {
      garment: garment.name,
      hex: garment.hex,
      minContrast: Math.round(worstRatio * 100) / 100,
      worstColor: worst.hex,
      fits: worstRatio >= minContrast,
    };
  });
}
