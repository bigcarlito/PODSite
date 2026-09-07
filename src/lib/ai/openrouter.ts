import "server-only";

const OPENROUTER_API_BASE = "https://openrouter.ai/api/v1";

/** Default OpenRouter model slug for AI mockup generation, overridable per call. */
export const DEFAULT_MOCKUP_MODEL =
  process.env.OPENROUTER_MOCKUP_MODEL || "google/gemini-2.5-flash-image";

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
