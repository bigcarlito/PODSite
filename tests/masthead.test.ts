import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createRequire } from "node:module";
import { getMasthead, mastheadSchema, storefrontSchema } from "../src/lib/storefront-theme";
const requireModule = createRequire(import.meta.url);
requireModule.extensions[".css"] = module => { module.exports = { __esModule: true, default: new Proxy({}, { get: (_target, name) => String(name) }) }; };

test("masthead tenant isolation and explicit opt out", () => {
  assert.ok(getMasthead("shihtshirt"));
  assert.equal(getMasthead("shihtshirt", { style: "standard" }), null);
  for (const slug of ["bird-nerd", "birdnerd", "shihtshirts", "other"]) {
    assert.equal(getMasthead(slug, { style: "branded" }), null);
  }
  assert.equal(getMasthead("shihtshirt", { style: "unknown" }), null);
});

test("masthead settings validate artwork, bounded content and palette", () => {
  assert.equal(storefrontSchema.parse({ masthead: {} }).masthead?.palette.length, 5);
  for (const input of [{ sami: { src: "javascript:alert(1)" } }, { palette: [{ label: "a", color: "red" }] }, { benefits: [] }, { tagline: "x".repeat(151) }]) {
    assert.equal(mastheadSchema.safeParse(input).success, false);
  }
  assert.equal(mastheadSchema.parse({ sami: { src: "/approved.jpg", alt: "Approved Sami photo" } }).sami?.src, "/approved.jpg");
});

test("rendered masthead has honest fallbacks, navigation, cart count and decorative palette", async () => {
  const { BrandedMasthead } = await import("../src/components/BrandedMasthead");
  const render = (config = mastheadSchema.parse({}), logoUrl?: string) => renderToStaticMarkup(React.createElement(BrandedMasthead, { config, name: "Actual tenant name", count: 2, logoUrl }));
  const html = render();
  for (const href of ["/", "/products", "/about", "/cart"]) assert.ok(html.includes(`href="${href}"`));
  assert.match(html, /Actual tenant name/);
  assert.match(html, /Small dogs. Big attitude./);
  assert.match(html, /Sami · portrait coming soon/);
  assert.match(html, /Bogey · portrait coming soon/);
  assert.match(html, /Cart, 2 items/);
  assert.match(html, /Brand palette, not garment color options/);
  assert.equal((html.match(/<svg/g) ?? []).length, 4);
  assert.doesNotMatch(html, /<button|<img/);
  const configured = render(mastheadSchema.parse({ sami: { src: "/sami-approved.jpg", alt: "Sami owner photo" } }), "/approved-logo.svg");
  assert.match(configured, /src="\/sami-approved.jpg"/);
  assert.match(configured, /alt="Sami owner photo"/);
  assert.match(configured, /src="\/approved-logo.svg"/);
});

test("mobile structure keeps navigation visible and masthead out of sticky flow", () => {
  const css = readFileSync("src/components/BrandedMasthead.module.css", "utf8");
  assert.match(css, /repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css, /repeat\(4,minmax\(0,1fr\)\)/);
  assert.match(css, /min-height: 44px/);
  assert.match(css, /:focus-visible/);
  assert.doesNotMatch(css, /position:\s*(sticky|fixed)/);
  const header = readFileSync("src/components/Header.tsx", "utf8");
  assert.match(header, /getMasthead\(store.slug, branding.storefront.masthead\)/);
  assert.match(header, /count=\{count\}/);
});
