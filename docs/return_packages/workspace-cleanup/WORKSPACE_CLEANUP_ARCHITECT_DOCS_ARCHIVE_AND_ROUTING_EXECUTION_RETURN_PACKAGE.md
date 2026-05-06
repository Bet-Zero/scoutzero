# Workspace Cleanup Architect Docs Archive and Routing Execution Return Package

## Scope

- Physically archive the historical `docs/architect-teams-plan/` planning bundle.
- Archive the first clean batch of obvious historical Architect root docs.
- Rewrite active/archive routers so current runtime docs and archived working
  docs are clearly separated.
- Preserve mixed Architect docs in place when they still require information
  extraction or cleaner replacement.

## Decision Rule

- Keep information that is still needed.
- Do not keep the original working file by default just because it contains
  some useful material.
- If the same information already exists elsewhere in a cleaner current doc,
  archive the older file.
- If needed information still lives only in a mixed/planning file, keep the
  file in place temporarily and mark it for extraction/replacement.

## Files Moved

### Historical Architect Planning Bundle

- `docs/architect-teams-plan/README.md` -> `archive/docs/architect-teams-plan/README.md`
- `docs/architect-teams-plan/00-IMPLEMENTATION-STATUS.md` -> `archive/docs/architect-teams-plan/00-IMPLEMENTATION-STATUS.md`
- `docs/architect-teams-plan/01-GOALS.md` -> `archive/docs/architect-teams-plan/01-GOALS.md`
- `docs/architect-teams-plan/02-CURRENT-STATUS.md` -> `archive/docs/architect-teams-plan/02-CURRENT-STATUS.md`
- `docs/architect-teams-plan/03-TARGET-SCHEMA.md` -> `archive/docs/architect-teams-plan/03-TARGET-SCHEMA.md`
- `docs/architect-teams-plan/04-HOW-IT-WORKS.md` -> `archive/docs/architect-teams-plan/04-HOW-IT-WORKS.md`
- `docs/architect-teams-plan/05-SAVE-LOAD-LOGIC.md` -> `archive/docs/architect-teams-plan/05-SAVE-LOAD-LOGIC.md`
- `docs/architect-teams-plan/06-COMPREHENSIVE-SUMMARY.md` -> `archive/docs/architect-teams-plan/06-COMPREHENSIVE-SUMMARY.md`
- `docs/architect-teams-plan/07-IMPLEMENTATION-PLAN.md` -> `archive/docs/architect-teams-plan/07-IMPLEMENTATION-PLAN.md`
- `docs/architect-teams-plan/summaries/**` -> `archive/docs/architect-teams-plan/summaries/**`

### First Obvious Architect Archive Batch

- `docs/architect/ARCHITECT_AUDIT_V3_MASTER.md` -> `archive/docs/architect/ARCHITECT_AUDIT_V3_MASTER.md`
- `docs/architect/ARCHITECT_CAP_SHEET_ACTION_BREAKDOWN.md` -> `archive/docs/architect/ARCHITECT_CAP_SHEET_ACTION_BREAKDOWN.md`
- `docs/architect/ARCHITECT_CAP_SHEET_ISSUE_LOG.md` -> `archive/docs/architect/ARCHITECT_CAP_SHEET_ISSUE_LOG.md`
- `docs/architect/ARCHITECT_CAP_SHEET_REVIEW_RECORD.md` -> `archive/docs/architect/ARCHITECT_CAP_SHEET_REVIEW_RECORD.md`
- `docs/architect/ARCHITECT_CAP_SHEET_REVIEW_TRACKER.md` -> `archive/docs/architect/ARCHITECT_CAP_SHEET_REVIEW_TRACKER.md`
- `docs/architect/ARCHITECT_CONTRACT_FLOW_REVIEW.md` -> `archive/docs/architect/ARCHITECT_CONTRACT_FLOW_REVIEW.md`
- `docs/architect/ARCHITECT_SHIP_GATES_MASTER.md` -> `archive/docs/architect/ARCHITECT_SHIP_GATES_MASTER.md`
- `docs/architect/ARCHITECT_SHIP_READINESS_MASTER.md` -> `archive/docs/architect/ARCHITECT_SHIP_READINESS_MASTER.md`
- `docs/architect/ARCHITECT_SMOKE_MASTER.md` -> `archive/docs/architect/ARCHITECT_SMOKE_MASTER.md`
- `docs/architect/ARCHITECT_TM_ACTION_BREAKDOWN.md` -> `archive/docs/architect/ARCHITECT_TM_ACTION_BREAKDOWN.md`
- `docs/architect/ARCHITECT_TM_ISSUE_LOG.md` -> `archive/docs/architect/ARCHITECT_TM_ISSUE_LOG.md`
- `docs/architect/ARCHITECT_TM_REVIEW_RECORD.md` -> `archive/docs/architect/ARCHITECT_TM_REVIEW_RECORD.md`
- `docs/architect/ARCHITECT_TM_REVIEW_TRACKER.md` -> `archive/docs/architect/ARCHITECT_TM_REVIEW_TRACKER.md`
- `docs/architect/ARCHITECT_ULTIMATE_AUDIT_BLUEPRINT.md` -> `archive/docs/architect/ARCHITECT_ULTIMATE_AUDIT_BLUEPRINT.md`
- `docs/architect/CAP_SHEET_PHASE_PLAN.md` -> `archive/docs/architect/CAP_SHEET_PHASE_PLAN.md`
- `docs/architect/CAP_SHEET_TPE_EXPIRATION_PHASE_PLAN.md` -> `archive/docs/architect/CAP_SHEET_TPE_EXPIRATION_PHASE_PLAN.md`
- `docs/architect/DRAFT_ASSET_VERIFICATION_GATES.md` -> `archive/docs/architect/DRAFT_ASSET_VERIFICATION_GATES.md`
- `docs/architect/TM7_IMPLEMENTATION_SUMMARY.md` -> `archive/docs/architect/TM7_IMPLEMENTATION_SUMMARY.md`
- `docs/architect/TM7_PICK_EDITOR_UX_COMPLETION_REPORT.md` -> `archive/docs/architect/TM7_PICK_EDITOR_UX_COMPLETION_REPORT.md`
- `docs/architect/TM7_QUICK_REFERENCE.md` -> `archive/docs/architect/TM7_QUICK_REFERENCE.md`
- `docs/architect/TRADE_MACHINE_MASTER_AUDIT.md` -> `archive/docs/architect/TRADE_MACHINE_MASTER_AUDIT.md`
- `docs/architect/TS_MIGRATION_FINISH_PLAN.md` -> `archive/docs/architect/TS_MIGRATION_FINISH_PLAN.md`
- `docs/architect/TS_MIGRATION_REEVAL_PROMPT.md` -> `archive/docs/architect/TS_MIGRATION_REEVAL_PROMPT.md`
- `docs/architect/migrations/phase67_dry_run_2026-02-01.md` -> `archive/docs/architect/migrations/phase67_dry_run_2026-02-01.md`
- `docs/architect/migrations/phase67_live_2026-02-01.md` -> `archive/docs/architect/migrations/phase67_live_2026-02-01.md`
- `docs/architect/migrations/phase67_verify_only_2026-02-01.md` -> `archive/docs/architect/migrations/phase67_verify_only_2026-02-01.md`

## Files Created

- `docs/architect-teams-plan/README.md` (router stub)
- `docs/return_packages/workspace-cleanup/WORKSPACE_CLEANUP_ARCHITECT_DOCS_ARCHIVE_AND_ROUTING_EXECUTION_RETURN_PACKAGE.md`

## Files Updated

- `archive/docs/README.md`
- `archive/docs/architect/README.md`
- `archive/docs/architect-teams-plan/README.md`
- `docs/INDEX.md`
- `docs/ARCHITECT_GAP_ANALYSIS.md`
- `docs/architect/README.md`
- `docs/reviews/ARCHITECT_REVIEW_LEDGER.md`

## Mixed Docs Deliberately Kept In Place

These docs were intentionally not archived in this pass because they still need
information extraction, replacement, or direct comparison against cleaner
current docs:

- `docs/architect/TRADE_MACHINE_MASTER.md`
- `docs/architect/EDIT_CONTRACT_MASTER.md`
- `docs/architect/CAP_SHEET_MASTER_DOC.md`
- `docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md`
- `docs/architect/CAP_RULES_PROFILE_MASTER_DOC.md`
- `docs/architect/TRADE_MACHINE_ENTITLEMENTS_ADVANCED_MASTER.md`
- `docs/architect/TRADE_MACHINE_PICK_TRADING_MASTER.md`
- `docs/architect/TRADE_MACHINE_VACUUM_MODE_MASTER.md`
- `docs/architect/ARCHITECT_CONTRACT_APPLICATION_MASTER.md`
- `docs/architect/CAP_AUDITABILITY_MASTER.md`

## Commands Run

- directory creation for new archive surfaces
- file move batches for the historical planning bundle and the first obvious Architect archive batch
- targeted file reads and text searches to classify active runtime docs versus historical working docs
- `npm run lint:md`
- `npm run docs:guardrails`
- `npm run validate:project`

## Commands Skipped

- `npm run build`: skipped because this was a documentation routing and archive pass.
- `npm run typecheck`: skipped because no executable TypeScript logic changed.
- `npm run test:*`: skipped because no runtime behavior changed.

## Outcome

- [x] The old Architect planning bundle is now physically archived.
- [x] The old planning path now acts only as a router stub.
- [x] The first obvious historical Architect root batch is archived out of the active folder.
- [x] The active Architect router now distinguishes runtime references from archive material.
- [x] Mixed docs were not archived prematurely.
