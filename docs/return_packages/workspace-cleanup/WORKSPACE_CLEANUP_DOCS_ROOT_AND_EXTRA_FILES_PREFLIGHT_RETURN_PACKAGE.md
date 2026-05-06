# Workspace Cleanup Docs Root and Extra Files Preflight Return Package

## Baseline Validation

- `git status --short` was not clean before this preflight.
- Existing unrelated modified files were left untouched:
  - `docs/return_packages/workspace-cleanup/WORKSPACE_CLEANUP_PHASE6_RETURN_PACKAGE.md`
  - `docs/workspace-rules/WORKSPACE_GUARDRAILS.md`
  - `scripts/docs/checkWorkspaceGuardrails.mjs`

## Scope

- Create a first-pass inventory for root-level markdown files under `docs/`.
- Classify loose tracked root artifacts that may be docs-like leftovers or
  retained project resources.
- Do not move, rename, archive, or delete anything in this pass.

## Files Created

- `docs/_working/workspace-cleanup/SCOUTZERO_WORKSPACE_CLEANUP_DOCS_ROOT_AND_EXTRA_FILES_PREFLIGHT.md`
- `docs/return_packages/workspace-cleanup/WORKSPACE_CLEANUP_DOCS_ROOT_AND_EXTRA_FILES_PREFLIGHT_RETURN_PACKAGE.md`

## Files Updated

- `docs/_working/workspace-cleanup/SCOUTZERO_WORKSPACE_CLEANUP_MASTER.md`

## Key Findings

- The `docs/` root currently mixes durable entry docs, active technical
  references, historical campaign records, and plan/review artifacts.
- Several top-level docs should stay visible now but would be better placed in
  feature or topic folders later, including `ARCHITECT_GAP_ANALYSIS.md`,
  `ARCHITECT_CAP_TOTAL_SINGLE_SOURCE.md`, `SCHEMA_MIGRATION_GUIDE.md`, and
  `TRADE_MACHINE_AUDIT.md`.
- The TypeScript campaign files at the docs root are intentionally retained as
  historical evidence and are still routed from `docs/typescript/README.md`.
  They should not be deleted and should only be relocated as a bundle.
- `new-schema-validator-review.md`, `TRADE_MACHINE_GAP_ANALYSIS.md`,
  `ARCHITECT_PLAN_INDEX.md`, and `refactoring-plans.md` are strong archive or
  relocation candidates once a keeper path is chosen.
- `.architect-cast-baseline.json` is an active project resource, not cleanup
  trash.
- `audit_report_raw.txt`, `test_output.txt`, and `test-profile-output.txt` are
  tracked but unreferenced in the workspace and look like provenance-review
  candidates rather than long-term project resources.

## Commands Run

- `git status --short`
- `list_dir` on repo root, `docs/`, `archive/`, `archive/docs/`, and
  `docs/_working/workspace-cleanup/`
- `read_file` on:
  - `docs/INDEX.md`
  - `README.md`
  - `archive/docs/README.md`
  - `docs/return_packages/README.md`
  - `docs/_working/workspace-cleanup/SCOUTZERO_WORKSPACE_CLEANUP_PREFLIGHT.md`
  - `docs/RETURN_PACKAGES_CONSOLIDATION.md`
  - `docs/maintenance/POST_TYPESCRIPT_DOC_STABILIZATION.md`
  - `docs/typescript/README.md`
  - `docs/refactoring-plans.md`
  - `docs/ARCHITECT_PLAN_INDEX.md`
  - `docs/TRADE_MACHINE_GAP_ANALYSIS.md`
  - `docs/new-schema-validator-review.md`
  - `docs/SHIP_GATES_MASTER.md`
  - `docs/ARCHITECT_CAP_TOTAL_SINGLE_SOURCE.md`
  - `docs/SCHEMA_MIGRATION_GUIDE.md`
  - `docs/SCRIPTS.md`
  - `docs/TESTING.md`
- `grep_search` for references to candidate docs and root artifacts across the
  workspace
- `git ls-files -- .architect-cast-baseline.json architect-plan-summary audit_report_raw.txt test_output.txt test-profile-output.txt`
- `ls -lh .architect-cast-baseline.json audit_report_raw.txt test_output.txt test-profile-output.txt`
- `npm run lint:md`
- `npm run docs:guardrails`
- `npm run validate:project`

## Commands Skipped

- `npm run build`: skipped because this was a docs-only preflight.
- `npm run typecheck`: skipped because no application code changed.
- `npm run test:*`: skipped because this pass only inventories docs and root
  artifacts.
- Any move, rename, archive, or delete command: skipped because this was a
  classification pass only.

## Outcome

- [x] A first-pass matrix now exists for docs-root files and tracked root
      artifacts.
- [x] Active keepers were separated from archive/relocation candidates.
- [x] The root output files were not deleted based on age or filename alone.
- [x] `.architect-cast-baseline.json` was explicitly protected as an active
      project resource.
- [x] The unrelated live worktree edits were left untouched.
- [x] `npm run lint:md` passed after the preflight docs were added.
- [x] `npm run docs:guardrails` passed after the preflight docs were added.
- [x] `npm run validate:project` passed after the preflight docs were added.

## Recommended Next Pass

- Do a low-risk relocation pass for the archive-candidate docs and
  `architect-plan-summary/`.
- Do a separate historical-bundle pass for the TypeScript campaign docs.
- Do a provenance-check pass for `audit_report_raw.txt`, `test_output.txt`, and
  `test-profile-output.txt` before any deletion.
