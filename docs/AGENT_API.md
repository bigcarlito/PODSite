# Agent API Reference

This is the machine-callable interface to the platform — one app and one
database serving many print-on-demand stores. It exists so an AI agent
(or any script) can create a new store, read a store's full state, and
make the same changes a human admin would make in that store's `/admin`
— all without a browser. See `AGENTS.md` for the design principles
behind it.

If you add, change, or remove an endpoint, update this file **and**
`skills/pod-platform-agent/SKILL.md` (a condensed version of this same
reference, packaged for an external agent harness) in the same commit —
an undocumented endpoint, or a mismatch between the two, is a bug (see
`AGENTS.md` rule #3).

## Which store a request hits

Every `/api/agent/*` endpoint operates on **one store**, resolved the same
way the storefront resolves it: by subdomain in production
(`first-available.yourdomain.com`), or by an exact custom domain if the
store has one configured. Point requests at that store's host.

Locally (no real subdomains), append `?store=<slug>` to the URL — e.g.
`http://localhost:3000/api/agent/summary?store=first-available`. This
also works as a fallback if `DEV_STORE_SLUG` is set. `/api/platform/*`
(below) is the one exception — it's not store-scoped, since it's what
creates stores in the first place.

## Creating a new store

### `POST /api/platform/stores`

Gated by a separate, store-independent bearer token:

```
Authorization: Bearer <PLATFORM_API_KEY>
```

Creates a new store from a brand brief:

```json
{
  "slug": "first-available",
  "name": "First Available",
  "tagline": "Throw first. Explain later.",
  "description": "Disc golf apparel for people who know exactly why that last shot went into the pond.",
  "tone": "self-deprecating, insider humor",
  "audience": "casual/intermediate disc golfers",
  "brief": { "mission": "...", "pricingPhilosophy": "...", "voiceExamples": ["..."] },
  "theme": { "accent": "#1f6f4a", "accentDark": "#154d33" },
  "nav": [{ "label": "All Products", "href": "/products" }],
  "footerLinks": { "Help": [{ "label": "Contact", "href": "/contact" }] },
  "trustBadges": ["30-day happiness guarantee"],
  "socialLinks": [{ "label": "Instagram", "href": "https://instagram.com/..." }],
  "domain": "firstavailable.com",
  "printfulApiKey": "optional — this store's own Printful account",
  "printfulStoreId": "optional — required by a modern/multi-store Printful token, or most calls 400 with \"This endpoint requires `store_id`!\"; find it via GET https://api.printful.com/stores"
}
```

Only `slug`, `name`, `tagline`, and `description` are required — `tone`,
`audience`, and `brief` are for whichever agent generates this store's
copy/products next, not rendered on the storefront. Brand/copy fields
default to empty and can be refined later with the new store's own key
via `PATCH /api/agent/store` (see "Store brand & settings" below) —
there's no platform-level `PATCH /api/platform/stores/:id`, since brand
edits are naturally a store managing itself, not a platform operation.
`printfulApiKey` and `printfulStoreId` are the exception: they're
credentials, not brand fields, and `storeUpdateSchema` deliberately
excludes them, so today they can only be set at creation — changing
them afterward means editing the `Store` row directly (or relying on
the platform-wide `PRINTFUL_API_KEY`/`PRINTFUL_STORE_ID` env var
fallbacks instead of a per-store value).

Returns `201`:

```json
{
  "store": { "id": "...", "slug": "first-available", "name": "...", ... },
  "credentials": {
    "adminPassword": "f734bfcb07273efac91f",
    "agentApiKey": "4e8abfeaa189f...9013"
  }
}
```

**`credentials` is shown exactly once.** Neither value is recoverable
after this response — only their hashes are stored. Use `agentApiKey`
immediately against that store's `/api/agent/*` endpoints (resolved via
its slug/domain, see above) to populate its catalog; use `adminPassword`
to log into `<slug>.yourdomain.com/admin` as a human.

Fails with `409 SLUG_TAKEN` if the slug is already used.

## Auth (per-store endpoints)

Every `/api/agent/*` request needs:

```
Authorization: Bearer <that store's agent API key>
```

The key is checked against the **resolved store's own** key — one store's
key never authenticates against another, even if you have both. A
missing/wrong token, or a request that doesn't resolve to any store at
all, gets a `401` with a JSON body, never a redirect or HTML page:

```json
{ "error": { "code": "UNAUTHORIZED", "message": "..." } }
```

## Conventions

- All money fields are integer **cents** (`priceCents`, `subtotalCents`),
  paired with a `currency` code (e.g. `"USD"`).
- Every mutation returns the full updated resource — never just `{ "ok":
  true }` — so you can confirm the effect from the response alone.
- Errors are always JSON: `{ "error": { "code", "message", "field?" } }`.
  Common codes: `VALIDATION_ERROR` (400, with a Zod `issues` array),
  `NOT_FOUND` (404), `SLUG_TAKEN` / `ALREADY_SUBMITTED` (409),
  `MISSING_PROVIDER_VARIANT` (422), `INTERNAL_ERROR` (500).
- IDs are `cuid()` strings. Orders also accept their human-readable
  `orderNumber` (e.g. `WL-MTMEQDWZ`) anywhere an order ID is accepted.
- Variant properties are **generic**, not fixed columns. A product
  declares `optionNames` (an ordered list of option keys, e.g.
  `["size","color"]` for apparel or `["printType","size"]` for wall art),
  and each of its variants has an `options` object with a value for each
  of those keys, e.g. `{"size":"M","color":"Forest"}` or
  `{"printType":"Canvas","size":"16x20"}`. There's no fixed set of
  supported option names — a product can use whatever keys make sense for
  its category. Every variant still has its own independent `priceCents`,
  so a Framed Print can cost more than a Poster at the same size.

## Start here: `GET /api/agent/briefing`

Before making changes in an unfamiliar store — especially at the start of
a fresh agent session, which has no memory of anything done before —
call this once to get fully oriented:

```json
{
  "store": { "id": "...", "slug": "first-available", "name": "First Available",
    "tagline": "...", "description": "...", "tone": "...", "audience": "...",
    "brief": { "mission": "...", "pricingPhilosophy": "...", "voiceExamples": ["..."] },
    "theme": {...}, "nav": [...], "footerLinks": {...}, "trustBadges": [...], "socialLinks": [...] },
  "summary": { "products": {...}, "orders": {...}, "revenueCents": ..., "attention": {...} },
  "recentActivity": [
    { "id": "...", "actor": "agent", "category": "pricing",
      "summary": "Updated product \"Mando or Nothing Tee\"",
      "details": {...}, "createdAt": "..." }
  ]
}
```

`store` is the brand/business knowledge (who this store is, how it
talks, its pricing philosophy — see "Store brand & settings" below);
`summary` is the live operational snapshot (see "Store summary" below);
`recentActivity` is the last 25 events (see "Activity log" below) — what's
already been tried, so you don't repeat a failed experiment or contradict
a decision from an earlier session. Read all three before acting.

## Store brand & settings

### `GET /api/agent/store`

Returns the store's brand/copy fields (same shape as `briefing.store`
above) without the operational snapshot or activity — use this if you
only need to check/re-read branding.

### `PATCH /api/agent/store`

Update this store's own brand fields — `name`, `tagline`, `description`,
`tone`, `audience`, `brief`, `theme`, `nav`, `footerLinks`, `trustBadges`,
`socialLinks`, `bannerHtml`. This is how a store manages its own identity
over time (e.g. refining `brief.pricingPhilosophy` after seeing what
sells).

```json
{ "brief": { "mission": "...", "pricingPhilosophy": "Undercut generic POD sites by 10-15%, never race to the bottom on quality." } }
```

`bannerHtml` is an optional announcement banner shown above the header on
every page of the storefront, with the `theme.accentDark` color as its
background — empty/omitted hides it entirely:

```json
{ "bannerHtml": "Free shipping over $75 — <a href=\"/products\">shop now</a>" }
```

It's rendered as raw HTML, unescaped — this is trusted content set by the
store's own admin/agent, the same trust level as `theme`/`nav`, never
end-user input.

`theme.heroImageUrl` is an optional image shown beside the homepage
hero text, in its own fixed-aspect-ratio panel — omitted/empty falls
back to a full-width text-only hero. The image and text are independent
boxes (not text-over-image), so any image works at any resolution
without needing negative space reserved for text — the text always
renders on its own plain background, never over the image:

```json
{ "theme": { "heroImageUrl": "https://..." } }
```

To set it from a generated image (rather than an already-hosted URL),
use `POST /api/agent/store/hero-image` instead — see below.

`theme.logoUrl` is an optional image shown in the header in place of the
store name text — the name becomes the image's hover tooltip (and its
`alt` text), and clicking it still links to `/`. Omitted/empty falls
back to the store name as plain text:

```json
{ "theme": { "logoUrl": "https://..." } }
```

To set it from a generated image, use `POST /api/agent/store/logo-image`
instead — see below.

**This replaces the field, it does not deep-merge.** If you're only
adding one key to `brief`, `GET /api/agent/store` first, edit the object
client-side, then `PATCH` the whole thing back. Never touches `slug`,
`domain`, or credentials — there's no endpoint for those; contact the
platform operator.

Logs a `"brand"` activity entry automatically.

### `POST /api/agent/store/hero-image`

Uploads an image and sets it as this store's homepage hero in one step —
use this when you've generated an image yourself rather than getting a
URL from an external host. Body is JSON with the image base64-encoded
(not multipart):

```json
{ "data": "<base64-encoded image bytes>", "mimeType": "image/png" }
```

`mimeType` must be one of `image/png`, `image/jpeg`, `image/webp`; max
8MB decoded. The image is stored by the platform itself (no S3/Cloudinary
credentials needed) and served publicly from `/api/assets/<id>` — the
response is the updated store (same shape as `GET /api/agent/store`),
with `theme.heroImageUrl` already pointing at the new image. This is
equivalent to hosting the image yourself and calling `PATCH
/api/agent/store` with `{"theme": {"heroImageUrl": "..."}}`, except the
platform does the hosting. Logs an `"assets"` activity entry
automatically.

### `POST /api/agent/store/logo-image`

Uploads an image and sets it as this store's header logo in one step —
same shape and behavior as `POST /api/agent/store/hero-image` above,
except it sets `theme.logoUrl` instead of `theme.heroImageUrl`:

```json
{ "data": "<base64-encoded image bytes>", "mimeType": "image/png" }
```

## Activity log

The record of what changed and why, per store — written automatically by
mutations below (product/pricing changes, order status changes, brand
updates, orders placed) and by explicit notes you leave.

### `GET /api/agent/activity`

Query params:
- `since` — ISO timestamp; only entries at or after this time.
- `take` — max rows (default 50).

```json
{ "activity": [ { "id": "...", "actor": "customer", "category": "order",
  "summary": "New order FIR-... placed ($27.95)", "details": {...}, "createdAt": "..." } ] }
```

`actor` is one of `"agent"`, `"admin"` (human `/admin` action),
`"customer"` (e.g. checkout), or `"system"` (e.g. store creation).
`category` is free text (`"product"`, `"pricing"`, `"order"`,
`"fulfillment"`, `"brand"`, `"note"`, ...) — not an enum, so a new kind of
event never needs a migration.

### `POST /api/agent/activity`

Leave an explicit note — this is how you record reasoning/observations
that don't correspond to any mutation, so a future session (yours or a
different model's) doesn't have to rediscover it:

```json
{ "category": "note", "summary": "Tried a 20% sale on the Tee for a week — no lift in conversion. Reverting price, won't retry without a design refresh.", "details": {} }
```

Always logged with `actor: "agent"`. Returns `201` with the created entry.

## Products

### `GET /api/agent/products`

List every product (including inactive ones), with images, variants, and
collection memberships.

Query params:
- `activeOnly=true` — only return active products.

```json
{ "products": [ { "id": "...", "slug": "trailhead-tee", "title": "...",
  "isActive": true, "isFeatured": true, "images": [...], "variants": [...],
  "collections": [...] } ] }
```

### `GET /api/agent/products/:id`

Get a single product by its `id`.

### `POST /api/agent/products`

Create a product with its variants.

```json
{
  "slug": "summit-jacket",
  "title": "Summit Jacket",
  "description": "A weatherproof shell for exposed ridgelines.",
  "optionNames": ["size", "color"],
  "isFeatured": false,
  "isActive": true,
  "productType": "tshirt",
  "collectionIds": ["clx...collectionId"],
  "images": [{ "url": "https://...", "altText": "Front view" }],
  "variants": [
    {
      "sku": "summit-jacket-m-black",
      "options": { "size": "M", "color": "Black" },
      "priceCents": 8995,
      "currency": "USD",
      "provider": "PRINTFUL",
      "providerVariantId": "12345",
      "inStock": true
    }
  ]
}
```

`productType` is free text (e.g. `"tshirt"`, `"hoodie"`, `"poster"`) used
only by the AI mockup path (`POST /api/agent/products/:id/mockups/ai`) to
pick which shared `MockupScene` photo to recolor/composite onto — optional,
and irrelevant to the Printful mockup path.

`optionNames` can be any list of keys appropriate to the product — e.g.
`["printType", "size"]` for a wall-art product with Poster/Canvas/Framed
Print variants at different sizes, each with its own `priceCents`:

```json
{
  "slug": "trailhead-vista-print",
  "title": "Trailhead Vista Print",
  "description": "...",
  "optionNames": ["printType", "size"],
  "variants": [
    { "sku": "...", "options": { "printType": "Poster", "size": "16x20" }, "priceCents": 2800 },
    { "sku": "...", "options": { "printType": "Canvas", "size": "16x20" }, "priceCents": 5800 },
    { "sku": "...", "options": { "printType": "Framed Print", "size": "16x20" }, "priceCents": 8800 }
  ]
}
```

Returns `201` with `{ "product": {...} }`, or `409 SLUG_TAKEN` if the slug
is already used, or `409 SKU_TAKEN` if any variant's `sku` collides with
an existing one for this store (`sku` uniqueness is per store, independent
of the product slug — see `@@unique([storeId, sku])`).

### `PATCH /api/agent/products/:id`

Update any subset of a product's fields. This is how an agent changes
**price** (edit `priceCents` on a variant), **stock** (`inStock`),
**featured/active status**, description, images, or collection
membership.

```json
{ "variants": [{ "id": "clx...variantId", "options": { "size": "M", "color": "Forest" }, "priceCents": 7995, "sku": "trailhead-tee-m-forest" }] }
```

A `variants` entry with an `id` updates that variant; one without an `id`
creates a new variant on the product. Only send the fields you want
changed — but a variant update currently expects the full variant object
(sku/priceCents/etc.), not a partial patch of just one field, since it's
validated against the same schema used for creation. Fetch the product
first if you need the variant's current values.

Returns `{ "product": {...} }` with the full updated product.

### `DELETE /api/agent/products/:id`

Soft-delete: sets `isActive: false`. Products are normally never
hard-deleted because past orders reference their variants — the one
exception is `POST /api/agent/store/prune-products` below, which only
targets inactive products with zero such references.

### `POST /api/agent/products/:id/mockups`

Render product photos of a design on the garment colors it actually reads
well on, and attach them to the product. Mockups are per **color** — all
sizes of one color share an image — so variants are collapsed to one per
color before anything is sent to the provider.

```json
{
  "designUrl": "https://.../design.png",
  "placement": "front",
  "dryRun": false
}
```

| field | default | meaning |
| --- | --- | --- |
| `designUrl` | *required* | Publicly reachable print file — a transparent PNG at print resolution. |
| `placement` | `"front"` | Provider placement key. |
| `colorOptionName` | `"color"` | Which of the product's `optionNames` carries the garment color. |
| `colors` | all | Restrict to these garment colors. |
| `garments` | provider lookup | `[{name, hex}]` — supply garment hexes yourself instead of looking them up. The only way to preview without provider credentials. |
| `catalogProductId` | provider lookup | Provider catalog product (the blank garment model). |
| `minContrast` | `2` | Minimum WCAG contrast for a garment to count as legible. |
| `minCoverage` | `0.05` | Ignore design colors below this share of the artwork. |
| `dryRun` | `false` | Score colors and report only — no provider calls, no images written. |

**How colors are chosen.** The design's palette is read from its *opaque*
pixels only (transparent background never counts as a design color), then
**every** significant color is contrasted against each garment — not just
the dominant one. That matters: a design with a dark body and a white
outline still loses its outline on a white shirt, and only the per-color
minimum catches it. `worstColor` tells you which design color was the
limiting factor.

Response:

```json
{
  "design": {
    "palette": [{ "hex": "#3f4a2f", "coverage": 0.55 }, { "hex": "#ffffff", "coverage": 0.41 }],
    "opaqueRatio": 0.428
  },
  "colors": [
    { "color": "Black", "hex": "#101010", "minContrast": 2.02, "worstColor": "#3f4a2f",
      "fits": true, "mockupUrl": "https://..." },
    { "color": "White", "hex": "#ffffff", "minContrast": 1, "worstColor": "#ffffff",
      "fits": false, "skipped": "design color #ffffff only reaches 1:1 against this garment" }
  ],
  "product": { "...": "the updated product, with the new images attached" },
  "dryRun": false
}
```

Each rendered image is stored with `optionValues: {"color": "Black"}` so a
storefront can show the mockup matching the selected variant. Re-running
replaces the images for the colors it renders, so it's safe to call again
after revising a design.

`opaqueRatio` near `1` means the background was never removed — the whole
canvas counts as design, and every garment will fail contrast.

**Start with `dryRun: true.`** It scores colors without spending provider
render calls, and combined with `garments` it needs no provider
credentials at all.

Errors: `NO_MOCKUP_VARIANTS` (422, no variant has both a color option and
a `providerVariantId`), `DESIGN_UNREADABLE` (422, the URL didn't fetch or
decode), `EMPTY_DESIGN` (422, fully transparent), `NO_LEGIBLE_COLORS`
(422, nothing met `minContrast`), `MISSING_CATALOG_PRODUCT` (422),
`PROVIDER_ERROR` (502, upstream failure — the message carries the
provider's own text, e.g. a missing API key).

`NO_LEGIBLE_COLORS` carries the full scoring in `error.details`
(`threshold`, `design`, `colors` — the same shapes as a success response)
and names the closest miss in its message, so one call tells you both
that it failed and what to change. No second `dryRun` needed:

```json
{
  "error": {
    "code": "NO_LEGIBLE_COLORS",
    "message": "No garment color reaches the 2:1 contrast threshold for this design; the closest was Athletic Heather at 1.66:1, limited by design color #ffffff. Lower minContrast, offer different garment colors, or rework the artwork.",
    "details": {
      "threshold": 2,
      "design": { "palette": [ "..." ], "opaqueRatio": 0.428 },
      "colors": [ { "color": "Athletic Heather", "minContrast": 1.66, "worstColor": "#ffffff", "fits": false, "...": "" } ]
    }
  }
}
```

Any error may carry a `details` object; only `NO_LEGIBLE_COLORS` does
today. Treat it as diagnostic context, not a stable contract per code.

Logs a `"mockup"` activity entry with the colors rendered and skipped.

> Mockup URLs point at the provider's CDN. Printful's are not guaranteed
> to be permanent — for a long-lived catalog, download and re-host them.

> A `PROVIDER_ERROR` reading `This endpoint requires \`store_id\`!` means
> the store's Printful token is a modern (OAuth/multi-store) one — set
> `Store.printfulStoreId` (or the platform-wide `PRINTFUL_STORE_ID` env
> var), found via `GET https://api.printful.com/stores` against that
> token. A legacy single-store token doesn't hit this.

### Mockup scenes (for AI mockups)

A `MockupScene` is one shared photo of a blank garment in a real setting
(not a plain white background), keyed by `Product.productType` (free text,
e.g. `"tshirt"`) — every product of that type reuses the same scene photo,
rather than uploading one per product. A scene also holds two more things
that make design placement deterministic instead of asking an image model
to "place it naturally" on every call:

- **`baseImages`** — one pre-generated, *design-free* recolor of the scene
  per color (AI-generated once, cached, reused for every design a product
  of this type ever gets — see `generate-bases` below).
- **`designArea`** — the rectangle (as fractions of the scene image's own
  pixel dimensions) a design gets scaled to fit inside and composited onto,
  set via the design-area editor in `/admin/mockup-scenes`. If unset,
  generation falls back to a centered default rather than failing.

#### `GET /api/agent/mockup-scenes`

Lists every scene this store has set, including `baseImages` and `designArea`.

#### `PUT /api/agent/mockup-scenes/:productType`

```json
{
  "data": "<base64, no data: prefix>",
  "mimeType": "image/png",
  "colors": [{ "name": "Black", "hex": "#101010" }, { "name": "White", "hex": "#ffffff" }]
}
```

Uploads/replaces the scene photo for that product type. JSON body with
base64 image data (not multipart), same shape as the hero-image upload
below. `:productType` is free text and doesn't need to exist yet.

`colors` is the garment color lineup for this product type — used both to
recolor this scene per color and as the color axis for a whole product
auto-generated from a design (below). Omit `colors` when just replacing
the photo to keep the existing lineup; at least one color is required
before `generate-bases` or `generate-from-design` can use this type.
Replacing the photo always clears `baseImages` — a base rendered from the
old photo no longer matches this one.

#### `POST /api/agent/mockup-scenes/:productType/generate-bases`

```json
{ "model": "google/gemini-2.5-flash-image" }
```

Generates (or regenerates) every color's design-free base mockup — one AI
recolor call per color, no design composited. Optional; a missing base is
also generated and cached automatically the first time a design needs it
(see the mockups endpoint below), so this is for pre-warming the cache or
forcing a refresh (e.g. after tweaking colors), not a required step.

Fails with `NO_MOCKUP_SCENE_COLORS` (422) if the scene has no colors.
Response: `{ "scene": {...}, "generated": {"Black": "https://..."}, "failed": [] }`.
A partial failure doesn't erase bases from a previous successful run.

#### `PUT /api/agent/mockup-scenes/:productType/design-area`

```json
{ "x": 0.32, "y": 0.22, "width": 0.36, "height": 0.42 }
```

Sets the rectangle a design gets placed into, as fractions (0-1) of the
scene image's own pixel dimensions — `x`/`y` is the top-left corner. Best
set visually via the design-area editor in `/admin/mockup-scenes`, which
locks the rectangle to a reference design's aspect ratio while you
drag/scale it; calling this directly means computing that aspect ratio
yourself.

#### `DELETE /api/agent/mockup-scenes/:productType`

Removes the scene for that product type.

### `POST /api/agent/products/generate-from-design`

Creates a whole product from just a design image: an AI text model writes
the title/description, one variant is created per (color × size) using the
product type's `MockupScene` color lineup, then a mockup is generated and
attached for every color (same as `POST /api/agent/products/:id/mockups/ai`
below) — the "pick a type, upload a design, get a finished product" flow.

```json
{
  "productType": "tshirt",
  "designUrl": "https://.../design.png",
  "priceCents": 2499,
  "sizes": ["S", "M", "L", "XL"]
}
```

| field | default | meaning |
| --- | --- | --- |
| `productType` | *required* | Must have a `MockupScene` with at least one color set. |
| `designUrl` | *required* | Publicly reachable transparent PNG print file. |
| `priceCents` | *required* | Applied to every variant. |
| `currency` | `"USD"` | |
| `sizes` | `["S","M","L","XL"]` | Applied to every color. |
| `colorOptionName` | `"color"` | |
| `sizeOptionName` | `"size"` | |
| `textModel` | `OPENROUTER_TEXT_MODEL` env var | Overrides the model used for the title/description call. |

Fails with `NO_MOCKUP_SCENE` (422, no scene for this type) or
`NO_MOCKUP_SCENE_COLORS` (422, scene exists but has no colors set) before
attempting anything. `AI_PROVIDER_ERROR` (502) covers both a failed title/
description call and (via the same code as the mockups endpoint) every
color's mockup call failing. New variants have no `providerVariantId` —
set that via `PATCH /api/agent/products/:id` (per product/color/size,
looked up from your fulfillment provider's catalog) before the product can
be fulfilled.

Response shape matches the mockups-only endpoint plus the generated copy:

```json
{
  "product": { "...": "the created product, with variants and mockup images attached" },
  "title": "...",
  "description": "...",
  "rendered": [{ "color": "Black", "mockupUrl": "https://..." }],
  "failed": []
}
```

### `POST /api/agent/products/:id/mockups/ai`

An alternative to the Printful mockup generator above, for a non-generic,
non-white-background result: composites the design onto this product
type's pre-generated, per-color base mockup (see mockup scenes above),
scaling it to fit the scene's `designArea` and blending it on at 85%
opacity so a little of the garment's own shading still reads through. This
is a **deterministic local image composite, not an AI call** — the only AI
step (recoloring the blank scene per color) happened once already, when
the base was generated, so placement is identical across colors and runs
instead of an image model re-deciding it each time.

```json
{
  "designUrl": "https://.../design.png",
  "colorOptionName": "color",
  "colors": ["Black", "White"]
}
```

| field | default | meaning |
| --- | --- | --- |
| `designUrl` | *required* | Publicly reachable transparent PNG print file. |
| `colorOptionName` | `"color"` | Which of the product's `optionNames` carries the garment color. |
| `colors` | all | Restrict to these garment colors. |

Requires `Product.productType` to be set (via `PATCH /api/agent/products/:id`)
and a scene uploaded for that type — fails with `MISSING_PRODUCT_TYPE` or
`NO_MOCKUP_SCENE` (both 422) otherwise. A color with no cached base image
gets one generated and cached on the fly (one AI call), so this only needs
`OPENROUTER_API_KEY` configured, not a prior `generate-bases` call. Also
fails with `NO_MOCKUP_VARIANTS` (422, no variant has the color option set)
or `AI_PROVIDER_ERROR` (502, every color failed — `error.details.failed`
lists each color's error, whether from the on-demand base render or the
composite step).

Generation runs **per color independently**: a failure on one color doesn't
block the others — the response's `rendered`/`failed` arrays report each
outcome, and at least one success is required for a 200. Logs an
`"ai-mockup"` activity entry.

Response:

```json
{
  "product": { "...": "the updated product, with the new images attached" },
  "rendered": [{ "color": "Black", "mockupUrl": "https://..." }],
  "failed": []
}
```

The generated image is uploaded to this store's own asset store
(`/api/assets/:id`), not a temporary provider CDN URL, so it doesn't need
re-hosting later.

## Designs

A design is defined by **structured aspects**, not by an opaque image URL —
see the design-system notes in `AGENTS.md`. The prompt sent to the image
model is derived from the aspects and stored verbatim, so any generation is
reproducible and any later sale can be attributed back to the choices that
produced it. This is Phase 1 of that system: create a design from aspects
and get back a preview image. There's no QC gate, upscale, or publish step
yet (those are Phase 2) — `Design.masterImageUrl` stays null and `status`
never advances past `"generated"`.

### `GET /api/agent/designs/vocabulary`

Returns the versioned, controlled vocabulary for every aspect axis — how an
agent learns the legal values without hardcoding them:

```json
{
  "version": 1,
  "hook": ["insider_joke", "pun", "identity_badge", "..."],
  "occasion": ["everyday", "gift", "holiday", "..."],
  "layout": ["text_only_stacked", "icon_above_text", "..."],
  "artStyle": ["vintage_distressed", "bold_block_type", "..."],
  "colorScheme": ["one_color_white", "two_color_contrast", "..."],
  "complexity": ["minimal", "moderate", "detailed"],
  "designedForShade": ["dark", "light", "both"],
  "printRatio": ["square_1_1", "portrait_4_5", "wide_3_2", "pocket_1_1"],
  "placement": ["front_center", "left_chest", "back_full", "sleeve"]
}
```

`hook`, `layout`, `artStyle`, `colorScheme`, and `complexity` are the five
*experiment axes* — the ones worth varying one at a time across a batch of
designs to see what sells. `occasion`, `designedForShade`, `printRatio`,
and `placement` are context/placement, not things to A/B. `phrase` (the
exact words on the garment) and `subject` (the visual subject, as a short
tag like `"disc golf basket"`) are free text, not enum values.

### `POST /api/agent/designs`

Validates the aspects, compiles them into a prompt, generates an image via
the chosen provider, and stores the result — one call, one design:

```json
{
  "aspects": {
    "hook": "insider_joke",
    "occasion": "everyday",
    "phrase": "ACE OR NOTHING",
    "subject": "disc golf basket",
    "layout": "icon_above_text",
    "artStyle": "vintage_distressed",
    "colorScheme": "retro_three_color",
    "complexity": "moderate",
    "designedForShade": "light",
    "printRatio": "portrait_4_5",
    "placement": "front_center"
  }
}
```

`slug` is optional (auto-derived from `phrase`/`subject` when omitted).
`provider` defaults to `"openrouter"` — the only adapter implemented so far
(reaches GPT Image 1 / Nano Banana through OpenRouter's unified endpoint,
same client the AI mockup pipeline already uses); `model` falls back to
that adapter's own default. Returns the created `Design` row, including
`prompt` (exactly what was sent), `previewImageUrl`, and `aspects` echoed
back. A repeated call with the same aspects produces a new design — nothing
here is idempotent, since the image model isn't deterministic even with an
identical prompt.

### `GET /api/agent/designs?status=&take=`

Lists this store's designs, most recent first. `status` filters to one of
`draft | generated | rejected | published | archived`; `take` caps the
count (default 50).

## Collections

### `GET /api/agent/collections`

List all collections with a product count.

### `POST /api/agent/collections`

```json
{ "slug": "winter-2026", "title": "Winter 2026", "description": "..." }
```

## Orders

### `GET /api/agent/orders`

List orders, most recent first.

Query params:
- `status` — one of `PENDING_PAYMENT`, `PAID`, `SUBMITTED_TO_FULFILLMENT`,
  `IN_PRODUCTION`, `SHIPPED`, `CANCELED`.
- `take` — max rows (default 100).

### `GET /api/agent/orders/:idOrNumber`

Fetch one order (by `id` or `orderNumber`) with its line items.

### `POST /api/agent/orders/:idOrNumber/mark-paid`

Transitions an order from `PENDING_PAYMENT` to `PAID`. Returns
`409 INVALID_STATUS` if it isn't currently `PENDING_PAYMENT`.

### `POST /api/agent/orders/:idOrNumber/fulfill`

Submits the order to its fulfillment provider (Printful today) and
records the resulting `providerOrderId`, moving status to
`SUBMITTED_TO_FULFILLMENT`.

Fails with `422 MISSING_PROVIDER_VARIANT` if any line item's variant
doesn't have a `providerVariantId` set — set that via `PATCH
/api/agent/products/:id` first (typically after syncing the provider's
catalog).

## Store summary

### `GET /api/agent/summary`

A single-call snapshot built for "what should I do next?" decisions:

```json
{
  "products": { "total": 12, "active": 10, "inactive": 2 },
  "orders": {
    "byStatus": { "PENDING_PAYMENT": 3, "PAID": 1 },
    "stuckPendingPaymentOver24h": [ { "orderNumber": "WL-...", "createdAt": "...", "email": "..." } ],
    "recent": [ { "orderNumber": "WL-...", "status": "PAID", "subtotalCents": 2995, "createdAt": "..." } ]
  },
  "revenueCents": 45992,
  "attention": {
    "outOfStockVariants": [ { "id": "...", "sku": "...", "options": { "size": "M" }, "product": { "title": "...", "slug": "..." } } ],
    "variantsMissingPrice": [ { "id": "...", "sku": "...", "product": { "title": "...", "slug": "..." } } ]
  }
}
```

Use this before making changes — it's the fastest way to find what's
worth optimizing (stuck orders, dead stock, missing prices) without
crawling every product/order endpoint individually.

## Cleanup

Housekeeping for data nothing else cleans up automatically. Both
endpoints below take the same body and default to a dry run — a caller
must explicitly pass `"dryRun": false` to actually delete anything.

```json
{ "dryRun": false }
```

### `POST /api/agent/store/prune-assets`

Every uploaded design, scene photo, base mockup, and generated mockup is
stored permanently (see `src/lib/store/assets.ts` — nothing currently
deletes an asset when the thing referencing it gets replaced). This finds
every `StoreAsset` nothing currently points to — not `Store.theme.
heroImageUrl`, not `Store.theme.logoUrl`, not any `MockupScene.imageUrl`/
`baseImages` entry, not any `ProductImage.url` — and, unless `dryRun`,
deletes them.

```json
{
  "total": 42,
  "orphaned": [{ "id": "...", "kind": "mockup-scene-base", "mimeType": "image/png", "createdAt": "..." }],
  "deleted": 12,
  "dryRun": false
}
```

Doesn't scan `Store.bannerHtml` for asset links — that field is meant for
externally-hosted images, and it's free-form admin/agent-authored HTML.

### `POST /api/agent/store/prune-products`

Hard-deletes **inactive** products whose variants have zero `CartItem`/
`OrderItem` references — the one case where hard-deleting a product is
actually safe, unlike the normal soft-delete-only rule above. A product
with even one variant still referenced is left alone (the DB's own
foreign-key constraint would reject that delete regardless).

```json
{
  "total": 5,
  "eligible": [{ "id": "...", "title": "...", "slug": "..." }],
  "skipped": [{ "id": "...", "title": "...", "slug": "..." }],
  "deleted": 3,
  "failed": [],
  "dryRun": false
}
```

Deleting a product cascades to its `ProductVariant`, `ProductImage`, and
`ProductCollection` rows.

## What's not here yet

- **An MCP server.** Everything above is plain REST/JSON today. A future
  MCP server would wrap these same endpoints as tools for Claude
  Desktop/Code, Gemini CLI, and OpenAI-agent-SDK clients without needing
  three separate integrations — see `AGENTS.md` rule #12. Not built yet;
  when it is, every endpoint here gets a corresponding tool, and this
  doc stays the source of truth both mirror.
- `GET /api/platform/stores` — listing all stores. Not yet needed since
  each store's own key already scopes what an agent can see.
- Fetching a live Printful catalog / cost quotes through the agent API
  directly (today you'd call `getFulfillmentProvider("PRINTFUL")` from
  server-side code — see `src/lib/fulfillment/`). Worth adding as
  `GET /api/agent/fulfillment/:provider/catalog` if an agent needs it.
- Multi-provider price comparison (`ProviderQuote` exists in the schema
  but nothing populates it yet).
- Bulk operations (batch price updates, bulk import). Loop `PATCH
  /api/agent/products/:id` calls for now.
- **Design system Phase 2+**: a QC gate (text-fidelity/alpha-coverage/
  color-count/contrast checks against `previewImageUrl`), an upscale step
  to `Design.masterImageUrl` at print-ready resolution, `PrintTemplate`
  (per-provider/product-type pixel specs), and `POST
  /api/agent/designs/:id/publish` to turn a design into products. Until
  then, a design's `previewImageUrl` can be passed manually as `designUrl`
  to `POST /api/agent/products/generate-from-design`. Phase 3+ adds
  `DesignEvent` view tracking, `DesignBatch` flights, and `GET
  /api/agent/designs/insights` (which aspect values actually sell).
