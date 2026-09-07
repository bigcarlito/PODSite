import "server-only";
import { prisma } from "@/lib/prisma";
import type { Prisma, Store } from "@prisma/client";
import { DEFAULT_MOCKUP_MODEL, editImageWithOpenRouter, parseDataUrl } from "@/lib/ai/openrouter";
import { StoreError } from "./errors";
import { logActivity, type ActivityActor } from "./activity";
import { getProductById } from "./products";
import { getMockupScene } from "./mockup-scenes";
import { uploadStoreAsset } from "./assets";
import type { AiMockupGenerateInput } from "./schemas";

/**
 * Generates one AI mockup per garment color by recoloring this product
 * type's shared scene photo (see mockup-scenes.ts) and compositing the
 * design onto it — an alternative to generateProductMockups (mockups.ts),
 * which renders Printful's flat, plain-background catalog mockups. Both
 * write to the same ProductImage rows, keyed by color.
 */
export async function generateAIProductMockups(
  store: Store,
  productId: string,
  input: AiMockupGenerateInput,
  actor: ActivityActor = "agent"
) {
  const product = await getProductById(store.id, productId);

  if (!product.productType) {
    throw new StoreError(
      "MISSING_PRODUCT_TYPE",
      `"${product.title}" has no productType set — set one via PATCH ` +
        `/api/agent/products/${productId} (e.g. "tshirt") so it knows which ` +
        `scene photo to use.`,
      { status: 422, field: "productType" }
    );
  }

  const scene = await getMockupScene(store.id, product.productType);

  // One representative color per garment color, same collapsing as the
  // Printful path — S/M/L of the same color share one image.
  const colors = new Set<string>();
  for (const variant of product.variants) {
    const options = (variant.options as Record<string, string> | null) ?? {};
    const color = options[input.colorOptionName];
    if (!color) continue;
    if (input.colors && !input.colors.includes(color)) continue;
    colors.add(color);
  }

  if (colors.size === 0) {
    throw new StoreError(
      "NO_MOCKUP_VARIANTS",
      `No variants on "${product.title}" have a "${input.colorOptionName}" option set.`,
      { status: 422 }
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
  const model = input.model || DEFAULT_MOCKUP_MODEL;
  const hexByColor = new Map((input.garments ?? []).map((g) => [g.name, g.hex]));

  const rendered: Array<{ color: string; mockupUrl: string }> = [];
  const failed: Array<{ color: string; error: string }> = [];

  for (const color of colors) {
    const hex = hexByColor.get(color);
    const prompt =
      `This first photo shows a blank t-shirt in a real scene. Recolor the ` +
      `garment fabric to "${color}"${hex ? ` (hex ${hex})` : ""}, preserving ` +
      `the exact wrinkles, shadows, lighting, and everything else in the photo ` +
      `unchanged — do not alter the background or props. Then take the design ` +
      `from the second image and print it onto the front chest area of the ` +
      `shirt, centered, sized naturally for a garment print, following the ` +
      `fabric's folds and lighting as if it were actually printed on the fabric. ` +
      `Output only the final composited photo.`;

    try {
      const resultDataUrl = await editImageWithOpenRouter({
        apiKey,
        model,
        prompt,
        images: [scene.imageUrl, input.designUrl],
      });
      const { data, mimeType } = parseDataUrl(resultDataUrl);
      const asset = await uploadStoreAsset(store.id, { kind: "ai-mockup", data, mimeType }, actor);
      rendered.push({ color, mockupUrl: asset.url });
    } catch (cause) {
      failed.push({
        color,
        error: cause instanceof Error ? cause.message : String(cause),
      });
    }
  }

  if (rendered.length === 0) {
    throw new StoreError(
      "AI_PROVIDER_ERROR",
      `The image model failed for every requested color. First error: ` +
        `${failed[0]?.error ?? "unknown"}`,
      { status: 502, details: { failed } }
    );
  }

  await prisma.$transaction(async (tx) => {
    const existing = await tx.productImage.findMany({ where: { productId } });
    const supersededIds = existing
      .filter((image) => {
        const values = (image.optionValues as Record<string, string> | null) ?? null;
        const color = values?.[input.colorOptionName];
        return color != null && rendered.some((r) => r.color === color);
      })
      .map((image) => image.id);

    if (supersededIds.length > 0) {
      await tx.productImage.deleteMany({ where: { id: { in: supersededIds } } });
    }

    const basePosition = existing.reduce((max, image) => Math.max(max, image.position + 1), 0);

    await tx.productImage.createMany({
      data: rendered.map((r, index) => ({
        productId,
        url: r.mockupUrl,
        altText: `${product.title} — ${r.color}`,
        position: basePosition + index,
        optionValues: { [input.colorOptionName]: r.color } as Prisma.InputJsonValue,
      })),
    });
  });

  await logActivity(store.id, {
    actor,
    category: "ai-mockup",
    summary: `Generated ${rendered.length} AI mockup(s) for "${product.title}"`,
    details: {
      productId,
      designUrl: input.designUrl,
      model,
      rendered: rendered.map((r) => r.color),
      failed,
    },
  });

  return {
    product: await getProductById(store.id, productId),
    rendered,
    failed,
  };
}
