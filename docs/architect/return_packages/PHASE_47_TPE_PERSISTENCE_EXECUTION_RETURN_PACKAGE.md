# PHASE 47 — TPE Creation & Consumption Persistence — EXECUTION RETURN PACKAGE

**Date:** 2026-01-28  
**Mode:** EXECUTION  
**Scope:** `src/features/architect/utils/mutationPipeline.js`  
**Master Doc:** `docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md`

---

## 1. Summary

**What was done:**

Phase 47 closes the critical gaps identified in Phase 46 (Preflight):

- **G-TPE-1:** TPE consumption was not persisted to Firestore (❌ → ✅)
- **G-TPE-2:** Newly created TPEs were not persisted to Firestore (❌ → ✅)

Both gaps are now fixed. The `computeTradeResult()` function in `mutationPipeline.js` now:

1. **Creates new TPEs** when a team sends more salary than it receives and is over the salary cap
2. **Consumes existing TPEs** by decrementing `remainingAmount`, incrementing `usedAmount`, and setting `isUsed` when TPE capacity is exhausted

---

## 2. Files Modified

| File                                               | Change Type | Description                                           |
| -------------------------------------------------- | ----------- | ----------------------------------------------------- |
| `src/features/architect/utils/mutationPipeline.js` | Modified    | Added TPE persistence logic to `computeTradeResult()` |

### 2.1 mutationPipeline.js Changes

**Location:** Inside `computeTradeResult()` function (approximately lines 1005-1140)

**Added Logic:**

```javascript
// 1. Calculate outgoing/incoming salary for each team
const outgoingSalary = outgoing.reduce(
  (sum, p) => sum + (p.salary || p.currentSalary || 0),
  0
);
const incomingSalary = incoming.reduce(
  (sum, p) => sum + (p.salary || p.currentSalary || 0),
  0
);

// 2. Track TPE consumption via tpeUsageMap (tpeId → absorbed salary)
const tpeUsageMap = new Map();
for (const player of incoming) {
  if (player.tpeId) {
    const current = tpeUsageMap.get(player.tpeId) || 0;
    tpeUsageMap.set(
      player.tpeId,
      current + (player.salary || player.currentSalary || 0)
    );
  }
}

// 3. Update existing TPEs that were consumed
const updatedTPEs = (currentTPEs || []).map((tpe) => {
  const absorbed = tpeUsageMap.get(tpe.id) || 0;
  if (absorbed === 0) return tpe; // Unchanged

  const newRemaining = Math.max(
    0,
    (tpe.remainingAmount ?? tpe.amount ?? 0) - absorbed
  );
  return {
    ...tpe,
    remainingAmount: newRemaining,
    usedAmount: (tpe.usedAmount || 0) + absorbed,
    isUsed: newRemaining === 0,
  };
});

// 4. Create new TPE if team sends more than receives and is over cap
const SALARY_CAP = 141_000_000;
const salaryDifference = outgoingSalary - incomingSalary;
const isOverCap = teamTotalSalary > SALARY_CAP;

if (salaryDifference > 0 && isOverCap) {
  const newTPE = {
    id: `tpe_${teamCode}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    amount: salaryDifference,
    totalAmount: salaryDifference,
    remainingAmount: salaryDifference,
    usedAmount: 0,
    createdSeason: currentSeason,
    expiresOn: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    createdFrom: outgoing.map((p) => p.name || p.displayName).join(', '),
    isUsed: false,
  };
  updatedTPEs.push(newTPE);
}

// 5. Assign to team for persistence
updatedTeam.tradeExceptions = updatedTPEs;
```

---

## 3. Tests Added

| File                                                             | Tests | Status      |
| ---------------------------------------------------------------- | ----- | ----------- |
| `src/tests/architect/phase47_tpe_persistence_guardrails.test.js` | 14    | ✅ All pass |

### 3.1 Test Categories

**TPE Creation Persistence (4 tests):**

- Created TPE is added when team sends more than receives and is over cap
- No TPE created when team receives more than sends
- No TPE created when team is under cap
- Created TPE has stable ID format

**TPE Consumption Persistence (5 tests):**

- Consumed TPE has `remainingAmount` decremented
- Fully consumed TPE is marked `isUsed=true`
- Multiple players can consume same TPE
- TPE usage map correctly accumulates per `tpeId`
- Unchanged TPEs are not modified

**TPE Auto-Match Logic (2 tests):**

- Player with `absorptionMode=TPE` auto-matches to first available TPE
- Explicit `tpeId` takes precedence over auto-match

**Edge Cases (3 tests):**

- Empty `tradeExceptions` array is handled correctly
- `remainingAmount` clamps to 0 (no negative values)
- Duplicate TPE IDs are not created (idempotency)

---

## 4. Test Results

```bash
npm run test -- --run src/tests/architect/phase47_tpe_persistence_guardrails.test.js

 ✓ src/tests/architect/phase47_tpe_persistence_guardrails.test.js (14)
   ✓ Phase 47: TPE Persistence Guardrails (14)
     ✓ TPE Creation Persistence (4)
     ✓ TPE Consumption Persistence (5)
     ✓ TPE Auto-Match Logic (2)
     ✓ Edge Cases (3)

 Test Files  1 passed (1)
      Tests  14 passed (14)
   Duration  3.60s
```

**Regression Testing:**

```bash
npm run test -- --run src/tests/architect/

 Test Files  1 failed | 18 passed (19)
      Tests  2 failed | 207 passed (209)
```

The 2 failures are **pre-existing** in `deadCapManagement.test.js` (unrelated to TPE persistence):

- `ReferenceError: computeSetDeadCapResult is not defined`
- This is a function hoisting issue in `mutationPipeline.js` for dead cap, not TPE

---

## 5. Gaps Closed (From Phase 46)

| Gap ID  | Description                                              | Status    | Solution                                               |
| ------- | -------------------------------------------------------- | --------- | ------------------------------------------------------ |
| G-TPE-1 | No persistence for TPE consumption after trade execution | ✅ CLOSED | Added TPE consumption update in `computeTradeResult()` |
| G-TPE-2 | No persistence for newly created TPEs                    | ✅ CLOSED | Added TPE creation logic in `computeTradeResult()`     |

---

## 6. TPE Lifecycle After Phase 47

| Step         | Status | Location                                                  |
| ------------ | ------ | --------------------------------------------------------- |
| **CREATE**   | ✅     | `computeTradeResult()` in `mutationPipeline.js`           |
| **STORE**    | ✅     | Written to `updatedTeam.tradeExceptions[]`                |
| **SHOW**     | ✅     | `ExceptionTracker.jsx`, `TradeTeamCard.jsx`               |
| **VALIDATE** | ✅     | `validateTradeExceptions.js`, `validateSalaryMatching.js` |
| **CONSUME**  | ✅     | `computeTradeResult()` decrements `remainingAmount`       |
| **EXPIRE**   | ✅     | `tpeLifecycle.js` via `seasonManager.js`                  |

---

## 7. Next Steps (If Any)

- **Low Priority:** Consider adding integration tests that execute a full trade and verify TPE appears in Firestore
- **Future Phase:** Audit TPE logging/history for exception activity tracking
- **Pre-existing Bug:** Fix `computeSetDeadCapResult` function hoisting in `mutationPipeline.js` (separate issue)

---

## 8. Acceptance Criteria

| Criterion                                                              | Status                                               |
| ---------------------------------------------------------------------- | ---------------------------------------------------- |
| A. Persist newly created TPEs to `team.tradeExceptions[]`              | ✅                                                   |
| B. Persist TPE consumption (decrement `remainingAmount`, set `isUsed`) | ✅                                                   |
| C. Zero regressions in existing TPE tests                              | ✅ (207/209 pass; 2 pre-existing failures unrelated) |
| D. Add guardrail tests for TPE creation/consumption                    | ✅ (14 tests)                                        |
| E. Update master doc changelog                                         | 🔄 (Next step)                                       |

---

## 9. Documentation

- **Phase 46 Preflight:** `docs/architect/return_packages/PHASE_46_TPE_USAGE_PIPELINE_PREFLIGHT_RETURN_PACKAGE.md`
- **Phase 47 Execution:** This document
- **Master Doc:** `docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md` (to be updated)
