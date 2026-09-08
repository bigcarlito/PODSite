import "server-only";
import type { Prisma, Store } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { DEFAULT_MOCKUP_MODEL, editImageWithOpenRouter, parseDataUrl } from "@/lib/ai/openrouter";
import type { DesignArea } from "@/lib/design/compositor";
import { StoreError, notFound } from "./errors";
import { logActivity, type ActivityActor } from "./activity";
import { uploadStoreAsset } from "./assets";

export type MockupSceneColor = { name: string; hex: string };

export function listMockupScenes(storeId: string) {
  return prisma.mockupScene.findMany({
    where: { storeId },
    orderBy: { productType: "asc" },
  });
}

export async function getMockupScene(storeId: string, productType: string) {
  const scene = await prisma.mockupScene.findUnique({
    where: { storeId_productType: { storeId, productType } },
  });
  if (!scene) {
    throw new StoreError(
      "NO_MOCKUP_SCENE",
      `No AI mockup scene photo is set for product type "${productType}" — ` +
        `upload one via PUT /api/agent/mockup-scenes/${encodeURIComponent(productType)} first.`,
      { status: 422, field: "productType" }
    );
  }
  return scene;
}

/**
 * Uploads a scene photo and sets/replaces it as the shared AI-mockup
 * template for a product type, in one step — mirrors setHeroImage in
 * settings.ts. Every product with this productType shares the same photo.
 *
 * uploadStoreAsset returns a host-relative URL (fine for an <img> tag),
 * but this URL gets handed to an external image-editing model (OpenRouter)
 * that fetches it from outside this server — same requirement as
 * generateAIProductMockups' designUrl — so the caller must resolve it to
 * an absolute URL (this request's own origin) before it's ever usable.
 */
export async function setMockupScene(
  store: Store,
  productType: string,
  input: { data: Buffer; mimeType: string },
  actor: ActivityActor,
  origin: string,
  colors?: MockupSceneColor[]
) {
  const asset = await uploadStoreAsset(store.id, { kind: "mockup-scene", ...input }, actor);
  const imageUrl = `${origin}${asset.url}`;

  const scene = await prisma.mockupScene.upsert({
    where: { storeId_productType: { storeId: store.id, productType } },
    create: {
      storeId: store.id,
      productType,
      imageUrl,
      colors: (colors ?? []) as Prisma.InputJsonValue,
    },
    // Only touch colors if the caller actually supplied them, so replacing
    // just the photo doesn't wipe out a previously-set color lineup. Base
    // images always get cleared, though — a base generated from the old
    // photo no longer matches this one, so keeping it would be silently
    // wrong rather than merely incomplete.
    update: {
      imageUrl,
      baseImages: {},
      ...(colors ? { colors: colors as Prisma.InputJsonValue } : {}),
    },
  });

  await logActivity(store.id, {
    actor,
    category: "mockup-scene",
    summary: `Set AI mockup scene for product type "${productType}"`,
    details: { productType, imageUrl, colors },
  });

  return scene;
}

function apiKeyOrThrow(): string {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new StoreError(
      "MISSING_PROVIDER_CREDENTIALS",
      "OPENROUTER_API_KEY is not configured.",
      { status: 422 }
    );
  }
  return apiKey;
}

/** Renders one color's design-free "blank" base mockup — no persistence. */
async function renderMockupSceneBase(input: {
  apiKey: string;
  model: string;
  sceneImageUrl: string;
  color: MockupSceneColor;
}): Promise<{ data: Buffer; mimeType: string }> {
  const prompt =
    `This photo shows a blank t-shirt in a real scene. Recolor the garment ` +
    `fabric to "${input.color.name}" (hex ${input.color.hex}), preserving ` +
    `the exact wrinkles, shadows, lighting, and everything else in the photo ` +
    `unchanged — do not alter the background or props, and do not add any ` +
    `design, print, or graphic to the garment. Output only the blank ` +
    `recolored garment in the same scene.`;

  const resultDataUrl = await editImageWithOpenRouter({
    apiKey: input.apiKey,
    model: input.model,
    prompt,
    images: [input.sceneImageUrl],
  });
  return parseDataUrl(resultDataUrl);
}

/**
 * Generates (or regenerates) every color's design-free "blank" base mockup
 * — one AI recolor call per color, no design composited — and caches them
 * on MockupScene.baseImages. Once cached, generating an actual product
 * mockup (ai-mockups.ts) is a local image composite, not an AI call: this
 * is the piece that makes design placement deterministic and mockup
 * generation cheap/fast for every design after the first.
 *
 * Safe to call repeatedly — each run replaces every color's base with a
 * fresh render (e.g. after tweaking the scene photo, though setMockupScene
 * already clears these on a photo swap).
 *
 * `origin` resolves uploadStoreAsset's host-relative URL to an absolute
 * one before caching it — compositeDesignOnScene later fetches this URL
 * from server-side code with no request/browser to resolve a relative
 * path against, same requirement as setMockupScene's imageUrl.
 */
export async function generateMockupSceneBases(
  store: Store,
  productType: string,
  actor: ActivityActor,
  origin: string,
  model?: string
) {
  const scene = await getMockupScene(store.id, productType);
  const colors = (scene.colors as unknown as MockupSceneColor[]) ?? [];
  if (colors.length === 0) {
    throw new StoreError(
      "NO_MOCKUP_SCENE_COLORS",
      `The "${productType}" mockup scene has no colors set — add at least ` +
        `one via PUT /api/agent/mockup-scenes/${encodeURIComponent(productType)} first.`,
      { status: 422, field: "productType" }
    );
  }

  const apiKey = apiKeyOrThrow();
  const resolvedModel = model || DEFAULT_MOCKUP_MODEL;

  const baseImages: Record<string, string> = {};
  const failed: Array<{ color: string; error: string }> = [];

  for (const color of colors) {
    try {
      const { data, mimeType } = await renderMockupSceneBase({
        apiKey,
        model: resolvedModel,
        sceneImageUrl: scene.imageUrl,
        color,
      });
      const asset = await uploadStoreAsset(store.id, { kind: "mockup-scene-base", data, mimeType }, actor);
      baseImages[color.name] = `${origin}${asset.url}`;
    } catch (cause) {
      failed.push({
        color: color.name,
        error: cause instanceof Error ? cause.message : String(cause),
      });
    }
  }

  const updated = await prisma.mockupScene.update({
    where: { id: scene.id },
    // Merge onto the existing map rather than replacing it, so a partial
    // failure here doesn't erase bases from a previous successful run.
    data: {
      baseImages: {
        ...((scene.baseImages as Record<string, string>) ?? {}),
        ...baseImages,
      } as Prisma.InputJsonValue,
    },
  });

  await logActivity(store.id, {
    actor,
    category: "mockup-scene",
    summary: `Generated ${Object.keys(baseImages).length} base mockup(s) for product type "${productType}"`,
    details: { productType, generated: Object.keys(baseImages), failed },
  });

  return { scene: updated, generated: baseImages, failed };
}

/**
 * Returns this color's cached base image URL, generating and caching it
 * on demand if missing — the self-healing counterpart to
 * generateMockupSceneBases, so an agent calling straight through to a
 * product mockup never has to remember a separate "pre-generate" step.
 *
 * Also self-heals a cached value that isn't a fetchable absolute URL (e.g.
 * one written before the origin fix that resolves it — see origin.ts —
 * existed): trusting it blindly here would just re-fail downstream, so a
 * malformed cache entry is treated the same as a missing one.
 */
export async function ensureMockupSceneBase(
  store: Store,
  productType: string,
  color: MockupSceneColor,
  actor: ActivityActor,
  origin: string,
  model?: string
): Promise<string> {
  const scene = await getMockupScene(store.id, productType);
  const existing = (scene.baseImages as Record<string, string> | null)?.[color.name];
  if (existing && /^https?:\/\//.test(existing)) return existing;

  const apiKey = apiKeyOrThrow();
  const { data, mimeType } = await renderMockupSceneBase({
    apiKey,
    model: model || DEFAULT_MOCKUP_MODEL,
    sceneImageUrl: scene.imageUrl,
    color,
  });
  const asset = await uploadStoreAsset(store.id, { kind: "mockup-scene-base", data, mimeType }, actor);
  const imageUrl = `${origin}${asset.url}`;

  await prisma.mockupScene.update({
    where: { id: scene.id },
    data: {
      baseImages: {
        ...((scene.baseImages as Record<string, string>) ?? {}),
        [color.name]: imageUrl,
      } as Prisma.InputJsonValue,
    },
  });

  return imageUrl;
}

/** Sets the rectangle (fractions of the scene image) a design gets placed
 *  into — see compositeDesignOnScene in src/lib/design/compositor.ts. */
export async function setDesignArea(
  storeId: string,
  productType: string,
  area: DesignArea,
  actor: ActivityActor
) {
  const scene = await getMockupScene(storeId, productType);

  const updated = await prisma.mockupScene.update({
    where: { id: scene.id },
    data: { designArea: area as Prisma.InputJsonValue },
  });

  await logActivity(storeId, {
    actor,
    category: "mockup-scene",
    summary: `Set the design area for product type "${productType}"`,
    details: { productType, area },
  });

  return updated;
}

export async function deleteMockupScene(storeId: string, productType: string, actor: ActivityActor) {
  const existing = await prisma.mockupScene.findUnique({
    where: { storeId_productType: { storeId, productType } },
  });
  if (!existing) throw notFound(`Mockup scene for product type "${productType}"`);

  await prisma.mockupScene.delete({ where: { id: existing.id } });

  await logActivity(storeId, {
    actor,
    category: "mockup-scene",
    summary: `Removed AI mockup scene for product type "${productType}"`,
    details: { productType },
  });
}
