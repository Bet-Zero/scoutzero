# RETURN PACKAGE: CAP RULES PROFILE SSOT PREFLIGHT

> **Date:** 2026-01-17
> **Author:** Antigravity (Agent)
> **Status:** PREFLIGHT COMPLETE (Review Required)

---

## 1. Executive Summary

* **Goal:** Establish a single source of truth for all cap rules, CBA constants, and season thresholds to prevent data drift between Cap Sheet and Trade Machine.
* **Status:** Preflight investigation complete; Master Doc created.
* **Key Finding:** There are **three** competing sources for cap data: `cbaConstants.js` (incomplete/static), `capProjections.js` (comprehensive/dynamic), and local file constants (duplicates).
* **Critical Risk:** `MIN_SALARY_ROOKIE` (used for empty roster charges) is **undefined** for all seasons after 2024-25, creating a hidden failure mode for future year validation.
* **Recommendation:** Create a new `capRulesProfile.js` facade that unifies `capProjections.js` (for values) and `cbaConstants.js` (for rules), then aggressively deprecate direct access to the underlying files.

---

## 2. Inventory & Sources (Summary)

> Full inventory available in [Master Doc](docs/architect/CAP_RULES_PROFILE_MASTER_DOC.md#3-canonical-concepts--current-sources-inventory-table)

| Category | Primary Source Found | Secondary/Conflicting Sources | Status |
|----------|----------------------|-------------------------------|--------|
| **Roster Limits** | `cbaConstants.js` (ROSTER_REQUIREMENTS) | `capLegalityValidation.js` (local)<br>`rosterValidation.js` (local)<br>`seasonManager.js` (12 vs 14) | ⚠️ **Scattered** |
| **Cap/Apron Lines** | `capProjections.js` (via `capSettingsProvider`) | `cbaConstants.js` (CBA_THRESHOLDS)<br>`tradeValidator` (test fixtures) | ⚠️ **Conflicting Values** |
| **Exceptions (MLE)** | `capProjections.js` | `cbaConstants.js` (CBA_THRESHOLDS) | ⚠️ **Conflicting Values** |
| **Min Salaries** | `CBA_THRESHOLDS['2024-25']` (only) | `tradeHelpers.js` (hardcoded)<br>`minimumSalaryScales.js` (full scale) | 🛑 **Incomplete (Future Years)** |

---

## 3. Conflicts List (Explicit)

### A. Cap & Apron Value Mismatch

**Conflict:** `capProjections.js` and `cbaConstants.js` differ by significant amounts for the same 2024-25 season.

* `salaryCap`: $141,000,000 (Projections) vs $140,588,000 (Constants) — **Diff: $412K**
* `secondApron`: $190,000,000 (Projections) vs $188,938,000 (Constants) — **Diff: $1.06M**

**Impact:** A trade valid in the Trade Machine (using projs) might look illegal in a static check (using consts), or vice versa.

### B. Roster Constant Duplication

**Conflict:** `MIN_ROSTER` (14), `MAX_ROSTER` (15), and `MAX_TWO_WAY` (3) are re-declared as local constants in at least **3 files** (`capLegalityValidation.js`, `rosterValidation.js`, `basicArchitectUtils.js`).

**Impact:** Changing the rule requires finding/editing 3+ files. High risk of drift during CBA updates.

### C. Missing Future Salary Data

**Conflict:** `computeTeamCapTotals` relies on `MIN_SALARY_ROOKIE` for "Incomplete Roster Charges". This constant **only exists for 2024-25** in `CBA_THRESHOLDS`.

**Impact:** For any season 2025-26+, the code falls back to the 2024-25 value ($1.1M). This undercharges teams for empty roster slots in future years as the cap rises.

---

## 4. Recommendation & Interface

### Recommendation

We should **not** rewrite `capProjections.js` or `cbaConstants.js` immediately. Instead, we should introduce a **Canonical Interface Layer** that acts as the single gateway.

1. **Treat `capProjections.js` as the Database:** It has the data quality we need (multi-year).
2. **Treat `cbaConstants.js` as the Rules Engine:** It has the structural rules (roster sizes).
3. **Create `capRulesProfile.js`:** A unified accessor that pulls from both.

### Proposed Interface (Shape)

```typescript
// src/features/architect/utils/capRulesProfile.js

export function getCapRulesForYear(yearKey: number) {
  return {
    // FROM cbaConstants.js (Static)
    roster: {
      minStandard: 14,
      maxStandard: 15,
      maxTwoWay: 3,
      graceMin: 13
    },
    // FROM capProjections.js (Dynamic per year)
    cap: {
      salaryCap: 141000000,
      luxuryTax: 171000000,
      firstApron: 179000000,
      secondApron: 190000000,
    },
    // FROM capProjections.js
    exceptions: {
      fullMLE: 12900000,
      taxpayerMLE: 5000000,
      roomMLE: 8000000,
      bae: 4700000
    },
    // COMPOSITE (New logic to infer future min salaries)
    salaries: {
      rookieMin: 1119563 // Needs logic to project this if missing
    }
  };
}
```

---

## 5. Migration Plan (Phased)

| Phase | Goal | Actions | Risk |
|-------|------|---------|------|
| **1** | **Roster Rules** | Replace local `MIN_ROSTER` consts in `capLegalityValidation` & `rosterValidation` with imports from `cbaConstants`. | 🟢 Low |
| **2** | **Cap/Apron SSOT** | Deprecate `CBA_THRESHOLDS` cap values. Point all consumers to `capProjections` (via provider). | 🟡 Med |
| **3** | **Salary Data Fix** | Add `minSalaryRookie` to `capProjections` schema for future years. Update `computeTeamCapTotals` to read it. | 🟡 Med |
| **4** | **Unification** | Implement `capRulesProfile.js` facade. Migrate consumers to use it exclusively. | 🟢 Low |

---

## 6. Validation Notes

### Commands Used

* `grep "roster minimum" / "MIN_ROSTER"`: Found duplicate definitions in 3 files.
* `grep "salaryCap" / "salary_cap"`: Confirmed `capProjections` is the dominant source (used by `capSettingsProvider`).
* `grep "fullMLE" / "taxpayerMLE"`: Found mismatch between `CBA_THRESHOLDS` ($12.86M) and `capProjections` ($12.9M).
* `view_file computeTeamCapTotals.js`: Confirmed hard reliance on `MIN_SALARY_ROOKIE` from `CBA_THRESHOLDS`.

### Files Created/Updated

* [x] `docs/architect/CAP_RULES_PROFILE_MASTER_DOC.md` (SSOT Definition)
* [x] `docs/return_packages/2026-01-17_CAP_RULES_PROFILE_PREFLIGHT.md` (This file)

---
