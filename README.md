# POD Platform — Multi-Store Print-on-Demand

A platform for running multiple print-on-demand storefronts from one
Next.js app and one database. A store is a database row (`Store`), not a
deployment — creating a new one is a single API call, not new
infrastructure. Built with Next.js (App Router), Tailwind CSS, and
Prisma/PostgreSQL.

## Designed to be run by AI agents

This platform is built around a specific goal: an AI agent should be able
to create a new store from a brand brief, then read and manage that
store's full state — products, pricing, inventory, orders — without ever
opening a browser. See **[`AGENTS.md`](./AGENTS.md)** for the design
principles this codebase follows, and **[`docs/AGENT_API.md`](./docs/AGENT_API.md)**
for the full reference to:

- `POST /api/platform/stores` — create a new store from a brand brief
  (name, tagline, tone, audience, theme colors), returning that store's
  admin password and agent API key once
- `/api/agent/*` — per-store JSON API (products, collections, orders,
  fulfillment, and a `/api/agent/summary` snapshot built for "what should
  I optimize next?") for managing one store once it exists

If you're a coding agent working in this repo, read `AGENTS.md` first.

If you run your own AI agent/harness (outside this repo) and want it to
create and manage stores on this platform, load
**[`skills/pod-platform-agent/`](./skills/pod-platform-agent/SKILL.md)**
into it — a condensed, harness-portable version of the same API
reference, kept in sync with `docs/AGENT_API.md`.

## How multi-tenancy works

One app, one Postgres database. Every table except `Store` has a
`storeId`. A request is routed to a store by:

- **Production**: the subdomain (`first-available.yourdomain.com`) or an
  exact custom domain, resolved in `src/middleware.ts` /
  `src/lib/store-context.ts`.
- **Local dev** (no real subdomains): a `?store=<slug>` query param
  (remembered in a cookie so it survives redirects), or the `DEV_STORE_SLUG`
  env var as a fallback.

Branding — name, tagline, description, theme accent color, nav links,
footer links, trust badges, social links — lives on the `Store` row as
JSON fields (see `src/lib/store-branding.ts`), not in code, so the same
codebase renders as completely different brands per store.

## Stack

- **Next.js 16** (App Router, TypeScript, Server Actions)
- **Tailwind CSS 4** — mobile-first responsive design
- **Prisma + PostgreSQL** (designed for a Railway-hosted database)
- **Platform API** (`src/app/api/platform/`, gated by `PLATFORM_API_KEY`) —
  creates new stores
- **Agent API** (`src/app/api/agent/`, gated by each store's own agent
  API key) — the machine-callable surface for managing one store, backed
  by shared logic in `src/lib/store/` that the human `/admin` dashboard
  also calls
- **Pluggable fulfillment layer** (`src/lib/fulfillment/`) — Printful is
  implemented now; each store may hold its own Printful credentials.
  Gelato/Printify can be added later by implementing the same
  `FulfillmentProvider` interface and registering it in `registry.ts`.
- Payments are **not** wired up yet — checkout records the order for
  fulfillment without charging a card (see `src/app/checkout/actions.ts`).

## Local development

```bash
npm install
cp .env.example .env   # fill in DATABASE_URL at minimum
npm run db:migrate:dev # creates tables from prisma/schema.prisma
npm run db:seed        # seeds 4 example stores with starter products,
                        # and prints each store's admin password + agent
                        # API key to the console
npm run dev
```

Visit `http://localhost:3000` (serves the store named by `DEV_STORE_SLUG`
in `.env`, default `wildline`). Browse a different seeded store locally
with `?store=<slug>` — e.g. `http://localhost:3000/?store=first-available`.
Try the agent API:

```bash
curl -H "Authorization: Bearer <that store's agent API key from db:seed output>" \
  "http://localhost:3000/api/agent/summary?store=first-available"
```

Create a new store:

```bash
curl -X POST -H "Authorization: Bearer $PLATFORM_API_KEY" -H "Content-Type: application/json" \
  -d '{"slug":"test-store","name":"Test Store","tagline":"...","description":"..."}' \
  http://localhost:3000/api/platform/stores
```

## Environment variables

See `.env.example`:

- `DATABASE_URL` — your Railway Postgres connection string
- `PRINTFUL_API_KEY` — fallback Printful key for any store that doesn't
  set its own `Store.printfulApiKey`
- `ADMIN_SESSION_SECRET` — signs human `/admin` sessions (every store has
  its own password; this one secret signs all of them)
- `PLATFORM_API_KEY` — gates `POST /api/platform/stores`; generate with
  `openssl rand -hex 32`
- `ROOT_DOMAIN` — the domain stores are subdomains of in production
  (unset in local dev)
- `DEV_STORE_SLUG` — which seeded store to serve locally with no
  subdomain to read

Each store's own admin password and agent API key are generated when the
store is created (via `db:seed` or `POST /api/platform/stores`) — they
aren't environment variables.

## Deploying to Railway

1. Create a new Railway project (or use your existing one with the empty
   Postgres database already provisioned).
2. Add a new service from this GitHub repo.
3. Set the service's environment variables: `DATABASE_URL` (reference your
   Postgres service's variable), `PRINTFUL_API_KEY`, `ADMIN_SESSION_SECRET`,
   `PLATFORM_API_KEY`, `ROOT_DOMAIN`.
4. Set the build command to `npm run build` (this runs `prisma generate`
   automatically) and start command to `npm run start`.
5. Run migrations once against the Railway database:
   ```bash
   railway run npm run db:migrate
   railway run npm run db:seed   # optional: seeds 4 example stores
   ```
6. In Railway, add a wildcard custom domain (`*.yourdomain.com`) pointed
   at this service, matching `ROOT_DOMAIN`, so every store's subdomain
   resolves automatically — no per-store domain setup needed.
7. Deploy. Create stores going forward via `POST /api/platform/stores`
   rather than editing the seed script.

## Project structure

```
prisma/schema.prisma          Data model — Store is the tenant boundary;
                                everything else has a storeId
prisma/seed.ts                 Seeds 4 example stores with starter products
src/middleware.ts               Resolves which store a request is for
src/lib/store-context.ts        getCurrentStore()/requireCurrentStore()
src/lib/store-branding.ts       Normalizes a Store's JSON brand fields
src/lib/credentials.ts          Password/API key hashing
src/lib/platform.ts             Store-creation logic
src/lib/platform-auth.ts        Bearer-token auth for /api/platform/*
src/lib/store/                  Shared per-store business logic (used by
                                both admin actions.ts and agent API routes)
src/lib/fulfillment/           Pluggable POD provider interface + Printful impl
src/lib/agent-auth.ts           Bearer-token auth for /api/agent/*
src/app/api/platform/           Store-creation API
src/app/api/agent/              Per-store agent API (see docs/AGENT_API.md)
src/app/admin/                  Human dashboard for one store at a time
src/app/                       Storefront pages (home, products, cart,
                                checkout, about, contact, policies, search)
AGENTS.md / CLAUDE.md         Conventions for agents (and humans) working
                                in this codebase — read this first
docs/AGENT_API.md             Full reference for the agent + platform API
skills/pod-platform-agent/    Same reference, packaged as a Skill for an
                                external agent harness
```

## Roadmap / not yet implemented

- Payment collection (Stripe) at checkout
- Customer accounts / order history by login
- `PATCH /api/platform/stores/:id` — updating a store's branding after
  creation (today: create-time only, or a direct DB update)
- Additional fulfillment providers (Gelato, Printify) + price comparison
  (the `ProviderQuote` table exists in the schema but nothing populates it
  yet)
- Fetching a live Printful catalog through the agent API directly
- Bulk operations in the agent API (batch price updates, bulk import)
