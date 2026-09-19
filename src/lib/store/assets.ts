import "server-only";
import { prisma } from "@/lib/prisma";
import { StoreError, notFound } from "./errors";
import { logActivity, type ActivityActor } from "./activity";

export const ALLOWED_ASSET_MIME_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
/// 8MB matches next.config.ts's serverActions.bodySizeLimit — the real
/// constraint for anything a human/agent actually uploads (hero image,
/// logo, mockup scene photo/base). A server-derived print file never
/// passes through that limit (it's a Buffer built mid-request, not a
/// request body), so it gets its own, higher cap below.
export const MAX_ASSET_BYTES = 8 * 1024 * 1024; // 8MB
/// The print-ready master canvas is a fixed 4500x5400 — a busy/distressed
/// design can clear 8MB even at max PNG compression (see upscale.ts),
/// and there's no smaller resolution to fall back to without breaking
/// providers' print specs. "design-print-file" (deriveProviderFile's
/// per-provider crop/resize of the master) can be just as large.
const MAX_DERIVED_PRINT_ASSET_BYTES = 32 * 1024 * 1024; // 32MB
const DERIVED_PRINT_ASSET_KINDS = new Set(["design-master", "design-print-file"]);

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
  const maxBytes = DERIVED_PRINT_ASSET_KINDS.has(input.kind)
    ? MAX_DERIVED_PRINT_ASSET_BYTES
    : MAX_ASSET_BYTES;
  if (input.data.byteLength > maxBytes) {
    throw new StoreError(
      "PAYLOAD_TOO_LARGE",
      `Image is ${input.data.byteLength} bytes — max is ${maxBytes} bytes`,
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
