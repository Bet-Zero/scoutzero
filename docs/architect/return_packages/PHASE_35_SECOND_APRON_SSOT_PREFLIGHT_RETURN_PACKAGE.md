# Phase 35 — Second Apron Status SSOT + Emitter Consolidation — Preflight Return Package

**DATE:** 2026-01-23  
**PHASE:** 35 — Second Apron Status SSOT + Emitter Consolidation  
**MODE:** Preflight (review-only; NO production code changes)  
**AUTHOR:** GitHub Copilot

---

## 1. Executive Summary

Phase 35 preflight analysis identified **significant duplication** in second apron classification and violation message emission across the trade validation codebase. The key findings:

1. **Classification Logic**: There are **7 distinct locations** where second-apron team status is determined, with **inconsistent semantics** (`>` vs `>=`). Phase 34 fixed the main SSOT helper (`isSecondApronTeam` in `capUtils.js`) to use strict `>` semantics, but several call sites still use inline `>=` comparisons.

2. **Message Emitters**: The exact string `"Second apron team cannot receive more salary than sent"` is emitted from **5 different files**, creating duplicate violations in the trade validation output.

3. **Main Flow Ownership**: After Phase 34, the primary second-apron enforcement in `validateTrade()` flows through:
   - `validateSalaryMatching` (salary matching violations)
   - `validateAggregation` (aggregation violations)
   - `enforceSecondApronHandcuffs` via `basicRules.js` (catch-all enforcement)
   - `validateHardCap` (hard cap ceiling violations)

4. **Proposed SSOT**: Create a single canonical helper for classification and a constants file for message strings, then migrate all call sites.

---

## 2. Second Apron Classification Call-Site Inventory

| File Path                              | Function                       | Comparator                    | Inputs                                              | Purpose                             | In Main Flow?                                                          |
| -------------------------------------- | ------------------------------ | ----------------------------- | --------------------------------------------------- | ----------------------------------- | ---------------------------------------------------------------------- |
| `utils/capUtils.js:29`                 | `isSecondApronTeam()`          | `>` (strict) ✅               | `team.totalSalary`, `capSettings.secondApron`       | **SSOT Classification**             | ✅ Yes (imported by eligibilityRules, salaryMatching, tradeExceptions) |
| `utils/capUtils.js:49`                 | `getTeamApronStatus()`         | `>` (strict) ✅               | `teamSalary`, `capSettings.secondApron`             | Apron status labeling               | ✅ Yes (used for status display)                                       |
| `utils/salaryMargin.js:27`             | `getAllowableIncomingMargin()` | `>` (strict) ✅               | `payroll`, `capSettings.secondApron`                | Margin ceiling calc                 | ✅ Yes                                                                 |
| `utils/salaryMargin.js:95`             | `getIncomingCeilingForTeam()`  | `>` (strict) ✅               | `teamTotalSalary`, `capSettings.secondApron`        | Ceiling calc                        | ✅ Yes                                                                 |
| `utils/salaryMatchingRules.js:210`     | `getSalaryMatchingResult()`    | `>=` ⚠️                       | `salary`, `secondApron`                             | Matching rule selection             | ✅ Yes (called by validateSalaryMatching)                              |
| `rules/validateSalaryMatching.js:331`  | `validateSalaryMatching()`     | `>` (strict) ✅               | `totalSalary`, `secondApron`                        | Salary matching violation           | ✅ Yes                                                                 |
| `rules/validateAggregation.js:21-24`   | `validateAggregation()`        | `>` (strict) ✅               | `teamTotalSalary`, `secondApron`                    | Aggregation violation               | ✅ Yes                                                                 |
| `rules/hardCapValidation.js:87`        | `validateHardCap()`            | `>` (strict) ✅               | `teamTotalSalary`, `secondApron`                    | Hard cap ceiling                    | ✅ Yes                                                                 |
| `rules/basicRules.js:57-58`            | `validateSecondApronRules()`   | `>` (strict) ✅               | `teamTotalSalary`, `projectedSalary`, `secondApron` | Catch-all enforcement               | ✅ Yes                                                                 |
| `rules/validateSecondApronRules.js:22` | `validateSecondApronRules()`   | `>` (strict) ✅               | `totalSalary`, `secondApron`                        | **DUPLICATE** of basicRules.js      | ⚠️ Yes (exported but same logic)                                       |
| `rules/aggregationValidator.js:13`     | `validateAggregation()`        | `>=` ⚠️                       | `teamSalary`, `capSettings.secondApron`             | **DUPLICATE** aggregation validator | ❌ No (not imported in main flow)                                      |
| `rules/salaryMatching.js:15`           | `validateSalaryMatching()`     | `>=` ⚠️                       | `teamTotalSalary`, `secondApron`                    | **DUPLICATE** salary matching       | ❌ No (not imported in main flow)                                      |
| `rules/tradeExceptions.js:18`          | `validateTradeExceptions()`    | Uses `isSecondApronTeam()` ✅ | Via SSOT helper                                     | TPE restriction                     | ✅ Yes                                                                 |
| `rules/validateTradeExceptions.js:42`  | `validateTradeExceptions()`    | `>=` ⚠️                       | `teamTotalSalary`, `secondApron`                    | TPE restriction                     | ✅ Yes (primary TPE validator)                                         |
| `rules/validateStepien.js:197`         | `validateStepien()`            | `>=` ⚠️                       | `team.team.totalSalary`, `capSettings.secondApron`  | Frozen pick restriction             | ✅ Yes                                                                 |
| `hooks/usePlayerRulesProfiles.js:49`   | `deriveApronStatus()`          | `>` (strict) ✅               | `teamSalary`, `capSettings.secondApron`             | UI apron status                     | ✅ Yes (UI hook)                                                       |
| `hooks/useCapValidation.js:212,422`    | inline comparison              | `>` (strict) ✅               | `projectedCap`, `secondApron`                       | Cap validation warnings             | ✅ Yes (UI hook)                                                       |

### Comparator Semantics Summary

| Semantics                      | Count | Status                      |
| ------------------------------ | ----- | --------------------------- |
| `>` (strict) - Correct per CBA | 10    | ✅ Phase 34 fixed main flow |
| `>=` (wrong)                   | 5     | ⚠️ Need migration           |

**Files with incorrect `>=` semantics:**

1. `utils/salaryMatchingRules.js:210` — uses `>=` for `SECOND_APRON` status
2. `rules/aggregationValidator.js:13` — uses `>=` (but not in main flow)
3. `rules/salaryMatching.js:15` — uses `>=` (but not in main flow)
4. `rules/validateTradeExceptions.js:42` — uses `>=` for TPE blocking
5. `rules/validateStepien.js:197` — uses `>=` for frozen pick restriction

---

## 3. Second Apron Violation Message Emitter Inventory

| File Path                           | Line | Message String                                             | Trigger Condition                                                    | Rule Category         | Duplicate?                            |
| ----------------------------------- | ---- | ---------------------------------------------------------- | -------------------------------------------------------------------- | --------------------- | ------------------------------------- |
| `rules/validateSalaryMatching.js`   | 345  | `"Second apron team cannot receive more salary than sent"` | `effectiveSalaryIn > salaryOut` when `totalSalary > secondApron`     | Salary Matching       | ✅ Primary                            |
| `rules/validateAggregation.js`      | 87   | `"Second apron team cannot receive more salary than sent"` | `totalIncoming > totalOutgoing` when above second apron              | Aggregation           | ⚠️ Duplicate                          |
| `rules/basicRules.js`               | 84   | `"Second apron team cannot receive more salary than sent"` | `teamSalaryIn > teamSalaryOut` when above second apron               | Catch-all Enforcement | ⚠️ Duplicate                          |
| `rules/validateSecondApronRules.js` | 48   | `"Second apron team cannot receive more salary than sent"` | `teamSalaryIn > teamSalaryOut` when above second apron               | Catch-all Enforcement | ⚠️ Duplicate (same as basicRules.js)  |
| `rules/hardCapValidation.js`        | 116  | `"Second apron team cannot receive more salary than sent"` | `projectedSalary > teamTotalSalary` and above second apron (non-S&T) | Hard Cap              | ⚠️ Duplicate                          |
| `rules/aggregationValidator.js`     | 80   | `"Second apron team cannot receive more salary than sent"` | `incomingSalary > outgoingSalary` when `>=` second apron             | Aggregation           | ❌ Not in main flow                   |
| `rules/salaryMatching.js`           | 82   | `"Second apron teams must match salaries exactly"`         | `incomingSalary !== outgoingSalary`                                  | Salary Matching       | ❌ Not in main flow (variant message) |

### Other Second Apron Violation Messages

| File Path                           | Line | Message String                                                                   | Category                     |
| ----------------------------------- | ---- | -------------------------------------------------------------------------------- | ---------------------------- |
| `rules/basicRules.js`               | 76   | `"Second apron: prior-year TPEs cannot be used."`                                | TPE Restriction              |
| `rules/validateSecondApronRules.js` | 40   | `"Second apron: prior-year TPEs cannot be used."`                                | TPE Restriction (duplicate)  |
| `rules/validateTradeExceptions.js`  | 51   | `"Second apron: prior-year TPEs cannot be used."`                                | TPE Restriction (duplicate)  |
| `rules/validateTradeExceptions.js`  | 54   | `"Second apron team cannot use trade exceptions"`                                | TPE Restriction              |
| `rules/basicRules.js`               | 98   | `"Second apron team cannot include cash in trades"`                              | Cash Restriction             |
| `rules/validateSecondApronRules.js` | 82   | `"Second apron team cannot include cash in trades"`                              | Cash Restriction (duplicate) |
| `rules/hardCapValidation.js`        | 96   | `"2nd Apron hard cap violation: Trade would exceed second apron hard-cap by..."` | Hard Cap Ceiling             |
| `rules/validateAggregation.js`      | 60   | `"Second apron team cannot aggregate salaries to acquire higher-paid player"`    | Aggregation                  |
| `rules/validateAggregation.js`      | 77   | `"Second apron team cannot aggregate salaries from multiple clubs"`              | Aggregation                  |

---

## 4. Main-Flow Call Graph

```
validateTrade() [engine/tradeValidator.js:563]
│
├── validators.validateSalaryMatching(team, context) [line 563]
│   └── [rules/validateSalaryMatching.js]
│       ├── Line 331: if (totalSalary > secondApron) → SECOND_APRON path
│       ├── Line 345: violations.push("Second apron team cannot receive more salary than sent")
│       └── Calls getSalaryMatchingResult() from salaryMatchingRules.js
│           └── Line 210: if (salary >= secondApron) → ⚠️ Wrong semantics
│
├── validators.validateHardCap(team, context) [line 564]
│   └── [rules/hardCapValidation.js]
│       ├── Line 87: isAboveSecondApron = teamTotalSalary > secondApron
│       ├── Line 94: if (projectedSalary > secondApron) → hard cap violation
│       └── Line 116: violations.push("Second apron team cannot receive more salary than sent")
│
├── validators.validateStepien(team, context) [line 565]
│   └── [rules/validateStepien.js]
│       └── Line 197: isAtOrAboveSecondApron = team.team.totalSalary >= capSettings.secondApron ⚠️
│
├── validators.validateTradeExceptions(team, context) [line 568]
│   └── [rules/validateTradeExceptions.js]
│       └── Line 42: isSecondApronTeam = teamTotalSalary >= secondApron ⚠️
│
├── validators.validateAggregation(team, context) [line 573]
│   └── [rules/validateAggregation.js]
│       ├── Line 21-24: isAboveSecondApron = teamTotalSalary > secondApron ✅
│       └── Line 87: violations.push("Second apron team cannot receive more salary than sent")
│
└── validators.enforceSecondApronHandcuffs(team, context) [line 579]
    └── [rules/basicRules.js:115 → calls validateSecondApronRules()]
        ├── Line 57-58: isAboveSecondApron checks with > ✅
        └── Line 84: violations.push("Second apron team cannot receive more salary than sent")
```

### Primary Rule for Second-Apron Enforcement (Post-Phase 34)

After Phase 34:

1. **`validateSalaryMatching`** — Primary salary matching enforcement with correct `>` semantics
2. **`validateAggregation`** — Aggregation-specific restrictions with correct `>` semantics
3. **`enforceSecondApronHandcuffs`** (via `basicRules.js`) — Catch-all enforcement with correct `>` semantics
4. **`validateHardCap`** — Hard cap ceiling enforcement with correct `>` semantics

**Problem**: All four rules can emit the same `"Second apron team cannot receive more salary than sent"` message for the same violation, causing duplicates in the validation output.

---

## 5. SSOT Proposal

### 5.1 SSOT Helper Location + API

**Recommendation**: Keep `isSecondApronTeam()` and `getTeamApronStatus()` in `utils/capUtils.js` as the **canonical SSOT** for classification. Phase 34 already established this.

**Additional SSOT Utility** (new): Create a unified `getSecondApronStatus()` helper that returns structured status:

```javascript
// File: src/features/architect/utils/tradeMachine/utils/capUtils.js

/**
 * Get comprehensive second apron status for a team
 * @param {Object} team - Team object with totalSalary
 * @param {Object} capSettings - Cap settings with secondApron threshold
 * @returns {Object} { isAboveSecondApron: boolean, threshold: number, teamSalary: number, margin: number }
 */
export function getSecondApronStatus(team, capSettings) {
  const teamSalary = team?.totalSalary || team?.teamTotalSalary || 0;
  const secondApron = capSettings?.secondApron || 0;

  return {
    isAboveSecondApron: secondApron > 0 && teamSalary > secondApron,
    threshold: secondApron,
    teamSalary,
    margin: teamSalary - secondApron, // positive = above, negative = below
  };
}
```

**Migration path**: All inline `>` or `>=` comparisons should call `isSecondApronTeam()` from `capUtils.js`.

### 5.2 Canonical Message Constant(s)

**Recommendation**: Create a new constants file for second-apron-specific messages:

**File**: `src/features/architect/utils/tradeMachine/constants/secondApronMessages.js`

```javascript
/**
 * Canonical second apron violation messages
 * SSOT for all second-apron restriction messaging
 */

// === SALARY MATCHING ===
export const SECOND_APRON_SALARY_MISMATCH =
  'Second apron team cannot receive more salary than sent';

// === TPE RESTRICTIONS ===
export const SECOND_APRON_TPE_BLOCKED =
  'Second apron team cannot use trade exceptions';

export const SECOND_APRON_PRIOR_YEAR_TPE_BLOCKED =
  'Second apron: prior-year TPEs cannot be used.';

// === AGGREGATION ===
export const SECOND_APRON_AGGREGATION_UP_BLOCKED =
  'Second apron team cannot aggregate salaries to acquire higher-paid player';

export const SECOND_APRON_MULTI_TEAM_AGGREGATION_BLOCKED =
  'Second apron team cannot aggregate salaries from multiple clubs';

// === CASH RESTRICTION ===
export const SECOND_APRON_CASH_BLOCKED =
  'Second apron team cannot include cash in trades';

// === HARD CAP ===
export const SECOND_APRON_HARD_CAP_EXCEEDED = (excess) =>
  `2nd Apron hard cap violation: Trade would exceed second apron hard-cap by ${excess}`;

// === FROZEN PICKS ===
export const SECOND_APRON_FROZEN_PICK_BLOCKED =
  'Second apron team cannot trade its own 7-year-out first-round pick.';
```

### 5.3 Migration Plan (Execution Phase Call Sites)

| File                                | Line(s) | Current Code                                       | Migration Action                                               |
| ----------------------------------- | ------- | -------------------------------------------------- | -------------------------------------------------------------- |
| `utils/salaryMatchingRules.js`      | 210     | `salary >= secondApron`                            | Change to `salary > secondApron` OR call `isSecondApronTeam()` |
| `rules/validateTradeExceptions.js`  | 42      | `teamTotalSalary >= secondApron`                   | Import and call `isSecondApronTeam()` from capUtils            |
| `rules/validateStepien.js`          | 197     | `team.team.totalSalary >= capSettings.secondApron` | Import and call `isSecondApronTeam()` from capUtils            |
| `rules/validateSalaryMatching.js`   | 345     | Hardcoded string                                   | Import `SECOND_APRON_SALARY_MISMATCH` from constants           |
| `rules/validateAggregation.js`      | 87      | Hardcoded string                                   | **REMOVE** — duplicate of validateSalaryMatching               |
| `rules/basicRules.js`               | 84      | Hardcoded string                                   | **REMOVE** — validateSalaryMatching handles this               |
| `rules/validateSecondApronRules.js` | 48      | Hardcoded string                                   | **REMOVE** — duplicate file                                    |
| `rules/hardCapValidation.js`        | 116     | Hardcoded string                                   | **CHANGE** to ceiling-specific message only                    |
| `rules/basicRules.js`               | 76      | Hardcoded TPE string                               | Import `SECOND_APRON_PRIOR_YEAR_TPE_BLOCKED`                   |
| `rules/validateSecondApronRules.js` | 40      | Hardcoded TPE string                               | **REMOVE** — duplicate file                                    |
| `rules/validateTradeExceptions.js`  | 51      | Hardcoded TPE string                               | Import `SECOND_APRON_PRIOR_YEAR_TPE_BLOCKED`                   |
| `rules/validateTradeExceptions.js`  | 54      | Hardcoded TPE string                               | Import `SECOND_APRON_TPE_BLOCKED`                              |
| `rules/basicRules.js`               | 98      | Hardcoded cash string                              | Import `SECOND_APRON_CASH_BLOCKED`                             |
| `rules/validateSecondApronRules.js` | 82      | Hardcoded cash string                              | **REMOVE** — duplicate file                                    |

---

## 6. Unused/Redundant Candidates

### 6.1 Duplicate Files (Same Logic, Different Location)

| File                                | Evidence                                                                                                                                                    | Recommendation                                                                                                                |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `rules/validateSecondApronRules.js` | Contains identical logic to `rules/basicRules.js:validateSecondApronRules()`. Both define `validateSecondApronRules()` and `enforceSecondApronHandcuffs()`. | **DELETE** — `basicRules.js` is imported by `tradeValidator.js`. Update `validators/index.js` to import from `basicRules.js`. |
| `rules/aggregationValidator.js`     | Different signature (`trade` instead of `team, context`). Uses `getCapSettings()` import from wrong path. Not imported in main flow.                        | **DELETE** — `validateAggregation.js` is the canonical version used by `tradeValidator.js`.                                   |
| `rules/salaryMatching.js`           | Different structure from `validateSalaryMatching.js`. Not imported in main flow — `tradeValidator.js` imports from `validateSalaryMatching.js`.             | **DELETE** — Orphaned file with wrong semantics.                                                                              |

### 6.2 Invalid Exports in Index Files

| File                   | Line | Issue                                                                                                  | Recommendation                                         |
| ---------------------- | ---- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------ |
| `rules/index.js`       | 22   | `export * from './validateSecondApron.js'` — File does not exist                                       | **REMOVE** export line                                 |
| `rules/index.js`       | 24   | `export * from './enforceSecondApronRules.js'` — File does not exist                                   | **REMOVE** export line                                 |
| `rules/index.js`       | 59   | `export * from './aggregationValidator.js'` — Orphaned duplicate                                       | **REMOVE** after deleting file                         |
| `rules/enforcement.js` | 126  | `export { enforceSecondApronHandcuffs } from './enforceSecondApronHandcuffs.js'` — File does not exist | **REMOVE** or **FIX** to import from `./basicRules.js` |

### 6.3 Evidence of Non-Usage

**`rules/validateSecondApronRules.js`**:

- Exported by `validators/index.js:25` but `tradeValidator.js` imports `enforceSecondApronHandcuffs` from `basicRules.js` (line 21)
- Both files have identical function implementations
- `basicRules.js` is the authoritative source used in main flow

**`rules/aggregationValidator.js`**:

- Not imported anywhere in `tradeValidator.js`
- Uses different function signature: `validateAggregation(trade)` vs `validateAggregation(team, context)`
- Contains wrong semantics: `>=` instead of `>`

**`rules/salaryMatching.js`**:

- Not imported by `tradeValidator.js`
- `tradeValidator.js` imports `validateSalaryMatching` from `validateSalaryMatching.js` (line 10)
- Contains wrong semantics: `>=` instead of `>`

---

## 7. Phase 35 Execution Plan

### 7.1 Production Files to Modify

| Priority | File                                       | Changes                                                                                         |
| -------- | ------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| 1        | **NEW** `constants/secondApronMessages.js` | Create canonical message constants                                                              |
| 2        | `utils/salaryMatchingRules.js`             | Fix `>=` to `>` at line 210                                                                     |
| 3        | `rules/validateTradeExceptions.js`         | Fix `>=` to `>` at line 42, import message constants                                            |
| 4        | `rules/validateStepien.js`                 | Fix `>=` to `>` at line 197, use `isSecondApronTeam()`                                          |
| 5        | `rules/validateSalaryMatching.js`          | Import message constant, remove duplicate emission check                                        |
| 6        | `rules/validateAggregation.js`             | **REMOVE** duplicate salary mismatch message (line 87) — let `validateSalaryMatching` handle it |
| 7        | `rules/basicRules.js`                      | **REMOVE** duplicate salary mismatch message (line 84), import message constants for TPE/cash   |
| 8        | `rules/hardCapValidation.js`               | Change line 116 message to be ceiling-specific only (not salary matching)                       |
| 9        | `rules/index.js`                           | Remove invalid exports (lines 22, 24, 59)                                                       |
| 10       | `rules/enforcement.js`                     | Fix line 126 to import from `basicRules.js`                                                     |

### 7.2 Files to Delete

| File                                | Reason                                  |
| ----------------------------------- | --------------------------------------- |
| `rules/validateSecondApronRules.js` | Duplicate of `basicRules.js`            |
| `rules/aggregationValidator.js`     | Orphaned duplicate with wrong semantics |
| `rules/salaryMatching.js`           | Orphaned duplicate with wrong semantics |

### 7.3 Tests to Add/Update

| Test File                                 | Changes                                                                       |
| ----------------------------------------- | ----------------------------------------------------------------------------- |
| `tests/secondApronSSoT.test.js` (NEW)     | Test that `isSecondApronTeam()` uses strict `>` semantics                     |
| `tests/validateSalaryMatching.test.js`    | Verify no duplicate messages for second apron violations                      |
| `tests/validateAggregation.test.js`       | Verify aggregation does NOT emit salary mismatch message                      |
| `tests/hardCapValidation.test.js`         | Verify hard cap emits ceiling-specific message only                           |
| `tests/integration/tradeLegality.test.js` | End-to-end test: second apron trade emits exactly ONE salary mismatch message |

### 7.4 Regression Validation

1. **Run existing test suite**: `npm run test -- --run`
2. **Verify no duplicate messages**: Check `validateTrade()` output for second apron team trades
3. **Verify strict semantics**: Test team with salary exactly at second apron (should NOT be flagged)
4. **Verify message deduplication**: Single trade should emit max 1 salary mismatch message
5. **Verify constants usage**: All second apron messages should come from `secondApronMessages.js`

---

## 8. Master Doc Draft History Line

Add to `CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md`:

```markdown
### Phase 35 — Second Apron Status SSOT + Emitter Consolidation (2026-01-23)

**Goal**: Eliminate duplicate second-apron classification logic and consolidate violation message emitters.

**Deliverables**:

- Created canonical message constants in `constants/secondApronMessages.js`
- Fixed 5 call sites using incorrect `>=` semantics to use strict `>` per CBA Art VII Sec 2(f)
- Removed 3 duplicate/orphaned files: `validateSecondApronRules.js`, `aggregationValidator.js`, `salaryMatching.js`
- Fixed invalid exports in `rules/index.js` and `rules/enforcement.js`
- Deduplicated message emission: `SECOND_APRON_SALARY_MISMATCH` now emitted only by `validateSalaryMatching`
- Updated `validateAggregation` and `hardCapValidation` to emit category-specific messages only

**Test Coverage**: Added `secondApronSSoT.test.js` for SSOT verification and updated integration tests for message deduplication.

**Status**: ✅ Complete
```

---

## Stop Conditions Encountered

**None.** The preflight analysis was able to:

1. ✅ Confidently determine the main trade validator flow (imports from `basicRules.js`, not `validateSecondApronRules.js`)
2. ✅ Identify single SSOT for apron thresholds (`capUtils.js` with `isSecondApronTeam()`)
3. ✅ Map all duplicate emitters and determine `validateSalaryMatching` as the primary owner

---

## Appendix: Quick Reference — Files with `>=` to Fix

```
src/features/architect/utils/tradeMachine/utils/salaryMatchingRules.js:210
src/features/architect/utils/tradeMachine/rules/validateTradeExceptions.js:42
src/features/architect/utils/tradeMachine/rules/validateStepien.js:197
src/features/architect/utils/tradeMachine/rules/aggregationValidator.js:13 (DELETE file)
src/features/architect/utils/tradeMachine/rules/salaryMatching.js:15 (DELETE file)
```
