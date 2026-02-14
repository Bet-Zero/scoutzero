# TM_FIX_A2_E1 Return Package

**Task:** Hard-Cap Incoming Ceiling + Effective Allowable Incoming
**Mode:** EXECUTION
**Status:** ✅ COMPLETE
**Date:** 2026-02-14

---

## Summary

Implemented the hard-cap incoming ceiling computation and effective allowable incoming display. This fix eliminates the "allowable incoming can exceed hard-cap room" lie by ensuring:

1. When a team is hard-capped, `effectiveAllowableIncoming = min(salaryMatchCeiling, hardCapIncomingCeiling)`
2. UI displays the effective allowable with a breakdown showing both ceilings when hard-capped
3. Clear indication of which ceiling is the limiter

---

## Implementation Details

### Formula

```
hardCapIncomingCeiling = outgoingSalary + max(0, hardCapApron - teamTotalSalary)
effectiveAllowableIncoming = min(salaryMatchCeiling, hardCapIncomingCeiling)
```

The hard-cap incoming ceiling represents the maximum salary a hard-capped team can receive without their post-trade salary exceeding their hard cap.

### Files Changed

| File                                                                             | Change                                                                                                            |
| -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `src/features/architect/utils/tradeMachine/rules/validateSalaryMatching.js`      | Added hard-cap ceiling computation (L403-L470)                                                                    |
| `src/features/architect/tradeMachine/utils/getOfficialSalaryMatchingSnapshot.js` | Added new fields: `hardCapIncomingCeiling`, `effectiveAllowableIncoming`, `hardCapCeilingDetails`, `isHardCapped` |
| `src/features/architect/tradeMachine/TradeSummaryPanel.jsx`                      | Updated UI to show effective allowable + ceiling breakdown when hard-capped                                       |
| `src/tests/trade/hardCap_salaryMatching.guardrail.test.js`                       | Added 6 new regression tests for TM_FIX_A2_E1                                                                     |
| `src/tests/trade/tradeMultiSurfaceOfficialValues.test.js`                        | Updated expected shape to include new fields                                                                      |
| `docs/architect/audits/TM_AUDIT_WORKBOOK.md`                                     | Updated Section 4 from FAIL/HIGH to PASS/LOW                                                                      |

---

## New Data Fields

### validateSalaryMatching() Result

```javascript
{
  // Existing fields...
  allowableIncoming: number,           // Salary match ceiling (CBA rule)

  // TM_FIX_A2_E1 additions:
  hardCapIncomingCeiling: number|null, // Hard cap ceiling (when hard-capped)
  effectiveAllowableIncoming: number,  // min(allowable, hardCapCeiling)

  details: {
    // ...existing...
    hardCapCeiling: {                  // Only present when hard-capped
      ceiling: number,
      apron: number,
      apronLabel: '1st Apron' | '2nd Apron',
      limiter: 'hardCap' | 'salaryMatching'
    }
  }
}
```

### getOfficialSalaryMatchingSnapshot() Result

```javascript
{
  // Existing fields...
  allowableIncoming: number|null,

  // TM_FIX_A2_E1 additions:
  hardCapIncomingCeiling: number|null,
  effectiveAllowableIncoming: number|null,
  hardCapCeilingDetails: Object|null,
  isHardCapped: boolean
}
```

---

## UI Display

### Hard-Capped Team View

When a team is hard-capped, TradeSummaryPanel now shows:

```
Matching In / Allowed: $12,000,000 / $11,000,000 — Over by $1,000,000
  Salary Match Ceiling:            $17,500,000
  Hard Cap Ceiling (1st Apron):    $11,000,000 ←
```

The `←` indicator shows which ceiling is the limiter.

### Non-Hard-Capped Team View

No change - displays as before:

```
Matching In / Allowed: $15,000,000 / $17,500,000
```

---

## Test Coverage

Added 6 new regression tests in `hardCap_salaryMatching.guardrail.test.js`:

| Test                                                                             | Description                   |
| -------------------------------------------------------------------------------- | ----------------------------- |
| `hard-capped team gets hardCapIncomingCeiling computed`                          | Verifies ceiling formula      |
| `effectiveAllowableIncoming is min of salary match ceiling and hard cap ceiling` | Verifies min() logic          |
| `when salary match ceiling is lower, it is the limiter`                          | Verifies salary matching case |
| `when hard cap ceiling is lower, it is the limiter`                              | Verifies hard cap case        |
| `non-hard-capped team has null hardCapIncomingCeiling`                           | Verifies null behavior        |
| `hardCapCeiling details include apron label`                                     | Verifies metadata             |

All tests pass: `npm run test -- --run src/tests/trade/hardCap_salaryMatching.guardrail.test.js`

---

## Workbook Update

Section 4 of `docs/architect/audits/TM_AUDIT_WORKBOOK.md` updated:

| Item                                                              | Before      | After       |
| ----------------------------------------------------------------- | ----------- | ----------- |
| `allowableIncoming = min(salaryMatchCeiling, apronRoomRemaining)` | **NO**/HIGH | **YES**/LOW |
| UI shows room-based messaging                                     | PARTIAL/MED | **YES**/LOW |

Evidence block updated with implementation details and file references.

---

## Validation

- [x] Build passes: `npm run build`
- [x] All 14 tests pass in `hardCap_salaryMatching.guardrail.test.js`
- [x] All 28 tests pass in `tradeMultiSurfaceOfficialValues.test.js`
- [x] Workbook Section 4 updated to PASS

---

## Manual Test Scenario (for UI verification)

1. Create a hard-capped team scenario:
   - Team total salary: $175M (3M below 1st apron at $178M)
   - Hard-capped at 1st apron (e.g., mid-level exception usage)
   - Send out: $10M player
   - Try to receive: $15M player

2. Expected UI behavior:
   - Shows "Matching In / Allowed: $15M / $13M"
   - Ceiling breakdown appears:
     - "Salary Match Ceiling: $17.5M"
     - "Hard Cap Ceiling (1st Apron): $13M ←"
   - Trade fails validation (incoming exceeds effective limit)

---

## Dependencies

None - this is a self-contained fix.

---

## Future Considerations

- Consider adding visual cue (warning icon) when hard cap is the limiter
- Consider adding tooltip explaining the ceiling calculation formula
