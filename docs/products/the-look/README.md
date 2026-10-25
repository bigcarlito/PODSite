# The Look — inactive owner-review product

**Mockup completion update:** Five color-specific PODSite composites are now
attached, with Ivory primary. See [the completed pipeline and review instructions](MOCKUP_PIPELINE.md)
and `mockup-receipt.json`. `review.html` and the screenshots have been refreshed.
Printify access is still needed for supplier catalog/cost verification, **not for
mockup generation**. The remaining sections below retain the original draft-stage
record; their zero-mockup/login-blocker statements describe that earlier state.

**Real database draft created:** `cmvnb5ci00007xcukkw33n8pj`.
[Open product in ShihTshirts admin](https://shihtshirts.com/admin/products/cmvnb5ci00007xcukkw33n8pj).
Admin authentication is required. This is an actual product row, not just a listing brief.
The original creation used the existing configured PODSite database connection.
No merge or deployment was performed.

Open `review.html` from this checkout for the local, interactive owner-review page.
`review-desktop.jpg` and `review-mobile.jpg` show the reviewed artifact. It is a local
presentation of the draft, not a newly deployed storefront route. Color/size selection
works, with no cart or checkout action. It is labeled noindex and unpublished.

## Persisted state and tenant safety

- Store domain: `shihtshirts.com`; actual database slug: **`shihtshirt`** (singular).
- Product is inactive and not featured. All **35 planned** combinations of five
  owner-selected colors and seven catalog-wide sizes are unavailable (`inStock:false`).
- Provider is `PRINTIFY`; every `providerVariantId` is absent. These are planned
  merchandising choices, **not verified supplier variants or inventory**.
- One attached image is an approved-artwork preview, explicitly labeled as artwork.
  It is not a supplier mockup. Supplier mockup count: **zero**. Lifestyle image: absent.
- Explicit tenant theme policy: `checkoutEnabled:false`, `fulfillmentMode:"manual"`.
  Existing accent/theme keys were preserved. The singular actual slug does not match
  PR #47's plural default slugs, so an explicit policy was necessary.
- Existing shared `updateStoreBrand`, `uploadStoreAsset`, `createProduct`, and
  `logActivity` operations were used. No schema, app routes, provider defaults,
  other tenant settings, credentials, or global mockup scenes changed.
- The API model still supports generic option names and per-variant providers.
  Using product type `comfort-colors-1717` avoids overwriting a tenant's generic
  `tshirt` scene or another garment's color lineup.
- Creation and review blockers are recorded in ShihTshirts activity. SEO proposal
  was recorded there as review data, not misrepresented as live metadata.

`draft-receipt.json` records the read-back state. The public product page should
404 while inactive. Owner review uses admin or the local artifact, never temporary
activation. No order, payment, Printify product, supplier submission, or publication
was made.

## Artwork quality

Both approved source files are untouched; SHA-256 checks are in `artwork-quality.json`.
Visual comparison confirms the vintage-style Shih Tzu and both text lines:
**THE LOOK** / **IF YOU KNOW, YOU KNOW**. No AI replacement, cleanup, or lettering
change was performed.

| File | Canvas | Fully transparent pixels | Partial alpha pixels | Opaque pixels |
|---|---|---:|---:|---:|
| Original | 1,293 × 1,217 | 568,202 | 1,005,040 | 339 |
| Approved upscale | 4,221 × 3,973 | 6,971,798 | 565,607 | 9,232,628 |

The upscale has genuine alpha, not a flattened background. Its nonzero-alpha
artwork bounds are 3,545 × 3,963 px. That gives about **295 DPI at 12 inches of
visible artwork width**, or **300 DPI at 11.8 inches**. The full canvas is wider
because of transparent side margins. Metadata says 72 DPI; pixel dimensions and
actual placement size determine effective print resolution.

Propose 11.8-inch visible width (about 13.19-inch visible height), **subject to the
chosen provider's actual print area**. Do not stretch or crop the design to force
that size. Upscaling does not prove new source detail: fine hair, distressed text,
alpha edges, and top-edge placement need supplier preview and a physical sample.
The resized database image is for viewing, not the production print file.

## Supplier evidence and blockers

[Printify's public 1717 catalog](https://printify.com/app/products/706/comfort-colors/unisex-garment-dyed-t-shirt)
identifies Comfort Colors 1717, relaxed fit, heavyweight 6.1 oz fabric, pre-shrunk
ring-spun US cotton, and an overall S–4XL size guide. The garment blueprint URL is
706. **This does not verify each selected color/size or a particular print provider.**
The requested color labels are Ivory, Blossom, Butter, Bay, and Espresso. Their
exact provider-side spelling, stock, IDs, production costs, and shipping quotes
are not yet verified. `review-data.json` leaves those facts null instead of guessing.
The review swatches are explicitly approximate screen colors, not color standards.

No Printify token was found in the configured PODSite environment. The connected
Chrome session was not signed into Printify; the catalog's **Details** action
redirected to login. No tenant mockup scene/base images exist in this database.
Therefore authentic five-color garment mockups and a lifestyle image could not be
produced safely. The five previews are **color contrast studies**, not shirts or
supplier mockups. No generated garment has been substituted.

PODSite's product database is independent of Printify, so no Printify-side product
is required for this store draft. An **unpublished** Printify product is a practical
way to obtain authentic placement proofs/mockups. PODSite's current fulfillment
registry only implements Printful; the PRINTIFY enum alone does not enable automated
fulfillment. Keep manual mode. Do not add an adapter as part of this product task.

### Exact owner inputs/actions needed

1. Sign into Printify in the waiting browser tab, or configure a scoped token
   through a secure environment variable. For catalog inspection, `catalog.read`
   is sufficient; `shops.read`/`products.read` are relevant for existing drafts.
   Do not provide `orders.write` for this task. If creating an unpublished Printify
   draft for mockups, use the correct shop and grant only the necessary product/
   upload scopes. Never invoke publish or order-submission endpoints.
2. Confirm a print provider (or Printify Choice), destination country/region/postcode,
   shipping method, and whether the account has Premium. These materially affect
   color availability and cost; none has been assumed.
3. Retrieve the blueprint's providers and the chosen provider's exact variants and
   shipping table. The documented read endpoints are:
   `GET /v1/catalog/blueprints/706/print_providers.json`,
   `GET /v1/catalog/blueprints/706/print_providers/{id}/variants.json?show-out-of-stock=1`,
   and `GET /v1/catalog/blueprints/706/print_providers/{id}/shipping.json`.
   Match the five color names and sizes exactly, preserve stock status, and record
   IDs, front-print cost for each variant, plan/currency, first/additional shipping,
   surcharges, and the timestamp. Use authenticated price evidence; do not treat
   public "from" pricing as the cost of all 35 combinations.
4. Upload the **approved upscaled file**, preserve its aspect ratio, and confirm
   actual front print placement. Export authentic mockups for each of the five
   colors. Optional lifestyle imagery must be traceable to an existing supported
   workflow and labeled accurately.
5. Review those proofs and the final price/margin matrix. Update **only this
   product** through existing store-scoped product/variant operations: replace
   planned options with verified combinations, supply real IDs, and attach actual
   mockups. Use the existing per-color mockup workflow only with verified matching
   base images and the garment-specific scene. Do not mark availability true yet.
6. Approve copy, garment sample/print quality, shipping/tax/customer-service readiness,
   and publishing separately. This task does not authorize enabling checkout.

Reference: [Printify API authentication, catalog and scopes](https://developers.printify.com/).
Directory CLI was unavailable and its documentation fetch returned an unsupported
content-type error; supplier research used Printify's own catalog and API docs.

## Retail and margin proposal

| Planned sizes | Proposed USD retail | Production cost ceiling for illustrative 25% contribution target |
|---|---:|---:|
| S–XL | $32.00 | $17.74 |
| 2XL | $35.00 | $19.90 |
| 3XL–4XL | $38.00 | $22.06 |

**These are proposed prices and cost ceilings, not verified margins.** Ceiling
calculations assume seller-paid **$5 shipping** and a hypothetical **3% + $0.30**
payment fee, with no discount, tax expense, refunds, subscription allocation, ads,
or overhead. Neither shipping nor fees are claimed as account-specific quotes.
Ceiling = retail − illustrative shipping − illustrative fee − 25% of retail.

At $32 retail, the illustrative fee is $1.26:

| Hypothetical production | Illustrative shipping | Contribution before overhead | Contribution / retail |
|---:|---:|---:|---:|
| $14.00 | $5.00 | $11.74 | 36.7% |
| $18.00 | $5.00 | $7.74 | 24.2% |
| $22.00 | $5.00 | $3.74 | 11.7% |

Actual contribution = retail + customer shipping collected − production − supplier
shipping − payment fees − other variable costs. Replace all hypothetical inputs
with verified evidence and recompute per variant before approving prices.

## SEO and existing-platform limits

The proposed title, description, canonical URL, and draft robots policy live in
`review-data.json`. The product title is saved to the real product. The existing
storefront uses that title but has no per-product description/canonical fields.
The offline review HTML includes the proposed metadata with noindex/nofollow.
No SEO platform work was added. Do not claim the SEO description is live.

## Reproduce and validate

From this repository checkout:

```powershell
npm.cmd ci --cache .local/npm-cache
node --conditions=react-server --import tsx scripts/shihtshirts-the-look.ts
node scripts/build-the-look-review.mjs
node --import tsx --test tests/*.test.ts
node node_modules/tsx/dist/cli.mjs --test tests/*.test.ts
npm.cmd run lint
npm.cmd run build
```

The creation script defaults to schema/hash validation and writes the 35-variant
API payload to ignored `.local/the-look-api-payload.json`. `product.json` is the
editorial recipe; its empty variants are expanded by the script, never imported
directly. The authorized creation was run with `--apply` and a securely configured
DATABASE_URL, using Node `--env-file` to load the existing local configuration.
Do not commit that environment file. An existing product is not overwritten.

Validation results:

- Both standard test commands: **3 passed, 0 failed**, no preload. Also verified
  through the Bridge's selected MXC runtime (`2993767bd1dfb009`) and cleaned
  environment. The deliberate failure probe still exits 1.
- Lint: passed.
- Standard build: restricted run failed fetching existing Google Fonts; network-
  enabled retry hit a Turbopack internal PostCSS worker startup panic. These are
  retained failures; no application source was changed to hide them.
- `npm.cmd run build -- --webpack`: **passed**, including TypeScript and route
  generation. Cache restoration warnings occurred. No lockfile/dependency upgrade.
- Locked install reported **8 existing vulnerabilities** (7 high, 1 critical).
- Schema/hash dry run: 35 unavailable variants, inactive product, no supplier IDs.
- Database read-back: inactive product, 35 unavailable PRINTIFY variants, 0 IDs,
  one artwork image, explicit closed/manual policy, review activity recorded.
- Visual review: desktop 1440px and mobile 375px; selected Espresso/2XL updates
  background and proposal to $35, purchase button remains disabled; images load.
  This covers the local artifact, not authenticated live admin or supplier proofs.
- Git index corruption was encountered in this disposable checkout. Its index was
  backed up and rebuilt from HEAD without changing working files; approved artwork
  hashes remain unchanged.

The draft is reviewable but **not ready for final publishing approval** until the
supplier and sample blockers above are resolved.
