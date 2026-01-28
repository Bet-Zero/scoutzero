# Phase 42: Apron Derivation Consolidation Preflight — Return Package

**Date:** 2026-01-28  
**Mode:** PREFLIGHT (Discovery-only; NO code changes)  
**Scope:** `src/features/architect/**` excluding `src/features/architect/utils/tradeMachine/**`

---

## Executive Summary

- ✅ **SSOT exists:** `src/features/architect/utils/tradeMachine/utils/capUtils.js` contains canonical `getTeamApronStatus()` with correct CBA semantics (`>` for second apron, `>=` for first apron).
- ✅ **Architect-level delegation exists:** `src/features/architect/utils/capUtils.js` delegates to tradeMachine SSOT via `getTeamApronStatus()`.
- ⚠️ **Duplicate derivation remains:** Multiple Architect call sites still derive apron status inline instead of delegating.
- ⚠️ **Semantic drift risk:** `usePlayerRulesProfiles.js` uses `>` for first apron (should be `>=` per SSOT).
- ⚠️ **Interface drift:** Mixed return/value vocab across the app (`SECOND_APRON` vs `ABOVE_SECOND_APRON` vs `'2nd Apron'`).
- ✅ **Guardrail coverage exists:** Multiple prior guardrails validate strict second apron boundary behavior.
- ✅ **No stop conditions triggered.**

---

## 1) Inventory Table: Apron Derivation Sites in Architect (Excluding tradeMachine)

|   # | File Path                                                               | Function / Site       | Comparator Semantics                            | Output Drives                            | Delegates to SSOT? | Notes                                                    |
| --: | ----------------------------------------------------------------------- | --------------------- | ----------------------------------------------- | ---------------------------------------- | ------------------ | -------------------------------------------------------- |
|   1 | `src/features/architect/utils/capUtils.js`                              | `getApronStatus()`    | Delegates                                       | Returns legacy values (`ABOVE_*`)        | ✅ Yes             | Correct delegation; interface maps SSOT to legacy naming |
|   2 | `src/features/architect/utils/tradeHelpers.js`                          | `getApronStatus()`    | `> secondApron`, `>= firstApron`                | UI labels (`'2nd Apron'`, `'1st Apron'`) | ❌ No              | Duplicates logic; should delegate                        |
|   3 | `src/features/architect/hooks/usePlayerRulesProfiles.js`                | `deriveApronStatus()` | `> secondApron`, `> firstApron`, `> salaryCap`  | team apron status in hook output         | ❌ No              | **Drift:** uses `> firstApron` (SSOT uses `>=`)          |
|   4 | `src/features/architect/utils/buildRuleContext.ts`                      | `deriveApronLevel()`  | `> secondApron`, `>= firstApron`, `> salaryCap` | `apronLevelAtOperation`                  | ❌ No              | Semantics match SSOT but duplicates logic                |
|   5 | `src/features/architect/hooks/useCapValidation.js`                      | Inline comparisons    | `> secondApron`, `> firstApron`                 | warnings / UX messaging                  | ❌ No              | Correct but duplicated (warning-only)                    |
|   6 | `src/features/architect/utils/faExceptionUtils.js`                      | `canUseFaException()` | `> secondApron`, `>= firstApron`                | exception eligibility gating             | ❌ No              | Correct but duplicated                                   |
|   7 | `src/features/architect/utils/hardCapUtils.js`                          | hard cap triggers     | N/A                                             | hard cap status                          | N/A                | Driven by hard-cap trigger flags, not apron derivation   |
|   8 | `src/features/architect/capSheet/ExceptionTracker/ExceptionTracker.jsx` | consumes `hardCapped` | N/A                                             | UI display                               | N/A                | Consumes pre-derived status; does not derive             |

---

## 2) Canonical Target Identification

### 2.1 Canonical SSOT (tradeMachine)

**File:** `src/features/architect/utils/tradeMachine/utils/capUtils.js`  
**Function:** `getTeamApronStatus(team, capSettings)`  
**Returns:** `'SECOND_APRON' | 'FIRST_APRON' | 'OVER_CAP' | 'UNDER_CAP'`

Semantics (not verbatim code):

- Second apron: **strictly** `teamSalary > secondApron`
- First apron: `teamSalary >= firstApron`
- Over cap: `teamSalary >= salaryCap`
- Else under cap

### 2.2 Recommended Architect canonical import point

**File:** `src/features/architect/utils/capUtils.js`  
This should be the single Architect import point for apron derivation, because it already delegates to the SSOT and can provide both:

- **Canonical exports** (SSOT return values) for new code
- **Legacy mapping** (`ABOVE_*`) for old call sites until migrated

---

## 3) Drift Risks Identified

### 3.1 Semantic drift (first apron boundary)

**File:** `src/features/architect/hooks/usePlayerRulesProfiles.js`  
**Issue:** Uses `teamSalary > firstApron` instead of `>= firstApron`  
**Severity:** Medium (boundary misclassification exactly at first apron)

### 3.2 Interface drift (value vocabulary mismatch)

Different parts of Architect express apron levels as:

- SSOT enums: `SECOND_APRON`, `FIRST_APRON`
- Legacy enums: `ABOVE_SECOND_APRON`, `ABOVE_FIRST_APRON`
- UI strings: `'2nd Apron'`, `'1st Apron'`, etc.

This increases future drift risk and makes it harder to reason about rules/gating.

### 3.3 Duplicate logic (non-delegating sites)

- `tradeHelpers.getApronStatus()`
- `usePlayerRulesProfiles.deriveApronStatus()`
- `buildRuleContext.deriveApronLevel()`
- plus warning/gating helpers (`useCapValidation`, `faExceptionUtils`) that duplicate comparisons

---

## 4) Guardrail Opportunity Notes (no plan)

### 4.1 Import-level guardrail

Strengthen Architect’s `utils/capUtils.js` as the single export surface for:

- `getTeamApronStatus` (canonical)
- `isSecondApronTeam`, `isFirstApronTeam` (canonical)
- legacy `getApronStatus` mapping (deprecated)

### 4.2 “No new derivations” guardrail

Add a future test/lint-style check that fails if new `secondApron` / `firstApron` comparisons appear outside the canonical modules.

---

## 5) Tests & Coverage

**Tests executed during this preflight:** None (static scan only)

**Existing relevant coverage (by inspection):**

- `src/tests/architect/apronSemantics.test.js`
- `src/tests/architect/phase39_drift_guardrails.test.js`
- `src/tests/architect/phase40_secondApron_drift_guardrails.test.js`
- plus cap legality suites across both `tests/` and `src/tests/`

---

## Proposed Master Doc Entry (single line)

- 2026-01-28: Phase 42 (PREFLIGHT) Apron derivation consolidation sweep — inventoried all Architect apron derivation sites outside tradeMachine SSOT, flagged first-apron boundary drift in `usePlayerRulesProfiles.js` (`>` vs `>=`), and identified `src/features/architect/utils/capUtils.js` as the canonical Architect import surface for apron status. Return package: `docs/architect/return_packages/PHASE_42_APRON_DERIVATION_CONSOLIDATION_PREFLIGHT_RETURN_PACKAGE.md`.
