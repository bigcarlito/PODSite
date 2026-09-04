# Agent API Reference

This is the machine-callable interface to the store. It exists so an AI
agent (or any script) can read the store's full state and make the same
changes a human admin would make in `/admin` — without a browser. See
`AGENTS.md` for the design principles behind it.

If you add, change, or remove an endpoint, update this file in the same
commit — an undocumented endpoint is a bug (see `AGENTS.md` rule #3).

## Auth

Every request needs:

```
Authorization: Bearer <ADMIN_API_KEY>
```

`ADMIN_API_KEY` is a separate secret from `ADMIN_PASSWORD` (the human
`/admin` login) — set it in your environment (see `.env.example`). A
missing or wrong token gets a `401` with a JSON body, never a redirect or
HTML page:

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
  "isFeatured": false,
  "isActive": true,
  "collectionIds": ["clx...collectionId"],
  "images": [{ "url": "https://...", "altText": "Front view" }],
  "variants": [
    {
      "sku": "summit-jacket-m-black",
      "size": "M",
      "color": "Black",
      "priceCents": 8995,
      "currency": "USD",
      "provider": "PRINTFUL",
      "providerVariantId": "12345",
      "inStock": true
    }
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
{ "variants": [{ "id": "clx...variantId", "priceCents": 7995 }] }
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
    "outOfStockVariants": [ { "id": "...", "sku": "...", "product": { "title": "...", "slug": "..." } } ],
    "variantsMissingPrice": [ { "id": "...", "sku": "...", "product": { "title": "...", "slug": "..." } } ]
  }
}
```

Use this before making changes — it's the fastest way to find what's
worth optimizing (stuck orders, dead stock, missing prices) without
crawling every product/order endpoint individually.

## What's not here yet

- Fetching a live Printful catalog / cost quotes through the agent API
  directly (today you'd call `getFulfillmentProvider("PRINTFUL")` from
  server-side code — see `src/lib/fulfillment/`). Worth adding as
  `GET /api/agent/fulfillment/:provider/catalog` if an agent needs it.
- Multi-provider price comparison (`ProviderQuote` exists in the schema
  but nothing populates it yet).
- Bulk operations (batch price updates, bulk import). Loop `PATCH
  /api/agent/products/:id` calls for now.
