import "server-only";
import { DEFAULT_TEXT_MODEL, generateTextWithOpenRouter } from "@/lib/ai/openrouter";
import { extractDesignPalette, scoreGarmentColors, type GarmentColor } from "./palette";
import { COLOR_SCHEME_MAX_COLORS, type DesignAspects } from "./aspects";

/** Reject if the opaque region is under this share of the canvas — usually
 * means the art is a postage stamp, or generation returned near-nothing. */
const MIN_ALPHA_COVERAGE = 0.15;
/** Reject if the opaque region is over this share — usually means a
 * background leaked in (the "transparent background" instruction failed). */
const MAX_ALPHA_COVERAGE = 0.85;
/** A representative garment pair for the contrast check — the actual scene
 * colors used at mockup time can vary, but this is enough to catch a design
 * whose ink is simply the wrong tone for its designedForShade. */
const DARK_GARMENT: GarmentColor = { name: "dark", hex: "#101010" };
const LIGHT_GARMENT: GarmentColor = { name: "light", hex: "#f5f3ee" };
/** Below this, a design counts as illegible against its intended garment. */
const MIN_GARMENT_CONTRAST = 2.5;

export type QcCheck = { pass: boolean; detail: string };
export type QcResult = {
  pass: boolean;
  checks: {
    textFidelity: QcCheck;
    alphaCoverage: QcCheck;
    colorCount: QcCheck;
    contrastVsGarment: QcCheck;
  };
};

function normalizeText(s: string): string {
  return s.trim().toUpperCase().replace(/\s+/g, " ");
}

/**
 * Runs the QC gate against a design's native-resolution preview — cheap to
 * check and to reject before spending an upscale on a design that fails it
 * (see AGENTS.md's design-system notes). `imageUrl` must be publicly
 * fetchable (absolute), since both the palette extraction and the vision
 * transcription fetch it themselves.
 */
export async function runQcGate(
  imageUrl: string,
  aspects: DesignAspects,
  opts: { apiKey: string; textModel?: string }
): Promise<QcResult> {
  const palette = await extractDesignPalette(imageUrl);

  const alphaCoverage: QcCheck =
    palette.opaqueRatio < MIN_ALPHA_COVERAGE
      ? { pass: false, detail: `Only ${Math.round(palette.opaqueRatio * 100)}% opaque — likely a near-blank render` }
      : palette.opaqueRatio > MAX_ALPHA_COVERAGE
        ? { pass: false, detail: `${Math.round(palette.opaqueRatio * 100)}% opaque — likely a leaked background` }
        : { pass: true, detail: `${Math.round(palette.opaqueRatio * 100)}% opaque` };

  const maxColors = COLOR_SCHEME_MAX_COLORS[aspects.colorScheme];
  const significantColors = palette.colors.filter((c) => c.coverage >= 0.05);
  const colorCount: QcCheck =
    maxColors == null
      ? { pass: true, detail: `${aspects.colorScheme} has no fixed color cap` }
      : significantColors.length > maxColors
        ? {
            pass: false,
            detail: `${significantColors.length} significant colors found, but "${aspects.colorScheme}" promises at most ${maxColors}`,
          }
        : { pass: true, detail: `${significantColors.length} significant color(s), within the cap of ${maxColors}` };

  const garments =
    aspects.designedForShade === "dark"
      ? [DARK_GARMENT]
      : aspects.designedForShade === "light"
        ? [LIGHT_GARMENT]
        : [DARK_GARMENT, LIGHT_GARMENT];
  const fits = scoreGarmentColors(palette, garments, { minContrast: MIN_GARMENT_CONTRAST });
  const worstFit = fits.reduce((worst, f) => (f.minContrast < worst.minContrast ? f : worst), fits[0]);
  const contrastVsGarment: QcCheck = worstFit.fits
    ? { pass: true, detail: `Contrast ${worstFit.minContrast} vs ${worstFit.garment} garment` }
    : {
        pass: false,
        detail: `Contrast ${worstFit.minContrast} vs ${worstFit.garment} garment (${worstFit.worstColor}) is below ${MIN_GARMENT_CONTRAST}`,
      };

  let textFidelity: QcCheck;
  if (!aspects.phrase) {
    textFidelity = { pass: true, detail: "No phrase to check" };
  } else {
    const transcription = await generateTextWithOpenRouter({
      apiKey: opts.apiKey,
      model: opts.textModel || DEFAULT_TEXT_MODEL,
      imageUrl,
      prompt:
        `Transcribe exactly the words rendered as text/lettering in this image, ` +
        `nothing else — no description, just the text itself, verbatim. If there ` +
        `is no text in the image, respond with exactly "NONE".`,
    });
    const matches = normalizeText(transcription) === normalizeText(aspects.phrase);
    textFidelity = matches
      ? { pass: true, detail: "Rendered text matches phrase" }
      : { pass: false, detail: `Expected "${aspects.phrase}", model read "${transcription.trim()}"` };
  }

  const checks = { textFidelity, alphaCoverage, colorCount, contrastVsGarment };
  return { pass: Object.values(checks).every((c) => c.pass), checks };
}
