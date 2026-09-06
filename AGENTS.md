# Agent Instructions — Multi-Store POD Platform

## North star

This is not just an ecommerce site — it is a **platform for print-on-demand
stores, each one designed to be created and operated by AI agents**, not
just humans. One Next.js app and one database serve every store; a store
is a `Store` row (see `prisma/schema.prisma`), not a deployment. Every
feature exists twice where it matters: once as a page a human can click
through, and once as a typed, scriptable interface an agent can call
directly. When those two paths would conflict, **the agent-facing path
wins**. A human-only feature (something clickable in `/admin` with no
equivalent in `/api/agent/*`) is treated as an incomplete feature, not a
finished one.

Concretely, that means an agent (Claude or otherwise) should be able to,
without ever opening a browser:

1. **Create** a new store from a brand brief (name, tagline, tone,
   audience) via `POST /api/platform/stores` — a data insert, not new
   infrastructure. See "Creating a new store" below.
2. **Read** the full context of any store it holds a key for in one call
   (`GET /api/agent/briefing`) — brand/business knowledge, products,
   variants, pricing, inventory signals, orders, fulfillment status, a
   rollup of what needs attention (out-of-stock variants, stuck orders,
   pricing outliers), and a history of what's already been tried.
3. **Act** on that state — create/update/deactivate products and variants,
   change prices, submit orders to fulfillment, mark orders paid — through
   the same typed functions the UI calls, not by reimplementing logic.
4. **Verify** the effect of an action from the response payload alone,
   without needing to separately query the database or reload a page.

Keep this file (and its practical rules below) up to date as the single
source of truth for how the codebase supports agent-driven management. If
you add a feature that changes how an agent would interact with the
platform or a store, update this file in the same change.

## Creating a new store

1. `POST /api/platform/stores` with `Authorization: Bearer <PLATFORM_API_KEY>`
   and a brief: `{slug, name, tagline, description, tone, audience, ...}`
   (see `docs/AGENT_API.md`). Returns the new store plus its admin
   password and agent API key — shown **once**, never recoverable after.
2. Use that store's `agentApiKey` against the normal `/api/agent/products`
   (etc.) endpoints, resolved via that store's subdomain
   (`<slug>.yourdomain.com`, or `?store=<slug>` in local dev), to populate
   its catalog from a design brief — same endpoints any store uses.
3. Done. No new Railway service, no new database, no deploy.

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

`docs/AGENT_API.md` documents every endpoint under `/api/agent/*` and
`/api/platform/*`, and `skills/pod-platform-agent/SKILL.md` is a
condensed operating version of the same reference, meant to be dropped
into an external agent harness that supports Skills. When you add,
change, or remove an endpoint, update **both files** in the same commit.
Treat either as undocumented — or the two as inconsistent with each
other — as a bug.

### 4. Prices and money are always integer cents, never floats

Every price field in the schema and every API payload is an integer in
cents (`priceCents`, `subtotalCents`, etc.), with a companion `currency`
code. This avoids floating-point drift that would otherwise make
agent-driven price optimization unreliable.

### 5. IDs are stable, human-and-agent-legible strings

`cuid()` primary keys, `slug` fields for anything user-facing, and
`sku`/`orderNumber` business identifiers. Don't introduce composite or
opaque keys that make it harder for an agent to reference a specific
record across calls. `slug` and `sku`/`orderNumber` uniqueness is scoped
**per store** (`@@unique([storeId, slug])`, etc.), not global — see rule
#11.

### 6. Fulfillment providers are pluggable — keep it that way

`src/lib/fulfillment/types.ts` defines the `FulfillmentProvider`
interface; `registry.ts` resolves a provider by name. Printful is the only
implementation today. Each store may hold its own provider credentials
(`Store.printfulApiKey`, falling back to the platform's `PRINTFUL_API_KEY`
env var) — providers are constructed per call with the calling store's
key, never shared singletons, so credentials can't leak across stores.
When adding Gelato/Printify/etc., implement the same interface and
register it — never special-case a provider name inside cart, checkout,
or order code.

### 7. Every agent-facing write is authenticated and store-scoped

`/api/agent/*` requires `Authorization: Bearer <agent API key>`, checked
against the **resolved store's own** `agentApiKeyHash` (see
`src/lib/agent-auth.ts`, `src/lib/store-context.ts`) — a key for one store
cannot authenticate against another, even if the caller somehow guesses a
record ID. `/api/platform/*` (store creation) uses a separate,
store-independent `PLATFORM_API_KEY`. Passwords and API keys are never
stored in plaintext (see `src/lib/credentials.ts`: scrypt for the human
admin password, sha256 for the high-entropy agent key) — never lower this
bar to make an endpoint "easier to call."

### 8. Optimization data is a first-class feature, not an afterthought

`GET /api/agent/briefing` exists specifically so a fresh agent session —
which has no memory of anything done before — can answer "what's this
store, and what should I do next?" in one call: brand/business knowledge
(`Store.brief`), a live operational snapshot (`GET /api/agent/summary`:
low/no-stock variants, orders stuck in a status, revenue rollups), and
recent history (`GET /api/agent/activity`), all scoped to the calling
store. When you add a new signal that would help an agent decide what to
fix or change (a slow-moving product, an abandoned-cart pattern, a price
that's out of line with a provider's cost), add it to the summary rather
than burying it in a human-only admin page.

### 9. Keep each store's storefront simple

The north star is "simple but powerful." Don't add speculative
abstraction, config systems, or plugin frameworks a store doesn't need
yet — that complexity makes the codebase harder for an agent (or a human)
to reason about and safely change. Power comes from the agent API and
clean data model, not from architectural layers. This applies per-store
too: a store's `theme`/`nav`/`footerLinks` are small JSON blobs an agent
can set in one call, not a config system to build features around.

### 10. Variant properties are generic, never fixed columns

Stores sell apparel, wall art, and whatever comes next, each with
different variant axes (size/color for a tee, printType/size for a
poster). Don't add a `size` column, a `color` column, or any other
category-specific column to `ProductVariant` — that doesn't scale and
breaks the "one product model" premise. Instead: `Product.optionNames`
lists the ordered option keys for that product, and
`ProductVariant.options` (JSON) holds the values for those keys. Adding a
new product category is a data change (pick option names, create
variants), never a schema change. Every variant keeps its own
`priceCents` regardless of its options, so different combinations (a
Framed Print vs. a Poster at the same size) price independently.

### 11. Every query is scoped to a store — there is no "the store"

This app serves many stores from one database. Every model except `Store`
itself has a `storeId` (`Product`, `Collection`, `ProductVariant`, `Cart`,
`Order`). Any new table holding store-specific data needs one too. Rules
for code that touches them:

- **Every** `src/lib/store/*.ts` function takes a `storeId` (or the
  `Store`) as its first argument and includes it in every `where` clause —
  reads and writes both. There is no function that operates on "the"
  product/order/etc. without a store to scope it.
- Resolve the current store once per request with `getCurrentStore()` (or
  `requireCurrentStore()` to throw a 404 if none) from
  `src/lib/store-context.ts` — never read `process.env` for
  store-identifying info, and never trust a client-supplied store id.
  `getCurrentStore()` is `cache()`-wrapped, so calling it multiple times
  per request is free.
- Prisma `update`/`delete` calls on a record looked up by id should still
  include `storeId` in the `where` (Prisma's extended-where-unique
  supports this: `{ id, storeId }`) as defense in depth — an agent for
  store A should get a 404, not a mutation, if it somehow references
  store B's record id.
- Branding (name, tagline, theme colors, nav, footer, trust badges,
  social links, announcement banner HTML) lives on `Store` as small JSON
  fields — see
  `src/lib/store-branding.ts` — never hardcode brand copy/colors in a
  component. `src/lib/site-config.ts` doesn't exist anymore; if you find
  yourself wanting to add something like it, put the data on `Store`
  instead.
- In production, a store is identified by its subdomain (or custom
  domain) — middleware (`src/middleware.ts`) resolves this, no code
  downstream needs to know about hostnames. Local dev has no real
  subdomains, so `?store=<slug>` (remembered in a cookie so it survives a
  server redirect) and `DEV_STORE_SLUG` exist as fallbacks — see
  `src/lib/store-context.ts`. Never assume `?store=` works in production;
  it's a dev convenience layered under real domain resolution, not a
  replacement for it.

### 12. Every meaningful mutation writes an activity log entry

`ActivityLogEntry` (see `src/lib/store/activity.ts`) is the "recent
activity" half of full agent context — without it, every fresh session
re-discovers the business from scratch and can repeat a failed
experiment. Any mutation an agent, admin, or customer makes that another
session would benefit from knowing about — price/stock changes, order
status changes, brand/settings updates, orders placed — calls
`logActivity()` after the write succeeds, inside the same
`src/lib/store/*.ts` function (not bolted on in the route handler,
per rule #1). Pass the real `actor` (`"agent"`, `"admin"`, `"customer"`,
or `"system"`) — never default a human action to `"agent"` or vice versa.
`category` is free text, not an enum — a new kind of event never needs a
migration. `POST /api/agent/activity` exists so an agent can also log a
note that doesn't correspond to any mutation ("tried X, didn't work") —
this is how reasoning survives across sessions and models.

### 13. Every new agent-facing capability must consider MCP exposure

There is no MCP server yet (see `docs/AGENT_API.md` "What's not here
yet"), but one is planned: a thin `/api/mcp` layer wrapping this same
REST surface as tools for Claude/Gemini/OpenAI-agent-SDK clients, so it's
built once and used by all three instead of three separate integrations.
Until it exists, every new `/api/agent/*` or `/api/platform/*` endpoint
must still be **designed as if it will become an MCP tool**:

- One clear action per endpoint (not a multi-purpose endpoint switched by
  a body field) — this maps 1:1 to one MCP tool with one JSON-schema input.
- Inputs and outputs validated by a `zod` schema (rule #2) — MCP tool
  schemas will be generated from these, not written by hand a second time.
- No capability that only works via a human browser session (a cookie,
  a multi-step form flow) — an MCP tool call is stateless like a REST
  call, so anything agent-facing must already be a single authenticated
  request/response, which rule #1 and #7 already require.

When the MCP server is eventually built, it must not duplicate logic: its
tool handlers call the same `src/lib/store/*.ts` functions the REST
routes call (same pattern as rule #1, one more thin caller), and
`docs/AGENT_API.md` stays the canonical reference both the REST docs and
the MCP tool descriptions are generated/kept in sync from.

## Where things are

```
prisma/schema.prisma          Data model — Store is the tenant boundary;
                                everything else has a storeId
prisma/seed.ts                 Seeds 4 example stores with starter products
src/middleware.ts               Resolves which store a request is for
                                (subdomain/custom domain/?store= override)
                                and forwards it as a header — no DB access
                                here (Edge runtime); see store-context.ts
src/lib/store-context.ts        getCurrentStore()/requireCurrentStore() —
                                the actual DB lookup, cached per request
src/lib/store-branding.ts       Normalizes a Store's JSON brand fields
                                (theme/nav/footerLinks/etc.) with defaults
src/lib/credentials.ts          Password hashing (scrypt) / API key
                                hashing (sha256) — shared with prisma/seed.ts
src/lib/platform.ts             createStore() — the store-creation logic
src/lib/platform-auth.ts        Bearer-token auth for /api/platform/*
src/lib/platform-schemas.ts     Zod schema for store-creation input
src/lib/store/                  Shared per-store business logic (used by
                                both actions.ts and api/agent/ routes) —
                                start here for any behavior change. Every
                                function takes a storeId (rule #11).
src/lib/store/activity.ts       logActivity()/listActivity() — the
                                recent-activity log (rule #12)
src/lib/store/settings.ts       updateStoreBrand() — a store editing its
                                own brand fields (name/brief/theme/etc.)
src/lib/store/public.ts         toSafeStore() — the allow-listed Store
                                shape returned by any agent-facing route,
                                never the credential-hash fields
src/lib/store/mockups.ts        generateProductMockups() — renders a design
                                on the garment colors it reads well on
src/lib/design/palette.ts       Design palette extraction (opaque pixels
                                only) + WCAG contrast scoring of a design
                                against garment colors
src/lib/fulfillment/            Pluggable POD provider interface + Printful
                                impl — each call takes the calling store's
                                own provider credentials
src/lib/agent-auth.ts           Bearer-token auth for /api/agent/*, checked
                                against the resolved store's own key
src/app/api/agent/              JSON API surface for agents, store-scoped
                                (see docs/AGENT_API.md)
src/app/api/platform/           Store-creation API (see docs/AGENT_API.md)
src/app/admin/                  Human dashboard for one store at a time —
                                thin UI over src/lib/store/
src/app/                       Storefront pages (home, products, cart,
                                checkout...), all store-scoped
docs/AGENT_API.md              Full reference for the agent + platform API
skills/pod-platform-agent/    Same reference, packaged as a Skill for an
                                external agent harness (kept in sync with
                                docs/AGENT_API.md — see rule #3)
```

## Before you finish a change

- If you touched pricing, inventory, products, collections, or orders:
  does `src/lib/store/` still have one function per operation, scoped by
  `storeId`, called by both the human action and the agent route?
- If you added a capability an agent would want (a new mutation, a new
  piece of store state worth reading), is there an `/api/agent/*` route
  for it, documented in `docs/AGENT_API.md`?
- If you added a new model or a store-specific field: does it have (or
  live under something with) a `storeId`, and is every query on it scoped?
- Did the mutation log an activity entry (rule #12), with the right actor?
- Is the new capability shaped like a future MCP tool — one action, one
  zod-validated input, no browser-session dependency (rule #13)?
- Did you run `npm run lint` and `npm run build`?
