import "server-only";
import type { Store } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { StoreError, notFound } from "./errors";
import { logActivity, type ActivityActor } from "./activity";
import { uploadStoreAsset } from "./assets";

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
  origin: string
) {
  const asset = await uploadStoreAsset(store.id, { kind: "mockup-scene", ...input }, actor);
  const imageUrl = `${origin}${asset.url}`;

  const scene = await prisma.mockupScene.upsert({
    where: { storeId_productType: { storeId: store.id, productType } },
    create: { storeId: store.id, productType, imageUrl },
    update: { imageUrl },
  });

  await logActivity(store.id, {
    actor,
    category: "mockup-scene",
    summary: `Set AI mockup scene for product type "${productType}"`,
    details: { productType, imageUrl },
  });

  return scene;
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
