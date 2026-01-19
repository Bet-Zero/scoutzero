# RETURN PACKAGE: CAP RULES YEAR-COVERAGE AUDIT

**FILE:** docs/architect/return-packages/2026-01-18_CAP_SHEET_CONTRACT_RULES_PHASE_11_CAP_RULES_YEAR_COVERAGE_AUDIT.md

## 1. Direct Answer

* **Are future years real inputs today?**
  * **NO.** Most future years (2025-26+) rely on **unconfirmed projections** or **silent fallbacks**.
* **Which years are real?**
  * **2024-25** is the only year with "hard" inputs (hardcoded fallback + valid minimums).
  * **2025-26** has "projected" numbers in `cbaConstants` and `minimumSalaryScales`, but they are not authoritative "real" numbers yet.
* **What’s missing?**
  * **Rookie Scale (1st Round Pick Values):** Completely missing. No table exists for 1-30 pick slots for any year.
  * **2026+ Cap/Tax/Aprons:** Relies on a deprecated `capProjections.js` file or silent fallback to previous year.

## 2. Canonical Rule Source Map

| Rule Category | Canonical Source File | API / Variable | Year Coverage | Missing-Year Behavior |
| :--- | :--- | :--- | :--- | :--- |
| **Cap / Aprons** | `src/features/architect/utils/tradeMachine/utils/capSettingsProvider.js` | `getCapSettingsForYear` | 2024-25 (Hardcoded Fallback)<br>2020-2040 (Projected/Valid Range) | 1. `capProjections.js`<br>2. `CBA_CONSTANTS`<br>3. Prev Year<br>4. Hardcoded 2024-25 (Emergency) |
| **Exceptions** | `src/features/architect/utils/tradeMachine/utils/capSettingsProvider.js` | `getCapSettingsForYear` | Same as Cap | Same as Cap |
| **Minimums** | `src/features/architect/data/minimumSalaryScales.ts` | `getScaleForSeason` | 2024-25 (Real)<br>2025-26 (Projected) | Falls back to `rookieMin` (which itself falls back/projects) |
| **Rookie Scale** | **MISSING** | N/A | None (Only `rookieMin` floor exists) | N/A (likely user input assumed valid > `rookieMin`) |
| **Rookie Min** | `src/features/architect/utils/capRulesProfile/capRulesProfile.ts` | `salaries.rookieMin` | Derived from Cap | Projects based on Cap Growth or Prev Year * 1.04 |

## 3. Year Plumbing Trace

* **Entry Point:** `validateSigning({ year, ... })` in `capLegalityValidation.js`.
* **Resolution:** Calls `getCapRulesForYear(year)` -> `getCapSettingsForYear(year)`.
* **Normalization:** `capSettingsProvider` logic converts "2024-25" string to `2025` (end year) integer.
* **Drift/Loss:**
  * `salaryEngine` receives `operationSeasonId` via `RuleContext`.
  * Use of `context.year` vs `context.season` is generally consistent, using `yearToSeasonKey` helpers.

## 4. 2024-25 Relevance

* **Hardcoded Fallback:** 2024-25 is explicitly defined as `EMERGENCY_FALLBACK_2024_25` in `capSettingsProvider.js`. It is the "safety net" preventing crashes when data is missing.
* **Minimum Base:** `minimumSalaryScales.ts` uses 2024-25 as the base real data.
* **Status:** It acts as the **implicit anchor**. If we move to 2026, without new data, the system eventually drags 2025 or 2024 numbers forward.

## 5. Risk List

1. **Silent Fallback Loop:** `capSettingsProvider` warns but falls back to 2024-25 values. Users simulating 2028 might silently get 2024 numbers if projections fail or gap exists.
2. **Rookie Scale Gap:** There is **NO validation** for specific draft slot amounts (e.g., #1 pick money). Users can enter illegal rookie scale amounts as long as they exceed the generic `rookieMin`.
3. **Projected vs Real Confusion:** `capRulesProfile` attempts to distinguish `source: 'real' | 'projected'`, but the UI may not clearly communicate when legality is based on a guess.

## 6. Phase 11 Execution Plan Proposal

### Goal

Make supported years explicit and enforce Rookie Scale properly.

### Steps

1. **Create `CapRulesDataSource`:** A new JSON/TS structure explicitly defining *Supported Years* (Real) vs *Projected Years*.
2. **Implement Rookie Scale Table:** Create `src/features/architect/data/rookieScale.ts` with 2024-25 (and 2025-26) 1st round pick slot values (120% max, 80% min).
3. **Strict Year Policy:** Modify `capRulesProfile` to throwing a hard error for *past* or *current* years if data is missing (stop 2024 fallback for 2025). Keep projection logic explicit for *future* years.
4. **Wire Rookie Scale Validation:** Update `validateSigning` to check "Rookie Scale" contracts against the new slot table (margin of error allowed).
5. **Audit/Update Projections:** Refresh `capProjections.js` or replace with a better source for 2026+.

### Recommended Data Structure

```typescript
interface CapYearData {
  season: string; // "2024-25"
  type: 'REAL' | 'PROJECTED';
  cap: { ... };
  exceptions: { ... };
  minimums: Record<number, number>; // YOS -> $
  rookieScale: Record<number, number>; // Pick (1-30) -> 100% Scale Amount
}
```

### Missing-Year Policy

* **Past/Current:** HARD ERROR (Must have data).
* **Future (Simulated):** WARN + PROJECT (growth rate).

### Acceptance Criteria

* New `rookieScale` module exists.
* `validateSigning` blocks invalid rookie scale amounts (e.g. #1 pick getting #30 money).
* System creates valid projected caps for 2030 without checking "2024-25" constants.

## 7. Master Doc Update Notes

* **Validation Rules:** Add `rookie_scale_invalid` rule definition.
* **Data Sources:** Document the new `rookieScale.ts` source.
* **Year Policy:** Update policy on "Projected Data" usage in validation.
