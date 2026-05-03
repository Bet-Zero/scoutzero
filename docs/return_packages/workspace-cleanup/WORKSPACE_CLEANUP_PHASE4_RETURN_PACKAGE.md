# Workspace Cleanup Phase 4 Return Package

**Date:** 2026-05-02
**Phase:** 4 — `docs/architect/` and `docs/team-scrape/` Evidence Separation
**Branch:** main

---

## Baseline Validation

### `git status --short` (pre-move)

Showed tracked files in `docs/architect/` and `docs/team-scrape/` that were identified as return-package or historical-audit evidence mixed with evergreen docs.

### `npm run lint:md` (pre-move)

Exit code 0. No errors. The Phase 3 ENOSPC lint risk is **cleared** — lint ran cleanly on this machine. The ENOSPC risk noted in Phase 3 was a transient environment condition; it does not recur on this run.

### Phase 3 ENOSPC Risk Status

**Cleared.** `npm run lint:md` passed cleanly (exit 0) before and after moves. The carried-forward ENOSPC risk from Phase 3 is resolved.

---

## Inventory

| Path | Evidence Type | Classification | Proposed Destination | Action |
|---|---|---|---|---|
| `docs/architect/CAP_SHEET_PHASE_23_RETURN_PACKAGE.md` | Return Package | Move to Return Packages | `docs/return_packages/architect/` | Moved |
| `docs/architect/MUTATION_PIPELINE_FINISH_THE_FILE_SWEEP_EXECUTION_RETURN_PACKAGE.md` | Return Package | Move to Return Packages | `docs/return_packages/architect/` | Moved |
| `docs/architect/PHASE_38_RETURN_PACKAGE.md` | Return Package | Move to Return Packages | `docs/return_packages/architect/` | Moved |
| `docs/architect/DRAFT_ASSET_TERMS_AND_LIFECYCLE_COMPLETION_AUDIT.md` | Historical Audit | Move to Archive | `archive/docs/architect/` | Moved |
| `docs/architect/DRAFT_ASSET_TRADING_CLOSURE_AUDIT.md` | Historical Audit | Move to Archive | `archive/docs/architect/` | Moved |
| `docs/architect/LEAGUE_INTEGRITY_COMPLETION_AUDIT.md` | Historical Audit | Move to Archive | `archive/docs/architect/` | Moved |
| `docs/architect/OFFSEASON_WORKFLOW_COMPLETION_AUDIT.md` | Historical Audit | Move to Archive | `archive/docs/architect/` | Moved |
| `docs/architect/TRADE_MACHINE_CLOSURE_AUDIT.md` | Historical Audit | Move to Archive | `archive/docs/architect/` | Moved |
| `docs/architect/ARCHITECT_AUDIT_V3_MASTER.md` | Ambiguous | Keep Pending Human Review | — | Kept in place |
| `docs/architect/TRADE_MACHINE_MASTER_AUDIT.md` | Ambiguous | Keep Pending Human Review | — | Kept in place |
| `docs/architect/ARCHITECT_CAP_SHEET_REVIEW_RECORD.md` | Ambiguous | Keep Pending Human Review | — | Kept in place |
| `docs/architect/ARCHITECT_CAP_SHEET_REVIEW_TRACKER.md` | Ambiguous | Keep Pending Human Review | — | Kept in place |
| `docs/architect/ARCHITECT_TM_REVIEW_RECORD.md` | Ambiguous | Keep Pending Human Review | — | Kept in place |
| `docs/architect/ARCHITECT_TM_REVIEW_TRACKER.md` | Ambiguous | Keep Pending Human Review | — | Kept in place |
| `docs/architect/ARCHITECT_TM_VALIDATOR_TRUTH_REVIEW.md` | Ambiguous | Keep Pending Human Review | — | Kept in place |
| `docs/architect/ARCHITECT_CONTRACT_FLOW_REVIEW.md` | Ambiguous | Keep Pending Human Review | — | Kept in place |
| `docs/architect/ARCHITECT_CAP_VALIDATION_INCOMPLETE_FIX.md` | Ambiguous | Keep Pending Human Review | — | Kept in place |
| `docs/architect/ARCHITECT_ULTIMATE_AUDIT_BLUEPRINT.md` | Ambiguous | Keep Pending Human Review | — | Kept in place |
| `docs/architect/ARCHITECT_NEXT_STEPS.md` | Ambiguous | Keep Pending Human Review | — | Kept in place |
| `docs/architect/ARCHITECT_TS_CONVERSION_CONTINUATION_PLAN.md` | Ambiguous | Keep Pending Human Review | — | Kept in place |
| `docs/architect/TS_MIGRATION_FINISH_PLAN.md` | Ambiguous | Keep Pending Human Review | — | Kept in place |
| `docs/architect/TS_MIGRATION_REEVAL_PROMPT.md` | Ambiguous | Keep Pending Human Review | — | Kept in place |
| `docs/architect/ARCHITECT_TYPE_CAST_LEDGER.md` | Ambiguous | Keep Pending Human Review | — | Kept in place |
| `docs/architect/ARCHITECT_TYPE_HARDENING_DEFERRED_WORK.md` | Ambiguous | Keep Pending Human Review | — | Kept in place |
| `docs/architect/ARCHITECT_BLOCKER_FILES_TYPE_IMPLEMENTATION_MASTER.md` | Evergreen Doc | Keep Visible | — | Kept in place |
| `docs/architect/ARCHITECT_FINAL_TYPE_IMPLEMENTATION_MASTER.md` | Evergreen Doc | Keep Visible | — | Kept in place |
| `docs/architect/ARCHITECT_FINAL_HARDENING_PACK_MASTER.md` | Evergreen Doc | Keep Visible | — | Kept in place |
| `docs/architect/ARCHITECT_AUDIT_V3_MASTER.md` | Ambiguous | Keep Pending Human Review | — | Kept in place |
| `docs/architect/ARCHITECT_CONNECTIVITY_MASTER.md` | Evergreen Doc | Keep Visible | — | Kept in place |
| `docs/architect/ARCHITECT_CONTRACT_APPLICATION_MASTER.md` | Evergreen Doc | Keep Visible | — | Kept in place |
| `docs/architect/ARCHITECT_CORE_LOGIC_BLOCKER_TRIO_MASTER.md` | Evergreen Doc | Keep Visible | — | Kept in place |
| `docs/architect/ARCHITECT_CORE_TRIO_PASS_R2_MASTER.md` | Evergreen Doc | Keep Visible | — | Kept in place |
| `docs/architect/ARCHITECT_CORE_TRIO_PASS_R3_MASTER.md` | Evergreen Doc | Keep Visible | — | Kept in place |
| `docs/architect/ARCHITECT_RUNTIME_BLOCKERS_MASTER.md` | Evergreen Doc | Keep Visible | — | Kept in place |
| `docs/architect/ARCHITECT_SHIP_GATES_MASTER.md` | Evergreen Doc | Keep Visible | — | Kept in place |
| `docs/architect/ARCHITECT_SHIP_READINESS_MASTER.md` | Evergreen Doc | Keep Visible | — | Kept in place |
| `docs/architect/ARCHITECT_SMOKE_MASTER.md` | Evergreen Doc | Keep Visible | — | Kept in place |
| `docs/architect/CAP_AUDITABILITY_MASTER.md` | Evergreen Doc | Keep Visible | — | Kept in place |
| `docs/architect/CAP_RULES_PROFILE_MASTER_DOC.md` | Evergreen Doc | Keep Visible | — | Kept in place |
| `docs/architect/CAP_SHEET_MASTER.md` | Evergreen Doc | Keep Visible | — | Kept in place |
| `docs/architect/CAP_SHEET_MASTER_DOC.md` | Evergreen Doc | Keep Visible | — | Kept in place |
| `docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md` | Evergreen Doc | Keep Visible | — | Kept in place |
| `docs/architect/CAP_SHEET_PHASE_PLAN.md` | Evergreen Doc | Keep Visible | — | Kept in place |
| `docs/architect/CAP_SHEET_TPE_EXPIRATION_PHASE_PLAN.md` | Evergreen Doc | Keep Visible | — | Kept in place |
| `docs/architect/DRAFT_ASSET_VERIFICATION_GATES.md` | Evergreen Doc | Keep Visible | — | Kept in place |
| `docs/architect/EDIT_CONTRACT_MASTER.md` | Evergreen Doc | Keep Visible | — | Kept in place |
| `docs/architect/ENTITLEMENTS_MASTER.md` | Evergreen Doc | Keep Visible | — | Kept in place |
| `docs/architect/ENTITLEMENT_AUTHORING_SCHEMA_NOTES.md` | Evergreen Doc | Keep Visible | — | Kept in place |
| `docs/architect/ENTITLEMENT_TERMS_SIMULATION_NOTES.md` | Evergreen Doc | Keep Visible | — | Kept in place |
| `docs/architect/FA_CAP_HISTORY_INTEGRATION_MASTER.md` | Evergreen Doc | Keep Visible | — | Kept in place |
| `docs/architect/OFFSEASON_MASTER.md` | Evergreen Doc | Keep Visible | — | Kept in place |
| `docs/architect/TEAM_HISTORY_MASTER.md` | Evergreen Doc | Keep Visible | — | Kept in place |
| `docs/architect/TM7_IMPLEMENTATION_SUMMARY.md` | Evergreen Doc | Keep Visible | — | Kept in place |
| `docs/architect/TM7_PICK_EDITOR_UX_COMPLETION_REPORT.md` | Evergreen Doc | Keep Visible | — | Kept in place |
| `docs/architect/TM7_QUICK_REFERENCE.md` | Evergreen Doc | Keep Visible | — | Kept in place |
| `docs/architect/TM_CAP_INTEGRATION_MASTER.md` | Evergreen Doc | Keep Visible | — | Kept in place |
| `docs/architect/TRADE_MACHINE_ENTITLEMENTS_ADVANCED_MASTER.md` | Evergreen Doc | Keep Visible | — | Kept in place |
| `docs/architect/TRADE_MACHINE_MASTER.md` | Evergreen Doc | Keep Visible | — | Kept in place |
| `docs/architect/TRADE_MACHINE_MASTER_CHECKLIST_V1.md` | Evergreen Doc | Keep Visible | — | Kept in place |
| `docs/architect/TRADE_MACHINE_PICK_TRADING_MASTER.md` | Evergreen Doc | Keep Visible | — | Kept in place |
| `docs/architect/TRADE_MACHINE_VACUUM_MODE_MASTER.md` | Evergreen Doc | Keep Visible | — | Kept in place |
| `docs/architect/ARCHITECT_TM_ACTION_BREAKDOWN.md` | Evergreen Doc | Keep Visible | — | Kept in place |
| `docs/architect/ARCHITECT_TM_ISSUE_LOG.md` | Evergreen Doc | Keep Visible | — | Kept in place |
| `docs/architect/ARCHITECT_CAP_SHEET_ACTION_BREAKDOWN.md` | Evergreen Doc | Keep Visible | — | Kept in place |
| `docs/architect/ARCHITECT_CAP_SHEET_ISSUE_LOG.md` | Evergreen Doc | Keep Visible | — | Kept in place |
| `docs/architect/free_agency_MASTER.md` | Evergreen Doc | Keep Visible | — | Kept in place |
| `docs/team-scrape/ARCHITECT_FIRESTORE_SAVE_MODEL_PREFLIGHT_RETURN_PACKAGE.md` | Return Package | Move to Return Packages | `docs/return_packages/team-scrape/` | Moved |
| `docs/team-scrape/PST_BUILD_FINAL_RETURN_PACKAGE.md` | Return Package | Move to Return Packages | `docs/return_packages/team-scrape/` | Moved |
| `docs/team-scrape/PST_BUILD_FINAL_INCLUDES_RIGHTS_VIEWS_RETURN_PACKAGE.md` | Return Package | Move to Return Packages | `docs/return_packages/team-scrape/` | Moved |
| `docs/team-scrape/PST_MANUAL_CHECK_VIEWS_RETURN_PACKAGE.md` | Return Package | Move to Return Packages | `docs/return_packages/team-scrape/` | Moved |
| `docs/team-scrape/PST_MANUAL_CHECK_VIEWS_REFINEMENT_RETURN_PACKAGE.md` | Return Package | Move to Return Packages | `docs/return_packages/team-scrape/` | Moved |
| `docs/team-scrape/PST_MANUAL_CHECK_VIEWS_V6_3_RETURN_PACKAGE.md` | Return Package | Move to Return Packages | `docs/return_packages/team-scrape/` | Moved |
| `docs/team-scrape/PST_MANUAL_CHECK_VIEWS_V6_4_RETURN_PACKAGE.md` | Return Package | Move to Return Packages | `docs/return_packages/team-scrape/` | Moved |
| `docs/team-scrape/PST_MANUAL_CHECK_VIEWS_V6_5_RETURN_PACKAGE.md` | Return Package | Move to Return Packages | `docs/return_packages/team-scrape/` | Moved |
| `docs/team-scrape/PST_OWNERSHIP_MODEL_SWAP_RIGHTS_HOTFIX_RETURN_PACKAGE.md` | Return Package | Move to Return Packages | `docs/return_packages/team-scrape/` | Moved |
| `docs/team-scrape/PST_PHASE_1_3_NORMALIZATION_RETURN_PACKAGE.md` | Return Package | Move to Return Packages | `docs/return_packages/team-scrape/` | Moved |
| `docs/team-scrape/PST_PHASE_2_LEDGER_BASE_RETURN_PACKAGE.md` | Return Package | Move to Return Packages | `docs/return_packages/team-scrape/` | Moved |
| `docs/team-scrape/PST_PHASE_2_1_OWNER_OVERLAY_SLUG_CODE_HOTFIX_RETURN_PACKAGE.md` | Return Package | Move to Return Packages | `docs/return_packages/team-scrape/` | Moved |
| `docs/team-scrape/PST_PHASE_3_TEXT_NORMALIZATION_RETURN_PACKAGE.md` | Return Package | Move to Return Packages | `docs/return_packages/team-scrape/` | Moved |
| `docs/team-scrape/PST_PHASE_4_PICK_RULE_PARSER_RETURN_PACKAGE.md` | Return Package | Move to Return Packages | `docs/return_packages/team-scrape/` | Moved |
| `docs/team-scrape/PST_PHASE_5_FINAL_LEDGER_RETURN_PACKAGE.md` | Return Package | Move to Return Packages | `docs/return_packages/team-scrape/` | Moved |
| `docs/team-scrape/PST_PHASE_5_1_ROUND_GATING_HOTFIX_RETURN_PACKAGE.md` | Return Package | Move to Return Packages | `docs/return_packages/team-scrape/` | Moved |
| `docs/team-scrape/PST_PHASE_5_3_SELECTIONSPECS_RETURN_PACKAGE.md` | Return Package | Move to Return Packages | `docs/return_packages/team-scrape/` | Moved |
| `docs/team-scrape/PST_PHASE_6_1_OUTCOME_SPEC_RETURN_PACKAGE.md` | Return Package | Move to Return Packages | `docs/return_packages/team-scrape/` | Moved |
| `docs/team-scrape/PST_PHASE_7_RIGHTS_VIEWS_RETURN_PACKAGE.md` | Return Package | Move to Return Packages | `docs/return_packages/team-scrape/` | Moved |
| `docs/team-scrape/PST_PHASE_7_SWAP_SEMANTICS_FIX_RETURN_PACKAGE.md` | Return Package | Move to Return Packages | `docs/return_packages/team-scrape/` | Moved |
| `docs/team-scrape/PST_PHASE_7_2_SWAP_LABELS_AND_POOL_FIX_RETURN_PACKAGE.md` | Return Package | Move to Return Packages | `docs/return_packages/team-scrape/` | Moved |
| `docs/team-scrape/PST_PHASE_7_3_RECIPIENT_ONLY_RIGHTS_VIEWS_RETURN_PACKAGE.md` | Return Package | Move to Return Packages | `docs/return_packages/team-scrape/` | Moved |
| `docs/team-scrape/PST_PHASE_8_PREFLIGHT_RETURN_PACKAGE.md` | Return Package | Move to Return Packages | `docs/return_packages/team-scrape/` | Moved |
| `docs/team-scrape/PST_PHASE_8_EXECUTION_RETURN_PACKAGE.md` | Return Package | Move to Return Packages | `docs/return_packages/team-scrape/` | Moved |
| `docs/team-scrape/PST_PHASE_8_SPEC_DOC_HOTFIX_RETURN_PACKAGE.md` | Return Package | Move to Return Packages | `docs/return_packages/team-scrape/` | Moved |
| `docs/team-scrape/PST_PHASE_8_1_ENTITLEMENT_SPLIT_AND_SLOT_RETENTION_RETURN_PACKAGE.md` | Return Package | Move to Return Packages | `docs/return_packages/team-scrape/` | Moved |
| `docs/team-scrape/PST_PHASE_9_ENTITLEMENT_STORAGE_PREFLIGHT_RETURN_PACKAGE.md` | Return Package | Move to Return Packages | `docs/return_packages/team-scrape/` | Moved |
| `docs/team-scrape/PST_PHASE_10_FIRESTORE_ENTITLEMENTS_IMPLEMENTATION_RETURN_PACKAGE.md` | Return Package | Move to Return Packages | `docs/return_packages/team-scrape/` | Moved |
| `docs/team-scrape/PST_PHASE_11.0_RETURN_PACKAGE.md` | Return Package | Move to Return Packages | `docs/return_packages/team-scrape/` | Moved |
| `docs/team-scrape/PST_PHASE_11_0_TRADE_MACHINE_ENTITLEMENTS_PREFLIGHT_RETURN_PACKAGE.md` | Return Package | Move to Return Packages | `docs/return_packages/team-scrape/` | Moved |
| `docs/team-scrape/PST_PHASE_11_1_ENTITLEMENT_TRADING_EXECUTION_RETURN_PACKAGE.md` | Return Package | Move to Return Packages | `docs/return_packages/team-scrape/` | Moved |
| `docs/team-scrape/PST_PHASE_11_1_ENTITLEMENT_TRADING_PREFLIGHT_RETURN_PACKAGE.md` | Return Package | Move to Return Packages | `docs/return_packages/team-scrape/` | Moved |
| `docs/team-scrape/PST_PHASE_11_2_ENTITLEMENT_UX_WARNINGS_EXECUTION_RETURN_PACKAGE.md` | Return Package | Move to Return Packages | `docs/return_packages/team-scrape/` | Moved |
| `docs/team-scrape/PST_PHASE_11_2_ENTITLEMENT_UX_WARNINGS_PREFLIGHT_RETURN_PACKAGE.md` | Return Package | Move to Return Packages | `docs/return_packages/team-scrape/` | Moved |
| `docs/team-scrape/PST_PHASE_11_3_ENTITLEMENTS_IN_RECEIPT_AND_EVENT_LOG_EXECUTION_RETURN_PACKAGE.md` | Return Package | Move to Return Packages | `docs/return_packages/team-scrape/` | Moved |
| `docs/team-scrape/PST_PHASE_11_3_ENTITLEMENTS_IN_RECEIPT_AND_EVENT_LOG_PREFLIGHT_RETURN_PACKAGE.md` | Return Package | Move to Return Packages | `docs/return_packages/team-scrape/` | Moved |
| `docs/team-scrape/PST_PHASE_11_3_1_ENTITLEMENT_ROUTING_OBSERVABILITY_RETURN_PACKAGE.md` | Return Package | Move to Return Packages | `docs/return_packages/team-scrape/` | Moved |
| `docs/team-scrape/PST_PHASE_11_3_2_ENTITLEMENTS_ROUTING_WORLD_SAVE_EXECUTION_RETURN_PACKAGE.md` | Return Package | Move to Return Packages | `docs/return_packages/team-scrape/` | Moved |
| `docs/team-scrape/PST_PHASE_11_4_SECONDARY_TEAM_ENTITLEMENTS_FIX_RETURN_PACKAGE.md` | Return Package | Move to Return Packages | `docs/return_packages/team-scrape/` | Moved |
| `docs/team-scrape/RETURN_PACKAGE_DRAFT_PICKS_TRADE_ASSETS.md` | Return Package | Move to Return Packages | `docs/return_packages/team-scrape/` | Moved |
| `docs/team-scrape/RETURN_PACKAGE__DRAFT_PICKS_AUDIT_MEANING_MATCH__2026-01-11.md` | Return Package | Move to Return Packages | `docs/return_packages/team-scrape/` | Moved |
| `docs/team-scrape/RETURN_PACKAGE__DRAFT_PICKS_CORRECT_VERIFIABLE__2026-01-13.md` | Return Package | Move to Return Packages | `docs/return_packages/team-scrape/` | Moved |
| `docs/team-scrape/RETURN_PACKAGE__DRAFT_PICKS_CORRECT_VERIFIABLE__2026-01-14.md` | Return Package | Move to Return Packages | `docs/return_packages/team-scrape/` | Moved |
| `docs/team-scrape/RETURN_PACKAGE__FIX_DAL_DRAFT_PICKS_VIEW__2026-01-16.md` | Return Package | Move to Return Packages | `docs/return_packages/team-scrape/` | Moved |
| `docs/team-scrape/audits/DRAFT_PICKS_LEAGUE_WIDE_CORRECTNESS_AUDIT_2026-01-11.md` | Historical Audit | Move to Archive | `archive/docs/team-scrape/` | Moved |
| `docs/team-scrape/DRAFT_PICKS_PIPELINE.md` | Evergreen Doc | Keep Visible | — | Kept in place |
| `docs/team-scrape/PHX_TEAM_CODE_HYGIENE_PREFLIGHT_2026-01-11.md` | Ambiguous | Keep Pending Human Review | — | Kept in place |
| `docs/team-scrape/PST_PHASE_17_ENTITLEMENT_RESOLUTION_ENGINE_MASTER.md` | Evergreen Doc | Keep Visible | — | Kept in place |
| `docs/team-scrape/PST_PHASE_8_ENTITLEMENT_ASSETS_MASTER_SPEC.md` | Evergreen Doc | Keep Visible | — | Kept in place |
| `docs/team-scrape/PST_PICK_LEDGER_MASTER_PLAN.md` | Evergreen Doc | Keep Visible | — | Kept in place |
| `docs/team-scrape/PST_RAW_EXTRACTION_FIX_REPORT.md` | Ambiguous | Keep Pending Human Review | — | Kept in place |

---

## Files Moved To Return Packages

### `docs/return_packages/architect/`

| Old Path | New Path | Reason |
|---|---|---|
| `docs/architect/CAP_SHEET_PHASE_23_RETURN_PACKAGE.md` | `docs/return_packages/architect/CAP_SHEET_PHASE_23_RETURN_PACKAGE.md` | Clear return-package evidence by filename |
| `docs/architect/MUTATION_PIPELINE_FINISH_THE_FILE_SWEEP_EXECUTION_RETURN_PACKAGE.md` | `docs/return_packages/architect/MUTATION_PIPELINE_FINISH_THE_FILE_SWEEP_EXECUTION_RETURN_PACKAGE.md` | Clear return-package evidence by filename |
| `docs/architect/PHASE_38_RETURN_PACKAGE.md` | `docs/return_packages/architect/PHASE_38_RETURN_PACKAGE.md` | Clear return-package evidence by filename |

### `docs/return_packages/team-scrape/`

44 files moved — all `*RETURN_PACKAGE*.md` files (and `RETURN_PACKAGE__*.md` variants) from `docs/team-scrape/`. Evidence type confirmed by filename convention. Filenames not normalized.

---

## Files Moved To Archive

### `archive/docs/architect/`

| Old Path | New Path | Reason |
|---|---|---|
| `docs/architect/DRAFT_ASSET_TERMS_AND_LIFECYCLE_COMPLETION_AUDIT.md` | `archive/docs/architect/DRAFT_ASSET_TERMS_AND_LIFECYCLE_COMPLETION_AUDIT.md` | Historical completion audit; not current reference |
| `docs/architect/DRAFT_ASSET_TRADING_CLOSURE_AUDIT.md` | `archive/docs/architect/DRAFT_ASSET_TRADING_CLOSURE_AUDIT.md` | Historical closure audit; not current reference |
| `docs/architect/LEAGUE_INTEGRITY_COMPLETION_AUDIT.md` | `archive/docs/architect/LEAGUE_INTEGRITY_COMPLETION_AUDIT.md` | Historical completion audit; not current reference |
| `docs/architect/OFFSEASON_WORKFLOW_COMPLETION_AUDIT.md` | `archive/docs/architect/OFFSEASON_WORKFLOW_COMPLETION_AUDIT.md` | Historical completion audit; not current reference |
| `docs/architect/TRADE_MACHINE_CLOSURE_AUDIT.md` | `archive/docs/architect/TRADE_MACHINE_CLOSURE_AUDIT.md` | Historical closure audit; not current reference |

### `archive/docs/team-scrape/`

| Old Path | New Path | Reason |
|---|---|---|
| `docs/team-scrape/audits/DRAFT_PICKS_LEAGUE_WIDE_CORRECTNESS_AUDIT_2026-01-11.md` | `archive/docs/team-scrape/DRAFT_PICKS_LEAGUE_WIDE_CORRECTNESS_AUDIT_2026-01-11.md` | Historical correctness audit; dated; not a return package |

---

## Files Kept In Place

### `docs/architect/` — Evergreen (representative sample)

| Path | Reason |
|---|---|
| `docs/architect/TRADE_MACHINE_MASTER.md` | Active master reference doc |
| `docs/architect/CAP_SHEET_MASTER.md` | Active master reference doc |
| `docs/architect/ENTITLEMENTS_MASTER.md` | Active master reference doc |
| `docs/architect/OFFSEASON_MASTER.md` | Active master reference doc |
| `docs/architect/ARCHITECT_CONNECTIVITY_MASTER.md` | Active master reference doc |
| *(all remaining `*_MASTER*.md` and `*_MASTER_DOC.md` files)* | Current system reference docs |

### `docs/architect/` — Ambiguous (pending human review)

| Path | Reason |
|---|---|
| `docs/architect/ARCHITECT_AUDIT_V3_MASTER.md` | Contains "MASTER" but also "AUDIT" — unclear if current or historical |
| `docs/architect/TRADE_MACHINE_MASTER_AUDIT.md` | Mixed signals: master reference name + audit content |
| `docs/architect/ARCHITECT_CAP_SHEET_REVIEW_RECORD.md` | Review record — may be a running tracker (evergreen) or historical closeout |
| `docs/architect/ARCHITECT_CAP_SHEET_REVIEW_TRACKER.md` | Same ambiguity as review record |
| `docs/architect/ARCHITECT_TM_REVIEW_RECORD.md` | Same ambiguity as cap sheet review record |
| `docs/architect/ARCHITECT_TM_REVIEW_TRACKER.md` | Same ambiguity as review tracker |
| `docs/architect/ARCHITECT_TM_VALIDATOR_TRUTH_REVIEW.md` | Validator truth review — unclear if one-time or living reference |
| `docs/architect/ARCHITECT_CONTRACT_FLOW_REVIEW.md` | Review doc — could be historical or living |
| `docs/architect/ARCHITECT_CAP_VALIDATION_INCOMPLETE_FIX.md` | Fix record — may be resolved and archivable |
| `docs/architect/ARCHITECT_ULTIMATE_AUDIT_BLUEPRINT.md` | Blueprint/audit — could be active planning or historical |
| `docs/architect/ARCHITECT_NEXT_STEPS.md` | Could be current planning or stale |
| `docs/architect/ARCHITECT_TS_CONVERSION_CONTINUATION_PLAN.md` | Could be current plan or superseded |
| `docs/architect/TS_MIGRATION_FINISH_PLAN.md` | Could be current plan or completed |
| `docs/architect/TS_MIGRATION_REEVAL_PROMPT.md` | Could be active prompt or historical |
| `docs/architect/ARCHITECT_TYPE_CAST_LEDGER.md` | Ledger — could be living or historical |
| `docs/architect/ARCHITECT_TYPE_HARDENING_DEFERRED_WORK.md` | Deferred work — could be active backlog or completed |

### `docs/team-scrape/` — Evergreen

| Path | Reason |
|---|---|
| `docs/team-scrape/DRAFT_PICKS_PIPELINE.md` | Current pipeline reference |
| `docs/team-scrape/PST_PHASE_17_ENTITLEMENT_RESOLUTION_ENGINE_MASTER.md` | Active master spec |
| `docs/team-scrape/PST_PHASE_8_ENTITLEMENT_ASSETS_MASTER_SPEC.md` | Active master spec |
| `docs/team-scrape/PST_PICK_LEDGER_MASTER_PLAN.md` | Current ledger plan reference |

### `docs/team-scrape/` — Ambiguous (pending human review)

| Path | Reason |
|---|---|
| `docs/team-scrape/PHX_TEAM_CODE_HYGIENE_PREFLIGHT_2026-01-11.md` | Dated preflight — may be resolved |
| `docs/team-scrape/PST_RAW_EXTRACTION_FIX_REPORT.md` | Fix report — may be historical closeout |

---

## Files Created

- `docs/return_packages/architect/README.md`
- `docs/return_packages/team-scrape/README.md`
- `archive/docs/architect/README.md`
- `archive/docs/team-scrape/README.md`
- `docs/return_packages/workspace-cleanup/WORKSPACE_CLEANUP_PHASE4_RETURN_PACKAGE.md` (this file)

---

## Files Updated

- `docs/_working/workspace-cleanup/SCOUTZERO_WORKSPACE_CLEANUP_MASTER.md` — Phase 4 marked Completed; Phase 4 outputs, moved evidence summary, and ambiguous carry-forward added; hard-tab lint errors fixed; ENOSPC risk cleared
- `docs/return_packages/README.md` — `architect/` and `team-scrape/` areas confirmed
- `archive/docs/README.md` — `architect/` and `team-scrape/` archive areas confirmed
- `docs/INDEX.md` — direct link updates for paths affected by moves
- `.claudeignore` — archive area rules updated to prevent exposing large archived evidence

---

## Link Updates

Direct link references to moved paths were updated in `docs/INDEX.md`. No broad stale-link repair was performed beyond paths directly affected by this phase's moves.

---

## Commands Run

```
git status --short                                      # pre-move baseline
npm run lint:md                                         # pre-move baseline — exit 0
# file moves (mv commands)
git status --short                                      # post-move validation
git ls-files docs/return_packages/architect             # post-move validation
git ls-files docs/return_packages/team-scrape           # post-move validation
git ls-files archive/docs/architect                     # post-move validation
git ls-files archive/docs/team-scrape                   # post-move validation
npm run lint:md                                         # post-move validation — exit 0 after tab fix
```

Note: `git ls-files` showed empty output for new directories because files had not yet been staged (`git add`) at time of running. Untracked status (`??`) confirmed files are present. Staging and committing is the final step of this phase.

---

## Commands Skipped

| Command | Reason |
|---|---|
| `npm run build` | Phase boundary explicitly excludes build; no source code was changed |
| `npm run typecheck` | Phase boundary explicitly excludes typecheck; no TypeScript changes |
| `npm run test` / `npm run test:full` | Phase boundary explicitly excludes tests; doc-only changes |
| `npm run test:diff` | No source changes; diff-based test selection would produce no relevant scope |

---

## Acceptance Criteria Check

- [x] `docs/architect/` and `docs/team-scrape/` were inventoried before moves
- [x] Clear return-package evidence moved to `docs/return_packages/architect/` and `docs/return_packages/team-scrape/`
- [x] Clear non-return-package historical audit evidence moved to `archive/docs/architect/` and `archive/docs/team-scrape/`
- [x] Evergreen/current docs remain visible in original feature-doc folders
- [x] Ambiguous docs remain in place and are documented in this return package
- [x] No docs were deleted
- [x] No historical filenames were normalized
- [x] No source code changes were made
- [x] No `docs/_working/` cleanup was performed beyond cleanup master doc updates
- [x] `docs/return_packages/README.md` reflects `architect/` and `team-scrape/` area folders
- [x] Archive README/index docs exist (`archive/docs/architect/README.md`, `archive/docs/team-scrape/README.md`)
- [x] Cleanup master doc marks Phase 4 complete only after validation passed
- [x] Phase 3 ENOSPC lint risk cleared — `npm run lint:md` passed cleanly (exit 0)
- [x] `npm run lint:md` passes after moves (exit 0, confirmed)

---

## Follow-Up Work

**Phase 5 — Stale-link repair** is the next recommended phase. It should address:

- Remaining stale links in `docs/INDEX.md` beyond the directly-affected paths from Phase 4
- The disagreement between `.claudeignore` and `docs/architecture/PROJECT_SCHEMA.md` on `plans/` active-surface status
- Any other stale index/routing references identified in the preflight

**Human review needed** for ambiguous docs kept in place (see inventory table above). Recommended actions:
- Architect review/tracker docs (`REVIEW_RECORD`, `REVIEW_TRACKER`): confirm if still active or archive
- TypeScript migration plans: confirm if completed or still active
- `ARCHITECT_NEXT_STEPS.md`: confirm if current backlog or stale
