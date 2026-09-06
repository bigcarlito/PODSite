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

export const activityCreateSchema = z.object({
  category: z.string().min(1),
  summary: z.string().min(1),
  details: z.record(z.string(), z.unknown()).optional(),
});

export type ProductCreateInput = z.infer<typeof productCreateSchema>;
export type ProductUpdateInput = z.infer<typeof productUpdateSchema>;
export type CollectionCreateInput = z.infer<typeof collectionCreateSchema>;
export type StoreUpdateInput = z.infer<typeof storeUpdateSchema>;
export type HeroImageUploadInput = z.infer<typeof heroImageUploadSchema>;
export type ActivityCreateInput = z.infer<typeof activityCreateSchema>;
