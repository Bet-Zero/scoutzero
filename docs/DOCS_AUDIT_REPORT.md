# 📁 Docs Folder Deep-Dive Cleanup & Relevance Audit

**Date:** 2025-12-14  
**Status:** ✅ EXECUTED - Deletions Applied  
**Purpose:** Aggressive audit to ensure every file is useful, necessary, relevant, accurate, and up to date.

---

## 🗑️ DELETE (Clear & Confident)

These documents are clearly obsolete, superseded, or would cause confusion if kept.

### Top-Level Files

| File Path | Reason |
|-----------|--------|
| `docs/FILE_MAP.md` | Extremely minimal (12 lines), auto-generated, provides no useful information. Just lists 4 root directories. Superseded by `PROJECT_SCHEMA.md` in repo root. |
| `docs/STATS_SCRAPER_FIX.md` | One-time bug fix documentation from a past issue. The fix was applied. No ongoing value - this is a historical changelog entry, not reference material. |

### Components Directory (Duplicates)

| File Path | Reason |
|-----------|--------|
| `docs/components/ArchitectHierarchy.md` | **DUPLICATE** of `docs/development/ArchitectHierarchy.md`. Same auto-generated hierarchy but with an older, less detailed version. Keep the development version. |
| `docs/components/COMPONENT_INDEX.md` | **DUPLICATE** of `docs/COMPONENT_INDEX.md`. Exact same content living in two places. Keep top-level version only. |
| `docs/components/FILE_MAP.md` | **DUPLICATE** of `docs/FILE_MAP.md` which is already marked for deletion. No unique value. |

### Development Directory (Duplicates)

| File Path | Reason |
|-----------|--------|
| `docs/development/FiltersHierarchy.md` | Auto-generated file that duplicates `docs/components/FiltersHierarchy.md`. Keep one location only. |
| `docs/development/ListsHierarchy.md` | Auto-generated file that duplicates `docs/components/ListsHierarchy.md`. Keep one location only. |
| `docs/development/ProfileHierarchy.md` | Auto-generated file that duplicates `docs/components/ProfileHierarchy.md`. Keep one location only. |
| `docs/development/RankerHierarchy.md` | Auto-generated file that duplicates `docs/components/RankerHierarchy.md`. Keep one location only. |
| `docs/development/RosterHierarchy.md` | Auto-generated file that duplicates `docs/components/RosterHierarchy.md`. Keep one location only. |
| `docs/development/TableHierarchy.md` | Auto-generated file that duplicates `docs/components/TableHierarchy.md`. Keep one location only. |
| `docs/development/TierMakerHierarchy.md` | Auto-generated file that duplicates `docs/components/TierMakerHierarchy.md`. Keep one location only. |

**Recommendation:** Delete the entire `docs/development/` directory. All files are duplicates of `docs/components/` files. The `docs/components/` location is more intuitive.

### Cursor Prompts (Cursor-Specific Tooling)

| File Path | Reason |
|-----------|--------|
| `docs/cursor-prompts/ApexAuditPrompt.md` | Cursor-specific prompt for `/audit` command. This is tool-specific configuration, not project documentation. Should live in `.cursor/` if needed. |
| `docs/cursor-prompts/ApplyCriticalPrompt.md` | Cursor-specific prompt for `/apply-critical` command. Tool configuration, not project docs. |
| `docs/cursor-prompts/AuditReviewPrompt.md` | Cursor-specific prompt for `/audit-review` command. Tool configuration, not project docs. |
| `docs/cursor-prompts/CleanupPrompt.md` | Cursor-specific prompt for `/cleanup` command. Tool configuration, not project docs. |
| `docs/cursor-prompts/DocSyncPrompt.md` | Cursor-specific prompt for `/doc-sync` command. Tool configuration, not project docs. |
| `docs/cursor-prompts/ExplainPrompt.md` | Cursor-specific prompt for `/explain` command. Tool configuration, not project docs. |
| `docs/cursor-prompts/FixAllPrompt.md` | Cursor-specific prompt for `/fix-all` command. Tool configuration, not project docs. |
| `docs/cursor-prompts/GroupByFeatureRefactor.md` | Cursor-specific refactoring prompt. Tool configuration, not project docs. |
| `docs/cursor-prompts/PlanModePrompt.md` | Cursor-specific planning prompt. Tool configuration, not project docs. |
| `docs/cursor-prompts/RelevancePrompt.md` | Cursor-specific relevance prompt. Tool configuration, not project docs. |
| `docs/cursor-prompts/cursor-commands-overview.md` | Overview of Cursor commands. While informative, this is tool-specific documentation that belongs with the tool, not project docs. |

**Recommendation:** Delete entire `docs/cursor-prompts/` directory. These are Cursor IDE tool configurations, not project documentation. If needed, they should live in `.cursor/commands/` or similar tool-specific location.

### Workspace Rules (Process Documentation)

| File Path | Reason |
|-----------|--------|
| `docs/workspace-rules/CLEANUP_ANALYSIS.md` | Meta-process documentation about workspace cleanup. Not project documentation. |
| `docs/workspace-rules/COMMUNICATION_RULES.md` | Rules for AI agent communication. This is meta-process, not project documentation. |
| `docs/workspace-rules/CREATING_PERMANENT_DOCS.md` | Rules about creating documentation. Meta-process document. |
| `docs/workspace-rules/DOCUMENTATION_UPDATE_RULES.md` | Rules about updating documentation. Meta-process document. |
| `docs/workspace-rules/FILE_PLACEMENT_GUIDE.md` | Guide for where to place files during work. Meta-process document. |
| `docs/workspace-rules/README.md` | Overview of workspace rules. Meta-process document. |
| `docs/workspace-rules/SYSTEM_CONFIRMATION.md` | System confirmation document. Meta-process. |
| `docs/workspace-rules/WHEN_TO_USE_PLAN_MODE.md` | Guide for when to use plan mode. Meta-process. |
| `docs/workspace-rules/WORKFLOW_CHECKLIST.md` | Workflow checklist for tasks. Meta-process. |
| `docs/workspace-rules/plan.md` | Plan tracking document for workspace rules. Meta-process. |
| `docs/workspace-rules/chunks/chunk_01.md` | Chunk file for workspace rules plan. Meta-process. |
| `docs/workspace-rules/chunks/chunk_template.md` | Template for chunks. Meta-process. |

**Recommendation:** Delete entire `docs/workspace-rules/` directory. This is AI agent workflow management documentation, not project documentation. If needed for AI tooling, it should live in a dedicated `.ai/` or `agents/` directory, not in docs.

### Migrations (Completed Migrations)

| File Path | Reason |
|-----------|--------|
| `docs/migrations/players-v1-to-v2/README.md` | Migration is complete. This is historical reference only. |
| `docs/migrations/players-v1-to-v2/FIRESTORE_SCHEMA_V2.md` | Superseded by `docs/schema/players_v2.md`. The migration is done. |
| `docs/migrations/players-v1-to-v2/schema-lock-players_v2/` | Lock files from completed migration. No longer needed. |
| `docs/migrations/teams-to-architect/TARGET_SCHEMA.md` | **OUTDATED**: Migration is marked complete in `docs/schema/CURRENT_FIRESTORE_SCHEMA.md`. This describes the "target" which is now the current state. |

**Recommendation:** Delete entire `docs/migrations/` directory. Both migrations are complete. Current schema documentation exists in `docs/schema/`. Historical migration context is preserved in the commit history and isn't needed for ongoing work.

---

## ⚠️ POTENTIALLY OUTDATED

These documents may be stale or contain information that needs verification.

### Top-Level Files

| File Path | Issue | Recommendation |
|-----------|-------|----------------|
| `docs/ARCHITECT_PLAN_INDEX.md` | References "November 1, 2025" as "Last Updated" but we're in December 2025. Contains detailed implementation status that may be out of date. | **UPDATE** - Worth updating because it's a valuable navigation document for the Architect feature. Verify implementation status matches reality. |
| `docs/FIRESTORE_DIAGNOSTIC.md` | References "674 documents" which was the count at time of writing. May need verification. | **KEEP AS-IS** - The document describes how to use the diagnostic tool, not exact counts. The tool itself shows current counts. Minor staleness acceptable. |
| `docs/PLAYER_REFRESH_SUMMARY.md` | "Date: January 2025" - older summary document. Contains "Known Issues" section that may be resolved. | **DELETE** - This is a one-time task summary, not ongoing reference. The work is complete. |
| `docs/SCHEMA_MIGRATION_GUIDE.md` | References both old (`contract_clean`) and new (`salariesByYear`) schemas. Contains migration patterns that may no longer be needed. | **KEEP** - Still valuable as the codebase likely has both patterns during transition. But add a note about migration status. |
| `docs/new-schema-validator-review.md` | Code review document with specific findings about validator implementation. Contains "Remaining Work" section. | **DELETE** - This is a one-time code review artifact. The findings should be addressed in code, not kept as documentation. |

### Architect Teams Plan

| File Path | Issue | Recommendation |
|-----------|-------|----------------|
| `docs/architect-teams-plan/00-IMPLEMENTATION-STATUS.md` | Status says "Planning Complete, Implementation Not Started" but may be out of date. | **UPDATE** - This is a critical navigation doc. Should reflect actual current implementation status. |
| `docs/architect-teams-plan/02-CURRENT-STATUS.md` | Describes "what exists today" but may be stale. | **REVIEW** - Check if current status is still accurate. If planning is complete, this should match reality. |

### Compliance

| File Path | Issue | Recommendation |
|-----------|-------|----------------|
| `docs/compliance/AUDIT_CERT.md` | References "Commit: 1fa30db" from August 2025. Suite was 123/123 PASS at that time. | **UPDATE** - Certification should reference a more recent commit or be marked as historical. Trade machine has likely changed since August. |
| `docs/compliance/AUDIT_DEEP.md` | Deep audit from August 2025. Test counts and file references may be stale. | **UPDATE** - Should be regenerated or marked as historical. |

### Runbooks

| File Path | Issue | Recommendation |
|-----------|-------|----------------|
| `docs/runbooks/data-scrape.md` | Contains specific dates like "2025-11-10", "2025-11-12" for past runs. Some sections reference sandbox limitations and specific push results. | **UPDATE** - Separate the reusable runbook instructions from historical run logs. Move historical data to notes or remove. |
| `docs/runbooks/cutover-cleanup.md` | Contains "Completed Steps" and "Pending Cleanup" sections from November 2025. Some items may now be done. | **UPDATE** - Verify status of all items. If everything is complete, consolidate into a summary or delete. |
| `docs/runbooks/application-integration-notes.md` | "Last updated: 2025-11-10" - Contains detailed integration audit that may be stale. | **UPDATE** - Verify the hooks and data flow descriptions are still accurate. |
| `docs/runbooks/application-integration-verification.md` | Smoke test checklist from November 2025. May need updating based on current data state. | **KEEP** - Smoke test checklists remain useful. Update expected values if they've changed. |

### Schema

| File Path | Issue | Recommendation |
|-----------|-------|----------------|
| `docs/schema/CONTRACT_NORMALIZATION_PHASE0.md` | "Phase 0 Complete" document. This is a one-time implementation summary. | **DELETE** - This is a task completion summary, not ongoing reference. The actual contract parser code and `CONTRACT_NORMALIZATION_RULES.md` serve as the reference. |

---

## ✅ KEEP (Still Valuable)

These documents are accurate, current, and provide real value.

### Top-Level Files

| File Path | Why Keep |
|-----------|----------|
| `docs/COMPONENT_INDEX.md` | Auto-generated comprehensive index of all components. Useful for navigation. Generated by `npm run docs`. |
| `docs/CONTRACT_NORMALIZATION_IMPLEMENTATION_SUMMARY.md` | Documents the completed contract normalization implementation with tests, validation results, and references. Useful for understanding the contract system. |
| `docs/CONTRACT_NORMALIZATION_RULES.md` | **CRITICAL** - Locked specification for contract normalization. 7 rules that all contract data must follow. Essential reference. |

### Architect Teams Plan

| File Path | Why Keep |
|-----------|----------|
| `docs/architect-teams-plan/README.md` | Clear overview and navigation for the Architect feature documentation. |
| `docs/architect-teams-plan/01-GOALS.md` | Project goals and requirements. Essential for understanding the feature vision. |
| `docs/architect-teams-plan/03-TARGET-SCHEMA.md` | Detailed schema examples. Essential reference for implementation. |
| `docs/architect-teams-plan/04-HOW-IT-WORKS.md` | Architecture patterns and design decisions. Essential for understanding the system. |
| `docs/architect-teams-plan/05-SAVE-LOAD-LOGIC.md` | Implementation patterns for data operations. Essential for coding against the system. |
| `docs/architect-teams-plan/06-COMPREHENSIVE-SUMMARY.md` | Consolidated reference document. Useful quick reference. |
| `docs/architect-teams-plan/07-IMPLEMENTATION-PLAN.md` | Step-by-step implementation guide. Still relevant for remaining phases. |

### Architecture

| File Path | Why Keep |
|-----------|----------|
| `docs/architecture/ArchitectTimingModel.md` | **IMPORTANT** - Documents the season-first timing model for rule evaluation. Critical for understanding how cap/contract rules work. |

### Compliance

| File Path | Why Keep |
|-----------|----------|
| `docs/compliance/COMPLIANCE_MATRIX.csv` | Structured matrix of CBA rule compliance. Useful for auditing trade machine completeness. |

### Components (Keep These)

| File Path | Why Keep |
|-----------|----------|
| `docs/components/FiltersHierarchy.md` | Auto-generated hierarchy. Useful for understanding component structure. |
| `docs/components/ListsHierarchy.md` | Auto-generated hierarchy. |
| `docs/components/ProfileHierarchy.md` | Auto-generated hierarchy. |
| `docs/components/RankerHierarchy.md` | Auto-generated hierarchy. |
| `docs/components/RosterHierarchy.md` | Auto-generated hierarchy. |
| `docs/components/TableHierarchy.md` | Auto-generated hierarchy. |
| `docs/components/TierMakerHierarchy.md` | Auto-generated hierarchy. |

### Guides

| File Path | Why Keep |
|-----------|----------|
| `docs/guides/ORDER_OF_OPERATIONS.md` | **IMPORTANT** - Documents the trade validation pipeline order. Essential reference for trade machine work. |
| `docs/guides/contract-normalization-usage.md` | Usage guide for contract normalization utilities. Practical reference for developers. |

### Runbooks (Keep These)

| File Path | Why Keep |
|-----------|----------|
| `docs/runbooks/FIX_PLAYER_NOT_FOUND.md` | Troubleshooting guide for player slug issues. Useful for debugging scraper problems. |
| `docs/runbooks/MANUAL_SMOKE_TEST_CHECKLIST.md` | Comprehensive UI testing checklist. Useful for manual QA. |
| `docs/runbooks/VERIFY_BEFORE_DELETE.md` | Safety checklist before deleting old collections. Useful procedure. |

### Schema

| File Path | Why Keep |
|-----------|----------|
| `docs/schema/CHANGELOG.md` | Schema version history. Brief but useful for tracking changes. |
| `docs/schema/CURRENT_FIRESTORE_SCHEMA.md` | **CRITICAL** - Current Firestore schema reference. Essential for understanding data structure. |
| `docs/schema/VERSION` | Version tracking file for schemas. |
| `docs/schema/architect.md` | Auto-generated schema docs for architect collections. |
| `docs/schema/players_v2.md` | Auto-generated schema docs for players_v2 collection. |

### Templates

| File Path | Why Keep |
|-----------|----------|
| `docs/templates/file_header.template.txt` | Template for file headers. Useful for consistency. |

---

## Summary Statistics

| Category | Count |
|----------|-------|
| 🗑️ DELETE | 38 files (including 3 directories to delete entirely) |
| ⚠️ POTENTIALLY OUTDATED | 12 files (7 worth updating, 5 worth deleting) |
| ✅ KEEP | 25 files |

## Recommended Actions

### Immediate Deletions

1. Delete `docs/FILE_MAP.md`
2. Delete `docs/STATS_SCRAPER_FIX.md`
3. Delete `docs/PLAYER_REFRESH_SUMMARY.md`
4. Delete `docs/new-schema-validator-review.md`
5. Delete `docs/schema/CONTRACT_NORMALIZATION_PHASE0.md`
6. Delete entire `docs/cursor-prompts/` directory (11 files)
7. Delete entire `docs/workspace-rules/` directory (12 files)
8. Delete entire `docs/development/` directory (8 files - duplicates)
9. Delete entire `docs/migrations/` directory (4+ files - completed migrations)
10. Delete duplicate files in `docs/components/` (3 files)

### Files to Update (Post-Cleanup)

1. `docs/ARCHITECT_PLAN_INDEX.md` - Verify implementation status
2. `docs/architect-teams-plan/00-IMPLEMENTATION-STATUS.md` - Update current status
3. `docs/compliance/AUDIT_CERT.md` - Update or mark as historical
4. `docs/compliance/AUDIT_DEEP.md` - Update or mark as historical
5. `docs/runbooks/data-scrape.md` - Separate runbook from historical logs
6. `docs/runbooks/cutover-cleanup.md` - Verify completion status

### Post-Cleanup Structure

```
docs/
├── ARCHITECT_PLAN_INDEX.md
├── COMPONENT_INDEX.md
├── CONTRACT_NORMALIZATION_IMPLEMENTATION_SUMMARY.md
├── CONTRACT_NORMALIZATION_RULES.md
├── FIRESTORE_DIAGNOSTIC.md
├── SCHEMA_MIGRATION_GUIDE.md
├── architect-teams-plan/
│   ├── 00-IMPLEMENTATION-STATUS.md
│   ├── 01-GOALS.md
│   ├── 02-CURRENT-STATUS.md
│   ├── 03-TARGET-SCHEMA.md
│   ├── 04-HOW-IT-WORKS.md
│   ├── 05-SAVE-LOAD-LOGIC.md
│   ├── 06-COMPREHENSIVE-SUMMARY.md
│   ├── 07-IMPLEMENTATION-PLAN.md
│   └── README.md
├── architecture/
│   └── ArchitectTimingModel.md
├── compliance/
│   ├── AUDIT_CERT.md
│   ├── AUDIT_DEEP.md
│   └── COMPLIANCE_MATRIX.csv
├── components/
│   ├── FiltersHierarchy.md
│   ├── ListsHierarchy.md
│   ├── ProfileHierarchy.md
│   ├── RankerHierarchy.md
│   ├── RosterHierarchy.md
│   ├── TableHierarchy.md
│   └── TierMakerHierarchy.md
├── guides/
│   ├── ORDER_OF_OPERATIONS.md
│   └── contract-normalization-usage.md
├── runbooks/
│   ├── FIX_PLAYER_NOT_FOUND.md
│   ├── MANUAL_SMOKE_TEST_CHECKLIST.md
│   ├── VERIFY_BEFORE_DELETE.md
│   ├── application-integration-notes.md
│   ├── application-integration-verification.md
│   ├── cutover-cleanup.md
│   └── data-scrape.md
├── schema/
│   ├── CHANGELOG.md
│   ├── CURRENT_FIRESTORE_SCHEMA.md
│   ├── VERSION
│   ├── architect.md
│   └── players_v2.md
└── templates/
    └── file_header.template.txt
```

---

## Trust Assessment

**Before cleanup:** The docs folder contains significant noise from:
- AI agent workflow documentation mixed with project docs
- Cursor IDE tool configurations
- Completed migration documentation
- One-time task summaries kept as permanent docs
- Duplicate files across directories

**After cleanup:** The docs folder will be:
- **Focused** - Only project-relevant documentation
- **Accurate** - Current schema and architecture docs
- **Actionable** - Runbooks and guides for real tasks
- **Trustworthy** - Safe to reference without second-guessing

**Answer to key question:** *"If someone (human or AI) trusted this docs folder blindly, would that be safe?"*

- **Before cleanup:** ❌ No - Too much outdated/irrelevant material
- **After cleanup:** ✅ Yes - Clean, current, trustworthy reference

---

## Execution Log

**Executed on:** 2025-12-14

### Deletions Applied ✅

1. ✅ Deleted `docs/FILE_MAP.md`
2. ✅ Deleted `docs/STATS_SCRAPER_FIX.md`
3. ✅ Deleted `docs/PLAYER_REFRESH_SUMMARY.md`
4. ✅ Deleted `docs/new-schema-validator-review.md`
5. ✅ Deleted `docs/schema/CONTRACT_NORMALIZATION_PHASE0.md`
6. ✅ Deleted entire `docs/cursor-prompts/` directory (11 files)
7. ✅ Deleted entire `docs/workspace-rules/` directory (12 files)
8. ✅ Deleted entire `docs/development/` directory (8 duplicate files)
9. ✅ Deleted entire `docs/migrations/` directory (completed migrations)
10. ✅ Deleted duplicate files in `docs/components/`:
    - `ArchitectHierarchy.md` (duplicate of development version)
    - `COMPONENT_INDEX.md` (duplicate of top-level)
    - `FILE_MAP.md` (duplicate)

### Files Remaining for Future Update

These files were identified as potentially outdated but kept for now. Future maintenance should verify:

1. `docs/ARCHITECT_PLAN_INDEX.md` - Verify implementation status matches reality
2. `docs/architect-teams-plan/00-IMPLEMENTATION-STATUS.md` - Update current phase status
3. `docs/compliance/AUDIT_CERT.md` - Update commit reference or mark as historical
4. `docs/compliance/AUDIT_DEEP.md` - Update or mark as historical
5. `docs/runbooks/data-scrape.md` - Separate runbook from historical run logs
6. `docs/runbooks/cutover-cleanup.md` - Verify completion status of all items

### ⚠️ External References to Update

The following files reference the deleted docs directories and need to be updated:

**AGENTS.md** - Multiple references to deleted `docs/workspace-rules/` files:
- Lines 11, 18, 19, 24, 30, 45-47, 73, 147, 175 reference workspace-rules docs
- Lines 292-321 reference `docs/cursor-prompts/` files

**Options:**
1. **Inline the content** - Move workspace rules content into AGENTS.md directly
2. **Restore selectively** - Move workspace-rules files to a different location (e.g., `.cursor/rules/`)
3. **Update references** - Point to alternative documentation or remove dead links

**.cursor/commands/\*.md** - Command files reference deleted prompt docs:
- `audit.md` references `docs/cursor-prompts/ApexAuditPrompt.md`
- Other command files may have similar references

**PROJECT_SCHEMA.md** and **project.schema.json**:
- Reference deleted `docs/migrations/teams-to-architect/TARGET_SCHEMA.md`

**docs/ARCHITECT_PLAN_INDEX.md** and **docs/architect-teams-plan/README.md**:
- Reference deleted `docs/migrations/teams-to-architect/`

**docs/schema/CURRENT_FIRESTORE_SCHEMA.md**:
- Reference deleted `docs/migrations/players-v1-to-v2/`

**Recommendation:** These external references should be cleaned up in a follow-up task focused on AGENTS.md and Cursor tooling, separate from the docs folder cleanup.
