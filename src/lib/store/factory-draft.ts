import "server-only";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { Prisma, type Store } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { factoryDraftInputSchema, factoryDraftResultSchema, FACTORY_BLOCKERS } from "@/lib/design/factory-draft";
import { alphaBounds, constrainedPlacement, type PrintAreaProfile } from "@/lib/design/placement";
import { compositeDesignOnScene } from "@/lib/design/compositor";
import { productCreateSchema } from "./schemas";
import { createProduct } from "./products";
import { logActivity, type ActivityActor } from "./activity";
import { StoreError } from "./errors";

const hash = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
const include = { variants: true, images: { orderBy: { position: "asc" as const } } };
function fail(code: string, message: string): never { throw new StoreError(code, message, { status: 422 }); }

/** No provider calls. All reads of tenant photograph bytes are scoped, never remote fetches. */
export async function createFactoryDraft(store: Store, raw: unknown, actor: ActivityActor) {
  const input = factoryDraftInputSchema.parse(raw);
  const { manifest, version, settings, printAreas, ancestors } = input;
  if (manifest.brief.storeSlug !== store.slug || printAreas.some(p => p.storeSlug !== store.slug)) fail("STORE_MISMATCH", "Review belongs to another store");
  const candidate = manifest.candidates.find(c => c.id === version.candidateId);
  if (manifest.candidates.filter(c => c.id === version.candidateId).length !== 1 || ancestors.some(v => v.id === version.id) || new Set(ancestors.map(v => v.id)).size !== ancestors.length) fail("INVALID_LINEAGE", "Candidate and version identities must be unique");
  if (!version.image) fail("KEEP_REQUIRED", "Source PNG is missing. Import the original artwork for this version before creating a draft");
  if (!candidate || version.decision !== "keep") fail("KEEP_REQUIRED", "Select a kept version with PNG artwork");
  if (version.image.length > 6 * 1024 * 1024) fail("ARTWORK_TOO_LARGE", "Preview PNG must fit the 6 MB encoded handoff limit");
  if (version.decisions?.length && version.decisions.at(-1)?.decision !== "keep") fail("KEEP_REQUIRED", "Latest review decision must be Keep");
  const lineage = new Map(ancestors.map(v => [v.id, v]));
  const seen = new Set([version.id]);
  let parent = version.parentId;
  while (parent) {
    const ancestor = lineage.get(parent);
    if (!ancestor || seen.has(parent) || ancestor.candidateId !== version.candidateId) fail("INVALID_LINEAGE", "Export the complete version ancestry");
    seen.add(parent); parent = ancestor.parentId;
  }
  if (printAreas.some(p => p.printAreaId !== "front")) fail("INVALID_CALIBRATION", "Only front placement is supported");
  const placement = version.placements?.[settings.productType];
  if (!placement) fail("PLACEMENT_REQUIRED", `No reviewed placement for ${settings.productType}. Close the dialog, view that garment, review placement and click Keep`);
  const bytes = Buffer.from(version.image.split(",")[1], "base64");
  const artworkHash = hash(bytes);
  const expected = version.parentId ? version.provenance?.sha256 : candidate.preview?.sha256;
  if (expected !== artworkHash) fail("ARTWORK_HASH_MISMATCH", "Artwork must match the version's recorded SHA-256 provenance");
  const image = sharp(bytes, { limitInputPixels: 25000000 });
  const meta = await image.metadata().catch(() => fail("INVALID_ARTWORK", "Artwork must be a decodable PNG"));
  if (meta.format !== "png" || !meta.hasAlpha || !meta.width || !meta.height) fail("INVALID_ARTWORK", "A transparent-channel PNG preview is required");
  const rgba = await image.ensureAlpha().raw().toBuffer().catch(() => fail("INVALID_ARTWORK", "Artwork pixels could not be decoded"));
  let bounds;
  try { bounds = alphaBounds(rgba, meta.width, meta.height); }
  catch { fail("INVALID_ARTWORK", "Artwork must contain visible ink"); }
  const source = { width: meta.width, height: meta.height, bounds };
  if (!version.parentId && (candidate.preview?.width !== meta.width || candidate.preview?.height !== meta.height)) fail("ARTWORK_DIMENSIONS_MISMATCH", "Manifest dimensions do not match PNG");
  const sourceKey = hash(JSON.stringify([manifest.brief.id, version.candidateId, version.id]));
  const evidence = { manifest, version: { ...version, image: undefined }, ancestors, printAreas, artworkHash, source };
  const fingerprint = hash(JSON.stringify(evidence));
  const result = (product: NonNullable<Awaited<ReturnType<typeof prisma.product.findFirst>>>, reused: boolean) => factoryDraftResultSchema.parse({ product, reused, blockers: FACTORY_BLOCKERS });
  const existing = async () => {
    const product = await prisma.product.findFirst({ where: { storeId: store.id, factorySourceKey: sourceKey }, include });
    if (!product) return null;
    if ((product.factoryDraft as Prisma.JsonObject)?.fingerprint !== fingerprint) throw new StoreError("VERSION_CHANGED", "This version already has a draft with different evidence. Create and review a new version", { status: 409 });
    return result(product, true);
  };
  const found = await existing();
  if (found) return found;
  const scene = await prisma.mockupScene.findUnique({ where: { storeId_productType: { storeId: store.id, productType: settings.productType } } });
  if (!scene) fail("SCENE_REQUIRED", "Configure this tenant's garment photographs before creating a draft");
  const bases = (scene.baseImages ?? {}) as Record<string, string>;
  const previews: { color: string; data: Buffer; profile: PrintAreaProfile; baseHash: string }[] = [];
  for (const color of settings.colors) {
    const url = bases[color];
    const id = /^\/api\/assets\/([^/?#]+)$/.exec(url ?? "")?.[1];
    if (!id) fail("BASE_REQUIRED", `Upload a tenant-owned blank photograph for ${color}`);
    const base = await prisma.storeAsset.findFirst({ where: { id, storeId: store.id } });
    if (!base) fail("BASE_REQUIRED", `Photograph for ${color} is missing or belongs to another tenant`);
    const profiles = printAreas.filter(p => p.productType === settings.productType && p.baseImageUrl === url);
    if (profiles.length !== 1) fail("CALIBRATION_REQUIRED", `Include exactly one reviewed front calibration for ${settings.productType}, ${color}. Close the dialog, select this color and save its Print Area calibration`);
    const profile = profiles[0];
    const baseData = Buffer.from(base.data);
    const dimensions = await sharp(baseData).metadata();
    if (dimensions.width !== profile.mockup.width || dimensions.height !== profile.mockup.height) fail("STALE_CALIBRATION", `Photograph dimensions changed for ${color}`);
    const layout = constrainedPlacement(placement, source, profile.canvas);
    if (Math.abs(layout.normalized.x - placement.x) > 1e-8 || Math.abs(layout.normalized.y - placement.y) > 1e-8 || Math.abs(layout.normalized.scale - placement.scale) > 1e-8) fail("PLACEMENT_CHANGED", "Artwork requires containment changes; re-review and Keep before handoff");
    const composite = await compositeDesignOnScene({ baseImageUrl: url, baseImageData: baseData, designUrl: version.image, designData: bytes, area: profile.mapping, placement, printCanvas: profile.canvas });
    previews.push({ color, data: composite.data, profile, baseHash: hash(baseData) });
  }
  try {
    return await prisma.$transaction(async tx => {
      const prior = await tx.product.findFirst({ where: { storeId: store.id, factorySourceKey: sourceKey }, include });
      if (prior) {
        if ((prior.factoryDraft as Prisma.JsonObject)?.fingerprint !== fingerprint) throw new StoreError("VERSION_CHANGED", "Version evidence changed; review a new version", { status: 409 });
        return result(prior, true);
      }
      const art = await tx.storeAsset.create({ data: { storeId: store.id, kind: "factory-preview-artwork", mimeType: "image/png", data: new Uint8Array(bytes) } });
      const images = [];
      for (const preview of previews) {
        const asset = await tx.storeAsset.create({ data: { storeId: store.id, kind: "factory-preview-composite", mimeType: "image/jpeg", data: new Uint8Array(preview.data) } });
        images.push({ url: `/api/assets/${asset.id}`, altText: `PODSite preview composite: ${settings.productType}, ${preview.color}. Not Printify verified.`, color: preview.color });
      }
      // Existing product creation owns variant defaults and its activity entry.
      const product = await createProduct(store.id, productCreateSchema.parse({
        ...settings, slug: `factory-${sourceKey}`, optionNames: ["color", "size"], isActive: false, isFeatured: false, images: [],
        variants: settings.colors.flatMap((color, c) => settings.sizes.map((size, s) => ({ sku: `factory-${sourceKey}-${c}-${s}`, options: { color, size }, priceCents: settings.priceCents, currency: settings.currency, provider: "PRINTIFY", inStock: false }))),
      }), actor, tx);
      const snapshot = { ...evidence, fingerprint, sourceKey, artworkUrl: `/api/assets/${art.id}`, settings, ready: false, blockers: FACTORY_BLOCKERS,
        previews: previews.map(p => ({ color: p.color, profile: p.profile, baseHash: p.baseHash, compositeHash: hash(p.data) })) };
      const saved = await tx.product.update({ where: { id: product.id, storeId: store.id }, data: {
        factorySourceKey: sourceKey, factoryDraft: json(snapshot), images: { create: [
          ...images.map((img, position) => ({ url: img.url, altText: img.altText, position, optionValues: { color: img.color } })),
          { url: `/api/assets/${art.id}`, altText: "Kept preview artwork (original bytes); not a production print file", position: images.length },
        ] },
      }, include });
      await logActivity(store.id, { actor, category: "factory-draft", summary: `Created inactive Factory draft: ${saved.title}`, details: { productId: saved.id, sourceKey, artworkHash, fingerprint, blockers: FACTORY_BLOCKERS } }, tx);
      return result(saved, false);
    }, { timeout: 20000 });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && ["P2002", "SLUG_TAKEN", "SKU_TAKEN"].includes(String(error.code))) {
      const duplicate = await existing();
      if (duplicate) return duplicate;
    }
    throw error;
  }
}

/** Merchandising edits preserve immutable review evidence and never enable commerce. */
export async function updateFactoryDraft(store: Store, id: string, raw: unknown, actor: ActivityActor) {
  const { factoryDraftSettingsSchema } = await import("@/lib/design/factory-draft");
  const settings = factoryDraftSettingsSchema.parse(raw);
  return prisma.$transaction(async tx => {
    const product = await tx.product.findFirst({ where: { id, storeId: store.id }, include });
    if (!product?.factorySourceKey || !product.factoryDraft) throw new StoreError("NOT_FOUND", "Factory draft not found", { status: 404 });
    if (product.isActive || product.variants.some(v => v.inStock || v.providerVariantId)) fail("DRAFT_CHANGED", "Only inactive, unavailable, unverified Factory drafts can be edited here");
    const evidence = product.factoryDraft as Prisma.JsonObject;
    const original = evidence.settings as Prisma.JsonObject;
    if (settings.productType !== product.productType) fail("REVIEW_GARMENT_FIRST", "Garment changes require a new reviewed version with matching placement and calibration");
    if (settings.colors.some(c => !(original.colors as string[]).includes(c))) fail("REVIEW_COLORS_FIRST", "Only colors with preserved preview evidence can be selected");
    const references = await tx.productVariant.count({ where: { storeId: store.id, productId: id, OR: [{ cartItems: { some: {} } }, { orderItems: { some: {} } }] } });
    if (references) fail("DRAFT_REFERENCED", "Referenced variants cannot be replaced");
    await tx.productVariant.deleteMany({ where: { storeId: store.id, productId: id } });
    const saved = await tx.product.update({ where: { id, storeId: store.id }, data: {
      title: settings.title, description: settings.description, isActive: false, isFeatured: false,
      variants: { create: settings.colors.flatMap((color, c) => settings.sizes.map((size, s) => ({ storeId: store.id, sku: `factory-${product.factorySourceKey}-${c}-${s}`, options: { color, size }, priceCents: settings.priceCents, currency: settings.currency, provider: "PRINTIFY" as const, inStock: false }))) },
    }, include });
    await logActivity(store.id, { actor, category: "factory-draft", summary: `Edited inactive Factory draft: ${saved.title}`, details: { productId: id, settings } }, tx);
    return factoryDraftResultSchema.parse({ product: saved, reused: false, blockers: FACTORY_BLOCKERS });
  });
}
