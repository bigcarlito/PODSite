import { z } from "zod";

export const artworkUrl = z.string().max(2000).refine(
  (v) => /^https?:\/\//.test(v) || (/^\/(?!\/)/.test(v) && !v.includes("\\")),
  "Use an http(s) URL or a same-origin path"
);
const image = z.object({ src: artworkUrl, mobileSrc: artworkUrl.optional(), alt: z.string().max(200).default("") });
export const storefrontSchema = z.object({
  eyebrow: z.string().max(100).optional(),
  shopLabel: z.string().max(80).optional(),
  featuredTitle: z.string().max(100).optional(),
  hero: image.optional(),
  story: image.extend({ title: z.string().max(150), text: z.string().max(1500) }).optional(),
  promos: z.array(image.extend({ title: z.string().max(100), collectionSlug: z.string().regex(/^[a-z0-9-]+$/) })).max(6).optional(),
  decorations: z.array(image.extend({ side: z.enum(["left", "right"]), widthPercent: z.number().min(5).max(25), bottomPercent: z.number().min(0).max(30) })).max(2).optional(),
  productBadges: z.record(z.string(), z.string().max(40)).optional(),
});
export const commerceSchema = z.object({
  checkoutEnabled: z.boolean().default(false),
  fulfillmentMode: z.enum(["manual", "automatic"]).default("manual"),
});
export function getCommercePolicy(store: { slug: string; theme: unknown }) {
  const theme = store.theme as { commerce?: unknown } | null;
  const parsed = commerceSchema.safeParse(theme?.commerce);
  // Existing tenants retain behavior; the launch tenant always defaults closed/manual.
  return parsed.success ? parsed.data : {
    checkoutEnabled: theme?.commerce === undefined && store.slug !== "shihttshirts" && store.slug !== "shihtshirts",
    fulfillmentMode: "manual" as const,
  };
}
export function isManualFulfillment(store: { slug: string; theme: unknown }) {
  const theme = store.theme as { commerce?: unknown } | null;
  if (theme?.commerce !== undefined || ["shihtshirts", "shihttshirts"].includes(store.slug)) {
    return getCommercePolicy(store).fulfillmentMode === "manual";
  }
  return false;
}
