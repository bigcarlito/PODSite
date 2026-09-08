import "server-only";
import { DEFAULT_TEXT_MODEL, generateTextWithOpenRouter } from "@/lib/ai/openrouter";
import type { Store } from "@prisma/client";
import { StoreError } from "./errors";
import type { ActivityActor } from "./activity";
import { createProduct } from "./products";
import { getMockupScene, type MockupSceneColor } from "./mockup-scenes";
import { generateAIProductMockups } from "./ai-mockups";
import type { AiProductCreateInput } from "./schemas";

function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "product"
  );
}

/** Strips a ```json ... ``` fence if the model wrapped its response in one. */
function extractJson(text: string): string {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(text);
  return (fenced ? fenced[1] : text).trim();
}

/**
 * Auto-creates a whole product from just a design image: generates a
 * title/description with an AI text model, builds one variant per
 * (color x size) using the product type's MockupScene color lineup, then
 * generates an AI mockup per color (see ai-mockups.ts) — the "upload a
 * design, get a finished product" flow described in AGENTS.md.
 */
export async function generateProductFromDesign(
  store: Store,
  input: AiProductCreateInput,
  actor: ActivityActor,
  origin: string
) {
  const scene = await getMockupScene(store.id, input.productType);
  const colors = (scene.colors as unknown as MockupSceneColor[]) ?? [];
  if (colors.length === 0) {
    throw new StoreError(
      "NO_MOCKUP_SCENE_COLORS",
      `The "${input.productType}" mockup scene has no colors set — add at ` +
        `least one via PUT /api/agent/mockup-scenes/${encodeURIComponent(input.productType)} first.`,
      { status: 422, field: "productType" }
    );
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new StoreError(
      "MISSING_PROVIDER_CREDENTIALS",
      "OPENROUTER_API_KEY is not configured.",
      { status: 422 }
    );
  }
  const textModel = input.textModel || DEFAULT_TEXT_MODEL;

  const prompt =
    `Look at this product design image, intended to be printed on a ` +
    `${input.productType}. Suggest a short, catchy product title (5-8 ` +
    `words, no quotes) and a two-to-three sentence marketing description. ` +
    `Respond with ONLY a JSON object, no markdown fences, no other text: ` +
    `{"title": "...", "description": "..."}`;

  let title: string;
  let description: string;
  try {
    const raw = await generateTextWithOpenRouter({
      apiKey,
      model: textModel,
      prompt,
      imageUrl: input.designUrl,
    });
    const parsed = JSON.parse(extractJson(raw)) as { title?: string; description?: string };
    if (!parsed.title || !parsed.description) {
      throw new Error(`Missing title/description in response: ${raw}`);
    }
    title = parsed.title;
    description = parsed.description;
  } catch (cause) {
    throw new StoreError(
      "AI_PROVIDER_ERROR",
      `Couldn't generate a title/description from the design: ` +
        `${cause instanceof Error ? cause.message : String(cause)}`,
      { status: 502 }
    );
  }

  const baseSlug = slugify(title);

  // SKUs are derived from `slug`, so they must be rebuilt inside the retry
  // loop alongside it — building them once from the fixed baseSlug would
  // mean a slug retry (a new product with the same generated title) still
  // collided on every SKU, since those never changed.
  function buildVariants(slug: string) {
    return colors.flatMap((color) =>
      input.sizes.map((size) => ({
        sku: `${slug}-${slugify(size)}-${slugify(color.name)}`,
        options: { [input.sizeOptionName]: size, [input.colorOptionName]: color.name },
        priceCents: input.priceCents,
        currency: input.currency,
        provider: "PRINTFUL" as const,
        inStock: true,
      }))
    );
  }

  let product;
  let attempt = 0;
  let slug = baseSlug;
  for (;;) {
    try {
      product = await createProduct(
        store.id,
        {
          slug,
          title,
          description,
          optionNames: [input.sizeOptionName, input.colorOptionName],
          isFeatured: false,
          isActive: true,
          productType: input.productType,
          collectionIds: [],
          images: [],
          variants: buildVariants(slug),
        },
        actor
      );
      break;
    } catch (cause) {
      attempt += 1;
      const retryable =
        cause instanceof StoreError && (cause.code === "SLUG_TAKEN" || cause.code === "SKU_TAKEN");
      if (!retryable || attempt >= 20) {
        throw cause;
      }
      slug = `${baseSlug}-${attempt + 1}`;
    }
  }

  const mockups = await generateAIProductMockups(
    store,
    product.id,
    {
      designUrl: input.designUrl,
      colorOptionName: input.colorOptionName,
    },
    actor,
    origin
  );

  return {
    product: mockups.product,
    title,
    description,
    rendered: mockups.rendered,
    failed: mockups.failed,
  };
}
