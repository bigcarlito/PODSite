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
  `SKU_TAKEN` / `ALREADY_SUBMITTED` (409), `MISSING_PROVIDER_VARIANT` (422).
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
  `theme.heroImageUrl` is an optional image shown beside the homepage
  hero text in its own fixed-aspect-ratio panel (not behind the text),
  so any image works at any resolution — no need to leave space for
  text in the image itself. Set it to an already-hosted URL directly, or
  see `POST /api/agent/store/hero-image` below to upload a generated one.
- `POST /api/agent/store/hero-image` — uploads an image (you generated,
  not hosted anywhere) and sets it as the hero in one step. Body:
  `{"data": "<base64 image bytes>", "mimeType": "image/png"}` (`image/png`,
  `image/jpeg`, or `image/webp`; max 8MB decoded). Returns the updated
  store with `theme.heroImageUrl` already set — the platform hosts the
  image itself at `/api/assets/<id>`, no S3/Cloudinary credentials needed.
  `theme.logoUrl` is an optional image shown in the header in place of
  the store name text — the name becomes its hover tooltip, and it still
  links to `/`. Set it directly via `PATCH /api/agent/store`, or
  `POST /api/agent/store/logo-image` (same body/behavior as
  `hero-image` above) to upload a generated one.

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
  Products are normally never hard-deleted (past orders reference their
  variants) — see `POST /api/agent/store/prune-products` below for the
  one safe exception.
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

  Colors that fail the threshold are **skipped, not fatal** — you get
  mockups for the ones that pass plus a reason for each that didn't. Only
  when *nothing* passes does it fail, with `NO_LEGIBLE_COLORS`; that error
  carries the whole scoring in `error.details` and names the closest miss
  in its message, so retry with a lower `minContrast` straight from the
  error rather than re-running a `dryRun` to find the numbers.

  Needs variants that have both a color option and a `providerVariantId`
  (`NO_MOCKUP_VARIANTS` otherwise). Other errors: `DESIGN_UNREADABLE`,
  `EMPTY_DESIGN`, `PROVIDER_ERROR`.

- `POST /api/agent/products/:id/mockups/ai` — alternative to the above for
  a non-generic, non-white-background result: composites the design onto
  this product type's pre-generated, per-color **base mockup** (a blank
  garment in a real scene, already AI-recolored), scaled to fit the
  scene's `designArea` and blended on at 85% opacity. This is a
  **deterministic local composite, not an AI call per design** — the only
  AI step is the one-time base recolor, so placement is identical across
  colors and runs instead of an image model re-deciding it each time.
  ```json
  { "designUrl": "https://.../design.png", "colors": ["Black", "White"] }
  ```
  Needs `Product.productType` set (`PATCH /api/agent/products/:id`, e.g.
  `"tshirt"`) and a scene uploaded for that type first:
  `PUT /api/agent/mockup-scenes/:productType` with
  `{"data": "<base64>", "mimeType": "image/png", "colors": [{"name":"Black","hex":"#101010"}]}`
  — one photo + color lineup shared by every product of that type.
  `GET /api/agent/mockup-scenes` lists what's set (including cached
  `baseImages` and `designArea`); `DELETE /api/agent/mockup-scenes/:productType`
  removes one.

  A color with no cached base image gets one generated and cached
  automatically on first use — `POST
  /api/agent/mockup-scenes/:productType/generate-bases` pre-warms all of
  them at once if you want to avoid that latency on the first real
  mockup call. `PUT /api/agent/mockup-scenes/:productType/design-area`
  sets `{x, y, width, height}` (fractions of the scene image) — best set
  visually via the design-area editor in `/admin/mockup-scenes`, which
  locks it to a reference design's aspect ratio while you drag/scale it;
  unset, generation uses a centered default.

  Generation runs per color independently — one color's failure doesn't
  block the others (`rendered`/`failed` in the response); needs at least
  one success.

- `POST /api/agent/products/generate-from-design` — creates a **whole
  product** from just a design: an AI text model writes the title/
  description, one variant per (color × size) is created from the product
  type's `MockupScene` color lineup, then a mockup is generated and
  attached per color (same mechanism as the endpoint above).
  ```json
  { "productType": "tshirt", "designUrl": "https://.../design.png", "priceCents": 2499 }
  ```
  Needs a `MockupScene` with colors set for `productType` first
  (`NO_MOCKUP_SCENE`/`NO_MOCKUP_SCENE_COLORS` otherwise, both 422).
  `sizes` defaults to `["S","M","L","XL"]`, applied to every color.
  New variants have no `providerVariantId` — set that via `PATCH
  /api/agent/products/:id` afterward, per (product, color, size), before
  the product can be fulfilled. Response: `{product, title, description,
  rendered, failed}`.

### Designs

The structured-design system (see `AGENTS.md`): a design is aspects
(controlled vocabulary), not an opaque image URL, so the prompt is
reproducible and a later sale can be attributed back to the choices that
made it. Pipeline: aspects → prompt → generate → **QC gate** → **upscale**
→ **publish**. `status` is one of `generated` (QC-passed, ready to
publish), `rejected` (failed QC every attempt), or `published`.

- `GET /api/agent/designs/vocabulary` — the versioned legal values per axis.
  `hook`, `layout`, `artStyle`, `colorScheme`, `complexity` are the five
  experiment axes; `phrase`/`subject` are free text, not enums.
- `POST /api/agent/designs` — `{"aspects": {...}}` (all nine keys required
  except `phrase`/`subject`, which default to `null`). `provider` defaults
  to `"openrouter"` (only reaches OpenRouter models whose backend
  supports the `modalities: ["image","text"]` chat-completions shape —
  `openai/gpt-image-1` isn't one of them); `model` falls back to
  `OPENROUTER_DESIGN_MODEL` (default `google/gemini-2.5-flash-image`,
  independent of the AI mockup pipeline's own `OPENROUTER_MOCKUP_MODEL`);
  `slug` auto-derives from `phrase`/`subject` if omitted. Validates → compiles →
  generates → runs the QC gate against the preview (retries once on
  failure) → on pass, upscales to the print-ready master canvas. Returns
  the `Design` either way — check `status`; a `"rejected"` one has
  `params.qc` saying which check failed. Not idempotent.
- QC gate checks (all must pass): `textFidelity` (vision-transcribes the
  render, must match `phrase` exactly — skipped if `phrase` is null),
  `alphaCoverage` (15-85% opaque), `colorCount` (caps significant colors
  for `colorScheme` values that promise a count, e.g. `two_color_contrast`
  → 2), `contrastVsGarment` (WCAG ≥2.5 against a representative garment
  for `designedForShade`).
- `POST /api/agent/designs/:id/regenerate` — `{"provider?","model?",
  "negativePrompt?"}`, all optional. New seed/attempt through the same QC
  gate, replacing the design's prompt/preview/master/status in place. Use
  after a rejection when the aspects themselves seem fine and it's worth
  another roll; a different aspect combination should be a new design.
- `GET /api/agent/designs/:id` — one design. `GET
  /api/agent/designs?status=&take=` — list, most recent first.
- `POST /api/agent/designs/:id/publish` — `{"productTypes":[{"productType":
  "tshirt","priceCents":2800,"provider":"PRINTFUL"}]}` (one entry per
  garment type; `currency`/`sizes`/`colorOptionName`/`sizeOptionName`
  optional, same defaults as `generate-from-design`). Only works on a
  `"generated"` design (`409 DESIGN_NOT_READY` otherwise, `409
  ALREADY_PUBLISHED` if already published). Derives each provider's exact
  file from `masterImageUrl` via that store's `PrintTemplate` (falls back
  to the master's own dimensions + an activity note if none set) and calls
  the same product-creation flow as `generate-from-design`, once per
  entry, setting `Product.designId`. Returns `{design, products}`.
- `GET /api/agent/print-templates` / `PUT
  /api/agent/print-templates/:provider/:productType` —
  `{"widthPx","heightPx","minDpi","format?"}`. Per-store pixel specs used
  by publish; every store starts with Printful's tee spec (4500×5400,
  150 DPI) seeded.

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

### Cleanup

Both take `{"dryRun": false}` — default is `dryRun: true`, so a caller
must explicitly opt into actually deleting anything.

- `POST /api/agent/store/prune-assets` — deletes every uploaded design/
  scene/mockup image nothing references anymore (not `Store.theme.
  heroImageUrl`, any `MockupScene.imageUrl`/`baseImages`, or any
  `ProductImage.url`). Nothing else currently cleans these up, so they
  accumulate on every replace/regenerate. Response: `{total, orphaned,
  deleted, dryRun}`.
- `POST /api/agent/store/prune-products` — hard-deletes **inactive**
  products with zero `CartItem`/`OrderItem` references on any variant —
  the one safe exception to "products are never hard-deleted." Cascades
  to the product's variants/images/collection links. Response: `{total,
  eligible, skipped, deleted, failed, dryRun}`.

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

**"Turn this design into a listed product"** (no product to build around
yet) → one call, `POST /api/agent/products/generate-from-design` with
`productType` + `designUrl` + `priceCents` — creates the product (AI
writes the title/description), its variants (one per color × size from
the product type's `MockupScene`), and a mockup per color, all at once.
Needs that type's colors set first (`PUT /api/agent/mockup-scenes/:productType`).

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
