import "server-only";
import { createHash } from "node:crypto";
import { Prisma, type Store } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isManualFulfillment } from "@/lib/storefront-theme";
import { localAssetId } from "@/lib/design/asset-url";
import { placementSchema, printAreaProfileSchema } from "@/lib/design/placement";
import { renderFactoryArtwork, persistFactoryArtwork } from "./factory-artwork";
import { logActivity, type ActivityActor } from "./activity";
import { StoreError, notFound } from "./errors";
import { productPublicationInputSchema, productPublicationResultSchema } from "./product-publication-schemas";

const include = { variants: true, images: { orderBy: { position: "asc" as const } }, collections: { include: { collection: true } } };
const evidenceSchema = z.object({
  artworkUrl: z.string(), artworkHash: z.string(),
  version: z.object({ decision: z.literal("keep"), placements: z.record(placementSchema) }),
  previews: z.array(z.object({ color: z.string(), profile: printAreaProfileSchema })).min(1),
}).passthrough();
const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.JsonObject;

export async function publishProduct(store: Store, id: string, raw: unknown, actor: ActivityActor) {
  productPublicationInputSchema.parse(raw);
  return prisma.$transaction(async tx => {
    const product = await tx.product.findFirst({ where: { id, storeId: store.id }, include });
    if (!product) throw notFound("Product");
    if (product.isActive) return productPublicationResultSchema.parse({ product });
    if (!product.title.trim() || !product.description.trim() || !product.images.length || !product.variants.length || product.variants.some(v => v.priceCents <= 0 || !v.currency)) throw new StoreError("PRODUCT_INCOMPLETE", "Add a title, description, images and priced variants before publishing", { status: 422 });

    let factoryDraft = product.factoryDraft;
    let images: typeof product.images | undefined;
    let replacementImages: Awaited<ReturnType<typeof persistFactoryArtwork>>["images"] | undefined;
    let firstFactoryPublication = false;
    if (product.factorySourceKey) {
      if (!isManualFulfillment(store)) throw new StoreError("MANUAL_FULFILLMENT_REQUIRED", "Factory products require this store's manual fulfillment mode before publishing", { status: 409 });
      const parsed = evidenceSchema.safeParse(factoryDraft);
      if (!parsed.success) throw new StoreError("INVALID_FACTORY_EVIDENCE", "Kept artwork and calibrated mockup evidence are required", { status: 422 });
      const evidence = parsed.data;
      firstFactoryPublication = !evidence.publication;
      if (!evidence.master) {
        const sourceId = localAssetId(evidence.artworkUrl);
        const source = sourceId ? await tx.storeAsset.findFirst({ where: { id: sourceId, storeId: store.id } }) : null;
        if (!source) throw new StoreError("ARTWORK_REQUIRED", "Original kept artwork is missing", { status: 422 });
        const bytes = Buffer.from(source.data);
        if (createHash("sha256").update(bytes).digest("hex") !== evidence.artworkHash) throw new StoreError("ARTWORK_HASH_MISMATCH", "Original artwork no longer matches review evidence", { status: 422 });
        const placement = evidence.version.placements[product.productType ?? ""];
        if (!placement) throw new StoreError("PLACEMENT_REQUIRED", "Reviewed garment placement is missing", { status: 422 });
        const colors = new Set(product.variants.map(v => (v.options as Record<string, string>).color));
        const profiles = evidence.previews.filter(p => colors.has(p.color));
        if ([...colors].some(color => profiles.filter(p => p.color === color).length !== 1)) throw new StoreError("CALIBRATION_REQUIRED", "Every offered color needs mockup evidence", { status: 422 });
        const prepared = await persistFactoryArtwork(store.id, await renderFactoryArtwork(store, bytes, placement, profiles, tx), tx);
        factoryDraft = json({ ...evidence, master: prepared.master, previews: prepared.previews });
        replacementImages = prepared.images;
      } else {
        // A print file stays out of the customer-facing gallery.
        images = product.images.filter(image => image.optionValues && typeof image.optionValues === "object" && "color" in image.optionValues);
        if (!images.length) throw new StoreError("MOCKUPS_REQUIRED", "At least one garment mockup is required", { status: 422 });
      }
      const master = z.object({ url: z.string(), sha256: z.string(), width: z.number().int().positive(), height: z.number().int().positive() }).parse((factoryDraft as Prisma.JsonObject).master);
      const masterId = localAssetId(master.url);
      const asset = masterId ? await tx.storeAsset.findFirst({ where: { id: masterId, storeId: store.id } }) : null;
      if (!asset || createHash("sha256").update(Buffer.from(asset.data)).digest("hex") !== master.sha256) throw new StoreError("MASTER_REQUIRED", "Upscaled print artwork is missing or changed", { status: 422 });
      factoryDraft = json({ ...(factoryDraft as Prisma.JsonObject), publication: { fulfillmentMode: "manual", publishedAt: new Date().toISOString() } });
    }

    const updated = await tx.product.update({
      where: { id, storeId: store.id },
      data: { isActive: true, ...(factoryDraft ? { factoryDraft } : {}),
        ...(firstFactoryPublication ? { variants: { updateMany: { where: { storeId: store.id }, data: { inStock: true } } } } : {}),
        ...(replacementImages || images ? { images: { deleteMany: { productId: id }, create: replacementImages ?? images!.map((image, position) => ({ url: image.url, altText: image.altText, position, optionValues: image.optionValues ? json(image.optionValues) : Prisma.JsonNull })) } } : {}),
      }, include,
    });
    await logActivity(store.id, { actor, category: "product", summary: `Published product "${product.title}"${product.factorySourceKey ? " for manual fulfillment" : ""}`, details: { productId: id, isActive: true, master: product.factorySourceKey ? (factoryDraft as Prisma.JsonObject).master : undefined } }, tx);
    return productPublicationResultSchema.parse({ product: updated });
  }, { timeout: 60000, isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function unpublishProduct(store: Store, id: string, raw: unknown, actor: ActivityActor) {
  productPublicationInputSchema.parse(raw);
  return prisma.$transaction(async tx => {
    const product = await tx.product.findFirst({ where: { id, storeId: store.id }, include });
    if (!product) throw notFound("Product");
    if (!product.isActive) return productPublicationResultSchema.parse({ product });
    const updated = await tx.product.update({ where: { id, storeId: store.id }, data: { isActive: false }, include });
    await logActivity(store.id, { actor, category: "product", summary: `Unpublished product "${product.title}"`, details: { productId: id, isActive: false } }, tx);
    return productPublicationResultSchema.parse({ product: updated });
  });
}
