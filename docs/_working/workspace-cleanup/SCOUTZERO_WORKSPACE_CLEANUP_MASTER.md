# ScoutZero Workspace Cleanup Master

This is the living master document for the ScoutZero workspace cleanup initiative.

## Purpose

Establish the canonical documentation rules first, then track the bounded execution phases that will clean up routing, evidence placement, working-doc lifecycle, and stale references.

## Inputs

- `docs/_working/workspace-cleanup/SCOUTZERO_WORKSPACE_CLEANUP_PREFLIGHT.md`
- `docs/_working/workspace-cleanup/SCOUTZERO_WORKSPACE_CLEANUP_PREFLIGHT_RETURN_PACKAGE.md`

## Phase 1 Canonical Decisions

- Future canonical return-package root: `docs/return_packages/`
- Naming convention: underscore `return_packages` only
- Deprecated pattern: do not create `return-packages` paths
- Root `return_packages/` remains legacy historical evidence until a later consolidation phase
- `docs/_working/` is a bounded staging area, not a permanent evidence store
- Completed working docs must be reviewed and then archived, graduated to permanent docs, or deleted
- Phase 1 creates rules and routing only; it does not move, rename, archive, or delete historical content

## Phase Scope Guardrails

- No source-code changes
- No historical return-package moves
- No archive moves
- No deletions
- No renames of historical docs

## Phase Tracker

| Phase | Scope                                                         | Status      | Notes                                                                                                                                |
| ----- | ------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| 1     | Documentation standard creation                               | Completed   | Standards, canonical return-package root, and routing/ignore rules created in this phase.                                            |
| 2     | Return-package consolidation                                  | Completed   | Root `return_packages/` markdown evidence was consolidated into `docs/return_packages/docs/` and `docs/return_packages/typescript/`. |
| 3     | `docs/_working/` archive and graduation pass                  | Not Started | Completed-looking working-doc clusters still need review and classification.                                                         |
| 4     | `docs/architect/` and `docs/team-scrape/` evidence separation | Not Started | Evergreen docs and execution evidence are still mixed in active feature roots.                                                       |
| 5     | Stale-link repair                                             | Not Started | Phase 2 updated return-package routing references only; broader stale-link repair is still pending.                                  |
| 6     | Guardrail updates                                             | Not Started | Future phases may refine ignore rules, index routing, and cleanup enforcement.                                                       |

## Phase 1 Outputs

- `docs/workspace-rules/DOCUMENTATION_STRUCTURE_STANDARD.md`
- `docs/workspace-rules/RETURN_PACKAGE_STANDARD.md`
- `docs/return_packages/README.md`
- `docs/return_packages/workspace-cleanup/WORKSPACE_CLEANUP_PHASE1_RETURN_PACKAGE.md`

## Phase 2 Outputs

- `docs/return_packages/docs/POST_TYPESCRIPT_DOC_STABILIZATION_2026-05-02.md`
- `docs/return_packages/typescript/*`
- `docs/return_packages/workspace-cleanup/WORKSPACE_CLEANUP_PHASE2_RETURN_PACKAGE.md`

## Open Risks Carried Forward

- `docs/architect/` and `docs/team-scrape/` still mix evergreen docs with execution evidence; Phase 4 remains pending.
- `docs/INDEX.md` still contains additional stale links outside the bounded Phase 1 changes.
- `.claudeignore` and `docs/architecture/PROJECT_SCHEMA.md` still disagree about whether `plans/` is an active surface.
- One moved historical file, `docs/return_packages/typescript/TS-ZERO-001-RUNTIME-ESCAPES-2026-04-26.md`, now surfaces a pre-existing `markdownlint` table-format issue because it is linted under `docs/**/*.md`; Phase 2 did not rewrite historical evidence content to fix it.

## Exit Condition For Phase 1

Phase 1 is complete when the standards, cleanup master doc, canonical `docs/return_packages/` root, and narrow routing/ignore updates are in place and validated.

## Exit Condition For Phase 2

Phase 2 is complete when legacy root `return_packages/` markdown evidence is consolidated into the canonical docs-facing archive, return-package routing docs are updated, and validation confirms the legacy tracked-file list is empty while the canonical tracked-file list contains the consolidated archive.
