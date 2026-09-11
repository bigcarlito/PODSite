import { z } from "zod";
import { navLinkSchema } from "@/lib/platform-schemas";
import { aspectsSchema } from "@/lib/design/aspects";

export const variantInputSchema = z.object({
  id: z.string().optional(), // present = update existing variant, absent = create new
  sku: z.string().min(1),
  /// Values for the product's optionNames, e.g. {"size":"M","color":"Forest"}
  /// or {"printType":"Canvas","size":"16x20"}. Should have one entry per
  /// name in the product's optionNames.
  options: z.record(z.string(), z.string()).default({}),
  priceCents: z.number().int().positive(),
  currency: z.string().length(3).default("USD"),
  provider: z.enum(["PRINTFUL", "PRINTIFY", "GELATO"]).default("PRINTFUL"),
  providerVariantId: z.string().optional(),
  inStock: z.boolean().default(true),
});

export const productCreateSchema = z.object({
  slug: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  /// Ordered option keys this product's variants vary by, e.g.
  /// ["size","color"] or ["printType","size"]. Every variant's `options`
  /// should have a value for each name listed here.
  optionNames: z.array(z.string()).default([]),
  isFeatured: z.boolean().default(false),
  isActive: z.boolean().default(true),
  /// Category for scene-based AI mockups, e.g. "tshirt" — matches a
  /// MockupScene.productType. See POST /api/agent/products/:id/mockups/ai.
  productType: z.string().min(1).optional(),
  collectionIds: z.array(z.string()).default([]),
  images: z
    .array(z.object({ url: z.string().url(), altText: z.string().optional() }))
    .default([]),
  variants: z.array(variantInputSchema).min(1),
});

export const productUpdateSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  optionNames: z.array(z.string()).optional(),
  isFeatured: z.boolean().optional(),
  isActive: z.boolean().optional(),
  productType: z.string().min(1).optional(),
  collectionIds: z.array(z.string()).optional(),
  images: z
    .array(z.object({ url: z.string().url(), altText: z.string().optional() }))
    .optional(),
  variants: z.array(variantInputSchema).optional(),
});

/// Generate per-garment-color mockups of a design on an existing product.
export const mockupGenerateSchema = z.object({
  /// Publicly reachable print file — a transparent PNG at print resolution.
  designUrl: z.string().url(),
  placement: z.string().default("front"),
  /// Which of the product's optionNames carries the garment color.
  colorOptionName: z.string().default("color"),
  /// Restrict to these garment colors; omitted means every color the product has.
  colors: z.array(z.string()).optional(),
  /// Supply garment hexes directly instead of looking them up from the
  /// provider — the only way to preview colors without provider credentials.
  garments: z
    .array(z.object({ name: z.string().min(1), hex: z.string().min(4) }))
    .optional(),
  catalogProductId: z.string().optional(),
  /// Minimum WCAG contrast between every significant design color and the
  /// garment for that garment to be considered legible.
  minContrast: z.number().positive().optional(),
  /// Ignore design colors covering less than this share of the artwork.
  minCoverage: z.number().min(0).max(1).optional(),
  /// Score colors and report, without calling the provider or writing images.
  dryRun: z.boolean().default(false),
});

/// Generate per-garment-color mockups by AI-recoloring a shared scene photo
/// (this product's MockupScene, keyed by Product.productType) and
/// compositing the design onto it — an alternative to the Printful
/// mockup-generator above, for a non-generic/non-white-background result.
export const aiMockupGenerateSchema = z.object({
  /// Publicly reachable print file — a transparent PNG at print resolution.
  designUrl: z.string().url(),
  /// Which of the product's optionNames carries the garment color.
  colorOptionName: z.string().default("color"),
  /// Restrict to these garment colors; omitted means every color the product has.
  colors: z.array(z.string()).optional(),
});

/// Sets the rectangle a design gets placed into on a MockupScene, as
/// fractions of the scene image's own pixel dimensions (each 0-1).
export const designAreaSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  width: z.number().min(0).max(1),
  height: z.number().min(0).max(1),
});

/// Generates every color's design-free "blank" base mockup for a product
/// type — see POST /api/agent/mockup-scenes/:productType/generate-bases.
export const generateMockupSceneBasesSchema = z.object({
  /// Overrides OPENROUTER_MOCKUP_MODEL for this call.
  model: z.string().optional(),
});

/// Uploads/replaces the shared scene photo for a product type. JSON body
/// (not multipart), same reasoning as heroImageUploadSchema below.
export const mockupSceneUploadSchema = z.object({
  data: z.string().min(1), // base64, no "data:image/...;base64," prefix
  mimeType: z.enum(["image/png", "image/jpeg", "image/webp"]),
  /// The garment colors this product type comes in. Omit to keep the
  /// existing lineup when just replacing the photo; required at least
  /// once before this product type can be used to auto-generate a product.
  colors: z.array(z.object({ name: z.string().min(1), hex: z.string().min(4) })).optional(),
});

/// Auto-creates a product from a design: generates a title/description
/// with an AI text model, builds one variant per color (x size) using the
/// product type's MockupScene color lineup, then generates AI mockups for
/// every color — see POST /api/agent/products/generate-from-design.
export const aiProductCreateSchema = z.object({
  productType: z.string().min(1),
  /// Publicly reachable print file — a transparent PNG at print resolution.
  designUrl: z.string().url(),
  priceCents: z.number().int().positive(),
  currency: z.string().length(3).default("USD"),
  /// Applied to every color. Defaults to a standard apparel size run.
  sizes: z.array(z.string().min(1)).default(["S", "M", "L", "XL"]),
  colorOptionName: z.string().default("color"),
  sizeOptionName: z.string().default("size"),
  /// Overrides OPENROUTER_TEXT_MODEL for the title/description call.
  textModel: z.string().optional(),
});

export const collectionCreateSchema = z.object({
  slug: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  heroImage: z.string().url().optional(),
});

/// A store updating its own brand/copy — never slug, domain, or credentials.
export const storeUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  tagline: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  tone: z.string().optional(),
  audience: z.string().optional(),
  /// Fuller brand/business knowledge — see Store.brief in schema.prisma.
  /// Merge this yourself (fetch current via GET /api/agent/briefing first)
  /// — a PATCH here replaces the whole object, it doesn't deep-merge.
  brief: z.record(z.string(), z.unknown()).optional(),
  theme: z
    .object({
      accent: z.string(),
      accentDark: z.string(),
      /// Either an absolute URL (an externally-hosted image) or a
      /// same-origin path (an uploaded asset, e.g. "/api/assets/<id>")
      /// — z.string().url() alone would reject the latter.
      heroImageUrl: z
        .string()
        .refine(
          (v) => v.startsWith("/") || /^https?:\/\//.test(v),
          "Must be an absolute URL or a path starting with \"/\""
        ),
      /// Shown in the header in place of the store name text (name becomes
      /// its hover tooltip) — same URL-shape rule as heroImageUrl above.
      logoUrl: z
        .string()
        .refine(
          (v) => v.startsWith("/") || /^https?:\/\//.test(v),
          "Must be an absolute URL or a path starting with \"/\""
        ),
    })
    .partial()
    .optional(),
  nav: z.array(navLinkSchema).optional(),
  footerLinks: z.record(z.string(), z.array(navLinkSchema)).optional(),
  trustBadges: z.array(z.string()).optional(),
  socialLinks: z.array(navLinkSchema).optional(),
  /// Raw HTML shown above the header on every page — empty/omitted hides
  /// it. Trusted content (this store's own admin/agent), rendered
  /// unescaped — never fed from end-user input.
  bannerHtml: z.string().optional(),
});

/// Base64-encoded image upload — used to set the homepage hero image.
/// JSON body (not multipart) so this stays a single zod-validated action,
/// consistent with every other agent-facing endpoint (see AGENTS.md #13).
export const heroImageUploadSchema = z.object({
  data: z.string().min(1), // base64, no "data:image/...;base64," prefix
  mimeType: z.enum(["image/png", "image/jpeg", "image/webp"]),
});

/// Base64-encoded image upload — used to set the header logo image.
export const logoImageUploadSchema = z.object({
  data: z.string().min(1), // base64, no "data:image/...;base64," prefix
  mimeType: z.enum(["image/png", "image/jpeg", "image/webp"]),
});

export const activityCreateSchema = z.object({
  category: z.string().min(1),
  summary: z.string().min(1),
  details: z.record(z.string(), z.unknown()).optional(),
});

/// Shared by both prune endpoints — dryRun defaults true so a caller must
/// explicitly ask for the real, destructive thing.
export const pruneSchema = z.object({
  dryRun: z.boolean().default(true),
});

/// Creates a Design from structured aspects — see the design-system notes
/// in AGENTS.md. `aspects` is validated against the versioned vocabulary
/// in src/lib/design/aspects.ts; `slug` auto-derives from phrase/subject
/// when omitted.
export const designCreateSchema = z.object({
  slug: z.string().min(1).optional(),
  aspects: aspectsSchema,
  /// Which ImageProvider adapter to use — see src/lib/design/providers/.
  provider: z.string().min(1).default("openrouter"),
  /// Provider-specific model slug — falls back to the adapter's own default.
  model: z.string().min(1).optional(),
  negativePrompt: z.string().optional(),
});

/// Re-runs generation for an existing design — a new seed/attempt, same
/// aspects. All fields optional: omitted means "same as the design already
/// has" (see regenerateDesign in src/lib/design/designs.ts).
export const designRegenerateSchema = z.object({
  provider: z.string().min(1).optional(),
  model: z.string().min(1).optional(),
  negativePrompt: z.string().optional(),
});

/// Sets the pixel spec one fulfillment provider expects for one product
/// type on this store — see PUT /api/agent/print-templates/:provider/:productType.
export const printTemplateUpsertSchema = z.object({
  widthPx: z.number().int().positive(),
  heightPx: z.number().int().positive(),
  minDpi: z.number().int().positive(),
  format: z.string().min(1).default("png"),
});

/// Turns a QC-passed design into one or more real products, one per
/// garment type — see POST /api/agent/designs/:id/publish. Each entry
/// mirrors aiProductCreateSchema's product-creation fields, minus
/// `designUrl` (derived from the design's own masterImageUrl).
const designPublishProductTypeSchema = z.object({
  productType: z.string().min(1),
  priceCents: z.number().int().positive(),
  currency: z.string().length(3).default("USD"),
  sizes: z.array(z.string().min(1)).default(["S", "M", "L", "XL"]),
  colorOptionName: z.string().default("color"),
  sizeOptionName: z.string().default("size"),
  /// Which fulfillment provider's PrintTemplate to derive the file for.
  provider: z.enum(["PRINTFUL", "PRINTIFY", "GELATO"]).default("PRINTFUL"),
});

export const designPublishSchema = z.object({
  productTypes: z.array(designPublishProductTypeSchema).min(1),
  /// Overrides OPENROUTER_TEXT_MODEL for each product's title/description call.
  textModel: z.string().optional(),
});

export type MockupGenerateInput = z.infer<typeof mockupGenerateSchema>;
export type AiMockupGenerateInput = z.infer<typeof aiMockupGenerateSchema>;
export type DesignAreaInput = z.infer<typeof designAreaSchema>;
export type GenerateMockupSceneBasesInput = z.infer<typeof generateMockupSceneBasesSchema>;
export type MockupSceneUploadInput = z.infer<typeof mockupSceneUploadSchema>;
export type AiProductCreateInput = z.infer<typeof aiProductCreateSchema>;
export type ProductCreateInput = z.infer<typeof productCreateSchema>;
export type ProductUpdateInput = z.infer<typeof productUpdateSchema>;
export type CollectionCreateInput = z.infer<typeof collectionCreateSchema>;
export type StoreUpdateInput = z.infer<typeof storeUpdateSchema>;
export type HeroImageUploadInput = z.infer<typeof heroImageUploadSchema>;
export type LogoImageUploadInput = z.infer<typeof logoImageUploadSchema>;
export type ActivityCreateInput = z.infer<typeof activityCreateSchema>;
export type DesignCreateInput = z.infer<typeof designCreateSchema>;
export type DesignRegenerateInput = z.infer<typeof designRegenerateSchema>;
export type PrintTemplateUpsertInput = z.infer<typeof printTemplateUpsertSchema>;
export type DesignPublishInput = z.infer<typeof designPublishSchema>;
export type PruneInput = z.infer<typeof pruneSchema>;
