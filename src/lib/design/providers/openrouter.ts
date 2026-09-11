import "server-only";
import sharp from "sharp";
import {
  DEFAULT_DESIGN_MODEL,
  editImageWithOpenRouter,
  parseDataUrl,
} from "@/lib/ai/openrouter";
import { StoreError } from "@/lib/store/errors";
import { PRINT_RATIO_DIMENSIONS } from "../aspects";
import type { CompiledDesignPrompt } from "../prompt";
import { ensureTransparentBackground } from "../background-removal";
import { tightenComposition } from "../tighten-composition";
import type { GenerateDesignOpts, GeneratedDesignImage, ImageProvider } from "./types";

function apiKeyOrThrow(): string {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new StoreError("MISSING_PROVIDER_CREDENTIALS", "OPENROUTER_API_KEY is not configured.", {
      status: 422,
    });
  }
  return apiKey;
}

/**
 * Generates a design from a compiled prompt via OpenRouter's unified image
 * endpoint (the same client mockup-scenes.ts already uses to recolor scene
 * photos) — covers GPT Image 1 and Nano Banana today, since both are
 * reachable through OpenRouter with no separate integration. Ideogram (or
 * any provider needing its own API, native seed, or native negative-prompt
 * field) gets its own file implementing ImageProvider when a flight
 * actually needs it — this adapter is deliberately the only one for v1.
 */
export const openRouterImageProvider: ImageProvider = {
  name: "openrouter",

  async generate(
    spec: CompiledDesignPrompt,
    opts: GenerateDesignOpts
  ): Promise<GeneratedDesignImage> {
    const apiKey = apiKeyOrThrow();
    const model = opts.model || DEFAULT_DESIGN_MODEL;

    const { width, height } = PRINT_RATIO_DIMENSIONS[spec.aspectRatioBucket];
    const aspectHint = `Aspect ratio ${width}:${height}.`;
    // OpenRouter's chat-completions image endpoint has no native
    // negative-prompt field, so exclusions are folded into the prompt text
    // (same reconciliation GPT Image 1 / Nano Banana need per the plan).
    const exclusionsHint =
      spec.exclusions.length > 0 ? `Do not include: ${spec.exclusions.join(", ")}.` : "";
    const prompt = [spec.promptText, aspectHint, opts.negativePrompt, exclusionsHint]
      .filter(Boolean)
      .join(" ");

    const rawParams = { model, prompt, aspectRatioBucket: spec.aspectRatioBucket };

    const resultDataUrl = await editImageWithOpenRouter({ apiKey, model, prompt, images: [] });
    const parsed = parseDataUrl(resultDataUrl);
    // Some models (e.g. Nano Banana / gemini-2.5-flash-image) don't
    // reliably honor the "transparent background" instruction and render
    // a solid flat background instead — a no-op if the image already has
    // real transparency. Always PNG afterward, since a flood-filled alpha
    // channel can't round-trip through JPEG.
    const transparent = await ensureTransparentBackground(parsed.data);
    // Models tend to leave generous, inconsistent margins around the
    // actual artwork — crop to its real content and re-pad deterministically
    // rather than trust the prompt (see tighten-composition.ts).
    const data = await tightenComposition(transparent, spec.aspectRatioBucket);
    const mimeType = "image/png";
    const metadata = await sharp(data).metadata();
    if (!metadata.width || !metadata.height) {
      throw new StoreError("AI_PROVIDER_ERROR", "OpenRouter returned an image with no readable dimensions.", {
        status: 502,
      });
    }

    return {
      // Re-encoded as a data: URI so the caller (designs.ts) can persist it
      // via uploadStoreAsset the same way every other AI-generated image is
      // stored — this adapter never touches the database itself.
      imageUrl: `data:${mimeType};base64,${data.toString("base64")}`,
      width: metadata.width,
      height: metadata.height,
      // OpenRouter's image endpoint has no seed parameter to report back.
      rawParams,
    };
  },
};
