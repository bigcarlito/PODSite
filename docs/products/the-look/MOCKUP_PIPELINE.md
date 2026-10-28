# The Look — completed PODSite mockups

Five 1,000 by 1,250 mockups are persisted at the URLs in `mockup-receipt.json`: **Ivory, Blossom, Butter,
Bay, and Espresso**. They are also attached to the existing inactive product
`cmvnb5ci00007xcukkw33n8pj`, with Ivory first. The artwork-only image is retained
after the five color images. All 35 variants, prices, supplier placeholders and
availability flags are unchanged. Checkout remains closed/manual.

## Existing system, reused

1. `MockupScene` is keyed by `(storeId, productType)`. Its `imageUrl` is a reference
   blank; `colors` names the options; `baseImages` maps each color to a blank asset;
   `designArea` stores fractional x/y/width/height placement. Binary bytes live in
   tenant-owned `StoreAsset` rows, served by `/api/assets/:id`.
2. `setMockupScene`, `setMockupSceneBaseImage`, and `setDesignArea` already have
   authenticated admin/agent surfaces. Uploaded photography is supported directly.
   The optional OpenRouter path recolors a scene when a base is missing. **That
   path is not used for this product.**
3. `generateAIProductMockups` reads the product through `getProductById(store.id, id)`,
   collapses all sizes into one render per color, and calls the existing
   `compositeDesignOnScene` in `src/lib/design/compositor.ts`.
4. Sharp scales the original transparent artwork with `fit:"inside"`, without
   enlargement or aspect-ratio distortion; centers it inside the rectangle; blends
   at the existing 85% opacity; and writes JPEG at quality 90. Original pixels/files
   are never regenerated. This is an optical mockup: base fabric lighting remains,
   but no displacement-map or cloth-warp simulation exists. No such capability is claimed.
5. Rendered bytes are stored as this tenant's `ai-mockup` assets. `ProductImage`
   rows carry `{ "color": "Ivory" }` etc. in `optionValues`, so all sizes of a
   color share the matching image. `Gallery` changes its active image when
   `ProductPurchasePanel` receives a color selection. No provider variant ID is
   needed for this local scene path, unlike the separate Printful mockup-generator path.
6. Existing entries for rendered colors are replaced; unrelated gallery entries
   remain. The new opt-in primary-color selection places Ivory before the retained
   artwork preview. Queries used for gallery replacement include the product and
   tenant relation. No other products or stores are modified.

## Source photographs and reusable configuration

The five unbranded blank files and their source/hash manifest are under
`public/mockup-templates/comfort-colors-1717/`. They are front-view catalog images
from [S&S Activewear's Comfort Colors 1717 listing](https://www.ssactivewear.com/p/comfort_colors/1717).
The listing explicitly labels the garment and color choices; source color IDs:
Ivory **47202**, Blossom **47186**, Butter **47188**, Bay **47184**, Espresso **104178**.
These are **image catalog identifiers, not Printify variant IDs**.

The source bytes are stored unchanged and SHA-256 recorded. No shirt is recolored,
no generic garment substituted, and no supplier mockup-generation endpoint called.
The existing Printful catalog connection was inspected during source investigation,
but its model photos had inconsistent framing. Its grayscale tint templates were
not used. The manufacturer's Digital Asset Portal requires login. S&S front blanks
provided the matched set used here.

The source set is reusable: it contains no ShihTshirts artwork, tenant IDs, or brand
copy. A future store imports these files into its **own** scene and base-image
records with the existing upload operations. Product composites and their asset
records stay tenant-specific. Do not reuse Bird Nerd's scene or branded composites.
The existing Bird Nerd `tshirt` configuration is not labeled Bella+Canvas 3001 and
is not evidence of a 3001 template.

Input format: PNG/JPEG/WebP, maximum 8 MB per uploaded blank. A PSD must be flattened.
Same dimensions and front framing across a set allow one reusable rectangle. The
source `hex` values are sampled photo RGB guides for UI swatches, not physical dye
standards. Photograph lighting and garment-dye batch variation remain real-world
limits; these images are reviewable mockups, not proof of the supplier's final print.

All five use `{x:0.325,y:0.205,width:0.35,height:0.264}`. This is a 350 × 330 pixel
placement box at x=325, y≈256 in the original frame. Actual artwork canvas fits at
350 × 329 pixels, without clipping/stretching. Transparent margins and fine text
are preserved. Production placement in inches still needs the chosen supplier's
actual print-area approval; do not infer physical dimensions from catalog photography.

## Small reusable improvements

`existingBasesOnly:true` rejects missing/invalid base URLs before rendering and
never invokes AI recoloring. `primaryColor:"Ivory"` puts that rendered image first,
retains other images and their color associations, and refuses gallery replacement
if the requested primary fails. Retained same-origin asset URLs are made relative
for Next Image compatibility. Defaults retain existing behavior for other callers.
Both options are available through the existing agent endpoint and admin form;
AGENTS.md, the API reference and the agent skill are updated together.

## Reproduce

```powershell
node --conditions=react-server --import tsx scripts/shihtshirts-the-look-mockups.ts
```

The default performs a hash-checked local render with the existing compositor and
does **not** access the database or providers. It writes the five files and
`mockups/render-manifest.json`. The completed database import used `--apply` with
the existing database configuration loaded securely through Node `--env-file`.
The script checks the exact domain, tenant and product, requires inactivity,
35 unavailable variants with absent supplier IDs, and closed/manual commerce.
It refuses to overwrite an existing scene blindly. For later regenerations, inspect
the already configured scene and use the normal authenticated endpoint:

```json
{
  "designUrl": "https://shihtshirts.com/api/assets/cmvo6opmd0015xcm87tkol15k",
  "colorOptionName": "color",
  "colors": ["Ivory", "Blossom", "Butter", "Bay", "Espresso"],
  "existingBasesOnly": true,
  "primaryColor": "Ivory"
}
```

Route: `POST /api/agent/products/cmvnb5ci00007xcukkw33n8pj/mockups/ai`, authenticated
with ShihTshirts' own agent key. The new options need deployment before the live
API/admin UI accepts them; **the product images already exist**, because the local
operation used the same shared function against the configured database. No app
deployment was performed. Do not paste an agent key into source or this document.

`mockup-receipt.json` contains the persisted asset URLs and color associations.
Each of the five public asset responses was fetched and SHA-256 matched against
the local compositor output. The approved 23 MB master was uploaded unchanged via
the existing 32 MB derived/master asset allowance; the originals remain intact.

## Validation and review

The automated regression fixture uses a fully fake persistence client and disallows
provider fetches. It checks missing/invalid bases, invalid or failed primary color,
one render per color, preservation of other images, tenant-scoped access, and actual
alpha/aspect-ratio behavior of the existing compositor. Standard Node and tsx CLI
test commands run the fixture without a userInfo preload.

The standard Turbopack build still encounters the previously observed internal
PostCSS worker startup panic. The supported webpack build is checked separately;
this is not recorded as a passing standard build. No dependency or engine change
was made to compensate for that environment failure.

Both standard test commands passed: four top-level tests, including seven isolated
mockup regression cases. Lint and `npm run build -- --webpack` passed. The local
review was checked at 375, 768 and 1440 pixels: all five mockups loaded, color
selection changed the hero image, and purchase stayed disabled, without overflow.
The authenticated admin gallery on the local production build also loaded all six
persisted images and switched Ivory/Espresso correctly. Screenshots are saved as
disposable admin screenshots (removed from Git). The existing admin navigation
overflows on mobile; the new gallery fits its container and scrolls its thumbnails.
No unrelated admin layout refactoring was included.

Owner review: inspect the five color images, approve print scale/placement and
copy, then resolve Printify catalog IDs, availability, costs and shipping separately.
No Printify mockup access is required. Product publication, checkout, supplier orders,
and deployment remain outside this task.

## Durable generated mockups

Generated scene mockups use the existing PostgreSQL `StoreAsset` byte storage,
not a filesystem or a new bucket. Configure the existing `DATABASE_URL` against
persistent PostgreSQL with backups; no new storage credentials or migration are
required. New mockup IDs encode tenant, product and exact color as lossless hex
segments followed by a random UUID. Product ownership is checked before upload.
URLs remain immutable `/api/assets/<id>` public image capabilities; public reads
are deliberately unauthenticated and must never contain private data.

The five existing The Look color URLs and ProductImage IDs in
`mockup-receipt.json` are unchanged. Their database bytes were already persisted
by PR #48; removed JPEGs and screenshots were duplicate local review exports.
Original/upscaled art and all reusable CC1717 templates remain tracked unchanged.
No live database inspection or mutation is part of this cleanup.

Lifecycle: save bytes before attaching ProductImage references. Regeneration
creates new assets and only replaces successful colors; failed renders retain
old references. Unattached uploads and superseded assets are handled by existing
store-scoped orphan cleanup, dry-run by default. Never run destructive cleanup
as part of rollout; inspect references and backups first. Database backups must
include StoreAsset bytes. Local receipts alone are not cleanup retention roots.

Rollout: deploy normally after validation, with the same persistent database.
No asset migration or regeneration is necessary. Manual verification by an
operator: open each of the five recorded URLs, compare the hashes in
`mockups/render-manifest.json`, verify Ivory first and all five color associations
in the inactive product gallery, then repeat after restart/redeploy. Missing
assets must return JSON 404, never an artwork fallback. This verification was
not run against production in this task.

`node scripts/build-the-look-review.mjs` rebuilds the tracked review HTML using
persisted URLs (including swatch changes), failing if a receipt color is missing.
`node --conditions=react-server --import tsx scripts/shihtshirts-the-look-mockups.ts`
creates optional local composites only under ignored `.local/the-look/mockups`.
Its historical `--apply` path is for explicit operator use only, refuses existing
scenes and is not a migration command. Do not run it for this rollout.
Screenshots belong in ignored `.local` or ignored review exports, never Git.
