# CAP RULES PROFILE — PHASE 2 MIN SALARY EXECUTION

# DATE: 2026-01-17

## 1. Preflight Answers

**Q: Does a year-keyed rookie minimum scale exist already?**
A: Yes, partly.

- `capSettingsProvider` / `capProjections.js` had NO rookie minimum data.
- `cbaConstants.js` (CBA_THRESHOLDS) had `MIN_SALARY_ROOKIE` only for 2024-25.
- `minimumSalaryScales.js` had scale data for 2024-25 and 2025-26, but not beyond, and was disconnected from `capRulesProfile`.

## 2. Decision

**Selected Option:** A (Extend `capProjections`)

**Rationale:**

- `capProjections.js` is the existing Single Source of Truth for multi-year cap data (2024-2032).
- Adding `rookieMin` to this structure allows `capRulesProfile` to resolve it alongside Salary Cap, Tax, and Apron lines in a single pass (`capSettings`).
- `minimumSalaryScales.js` was considered (Option B), but it lacked data for 2027+ and would require a separate lookup/projection mechanism. Centralizing "Year Rules" in `capProjections` was cleaner for the facade.

## 3. Files Changed

1. **`src/features/architect/utils/capProjections.js`**
    - Added `rookieMin` field for all years (2024-25 through 2031-32).
    - Values for 2026+ projected at ~4% growth.

2. **`src/features/architect/utils/tradeMachine/utils/capSettingsProvider.js`**
    - Updated `normalizeCapEntry` to extract and pass through `rookieMin`.

3. **`src/features/architect/utils/capRulesProfile/capRulesProfile.ts`**
    - Updated `getCapRulesForYear` to prioritize `capSettings.rookieMin`.
    - Maintained legacy fallback to `CBA_THRESHOLDS` (for safety), but added strict stop condition if resolution fails.

4. **Tests**
    - `src/tests/architect/utils/capRulesProfile.test.ts`: Updated to assert success for 2026+.
    - `src/tests/architect/capTotals/incompleteRosterCharge.test.js`: Updated to assert success for 2026+.

## 4. Example Outputs

**Year: 2025 (2024-25)**

- Source: `capProjections` (was `CBA_THRESHOLDS`)
- Value: **$1,119,563**

**Year: 2026 (2025-26)**

- Source: `capProjections`
- Value: **$1,164,345** (Previously threw error)

**Year: 2027 (2026-27)**

- Source: `capProjections` (Projected)
- Value: **$1,210,919** (4% growth)

## 5. Verification Results

**Command:** `npm test src/tests/architect/utils/capRulesProfile.test.ts src/tests/architect/capTotals/incompleteRosterCharge.test.js`

**Result:**

```
 ✓ src/tests/architect/utils/capRulesProfile.test.ts (4)
 ✓ src/tests/architect/capTotals/incompleteRosterCharge.test.js (9)

 Test Files  2 passed (2)
      Tests  13 passed (13)
```

## 6. Remaining Constraints

- `rookieMin` for 2026+ is a specific projection (~4%). If the actual CBA cap smoothing differs significantly from this relative growth, values will drift.
- `minimumSalaryScales.js` (logic for veteran minimums based on YOS) is NOT yet fully integrated into `capRulesProfile` facade (only `rookieMin` is). Future phases should unify YOS scales.
