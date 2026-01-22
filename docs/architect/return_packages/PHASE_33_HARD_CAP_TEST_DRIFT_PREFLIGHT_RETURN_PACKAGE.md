# PHASE 33 — Hard Cap Test Drift Preflight Return Package

**DATE:** 2026-01-23  
**PHASE:** 33 — TradeValidator Hard Cap Failure Analysis  
**VERDICT:** TEST DRIFT ✅  
**MASTER DOC:** `docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md`

---

## 1) Failure Snapshot

### Failing Test

- **File:** [tests/tradeValidator.test.js](tests/tradeValidator.test.js#L51-L74)
- **Test Name:** `flags trades that would violate a hard cap`
- **Failing Assertion:** Line 70-72

```javascript
expect(result.teamResults[0].violations[0]).toContain(
  '1st Apron hard cap violation'
);
```

### Actual vs Expected

| Expected                         | Actual                                                                                                                   |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `'1st Apron hard cap violation'` | `'Incoming salary exceeds allowable amount by $10,000,000. First apron teams cannot receive more salary than sent out.'` |

---

## 2) Scenario Reconstruction

### Trade Setup

- **Team A:**
  - Salary: $180,000,000 (above first apron $179M)
  - `hardCapped: true` explicitly passed in trade input
  - Sends: [] (no outgoing players)
  - Receives: 1 player worth $10M
- **Team B:**
  - Salary: $150,000,000
  - Sends: [player worth $10M]

### Cap Settings (2024-25 from capProjections)

- Salary Cap: $141M
- First Apron: $179M
- Second Apron: $190M

### Post-Trade Calculation

- Team A pre-trade: $180M
- Team A post-trade: $180M - $0 + $10M = **$190M**
- This exceeds first apron ($179M) by **$11M**

### Should This Trigger a Hard Cap Violation?

**YES.** Team A is:

1. Marked as `hardCapped: true` → should be capped at first apron
2. Post-trade salary ($190M) exceeds first apron ($179M)
3. Therefore, hard cap violation should be emitted

---

## 3) Message Source Trace

### Where "Incoming salary exceeds..." Comes From

- **Source:** [validateSalaryMatching.js](src/features/architect/utils/tradeMachine/rules/validateSalaryMatching.js#L362-L366)

```javascript
// Lines 362-366
violations.push(
  `Incoming salary exceeds allowable amount by ${formatCurrency(effectiveSalaryIn - salaryOut)}. ` +
    `First apron teams cannot receive more salary than sent out.`
);
```

This fires for teams above first apron who receive more than they send (100% matching rule).

### Where "1st Apron hard cap violation..." Comes From

- **Source:** [hardCapValidation.js](src/features/architect/utils/tradeMachine/rules/hardCapValidation.js#L114-L119)

```javascript
// Lines 114-119
else if (isHardCappedFirstApron) {
  hardCapType = 'FirstApron';
  if (projectedSalary > actualFirstApron) {
    violations.push(
      `1st Apron hard cap violation: Trade would exceed first apron hard-cap by ${formatCurrency(projectedSalary - actualFirstApron)}`
    );
  }
}
```

### Actual Violations Emitted (Debug Output)

The validator **IS emitting both violations correctly**:

```javascript
Team A violations: [
  'Incoming salary exceeds allowable amount by $10,000,000. First apron teams cannot receive more salary than sent out.',
  '1st Apron hard cap violation: Trade would exceed first apron hard-cap by $11,000,000',
  'Second apron team cannot receive more salary than sent'  // SPURIOUS - separate bug
]
```

### Why Test Fails

The test checks `violations[0]`, but violations are collected in this order:

1. `salaryMatching` (object key order in `allRules`)
2. `hardCap` (appears second)

The hard cap violation exists but at `violations[1]`, not `violations[0]`.

---

## 4) Verdict

### ✅ TEST DRIFT (Not Logic Bug)

**Evidence:**

- Hard cap validation **is working correctly**
- The exact expected message `'1st Apron hard cap violation: Trade would exceed first apron hard-cap by $11,000,000'` **is present** in violations
- It appears at `violations[1]` instead of `violations[0]` due to collection order
- The `rules.hardCap.passed` correctly returns `false`
- The `rules.hardCap.violations` contains the expected message

**Root Cause:**
The test was written when hard cap violations were the only/primary violation for this scenario. After salary matching logic matured, first-apron teams also get salary matching violations (100% matching rule). Both rules correctly detect violations, but collection order puts salary matching first.

### Secondary Finding: Spurious Second Apron Violation

There's also an unexpected third violation: `'Second apron team cannot receive more salary than sent'`

This is incorrect because:

- Team A is at $180M (below $190M second apron)
- Team A should NOT be treated as a second apron team

This appears to be a separate bug where the post-trade projected salary ($190M) equals the second apron threshold, and some validator is incorrectly flagging it. **This should be tracked separately but does not affect the primary verdict.**

---

## 5) Execution Plan

### Minimal Fix: Update Test Assertion

**File:** `tests/tradeValidator.test.js`  
**Lines:** 70-72

**Current (Failing):**

```javascript
expect(result.teamResults[0].violations[0]).toContain(
  '1st Apron hard cap violation'
);
```

**Recommended Fix Option A (Check violations array includes message):**

```javascript
expect(result.teamResults[0].violations).toContainEqual(
  expect.stringContaining('1st Apron hard cap violation')
);
```

**Recommended Fix Option B (Check specific rule):**

```javascript
expect(result.teamResults[0].rules.hardCap.violations[0]).toContain(
  '1st Apron hard cap violation'
);
```

**Option B is preferred** because:

- It tests the specific rule's behavior
- It's resilient to changes in violation collection order
- It aligns with how other tests check specific rule results (e.g., `rules.salaryMatching.passed`)

### No Logic Changes Required

- `hardCapValidation.js` is working correctly
- `validateSalaryMatching.js` is working correctly
- Both rules are correctly detecting violations

### Files to Modify

| File                           | Change                         |
| ------------------------------ | ------------------------------ |
| `tests/tradeValidator.test.js` | Update assertion on line 70-72 |

---

## 6) Acceptance Criteria

### Primary

- [ ] `npm run test tests/tradeValidator.test.js -- --run` passes all tests
- [ ] Hard cap violation message is validated via `rules.hardCap.violations` or `toContainEqual`
- [ ] No changes to production validation logic

### Secondary (Track Separately)

- [ ] Investigate spurious "Second apron team cannot receive more salary than sent" violation
- [ ] Create ticket for second apron threshold boundary condition bug

---

## 7) Additional Notes

### Test Improvement Recommendation

Consider updating all tests to check specific rule results (`rules.X.violations`) rather than the aggregated `violations[]` array. This makes tests more resilient and semantically clearer about what's being tested.

### Hard Cap Detection Summary

The hard cap detection flow is:

```
team.hardCapped === true
  → isHardCappedFirstApron = true
  → projectedSalary ($190M) > actualFirstApron ($179M)
  → violations.push('1st Apron hard cap violation...')
```

This path works correctly. The test simply needs to look in the right place.

---

## Return Package Complete

**Next Step:** Phase 33 Execution — Update test assertion in `tests/tradeValidator.test.js`

**Estimated Effort:** 5 minutes  
**Risk Level:** Low (test-only change)
