# Workspace Cleanup Phase 5 Return Package

## Baseline Validation

- `git status --short`: clean before any Phase 5 edits.
- `npm run lint:md`: failed at baseline on `docs/return_packages/workspace-cleanup/WORKSPACE_CLEANUP_PHASE4_RETURN_PACKAGE.md:320` with `MD032`.
- Baseline unblock: added the missing blank line in `WORKSPACE_CLEANUP_PHASE4_RETURN_PACKAGE.md`, then reran `npm run lint:md` successfully before any stale-link edits.

## Stale-Link Inventory

| File                                                          | Stale Reference                                                           | Current Status                                                      | Fix Applied                                                                                     |
| ------------------------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `README.md`                                                   | `docs/architecture/DATA_SOURCE_MAP.md`                                    | Missing file                                                        | Replaced with current schema and project schema references                                      |
| `README.md`                                                   | `docs/architecture/PROJECT_CONTEXT.md`                                    | Missing file                                                        | Replaced with `docs/architecture/PROJECT_SCHEMA.md`                                             |
| `README.md`                                                   | `docs/architecture/FIRESTORE_SCHEMA.md`                                   | Missing file                                                        | Replaced with `docs/schema/CURRENT_FIRESTORE_SCHEMA.md`                                         |
| `docs/INDEX.md`                                               | `audits/TRADE_MACHINE_AUDIT.md`                                           | File lives at docs root                                             | Repointed to `TRADE_MACHINE_AUDIT.md` in both Trade Machine and Quick Links sections            |
| `docs/INDEX.md`                                               | `audits/TRADE_MACHINE_FIX_PLAN.md`                                        | Missing file                                                        | Replaced with `tradeMachine/MASTER_TRADE_MACHINE_ALIGNMENT.md`                                  |
| `docs/INDEX.md`                                               | `/docs/tradeMachine/return-packages/`                                     | Deprecated missing hyphen path                                      | Replaced with `return_packages/README.md`                                                       |
| `docs/tradeMachine/MASTER_TRADE_MACHINE_ALIGNMENT.md`         | `../audits/TRADE_MACHINE_AUDIT.md`                                        | Audit moved to docs root                                            | Repointed to `../TRADE_MACHINE_AUDIT.md`                                                        |
| `docs/tradeMachine/MASTER_TRADE_MACHINE_ALIGNMENT.md`         | `../audits/TRADE_MACHINE_FIX_PLAN.md`                                     | Missing file                                                        | Replaced with `./SALARY_DISPLAY_GUIDE.md`                                                       |
| `docs/architect/DRAFT_ASSET_VERIFICATION_GATES.md`            | `./DRAFT_ASSET_TERMS_AND_LIFECYCLE_COMPLETION_AUDIT.md`                   | Historical audit archived                                           | Repointed to `../../archive/docs/architect/DRAFT_ASSET_TERMS_AND_LIFECYCLE_COMPLETION_AUDIT.md` |
| `docs/architect/DRAFT_ASSET_VERIFICATION_GATES.md`            | `../../return_packages/PHASE_D4_TRUE_E2E_EMULATOR_GATE_RETURN_PACKAGE.md` | Referenced file not found in workspace                              | Removed without replacement; documented below                                                   |
| `docs/architect/ARCHITECT_ULTIMATE_AUDIT_BLUEPRINT.md`        | `docs/architect/OFFSEASON_WORKFLOW_COMPLETION_AUDIT.md`                   | Historical audit archived                                           | Repointed to `archive/docs/architect/OFFSEASON_WORKFLOW_COMPLETION_AUDIT.md`                    |
| `.claudeignore`                                               | `plans/` hide-all rule                                                    | Mixed active and archived plan material exists                      | Reduced ignore scope to `plans/_archive/`                                                       |
| `docs/tradeMachine/TRADE_MACHINE_DRAFT_PICKS_MASTER.md`       | `docs/return-packages/...`                                                | No canonical `docs/return_packages/tradeMachine/` destination found | Documented only; carried forward                                                                |
| `docs/architect/TRADE_MACHINE_MASTER.md`                      | `return_packages/trade_machine/...`                                       | Referenced files not found in workspace                             | Documented only; carried forward                                                                |
| `docs/architect/ARCHITECT_CAP_SHEET_REVIEW_TRACKER.md`        | `return_packages/ARCHITECT_CAP_SHEET_*`                                   | Referenced files not found in workspace                             | Documented only; carried forward                                                                |
| `docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md` | `docs/architect/return_packages/PHASE_*`                                  | Referenced files not found in workspace                             | Documented only; carried forward                                                                |
| `docs/architect/EDIT_CONTRACT_MASTER.md`                      | `return_packages/architect/TM_EDIT_CONTRACT_*`                            | Referenced files not found in workspace                             | Documented only; carried forward                                                                |
| `docs/architect/TS_MIGRATION_REEVAL_PROMPT.md`                | `return_packages/trade_machine/`                                          | Referenced files not found in workspace                             | Documented only; carried forward                                                                |

## Files Updated

- `.claudeignore`
- `README.md`
- `docs/INDEX.md`
- `docs/architect/ARCHITECT_ULTIMATE_AUDIT_BLUEPRINT.md`
- `docs/architect/DRAFT_ASSET_VERIFICATION_GATES.md`
- `docs/tradeMachine/MASTER_TRADE_MACHINE_ALIGNMENT.md`
- `docs/return_packages/workspace-cleanup/WORKSPACE_CLEANUP_PHASE4_RETURN_PACKAGE.md`
- `docs/_working/workspace-cleanup/SCOUTZERO_WORKSPACE_CLEANUP_MASTER.md`

## Files Created

- `docs/return_packages/workspace-cleanup/WORKSPACE_CLEANUP_PHASE5_RETURN_PACKAGE.md`

## Links Fixed

| Old Reference                                           | New Reference                                                                      | Files Updated                                                          |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `docs/architecture/DATA_SOURCE_MAP.md`                  | `docs/schema/CURRENT_FIRESTORE_SCHEMA.md`                                          | `README.md`                                                            |
| `docs/architecture/PROJECT_CONTEXT.md`                  | `docs/architecture/PROJECT_SCHEMA.md`                                              | `README.md`                                                            |
| `docs/architecture/FIRESTORE_SCHEMA.md`                 | `docs/schema/CURRENT_FIRESTORE_SCHEMA.md`                                          | `README.md`                                                            |
| `audits/TRADE_MACHINE_AUDIT.md`                         | `TRADE_MACHINE_AUDIT.md`                                                           | `docs/INDEX.md`, `docs/tradeMachine/MASTER_TRADE_MACHINE_ALIGNMENT.md` |
| `audits/TRADE_MACHINE_FIX_PLAN.md`                      | `tradeMachine/MASTER_TRADE_MACHINE_ALIGNMENT.md`                                   | `docs/INDEX.md`                                                        |
| `/docs/tradeMachine/return-packages/`                   | `docs/return_packages/README.md`                                                   | `docs/INDEX.md`                                                        |
| `./DRAFT_ASSET_TERMS_AND_LIFECYCLE_COMPLETION_AUDIT.md` | `../../archive/docs/architect/DRAFT_ASSET_TERMS_AND_LIFECYCLE_COMPLETION_AUDIT.md` | `docs/architect/DRAFT_ASSET_VERIFICATION_GATES.md`                     |
| `docs/architect/OFFSEASON_WORKFLOW_COMPLETION_AUDIT.md` | `archive/docs/architect/OFFSEASON_WORKFLOW_COMPLETION_AUDIT.md`                    | `docs/architect/ARCHITECT_ULTIMATE_AUDIT_BLUEPRINT.md`                 |
| `plans/`                                                | `plans/_archive/`                                                                  | `.claudeignore`                                                        |

## Links Removed Without Replacement

| Old Reference                                                             | File                                               | Reason                                                                                 |
| ------------------------------------------------------------------------- | -------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `../../return_packages/PHASE_D4_TRUE_E2E_EMULATOR_GATE_RETURN_PACKAGE.md` | `docs/architect/DRAFT_ASSET_VERIFICATION_GATES.md` | File not found anywhere in the workspace and no canonical replacement was discoverable |

## `plans/` Status Decision

- Actual inspection result: non-archive plan docs exist under `plans/architect-timing/plan.md`, `plans/phase49-tpe-history/plan.md`, `plans/emulator-workflow-hardening/plan.md`, `plans/pst-emulator-seeding/plan.md`, `plans/pst-phase-10-firestore-entitlements/plan.md`, `plans/cap-sheet-contract-rules-phase-7-2/plan.md`, `plans/cap-sheet-contract-rules-phase-7-3/plan.md`, and `plans/salary-engine-audit/plan.md`.
- Archive surface also exists at `plans/_archive/`.
- `.claudeignore` was updated: yes.
- `docs/architecture/PROJECT_SCHEMA.md` was updated: no, because the existing split model already matched the repo state.
- Unresolved risk: none for `plans/`; the disagreement is resolved.

## Commands Run

- `git status --short`: initial baseline clean.
- `npm run lint:md`: failed once on `WORKSPACE_CLEANUP_PHASE4_RETURN_PACKAGE.md:320` with `MD032`, then passed after the baseline-unblock fix.
- `grep_search` stale-path scan with the required pattern set across `README.md`, `docs/**/*.md`, `AGENTS.md`, `.claudeignore`, and `.gitignore`: found active stale refs in `README.md`, `docs/INDEX.md`, `docs/tradeMachine/MASTER_TRADE_MACHINE_ALIGNMENT.md`, `docs/architect/DRAFT_ASSET_VERIFICATION_GATES.md`, `docs/architect/ARCHITECT_ULTIMATE_AUDIT_BLUEPRINT.md`, and unresolved legacy refs in older architect/trade-machine docs.
- `file_search` and `list_dir` on `plans/`: confirmed mixed current plus archived plan material.
- `npm run lint:md` after router fixes: passed.
- `git status --short` after the Phase 5 package and master updates: modified `.claudeignore`, `README.md`, `docs/INDEX.md`, `docs/_working/workspace-cleanup/SCOUTZERO_WORKSPACE_CLEANUP_MASTER.md`, `docs/architect/ARCHITECT_ULTIMATE_AUDIT_BLUEPRINT.md`, `docs/architect/DRAFT_ASSET_VERIFICATION_GATES.md`, `docs/return_packages/workspace-cleanup/WORKSPACE_CLEANUP_PHASE4_RETURN_PACKAGE.md`, `docs/tradeMachine/MASTER_TRADE_MACHINE_ALIGNMENT.md`, and added `docs/return_packages/workspace-cleanup/WORKSPACE_CLEANUP_PHASE5_RETURN_PACKAGE.md`.
- `npm run lint:md` after the Phase 5 package and cleanup master updates: failed once on `WORKSPACE_CLEANUP_PHASE5_RETURN_PACKAGE.md` with `MD047` (missing trailing newline), then passed after the newline fix.

## Commands Skipped

- `npm run build`: skipped because this phase is docs-only and the prompt explicitly disallowed builds.
- `npm run typecheck`: skipped because this phase is docs-only and the prompt explicitly disallowed typecheck.
- `npm run test`: skipped because this phase is docs-only and the prompt explicitly disallowed broader test runs.
- `npm run test:full`: skipped because full-suite execution was not requested and the prompt explicitly disallowed it.
- Raw `vitest` commands: skipped because AGENTS.md forbids using raw Vitest commands.

## Acceptance Criteria Check

- [x] Stale-link scan was run and documented.
- [x] `docs/INDEX.md` no longer points to known missing return-package or audit paths.
- [x] README stale links found by this phase are fixed or documented.
- [x] Return-package references use canonical `docs/return_packages/` paths where a canonical destination exists.
- [x] Archived audit references use `archive/docs/` paths where the archived file exists.
- [x] Archived `_working` references use `archive/docs/_working/` paths where referenced by the cleanup docs.
- [x] Deprecated `return-packages` hyphen references in active routers were removed.
- [x] The `plans/` disagreement is resolved with repo evidence.
- [x] Cleanup master doc marks Phase 5 complete only after validation passes.
- [x] No source-code changes were made.
- [x] No files were moved.
- [x] No files were deleted.
- [x] `npm run lint:md` passes after the Phase 5 return package and cleanup master updates.

## Follow-Up Work

- Next recommended phase: Phase 6 guardrail updates.
- Carry forward the unresolved no-replacement legacy link set in older architect and trade-machine master/tracker docs for a later bounded historical-evidence pass.
