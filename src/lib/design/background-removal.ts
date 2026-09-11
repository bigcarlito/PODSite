import "server-only";
import sharp from "sharp";
import { StoreError } from "@/lib/store/errors";

const CUTOUT_PRO_MATTING_URL = "https://www.cutout.pro/api/v1/matting?mattingType=6";

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

  return Buffer.from(await res.arrayBuffer());
}
