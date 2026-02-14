# TM_SEC_A2 — Hard Caps / Aprons Section Audit

**Audit Date:** 2026-02-14  
**Mode:** PREFLIGHT (Discovery-only)  
**Auditor:** Claude Opus 4.5  
**Section:** 4 (Hard Caps + Aprons)  
**Workbook:** `docs/architect/audits/TM_AUDIT_WORKBOOK.md`

---

## Executive Summary

| Question                                                      | Answer          | Risk     |
| ------------------------------------------------------------- | --------------- | -------- |
| Does legality enforce hard-cap apron compliance?              | **YES**         | LOW      |
| Is allowable incoming clamped by apron room when hard-capped? | **NO**          | **HIGH** |
| Does UI display use the same computed values as validation?   | YES (unclamped) | MED      |

---

## How It Works Today (UI → Compute → Validate)

### 1. Hard-Cap Status Determination

```
UI Layer (CapImpactTiles.jsx)
  └─ isHardCappedAtFirstApron(team, yearKey)       → hardCapUtils.js:L84
  └─ isHardCappedAtSecondApron(team)               → hardCapUtils.js:L139
  └─ getFirstApronHardCapReason(team)              → hardCapUtils.js:L144
```

**Trigger Sources Checked:**

- `team.hardCapFirstApron?.active`
- `team.faExceptionBuckets` (MLE/BAE usage)
- `team.mle.used > 0` or `team.bae.used > 0`
- `team.hardCapped === 1`
- `team.hardCapTriggered === 'FirstApron'`

### 2. Post-Trade Salary Computation

```
tradeValidator.js:L564
  projectedSalary = teamTotalSalary - salaryOut + salaryIn
```

**Single Source**: `projectedSalary` is computed once and passed to both validators.

### 3. Allowable Incoming Computation

```
validateSalaryMatching.js
  └─ getSalaryMatchingResult({teamTotalSalary, outgoingSalary, capSettings})
     └─ salaryMatchingRules.js:L186-L280
        - SECOND_APRON → 100% matching (outgoing)
        - FIRST_APRON  → 100% matching (outgoing)
        - OVER_CAP     → Band 1/2/3 formula
        - UNDER_CAP    → outgoing + cap room
```

**Output**: `allowableIncoming` from band-based calculation.

### 4. Hard-Cap Validation

```
hardCapValidation.js:validateHardCap()
  if (isHardCappedSecondApron && projectedSalary > secondApron)
    → violation: "Trade would exceed second apron hard-cap by $X"
  if (isHardCappedFirstApron && projectedSalary > firstApron)
    → violation: "Trade would exceed first apron hard-cap by $X"
```

### 5. UI Display

```
TradeSummaryPanel.jsx
  └─ getOfficialSalaryMatchingSnapshot(teamResult)
     └─ teamResult.rules.salaryMatching.allowableIncoming
```

**Issue**: UI displays `allowableIncoming` from salaryMatching, which is NOT clamped by hard-cap room.

---

## Mismatch List (UI vs Validator)

| Display             | UI Source                    | Validator Source                   | Match?     |
| ------------------- | ---------------------------- | ---------------------------------- | ---------- |
| Allowable Incoming  | `snapshot.allowableIncoming` | `salaryMatching.allowableIncoming` | ✅ YES     |
| Post-Trade Salary   | `snapshot.projectedSalary`   | `teamResult.projectedSalary`       | ✅ YES     |
| Hard-Cap Room       | NOT DISPLAYED                | `firstApron - projectedSalary`     | ❌ N/A     |
| Effective Allowable | NOT COMPUTED                 | NOT COMPUTED                       | ❌ **GAP** |

**Critical Mismatch:**  
`allowableIncoming` shown in UI may exceed hard-cap room, but no clamping or warning exists.

---

## Detailed Finding: Missing Apron Room Clamp

### Expected Behavior (per Master Checklist)

```

allowableIncoming = min(salaryMatchCeiling, apronRoomRemaining)
```

### Actual Behavior

```
// validateSalaryMatching.js
allowableIncoming = getSalaryMatchingResult(...).allowableIncoming   // Band-based

// hardCapValidation.js (separate)
if (projectedSalary > firstApron) violation.push(...)                 // After-the-fact check
```

**No min() clamping exists.**

### Files Searched (12 total)

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

### Code Evidence

**salaryMatchingRules.js:L255-L270** (First Apron case):

```javascript
case 'FIRST_APRON': {
  return {

    ruleKey: SALARY_MATCHING_RULE_KEYS.FIRST_APRON,
    allowableIncoming: outgoing,  // ← 100% matching, NO CLAMP
    formulaUsed: `100% matching: allowableIncoming = outgoing = ${formatCurrency(outgoing)}`,
  };

}
```

**hardCapValidation.js:L121-L131** (First Apron validation):

```javascript
else if (isHardCappedFirstApron) {
  hardCapType = 'FirstApron';
  if (projectedSalary > actualFirstApron) {  // ← Separate check
    violations.push(
      `1st Apron hard cap violation: Trade would exceed first apron hard-cap by ${formatCurrency(projectedSalary - actualFirstApron)}`
    );
  }
}
```

---

## Lakers Apron Clamp Reproduction Script

### Manual Test Steps

1. **Setup**: Navigate to Trade Machine, select Lakers (or any hard-capped team at first apron)
2. **Verify Pre-Conditions**:
   - Note team's `totalSalary` vs `firstApron` threshold
   - Calculate `apronRoom = firstApron - totalSalary`
   - Confirm team shows Lock icon (hard-capped)

3. **Create Trade**:
   - Lakers send: $5M player
   - Lakers receive: $5M player (100% matching)
   - Expected `allowableIncoming`: $5M

4. **Observe**:
   - Check TradeSummaryPanel shows "Allowable Incoming: $5M"
   - If `apronRoom < $5M`, trade should fail hard-cap validation
   - **BUG**: UI shows $5M allowable, but only `$apronRoom` can actually be used

5. **Expected Fix**:
   - UI should show: "Allowable Incoming: $X (limited by hard-cap room)"
   - Or: `min($5M, $apronRoom)`

### Example Values

| Team   | Total Salary | First Apron | Apron Room | Outgoing | Band-Based Allowable | Effective Allowable (should be) |
| ------ | ------------ | ----------- | ---------- | -------- | -------------------- | ------------------------------- |
| Lakers | $177M        | $178.132M   | $1.132M    | $5M      | $5M                  | $1.132M                         |

---

## Risk Assessment

| Finding | Risk | Reason |
| ------- | ---- | ------ |

| Hard-cap status determination | LOW | Multiple trigger sources checked systematically |
| Hard-cap violation detection | LOW | Separate validator catches ceiling breaches |
| **Apron room clamp missing** | **HIGH** | User sees inflated allowable incoming, trade fails unexpectedly |
| UI messaging for hard-cap limit | MED | Says "exceeds by $X" but not "only $X room available" |

---

## Recommendations

1. **Add Apron Room Clamp** (HIGH priority):

   ```javascript
   // In validateSalaryMatching.js or getOfficialSalaryMatchingSnapshot.js
   const hardCapRoom = isHardCapped ? hardCapApron - totalSalary : Infinity;
   const effectiveAllowable = Math.min(bandBasedAllowable, hardCapRoom);
   ```

2. **UI Display Enhancement** (MED priority):
   - When hard-capped, show: "Allowable: $X (capped by hard-cap room)"
   - Add `hardCapRoom` field to official snapshot

3. **Documentation** (LOW priority):
   - Update `MASTER_TRADE_MACHINE_ALIGNMENT.md` to document the clamp formula

---

## Appendix: File References

| File                                   | Function/Component                    | Purpose                             |
| -------------------------------------- | ------------------------------------- | ----------------------------------- |
| `hardCapUtils.js`                      | `isHardCappedAtFirstApron()`          | Status check with multiple triggers |
| `hardCapUtils.js`                      | `getFirstApronHardCapReason()`        | Human-readable reason               |
| `hardCapValidation.js`                 | `validateHardCap()`                   | Ceiling violation detection         |
| `salaryMatchingRules.js`               | `getSalaryMatchingResult()`           | Band-based allowable calculation    |
| `validateSalaryMatching.js`            | `validateSalaryMatching()`            | Matching rule orchestrator          |
| `getOfficialSalaryMatchingSnapshot.js` | `getOfficialSalaryMatchingSnapshot()` | Canonical UI selector               |
| `CapImpactTiles.jsx`                   | Component                             | Hard-cap UI display                 |
| `tradeValidator.js`                    | `validateTrade()`                     | Main orchestrator                   |
| `capSettingsProvider.js`               | `getCapSettings()`                    | Threshold source                    |
| `cbaConstants.js`                      | `CBA_THRESHOLDS`                      | 2024-25 values                      |

---

_Generated by TM_SEC_A2 PREFLIGHT audit_
