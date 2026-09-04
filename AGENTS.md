# Agent Instructions — Wildline Supply Co.

## North star

This is not just an ecommerce site — it is an ecommerce site **designed to
be operated by AI agents**, not just humans. Every feature exists twice
where it matters: once as a page a human can click through, and once as a
typed, scriptable interface an agent can call directly. When those two
paths would conflict, **the agent-facing path wins**. A human-only feature
(something clickable in `/admin` with no equivalent in `src/lib/agent/` or
`/api/agent/*`) is treated as an incomplete feature, not a finished one.

Concretely, that means an agent (Claude or otherwise) should be able to,
without ever opening a browser:

1. **Read** the full state of the store — products, variants, pricing,
   inventory signals, orders, fulfillment status, and a rollup of what
   needs attention (out-of-stock variants, stuck orders, pricing outliers).
2. **Act** on that state — create/update/deactivate products and variants,
   change prices, submit orders to fulfillment, mark orders paid — through
   the same typed functions the UI calls, not by reimplementing logic.
3. **Verify** the effect of an action from the response payload alone,
   without needing to separately query the database or reload a page.

Keep this file (and its practical rules below) up to date as the single
source of truth for how the codebase supports agent-driven management. If
you add a feature that changes how an agent would interact with the store,
update this file in the same change.

## Practical rules for anyone (human or agent) working in this repo

### 1. Business logic lives in `src/lib/`, never only in a page or route

`src/app/**/actions.ts` (server actions for the human UI) and
`src/app/api/agent/**/route.ts` (JSON endpoints for agents) must both be
thin wrappers around shared functions in `src/lib/store/`. Never write
mutation logic inline in a server action or route handler — write it once
in `src/lib/store/*.ts`, and call it from both surfaces. This is what
keeps the two paths from drifting apart.

### 2. Every mutation is typed, validated, and returns the full resulting state

Use `zod` schemas (see `src/lib/store/schemas.ts`) to validate every
agent-facing input. On success, return the updated row(s) — not just
`{ ok: true }` — so an agent can confirm the effect without a follow-up
read. On failure, return a structured error (`{ error: { code, message,
field? } }`), never a bare 500 with an HTML error page: agents parse JSON,
not stack traces.

### 3. The agent API is the source of truth for "what can be managed"

`docs/AGENT_API.md` documents every endpoint under `/api/agent/*`. When
you add, change, or remove an endpoint, update that doc in the same
commit. Treat an undocumented endpoint as a bug.

### 4. Prices and money are always integer cents, never floats

Every price field in the schema and every API payload is an integer in
cents (`priceCents`, `subtotalCents`, etc.), with a companion `currency`
code. This avoids floating-point drift that would otherwise make
agent-driven price optimization unreliable.

### 5. IDs are stable, human-and-agent-legible strings

`cuid()` primary keys, `slug` fields for anything user-facing, and
`sku`/`orderNumber` business identifiers. Don't introduce composite or
opaque keys that make it harder for an agent to reference a specific
record across calls.

### 6. Fulfillment providers are pluggable — keep it that way

`src/lib/fulfillment/types.ts` defines the `FulfillmentProvider`
interface; `registry.ts` resolves a provider by name. Printful is the only
implementation today. When adding Gelato/Printify/etc., implement the
same interface and register it — never special-case a provider name
inside cart, checkout, or order code. The long-term goal is letting an
agent compare `getQuotes()` across providers and pick the cheapest one per
order; provider-specific branching outside the registry breaks that.

### 7. Every agent-facing write is authenticated and audit-friendly

`/api/agent/*` requires an `Authorization: Bearer <ADMIN_API_KEY>` header
(see `src/lib/agent-auth.ts`). Mutations should be attributable — prefer
updating `updatedAt` timestamps and, where it exists, an actor/source
field over silent writes. Never lower this bar to make an endpoint
"easier to call."

### 8. Optimization data is a first-class feature, not an afterthought

`GET /api/agent/summary` exists specifically so an agent can answer "what
should I do next?" in one call — low/no-stock variants, orders stuck in a
status, revenue rollups. When you add a new signal that would help an
agent decide what to fix or change (a slow-moving product, an
abandoned-cart pattern, a price that's out of line with a provider's
cost), add it here rather than burying it in a human-only admin page.

### 9. Keep the storefront itself simple

The north star is "simple but powerful." Don't add speculative
abstraction, config systems, or plugin frameworks the store doesn't need
yet — that complexity makes the codebase harder for an agent (or a human)
to reason about and safely change. Power comes from the agent API and
clean data model, not from architectural layers.

## Where things are

```
prisma/schema.prisma        Data model — the ground truth for what exists
src/lib/store/               Shared business logic (used by both actions.ts
                              and api/agent/ routes) — start here for any
                              behavior change
src/lib/fulfillment/         Pluggable POD provider interface + Printful impl
src/lib/agent-auth.ts        Bearer-token auth for /api/agent/*
src/app/api/agent/           JSON API surface for agents (see docs/AGENT_API.md)
src/app/admin/                Human dashboard — thin UI over src/lib/store/
src/app/                     Storefront pages (home, products, cart, checkout...)
docs/AGENT_API.md            Full reference for the agent API
```

## Before you finish a change

- If you touched pricing, inventory, products, collections, or orders:
  does `src/lib/store/` still have one function per operation, called by
  both the human action and the agent route?
- If you added a capability an agent would want (a new mutation, a new
  piece of store state worth reading), is there an `/api/agent/*` route
  for it, documented in `docs/AGENT_API.md`?
- Did you run `npm run lint` and `npm run build`?
