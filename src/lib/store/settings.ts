import "server-only";
import { prisma } from "@/lib/prisma";
import type { Prisma, Store } from "@prisma/client";
import { logActivity, type ActivityActor } from "./activity";
import type { StoreUpdateInput } from "./schemas";
import { uploadStoreAsset } from "./assets";

/** Fields a store can update about itself — brand/copy/theme, never credentials or slug/domain. */
export async function updateStoreBrand(
  storeId: string,
  input: StoreUpdateInput,
  actor: ActivityActor = "agent"
) {
  const store = await prisma.store.update({
    where: { id: storeId },
    data: input as Prisma.StoreUpdateInput,
  });

  await logActivity(storeId, {
    actor,
    category: "brand",
    summary: "Updated store branding",
    details: { changes: input },
  });

  return store;
}

/**
 * Uploads an image and sets it as this store's homepage hero image in one
 * step — the single function both the admin upload form and the agent
 * hero-image route call (rule #1), so "upload" and "set as hero" can never
 * drift apart. theme is a JSON blob that updateStoreBrand replaces wholesale
 * (never deep-merged), so this reads the store's *current* theme first and
 * only overwrites heroImageUrl within it.
 */
export async function setHeroImage(
  store: Store,
  input: { data: Buffer; mimeType: string },
  actor: ActivityActor
) {
  const asset = await uploadStoreAsset(store.id, { kind: "hero-image", ...input }, actor);
  const currentTheme =
    (store.theme as { accent?: string; accentDark?: string; heroImageUrl?: string } | null) ?? {};
  return updateStoreBrand(
    store.id,
    { theme: { ...currentTheme, heroImageUrl: asset.url } },
    actor
  );
}
