import { z } from "zod";

export const artworkUrl = z.string().max(2000).refine(
  (v) => /^https?:\/\//.test(v) || (/^\/(?!\/)/.test(v) && !v.includes("\\")),
  "Use an http(s) URL or a same-origin path"
);
const image = z.object({ src: artworkUrl, mobileSrc: artworkUrl.optional(), alt: z.string().max(200).default("") });
export const mastheadSchema = z.object({
  style: z.enum(["standard", "branded"]).default("branded"),
  tagline: z.string().max(150).default("Small dogs. Big attitude."),
  sami: image.optional(),
  bogey: image.optional(),
  palette: z.array(z.object({ label: z.string().min(1).max(40), color: z.string().regex(/^#[0-9a-fA-F]{6}$/) })).length(5).default([
    { label: "Espresso", color: "#51382f" }, { label: "Peach", color: "#edb59d" },
    { label: "Honey", color: "#c89542" }, { label: "Sage", color: "#929e81" }, { label: "Cream", color: "#f5ead4" },
  ]),
  benefits: z.array(z.string().min(1).max(100)).length(4).default([
    "Unique Shih Tzu designs", "Soft, comfy premium shirts", "Perfect for Shih Tzu people", "Dogs with personality",
  ]),
});
export function getMasthead(slug: string, config?: unknown) {
  if (slug !== "shihtshirt") return null;
  const parsed = mastheadSchema.safeParse(config ?? {});
  return parsed.success && parsed.data.style === "branded" ? parsed.data : null;
}
export const boutiqueSchema = z.object({
  heroTitle: z.string().max(150).default("Small dogs. Big personalities."),
  heroText: z.string().max(500).default("For the humans who know who’s really in charge."),
  personalityTitle: z.string().max(150).default("They may be little. Their opinions aren’t."),
  personalityText: z.string().max(1000).default("The side-eye. The selective hearing. The very strong feelings about your spot on the sofa. If you know, you know."),
  mascotsTitle: z.string().max(150).default("Meet the little bosses"),
  sami: image.optional(),
  bogey: image.optional(),
  samiText: z.string().max(500).default("Sami · Shih Tzu. Small dog, main-character energy."),
  bogeyText: z.string().max(500).default("Bogey · Shih-poo. A little fluff, a lot of personality."),
  valueTitle: z.string().max(150).default("Your kind of people. Your kind of tee."),
  values: z.array(z.object({ title: z.string().max(100), text: z.string().max(500) })).max(3).default([
    { title: "Original designs", text: "A little art. A lot of personality. Inspired by the dogs who run our lives." },
    { title: "Comfortable tees", text: "Easygoing style for slow mornings, dog walks, and your favorite spot on the sofa." },
    { title: "An inside joke, worn out loud", text: "For the people who understand that one look says everything." },
  ]),
  finalTitle: z.string().max(150).default("Wear your Shih Tzu heart on your tee."),
  finalText: z.string().max(500).default("A little something for the humans behind the big personalities."),
  finalLabel: z.string().max(80).default("Find your favorite"),
  emptyText: z.string().max(500).default("Our first collection is getting its finishing touches. Nothing is available to purchase just yet."),
  featuredCount: z.number().int().min(1).max(12).default(4),
  sections: z.object({ hero: z.boolean().default(true), featured: z.boolean().default(true), personality: z.boolean().default(true), mascots: z.boolean().default(true), values: z.boolean().default(true), final: z.boolean().default(true) }).default({}),
});
export function isBoutiqueTenant(slug: string) { return slug === "shihtshirt"; }
export function featuredProductsQuery(storeId: string, take: number) {
  return { where: { storeId, isActive: true, isFeatured: true }, take };
}
export const storefrontSchema = z.object({
  masthead: mastheadSchema.optional(),
  boutique: boutiqueSchema.optional(),
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
