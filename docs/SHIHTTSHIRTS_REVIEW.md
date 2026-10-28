# ShihTshirts review and owner launch requirements

This change does not enable checkout, deploy, contact suppliers, or load data into a live store.
No approved Sammy/Bogey references or production art were available in this checkout (public contains only framework SVGs). No artwork was generated or represented as approved.

## Draft setup
Review `shihtshirts-brand-draft.json`; its payload can be applied with the existing authenticated PATCH /api/agent/store on the ShihTshirts hostname, retaining checkoutEnabled:false and fulfillmentMode:manual. Never apply to Bird Nerd. Theme replacement requires preserving existing keys. The visual slots are optional: absent artwork does not display fake imagery.
`shihtshirts-listing-drafts.json` contains five distinct unpublished editorial listing briefs with per-listing asset requirements. These are review artifacts, not API-create payloads: images and variants are deliberately empty because artwork, retail prices, supplier catalog IDs, sizes, colors and costs are unverified. Do not import as active products. Once verified, use the normal agent product API with isActive:false before owner review.

## Review instructions
In a disposable development database, resolve ShihTshirts with ?store=shihtshirts and apply the draft branding. Inspect home, products, product detail, collection, cart and checkout at 375px, 768px and 1440px. Supply approved hero/story/promos through the new slots; verify mobile source selection, image crops, readable copy, keyboard navigation and non-interactive overlays. Labels such as Popular require owner justification; they are never inferred sales claims. Repeat with Bird Nerd and confirm its branding, catalog and tenant-scoped API access remain separate.
Checkout must show the closed message and direct placeOrder calls must create neither order nor Stripe session. With a sandbox-only fixture, exercise signed paid/unpaid/wrong-tenant/wrong-total and replayed webhook events; PAID orders must appear in admin and agent orders/activity without any provider request in manual mode. Verify actual delivery and retry behavior before launch.

## Minimal owner launch blockers
1. Approve copy plus print-ready licensed artwork and matching garment mockups for each of the five drafts; provide desktop/mobile hero, optional promos/story/transparent dogs. No final creative direction is implied here.
2. Verify Bella+Canvas 3001 supplier catalog variants, available sizes/colors, costs and shipping; approve integer-cent pricing and margins. No supplier IDs are guessed.
3. In a separate Stripe sandbox, verify checkout, signed webhooks, amount/currency matching, replay handling and order visibility. Verify shipping destination/rates and tax treatment/registrations with owner review. Current checkout totals contain subtotal and shipping only; tax readiness is not established.
4. Assign an owner to monitor PAID orders and activity, manually fulfill, communicate tracking/delays and handle refunds. Supplier submission is blocked in manual mode; this sprint does not add an automated manual-order tracking workflow.

Only a separately authorized launch may enable public checkout. No real payment or supplier order should be used for this review. Database-backed and visual review require a disposable configured environment and are not claimed by local source/unit checks.

## ShihTshirts fixed boutique homepage

Only the exact tenant slug `shihtshirt` uses the six-section boutique homepage.
Other stores retain the existing homepage. No product, variant, mockup or commerce
policy is changed. The Look remains inactive and absent from public featured results;
Comfort Colors 1717 colors and durable StoreAsset references are untouched.

Use existing authenticated `PATCH /api/agent/store` with `theme.storefront.boutique`
for copy and visibility. Preserve the entire existing theme when patching (replacement,
not merge), especially `commerce: {checkoutEnabled:false, fulfillmentMode:"manual"}`.
No new endpoint, schema migration or page builder is needed. Existing storefront
`hero`, `eyebrow`, `shopLabel`, `featuredTitle` apply to this layout too.

Boutique fields: `heroTitle`, `heroText`, `personalityTitle`, `personalityText`,
`mascotsTitle`, `samiText`, `bogeyText`, `valueTitle`, `values` (up to three
`{title,text}` items), `finalTitle`, `finalText`, `finalLabel`, `emptyText`,
`featuredCount` (integer 1–12, default 4). `sami` and `bogey` accept
`{src,mobileSrc?,alt}` for approved photos only. `sections` accepts booleans
`hero`, `featured`, `personality`, `mascots`, `values`, `final`, default true.
Shop links always browse `/products`; they do not bypass availability or checkout.
Absent or failed images render honest text placeholders, with no invented dogs or listings.

### Homepage manual QA

Use a disposable local database only; do not apply settings to production.
1. Open `/?store=shihtshirt` at 375, 768 and 1440px. Check the six sections,
   wrapping, no horizontal overflow, tab focus, contrast and heading order.
2. With only inactive The Look, confirm the honest empty collection message and
   no product card or purchase control. In a disposable fixture, feature an active
   product in this tenant and one in another: only this tenant's active card appears.
3. Override copy/count/toggles through the existing settings API. Test approved hero
   and mascot images, mobile sources, missing images and deliberate 404 URLs; ensure
   placeholders appear and meaningful alt text is supplied for real imagery.
4. Visit Bird Nerd and another tenant in fresh sessions: confirm their original
   layouts and catalog remain unchanged. Confirm checkout remains closed for the
   ShihTshirts fixture and The Look remains inactive. Do not activate it for QA.

Database-backed browser QA requires a configured disposable database and remains a
manual follow-up; local unit tests do not establish visual or production readiness.
