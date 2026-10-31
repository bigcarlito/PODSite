# Draft PR verification notes

Recovered POC commit `9ba75f1` is preserved (from
`codex-bridge/c3804752-f4a9-4b23-93e5-4544ebf5e635`). Its local schemas,
five-candidate runner, seed, tests and documentation remain unchanged.
No original artwork, application behavior, database or products were modified.

## Homepage failure diagnosis

The test expected `if (boutique)`. Commit `cf1c3d1` ("Match ShihTshirts homepage
to responsive mockups") intentionally added `!branding.isShih` and routed these
tenants to `ShihHome`. AGENTS.md documents this superseding layout. The expectation
was outdated; restoring the old application guard would regress the storefront.
The fix updates the assertion and checks the ShihHome branch and supported tenant
slug boundaries. Existing catalog, checkout and component assertions are retained.

## Validation in this isolated Windows checkout

- `npm.cmd ci`: passed with the existing lockfile and worker-provided local cache
  settings. Postinstall generated Prisma Client 6.19.3.
- `node --import tsx --test tests/*.test.ts`: passed, 17/17 tests, no skips,
  including all three Factory tests. The first run overlapped installation and
  reported 13 passed / 4 failed: the stale assertion plus missing `next/link` and
  Prisma client modules. After the test fix, completed installation and client
  generation, the identical full-suite command passed without reducing tests.
- `npm.cmd run prisma:generate`: passed.
- `npm.cmd run lint`: passed.
- `npx.cmd tsc --noEmit`: passed after the build generated Next.js route types.
- `npm.cmd run build`: passed with the existing Next.js Turbopack builder,
  type compilation and four static pages. Non-fatal warnings concern an outer
  workspace lockfile and the deprecated middleware convention.
- `node --import tsx scripts/design-factory.ts prepare .local/design-factory/recovered-validation`:
  passed; verified original-art hash and saved five pending preview-only prompts.

Live paid generation was not exercised; tests inject a fake provider. Human
selection, rights review, master verification and physical sampling remain manual
(see README). No credentials were read or production database accessed; no products
were published. Installation reported 24 dependency advisories (16 moderate,
7 high, 1 critical). Dependency upgrades are outside this bounded change.

## Draft PR handoff

Current branch: `codex-bridge/40687c8b-5870-4818-be35-b9ec3a914256`.
It starts at recovered POC commit `9ba75f1`; retain that commit plus this test fix
and verification update in the combined PR against `main`.

This bridge prohibits the implementation agent from committing, pushing or creating
a PR. After accepting validation, the trusted bridge should commit the two changed
files, push this branch and create a draft PR targeting `main`, titled
"Bounded ShihTshirts Design Factory POC and homepage test fix". On an authenticated
host, after pushing:

```powershell
gh pr create --draft --base main --head codex-bridge/40687c8b-5870-4818-be35-b9ec3a914256 --title "Bounded ShihTshirts Design Factory POC and homepage test fix" --body-file docs/design-factory/VERIFICATION.md
```

No commit, push, PR, merge or deployment was attempted by the implementation agent.

## Placement enhancement validation (2026-10-31)
In isolated checkout e79349a6-1c3b-4049-beae-58be50bf0ee5:
- npm.cmd ci: passed using unchanged lockfile; installed 405 packages and generated
  Prisma Client. npm reported 24 existing advisories (16 moderate, 7 high, 1 critical).
- npm.cmd run prisma:generate: passed, Prisma Client 6.19.3.
- lint: npm.cmd run lint passed.
- tests: node --import tsx --test tests/*.test.ts passed, 26/26 top-level tests,
  zero skips/failures; includes stubbed fixture runs of 4 Factory and 9 compositor/
  tenant tests. Covers geometry, clipping pixels, provider coordinate mapping,
  invalid inputs, serialization, review roundtrip and fill-only copy preservation.
- build: npm.cmd run build passed using Turbopack, seven static pages. An initial
  run failed TypeScript on a sharp namespace type; fixed with an explicit type
  import and reran the same build successfully. Final build passed again after
  UI cleanup. Existing outer-lockfile and middleware deprecation warnings remain.
- typecheck: npx.cmd tsc --noEmit passed after final build and client generation.
- git diff --check: passed after removing a trailing blank line.
- Source/migration preservation inspection: git diff --name-only -- prisma
  package-lock.json public docs/products returned no changes. No database migration,
  supplier calls, paid generation, credentials, publishing or production access.

Live authenticated the-look-03 browser/touch QA was not performed in this checkout.
Exact manual steps and limitations are in README.md. Preview calibration and
provider dimensions must be supplied before any future production handoff.
The bridge owns draft PR publishing; no commit, push or PR creation was attempted.

## 4494x5097 front canvas follow-up (2026-10-31)
Implementation in isolated checkout e0bb937d-81b4-40e0-bea1-80ef1b90007b:
scoped local-review canvas profiles, reversible mockup calibration, aspect-preserving
print boundary, visible overflow warnings and a clipping-rejecting future transparent
canvas plan. No schema, supplier, production, image upscale or publishing actions.

Validation:
- npm.cmd ci: passed (405 packages); postinstall generated Prisma Client 6.19.3.
  Initial `npm ci` could not launch unsigned npm.ps1 under PowerShell policy;
  using npm.cmd executed the same locked installation successfully. Existing
  dependency advisories: 16 moderate, 7 high, 1 critical; no lockfile changes.
- node --import tsx --test tests/*.test.ts: passed, 29/29, zero skips. First run
  found one stale source assertion expecting scene.area.x after boundary selection
  moved to printBoundary; updated it to cover configured and legacy selection,
  retained all other assertions and reran the full suite successfully.
- npm.cmd run lint: passed.
- npm.cmd run build: passed, default Turbopack, seven static pages. Nonfatal outer
  lockfile and deprecated middleware warnings remain.
- npx.cmd tsc --noEmit: passed.
- git diff --check: passed.

Manual browser QA is documented in README.md and was not performed. The calibration
preset is provisional until reviewed against the real garment photo; print-provider
identity must be supplied explicitly. Canvas pixels do not establish physical size.

Bridge handoff: create a NEW draft PR titled "Configure scoped front print canvas
and reversible Factory mockup calibration", targeting
`codex-bridge/e79349a6-1c3b-4049-beae-58be50bf0ee5` (the authenticated head of draft
PR #59, b4127da3b728457da0c6e3e63ffd0272ba297a36). Do not update PR #59 or merge.
This implementation agent did not commit, push, create a PR, merge or deploy.
