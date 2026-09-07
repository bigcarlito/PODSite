import "server-only";
import { prisma } from "@/lib/prisma";
import type { Prisma, Store } from "@prisma/client";
import { compositeDesignOnScene, type DesignArea } from "@/lib/design/compositor";
import { StoreError } from "./errors";
import { logActivity, type ActivityActor } from "./activity";
import { getProductById } from "./products";
import { getMockupScene, ensureMockupSceneBase, type MockupSceneColor } from "./mockup-scenes";
import { uploadStoreAsset } from "./assets";
import type { AiMockupGenerateInput } from "./schemas";

/**
 * Generates one mockup per garment color by compositing the design onto
 * this product type's pre-generated, color-specific base mockup (see
 * mockup-scenes.ts) — a deterministic local image composite, not an AI
 * call, so placement is identical every time rather than an image model
 * re-deciding it per design. An alternative to generateProductMockups
 * (mockups.ts), which renders Printful's flat, plain-background catalog
 * mockups. Both write to the same ProductImage rows, keyed by color.
 */
export async function generateAIProductMockups(
  store: Store,
  productId: string,
  input: AiMockupGenerateInput,
  actor: ActivityActor,
  origin: string
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
  const sceneColors = (scene.colors as unknown as MockupSceneColor[]) ?? [];
  const designArea = (scene.designArea as unknown as DesignArea | null) ?? undefined;

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

  const rendered: Array<{ color: string; mockupUrl: string }> = [];
  const failed: Array<{ color: string; error: string }> = [];

  for (const color of colors) {
    try {
      const sceneColor = sceneColors.find((c) => c.name === color);
      if (!sceneColor) {
        throw new Error(
          `"${color}" isn't one of this product type's colors (${sceneColors.map((c) => c.name).join(", ") || "none set"})`
        );
      }

      // Generates and caches the base on first use — see
      // ensureMockupSceneBase — so this never hard-fails just because
      // nobody ran the bulk "generate bases" step first.
      const baseImageUrl = await ensureMockupSceneBase(
        store,
        product.productType,
        sceneColor,
        actor,
        origin
      );

      const { data, mimeType } = await compositeDesignOnScene({
        baseImageUrl,
        designUrl: input.designUrl,
        area: designArea,
      });
      const asset = await uploadStoreAsset(store.id, { kind: "ai-mockup", data, mimeType }, actor);
      rendered.push({ color, mockupUrl: `${origin}${asset.url}` });
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
      `Mockup generation failed for every requested color. First error: ` +
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
