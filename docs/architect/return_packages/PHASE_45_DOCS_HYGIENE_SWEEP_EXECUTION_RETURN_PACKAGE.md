# Phase 45 — Docs Hygiene Sweep (Return Packages + Naming) — Execution Return Package

**DATE:** 2026-01-28  
**PHASE:** 45 — Docs Hygiene Sweep  
**MODE:** Execution  
**SCOPE:** Docs only (`docs/architect/**`). No runtime/code changes.

---

## 1. Executive Summary

Phase 45 consolidated the return package directory structure under a single canonical folder and resolved the duplicate Phase 35 return packages identified in Phase 44.

**Result:**

- `docs/architect/return-packages/` (hyphenated) eliminated; all files moved to `docs/architect/return_packages/` (underscored)
- Duplicate Phase 35 return package archived
- All internal file path references updated

---

## 2. Actions Performed

### 2.1 Directory Unification

| Action      | Source                                              | Destination                       |    Count |
| :---------- | :-------------------------------------------------- | :-------------------------------- | -------: |
| **MOVED**   | `docs/architect/return-packages/*`                  | `docs/architect/return_packages/` | 36 files |
| **DELETED** | `docs/architect/return-packages/` (empty directory) | —                                 | 1 folder |

**Files Moved:**

- `2026-01-17_CAP_SHEET_CONTRACT_RULES_PHASE_2_5_FIRST_YEAR_MAX.md`
- `2026-01-17_CAP_SHEET_CONTRACT_RULES_PHASE_2_CONTRACT_YEARS.md`
- `2026-01-17_CAP_SHEET_CONTRACT_RULES_PHASE_3_25_EXTENSION_WIRING_FIX.md`
- `2026-01-17_CAP_SHEET_CONTRACT_RULES_PHASE_3_EXTENSIONS.md`
- `2026-01-17_CAP_SHEET_CONTRACT_RULES_PHASE_4_SIGNING_TERMS_AND_RAISES.md`
- `2026-01-17_CAP_SHEET_CONTRACT_RULES_PREFLIGHT.md`
- `2026-01-17_CAP_SHEET_CONTRACT_SCHEMA_ALIGNMENT_PHASE_0.md`
- `2026-01-17_CAP_SHEET_MIN_SALARY_ENFORCEMENT_PHASE_1.md`
- `2026-01-17_TPE_EXPIRATION_PHASE_2.md`
- `2026-01-18_CAP_SHEET_CONTRACT_RULES_PHASE_10_RFA_HOME_TEAM_VS_OFFER_SHEET.md`
- `2026-01-18_CAP_SHEET_CONTRACT_RULES_PHASE_11_CAP_RULES_YEAR_COVERAGE_AUDIT.md`
- `2026-01-18_CAP_SHEET_CONTRACT_RULES_PHASE_11_EXECUTION_YEAR_COVERAGE_AND_ROOKIE_SCALE.md`
- `2026-01-18_CAP_SHEET_CONTRACT_RULES_PHASE_4_5_BIRD_RIGHTS_FIRST_YEAR_MAX.md`
- `2026-01-18_CAP_SHEET_CONTRACT_RULES_PHASE_5_GUARANTEES_OPTIONS_CAPHIT.md`
- `2026-01-18_CAP_SHEET_CONTRACT_RULES_PHASE_6_ENGINE_TERMS_SCHEMA_AND_BIRD_RIGHTS.md`
- `2026-01-18_CAP_SHEET_CONTRACT_RULES_PHASE_7_1_CAP_HOLD_TRANSITIONS.md`
- `2026-01-18_CAP_SHEET_CONTRACT_RULES_PHASE_7_2_CAP_HOLD_AMOUNTS_AND_FA_YEAR.md`
- `2026-01-18_CAP_SHEET_CONTRACT_RULES_PHASE_7_3_OPTION_STATE_INVARIANTS.md`
- `2026-01-18_CAP_SHEET_CONTRACT_RULES_PHASE_7_CAP_HOLDS_AND_FREE_AGENCY.md`
- `2026-01-18_CAP_SHEET_CONTRACT_RULES_PHASE_8_RFA_QO_AND_RESIGNING.md`
- `2026-01-18_CAP_SHEET_CONTRACT_RULES_PHASE_9_ELIGIBILITY_IDS_AND_FA_POLICY.md`
- `2026-01-19_CAP_SHEET_CONTRACT_RULES_PHASE_12_RFA_OFFER_SHEET_MATCHING_STUB.md`
- `2026-01-19_CAP_SHEET_CONTRACT_RULES_PHASE_13_OFFER_SHEET_PENDING_STATE_AND_FINALIZATION_GATE.md`
- `2026-01-19_CAP_SHEET_CONTRACT_RULES_PHASE_14_OFFER_SHEET_STORE_ONLY_INVARIANTS.md`
- `2026-01-19_CAP_SHEET_CONTRACT_RULES_PHASE_15_PREFLIGHT_OFFER_SHEET_PERSISTENCE_AND_WORKFLOW.md`
- `2026-01-19_CAP_SHEET_CONTRACT_RULES_PHASE_16_OFFER_SHEET_PERSISTENCE_AND_WORKFLOW_MVP.md`
- `2026-01-19_CAP_SHEET_CONTRACT_RULES_PHASE_17_MATCHED_OFFER_RESOLUTION.md`
- `2026-01-19_CAP_SHEET_CONTRACT_RULES_PHASE_18_1_OFFER_SHEET_AUDIT_GRADE_PATCH.md`
- `2026-01-19_CAP_SHEET_CONTRACT_RULES_PHASE_18_OFFER_SHEET_AUDIT_GRADE_RP_AND_E2E_INVARIANTS.md`
- `2026-01-20_CAP_SHEET_CONTRACT_RULES_MASTER_PROGRESS_UPDATE.md`
- `2026-01-20_CAP_SHEET_CONTRACT_RULES_PHASE_18_2_OFFER_SHEET_AUDIT_GRADE_LOCK.md`
- `2026-01-20_CAP_SHEET_CONTRACT_RULES_PHASE_19_CAP_HOLD_CAP_SPACE_ENFORCEMENT.md`
- `2026-01-20_CAP_SHEET_CONTRACT_RULES_PHASE_20_WORLD_TIME_SSOT.md`
- `CAP_SHEET_PHASE_21_TIMING_WARNINGS_RETURN_PACKAGE.md`
- `CAP_SHEET_PHASE_22_PREFLIGHT_RETURN_PACKAGE.md`
- `RP_CAP_SHEET_DATA_DOCTRINE_PREFLIGHT.md`

### 2.2 Phase 35 Duplicate Resolution

| Action                   | File                                                     | Destination                                                          |
| :----------------------- | :------------------------------------------------------- | :------------------------------------------------------------------- |
| **ARCHIVED**             | `Phase_35_Return_Package.md`                             | `docs/architect/return_packages/_archive/Phase_35_Return_Package.md` |
| **RETAINED (Canonical)** | `PHASE_35_SECOND_APRON_SSOT_PREFLIGHT_RETURN_PACKAGE.md` | Unchanged location                                                   |

**Rationale:**

- `PHASE_35_SECOND_APRON_SSOT_PREFLIGHT_RETURN_PACKAGE.md` follows the naming convention (`PHASE_##_<NAME>_RETURN_PACKAGE.md`)
- Contains full preflight analysis (371 lines vs 58 lines)
- Master Doc Phase 35 ledger entry references the execution work covered by both

### 2.3 Reference Updates

All 18 internal references to `return-packages` (hyphenated) were updated to `return_packages` (underscored):

| Files Updated          | Pattern Changed                                                       |
| :--------------------- | :-------------------------------------------------------------------- |
| 10 return package docs | `docs/architect/return-packages/` → `docs/architect/return_packages/` |

**Affected Files:**

- `2026-01-17_CAP_SHEET_CONTRACT_RULES_PHASE_2_CONTRACT_YEARS.md`
- `2026-01-17_CAP_SHEET_CONTRACT_RULES_PHASE_2_5_FIRST_YEAR_MAX.md`
- `2026-01-17_CAP_SHEET_CONTRACT_RULES_PHASE_3_EXTENSIONS.md`
- `2026-01-17_CAP_SHEET_CONTRACT_RULES_PHASE_4_SIGNING_TERMS_AND_RAISES.md`
- `2026-01-17_CAP_SHEET_CONTRACT_RULES_PREFLIGHT.md`
- `2026-01-17_CAP_SHEET_MIN_SALARY_ENFORCEMENT_PHASE_1.md`
- `2026-01-18_CAP_SHEET_CONTRACT_RULES_PHASE_7_2_CAP_HOLD_AMOUNTS_AND_FA_YEAR.md`
- `2026-01-18_CAP_SHEET_CONTRACT_RULES_PHASE_7_3_OPTION_STATE_INVARIANTS.md`
- `2026-01-18_CAP_SHEET_CONTRACT_RULES_PHASE_11_CAP_RULES_YEAR_COVERAGE_AUDIT.md`
- `2026-01-19_CAP_SHEET_CONTRACT_RULES_PHASE_12_RFA_OFFER_SHEET_MATCHING_STUB.md`
- `PHASE_44_ARCHITECT_STATUS_SNAPSHOT_PREFLIGHT_RETURN_PACKAGE.md`

---

## 3. Validation

### 3.1 Zero Remaining Hyphenated References

```bash
$ grep -r "return-packages" docs/architect/
# (no output)
```

✅ **PASSED:** Zero `return-packages` references remain in `docs/architect/**`.

### 3.2 Directory Structure

```
docs/architect/
├── CAP_RULES_PROFILE_MASTER_DOC.md
├── CAP_SHEET_MASTER_DOC.md
├── CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md
├── CAP_SHEET_PHASE_23_RETURN_PACKAGE.md
├── CAP_SHEET_PHASE_PLAN.md
├── CAP_SHEET_TPE_EXPIRATION_PHASE_PLAN.md
├── PHASE_38_RETURN_PACKAGE.md
└── return_packages/              # ← CANONICAL (66 files)
    ├── _archive/                 # ← NEW: deprecated docs
    │   └── Phase_35_Return_Package.md
    ├── PHASE_26_SIGN_AND_TRADE_AUDIT_RETURN_PACKAGE.md
    ├── PHASE_35_SECOND_APRON_SSOT_PREFLIGHT_RETURN_PACKAGE.md  # ← CANONICAL Phase 35
    ├── ... (64 more return packages)
    └── PHASE_45_DOCS_HYGIENE_SWEEP_EXECUTION_RETURN_PACKAGE.md
```

✅ **PASSED:** Single canonical folder exists.

---

## 4. Phase 44 Items Resolved

| Phase 44 Item # | Description                        | Status                                                  |
| :-------------: | :--------------------------------- | :------------------------------------------------------ |
|        3        | Two Return Package Folders         | ✅ **RESOLVED** — Merged into `return_packages/`        |
|        4        | Phase 35 Duplicate Return Packages | ✅ **RESOLVED** — Archived `Phase_35_Return_Package.md` |

---

## 5. Outstanding Docs Hygiene (Not Addressed)

These items from Phase 44 remain as future polish (low priority):

| Item                            | Description                              | Status            |
| :------------------------------ | :--------------------------------------- | :---------------- |
| Inconsistent naming convention  | Some files use date prefixes, some don't | Unchanged (minor) |
| Master Doc §3.2 status accuracy | G2-3 roster charge display note          | Unchanged (minor) |

---

## 6. Master Doc Changelog Entry

Added to `CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md` Section 9.7 Phase Ledger:

```
| 2026-01-28 | **Phase 45 Docs Hygiene Sweep (EXECUTION):** Unified return package directory structure. Moved 36 files from `docs/architect/return-packages/` to `docs/architect/return_packages/`. Archived duplicate `Phase_35_Return_Package.md` to `_archive/` subfolder. Updated 18 internal path references. Zero `return-packages` references remain. Return package: `docs/architect/return_packages/PHASE_45_DOCS_HYGIENE_SWEEP_EXECUTION_RETURN_PACKAGE.md`. |
```

---

## 7. Files Created/Modified

| File                                                                                     | Action   | Notes                          |
| :--------------------------------------------------------------------------------------- | :------- | :----------------------------- |
| `docs/architect/return_packages/_archive/`                                               | Created  | New archive subfolder          |
| `docs/architect/return_packages/_archive/Phase_35_Return_Package.md`                     | Moved    | From `return_packages/` root   |
| `docs/architect/return_packages/PHASE_45_DOCS_HYGIENE_SWEEP_EXECUTION_RETURN_PACKAGE.md` | Created  | This document                  |
| `docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md`                            | Modified | Added Phase 45 changelog entry |
| 10 return package markdown files                                                         | Modified | Updated path references        |

---

**END OF PHASE 45 RETURN PACKAGE**
