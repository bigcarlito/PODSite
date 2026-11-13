# Design Factory bounded proof of concept

Local, typed manifest runner plus a human-directed admin review workspace for
ShihTshirts. No database migration, product creation, publication, or storefront
change. The seed is a concept exploration, not a controlled sales experiment.
The original runner never resolves an account or touches a tenant database;
the review UI and revision API authenticate against the manifest's store slug.

Inspection: existing `designs.ts` performs generation/QC/upscale and can publish;
`design-batches.ts` produces up to five Designs. The existing ImageProvider registry
and OpenRouter adapter support generation without those database/publish steps.
This proof of concept reuses that adapter directly, recording its exact raw prompt,
model and seed (if returned). The adapter may remove backgrounds and tighten crops.
Existing scene compositor and The Look mockup scripts remain separate, unchanged.
No new image API integration is introduced.

## CLI (from repository root, one runner per output directory)

```powershell
npm.cmd ci
node --import tsx scripts/design-factory.ts prepare .local/design-factory/the-look-01
# Inspect manifest.json and edit prompts if desired before spending credits.
# Only in an authorized environment with an existing configured OpenRouter key:
node --conditions=react-server --import tsx scripts/design-factory.ts generate .local/design-factory/the-look-01 google/gemini-2.5-flash-image
```

Prepare verifies the original artwork SHA-256 and refuses to overwrite a manifest.
Generation makes at most five calls (one per planned candidate), never retries or
upscales, checkpoints before and after each attempt, and exits nonzero on failures
or missing previews. An interrupted attempt remains generated without a preview:
inspect it manually. To deliberately retry, prepare a new run directory rather
than resetting history. Keep a single process per directory. Output is ignored
under `.local/design-factory`; archive the entire run folder to owner-controlled
durable storage when retaining evidence. It is not a hosted asset URL.

Without provider access, use prepare as the manual-first runner: give the saved
prompts to an authorized artist/tool, retain outputs in the run directory, and
record preview file, SHA-256, pixel dimensions and provenance method `manual`,
tool/model and raw parameters where known in manifest.json. Do not invent seeds
or claim a render exists when only a prompt exists. Validate edited JSON using
`factoryManifestSchema` before consuming it. These schemas/functions are reusable
from scripts; no browser session is required.

## Human review and remaining manual steps

All five styles (minimalist ink, vintage distressed, 1970s retro, contemporary bold,
hand-drawn boutique) begin pending and preview-only. Human review can record
`review.status` selected/rejected, `review.reviewer` and `review.notes` in the
manifest. Selection does not grant production readiness. This POC intentionally
has no print-ready transition and does not auto-select a winner.

Preserve `public/designs/shihtshirts/the-look.png` and its existing upscaled art;
the seed references and hashes the original, it is not passed as an edit reference.
Do not use competitor artwork as source material. Owner must verify rights,
originality, exact lettering, anatomy/expression, transparency, edge quality,
garment contrast, print dimensions/effective DPI, supplier template placement,
and a physical sample. Pixel size or automatic upscale alone is not print approval.
Use existing verified blank garment/mockup infrastructure only after selecting
art; mockups also remain previews. Production master preparation and any later
product creation need a separate explicit owner decision outside this runner.

## Verification / draft PR handoff

Run `node --import tsx --test tests/*.test.ts`, `npm.cmd run prisma:generate`,
`npx.cmd tsc --noEmit`, `npm.cmd run lint`, and `npm.cmd run build`.
Tests use a fake provider; no paid generation or production credentials are needed.
For the bridge's draft PR: title "Bounded ShihTshirts Design Factory POC";
include actual validation results and the manual steps above. The implementation
agent does not create PRs or access GitHub credentials in this checkout.

## Human-directed Factory review
Open `/admin/design-factory?store=shihtshirts` locally (use the manifest's actual
store slug); production uses the store's own host. Sign in as that store's admin.
Choose the local `the-look-03/manifest.json` and all referenced PNGs together.
Railway cannot read your workstation: the file picker imports bytes into this
browser session, verifies preview SHA-256 hashes, and rejects foreign-store briefs.
No local paths are fetched by the server. Maximum import size is 40 MB.

Select the existing Comfort Colors product-type scene in Garment. Configure its
actual blank color photographs and design rectangle through Mockup scenes first.
Only existing tenant assets appear; missing photographs are never synthesized.
Arrow keys or horizontal swipe on the preview cycle colors; buttons also support
keyboard and touch. Color selection remains while candidates/versions change.
Raw artwork uses a checkerboard. Browser alpha-over composition uses the same
placement fractions and 85% opacity as the server compositor. Review lettering,
contrast, opaque backgrounds and edges manually on every supported color.

Keep/Reject are human decisions stored in an exportable review document, never
product or publication actions. Export before leaving: there is no database
migration or durable server review store, browser autosave, or multi-user locking.
The export contains original prompts/provenance, PNGs, decisions, feedback,
rationale, preserved aspects and parent-child history (maximum 50 versions).
Treat uploaded artwork as private local review data; existing scene assets retain
the platform's existing public asset URL behavior.

Refine uses the configured OPENROUTER_TEXT_MODEL (text credits) server-side to
translate feedback and locked aspects into a complete precise prompt. It does
not generate an image. Inspect the rationale and export the review. After obtaining
separate permission to spend image credits, run from the checkout:

```
node --conditions=react-server --import tsx scripts/factory-review-generate.ts REVIEW_JSON VERSION_ID .local/design-factory/NEW_RUN MODEL --approve-paid-generation
```

Configure provider credentials on the server/CLI, never in browser code. This
command makes one ImageProvider generation attempt, with no retries, upscale,
product creation or publishing. It checkpoints the attempt and uses an exclusive
new output directory so rerunning the same command fails before another spend.
Reimport NEW_RUN/review.json to compare the child image with its parents. A new
directory is a new explicitly approved spend; no automatic budget estimate is
available. Revisions are standalone rerenders; visual preservation is a prompt
constraint, not a guaranteed image-to-image lock. Source files are never replaced.
Provider failures may still incur credits; preserve attempt.json and source-review.json.

### Optional in-browser generation
After reviewing a child prompt, the human may check the separate image-credit
approval and click Generate this version. The server operator must first set
`FACTORY_IMAGE_GENERATION_ENABLED=true`; it is disabled by default. Uses the
configured OPENROUTER_DESIGN_MODEL through ImageProvider. A tenant/version-unique
activity reservation is written before the paid call: repeated or concurrent calls
for that version cannot spend twice. Interrupted/failed versions remain reserved;
check logs before deliberately requesting a new refinement. A successful preview
is returned to browser memory and included in the next export; export immediately.
The CLI handoff remains available for local-only operation. No paid calls were
made during implementation or validation.

POST /api/agent/design-factory/generate offers the same single action for a human-
directed agent, with input {manifest, version, approvePaidGeneration:true} and output
{image: inline PNG, provenance:{provider,model,sha256,seed?,rawParams}}. It requires
store bearer authentication, matching manifest store, an ungenerated child version,
server enablement, and separate human approval. It never publishes or creates products.

### Placement review and production handoff
Placement is stored at versions[].placements[productType], schema version 1:
{version:1, scale:1, x:0.5, y:0.5}. x/y are the artwork center in normalized
garment print-area coordinates; scale multiplies aspect-preserving contain fit.
They are not photograph fractions or Printify API coordinates. Scene.area maps
the print area onto each photograph; native image alpha and 85% opacity remain.
Outside artwork is clipped to that area. No rotation, perspective correction or
transparent-border trimming is applied. Matching scene calibration across colors
is required. Until a provider area aspect ratio is configured and calibrated,
mockup appearance cannot certify physical production size.

Each version/garment retains an independent placement; colors share it. New
refinements inherit a copy. Copy fills only versions without an explicit placement;
reset affects only the current version/garment. Editing a Keep returns it to pending
(the prior decision remains in history); click Keep again to approve the new layout.
Old review files load with centered contain defaults. Reviews and placements remain
memory-only until downloaded. No localStorage, server persistence or source writes.

The pure placementLayout / placementStyle helpers in src/lib/design/placement.ts
define server geometry and equivalent browser containment. compositeDesignOnScene
accepts optional placement; omission preserves its existing rendering path.
productionPlacement requires explicit provider, printAreaId and pixel dimensions,
returning ready:false when absent. Review exports explicitly report production
not ready. This is coordinate metadata, never Printify submission parameters or
print-readiness approval. No dimensions are inferred from scene pixels.

Future separate mandatory pipeline: verify the approved review/version/source
hash and provider template identity, upscale artwork under separate approval,
render the same placement on a transparent full print-area PNG at the configured
provider dimensions (100% source opacity, no garment photo), then validate pixel
size, alpha, clipping, resolution/DPI, exact lettering, color and supplier rules.
Check that the upscaled aspect ratio matches the reviewed source. Block production
on absent configuration, changed source/template or failed validation. This task
does not implement or spend on that pipeline.

Manual test for current the-look-03 batch:
1. Start npm run dev, sign into the manifest's store and open
   /admin/design-factory?store=<manifest.brief.storeSlug>. Import the-look-03/manifest.json
   and every referenced PNG together. Hash checks must pass.
2. Select the configured Comfort Colors garment. Set Size to 75%, Horizontal
   center to 40%, Vertical center to 60% using touch and then keyboard arrows.
   Check all garment colors: artwork retains proportions and the same placement.
   At maximum size and each center limit, verify all visible ink stays inside the fixed boundary.
3. Toggle Raw artwork: the original full PNG must remain unchanged. Toggle back.
   Change candidate and return: the individual placement must remain.
4. Set another candidate's placement; return and Copy to versions without a
   placement. Verify that candidate's explicit values were not overwritten.
   Reset only the current placement; switch garments and verify independence.
5. Keep, edit a slider, verify pending, then Keep again. Export review, reload
   the page (session empties), and import only the exported JSON. Confirm images,
   provenance, history, decisions and placements match; production is not ready.
   Original manifest and PNG hashes on disk must remain unchanged.
6. Do not click Refine or Generate for this unpaid placement QA. Test a foreign
   store manifest: import must fail without replacing the current review.

Automated commands: npm ci; npm run prisma:generate; npm run lint;
node --import tsx --test tests/*.test.ts; npm run build; npx tsc --noEmit.
No database connection or migration is needed. Manual browser QA requires an
authenticated store with configured blank assets; it is separate from math tests.

## Scoped front canvas and calibration
Review exports optionally contain `printAreas`: profiles keyed by storeSlug,
productType, provider and printAreaId. These are local review data, not database
settings. Import rejects foreign tenant profiles. Agents/scripts can validate and
edit the same JSON with `printAreaProfileSchema`; no new API is introduced.

For ShihTshirts, select the actual Comfort Colors scene, enter the operator-known
print-provider identity, then prepare and apply the front preset: 4494 x 5097 px.
This user-supplied canvas does not establish provider identity, inches, DPI,
provider verification or production readiness. It is never a universal default.

`mockup` records the photograph's measured pixel dimensions. `mapping` is an
editable normalized calibration rectangle, initially x=.29, y=.24, width=.42,
height=.50: a provisional upper-chest-to-lower-torso calibration, not coordinates
copied from the schematic. `printBoundary` contains the canvas in that rectangle,
top aligned and horizontally centered, preserving its aspect in photograph pixels.
Edit the JSON to calibrate against the actual garment. Restore legacy boundary
removes the current profile; load/export JSON first to preserve earlier mappings.
Applying or removing geometry invalidates Keep. All colors share the profile.

Artwork is separately contained/scaled/translated inside canvas coordinates.
`printCanvasLayout` and `productionCanvasPlan` define the exact future PNG geometry;
production must use that layout on a transparent full-size canvas, never crop the
source to the print region or stretch it to fill the canvas. The plan clamps size and center using the same geometry as preview, including
nonzero-alpha bounds measured from the decoded PNG. Transparent padding may extend
outside the boundary; visible ink must not. Bounds are recomputed on import, never
trusted from JSON. Without measured alpha bounds the full image is conservatively
contained. Fully transparent images are rejected with guidance. No production PNG, upscale or supplier call is made
by these controls. Provider verification, physical dimensions, native resolution
validation and the existing production handoff remain required.

### Manual browser visual QA (required before approving calibration)
1. Open `/admin/design-factory` for ShihTshirts, import a review with verified PNGs,
   select the actual Comfort Colors garment and explicitly enter its print provider.
2. Prepare/apply the 4494x5097 front preset. Check the tall boundary begins at upper
   chest and extends toward lower torso on the actual blank. Adjust mapping JSON;
   the reference schematic is a proportion guide, not photographic coordinates.
3. Check tall artwork including bottom text; reduce scale/move up to leave lower
   transparent space. Confirm no text disappears and proportions stay unchanged.
4. Try each edge and enlarge: values must clamp without clipping visible ink.
   Reduce size to regain movement. Check raw artwork is unchanged.
5. Cycle every color with arrows/swipes, including mobile. Confirm identical
   placement and boundary; base photographs must share framing/aspect ratio.
6. Export/import and compare canvas, mapping, placement, lineage and decisions.
   Restore legacy boundary and verify prior unconfigured behavior. Check a different
   tenant/product/provider does not receive this profile. Production remains blocked.

This checkout's automated geometry tests do not substitute for this browser QA.

### Placement regression check with the-look-03 (local, unpaid)
Import the local The Look manifest and PNGs, select `the-look-03`, and apply your
existing tenant/garment/provider front profile. Keep the calibrated mapping and
4494x5097 canvas unchanged. At small, medium and maximum sizes, move horizontal
and vertical sliders to both ends using mouse, keyboard arrows/Home/End and touch.
Check the dog and both text lines stay inside the fixed dashed rectangle. Repeat
with an asymmetrically padded PNG; the image element is not the ink boundary.
Reduce size: sliders should gain travel without moving the artwork unexpectedly.
Cycle all colors and versions; explicit placements must remain independent. Export,
reload, import the review JSON and compare placements, mapping and lineage. Old
out-of-range placements become pending with clamped values; raw PNGs stay intact.
Do not click Refine/Generate or approve calibration/production during this check.
This procedure is documented for an authenticated local reviewer; it was not run
against a store or production database as part of the automated regression checks.

## Review workspace layout QA (2026-11-01)
The desktop workspace places a sticky, viewport-sized mockup on the left and
compact live placement controls on the right at widths >=768px. Canvas/provider
calibration is collapsed below the workspace. Smaller screens stack preview above
controls; short windows disable sticky positioning. Admin navigation wraps rather
than forcing horizontal overflow. Placement geometry and production logic are unchanged.

Manual browser QA checklist (not executed in this isolated checkout):
- At 1366x768, import a same-tenant review and PNGs. Scroll to the workspace;
  confirm the complete shirt and Scale/Horizontal/Vertical/Reset remain visible
  together. Open calibration and scroll: preview must stick without covering controls.
- Drag every slider continuously: artwork and percentage must move live; test
  limits with faint-alpha artwork and confirm the blue print boundary remains visible.
  Reset, copy only to unset versions, switch versions/colors and export/reimport;
  confirm placement persists and changed Keep decisions become pending.
- At 390x844 and 320x568, verify preview precedes controls, no horizontal overflow,
  readable labels and touch targets, native slider dragging and preview color swipes.
- Tab through controls; use arrow keys on sliders and separately on preview. Check
  focus rings, percent feedback, 200% zoom, short windows and expanded calibration
  for overlap/clipping. Verify Keep/Reject, feedback and Refine prompt preparation
  without approving paid image generation. Reject foreign-tenant imports.

Browser QA requires an operator's authenticated local tenant with garment assets;
no credentials or production database were accessed for this layout change.


### Factory photo print-area calibration
`GET /api/agent/design-factory/calibration` returns `{profiles}` for the resolved
store. `PUT` accepts one strict `printAreaProfileSchema` profile and returns that
saved profile. Bearer authentication is required. Fields: `storeSlug`,
`productType`, `provider`, `printAreaId` (side, e.g. `front`), `baseImageUrl`,
`mockup:{width,height}`, `canvas:{width,height}`, and normalized
`mapping:{x,y,width,height}`. The base URL must belong to this tenant's current
MockupScene for that product type. Changing/replacing a base URL requires a new
calibration. Profiles persist under Store.brief.factoryPrintAreas (no migration),
with serializable updates preserving other brief keys. Preserve this key when
replacing a store brief. Writes record the real actor in activity history.

The Factory UI edits a draft via eight pointer/touch handles, arrow keys
(Shift for larger steps), numeric fields, reset and cancel. Draft boundary edits
leave artwork fixed. Save and apply explicitly remaps artwork using unchanged
print-space placement and alpha containment; Keep is invalidated for re-review.
Photograph mapping may have a different aspect than the 4494x5097 print canvas;
the provider canvas and native visible-alpha bounds remain separate. Mapping is
an axis-aligned affine approximation, not a perspective homography. Review
export/import retains profiles, but importing does not silently write server
configuration. No generation, upscale, provider call or publishing is involved.

Local manual QA procedure (not a claim of completed browser QA): compare the
Comfort Colors 1717 front against the supplied Printify schematic: use a tall
front boundary below the collar and above the hem, adjusting photo coordinates
rather than inferring them from pixel canvas dimensions. Verify all eight handles
on desktop/touch, keyboard focus and arrow steps, narrow-screen stacking, color
cycling, cancel/reset, reload after save, tenant isolation, export/import, and
unchanged artwork while drafting. Then explicitly apply and re-review visible
ink on each calibrated color. Visual calibration alone verifies neither physical
print dimensions nor provider/garment identity, DPI or production readiness.
The schematic image is not present in this checkout; this procedure requires the
operator's supplied reference and real tenant photographs.

### Review studio control styling and discoverability
The studio uses a scoped CSS-module baseline for all form controls, buttons,
links, details and fieldsets. Tailwind v4/PostCSS and the global import are intact;
Preflight clears native control chrome, and the original studio supplied no
replacement for most buttons and fields (including everything outside workspace).
The fix supplies those missing component styles using the PODSite olive/cream
palette, with primary/destructive/disabled states and visible keyboard focus.
Provider identity is now beside placement, above **Edit Print Area**, with an
inline explanation of missing provider/photo or raw-preview prerequisites. The
advanced JSON panel is still available but is not required to open calibration.
No API, geometry, canvas, tenant persistence or generation behavior changes.

Local desktop/mobile manual QA (pending; not executed in this checkout):
1. Start `npm run dev` against an authorized local fixture database, sign into
   its fixture tenant and open `/admin/design-factory?store=<fixture-slug>`.
   Import the matching manifest/PNGs. Do not enable generation or call providers.
2. At 1440x900 verify the preview stays beside placement, primary olive buttons,
   bordered secondary buttons, red Reject, visible white input/select/textarea
   surfaces, readable fieldsets and separate import/export/review sections.
3. Tab through file picker, garment/colors, raw checkbox, provider, Edit Print
   Area, sliders, review and JSON controls. Verify focus rings, hover states,
   disabled contrast and explanations. Enter provider to enable calibration;
   raw view or an unloaded photograph must prevent opening it.
4. Open Edit Print Area without opening JSON. Verify eight handles with mouse,
   touch and arrow/Shift-arrow keys, numeric boundary fields, cancel/reset and
   explicit tenant-scoped save/reload. Draft edits leave artwork fixed; applying
   invalidates Keep. Verify the 4494x5097 canvas and alpha containment are intact.
5. Repeat at 390x844 and 320px width and 200% zoom: panels stack, controls wrap,
   inputs stay legible, no horizontal page overflow, handles remain usable.
   Cycle garment colors, reset/copy placement, Keep/Reject and export/reimport;
   confirm decisions, profiles and artwork survive. Do not spend model credits.

Rendered authenticated browser QA requires a local fixture tenant/database and
admin session, which are not supplied here. No credentials or production database
were accessed. These manual checks remain a handoff requirement for visual review.

### Keep → Draft Product handoff

A kept version with PNG bytes can create an inactive product through the Factory
workspace. Before Keep, choose the garment, review placement and supply a matching
front calibration for **each selected color photograph**. Use the existing scene
and base-upload workflow; all base URLs must be tenant-owned `/api/assets/:id`
references. Missing photographs/calibrations block creation rather than triggering
AI recoloring. The default planned garment is Comfort Colors 1717, colors Ivory,
Blossom, Butter, Bay and Espresso, and sizes S/M/L/XL. These are merchandising
choices, not verified supplier combinations. Price defaults to a clearly labeled
$32 proposal and must be reviewed.

Import the saved review file, select each of the first five kept versions, enter
title/description and review colors/price, then Create Draft Product. Nothing is
created automatically for the batch. Root PNG bytes must match manifest SHA-256
and dimensions; child PNG bytes must match generation provenance.sha256. Complete
ancestor recipes must accompany a child. PNG alpha is independently measured on
the server. If containment would change kept placement, handoff refuses it: return
to placement review and Keep again. The original PNG is stored unchanged; native
preview resolution is never promoted to a print master.

`Product.factoryDraft` retains the manifest, selected version/ancestry, prompts,
provider provenance, source hash/alpha bounds, placement, calibration snapshots,
base/composite hashes, original artwork asset URL and blockers. No `Design` row
is synthesized with invented structured aspects or a production master. A unique
`(storeId, factorySourceKey)` prevents duplicate products for the brief/candidate/
version identity, including racing requests. Repeat creation returns the existing
product without overwriting owner edits; changed evidence under the same identity
returns `VERSION_CHANGED` and needs a new reviewed version. Assets, product and
activity entries commit together, so failures roll back. Orphan cleanup recognizes
Factory evidence references.

The draft admin page links to existing product/gallery workflows and edits title,
description, selected reviewed colors and proposed price. The variants form now
edits individual integer-cent prices too. Draft color edits are limited to colors
whose previews were saved at handoff. Garment changes require a new version kept
with that garment's placement/calibration, rather than reusing an unrelated print
area. Immutable evidence remains unchanged when merchandising copy/prices change.
Normal product PATCH refuses Factory activation, featuring, supplier IDs or stock
availability. Launch/verification is a future separately approved workflow.

Composites reuse the existing compositor with the reviewed canvas-to-photo affine
mapping, including differing canvas/photo aspect ratios. They are labeled PODSite
preview composites, **not Printify verified mockups**. Supplier variants, costs,
availability/shipping, full-area transparent print export/upscale, physical sizing,
DPI, sample, copy and launch approval remain blockers. No image/text generation,
provider call, checkout enablement, order submission or publication occurs here.

Agent parity: `POST /api/agent/design-factory/draft-products` imports the same
review evidence; `PATCH /api/agent/design-factory/draft-products/:id` edits its
merchandising settings. Both require the resolved store's bearer key and share
services with authenticated admin actions. See `docs/AGENT_API.md` for payloads.
Existing product reads and `summary.attention.factoryDrafts` expose review evidence.

The additive migration adds two nullable Product fields and a tenant-scoped unique
index; existing products remain unchanged. Migration application and actual tenant
product creation are operator steps, not part of validation in this isolated
checkout. No production database or local credentials were used.

Manual browser QA (not executed by automated tests): import an exported review;
verify pending/rejected/unrendered versions lack the handoff, and kept versions
show it; check missing calibration errors; create each of five drafts and retry;
inspect five labeled color previews and exact source hash; edit copy/prices/colors;
reload admin; verify inactive status, unavailable variants and absent supplier IDs.
Compare desktop/mobile placement to Factory previews. Do not activate to review.

Factory Keep records the viewed scene productType and current reviewed placement before opening a native Create Draft Product dialog. Previously kept versions can reopen without re-Keep; Cancel/Escape preserves review state and creates nothing. Draft garment is fixed to the viewed scene, with session-retained merchandising fields. Per-color calibration and original PNG evidence remain mandatory; no supplier or activation safety gates are bypassed.
