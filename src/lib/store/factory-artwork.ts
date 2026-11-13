import "server-only";
import { createHash } from "node:crypto";
import sharp from "sharp";
import type { Prisma, Store } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { localAssetId } from "@/lib/design/asset-url";
import { DEFAULT_PLACEMENT, type Placement, type PrintAreaProfile } from "@/lib/design/placement";
import { upscaleToPrintCanvas } from "@/lib/design/upscale";
import { compositeDesignOnScene } from "@/lib/design/compositor";
import { StoreError } from "./errors";

const hash = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
export async function renderFactoryArtwork(store: Pick<Store, "id" | "slug">, bytes: Buffer, placement: Placement, profiles: { color: string; profile: PrintAreaProfile }[], db: Prisma.TransactionClient = prisma) {
  if (!profiles.length) throw new StoreError("CALIBRATION_REQUIRED", "A reviewed print area is required", { status: 422 });
  const canvas = profiles[0].profile.canvas;
  if (canvas.width * canvas.height > 50_000_000) throw new StoreError("INVALID_CALIBRATION", "Print canvas must contain at most 50 million pixels", { status: 422 });
  const master = await upscaleToPrintCanvas(bytes, placement, canvas).catch(() => {
    throw new StoreError("UPSCALE_FAILED", "Artwork could not be upscaled at its reviewed placement. Review the source PNG and print area, then Keep again", { status: 422 });
  });
  if (master.data.length > 32 * 1024 * 1024) throw new StoreError("PAYLOAD_TOO_LARGE", "Upscaled print file exceeds 32 MB", { status: 413 });
  const previews = [];
  for (const { color, profile } of profiles) {
    if (profile.storeSlug !== store.slug || profile.canvas.width !== canvas.width || profile.canvas.height !== canvas.height) throw new StoreError("INVALID_CALIBRATION", "Mockups must share the store's reviewed print canvas", { status: 422 });
    const id = localAssetId(profile.baseImageUrl);
    const base = id ? await db.storeAsset.findFirst({ where: { id, storeId: store.id } }) : null;
    if (!base) throw new StoreError("BASE_REQUIRED", `Photograph for ${color} is missing or belongs to another tenant`, { status: 422 });
    const baseData = Buffer.from(base.data);
    const dimensions = await sharp(baseData).metadata();
    if (dimensions.width !== profile.mockup.width || dimensions.height !== profile.mockup.height) throw new StoreError("STALE_CALIBRATION", `Photograph dimensions changed for ${color}`, { status: 422 });
    const composite = await compositeDesignOnScene({ baseImageUrl: profile.baseImageUrl!, baseImageData: baseData, designUrl: "", designData: master.data, area: profile.mapping, placement: DEFAULT_PLACEMENT, printCanvas: canvas });
    previews.push({ color, data: composite.data, profile, baseHash: hash(baseData) });
  }
  return { master, previews };
}

export async function persistFactoryArtwork(storeId: string, rendered: Awaited<ReturnType<typeof renderFactoryArtwork>>, tx: Prisma.TransactionClient) {
  const asset = await tx.storeAsset.create({ data: { storeId, kind: "design-master", mimeType: "image/png", data: new Uint8Array(rendered.master.data) } });
  const master = { url: `/api/assets/${asset.id}`, sha256: hash(rendered.master.data), width: rendered.master.width, height: rendered.master.height, method: rendered.master.method, placement: rendered.master.placement };
  const images = [];
  for (const preview of rendered.previews) {
    const image = await tx.storeAsset.create({ data: { storeId, kind: "factory-preview-composite", mimeType: "image/jpeg", data: new Uint8Array(preview.data) } });
    images.push({ url: `/api/assets/${image.id}`, altText: `${preview.profile.productType} in ${preview.color}`, position: images.length, optionValues: { color: preview.color } });
  }
  const previews = rendered.previews.map(p => ({ color: p.color, profile: p.profile, baseHash: p.baseHash, compositeHash: hash(p.data) }));
  return { master, images, previews };
}
