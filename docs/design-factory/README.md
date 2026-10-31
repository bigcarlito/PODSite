# Design Factory bounded proof of concept

Local, typed manifest workflow for ShihTshirts. No database migration, API endpoint,
UI, product creation, publication, or storefront change. The seed is a concept
exploration, not a controlled sales experiment. Store slug is provenance only;
this runner never resolves an account or touches a tenant database.

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
