import type { Store } from "@prisma/client";

export type NavLink = { label: string; href: string };
export type FooterLinkGroup = Record<string, NavLink[]>;

const DEFAULT_THEME = { accent: "#3f4a2f", accentDark: "#2c3420" };

/**
 * Normalizes a Store's JSON brand fields (theme/nav/footerLinks/etc. —
 * generic on purpose, see AGENTS.md #10) into typed values with sane
 * defaults, so components don't scatter `as X` casts over Prisma's
 * loosely-typed Json columns.
 */
export function getStoreBranding(store: Store) {
  const theme =
    (store.theme as
      | { accent?: string; accentDark?: string; heroImageUrl?: string }
      | null) ?? {};
  return {
    name: store.name,
    tagline: store.tagline,
    description: store.description,
    trustBadges: (store.trustBadges as string[] | null) ?? [],
    nav: (store.nav as NavLink[] | null) ?? [],
    footerLinks: (store.footerLinks as FooterLinkGroup | null) ?? {},
    social: (store.socialLinks as NavLink[] | null) ?? [],
    theme: {
      accent: theme.accent ?? DEFAULT_THEME.accent,
      accentDark: theme.accentDark ?? DEFAULT_THEME.accentDark,
      heroImageUrl: theme.heroImageUrl,
    },
  };
}

export type StoreBranding = ReturnType<typeof getStoreBranding>;
