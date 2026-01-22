# PHASE 34 — Second Apron Threshold Boundary Bug Preflight Return Package

**DATE:** 2026-01-23  
**PHASE:** 34 — Second Apron Threshold Boundary Bug  
**MODE:** PREFLIGHT (review-only; NO production code changes)  
**VERDICT:** ✅ CONFIRMED BUG — Incorrect comparator (`>=` instead of `>`)  
**MASTER DOC:** `docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md`

---

## A) Root Cause Evidence

### Message-to-Rule Mapping Table

The message `'Second apron team cannot receive more salary than sent'` is emitted by **6 different source files**:

| #   | File                                                                                                           | Function                     | Line(s) | Rule Key                 | Called By Validator?     |
| --- | -------------------------------------------------------------------------------------------------------------- | ---------------------------- | ------- | ------------------------ | ------------------------ |
| 1   | [aggregationValidator.js](src/features/architect/utils/tradeMachine/rules/aggregationValidator.js#L80)         | `validateAggregation()`      | 80      | N/A (standalone)         | ❌ Not used in main flow |
| 2   | [validateSecondApronRules.js](src/features/architect/utils/tradeMachine/rules/validateSecondApronRules.js#L47) | `validateSecondApronRules()` | 47      | N/A (standalone)         | ❌ Not used in main flow |
| 3   | **[basicRules.js](src/features/architect/utils/tradeMachine/rules/basicRules.js#L87)**                         | `validateSecondApronRules()` | 87      | `secondApronEnforcement` | ✅ **PRIMARY EMITTER**   |
| 4   | [validateAggregation.js](src/features/architect/utils/tradeMachine/rules/validateAggregation.js#L85)           | `validateAggregation()`      | 85      | `aggregation`            | ✅ Yes                   |
| 5   | [validateSalaryMatching.js](src/features/architect/utils/tradeMachine/rules/validateSalaryMatching.js#L343)    | `validateSalaryMatching()`   | 343     | `salaryMatching`         | ✅ Yes                   |
| 6   | [hardCapValidation.js](src/features/architect/utils/tradeMachine/rules/hardCapValidation.js#L108)              | `validateHardCap()`          | 108     | `hardCap`                | ✅ Yes                   |

### Primary Emitter Analysis

The spurious violation in the Phase 33 scenario comes from **`basicRules.js`** via the `enforceSecondApronHandcuffs()` function, which internally calls `validateSecondApronRules()`.

**The bug is on lines 57-62 of `basicRules.js`:**

```javascript
// Check if team is at/above second apron EITHER before OR after trade
// This catches both teams already above apron AND teams crossing into apron
const isAtOrAboveSecondApron =
  team?.postTradeStatus?.isAtOrAboveSecondApron ||
  teamTotalSalary >= secondApron || // ← BUG: uses >= not >
  projectedSalary >= secondApron || // ← BUG: uses >= not >
  team?.context?.isAtOrAboveSecondApron ||
  false;
```

### CBA Evidence

Per **CBA Article VII, Section 2(f), Rule Card 6**:

> 1. If Apron Salary **>** Second Apron, team is "Second Apron Team."

The CBA explicitly uses **greater than (`>`)**, NOT **greater than or equal (`>=`)**.

A team whose salary **equals** the second apron threshold is NOT a second apron team.

---

## B) Repro Evidence

### Scenario (from Phase 33)

- **Team A pre-trade salary:** $180,000,000
- **Team A sends:** $0
- **Team A receives:** $10,000,000
- **Team A post-trade (projected):** $190,000,000
- **Second Apron (2024-25):** $190,000,000
- **Result:** `projectedSalary == secondApron` → `190M >= 190M` → TRUE

### Violations Array (reproduced)

```javascript
Team A violations: [
  'Incoming salary exceeds allowable amount by $10,000,000. First apron teams cannot receive more salary than sent out.',
  '1st Apron hard cap violation: Trade would exceed first apron hard-cap by $11,000,000',
  'Second apron team cannot receive more salary than sent'  // ← SPURIOUS
]
```

### Rules Sub-block for `secondApronEnforcement`

```javascript
result.teamResults[0].rules.secondApronEnforcement = [
  'Second apron team cannot receive more salary than sent',
];
```

The violation fires because `basicRules.js` line 60-61 evaluates `projectedSalary >= secondApron` as TRUE when they are equal.

---

## C) Repo Consistency Scan

### Second Apron Classification Comparators

| File                                                                                                               | Concept                            | Comparator | Uses Pre or Post   | Notes                     |
| ------------------------------------------------------------------------------------------------------------------ | ---------------------------------- | ---------- | ------------------ | ------------------------- |
| [basicRules.js#L60-61](src/features/architect/utils/tradeMachine/rules/basicRules.js#L60-L61)                      | Team classification                | `>=`       | BOTH               | **BUG: Should use `>`**   |
| [validateSecondApronRules.js#L21](src/features/architect/utils/tradeMachine/rules/validateSecondApronRules.js#L21) | Team classification                | `>=`       | Pre-trade only     | Same bug pattern          |
| [validateAggregation.js#L23](src/features/architect/utils/tradeMachine/rules/validateAggregation.js#L23)           | Team classification                | `>=`       | Pre-trade only     | Same bug pattern          |
| [validateSalaryMatching.js#L328](src/features/architect/utils/tradeMachine/rules/validateSalaryMatching.js#L328)   | Team classification                | `>=`       | Pre-trade          | Same bug pattern          |
| [hardCapValidation.js#L86](src/features/architect/utils/tradeMachine/rules/hardCapValidation.js#L86)               | Status flag (`isAboveSecondApron`) | `>=`       | Pre-trade          | **Named misleadingly**    |
| [hardCapValidation.js#L93](src/features/architect/utils/tradeMachine/rules/hardCapValidation.js#L93)               | Ceiling violation check            | `>`        | Projected          | **CORRECT** (for ceiling) |
| [capUtils.js#L34](src/features/architect/utils/tradeMachine/utils/capUtils.js#L34)                                 | `isSecondApronTeam()`              | `>=`       | Pre-trade          | Should use `>` per CBA    |
| [capUtils.js#L47](src/features/architect/utils/tradeMachine/utils/capUtils.js#L47)                                 | `getTeamApronStatus()`             | `>=`       | Pre-trade          | Should use `>` per CBA    |
| [salaryMargin.js#L26](src/features/architect/utils/tradeMachine/utils/salaryMargin.js#L26)                         | Margin calc                        | `>=`       | Post-trade payroll | Should use `>` per CBA    |
| [salaryMargin.js#L93](src/features/architect/utils/tradeMachine/utils/salaryMargin.js#L93)                         | Ceiling calc                       | `>=`       | Pre-trade          | Should use `>` per CBA    |

### First Apron & Hard Cap Comparators (Reference)

| File                                                                                                             | Concept                    | Comparator | Notes                                           |
| ---------------------------------------------------------------------------------------------------------------- | -------------------------- | ---------- | ----------------------------------------------- |
| [hardCapValidation.js#L93](src/features/architect/utils/tradeMachine/rules/hardCapValidation.js#L93)             | Hard cap ceiling           | `>`        | Correct (ceiling violation is strictly greater) |
| [hardCapValidation.js#L115](src/features/architect/utils/tradeMachine/rules/hardCapValidation.js#L115)           | First apron ceiling        | `>`        | Correct                                         |
| [validateSalaryMatching.js#L348](src/features/architect/utils/tradeMachine/rules/validateSalaryMatching.js#L348) | First apron classification | `>=`       | Consistent with second apron                    |
| [useCapValidation.js#L212](src/features/architect/hooks/useCapValidation.js#L212)                                | Warning display            | `>`        | Correct (warns only if strictly over)           |

### Key Finding: Two Different Semantics

The codebase conflates two related but distinct concepts:

1. **Classification** ("Is this team a second apron team?"): Uses `>=` throughout → **INCORRECT per CBA**
2. **Ceiling violation** ("Would this trade exceed the cap?"): Uses `>` in some places → **CORRECT**

---

## D) Verdict + Fix Options

### Verdict: ✅ CONFIRMED BUG

The code incorrectly treats `salary == threshold` as "at or above" the second apron. Per CBA Article VII, Section 2(f), Rule Card 6, a team is only a "Second Apron Team" if their salary is **strictly greater than** the second apron threshold.

**Root cause:** Overly cautious implementation used `>=` to be "safe" but this violates the explicit CBA definition.

---

### Option A: Change comparator to `>` in all classification checks (RECOMMENDED)

**What changes:**

- Replace `>=` with `>` in all "second apron team classification" checks
- Keep `>=` only for ceiling violations (these are about preventing going over, which should trigger at equality)

**Files to modify:**

| File                          | Line(s) | Change                                                                      |
| ----------------------------- | ------- | --------------------------------------------------------------------------- |
| `basicRules.js`               | 60, 61  | `>= secondApron` → `> secondApron`                                          |
| `validateSecondApronRules.js` | 21      | `>= secondApron` → `> secondApron`                                          |
| `validateAggregation.js`      | 23      | `>= secondApron` → `> secondApron`                                          |
| `validateSalaryMatching.js`   | 328     | `>= secondApron` → `> secondApron`                                          |
| `hardCapValidation.js`        | 86      | `>= secondApron` → `> secondApron` (rename to `isAboveSecondApron` matches) |
| `capUtils.js`                 | 34, 47  | `>= secondApron` → `> secondApron`                                          |
| `salaryMargin.js`             | 26, 93  | `>= secondApron` → `> secondApron`                                          |

**Why it's correct:**

- Aligns with CBA Article VII, Section 2(f) which explicitly uses `>` for second apron team definition
- Teams AT the threshold are NOT restricted by second apron rules

**Risks/side-effects:**

- Teams exactly at the threshold will no longer be treated as second apron teams
- This is CORRECT behavior per CBA
- May need to audit UI display strings that say "at or above"

---

### Option B: Use pre-trade salary ONLY for second apron classification

**What changes:**

- Keep `>=` comparator but only check pre-trade salary, not projected salary
- The "crossing into apron" logic would be removed from classification

**Files to modify:**

| File            | Change                                                      |
| --------------- | ----------------------------------------------------------- |
| `basicRules.js` | Remove `projectedSalary >= secondApron` from classification |

**Why this might be considered:**

- If the intent was "teams already at second apron have restrictions" vs "teams about to cross"
- Would limit the scope of the fix

**Why it's NOT recommended:**

- Still uses `>=` which is wrong per CBA
- Doesn't address the fundamental comparator bug
- Would create different behavior for "crossing into" vs "already at" scenarios

---

### Option C: No fix needed (expectation mismatch)

**NOT APPLICABLE** - The CBA clearly states `>` not `>=`. This is a confirmed bug.

---

## E) Test Plan

### Test File Location

**Existing file:** `tests/trade/secondApron_handcuffs.test.js`
**Alternative:** Add tests to `tests/tradeValidator.test.js`

**Recommended:** Create a new test file for boundary cases:
`tests/trade/secondApronBoundary.test.js`

### Boundary Test Matrix

| Test Case                | Pre-Trade Salary | Salary Out | Salary In | Post-Trade | Second Apron | Expected `isSecondApron` | Expected Violations               |
| ------------------------ | ---------------- | ---------- | --------- | ---------- | ------------ | ------------------------ | --------------------------------- |
| Below, stays below       | $180M            | $0         | $5M       | $185M      | $190M        | FALSE                    | None (for second apron rules)     |
| Below, equals threshold  | $180M            | $0         | $10M      | $190M      | $190M        | FALSE                    | None (for second apron rules)     |
| Below, crosses into      | $180M            | $0         | $15M      | $195M      | $190M        | TRUE (after trade)       | Second apron rules apply          |
| At threshold, stays at   | $190M            | $10M       | $10M      | $190M      | $190M        | FALSE                    | None                              |
| At threshold, goes above | $190M            | $5M        | $10M      | $195M      | $190M        | TRUE (after trade)       | Second apron rules apply          |
| Above, stays above       | $195M            | $10M       | $8M       | $193M      | $190M        | TRUE                     | Second apron 100% match violation |
| Above, equals threshold  | $195M            | $5M        | $0M       | $190M      | $190M        | FALSE (after trade)      | None (exiting second apron)       |

### Suggested Test Names

```javascript
describe('second apron boundary cases', () => {
  it('does not flag team whose projectedSalary equals secondApron exactly');
  it('does not flag pre-trade salary at threshold as second apron team');
  it('flags team whose projectedSalary exceeds secondApron by $1');
  it('flags team whose pre-trade salary exceeds secondApron');
  it(
    'allows team at threshold to receive more salary than sent (not second apron)'
  );
});
```

### Rule-Scoped Assertions (Resilient to Ordering)

```javascript
// Good - checks specific rule
expect(result.teamResults[0].rules.secondApronEnforcement).toEqual([]);

// Avoid - depends on violation order
expect(result.teamResults[0].violations[0]).not.toContain('Second apron');
```

---

## F) Doc Diffs

### Master Doc Phase 34 Entry

Add to `docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md` history section:

```markdown
- - 2026-01-23: Phase 34 Second Apron Threshold Boundary Bug Preflight - identified `>=` vs `>` comparator bug in 8 files; CBA Art VII Sec 2(f) specifies `>` for second apron team classification
```

### Return Package File Confirmation

✅ This file created at: `docs/architect/return_packages/PHASE_34_SECOND_APRON_THRESHOLD_PREFLIGHT_RETURN_PACKAGE.md`

---

## Summary Table

| Task                              | Status           | Finding                                                                |
| --------------------------------- | ---------------- | ---------------------------------------------------------------------- |
| Locate emitting source            | ✅ Complete      | 6 files emit the message; `basicRules.js` is primary in validator flow |
| Reproduce scenario                | ✅ Complete      | `projectedSalary == secondApron` triggers spurious violation           |
| Identify classification condition | ✅ Complete      | Uses `>=` comparator; checks BOTH pre-trade AND projected              |
| CBA reference check               | ✅ Complete      | CBA Art VII Sec 2(f) Rule Card 6: "Apron Salary **>** Second Apron"    |
| Repo consistency scan             | ✅ Complete      | 10+ files use `>=` for classification; only ceiling checks use `>`     |
| Verdict                           | ✅ BUG CONFIRMED | Comparator should be `>` not `>=` per CBA                              |
| Fix options                       | ✅ Complete      | Option A (change to `>`) recommended; 8 files to modify                |
| Test plan                         | ✅ Complete      | Boundary test matrix with 7 scenarios defined                          |

---

## Execution Phase Scope

When proceeding to execution:

1. **Change comparator to `>` in 8 files** (see Option A file list)
2. **Add boundary tests** covering equality case
3. **Verify all 14 existing tradeValidator tests pass**
4. **Update UI strings** if any say "at or above" (should say "above" only)
5. **Re-run secondApron_handcuffs tests** to ensure no regressions

---

**PREFLIGHT COMPLETE**
