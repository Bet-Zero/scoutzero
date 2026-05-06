# Workspace Cleanup Docs Root and Extra Files Execution Return Package

## Baseline Validation

- `git status --short` was not clean before this execution pass.
- Existing unrelated modified files were left untouched:
  - `docs/return_packages/workspace-cleanup/WORKSPACE_CLEANUP_PHASE6_RETURN_PACKAGE.md`
  - `docs/workspace-rules/WORKSPACE_GUARDRAILS.md`
  - `scripts/docs/checkWorkspaceGuardrails.mjs`

## Scope

- Execute the low-risk docs-root relocation pass identified in the preflight.
- Move the root-level TypeScript historical bundle as one grouped archive.
- Resolve the tracked raw root output files after provenance review.
- Keep active project resources and ambiguous active docs in place.

## Files Moved

- `docs/new-schema-validator-review.md` -> `archive/docs/reviews/new-schema-validator-review.md`
- `docs/TRADE_MACHINE_GAP_ANALYSIS.md` -> `archive/docs/tradeMachine/TRADE_MACHINE_GAP_ANALYSIS.md`
- `docs/ARCHITECT_PLAN_INDEX.md` -> `archive/docs/architect-teams-plan/ARCHITECT_PLAN_INDEX.md`
- `docs/refactoring-plans.md` -> `docs/_working/refactoring/refactoring-plans.md`
- `architect-plan-summary/` -> `archive/docs/architect-teams-plan/summaries/`
- `docs/TYPESCRIPT_HARDENING_NEXT_STEPS.md` -> `archive/docs/typescript/TYPESCRIPT_HARDENING_NEXT_STEPS.md`
- `docs/TS_CONVERSION_NEXT_STEPS.md` -> `archive/docs/typescript/TS_CONVERSION_NEXT_STEPS.md`
- `docs/TS_CONVERSION_PILE_A_AUDIT.md` -> `archive/docs/typescript/TS_CONVERSION_PILE_A_AUDIT.md`
- `docs/TS_CONVERSION_PILE_B_AUDIT.md` -> `archive/docs/typescript/TS_CONVERSION_PILE_B_AUDIT.md`
- `docs/TS_CONVERSION_PILE_C_PLAN.md` -> `archive/docs/typescript/TS_CONVERSION_PILE_C_PLAN.md`
- `docs/TS_CONVERSION_PILE_D_TESTS_PLAN.md` -> `archive/docs/typescript/TS_CONVERSION_PILE_D_TESTS_PLAN.md`

## Files Deleted

- `audit_report_raw.txt`
- `test_output.txt`
- `test-profile-output.txt`

## Files Created

- `archive/docs/typescript/README.md`
- `archive/docs/reviews/README.md`
- `archive/docs/tradeMachine/README.md`
- `archive/docs/architect-teams-plan/README.md`
- `docs/return_packages/workspace-cleanup/WORKSPACE_CLEANUP_DOCS_ROOT_AND_EXTRA_FILES_EXECUTION_RETURN_PACKAGE.md`

## Files Updated

- Active routing docs were updated to the new locations:
  - `docs/INDEX.md`
  - `docs/architect-teams-plan/README.md`
  - `docs/ARCHITECT_GAP_ANALYSIS.md`
  - `docs/typescript/README.md`
  - `docs/maintenance/POST_TYPESCRIPT_DOC_STABILIZATION.md`
- Active/historical supporting docs were updated to keep internal references truthful:
  - `docs/typescript/TYPESCRIPT_HARDENING_BASELINE.md`
  - `docs/typescript/TYPESCRIPT_HARDENING_EXECUTION_MAP.md`
  - `docs/typescript/TYPESCRIPT_HARDENING_FINAL_REVIEW.md`
  - `archive/docs/README.md`
  - `archive/docs/architect-teams-plan/00-IMPLEMENTATION-STATUS.md`
  - `archive/docs/tradeMachine/TRADE_MACHINE_GAP_ANALYSIS.md`
  - `archive/docs/architect-teams-plan/ARCHITECT_PLAN_INDEX.md`
- Historical planning summaries were preserved under the archived planning bundle:
  - `archive/docs/architect-teams-plan/summaries/01-GOALS-SUMMARY.md`
  - `archive/docs/architect-teams-plan/summaries/02-CURRENT-STATUS-SUMMARY.md`
  - `archive/docs/architect-teams-plan/summaries/03-TARGET-SCHEMA-SUMMARY.md`
  - `archive/docs/architect-teams-plan/summaries/04-HOW-IT-WORKS-SUMMARY.md`
  - `archive/docs/architect-teams-plan/summaries/05-SAVE-LOAD-LOGIC-SUMMARY.md`
  - `archive/docs/architect-teams-plan/summaries/06-COMPREHENSIVE-SUMMARY.md`
  - `archive/docs/architect-teams-plan/summaries/07-IMPLEMENTATION-PLAN-SUMMARY.md`
  - `archive/docs/architect-teams-plan/summaries/COMBINED-SUMMARY.md`
  - `archive/docs/architect-teams-plan/summaries/EXECUTION-PROMPT.md`
  - `archive/docs/architect-teams-plan/summaries/README.md`
- Two source comments were updated to stop pointing at the removed docs-root TypeScript plan paths:
  - `src/shared/utils/roles/roleUtils.ts`
  - `src/shared/utils/filtering/filterHelpers.ts`
- `docs/_working/workspace-cleanup/SCOUTZERO_WORKSPACE_CLEANUP_MASTER.md`

## Key Decisions

- `.architect-cast-baseline.json` was kept at the repo root because it is a live project resource used by the Architect cast gate.
- The condensed Architect planning summaries were folded into the archived Architect planning bundle rather than being kept on the active docs surface.
- The TypeScript historical bundle was moved as a single archive unit under `archive/docs/typescript/` rather than being split across active surfaces.
- Historical preflight and return-package evidence that references the old paths was left intact as historical evidence unless it was an active routing surface.

## Commands Run

- `git status --short`
- `git mv` / `git rm` batch for the approved relocation and deletion set
- targeted `read_file` and `grep_search` checks for references, provenance, and active routing surfaces
- `npm run lint:md`
- `npm run docs:guardrails`
- `npm run validate:project`

## Commands Skipped

- `npm run build`: skipped because this was a docs-and-comments cleanup pass.
- `npm run typecheck`: skipped because no executable TypeScript logic changed.
- `npm run test:*`: skipped because the pass did not change runtime behavior.

## Outcome

- [x] Archive-candidate docs were removed from the active docs root.
- [x] The TypeScript historical bundle no longer occupies the active docs root.
- [x] The raw root output files were removed after provenance review.
- [x] `.architect-cast-baseline.json` was explicitly protected and left in place.
- [x] Active routers now point at the relocated files.
- [x] New archive surfaces have README routing docs.
- [x] The unrelated live worktree edits were left untouched.
- [x] `npm run docs:guardrails` passed after the relocation pass.
- [x] `npm run validate:project` passed after the relocation pass.
