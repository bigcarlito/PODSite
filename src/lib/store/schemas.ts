import { z } from "zod";

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

export type ProductCreateInput = z.infer<typeof productCreateSchema>;
export type ProductUpdateInput = z.infer<typeof productUpdateSchema>;
export type CollectionCreateInput = z.infer<typeof collectionCreateSchema>;
