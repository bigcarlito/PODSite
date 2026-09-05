import { z } from "zod";

export const navLinkSchema = z.object({ label: z.string(), href: z.string() });

export const storeCreateSchema = z.object({
  slug: z
    .string()
    .min(1)
    .regex(/^[a-z0-9-]+$/, "slug must be lowercase letters, numbers, hyphens"),
  name: z.string().min(1),
  tagline: z.string().min(1),
  description: z.string().min(1),
  /// Free-text brief for an agent generating this store's copy/products —
  /// not rendered on the storefront. e.g. "self-deprecating, insider humor"
  tone: z.string().optional(),
  /// Free-text brief, e.g. "casual/intermediate disc golfers"
  audience: z.string().optional(),
  /// Fuller brand/business knowledge — see Store.brief in schema.prisma.
  brief: z.record(z.string(), z.unknown()).optional(),
  domain: z.string().optional(),
  theme: z.object({ accent: z.string(), accentDark: z.string() }).partial().optional(),
  nav: z.array(navLinkSchema).optional(),
  footerLinks: z.record(z.string(), z.array(navLinkSchema)).optional(),
  trustBadges: z.array(z.string()).optional(),
  socialLinks: z.array(navLinkSchema).optional(),
  printfulApiKey: z.string().optional(),
});

export type StoreCreateInput = z.infer<typeof storeCreateSchema>;
