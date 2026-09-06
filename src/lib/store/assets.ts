import "server-only";
import { prisma } from "@/lib/prisma";
import { StoreError, notFound } from "./errors";
import { logActivity, type ActivityActor } from "./activity";

export const ALLOWED_ASSET_MIME_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
export const MAX_ASSET_BYTES = 8 * 1024 * 1024; // 8MB

/**
 * Stores an uploaded image for a store (e.g. the homepage hero image) and
 * returns its public, store-independent URL (GET /api/assets/[id]). Kept
 * separate from Store.theme itself — callers that want the image *set* as
 * the active hero should follow up with updateStoreBrand(storeId, {theme:
 * {heroImageUrl}}), same as if an agent had supplied an externally-hosted
 * URL directly. One function, called by both the admin upload action and
 * the agent hero-image route (rule #1).
 */
export async function uploadStoreAsset(
  storeId: string,
  input: { kind: string; data: Buffer; mimeType: string },
  actor: ActivityActor
) {
  if (!ALLOWED_ASSET_MIME_TYPES.includes(input.mimeType as (typeof ALLOWED_ASSET_MIME_TYPES)[number])) {
    throw new StoreError(
      "UNSUPPORTED_MEDIA_TYPE",
      `Unsupported image type "${input.mimeType}" — allowed: ${ALLOWED_ASSET_MIME_TYPES.join(", ")}`,
      { status: 415, field: "mimeType" }
    );
  }
  if (input.data.byteLength > MAX_ASSET_BYTES) {
    throw new StoreError(
      "PAYLOAD_TOO_LARGE",
      `Image is ${input.data.byteLength} bytes — max is ${MAX_ASSET_BYTES} bytes`,
      { status: 413 }
    );
  }

  const asset = await prisma.storeAsset.create({
    data: { storeId, kind: input.kind, data: new Uint8Array(input.data), mimeType: input.mimeType },
  });

  await logActivity(storeId, {
    actor,
    category: "assets",
    summary: `Uploaded ${input.kind} image`,
    details: { assetId: asset.id, mimeType: input.mimeType, bytes: input.data.byteLength },
  });

  return { id: asset.id, url: `/api/assets/${asset.id}`, mimeType: asset.mimeType };
}

/** Reads back an asset's bytes for GET /api/assets/[id] — deliberately not store-scoped, since the id is unguessable and the asset is meant to be publicly viewable (same trust level as any other storefront image URL). */
export async function getStoreAsset(id: string) {
  const asset = await prisma.storeAsset.findUnique({ where: { id } });
  if (!asset) throw notFound("Asset");
  return asset;
}
