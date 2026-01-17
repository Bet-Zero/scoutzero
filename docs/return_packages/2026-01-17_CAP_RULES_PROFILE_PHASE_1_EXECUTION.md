# RETURN PACKAGE: CAP RULES PROFILE — PHASE 1 EXECUTION

**Date:** 2026-01-17
**Task:** Create Facade + Migrate Core Consumers

## 1. Summary

Executed Phase 1 successfully. Created the `capRulesProfile` canonical facade and migrated the two primary critical path consumers (`computeTeamCapTotals` and `capLegalityValidation`) to use it. Direct imports of `cbaConstants` and `capProjections` have been removed from these files.

Added strict validation for `rookieMin` resolution (STOP CONDITION) to prevent silent fallback to 2024-25 data in future years.

## 2. Files Created / Modified

### Created

- `src/features/architect/utils/capRulesProfile/capRulesProfile.ts` (The Facade)
- `src/features/architect/utils/capRulesProfile/index.ts` (Export)
- `src/tests/architect/utils/capRulesProfile.test.ts` (New validation tests)

### Modified

- `src/features/architect/utils/capTotals/computeTeamCapTotals.js` (Migrated to facade)
- `src/features/architect/utils/capLegalityValidation.js` (Migrated to facade)
- `src/features/architect/utils/cbaConstants.js` (Added deprecation banner)
- `src/features/architect/utils/capProjections.js` (Added deprecation banner)
- `src/tests/architect/capTotals/incompleteRosterCharge.test.js` (Updated to expect errors on missing data)

## 3. Final Facade API

**File:** `src/features/architect/utils/capRulesProfile/capRulesProfile.ts`
**Function:** `getCapRulesForYear(yearKey: number, customCapProjections?: any): CapRulesProfile`

**Sample Output (Year 2025 like 2024-25):**

```json
{
  "yearKey": 2025,
  "seasonKey": "2024-25",
  "roster": {
    "minStandard": 14,
    "maxStandard": 15,
    "maxTwoWay": 3,
    "graceMin": 13
  },
  "cap": {
    "salaryCap": 141000000,
    "luxuryTax": 171000000,
    "firstApron": 179000000,
    "secondApron": 190000000
  },
  "exceptions": {
    "fullMLE": 12900000,
    "taxpayerMLE": 5000000,
    "roomMLE": 8000000,
    "bae": 4700000
  },
  "salaries": {
    "rookieMin": 1119563
  },
  "_meta": {
    "source": "CapRulesProfile",
    "resolved": true
  }
}
```

## 4. Proof of Migration

### computeTeamCapTotals.js

- **Before:** Imported `ROSTER_REQUIREMENTS`, `CBA_THRESHOLDS`, `getCapSettingsForYear`. Used local `getMinSalaryForYear` fallback.
- **After:** Imports `getCapRulesForYear`. Uses `rules.roster`, `rules.cap`, `rules.salaries.rookieMin`. No local fallbacks.

### capLegalityValidation.js

- **Before:** Imported `getCapSettingsForYear`. Used local `MIN_ROSTER`, `MAX_ROSTER` constants.
- **After:** Imports `getCapRulesForYear`. Uses `rules.roster.maxStandard`, `rules.cap.secondApron`, etc.

**Validation Scan:**
ran `grep -E "capProjections|cbaConstants" ...` on migrated files.
Result: 0 import matches. (Only variable names/comments found).

## 5. Tests

Ran `npx vitest` on:

1. `src/tests/architect/utils/capRulesProfile.test.ts` (PASSED)
   - Verified 2024-25 data resolution.
   - Verified **THROW** on 2026 data missing (Stop Condition).
2. `src/tests/architect/capTotals/incompleteRosterCharge.test.js` (PASSED)
   - Updated "Case H" to assert it throws for 2026 due to missing `rookieMin`.
3. `src/tests/architect/capLegality/exceptionBlocking.test.js` (PASSED)
   - Verified no regression in validation logic.

## 6. Stop Conditions & Conflicts

- **Rookie Min Resolution:** Implemented as a HARD STOP. The system now throws `CRITICAL: Could not resolve rookieMin` if data is missing, rather than implicitly using 2024-25.
- **Circular Dependencies:** None introduced.
- **Consumer Conflicts:** None. All migrated consumers successfully use the facade.
