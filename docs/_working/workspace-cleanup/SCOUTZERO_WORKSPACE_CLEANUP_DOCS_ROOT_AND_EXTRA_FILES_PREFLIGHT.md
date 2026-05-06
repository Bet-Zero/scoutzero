# ScoutZero Docs Root and Extra Files Preflight

Preflight only. No archive, delete, move, rename, or cleanup actions were
executed.

## 1. Scope

This pass focuses on two surfaces only:

- root-level markdown files directly under `docs/`
- loose tracked artifacts at repo root that behave more like outputs, summaries,
  or cleanup leftovers than stable project structure

It does not change the previously established return-package, `_working`, or
historical-doc rules. It also does not touch the unrelated live worktree edits
in:

- `docs/workspace-rules/WORKSPACE_GUARDRAILS.md`
- `scripts/docs/checkWorkspaceGuardrails.mjs`
- `docs/return_packages/workspace-cleanup/WORKSPACE_CLEANUP_PHASE6_RETURN_PACKAGE.md`

## 2. Executive Summary

The current `docs/` root is doing too many jobs at once.

- Some files are real permanent entry docs or durable reference docs and should
  stay visible.
- Some are historical campaign records that should remain in the repo but no
  longer dominate the active docs root.
- Some are plan/review artifacts that probably belong beside the feature they
  describe or behind an archive surface once a keeper is chosen.

The repo root shows the same split:

- one tracked root artifact, `.architect-cast-baseline.json`, is a real project
  resource and must stay where it is;
- `architect-plan-summary/` is a retained planning package that should not stay
  at repo root indefinitely;
- `audit_report_raw.txt`, `test_output.txt`, and `test-profile-output.txt` look
  like tracked command outputs rather than long-term repo resources.

The immediate next step should be a low-risk move pass, not deletion.

## 3. Bucket Definitions

| Bucket                                    | Meaning                                                                                                    |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `KEEP_ACTIVE`                             | Stable doc/resource that should remain visible and routable now.                                           |
| `KEEP_ACTIVE_RELOCATE_LATER`              | Still active, but better housed under a feature/topic surface rather than the docs root or repo root.      |
| `KEEP_HISTORICAL_RELOCATE_LATER`          | Must stay in the repo as evidence/history, but should leave the active docs root after routing is updated. |
| `ARCHIVE_CANDIDATE`                       | Likely historical/review material that can move behind archive once a keeper path is confirmed.            |
| `DELETE_CANDIDATE_AFTER_PROVENANCE_CHECK` | Looks disposable, but should only be deleted after one explicit provenance check.                          |

## 4. Docs Root Matrix

| Path                                        | Current role                                    | Evidence                                                                                       | Recommended bucket               | Recommended next action                                                                      |
| ------------------------------------------- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------- | -------------------------------- | -------------------------------------------------------------------------------------------- |
| `docs/INDEX.md`                             | Main docs router                                | Current docs entry point and workspace-rules router                                            | `KEEP_ACTIVE`                    | Keep at docs root.                                                                           |
| `docs/CONTRIBUTING.md`                      | Contributor/developer entry doc                 | Routed from `docs/INDEX.md`                                                                    | `KEEP_ACTIVE`                    | Keep at docs root.                                                                           |
| `docs/FILE_MAP.md`                          | Repo map/reference                              | Durable high-level reference surface                                                           | `KEEP_ACTIVE`                    | Keep visible unless merged into schema docs later.                                           |
| `docs/FIRESTORE_DIAGNOSTIC.md`              | Firestore troubleshooting/reference             | Linked from `README.md`                                                                        | `KEEP_ACTIVE`                    | Keep visible.                                                                                |
| `docs/CONTRACT_NORMALIZATION_RULES.md`      | Durable contract rules reference                | Linked from `docs/INDEX.md`                                                                    | `KEEP_ACTIVE`                    | Keep visible.                                                                                |
| `docs/SCRIPTS.md`                           | npm/scripts reference                           | Referenced by `CODEBASE_AUDIT_2026-02.md` and cross-links to `TESTING.md`                      | `KEEP_ACTIVE`                    | Keep visible.                                                                                |
| `docs/TESTING.md`                           | durable testing guide                           | Referenced by `CONTRIBUTING.md`, `SCRIPTS.md`, and other docs                                  | `KEEP_ACTIVE`                    | Keep visible.                                                                                |
| `docs/COMPONENT_INDEX.md`                   | Generated component index                       | Produced by `scripts/generateDocs.cjs`                                                         | `KEEP_ACTIVE`                    | Keep visible as generated reference.                                                         |
| `docs/CODEBASE_AUDIT_2026-02.md`            | Broad structural audit                          | Still routed from `docs/INDEX.md` and `CONTRIBUTING.md`                                        | `KEEP_ACTIVE`                    | Keep visible for now; consider later move to `docs/reviews/` only if routers change.         |
| `docs/TRADE_MACHINE_AUDIT.md`               | Current trade-machine audit reference           | Routed from `docs/INDEX.md` and `docs/tradeMachine/MASTER_TRADE_MACHINE_ALIGNMENT.md`          | `KEEP_ACTIVE_RELOCATE_LATER`     | Keep active; later relocate under `docs/tradeMachine/` if routing is updated.                |
| `docs/SHIP_GATES_MASTER.md`                 | Current ship-readiness source of truth          | File explicitly says it is the single source of truth for current shipping scope               | `KEEP_ACTIVE`                    | Keep visible.                                                                                |
| `docs/ARCHITECT_CAP_TOTAL_SINGLE_SOURCE.md` | Active architect cap-totals contract            | File banner says `Status: Active`; tests reference it                                          | `KEEP_ACTIVE_RELOCATE_LATER`     | Keep active; later move under `docs/architect/` or `docs/capSheet/`.                         |
| `docs/ARCHITECT_GAP_ANALYSIS.md`            | Architect implementation/gap baseline           | Linked from `docs/INDEX.md`; code comments still reference it                                  | `KEEP_ACTIVE_RELOCATE_LATER`     | Keep active for now; later relocate under `docs/architect/`.                                 |
| `docs/SCHEMA_MIGRATION_GUIDE.md`            | Old-vs-new architect schema guide               | Reads like durable technical guidance rather than a one-off review                             | `KEEP_ACTIVE_RELOCATE_LATER`     | Keep active; later move under `docs/architecture/` or `docs/migrations/`.                    |
| `docs/new-schema-validator-review.md`       | One-off schema validation review                | Routed only from `docs/INDEX.md`; content is review findings and migration gaps                | `ARCHIVE_CANDIDATE`              | Move behind archive or `docs/reviews/` once router is updated.                               |
| `docs/TRADE_MACHINE_GAP_ANALYSIS.md`        | Historical gap analysis                         | Created 2025-12-27; still points to stale `audits/TRADE_MACHINE_AUDIT.md` baseline path        | `ARCHIVE_CANDIDATE`              | Move out of docs root after preserving any still-needed findings.                            |
| `docs/ARCHITECT_PLAN_INDEX.md`              | Router for architect planning package           | Points into `architect-plan-summary/` and `docs/architect-teams-plan/`                         | `ARCHIVE_CANDIDATE`              | Fold into `docs/architect-teams-plan/README.md` or archive with that package.                |
| `docs/refactoring-plans.md`                 | Cursor-oriented structural refactor plan bundle | File is written as self-contained execution plans for Cursor                                   | `ARCHIVE_CANDIDATE`              | Move to `_working` or archive; it is not a stable docs-root entry doc.                       |
| `docs/RETURN_PACKAGES_CONSOLIDATION.md`     | Historical cleanup note                         | File itself says it preserves a historical pre-consolidation snapshot and Phase 2 status notes | `KEEP_HISTORICAL_RELOCATE_LATER` | Retain as evidence, but move out of docs root during a later workspace-cleanup archive pass. |
| `docs/TYPESCRIPT_HARDENING_NEXT_STEPS.md`   | Historical TypeScript campaign record           | `docs/typescript/README.md` classifies it as historical evidence                               | `KEEP_HISTORICAL_RELOCATE_LATER` | Keep for evidence; later relocate with the rest of the TypeScript campaign records.          |
| `docs/TS_CONVERSION_NEXT_STEPS.md`          | Historical TypeScript campaign plan             | `docs/typescript/README.md` classifies it as historical evidence                               | `KEEP_HISTORICAL_RELOCATE_LATER` | Keep for evidence; later relocate with TypeScript history.                                   |
| `docs/TS_CONVERSION_PILE_A_AUDIT.md`        | Historical TypeScript audit                     | Routed from `docs/typescript/README.md` as campaign history                                    | `KEEP_HISTORICAL_RELOCATE_LATER` | Keep for evidence; relocate later.                                                           |
| `docs/TS_CONVERSION_PILE_B_AUDIT.md`        | Historical TypeScript audit                     | Routed from `docs/typescript/README.md` as campaign history                                    | `KEEP_HISTORICAL_RELOCATE_LATER` | Keep for evidence; relocate later.                                                           |
| `docs/TS_CONVERSION_PILE_C_PLAN.md`         | Historical TypeScript plan                      | Routed from `docs/typescript/README.md` as campaign history                                    | `KEEP_HISTORICAL_RELOCATE_LATER` | Keep for evidence; relocate later.                                                           |
| `docs/TS_CONVERSION_PILE_D_TESTS_PLAN.md`   | Historical TypeScript plan                      | Routed from `docs/typescript/README.md` as campaign history                                    | `KEEP_HISTORICAL_RELOCATE_LATER` | Keep for evidence; relocate later.                                                           |

## 5. Repo-Root Extra Files and Directories

| Path                            | Current role                         | Evidence                                                                                        | Recommended bucket                        | Recommended next action                                                                                                                |
| ------------------------------- | ------------------------------------ | ----------------------------------------------------------------------------------------------- | ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `.architect-cast-baseline.json` | Active gate baseline                 | Used by `.husky/pre-push`, `scripts/architect-cast-gate.mjs`, and architect type-hardening docs | `KEEP_ACTIVE`                             | Keep at repo root; it is a live project resource.                                                                                      |
| `architect-plan-summary/`       | Condensed architect planning package | Referenced by `docs/ARCHITECT_PLAN_INDEX.md` and `docs/architect-teams-plan/*`                  | `KEEP_HISTORICAL_RELOCATE_LATER`          | Keep for now; later move under `docs/architect-teams-plan/` or archive beside that planning package.                                   |
| `audit_report_raw.txt`          | Raw report artifact                  | Tracked, but no active workspace references were found                                          | `DELETE_CANDIDATE_AFTER_PROVENANCE_CHECK` | Check whether a surviving permanent doc already captures the same information; if yes, delete or archive outside active repo surfaces. |
| `test_output.txt`               | Captured command/test output         | Tracked, but no active workspace references were found                                          | `DELETE_CANDIDATE_AFTER_PROVENANCE_CHECK` | Same as above; likely disposable output rather than a long-term resource.                                                              |
| `test-profile-output.txt`       | Captured profile/test output         | Tracked, but no active workspace references were found                                          | `DELETE_CANDIDATE_AFTER_PROVENANCE_CHECK` | Same as above; likely disposable output rather than a long-term resource.                                                              |

## 6. Low-Risk Next Move Pass

The safest first execution pass after this preflight is:

1. Keep the stable docs-root entry docs where they are.
2. Move archive-candidate docs out of the docs root only after one keeper path is
   chosen for each cluster.
3. Do not touch the TypeScript historical docs until their future historical
   home is chosen as a group.
4. Treat `audit_report_raw.txt`, `test_output.txt`, and
   `test-profile-output.txt` as provenance-review items, not immediate deletes.
5. Treat `.architect-cast-baseline.json` as protected.

## 7. Recommended Follow-Up Groups

### Group A: Safe Relocation Candidates

- `docs/new-schema-validator-review.md`
- `docs/TRADE_MACHINE_GAP_ANALYSIS.md`
- `docs/ARCHITECT_PLAN_INDEX.md`
- `docs/refactoring-plans.md`
- `architect-plan-summary/`

### Group B: Historical Campaign Bundle

- `docs/TYPESCRIPT_HARDENING_NEXT_STEPS.md`
- `docs/TS_CONVERSION_NEXT_STEPS.md`
- `docs/TS_CONVERSION_PILE_A_AUDIT.md`
- `docs/TS_CONVERSION_PILE_B_AUDIT.md`
- `docs/TS_CONVERSION_PILE_C_PLAN.md`
- `docs/TS_CONVERSION_PILE_D_TESTS_PLAN.md`

### Group C: Root Output Cleanup Candidates

- `audit_report_raw.txt`
- `test_output.txt`
- `test-profile-output.txt`

## 8. Stop Conditions

- Do not delete any tracked root file purely because it looks old.
- Do not move `.architect-cast-baseline.json`.
- Do not move TypeScript historical records one by one; handle them as a single
  routed bundle.
- Do not change the unrelated dirty files listed in Scope as part of this pass.
