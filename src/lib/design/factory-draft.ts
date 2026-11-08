import { z } from "zod";
import { factoryManifestSchema } from "./factory";
import { reviewVersionSchema } from "./factory-review";
import { printAreaProfileSchema } from "./placement";

export const FACTORY_COLORS = ["Ivory", "Blossom", "Butter", "Bay", "Espresso"] as const;
export const factoryDraftSettingsSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(10000),
  productType: z.string().trim().min(1).max(100).default("comfort-colors-1717"),
  colors: z.array(z.enum(FACTORY_COLORS)).min(1).max(5).default([...FACTORY_COLORS]),
  sizes: z.array(z.enum(["S", "M", "L", "XL", "2XL", "3XL", "4XL"])).min(1).max(7).default(["S", "M", "L", "XL"]),
  priceCents: z.number().int().positive().max(1000000),
  currency: z.literal("USD").default("USD"),
}).strict().refine(v => new Set(v.colors).size === v.colors.length && new Set(v.sizes).size === v.sizes.length, "Options must be unique");
export const factoryDraftInputSchema = z.object({
  manifest: factoryManifestSchema,
  version: reviewVersionSchema,
  // Ancestor recipes only; their image bytes are not needed to preserve lineage.
  ancestors: z.array(reviewVersionSchema.omit({ image: true })).max(50).default([]),
  printAreas: z.array(printAreaProfileSchema).max(100).default([]),
  settings: factoryDraftSettingsSchema,
}).strict();
export const FACTORY_BLOCKERS = [
  "Supplier variants, costs, availability and shipping are unverified",
  "Artwork is preview-only: approved upscale and full-area transparent print file required",
  "Provider identity, physical dimensions, DPI, placement proof and sample require approval",
  "Preview composites are PODSite previews, not Printify verified mockups",
  "Owner copy, prices and launch approval required; product remains inactive and unavailable",
];
export const factoryDraftResultSchema = z.object({
  product: z.object({ id: z.string(), storeId: z.string(), title: z.string(), description: z.string(), productType: z.string().nullable(), isActive: z.literal(false), isFeatured: z.literal(false),
    variants: z.array(z.object({ inStock: z.literal(false), providerVariantId: z.null(), priceCents: z.number().int() }).passthrough()),
    images: z.array(z.object({ url: z.string(), altText: z.string().nullable() }).passthrough()), factoryDraft: z.unknown(),
  }).passthrough(),
  reused: z.boolean(), blockers: z.array(z.string()),
});
