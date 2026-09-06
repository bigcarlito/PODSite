import type { Store } from "@prisma/client";

/**
 * The subset of a Store row safe to return from the agent API — every
 * brand/copy field, never adminPasswordHash, agentApiKeyHash, or
 * printfulApiKey. Allow-listed (not deny-listed) so a new secret field
 * added to Store later doesn't leak by default.
 */
export function toSafeStore(store: Store) {
  return {
    id: store.id,
    slug: store.slug,
    domain: store.domain,
    isActive: store.isActive,
    name: store.name,
    tagline: store.tagline,
    description: store.description,
    tone: store.tone,
    audience: store.audience,
    brief: store.brief,
    theme: store.theme,
    nav: store.nav,
    footerLinks: store.footerLinks,
    trustBadges: store.trustBadges,
    socialLinks: store.socialLinks,
    bannerHtml: store.bannerHtml,
    createdAt: store.createdAt,
    updatedAt: store.updatedAt,
  };
}

export type SafeStore = ReturnType<typeof toSafeStore>;
