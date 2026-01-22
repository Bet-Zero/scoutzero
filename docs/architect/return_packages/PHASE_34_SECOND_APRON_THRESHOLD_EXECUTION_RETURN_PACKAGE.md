# PHASE 34 — Second Apron Threshold Boundary Bug Execution Return Package

**DATE:** 2026-01-23  
**PHASE:** 34 — Second Apron Threshold Boundary Bug  
**MODE:** EXECUTION (code + tests + docs)  
**STATUS:** ✅ COMPLETE  
**MASTER DOC:** `docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md`  
**INPUT PREFLIGHT:** `docs/architect/return_packages/PHASE_34_SECOND_APRON_THRESHOLD_PREFLIGHT_RETURN_PACKAGE.md`

---

## Summary

Fixed the second apron threshold boundary bug where teams with salary **equal to** the second apron threshold were incorrectly treated as "Second Apron Teams". Per CBA Article VII, Section 2(f), Rule Card 6, a team is only a "Second Apron Team" if salary is **strictly greater than** the threshold.

**Root cause:** All classification checks used `>=` (greater than or equal) instead of `>` (strictly greater than).

**Fix:** Changed all classification comparators from `>=` to `>` in 7 files. Added 5 boundary tests to verify correct behavior.

---

## 1) Files Changed

| File Path                                                                                                  | Change                                                                                                   | Lines Modified |
| ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | -------------- |
| [basicRules.js](src/features/architect/utils/tradeMachine/rules/basicRules.js)                             | Changed `>=` to `>` for classification; renamed variable `isAtOrAboveSecondApron` → `isAboveSecondApron` | L54-67         |
| [validateSecondApronRules.js](src/features/architect/utils/tradeMachine/rules/validateSecondApronRules.js) | Changed `>=` to `>` for classification                                                                   | L15-24         |
| [validateAggregation.js](src/features/architect/utils/tradeMachine/rules/validateAggregation.js)           | Changed `>=` to `>` for classification                                                                   | L18-28         |
| [validateSalaryMatching.js](src/features/architect/utils/tradeMachine/rules/validateSalaryMatching.js)     | Changed `>=` to `>` for classification                                                                   | L327-329       |
| [hardCapValidation.js](src/features/architect/utils/tradeMachine/rules/hardCapValidation.js)               | Changed `>=` to `>` for status flag                                                                      | L86-87         |
| [capUtils.js](src/features/architect/utils/tradeMachine/utils/capUtils.js)                                 | Changed `>=` to `>` in `isSecondApronTeam()` and `getTeamApronStatus()`                                  | L28, L34, L47  |
| [salaryMargin.js](src/features/architect/utils/tradeMachine/utils/salaryMargin.js)                         | Changed `>=` to `>` in `getAllowableIncomingMargin()` and `getIncomingCeilingForTeam()`                  | L24-27, L93-96 |
| **NEW:** [secondApronBoundary.test.js](tests/trade/secondApronBoundary.test.js)                            | Created 5 boundary tests                                                                                 | 205 lines      |

**Total:** 7 production files modified + 1 test file created

---

## 2) Key Diffs

### basicRules.js (Primary Emitter)

**Before:**

```javascript
// Check if team is at/above second apron EITHER before OR after trade
// This catches both teams already above apron AND teams crossing into apron
const isAtOrAboveSecondApron =
  team?.postTradeStatus?.isAtOrAboveSecondApron ||
  teamTotalSalary >= secondApron ||
  projectedSalary >= secondApron ||
  (team?.context?.isAtOrAboveSecondApron) ||
  false;

if (!isAtOrAboveSecondApron) {
```

**After:**

```javascript
// Check if team is ABOVE second apron EITHER before OR after trade
// Per CBA Art VII Sec 2(f): team is "Second Apron Team" only if salary > secondApron (strict)
// Equality does NOT trigger second apron restrictions
const isAboveSecondApron =
  team?.postTradeStatus?.isAtOrAboveSecondApron ||
  teamTotalSalary > secondApron ||
  projectedSalary > secondApron ||
  (team?.context?.isAtOrAboveSecondApron) ||
  false;

if (!isAboveSecondApron) {
```

### capUtils.js (Helper Functions)

**Before:**

```javascript
export function isSecondApronTeam(team, capSettings) {
  // ...
  return teamSalary >= secondApron;
}

export function getTeamApronStatus(team, capSettings) {
  // ...
  if (teamSalary >= secondApron) return 'SECOND_APRON';
```

**After:**

```javascript
export function isSecondApronTeam(team, capSettings) {
  // Per CBA Art VII Sec 2(f): team is "Second Apron Team" only if salary > secondApron (strict)
  // ...
  return teamSalary > secondApron;
}

export function getTeamApronStatus(team, capSettings) {
  // Per CBA Art VII Sec 2(f): team is "Second Apron Team" only if salary > secondApron (strict)
  // ...
  if (teamSalary > secondApron) return 'SECOND_APRON';
```

---

## 3) New Test File Summary

**File:** `tests/trade/secondApronBoundary.test.js`

**Tests added (5):**

| #   | Test Name                                                                       | Scenario                                         | Expected                                      |
| --- | ------------------------------------------------------------------------------- | ------------------------------------------------ | --------------------------------------------- |
| 1   | `does not classify projectedSalary equal to secondApron as second apron team`   | Pre 180M + 10M in = 190M (equals threshold)      | No second apron violations                    |
| 2   | `classifies projectedSalary exceeding secondApron by $1 as second apron team`   | Pre 180M + 10,000,001 in = 190,000,001 (exceeds) | Second apron violation fires                  |
| 3   | `does not classify pre-trade salary equal to secondApron as second apron team`  | Pre 190M, equal swap                             | No second apron violations                    |
| 4   | `classifies pre-trade salary above secondApron as second apron team`            | Pre 190,000,001, takes more                      | Second apron violation fires                  |
| 5   | `regression: Phase 33 scenario no longer emits spurious second apron violation` | Pre 180M, hardCapped, +10M in                    | No "Second apron team cannot receive" message |

All tests use **rule-scoped assertions** (not `violations[0]`) to avoid ordering dependency.

---

## 4) Test Outputs

### New Boundary Tests

```
 ✓ tests/trade/secondApronBoundary.test.js (5)
   ✓ second apron boundary cases (5)
     ✓ does not classify projectedSalary equal to secondApron as second apron team
     ✓ classifies projectedSalary exceeding secondApron by $1 as second apron team
     ✓ does not classify pre-trade salary equal to secondApron as second apron team
     ✓ classifies pre-trade salary above secondApron as second apron team
     ✓ regression: Phase 33 scenario no longer emits spurious second apron violation

 Test Files  1 passed (1)
      Tests  5 passed (5)
```

### Existing tradeValidator Tests (Regression Check)

```
 ✓ tests/tradeValidator.test.js (14)
   ✓ tradeValidator (14)
     ✓ enforces salary matching when a team is over the cap
     ✓ flags trades that would violate a hard cap
     ✓ enforces sign-and-trade restrictions
     ✓ allows valid sign-and-trade deals
     ✓ blocks sign-and-trade hard cap violations
     ✓ requires sign-and-trade contracts to be 3-4 years
     ✓ detects Stepien Rule violations
     ✓ allows protected picks to bypass Stepien Rule
     ✓ enforces second apron restrictions
     ✓ prevents second apron teams from taking back more salary
     ✓ blocks cash considerations for second apron teams
     ✓ restricts trading picks more than 7 years out
     ✓ handles 3-team trades correctly
     ✓ provides summary and financial deltas

 Test Files  1 passed (1)
      Tests  14 passed (14)
```

### secondApron Handcuffs Tests

```
 ✓ tests/trade/secondApron_handcuffs.test.js (4)
   ✓ second apron handcuffs (4)
     ✓ rejects aggregation into one slot
     ✓ rejects cash inclusion
     ✓ rejects prior-year TPE usage
     ✓ enforces 100% salary matching

 Test Files  1 passed (1)
      Tests  4 passed (4)
```

### Sign-and-Trade Aggregation Tests

```
 ✓ tests/signAndTradeAggregation.test.js (9)
   ✓ Sign-and-Trade Aggregation Rules (9)
     ✓ Baseline: Valid S&T trades (1)
     ✓ Outgoing Aggregation (existing Rule 1.5) (1)
     ✓ Incoming Aggregation (NEW Rule 1.6) (2)
     ✓ 3-Team Trade Incoming Aggregation (1)
     ✓ Picks Allowed with S&T (1)
     ✓ Control: Non-S&T trades unaffected (1)
     ✓ Complex 3-Team S&T Aggregation (1)
     ✓ Third Party Unaffected in 3-Team S&T (1)

 Test Files  1 passed (1)
      Tests  9 passed (9)
```

---

## 5) Build Output

```
> scoutzero-final2@0.0.1 build
> vite build

vite v4.5.14 building for production...
✓ 2941 modules transformed.
dist/index.html                            0.60 kB │ gzip:   0.37 kB
dist/assets/index-bdc7c022.css            75.17 kB │ gzip:  13.11 kB
dist/assets/index.esm-449ed3c6.js          3.62 kB │ gzip:   1.56 kB
dist/assets/tradeManager-ca591c6d.js       5.24 kB │ gzip:   2.05 kB
dist/assets/seasonManager-ab745702.js     15.22 kB │ gzip:   5.13 kB
dist/assets/index-5ac4b074.js          1,967.21 kB │ gzip: 571.41 kB
✓ built in 56.22s
```

Build successful ✅

---

## 6) Master Doc History Line Added

```markdown
- - 2026-01-23: Phase 34 Second Apron Threshold Boundary Bug (EXECUTION) - fixed `>=` → `>` comparator in 7 files for second apron classification; added 5 boundary tests; teams at threshold no longer incorrectly treated as second apron
```

---

## 7) Acceptance Checklist

| Criteria                                                             | Status       |
| -------------------------------------------------------------------- | ------------ |
| No second apron violations when `salary === secondApron` (pre-trade) | ✅ Pass      |
| No second apron violations when `projectedSalary === secondApron`    | ✅ Pass      |
| Second apron restrictions apply when `salary > secondApron` by $1    | ✅ Pass      |
| New boundary tests pass (5/5)                                        | ✅ Pass      |
| Existing tradeValidator tests pass (14/14)                           | ✅ Pass      |
| Existing secondApron handcuffs tests pass (4/4)                      | ✅ Pass      |
| Existing S&T aggregation tests pass (9/9)                            | ✅ Pass      |
| Production build succeeds                                            | ✅ Pass      |
| Master Doc updated                                                   | ✅ Complete  |
| Execution return package created                                     | ✅ This file |

---

## CBA Reference

**Article VII, Section 2(f), Rule Card 6:**

> 1. If Apron Salary **>** Second Apron, team is "Second Apron Team."

The fix aligns the code with this CBA definition.

---

**EXECUTION COMPLETE**
