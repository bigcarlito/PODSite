---
name: wildline-store-agent
description: Manage the Wildline Supply Co. print-on-demand store — read products, pricing, inventory, and orders, and make changes (update prices/stock, create/deactivate products, mark orders paid, submit orders to Printful) via its agent API. Use whenever asked to check store status, find what needs attention (low stock, stuck orders, pricing issues), or make any product/order/pricing change to this store.
---

# Wildline Store Agent

This store is built to be operated by an AI agent through its JSON API at
`/api/agent/*` — no browser or admin login required. This skill is a
condensed operating reference; the full, authoritative reference lives in
the store's own repo at `docs/AGENT_API.md` (kept in sync with this file —
see "Keeping this in sync" below).

## Configuration this skill needs

Before using this skill, you need two values, provided by whoever owns the
store deployment:

- `STORE_BASE_URL` — e.g. `https://wildline.up.railway.app`
- `STORE_ADMIN_API_KEY` — the bearer token for the agent API

If you don't have these, ask for them rather than guessing — never invent
a store URL or key.

## Auth

Every request needs:

```
Authorization: Bearer <STORE_ADMIN_API_KEY>
```

A missing/wrong token returns `401` with `{"error":{"code":"UNAUTHORIZED",...}}`.

## Conventions

- All money fields are integer **cents** (`priceCents`, `subtotalCents`)
  plus a `currency` code (e.g. `"USD"`). Never send or expect floats.
- Every mutation response returns the **full updated resource** — confirm
  the effect from the response, don't issue a separate read.
- Errors are always JSON: `{"error":{"code","message","field?"}}`. Common
  codes: `VALIDATION_ERROR` (400), `NOT_FOUND` (404), `SLUG_TAKEN` /
  `ALREADY_SUBMITTED` (409), `MISSING_PROVIDER_VARIANT` (422).
- IDs are `cuid()` strings. Orders also accept their human-readable
  `orderNumber` (e.g. `WL-MTMEQDWZ`) anywhere an order ID is expected.

## Start here: the store summary

Before making changes, call this to see what's worth doing:

```
GET /api/agent/summary
```

Returns product counts, orders grouped by status, orders stuck in
`PENDING_PAYMENT` for 24h+, recent orders, total revenue, out-of-stock
variants, and variants with no price set. This is the fastest way to
answer "what should I fix or optimize right now?" — check it first.

## Products

- `GET /api/agent/products?activeOnly=true` — list products (all, or
  active only), each with images, variants, and collections.
- `GET /api/agent/products/:id` — one product.
- `POST /api/agent/products` — create a product + its variants:
  ```json
  {
    "slug": "summit-jacket", "title": "Summit Jacket",
    "description": "...", "isFeatured": false, "isActive": true,
    "collectionIds": [], "images": [{"url": "https://...", "altText": "..."}],
    "variants": [{ "sku": "summit-jacket-m-black", "size": "M",
      "color": "Black", "priceCents": 8995, "currency": "USD",
      "provider": "PRINTFUL", "inStock": true }]
  }
  ```
- `PATCH /api/agent/products/:id` — update price, stock, active/featured
  status, description, images, or collections. This is how you change
  **price** (edit `priceCents` on a variant) and **stock** (`inStock`).
  A `variants` entry needs an `id` to update an existing variant (send
  the full variant object, not a partial patch — fetch the product first
  if you need its current field values); omit `id` to add a new variant.
- `DELETE /api/agent/products/:id` — soft-delete (`isActive: false`).
  Products are never hard-deleted (past orders reference their variants).

## Collections

- `GET /api/agent/collections` — list, with product counts.
- `POST /api/agent/collections` — `{"slug","title","description?"}`.

## Orders

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

**"What needs my attention?"** → `GET /api/agent/summary`, then act on
`attention.outOfStockVariants`, `attention.variantsMissingPrice`, and
`orders.stuckPendingPaymentOver24h`.

**"Raise/lower prices on X"** → `GET /api/agent/products` (or fetch the
one product), find the variant(s), `PATCH` with updated `priceCents`.

**"Process pending orders"** → `GET /api/agent/orders?status=PAID`, then
`POST .../fulfill` on each.

## Keeping this in sync

This file mirrors `docs/AGENT_API.md` in the store's repo. Whenever the
agent API changes (new endpoint, changed payload, new error code), both
files must be updated together — treat a mismatch between them as a bug.
