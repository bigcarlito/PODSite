import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { StoreError } from "@/lib/store/errors";
import type { Store } from "@prisma/client";

/**
 * Extract a bare store slug from a host hint, if it looks like one — either
 * a query-param override (already bare) or a subdomain of ROOT_DOMAIN.
 * Returns null for anything that looks like an unrelated hostname (a
 * custom domain, or the root domain itself), which the caller should then
 * try as an exact Store.domain match instead.
 */
function extractSlug(hint: string): string | null {
  const rootDomain = process.env.ROOT_DOMAIN;

  if (rootDomain) {
    if (hint === rootDomain) return null; // apex domain — no store, platform-level
    if (hint.endsWith(`.${rootDomain}`)) {
      const sub = hint.slice(0, -(rootDomain.length + 1));
      return sub && sub !== "www" ? sub : null;
    }
  }

  if (hint.includes(".")) return null; // looks like some other hostname
  return hint || null; // bare slug, e.g. from ?store= or plain "localhost"
}

/**
 * Resolves the Store for the current request. Cached per-request so
 * multiple calls (layout, page, actions) only hit the DB once. Returns
 * null when no store matches — callers should 404 or show a platform page.
 */
export const getCurrentStore = cache(async (): Promise<Store | null> => {
  const headersList = await headers();
  const hint = headersList.get("x-store-hint") ?? "";

  const slug = extractSlug(hint);
  if (slug) {
    const store = await prisma.store.findUnique({ where: { slug } });
    if (store?.isActive) return store;
  }

  const hostname = hint.split(":")[0];
  if (hostname) {
    const store = await prisma.store.findUnique({ where: { domain: hostname } });
    if (store?.isActive) return store;
  }

  // Falls back to the last ?store= override remembered in a cookie (set
  // by middleware) — only reached when the hostname itself didn't resolve
  // to anything real, so this never overrides a genuine subdomain/domain
  // match in production. Exists so a server-side redirect that drops the
  // query string (e.g. checkout → confirmation) doesn't lose the override
  // when testing multiple stores locally without real subdomains.
  const cookieHint = headersList.get("x-store-hint-cookie") ?? "";
  if (cookieHint) {
    const store = await prisma.store.findUnique({ where: { slug: cookieHint } });
    if (store?.isActive) return store;
  }

  const devSlug = process.env.DEV_STORE_SLUG;
  if (devSlug) {
    const store = await prisma.store.findUnique({ where: { slug: devSlug } });
    if (store?.isActive) return store;
  }

  return null;
});

/**
 * Like getCurrentStore, but throws a structured 404 if none found. Use
 * this in agent API routes and admin actions (where the caller expects a
 * JSON error); use getCurrentStore() + notFound() in storefront pages.
 */
export async function requireCurrentStore(): Promise<Store> {
  const store = await getCurrentStore();
  if (!store) {
    throw new StoreError(
      "STORE_NOT_FOUND",
      "No store resolved for this request — check the hostname/subdomain, " +
        "the ?store= override, or DEV_STORE_SLUG.",
      { status: 404 }
    );
  }
  return store;
}
