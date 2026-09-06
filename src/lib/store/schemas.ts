import { z } from "zod";
import { navLinkSchema } from "@/lib/platform-schemas";

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
  theme: z.object({ accent: z.string(), accentDark: z.string() }).partial().optional(),
  nav: z.array(navLinkSchema).optional(),
  footerLinks: z.record(z.string(), z.array(navLinkSchema)).optional(),
  trustBadges: z.array(z.string()).optional(),
  socialLinks: z.array(navLinkSchema).optional(),
  /// Raw HTML shown above the header on every page — empty/omitted hides
  /// it. Trusted content (this store's own admin/agent), rendered
  /// unescaped — never fed from end-user input.
  bannerHtml: z.string().optional(),
});

export const activityCreateSchema = z.object({
  category: z.string().min(1),
  summary: z.string().min(1),
  details: z.record(z.string(), z.unknown()).optional(),
});

export type MockupGenerateInput = z.infer<typeof mockupGenerateSchema>;
export type ProductCreateInput = z.infer<typeof productCreateSchema>;
export type ProductUpdateInput = z.infer<typeof productUpdateSchema>;
export type CollectionCreateInput = z.infer<typeof collectionCreateSchema>;
export type StoreUpdateInput = z.infer<typeof storeUpdateSchema>;
export type ActivityCreateInput = z.infer<typeof activityCreateSchema>;
