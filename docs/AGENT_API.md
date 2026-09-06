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
  "printfulApiKey": "optional — this store's own Printful account"
}
```

Only `slug`, `name`, `tagline`, and `description` are required — `tone`,
`audience`, and `brief` are for whichever agent generates this store's
copy/products next, not rendered on the storefront. Everything else
defaults to empty and can be refined later with the new store's own key
via `PATCH /api/agent/store` (see "Store brand & settings" below) —
there's no platform-level `PATCH /api/platform/stores/:id`, since brand
edits are naturally a store managing itself, not a platform operation.

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

**This replaces the field, it does not deep-merge.** If you're only
adding one key to `brief`, `GET /api/agent/store` first, edit the object
client-side, then `PATCH` the whole thing back. Never touches `slug`,
`domain`, or credentials — there's no endpoint for those; contact the
platform operator.

Logs a `"brand"` activity entry automatically.

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
is already used.

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

Soft-delete: sets `isActive: false`. Products are never hard-deleted
because past orders reference their variants.

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
