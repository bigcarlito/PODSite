# Wildline Supply Co. — Print-on-Demand Storefront

A simple, functional ecommerce site for print-on-demand products, built with
Next.js (App Router), Tailwind CSS, and Prisma/PostgreSQL. Structured to
mirror the layout of a lean, single-category apparel POD store (home →
collections → product → cart → checkout).

## Stack

- **Next.js 16** (App Router, TypeScript, Server Actions)
- **Tailwind CSS 4** — mobile-first responsive design
- **Prisma + PostgreSQL** (designed for a Railway-hosted database)
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
`ADMIN_PASSWORD` in `.env`).

## Environment variables

See `.env.example`:

- `DATABASE_URL` — your Railway Postgres connection string
- `PRINTFUL_API_KEY` — only needed to sync catalog / submit orders to Printful
- `ADMIN_PASSWORD` / `ADMIN_SESSION_SECRET` — gate for `/admin`

## Deploying to Railway

1. Create a new Railway project (or use your existing one with the empty
   Postgres database already provisioned).
2. Add a new service from this GitHub repo.
3. Set the service's environment variables: `DATABASE_URL` (reference your
   Postgres service's variable), `PRINTFUL_API_KEY`, `ADMIN_PASSWORD`,
   `ADMIN_SESSION_SECRET`.
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
src/lib/fulfillment/         Pluggable POD provider interface + Printful impl
src/lib/cart.ts              Cookie-based cart session helpers
src/app/                     Storefront pages (home, products, collections,
                              cart, checkout, about, contact, policies, search)
src/app/admin/                Password-gated order/product dashboard
```

## Roadmap / not yet implemented

- Payment collection (Stripe) at checkout
- Customer accounts / order history by login
- Additional fulfillment providers (Gelato, Printify) + price comparison
- Full admin CRUD for products/variants/images (currently seed-script driven)
