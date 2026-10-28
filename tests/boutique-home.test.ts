import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { boutiqueSchema, featuredProductsQuery, getCommercePolicy, isBoutiqueTenant, storefrontSchema } from "../src/lib/storefront-theme";

test("boutique homepage is isolated to the real shihtshirt tenant", () => {
  assert.equal(isBoutiqueTenant("shihtshirt"), true);
  assert.deepEqual(getCommercePolicy({ slug: "shihtshirt", theme: { commerce: { checkoutEnabled: false, fulfillmentMode: "manual" } } }), { checkoutEnabled: false, fulfillmentMode: "manual" });
  for (const slug of ["bird-nerd", "birdnerd", "other", "shihtshirts"]) assert.equal(isBoutiqueTenant(slug), false);
  const page = readFileSync("src/app/page.tsx", "utf8");
  assert.match(page, /isBoutiqueTenant\(store.slug\)/);
  assert.match(page, /if \(boutique\) return <BoutiqueHome/);
});

test("featured database query excludes inactive products and other tenants", () => {
  const query = featuredProductsQuery("tenant-a", 4);
  assert.deepEqual(query, { where: { storeId: "tenant-a", isActive: true, isFeatured: true }, take: 4 });
  const fixture = [
    { storeId: "tenant-a", isActive: false, isFeatured: true, title: "The Look" },
    { storeId: "tenant-b", isActive: true, isFeatured: true, title: "Other tenant" },
    { storeId: "tenant-a", isActive: true, isFeatured: false, title: "Unfeatured" },
  ];
  assert.equal(fixture.filter(p => Object.entries(query.where).every(([key, value]) => p[key as keyof typeof p] === value)).length, 0);
  assert.match(readFileSync("src/app/page.tsx", "utf8"), /\.\.\.featuredProductsQuery\(store.id, boutique\?\.featuredCount \?\? 8\)/);
});

test("homepage settings validate count, section toggles, copy and approved image slots", () => {
  const c = boutiqueSchema.parse({ sections: { mascots: false }, featuredCount: 6 });
  assert.equal(c.sections.mascots, false);
  assert.equal(c.sections.hero, true);
  assert.equal(c.heroTitle, "Small dogs. Big personalities.");
  assert.equal(c.sami, undefined);
  assert.equal(c.bogey, undefined);
  for (const featuredCount of [0, 13, 1.5]) assert.equal(boutiqueSchema.safeParse({ featuredCount }).success, false);
  assert.equal(storefrontSchema.safeParse({ boutique: { sami: { src: "javascript:alert(1)" } } }).success, false);
  assert.equal(storefrontSchema.parse({ boutique: { finalLabel: "Explore" } }).boutique?.finalLabel, "Explore");
});
