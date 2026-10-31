# Draft PR verification notes

Implementation is confined to local brief/style/manifest schemas, a five-candidate
runner using the existing provider interface, The Look seed, tests and docs.
Original art, production storefront, database and products were not modified.

Validation in the isolated Windows checkout:

- `npm.cmd ci --cache .local/npm-cache`: passed, including Prisma Client 6.19.3
  generation via postinstall. Initial `npm ci` was blocked by PowerShell's script
  signing policy; invoking npm.cmd used the same lockfile/install operation.
- `npm.cmd run lint`: passed.
- `npm.cmd run prisma:generate`: passed (also generated during install).
- `npm.cmd run build`: passed with the existing Next.js Turbopack builder.
- `npx.cmd tsc --noEmit`: passed after the build generated Next.js route types.
  Initial invocation reported missing `LayoutProps` before those types existed;
  the identical command passed after the build, without application changes.
- `node --import tsx --test tests/*.test.ts`: failed, 16 passed / 1 failed / 17 total.
  All three new Factory tests passed. The existing test "boutique homepage is
  isolated to the real shihtshirt tenant" expects `/if \(boutique\) \{/` but
  `src/app/page.tsx` uses `if (boutique && !branding.isShih)`. Neither file was
  modified. An earlier run before dependency installation completed also had
  missing Next/Prisma modules; rerunning the identical full suite resolved those
  startup failures, but preserved this assertion failure.
- `node --import tsx scripts/design-factory.ts prepare .local/design-factory/verification`:
  passed, verified original-art hash and persisted five pending preview-only
  candidate prompts to an ignored local manifest.

Live paid image generation was not exercised; tests inject a fake provider.
Human selection, rights review, production master verification and physical
sampling remain manual (see README). No credentials were read or supplied, and
no products were published. Dependency installation reported 24 audit advisories;
dependency updates are outside this bounded change.

Publishing remains blocked by the full-suite assertion failure under the approved
"All reported checks must pass" policy. Draft PR creation is delegated to the
trusted bridge; no git publishing or GitHub authentication was attempted here.
