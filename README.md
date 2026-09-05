# Wildline Supply Co. — Print-on-Demand Storefront

A simple, functional ecommerce site for print-on-demand products, built with
Next.js (App Router), Tailwind CSS, and Prisma/PostgreSQL. Structured to
mirror the layout of a lean, single-category apparel POD store (home →
collections → product → cart → checkout).

## Designed to be run by AI agents

This store is built around a specific goal: everything a human admin can do
in `/admin`, an AI agent should be able to do too — read the store's full
state and make changes — without a browser. See **[`AGENTS.md`](./AGENTS.md)**
for the design principles this codebase follows, and
**[`docs/AGENT_API.md`](./docs/AGENT_API.md)** for the full reference to the
agent-facing JSON API at `/api/agent/*` (products, collections, orders,
fulfillment, and a `/api/agent/summary` snapshot built for "what should I
optimize next?" decisions). If you're a coding agent working in this repo,
read `AGENTS.md` first.

If you run your own AI agent/harness (outside this repo) and want it to
operate this store, load **[`skills/wildline-store-agent/`](./skills/wildline-store-agent/SKILL.md)**
into it — a condensed, harness-portable version of the same API reference,
kept in sync with `docs/AGENT_API.md`.

## Stack

- **Next.js 16** (App Router, TypeScript, Server Actions)
- **Tailwind CSS 4** — mobile-first responsive design
- **Prisma + PostgreSQL** (designed for a Railway-hosted database)
- **Agent API** (`src/app/api/agent/`, bearer-token authenticated) — the
  machine-callable surface described above, backed by shared logic in
  `src/lib/store/` that the human `/admin` dashboard also calls
- **Pluggable fulfillment layer** (`src/lib/fulfillment/`) — Printful is
  implemented now; Gelato/Printify can be added later by implementing the
  same `FulfillmentProvider` interface and registering it in `registry.ts`.
- Payments are **not** wired up yet — checkout records the order for
  fulfillment without charging a card (see `src/app/checkout/actions.ts`).

## Local development

```bash
npm install
cp .env.example .env   # fill in DATABASE_URL at minimum
npm run db:migrate:dev # creates tables from prisma/schema.prisma
npm run db:seed        # adds a few sample products
npm run dev
```

Visit http://localhost:3000. Admin dashboard is at `/admin` (password from
`ADMIN_PASSWORD` in `.env`). The agent API is live at `/api/agent/*` once
`ADMIN_API_KEY` is set — try:

```bash
curl -H "Authorization: Bearer $ADMIN_API_KEY" http://localhost:3000/api/agent/summary
```

## Environment variables

See `.env.example`:

- `DATABASE_URL` — your Railway Postgres connection string
- `PRINTFUL_API_KEY` — only needed to sync catalog / submit orders to Printful
- `ADMIN_PASSWORD` / `ADMIN_SESSION_SECRET` — gate for the human `/admin` UI
- `ADMIN_API_KEY` — bearer token for the agent API (`/api/agent/*`); generate
  with `openssl rand -hex 32`

## Deploying to Railway

1. Create a new Railway project (or use your existing one with the empty
   Postgres database already provisioned).
2. Add a new service from this GitHub repo.
3. Set the service's environment variables: `DATABASE_URL` (reference your
   Postgres service's variable), `PRINTFUL_API_KEY`, `ADMIN_PASSWORD`,
   `ADMIN_SESSION_SECRET`, `ADMIN_API_KEY`.
4. Set the build command to `npm run build` (this runs `prisma generate`
   automatically) and start command to `npm run start`.
5. Run migrations once against the Railway database:
   ```bash
   railway run npm run db:migrate
   railway run npm run db:seed   # optional sample data
   ```
6. Deploy. Railway will build and start the Next.js server.

## Project structure

```
prisma/schema.prisma        Data model (products, variants, cart, orders...)
prisma/seed.ts               Sample product data
src/lib/store/                Shared business logic (products, orders,
                              collections, summary) — used by BOTH the human
                              admin actions and the agent API, per AGENTS.md
src/lib/fulfillment/         Pluggable POD provider interface + Printful impl
src/lib/agent-auth.ts        Bearer-token auth for /api/agent/*
src/lib/cart.ts              Cookie-based cart session helpers
src/app/api/agent/            Agent-facing JSON API (see docs/AGENT_API.md)
src/app/                     Storefront pages (home, products, collections,
                              cart, checkout, about, contact, policies, search)
src/app/admin/                Password-gated human dashboard (thin UI over
                              src/lib/store/)
AGENTS.md / CLAUDE.md         Conventions for agents (and humans) working
                              in this codebase — read this first
docs/AGENT_API.md             Full reference for the agent API
skills/wildline-store-agent/  Same reference, packaged as a Skill for an
                              external agent harness
```

## Roadmap / not yet implemented

- Payment collection (Stripe) at checkout
- Customer accounts / order history by login
- Additional fulfillment providers (Gelato, Printify) + price comparison
  (the `ProviderQuote` table exists in the schema but nothing populates it
  yet — a natural next agent-facing feature)
- Fetching a live Printful catalog through the agent API directly
- Bulk operations in the agent API (batch price updates, bulk import)
