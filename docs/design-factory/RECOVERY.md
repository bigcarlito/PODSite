# Keep to draft recovery

This isolated branch starts at current main, 1584c375e502e3e14968d2fb1112cc383358d111
(PR #64 merge). The initial checkout was clean.

Both earlier checkout directories were read without modification. Their HEAD
references identify codex-bridge/54493dc2-7550-477a-b8c3-f1b628836303
at 1584c375e502e3e14968d2fb1112cc383358d111 and
codex-bridge/9b72f5d9-b159-43c4-aa16-95e2d6c554aa
at 707ea5172224f918e6cca83f0d1de1166fca9024. Neither branch is present
in this isolated repository's branch inventory; its worktree inventory contains
only this checkout. No additional Git directory was trusted.

Filesystem comparisons against this checkout recovered uncommitted service,
schema/migration, admin/API, compositor, cleanup, summary, documentation and
fixture-test work from 54493dc2. The older task had started a manifest-selection
handoff in factory-drafts.ts, predating versioned Keep/placement. It was inspected
but not overlaid over the newer version-aware service. Original checkouts and
all their partial changes remain untouched. No earlier test results are assumed.

The recovered code was inspected and hardened for ambiguous identities, invalid
or invisible PNGs and normal product-update attempts to replace Factory evidence.
This implements tooling for the first five reviewed ShihTshirts versions; it does
not create actual tenant rows, access a database or call a provider. The additive
migration must be applied in an authorized environment before using the workflow.
The saved review export, tenant photographs/calibrations and owner choices are
required there. Browser QA remains an operator handoff documented in README.md.

No commit, push, PR, merge or deployment is performed by this worker. The trusted
bridge handles a draft PR from this isolated branch after validation.
