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

| Phase | Scope                                                         | Status    | Notes                                                                                                                                                                                                                                                            |
| ----- | ------------------------------------------------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | Documentation standard creation                               | Completed | Standards, canonical return-package root, and routing/ignore rules created in this phase.                                                                                                                                                                        |
| 2     | Return-package consolidation                                  | Completed | Root `return_packages/` markdown evidence was consolidated into `docs/return_packages/docs/` and `docs/return_packages/typescript/`.                                                                                                                             |
| 3     | `docs/_working/` archive and graduation pass                  | Completed | Completed-looking architect working clusters were archived under `archive/docs/_working/architect/`; active/ambiguous clusters remain in place.                                                                                                                  |
| 4     | `docs/architect/` and `docs/team-scrape/` evidence separation | Completed | Clear return-package evidence moved to `docs/return_packages/{architect,team-scrape}/`; clear historical audits moved to `archive/docs/{architect,team-scrape}/`; ambiguous docs kept in place.                                                                  |
| 5     | Stale-link repair                                             | Completed | Active navigation routes were repaired, the `plans/` visibility split was aligned with repo reality, and `npm run lint:md` passed after documenting the unresolved no-replacement legacy references carried forward from older architect and trade-machine docs. |
| 6     | Guardrail updates                                             | Completed | Workspace guardrail policy and lightweight docs validation now reinforce return-package, working-doc, archive, and plans rules; `npm run lint:md`, `npm run docs:guardrails`, and `npm run validate:project` all passed after the Phase 6 changes.               |

## Phase 1 Outputs

- `docs/workspace-rules/DOCUMENTATION_STRUCTURE_STANDARD.md`
- `docs/workspace-rules/RETURN_PACKAGE_STANDARD.md`
- `docs/return_packages/README.md`
- `docs/return_packages/workspace-cleanup/WORKSPACE_CLEANUP_PHASE1_RETURN_PACKAGE.md`

## Phase 2 Outputs

- `docs/return_packages/docs/POST_TYPESCRIPT_DOC_STABILIZATION_2026-05-02.md`
- `docs/return_packages/typescript/*`
- `docs/return_packages/workspace-cleanup/WORKSPACE_CLEANUP_PHASE2_RETURN_PACKAGE.md`

## Phase 3 Outputs

- `archive/docs/README.md`
- `archive/docs/_working/README.md`
- `archive/docs/_working/architect/README.md`
- `archive/docs/_working/architect/league-view/*`
- `archive/docs/_working/architect/multi-year-cap-table/*`
- `archive/docs/_working/architect/offseason/*`
- `archive/docs/_working/architect/system-integration/*`
- `archive/docs/_working/architect/team-history/*`
- `archive/docs/_working/architect/world-time/*`
- `archive/docs/_working/architect/chat-workflow/ARCHITECT_CHAT_WORKFLOW_CONTINUATION_GUIDE.md`
- `archive/docs/_working/architect/chat-workflow/ARCHITECT_CHAT_WORKFLOW_CONTINUATION_GUIDE_V2.md`
- `docs/return_packages/workspace-cleanup/WORKSPACE_CLEANUP_PHASE3_RETURN_PACKAGE.md`

## Phase 4 Outputs

- `docs/return_packages/architect/README.md`
- `docs/return_packages/team-scrape/README.md`
- `archive/docs/architect/README.md`
- `archive/docs/team-scrape/README.md`
- `docs/return_packages/workspace-cleanup/WORKSPACE_CLEANUP_PHASE4_RETURN_PACKAGE.md`

## Phase 5 Outputs

- `docs/return_packages/workspace-cleanup/WORKSPACE_CLEANUP_PHASE5_RETURN_PACKAGE.md`

## Phase 6 Outputs

- `docs/workspace-rules/WORKSPACE_GUARDRAILS.md`
- `scripts/docs/checkWorkspaceGuardrails.mjs`
- `docs/return_packages/workspace-cleanup/WORKSPACE_CLEANUP_PHASE6_RETURN_PACKAGE.md`

## Follow-Up Outputs

- `docs/return_packages/workspace-cleanup/WORKSPACE_CLEANUP_HISTORICAL_DOCS_FOLLOWUP_PREFLIGHT_RETURN_PACKAGE.md`
- `docs/_working/workspace-cleanup/SCOUTZERO_WORKSPACE_CLEANUP_HISTORICAL_DOCS_ADJUDICATION_CHECKLIST.md`

## Archived Clusters In Phase 3

- `docs/_working/architect/league-view/` -> `archive/docs/_working/architect/league-view/`
- `docs/_working/architect/multi-year-cap-table/` -> `archive/docs/_working/architect/multi-year-cap-table/`
- `docs/_working/architect/offseason/` -> `archive/docs/_working/architect/offseason/`
- `docs/_working/architect/system-integration/` -> `archive/docs/_working/architect/system-integration/`
- `docs/_working/architect/team-history/` -> `archive/docs/_working/architect/team-history/`
- `docs/_working/architect/world-time/` -> `archive/docs/_working/architect/world-time/`
- Superseded chat workflow guides archived to `archive/docs/_working/architect/chat-workflow/`

## Open Risks Carried Forward

- Older architect and trade-machine docs still reference missing historical return-package artifacts with no clear canonical replacement. A bounded preflight inventory now exists at `docs/return_packages/workspace-cleanup/WORKSPACE_CLEANUP_HISTORICAL_DOCS_FOLLOWUP_PREFLIGHT_RETURN_PACKAGE.md`.
- The active manual-review workflow for those carried-forward docs now lives at `docs/_working/workspace-cleanup/SCOUTZERO_WORKSPACE_CLEANUP_HISTORICAL_DOCS_ADJUDICATION_CHECKLIST.md`.
- The affected carried-forward examples remain `docs/architect/ARCHITECT_CAP_SHEET_REVIEW_TRACKER.md`, `docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md`, `docs/architect/EDIT_CONTRACT_MASTER.md`, `docs/architect/TRADE_MACHINE_MASTER.md`, and `docs/tradeMachine/TRADE_MACHINE_DRAFT_PICKS_MASTER.md`; they still require human review because representative targets are absent from the current workspace.
- Active or ambiguous working-doc clusters kept in place for follow-up review: `docs/_working/workspace-cleanup/`, `docs/_working/architect/free-agency/`, `docs/_working/architect/roster/`, and `docs/_working/architect/ARCHITECT_REMAINING_REVIEW_ROADMAP.md`.

## Current Cleanup Status

- Canonical workspace rules now live under `docs/workspace-rules/` with a short guardrail checklist in `WORKSPACE_GUARDRAILS.md`.
- New execution evidence is routed through `docs/return_packages/<area>/`, while historical docs remain under `archive/docs/` and archived plans remain under `plans/_archive/`.
- A lightweight guardrail command now exists to scan active routing docs, plans visibility, and forbidden feature-root return-package surfaces before docs changes are closed.
- A bounded historical-doc preflight now captures the blocked repair inventory, so remaining follow-up work is limited to the carried-forward human-review items above rather than another broad workspace cleanup pass.
- The carried-forward historical-doc follow-up now has a concrete adjudication checklist that can be worked one document at a time without reopening the broader cleanup.

## Phase 4 Moved Evidence Summary

- Return-package evidence moved from active feature roots:
  - `docs/architect/*RETURN_PACKAGE*.md` -> `docs/return_packages/architect/`
  - `docs/team-scrape/*RETURN_PACKAGE*.md` -> `docs/return_packages/team-scrape/`
- Non-return-package historical evidence moved to archive:
  - `docs/architect/*_AUDIT.md` closeout set -> `archive/docs/architect/`
  - `docs/team-scrape/audits/DRAFT_PICKS_LEAGUE_WIDE_CORRECTNESS_AUDIT_2026-01-11.md` -> `archive/docs/team-scrape/`

## Phase 4 Ambiguous Docs Carried Forward

- Architect docs with mixed evergreen/history signal were kept in place for human review, including:
  - `docs/architect/ARCHITECT_AUDIT_V3_MASTER.md`
  - `docs/architect/TRADE_MACHINE_MASTER_AUDIT.md`
  - `docs/architect/ARCHITECT_CAP_SHEET_REVIEW_RECORD.md`
  - `docs/architect/ARCHITECT_TM_REVIEW_RECORD.md`
- Team-scrape docs with mixed evergreen/history signal were kept in place for human review, including:
  - `docs/team-scrape/PHX_TEAM_CODE_HYGIENE_PREFLIGHT_2026-01-11.md`
  - `docs/team-scrape/PST_RAW_EXTRACTION_FIX_REPORT.md`

## Exit Condition For Phase 1

Phase 1 is complete when the standards, cleanup master doc, canonical `docs/return_packages/` root, and narrow routing/ignore updates are in place and validated.

## Exit Condition For Phase 2

Phase 2 is complete when legacy root `return_packages/` markdown evidence is consolidated into the canonical docs-facing archive, return-package routing docs are updated, and validation confirms the legacy tracked-file list is empty while the canonical tracked-file list contains the consolidated archive.
