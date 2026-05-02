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

| Phase | Scope                                                         | Status      | Notes                                                                                     |
| ----- | ------------------------------------------------------------- | ----------- | ----------------------------------------------------------------------------------------- |
| 1     | Documentation standard creation                               | Completed   | Standards, canonical return-package root, and routing/ignore rules created in this phase. |
| 2     | Return-package consolidation                                  | Not Started | Legacy root `return_packages/` remains untouched until this phase.                        |
| 3     | `docs/_working/` archive and graduation pass                  | Not Started | Completed-looking working-doc clusters still need review and classification.              |
| 4     | `docs/architect/` and `docs/team-scrape/` evidence separation | Not Started | Evergreen docs and execution evidence are still mixed in active feature roots.            |
| 5     | Stale-link repair                                             | Not Started | Phase 1 updates only the standards and return-package routing references.                 |
| 6     | Guardrail updates                                             | Not Started | Future phases may refine ignore rules, index routing, and cleanup enforcement.            |

## Phase 1 Outputs

- `docs/workspace-rules/DOCUMENTATION_STRUCTURE_STANDARD.md`
- `docs/workspace-rules/RETURN_PACKAGE_STANDARD.md`
- `docs/return_packages/README.md`
- `docs/return_packages/workspace-cleanup/WORKSPACE_CLEANUP_PHASE1_RETURN_PACKAGE.md`

## Open Risks Carried Forward

- Root `return_packages/` still contains legacy historical evidence and remains ignored for new work.
- `docs/INDEX.md` still contains additional stale links outside the bounded Phase 1 changes.
- `.claudeignore` and `docs/architecture/PROJECT_SCHEMA.md` still disagree about whether `plans/` is an active surface.

## Exit Condition For Phase 1

Phase 1 is complete when the standards, cleanup master doc, canonical `docs/return_packages/` root, and narrow routing/ignore updates are in place and validated.
