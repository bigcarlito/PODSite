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
