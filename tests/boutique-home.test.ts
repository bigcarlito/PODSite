import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { boutiqueSchema, featuredProductsQuery, getCommercePolicy, isBoutiqueTenant, storefrontSchema } from "../src/lib/storefront-theme";
import { isShihStore } from "../src/lib/shih-storefront";

test("boutique homepage is isolated to the real shihtshirt tenant", () => {
  assert.equal(isBoutiqueTenant("shihtshirt"), true);
  assert.deepEqual(getCommercePolicy({ slug: "shihtshirt", theme: { commerce: { checkoutEnabled: false, fulfillmentMode: "manual" } } }), { checkoutEnabled: false, fulfillmentMode: "manual" });
  for (const slug of ["bird-nerd", "birdnerd", "other", "shihtshirts"]) assert.equal(isBoutiqueTenant(slug), false);
  const page = readFileSync("src/app/page.tsx", "utf8");
  assert.match(page, /isBoutiqueTenant\(store.slug\)/);
  // The responsive ShihHome supersedes the legacy boutique for these tenants.
  for (const slug of ["shihtshirt", "shihtshirts", "shihttshirts"]) assert.equal(isShihStore(slug), true);
  for (const slug of ["bird-nerd", "birdnerd", "other"]) assert.equal(isShihStore(slug), false);
  assert.match(page, /if \(boutique && !branding.isShih\) \{/);
  assert.match(page, /if \(branding.isShih\) return <ShihHome branding=\{branding\} products=\{featured\}/);
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
  assert.match(readFileSync("src/app/page.tsx", "utf8"), /\.\.\.featuredProductsQuery\(store.id, 8\)/);
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


// Render the actual retail component with a CSS-module stub under the Node runner.
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createRequire } from "node:module";
const requireModule = createRequire(import.meta.url);
requireModule.extensions[".css"] = module => { module.exports = { __esModule: true, default: new Proxy({}, { get: (_target, name) => String(name) }) }; };

test("retail rendering handles empty catalog, unavailable preview and active products", async () => {
  const { BoutiqueHome } = await import("../src/components/BoutiqueHome");
  const render = (props: Partial<React.ComponentProps<typeof BoutiqueHome>>) => renderToStaticMarkup(React.createElement(BoutiqueHome, { config: boutiqueSchema.parse({}), artwork: {}, products: [], ...props }));
  const empty = render({});
  assert.match(empty, /Nothing is available to purchase/);
  assert.doesNotMatch(empty, /href="\/products\//);
  const preview = render({ preview: { slug: "the-look", title: "The Look", imageUrl: "/api/assets/real-mockup" } });
  assert.match(preview, /Coming Soon/);
  assert.match(preview, /\/api\/assets\/real-mockup/);
  assert.match(preview, /Not available to purchase/);
  assert.doesNotMatch(preview, /href="\/products\/the-look"|\$0|Add to cart/);
  const active = render({ products: [{ slug: "real-tee", title: "Real tee", priceCents: 2800, currency: "USD", imageUrl: "/real.jpg" }] });
  assert.match(active, /href="\/products\/real-tee"/);
  assert.match(active, /\$28.00/);
  assert.equal((active.match(/<h3>Real tee<\/h3>/g) ?? []).length, 1);
  assert.match(active, /id="collection"/);
  assert.match(active, /alt="Real tee"/);
  assert.match(active, /aria-labelledby="featured-title"/);
  const noPrice = render({ products: [{ slug: "draft-price", title: "No price" }] });
  assert.match(noPrice, /Pricing coming soon/);
  assert.doesNotMatch(noPrice, /\$0/);
});

test("retail queries and responsive styles preserve boundaries", () => {
  const page = readFileSync("src/app/page.tsx", "utf8");
  assert.match(page, /where: \{ storeId: store.id, isActive: true \}/);
  assert.match(page, /where: \{ storeId: store.id, isActive: false, slug: "the-look-shih-tzu-comfort-colors-1717" \}/);
  const css = readFileSync("src/components/BoutiqueHome.module.css", "utf8");
  assert.match(css, /repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css, /repeat\(4,minmax\(0,1fr\)\)/);
  assert.match(css, /:focus-visible/);
  assert.match(readFileSync("src/app/products/[slug]/page.tsx", "utf8"), /isActive: true/);
});

test("inactive product cannot be added directly or checked out from a stale cart", () => {
  const cart = readFileSync("src/app/cart/actions.ts", "utf8");
  assert.match(cart, /product: \{ storeId: store.id, isActive: true \}/);
  const checkout = readFileSync("src/app/checkout/actions.ts", "utf8");
  assert.ok(checkout.indexOf("!item.variant.product.isActive") < checkout.indexOf("const order = await createPendingOrder"));
  assert.match(checkout, /item.variant.product.storeId !== store.id/);
});
