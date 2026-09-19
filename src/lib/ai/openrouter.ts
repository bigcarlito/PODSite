import "server-only";

const OPENROUTER_API_BASE = "https://openrouter.ai/api/v1";

/** Default OpenRouter model slug for AI mockup generation (recoloring a
 * MockupScene's garment photo — see mockup-scenes.ts), overridable per
 * call. Deliberately a separate env var from DEFAULT_DESIGN_MODEL below,
 * even though they may point at the same model in practice, since the
 * two tasks have different requirements (mockup recoloring doesn't need
 * transparency; design generation does) and should be tunable/A-B-able
 * independently. */
export const DEFAULT_MOCKUP_MODEL =
  process.env.OPENROUTER_MOCKUP_MODEL || "google/gemini-2.5-flash-image";

/** Default OpenRouter model slug for structured-design generation (see
 * src/lib/design/providers/openrouter.ts), overridable per call via
 * POST /api/agent/designs' `model` field. Stays gemini-2.5-flash-image by
 * default; `openai/gpt-image-1` reliably honors a transparent-background
 * instruction where this one doesn't, but needs OpenRouter's dedicated
 * images endpoint (see IMAGE_GENERATION_ENDPOINT_MODELS/
 * generateImageWithOpenRouter below) rather than the generic
 * chat-completions call every other model here uses, and doesn't yet
 * support this adapter's image-to-image edit mode — see providers/
 * openrouter.ts. gemini-2.5-flash-image's non-transparent background is
 * instead corrected after the fact by ensureTransparentBackground in
 * background-removal.ts. */
export const DEFAULT_DESIGN_MODEL =
  process.env.OPENROUTER_DESIGN_MODEL || "google/gemini-2.5-flash-image";

/** OpenRouter model slugs that must go through its dedicated images
 * endpoint (POST /images) instead of the chat-completions
 * `modalities: ["image", "text"]` shape every other model here uses —
 * requesting image output from these through chat/completions 404s with
 * "No endpoints found that support the requested output modalities".
 * A data change (add a slug here), never a new ImageProvider, since the
 * request/response shape below is otherwise identical to
 * editImageWithOpenRouter's. */
const IMAGE_GENERATION_ENDPOINT_MODELS = new Set(["openai/gpt-image-1"]);

export function usesOpenRouterImagesEndpoint(model: string): boolean {
  return IMAGE_GENERATION_ENDPOINT_MODELS.has(model);
}

/** Default OpenRouter model slug for text generation (product copy), overridable per call. */
export const DEFAULT_TEXT_MODEL = process.env.OPENROUTER_TEXT_MODEL || "google/gemini-2.5-flash";

type OpenRouterImageEditInput = {
  apiKey: string;
  model: string;
  prompt: string;
  /** Reference images in order (scene photo, then design) — URLs or data: URIs. */
  images: string[];
};

/**
 * Sends a multi-image edit instruction to an OpenRouter image-output model
 * (e.g. Gemini 2.5 Flash Image) via its OpenAI-compatible chat completions
 * endpoint, and returns the generated image as a data: URI.
 */
export async function editImageWithOpenRouter(input: OpenRouterImageEditInput): Promise<string> {
  const content: Array<Record<string, unknown>> = [{ type: "text", text: input.prompt }];
  for (const url of input.images) {
    content.push({ type: "image_url", image_url: { url } });
  }

  const res = await fetch(`${OPENROUTER_API_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: input.model,
      modalities: ["image", "text"],
      messages: [{ role: "user", content }],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`OpenRouter API error ${res.status}: ${body}`);
  }

  const json = await res.json();
  const images = json?.choices?.[0]?.message?.images as
    | Array<{ image_url?: { url?: string } }>
    | undefined;
  const imageUrl = images?.[0]?.image_url?.url;
  if (!imageUrl) {
    throw new Error("OpenRouter response did not include a generated image");
  }
  return imageUrl;
}

type OpenRouterImageGenerateInput = {
  apiKey: string;
  model: string;
  prompt: string;
};

/**
 * Generates an image via OpenRouter's dedicated images endpoint (POST
 * /images), for models in IMAGE_GENERATION_ENDPOINT_MODELS above (GPT
 * Image 1) that 404 against editImageWithOpenRouter's chat-completions
 * shape. No reference-image input — this endpoint's image-edit support
 * isn't implemented here yet, so callers must not use this for an
 * image-to-image edit (see providers/openrouter.ts's isEdit check).
 * `background: "transparent"` is GPT Image 1's own instruction for a true
 * alpha channel, same intent as the transparent-background prompt text
 * every other model here relies on instead.
 */
export async function generateImageWithOpenRouter(input: OpenRouterImageGenerateInput): Promise<string> {
  const res = await fetch(`${OPENROUTER_API_BASE}/images`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: input.model,
      prompt: input.prompt,
      background: "transparent",
      output_format: "png",
      quality: "auto",
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`OpenRouter API error ${res.status}: ${body}`);
  }

  const json = await res.json();
  const first = json?.data?.[0] as { b64_json?: string; media_type?: string } | undefined;
  if (!first?.b64_json) {
    throw new Error("OpenRouter response did not include a generated image");
  }
  return `data:${first.media_type || "image/png"};base64,${first.b64_json}`;
}

type OpenRouterTextInput = {
  apiKey: string;
  model: string;
  prompt: string;
  /** Reference image (e.g. the design) the model should look at while responding. */
  imageUrl?: string;
};

/**
 * Sends a plain (non-image-output) chat completion, optionally with one
 * reference image, and returns the model's text response — used to
 * generate product title/description copy from a design image.
 */
export async function generateTextWithOpenRouter(input: OpenRouterTextInput): Promise<string> {
  const content: Array<Record<string, unknown>> = [{ type: "text", text: input.prompt }];
  if (input.imageUrl) {
    content.push({ type: "image_url", image_url: { url: input.imageUrl } });
  }

  const res = await fetch(`${OPENROUTER_API_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: input.model,
      messages: [{ role: "user", content }],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`OpenRouter API error ${res.status}: ${body}`);
  }

  const json = await res.json();
  const text = json?.choices?.[0]?.message?.content;
  if (typeof text !== "string" || !text.trim()) {
    throw new Error("OpenRouter response did not include any text");
  }
  return text;
}

/** Decodes a `data:<mime>;base64,<data>` URI returned by an image model. */
export function parseDataUrl(dataUrl: string): { data: Buffer; mimeType: string } {
  const match = /^data:([^;]+);base64,([\s\S]+)$/.exec(dataUrl);
  if (!match) {
    throw new Error("Expected a base64 data: URI from the image model");
  }
  return { mimeType: match[1], data: Buffer.from(match[2], "base64") };
}
