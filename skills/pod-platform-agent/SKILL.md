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

- `POST /api/agent/products/:id/mockups/ai` — local scene-based compositing.

  Uploaded, color-specific blank photos work without AI recoloring. Set
  `existingBasesOnly:true` to reject a missing/invalid base before rendering
  (`MISSING_MOCKUP_BASE`, 422), and `primaryColor` to promote a selected rendered
  color while retaining other images. Invalid primary: `INVALID_PRIMARY_COLOR`
  (422); primary render failure: `PRIMARY_MOCKUP_FAILED` (502), gallery unchanged.
  Omit these options for the existing behavior. Both have matching admin controls.

  It composites the design onto
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
  `{"data": "<base64>", "mimeType": "image/png", "colors": [{"name":"Black","hex":"#101010"}], "defaultPriceCents": 2499}`
  — one photo + color lineup shared by every product of that type.
  `defaultPriceCents`/`defaultCurrency` (optional, keeps the existing value
  if omitted) set this type's default price for the design review queue's
  one-click "make product" flow (`POST /api/agent/designs/:id/quick-publish`
  below) — without it, that flow fails with `422 NO_DEFAULT_PRICE`. To
  change just the price without re-uploading the photo, `PUT
  /api/agent/mockup-scenes/:productType/default-price` with
  `{"priceCents": 2999, "currency": "USD"}` (`currency` optional, defaults
  `"USD"`; `422 NO_MOCKUP_SCENE` if the type has no scene yet).
  `GET /api/agent/mockup-scenes` lists what's set (including cached
  `baseImages` and `designArea`); `DELETE /api/agent/mockup-scenes/:productType`
  removes one.

  A color with no cached base image gets one generated and cached
  automatically on first use — `POST
  /api/agent/mockup-scenes/:productType/generate-bases` pre-warms all of
  them at once if you want to avoid that latency on the first real
  mockup call. To use your own photo for one color instead of an AI
  recolor, `PUT /api/agent/mockup-scenes/:productType/base-image/:colorName`
  with `{"data": "<base64>", "mimeType": "image/png"}` — `:colorName` must
  be one of the scene's own colors (`422 UNKNOWN_COLOR` otherwise); a
  later `generate-bases` call overwrites it again. `PUT
  /api/agent/mockup-scenes/:productType/design-area`
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
  Optional `visionUrl` — a smaller/native-resolution image for the AI
  title/description call, defaulting to `designUrl` — pass this if
  `designUrl` is a large print-resolution file, since a vision model can
  lose fine linework downscaling one internally and hallucinate generic
  copy instead of erroring. New variants have no `providerVariantId` —
  set that via `PATCH /api/agent/products/:id` afterward, per (product,
  color, size), before the product can be fulfilled. Response:
  `{product, title, description, rendered, failed}`.

### Designs

The structured-design system (see `AGENTS.md`): a design is aspects
(controlled vocabulary), not an opaque image URL, so the prompt is
reproducible and a later sale can be attributed back to the choices that
made it. Pipeline: aspects → prompt → generate → **QC gate** → **upscale**
→ **publish**. `status` is one of `generated` (QC-passed, ready to
publish), `rejected` (failed QC every attempt, or manually rejected — see
below), or `published`.

- `GET /api/agent/designs/vocabulary` — the versioned (currently 2) legal
  values per axis. `hook`, `layout`, `artStyle`, `colorScheme`,
  `complexity` are the experiment axes; `designType` (print-treatment/
  finish family), `archetype` (visual layout), and `distressLevel` (how
  thrashed the print looks — `"0"`-`"3"`) were added in version 2, all
  optional with defaults; `phrase`/`subject` are free text, not enums.
- `POST /api/agent/designs` — `{"aspects": {...}}` (the nine version-1 keys
  required except `phrase`/`subject`, which default to `null`;
  `designType`/`archetype`/`distressLevel` optional). `provider` defaults
  to `"openrouter"` (most models go through OpenRouter's
  `modalities: ["image","text"]` chat-completions shape; `model:
  "openai/gpt-image-1"` transparently routes to OpenRouter's dedicated
  images endpoint instead — no `editPrompt` support for it yet, `422
  UNSUPPORTED_MODEL_EDIT` on regenerate if tried); `model` falls back to
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
  Pass `{"editPrompt":"remove the outer keyline, add more distress"}`
  instead for an **image-to-image edit** — feeds the design's own
  `previewImageUrl` back as a reference and asks only for that change,
  rather than a from-scratch reroll; still re-runs QC/upscale, so it can
  still come back `"rejected"` (`409 DESIGN_NOT_READY` if there's no
  preview yet to edit from). The prompt used lands in
  `params.lastEditPrompt`.
- `GET /api/agent/designs/:id` — one design. `GET
  /api/agent/designs?status=&batchLabel=&take=` — list, most recent first.
- `POST /api/agent/designs/:id/publish` — `{"productTypes":[{"productType":
  "tshirt","priceCents":2800,"provider":"PRINTFUL"}]}` (one entry per
  garment type; `currency`/`sizes`/`colorOptionName`/`sizeOptionName`
  optional, same defaults as `generate-from-design`). Only works on a
  `"generated"` design (`409 DESIGN_NOT_READY` otherwise, `409
  ALREADY_PUBLISHED` if already published). Derives each provider's exact
  file from `masterImageUrl` via that store's `PrintTemplate` (falls back
  to the master's own dimensions + an activity note if none set) and calls
  the same product-creation flow as `generate-from-design`, once per
  entry, setting `Product.designId`. Returns `{design, products}`. Add
  `"force":true` to also publish a `"rejected"` design — upscales its
  existing QC-failed preview to the master canvas in place, logs the
  override, then publishes normally; without it a `"rejected"` design
  still gets `409 DESIGN_NOT_READY`. No-op on an already-`"generated"`
  design.
- `POST /api/agent/designs/:id/reject` — no body. Manually marks a
  `"generated"` design `"rejected"` without publishing it (`409
  DESIGN_NOT_REJECTABLE` on any other status).
- `DELETE /api/agent/designs/:id` — no body. Permanently removes a
  `"rejected"` design (`409 DESIGN_NOT_DELETABLE` on any other status —
  force-publish a `"generated"` one, or note a `"published"` one has real
  `Product`s referencing it). Returns `{"ok":true}`. Doesn't delete its
  preview/master image assets; `POST /api/agent/store/prune-assets`
  sweeps up unreferenced ones.
- `POST /api/agent/designs/:id/quick-publish` — no body required. One-click
  publish using the design's own `params.targetProductType` (set by the
  batch endpoint below, default `"tshirt"`) and that type's `MockupScene`
  defaults (every color it has, its `defaultPriceCents`). `422
  NO_DEFAULT_PRICE` if that product type has no default price set yet.
  Same `{"force":true}` override as `publish` above for a `"rejected"`
  design.
- `POST /api/agent/designs/concepts` — `{"niche?","targetCustomer?","count?"
  (1-5, default 5),"lockDesignType?"}`. Generates a batch of t-shirt design
  concepts (angle/designType/archetype/copy/aspects) via one text call
  following `src/lib/design/tshirt-design-concepts.md`'s methodology —
  **no image generated yet**, so a batch can be inspected/edited before
  spending image-gen budget. `niche`/`targetCustomer` default to this
  store's own `audience` field. Returns `{"concepts": [...]}`, each one
  shaped like a `POST /api/agent/designs` aspects object plus display-only
  `name`/`whySells`.
- `POST /api/agent/designs/batch` — same fields as `concepts` above, plus
  `productType?` (default `"tshirt"`) and an optional `concepts` array (an
  edited batch from the endpoint above) to skip straight to generation.
  Runs each concept through the exact `POST /api/agent/designs` pipeline,
  capped at 5 per call, tagging every resulting design with one
  `batchLabel` (filter with `GET /api/agent/designs?batchLabel=`). One
  concept failing doesn't abort the rest. Returns
  `{"batchLabel","productType","results":[{"concept","design"} | {"concept","error"}]}`.
- `GET /api/agent/print-templates` / `PUT
  /api/agent/print-templates/:provider/:productType` —
  `{"widthPx","heightPx","minDpi","format?"}`. Per-store pixel specs used
  by publish; every store starts with Printful's tee spec (4500×5400,
  150 DPI) seeded.

### Shipping rates

- `GET /api/agent/shipping-rates` — list this store's rates.
- `PUT /api/agent/shipping-rates/:productType` —
  `{"baseCents","additionalItemCents","currency?"}`. `:productType`
  matches `Product.productType`, or the literal `default` (the fallback
  for any type with no row of its own). Charged once per productType
  group in a cart (base for the first unit + additional per extra unit
  of that type), summed across groups. A type with no rate and no
  `default` row ships free (never blocks checkout) — check `GET
  /api/agent/summary`'s `attention.shippingNotConfigured` for whether
  this store has set any rate at all.

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
`summary.attention.variantsMissingPrice`,
`summary.attention.shippingNotConfigured`, and
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


### Storefront artwork and launch controls
`PATCH /api/agent/store` accepts `theme.storefront` (theme is replaced, not merged).
Keep existing theme keys when updating. Slots: `hero: {src, mobileSrc?, alt}`;
`story: {src, mobileSrc?, alt, title, text}`; `promos: [{src, mobileSrc?, alt,
title, collectionSlug}]` (up to 6); `decorations: [{src, side: "left"|"right",
widthPercent: 5..25, bottomPercent: 0..30}]` (up to 2, decorative and hidden on
small screens); `productBadges: {"product-slug": "Popular"}`. Optional copy:
`eyebrow`, `shopLabel`, `featuredTitle`. Use approved artwork only. URLs must
be HTTP(S) or same-origin paths. Existing heroImageUrl remains supported.
`theme.commerce: {checkoutEnabled: false, fulfillmentMode: "manual"}` closes
checkout before order/session creation and blocks all supplier submissions.
ShihTshirts slugs `shihtshirts`/`shihttshirts` default closed/manual; other
existing tenants keep their behavior. Invalid commerce configuration fails
closed for checkout. Manual paid orders remain PAID in the existing admin
order queue and agent orders/summary, with a fulfillment activity entry.
Webhook processing requires a paid session, matching store/order metadata,
locked order total and currency; concurrent duplicate deliveries cannot mark
paid twice. Manual fulfillment never contacts a supplier, including /fulfill.
See docs/SHIHTTSHIRTS_REVIEW.md for draft setup and owner launch requirements.

The summary includes `commerce` policy and `attention.manualPaidOrders` (oldest first). The admin order queue explains manual mode, hides supplier submission and exposes shipping addresses on expansion.

Generated scene mockups persist in PostgreSQL StoreAsset bytes before ProductImage attachment. Treat returned asset URLs as immutable public references; new IDs encode tenant/product/exact-color scope plus UUID. No new storage credentials. See docs/products/the-look/MOCKUP_PIPELINE.md for retention/rollout; never run regeneration or destructive cleanup as an asset migration.

### Fixed ShihTshirts homepage settings
On the exact `shihtshirt` tenant, existing `PATCH /api/agent/store` accepts
`theme.storefront.boutique`. Theme updates replace the theme: preserve existing
keys and closed/manual commerce settings. Copy fields: `heroTitle`, `heroText`,
`personalityTitle`, `personalityText`, `mascotsTitle`, `samiText`, `bogeyText`,
`valueTitle`, `finalTitle`, `finalText`, `finalLabel`, `emptyText`. `values` is up
to three `{title,text}` entries. `featuredCount` is an integer 1–12 (default 4).
`sections` has booleans `hero`, `featured`, `personality`, `mascots`, `values`,
`final` (default true). `sami` and `bogey` use `{src,mobileSrc?,alt}` approved
image slots; absent/failed photos show labeled placeholders. Existing storefront
`hero`, `eyebrow`, `shopLabel`, `featuredTitle` apply. Layout and shop destinations
are fixed. Featured results require this store's active, featured products; no
inactive product is exposed. Other tenants keep the existing homepage.

### shihtshirt header settings
Use `PATCH /api/agent/store` with `theme.storefront.masthead` to configure
`style` (`branded` or `standard`), `tagline` (max 150), optional `sami`/`bogey`
images (`{src, mobileSrc?, alt}`), `palette` (exactly five `{label, color}`
entries, hex #RRGGBB), and `benefits` (exactly four strings, max 100 each).
Only exact slug `shihtshirt` uses the branded default; other tenants are
unchanged. Set style standard to opt out. Retain the full current theme when
patching. Reuse approved artwork only; absent/failed images show text. The
store name/logo remain authoritative; palette is branding, not garment stock.

For the ShihTshirts homepage: existing theme slots map to `hero` (main panel),
`promos[0]` (middle desktop panel), `story` (right desktop/lower mobile panel),
and `decorations[0]` (header mascots); `theme.logoUrl` is the wordmark. Missing
artwork stays a labeled placeholder. Up to six active featured products supply
the live catalog cards, variant prices and color swatches.

The responsive mockup layout supersedes the boutique/masthead presentation for
`shihtshirt` (also supported: `shihtshirts`, `shihttshirts`). Existing settings
remain stored. The six-card selection includes active products whether featured
or not; inactive product previews are not purchasable catalog cards.

ShihTshirts copy: `theme.storefront.wordmark` (1–80 chars) sets the fallback text
logo; `featuredSubtitle` (max 300 chars) sets the collection subtitle separately
from Store.description. An uploaded theme.logoUrl takes precedence. Empty nav
falls back to Shop/Our Story/Help. Empty catalogs show labeled garment previews,
with no prices or inventory claims; active products replace them automatically.

ShihTshirts defaults to combined mascot art at
`/images/shihtshirts/sami-bogey-header.png`; override via the existing
`theme.storefront.decorations[0]` slot.

Set `theme.storefront.homepageTitle` (1–200 chars) via store PATCH to customize
the default browser title independently of the store name and subpage template.

Design Factory: POST /api/agent/design-factory/refine accepts
{manifest, candidateId, feedback, preserve, currentPrompt?}, returns
{prompt, rationale, preserved: string[]}. Store bearer auth; manifest storeSlug
must match resolved store. Uses text credits and logs actor. Human-directed only;
never choose Keep/Reject or generate images without separate human permission.
Admin review/import/export: /admin/design-factory. See docs/design-factory/README.md.

POST /api/agent/design-factory/generate accepts {manifest,version,
approvePaidGeneration:true}, returns {image,provenance:{provider,model,sha256,
seed?,rawParams}}. Requires matching store bearer auth, ungenerated child,
FACTORY_IMAGE_GENERATION_ENABLED=true and explicit separate human image-credit
approval. One reserved attempt per tenant/version, no retries, no publication.

Factory review versions may carry placements[productType] = {version:1,scale,x,y};
center coordinates and contain-fit scale are normalized to the garment print area.
Preserve these when handing off a review. Missing provider dimensions means
production not ready; placement does not authorize generation or publishing.

Factory review files may include `printAreas` scoped by storeSlug/productType/
provider/printAreaId. Validate with printAreaProfileSchema; they are local review
configuration, not production PrintTemplates. ShihTshirts front 4494x5097 pixels
require explicit provider identity and manual mockup calibration; physical size
and provider verification remain required. See docs/design-factory/README.md.


### Factory photo print-area calibration
`GET /api/agent/design-factory/calibration` returns `{profiles}` for the resolved
store. `PUT` accepts one strict `printAreaProfileSchema` profile and returns that
saved profile. Bearer authentication is required. Fields: `storeSlug`,
`productType`, `provider`, `printAreaId` (side, e.g. `front`), `baseImageUrl`,
`mockup:{width,height}`, `canvas:{width,height}`, and normalized
`mapping:{x,y,width,height}`. The base URL must belong to this tenant's current
MockupScene for that product type. Changing/replacing a base URL requires a new
calibration. Profiles persist under Store.brief.factoryPrintAreas (no migration),
with serializable updates preserving other brief keys. Preserve this key when
replacing a store brief. Writes record the real actor in activity history.

The Factory UI edits a draft via eight pointer/touch handles, arrow keys
(Shift for larger steps), numeric fields, reset and cancel. Draft boundary edits
leave artwork fixed. Save and apply explicitly remaps artwork using unchanged
print-space placement and alpha containment; Keep is invalidated for re-review.
Photograph mapping may have a different aspect than the 4494x5097 print canvas;
the provider canvas and native visible-alpha bounds remain separate. Mapping is
an axis-aligned affine approximation, not a perspective homography. Review
export/import retains profiles, but importing does not silently write server
configuration. No generation, upscale, provider call or publishing is involved.

Local manual QA procedure (not a claim of completed browser QA): compare the
Comfort Colors 1717 front against the supplied Printify schematic: use a tall
front boundary below the collar and above the hem, adjusting photo coordinates
rather than inferring them from pixel canvas dimensions. Verify all eight handles
on desktop/touch, keyboard focus and arrow steps, narrow-screen stacking, color
cycling, cancel/reset, reload after save, tenant isolation, export/import, and
unchanged artwork while drafting. Then explicitly apply and re-review visible
ink on each calibrated color. Visual calibration alone verifies neither physical
print dimensions nor provider/garment identity, DPI or production readiness.
The schematic image is not present in this checkout; this procedure requires the
operator's supplied reference and real tenant photographs.

Factory Keep → Draft Product (never launch): POST
`/api/agent/design-factory/draft-products` with `{manifest, version, ancestors?,
printAreas, settings:{title,description,priceCents,productType?,colors?,sizes?,currency?}}`.
Use an exported kept rendered review version, complete ancestor recipes without
image bytes, explicit placement for the garment, and one matching front calibration
per selected tenant-owned blank. PNG hash must match root manifest preview or
child provenance.sha256; server remeasures alpha and refuses changed containment.
Defaults: comfort-colors-1717; Ivory/Blossom/Butter/Bay/Espresso; S/M/L/XL; USD.
All supplier combinations, costs and availability remain unverified. Response:
`{product,reused,blockers}` with full rows, immutable factoryDraft provenance and
ready:false. Draft is inactive/unfeatured; variants unavailable, no supplier IDs.
Preview composites are labeled PODSite previews, not Printify verified mockups.
Repeat brief/candidate/version identity returns the existing draft; changed evidence
returns VERSION_CHANGED. Product/assets/activity are atomic and tenant-scoped.
PATCH `/api/agent/design-factory/draft-products/:id` with the full settings object
edits copy/price and originally reviewed color choices. A garment change requires
new reviewed version placement/calibration (REVIEW_GARMENT_FIRST); extra colors
require review (REVIEW_COLORS_FIRST). Referenced variants cannot be replaced.
Existing product PATCH can edit individual variant prices but blocks Factory
activation/featuring, supplier IDs/stock availability and garment changes.
Existing product reads and summary.attention.factoryDrafts expose evidence/blockers.
No generation, provider calls, checkout, fulfillment or launch. See the canonical
Factory draft products section in docs/AGENT_API.md for exact errors and limits.

Factory drafts: normal product PATCH cannot replace preview images/planned options; use the draft editor for supported option edits. Existing variant prices remain editable.

Factory draft settings require explicit productType matching the reviewed scene and version.placements key; no garment default is inferred. Missing source PNG, placement or per-color calibration fails closed with corrective guidance.

Factory review shares the first calibrated color in scene order's print boundary and canvas across the garment color lineup. Centering and scale remain per artwork version and garment, independent of the viewed color. Editing the boundary on any color updates that shared calibration. Export and draft handoff carry the shared geometry on existing per-photo profiles while retaining photo identities and dimensions; missing per-color calibration still blocks draft creation. Calibration REST payloads and authentication are unchanged.

Factory draft handoff accepts root-relative or absolute HTTP(S) `/api/assets/:id` URLs for scene photographs and matching calibration evidence (query/fragment ignored). It resolves the asset ID directly from the database with the current storeId; it never fetches the URL host. Missing or foreign-tenant assets still fail with BASE_REQUIRED.

Factory draft shared-calibration update: one reviewed front profile for the garment and one selected provider now supplies every selected color (supersedes the separate-per-color calibration requirement above). The canonical profile follows scene color order, matching preview behavior. It must reference a current tenant-owned scene photograph with matching dimensions. Each selected photograph is independently checked for ownership; its actual dimensions and the shared mapping/canvas are recorded in preview evidence. Absolute and relative asset URLs match by local asset ID. Missing/stale shared calibration or multiple providers fails closed; the UI sends only the chosen provider.


### Factory upscale and manual product publication

After Keep, creating a Factory draft validates the original PNG/provenance, then
`upscaleToPrintCanvas()` in `src/lib/design/upscale.ts` uses Lanczos resampling to
rasterize the reviewed scale/center onto the calibrated transparent print canvas
(e.g. 4494 x 5097). This preserves placement, including source alpha padding;
it does not perform AI enhancement or certify supplier print readiness. The
canvas is capped at 50 million pixels and the stored master at 32 MB. Every color
mockup is composited from this same master. Original bytes/hash remain unchanged.
`product.factoryDraft.master` contains `url`, `sha256`, `width`, `height`,
`method: "lanczos3"`, and the reviewed `placement`; `previews` retains per-color
calibration and source/composite hashes. Admin product details link the master
for download. Draft creation itself stays inactive/unavailable; duplicate handoff
returns the existing product even if it has subsequently been published.

- `POST /api/agent/products/:id/publish` accepts `{}` (or an empty body).
- `POST /api/agent/products/:id/unpublish` accepts `{}` (or an empty body).

Both require the resolved store's bearer key, validate strict empty-object input,
and return `{product}` with the full resulting product, variants, ordered images
and collections, validated by `productPublicationResultSchema`. They use shared
`src/lib/store/product-publication.ts` functions, also called by the authenticated
Publish/Unpublish buttons on `/admin/products`. Both are idempotent and log the
real actor on changes. Unpublish sets `isActive:false` without deleting variants
or changing stock, artwork, or existing orders. Publishing a normal product
preserves variant availability.

Publishing a Factory product requires store manual fulfillment mode, a complete
listing with positive variant prices, kept artwork evidence, and a tenant-owned
master whose hash matches. First publication marks its planned variants available;
subsequent unpublish/republish preserves deliberate stock changes. Legacy Factory
drafts without a master are upgraded and their mockups regenerated atomically
from the kept original before activation. Source bytes and hashes are verified;
missing/foreign photos or invalid calibration cannot bypass these checks.
Only garment mockups appear in the published gallery; original artwork stays in
preserved evidence. Supplier IDs and automatic fulfillment remain unconfigured.
Errors include `PRODUCT_INCOMPLETE`, `MANUAL_FULFILLMENT_REQUIRED`,
`INVALID_FACTORY_EVIDENCE`, `ARTWORK_REQUIRED`, `ARTWORK_HASH_MISMATCH`,
`MASTER_REQUIRED`, `CALIBRATION_REQUIRED`, `BASE_REQUIRED`, `STALE_CALIBRATION`,
and tenant-scoped `NOT_FOUND`. Store checkout policy is unchanged by publication.
Published Factory products are excluded from `attention.factoryDrafts`.
This explicit publication path supersedes the previous blanket Factory activation
prohibition; generic product PATCH still cannot activate a Factory draft.
