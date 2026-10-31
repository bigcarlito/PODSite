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
