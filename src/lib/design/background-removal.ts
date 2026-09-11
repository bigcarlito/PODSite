import "server-only";
import sharp from "sharp";
import { StoreError } from "@/lib/store/errors";

const CUTOUT_PRO_MATTING_URL = "https://www.cutout.pro/api/v1/matting?mattingType=6";

/** How close a still-opaque pixel's color has to be to the image's
 * original background color (Euclidean RGB distance) to be treated as
 * background the matting API missed, and keyed transparent in the
 * cleanup pass below. Deliberately tight — this only mops up near-exact
 * leftover background, not anything a real ink color could plausibly be. */
const RESIDUAL_BACKGROUND_DISTANCE = 24;

function apiKeyOrThrow(): string {
  const apiKey = process.env.CUTOUT_PRO_API_KEY;
  if (!apiKey) {
    throw new StoreError(
      "MISSING_PROVIDER_CREDENTIALS",
      "CUTOUT_PRO_API_KEY is not configured.",
      { status: 422 }
    );
  }
  return apiKey;
}

/**
 * Some image models (e.g. Nano Banana / gemini-2.5-flash-image) don't
 * reliably honor a "transparent background" instruction — they render a
 * solid flat background instead, sometimes with enclosed "holes" (e.g.
 * the interior of a ring-shaped icon) that a naive edge-seeded flood
 * fill can never reach, since it only walks inward from the image
 * border. Rather than keep hand-tuning a color-distance heuristic, this
 * hands the image to Cutout.Pro's matting API — real background
 * segmentation, which handles enclosed holes correctly since it
 * understands foreground/background semantically rather than by color
 * distance from the border. A no-op (returns the input unchanged) if the
 * image already has meaningful transparency, so a provider that *does*
 * honor the instruction — and the API credits that would otherwise
 * cost — is skipped.
 */
export async function ensureTransparentBackground(data: Buffer): Promise<Buffer> {
  const { data: raw, info } = await sharp(data).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let hasTransparency = false;
  for (let i = 3; i < raw.length; i += info.channels) {
    if (raw[i] < 250) {
      hasTransparency = true;
      break;
    }
  }
  if (hasTransparency) return data;

  // Sampled before matting — background regions the API leaves opaque
  // (thin enclosed shapes seem prone to this — see the cleanup pass
  // below) are otherwise indistinguishable from real ink once returned.
  const backgroundColor: [number, number, number] = [raw[0], raw[1], raw[2]];

  const apiKey = apiKeyOrThrow();
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(data)], { type: "image/png" }), "design.png");

  const res = await fetch(CUTOUT_PRO_MATTING_URL, {
    method: "POST",
    headers: { APIKEY: apiKey },
    body: form,
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new StoreError(
      "AI_PROVIDER_ERROR",
      `Cutout.Pro background removal failed (HTTP ${res.status}): ${body}`,
      { status: 502 }
    );
  }

  // A non-2xx-but-still-200-with-JSON-error-body shape is common enough
  // among APIs like this to guard against explicitly, rather than
  // silently treating an error message's bytes as image data.
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const body = await res.text();
    throw new StoreError(
      "AI_PROVIDER_ERROR",
      `Cutout.Pro returned an unexpected response: ${body}`,
      { status: 502 }
    );
  }

  const matted = Buffer.from(await res.arrayBuffer());
  return stripResidualBackground(matted, backgroundColor);
}

/**
 * Real testing found Cutout.Pro's matting occasionally leaves thin
 * background-colored regions opaque (e.g. a ring icon's outline detail,
 * as opposed to its already-correctly-removed interior hole) — small
 * enough in area that the QC gate's own "significant color" coverage
 * filter (see qc.ts) doesn't catch it, but visible edited onto a
 * contrasting backdrop. This mops up anything still opaque that's very
 * close to the pre-matting background color, regardless of where it
 * sits in the image (no border-connectivity requirement, unlike the
 * flood-fill approach this replaced) — safe because the distance
 * threshold is tight enough that a real ink color is very unlikely to
 * fall within it.
 */
async function stripResidualBackground(
  matted: Buffer,
  backgroundColor: [number, number, number]
): Promise<Buffer> {
  const { data: raw, info } = await sharp(matted).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;

  for (let i = 0; i < raw.length; i += channels) {
    if (raw[i + 3] === 0) continue; // already transparent
    const dr = raw[i] - backgroundColor[0];
    const dg = raw[i + 1] - backgroundColor[1];
    const db = raw[i + 2] - backgroundColor[2];
    const distance = Math.sqrt(dr * dr + dg * dg + db * db);
    if (distance <= RESIDUAL_BACKGROUND_DISTANCE) {
      raw[i + 3] = 0;
    }
  }

  return sharp(raw, { raw: { width, height, channels } }).png().toBuffer();
}
