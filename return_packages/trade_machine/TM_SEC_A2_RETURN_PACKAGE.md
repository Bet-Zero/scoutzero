# TM_SEC_A2 RETURN PACKAGE — Hard Caps / Aprons Audit

**Audit ID:** TM_SEC_A2  
**Date:** 2026-02-14  
**Mode:** PREFLIGHT (Discovery-only)  
**Section:** 4 (Hard Caps + Aprons)  
**Status:** ✅ COMPLETE

---

## Summary Answers

| Question                                                      | Answer                  | Evidence                                      |
| ------------------------------------------------------------- | ----------------------- | --------------------------------------------- |
| Does legality enforce hard-cap apron compliance?              | **YES**                 | `validateHardCap()` in `hardCapValidation.js` |
| Is allowable incoming clamped by apron room when hard-capped? | **NO** ❌               | No `min()` clamp found                        |
| Does UI display use the same computed values as validation?   | **YES** (but unclamped) | `getOfficialSalaryMatchingSnapshot()`         |

---

## Section 4 Checklist Status (100% filled)

| #   | Item                                        | Impl?   | Valid? | SSOT? | Risk     |
| --- | ------------------------------------------- | ------- | ------ | ----- | -------- |
| 4.1 | Team hard-cap status determined             | YES     | YES    | YES   | LOW      |
| 4.2 | Hard-cap cause model                        | YES     | YES    | YES   | LOW      |
| 4.3 | Post-trade salary computed                  | YES     | YES    | YES   | LOW      |
| 4.4 | Hard-cap illegality enforced                | YES     | YES    | YES   | LOW      |
| 4.5 | **allowableIncoming clamped by apron room** | **NO**  | **NO** | N/A   | **HIGH** |
| 4.6 | UI communicates hard-cap constraint         | YES     | N/A    | YES   | LOW      |
| 4.7 | UI shows "only $X room" messaging           | PARTIAL | N/A    | YES   | MED      |

---

## Key Finding: Missing Apron Room Clamp (HIGH RISK)

### Problem

When a hard-capped team trades, `allowableIncoming` is computed from salary matching bands (100% for first/second apron teams), but is **NOT clamped** to the team's remaining hard-cap room.

### Evidence

**Expected Formula:**

```
allowableIncoming = min(salaryMatchCeiling, apronRoomRemaining)
```

**Actual Implementation:**

```javascript
// salaryMatchingRules.js:L255 - First apron case
allowableIncoming: outgoing   // ← No clamp by apron room

// hardCapValidation.js:L121 - Separate check, AFTER the fact
if (projectedSalary > actualFirstApron) { violations.push(...) }
```

### Impact

| Scenario     | Team         | Apron Room | Outgoing | Displayed Allowable | Actual Usable | Gap     |
| ------------ | ------------ | ---------- | -------- | ------------------- | ------------- | ------- |
| Lakers Trade | $177M salary | $1.132M    | $5M      | $5M                 | $1.132M       | $3.868M |

User sees "$5M allowable" but trade fails when receiving anything over $1.132M.

---

## Files Referenced (12 files)

1. `src/features/architect/utils/tradeMachine/rules/validateSalaryMatching.js`
2. `src/features/architect/utils/tradeMachine/rules/hardCapValidation.js`
3. `src/features/architect/utils/tradeMachine/utils/salaryMatchingRules.js`
4. `src/features/architect/utils/tradeMachine/utils/salaryMargin.js`
5. `src/features/architect/utils/tradeMachine/utils/capUtils.js`
6. `src/features/architect/utils/tradeMachine/utils/capSettingsProvider.js`
7. `src/features/architect/utils/hardCapUtils.js`
8. `src/features/architect/utils/tradeMachine/engine/tradeValidator.js`
9. `src/features/architect/tradeMachine/utils/getOfficialSalaryMatchingSnapshot.js`
10. `src/features/architect/tradeMachine/CapImpactTiles.jsx`
11. `src/features/architect/tradeMachine/TradeSummaryPanel.jsx`
12. `src/features/architect/utils/tradeMachine/constants/cbaConstants.js`

---

## Evidence Entries (FAIL/HIGH only)

### Evidence #1: No Clamp in salaryMatchingRules.js

**File:** `salaryMatchingRules.js:L255-L270`

```javascript
case 'FIRST_APRON': {
  return {
    ruleKey: SALARY_MATCHING_RULE_KEYS.FIRST_APRON,
    ruleLabel: SALARY_MATCHING_RULE_LABELS[SALARY_MATCHING_RULE_KEYS.FIRST_APRON],
    allowableIncoming: outgoing,  // ← 100% matching, NO CLAMP
    formulaUsed: `100% matching: allowableIncoming = outgoing`,
  };
}
```

### Evidence #2: Separate Hard-Cap Check in hardCapValidation.js

**File:** `hardCapValidation.js:L121-L131`

```javascript
else if (isHardCappedFirstApron) {
  hardCapType = 'FirstApron';
  if (projectedSalary > actualFirstApron) {
    violations.push(
      `1st Apron hard cap violation: Trade would exceed first apron hard-cap by ${formatCurrency(projectedSalary - actualFirstApron)}`
    );
  }
}
```

### Evidence #3: UI Displays Unclamped Value

**File:** `getOfficialSalaryMatchingSnapshot.js:L68`

```javascript
// LIMIT: teamResult.rules.salaryMatching.allowableIncoming
allowableIncoming: salaryMatching?.allowableIncoming ?? null,
```

---

## Trace: UI → Compute → Validate

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER INTERFACE                            │
├─────────────────────────────────────────────────────────────────┤
│  TradeSummaryPanel.jsx                                           │
│    └─ getOfficialSalaryMatchingSnapshot(teamResult)              │
│         └─ allowableIncoming (from salaryMatching rule)          │
│                                                                  │
│  CapImpactTiles.jsx                                              │
│    └─ isHardCappedAtFirstApron() → Lock icon                     │
│    └─ projectedSalary from snapshot                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        COMPUTE LAYER                             │
├─────────────────────────────────────────────────────────────────┤
│  validateSalaryMatching()                                        │
│    └─ getSalaryMatchingResult()                                  │
│         └─ Returns: allowableIncoming = outgoing (for apron)     │
│                                                                  │
│  tradeValidator.js:L564                                          │
│    └─ projectedSalary = teamTotalSalary - salaryOut + salaryIn   │
│                                                                  │
│  ❌ MISSING: min(allowableIncoming, apronRoom)                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       VALIDATE LAYER                             │
├─────────────────────────────────────────────────────────────────┤
│  validateHardCap()                                               │
│    └─ if (projectedSalary > firstApron) → violation              │
│                                                                  │
│  Result: Trade fails, but UI showed "$5M allowable"              │
└─────────────────────────────────────────────────────────────────┘
```

---

## Deliverables

1. ✅ **Workbook Updated:** `docs/architect/audits/TM_AUDIT_WORKBOOK.md` (Section 4 - 100%)
2. ✅ **Section Doc:** `docs/architect/audits/TM_SEC_A2_HARD_CAPS_APRONS.md`
3. ✅ **Return Package:** This file

---

## Recommendations (for future phases)

| Priority | Action                                           | Location                                                              |
| -------- | ------------------------------------------------ | --------------------------------------------------------------------- |
| HIGH     | Add `min(salaryMatchCeiling, hardCapRoom)` clamp | `validateSalaryMatching.js` or `getOfficialSalaryMatchingSnapshot.js` |
| MED      | Add `hardCapRoom` field to official snapshot     | `getOfficialSalaryMatchingSnapshot.js`                                |
| MED      | Update UI to show "(capped by hard-cap room)"    | `TradeSummaryPanel.jsx`                                               |
| LOW      | Document clamp formula in alignment doc          | `MASTER_TRADE_MACHINE_ALIGNMENT.md`                                   |

---

## Reproduction Script: Lakers Apron Clamp Test

```
1. Open Trade Machine
2. Select Lakers (or team hard-capped at first apron)
3. Note: totalSalary = $177M, firstApron = $178.132M
4. Calculated: apronRoom = $1.132M
5. Lakers SEND: Player worth $5M
6. Observe: "Allowable Incoming: $5M" displayed
7. Lakers RECEIVE: Player worth $5M
8. Result: Trade FAILS hard-cap validation
9. BUG: UI showed $5M, but only $1.132M actually usable
```

---

_TM_SEC_A2 PREFLIGHT audit complete. No tests run. No builds. No refactors._
