---
name: pod-platform-agent
description: Create and manage print-on-demand stores on this platform — spin up a new store from a brand brief, then read/manage its products, pricing, inventory, and orders via its agent API. Use whenever asked to launch a new POD store, check a store's status, find what needs attention (low stock, stuck orders, pricing issues), or make any product/order/pricing change to an existing store.
---

# POD Platform Agent

One app and one database serve every store on this platform — a store is
a row, not a deployment. This skill is a condensed operating reference;
the full, authoritative reference lives in the platform's own repo at
`docs/AGENT_API.md` (kept in sync with this file — see "Keeping this in
sync" below).

## Configuration this skill needs

Before using this skill, you need, provided by whoever owns the platform
deployment:

- `PLATFORM_BASE_URL` — e.g. `https://yourdomain.com` (stores live at
  `<slug>.yourdomain.com`)
- `PLATFORM_API_KEY` — only needed to create a new store (below); not used
  for managing an existing one
- For an existing store you're managing: its `agentApiKey` (from when it
  was created) and its slug/domain

If you don't have these, ask for them rather than guessing — never invent
a platform URL or key.

## Creating a new store

```
POST https://<PLATFORM_BASE_URL>/api/platform/stores
Authorization: Bearer <PLATFORM_API_KEY>
```

Body — a brand brief:

```json
{
  "slug": "first-available",
  "name": "First Available",
  "tagline": "Throw first. Explain later.",
  "description": "Disc golf apparel for people who know exactly why that last shot went into the pond.",
  "tone": "self-deprecating, insider humor",
  "audience": "casual/intermediate disc golfers",
  "brief": { "mission": "...", "pricingPhilosophy": "...", "voiceExamples": ["..."] },
  "theme": { "accent": "#1f6f4a", "accentDark": "#154d33" }
}
```

Only `slug`, `name`, `tagline`, `description` are required. `tone` and
`audience` are free text for you (or the next agent) to use when
generating this store's copy/products — they aren't shown on the
storefront. Response (`201`) includes `credentials.adminPassword` and
`credentials.agentApiKey` — **shown once, never recoverable after.** Save
them immediately. From here, use `agentApiKey` against
`<slug>.<PLATFORM_BASE_URL>/api/agent/*` (see below) to populate the new
store's catalog — that's the whole "launch a store" workflow.

## Managing an existing store

Every request is scoped to one store, resolved by which host you call —
`https://<slug>.<domain>/api/agent/...` (or its custom domain, if it has
one). There's no separate store id to pass; the host **is** the store.

### Auth

```
Authorization: Bearer <that store's agentApiKey>
```

A missing/wrong token, or a host that doesn't resolve to any store,
returns `401` with `{"error":{"code":"UNAUTHORIZED",...}}`. A key for one
store never works against another store's host.

### Conventions

- All money fields are integer **cents** (`priceCents`, `subtotalCents`)
  plus a `currency` code (e.g. `"USD"`). Never send or expect floats.
- Every mutation response returns the **full updated resource** — confirm
  the effect from the response, don't issue a separate read.
- Errors are always JSON: `{"error":{"code","message","field?"}}`. Common
  codes: `VALIDATION_ERROR` (400), `NOT_FOUND` (404), `SLUG_TAKEN` /
  `ALREADY_SUBMITTED` (409), `MISSING_PROVIDER_VARIANT` (422).
- IDs are `cuid()` strings. Orders also accept their human-readable
  `orderNumber` anywhere an order ID is expected.
- Variant properties are **generic**, not fixed size/color columns. Each
  product has `optionNames` (ordered keys, e.g. `["size","color"]` for
  apparel or `["printType","size"]` for wall art), and each variant has an
  `options` object with a value per key, e.g.
  `{"printType":"Canvas","size":"16x20"}`. Any option keys are valid — use
  whatever fits the product category. Every variant keeps its own
  `priceCents`, so different option combinations (e.g. Framed Print vs.
  Poster at the same size) can be priced independently.

### Start here: `GET /api/agent/briefing`

Before making changes — especially at the start of a fresh session with
no memory of what's already been tried — call this once:

```
GET /api/agent/briefing
```

Returns three things in one call: `store` (brand/business knowledge —
name, tagline, tone, audience, `brief` with mission/pricing
philosophy/voice examples), `summary` (live snapshot: product counts,
orders by status, orders stuck in `PENDING_PAYMENT` for 24h+, revenue,
out-of-stock variants, variants with no price), and `recentActivity`
(last 25 events — what changed and why). Read all three before acting —
`recentActivity` in particular tells you what's already been tried, so
you don't repeat a failed experiment.

### Store brand & settings

- `GET /api/agent/store` — just the brand/copy fields (no summary/activity).
- `PATCH /api/agent/store` — update `name`, `tagline`, `description`,
  `tone`, `audience`, `brief`, `theme`, `nav`, `footerLinks`,
  `trustBadges`, `socialLinks`, `bannerHtml`. **Replaces each field,
  doesn't deep-merge** — `GET` first if you're only changing one key
  inside `brief`. Never touches `slug`/`domain`/credentials.
  `bannerHtml` is an optional announcement banner shown above the header
  on every page (background = `theme.accentDark`), empty/omitted to hide
  it — raw HTML, rendered unescaped, e.g.
  `{"bannerHtml": "Free shipping over $75 — <a href=\"/products\">shop now</a>"}`.

### Activity log

- `GET /api/agent/activity?since=<ISO timestamp>&take=50` — history of
  what changed, written automatically by product/pricing/order/brand
  mutations below, plus explicit notes.
- `POST /api/agent/activity` — leave a note for future sessions (yours or
  a different model's) that doesn't correspond to a mutation:
  ```json
  { "category": "note", "summary": "Tried a 20% sale on the Tee — no lift. Reverted, won't retry without a design refresh." }
  ```

### Products

- `GET /api/agent/products?activeOnly=true` — list products (all, or
  active only), each with images, variants, and collections.
- `GET /api/agent/products/:id` — one product.
- `POST /api/agent/products` — create a product + its variants:
  ```json
  {
    "slug": "summit-jacket", "title": "Summit Jacket",
    "description": "...", "optionNames": ["size", "color"],
    "isFeatured": false, "isActive": true,
    "collectionIds": [], "images": [{"url": "https://...", "altText": "..."}],
    "variants": [{ "sku": "summit-jacket-m-black",
      "options": { "size": "M", "color": "Black" },
      "priceCents": 8995, "currency": "USD",
      "provider": "PRINTFUL", "inStock": true }]
  }
  ```
  For a non-apparel product, `optionNames` can be anything — e.g. wall art
  with independent pricing per print type and size:
  ```json
  {
    "slug": "trailhead-vista-print", "title": "Trailhead Vista Print",
    "description": "...", "optionNames": ["printType", "size"],
    "variants": [
      { "sku": "...", "options": { "printType": "Poster", "size": "16x20" }, "priceCents": 2800 },
      { "sku": "...", "options": { "printType": "Canvas", "size": "16x20" }, "priceCents": 5800 },
      { "sku": "...", "options": { "printType": "Framed Print", "size": "16x20" }, "priceCents": 8800 }
    ]
  }
  ```
- `PATCH /api/agent/products/:id` — update price, stock, active/featured
  status, description, images, or collections. This is how you change
  **price** (edit `priceCents` on a variant) and **stock** (`inStock`).
  A `variants` entry needs an `id` to update an existing variant (send
  the full variant object — `sku`, `options`, `priceCents`, etc., not a
  partial patch of just one field — fetch the product first if you need
  its current values); omit `id` to add a new variant.
- `DELETE /api/agent/products/:id` — soft-delete (`isActive: false`).
  Products are never hard-deleted (past orders reference their variants).
- `POST /api/agent/products/:id/mockups` — render product photos of a
  design on the garment colors it reads well on, and attach them:
  ```json
  { "designUrl": "https://.../design.png", "placement": "front", "dryRun": true }
  ```
  Reads the design's palette from its **opaque pixels only**, then
  contrasts **every** significant design color against each garment — a
  dark design with a white outline still fails on white shirts, and only
  that per-color check catches it. Returns each color with `minContrast`,
  the limiting `worstColor`, `fits`, and a `mockupUrl` when rendered;
  images are stored with `optionValues: {"color": "..."}` so a storefront
  can match the image to the selected variant. Re-running replaces the
  images for the colors it renders.

  **Always try `dryRun: true` first** — it scores colors without spending
  provider render calls, and with `garments: [{name, hex}]` it needs no
  provider credentials at all. Tune with `minContrast` (default 2),
  `colors` to restrict the set, and `colorOptionName` if the color axis
  isn't called `"color"`. An `opaqueRatio` near 1 means the design's
  background was never removed.

  Needs variants that have both a color option and a `providerVariantId`
  (`NO_MOCKUP_VARIANTS` otherwise). Other errors: `DESIGN_UNREADABLE`,
  `EMPTY_DESIGN`, `NO_LEGIBLE_COLORS`, `PROVIDER_ERROR`.

### Collections

- `GET /api/agent/collections` — list, with product counts.
- `POST /api/agent/collections` — `{"slug","title","description?"}`.

### Orders

- `GET /api/agent/orders?status=PENDING_PAYMENT&take=100` — list, most
  recent first. `status` and `take` are both optional.
- `GET /api/agent/orders/:idOrNumber` — one order with line items.
- `POST /api/agent/orders/:idOrNumber/mark-paid` — `PENDING_PAYMENT` →
  `PAID`. Fails `409 INVALID_STATUS` if not currently pending.
- `POST /api/agent/orders/:idOrNumber/fulfill` — submits to the
  fulfillment provider (Printful today), moves status to
  `SUBMITTED_TO_FULFILLMENT`. Fails `422 MISSING_PROVIDER_VARIANT` if any
  line item's variant lacks a `providerVariantId` — set that via `PATCH
  /api/agent/products/:id` first.

## Typical flows

**"Launch a new store for X"** → `POST /api/platform/stores` with a brand
brief, save the returned credentials, then `POST /api/agent/products`
against the new store's host, once per product, to build its catalog.

**"What needs my attention on <store>?"** → `GET /api/agent/briefing` on
that store's host, then act on `summary.attention.outOfStockVariants`,
`summary.attention.variantsMissingPrice`, and
`summary.orders.stuckPendingPaymentOver24h`.

**"Put this design on a shirt"** → `POST /api/agent/products` with a
variant per size/color (each with its `providerVariantId`), then
`POST /api/agent/products/:id/mockups` with `dryRun: true` to see which
garment colors the design survives on, then the same call without
`dryRun` to render and attach the real product photos.

**"Raise/lower prices on X"** → `GET /api/agent/products` (or fetch the
one product), find the variant(s), `PATCH` with updated `priceCents`.
Logged automatically to the activity log — no extra step needed.

**"Process pending orders"** → `GET /api/agent/orders?status=PAID`, then
`POST .../fulfill` on each.

**"What have we tried already?"** → `GET /api/agent/briefing` (or
`GET /api/agent/activity` for more than the last 25 entries) — check
before repeating a price change or promotion.

## Keeping this in sync

This file mirrors `docs/AGENT_API.md` in the platform's repo. Whenever the
agent or platform API changes (new endpoint, changed payload, new error
code), both files must be updated together — treat a mismatch between
them as a bug.
