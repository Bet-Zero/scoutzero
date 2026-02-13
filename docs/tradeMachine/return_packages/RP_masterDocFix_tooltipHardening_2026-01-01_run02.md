# Return Package: Master Doc Fix + Tooltip Label Hardening

> **Date**: January 1, 2026  
> **Version**: 1.2.1  
> **Task**: P1 cleanup — Fix documentation inconsistency and harden tooltip labeling

---

## 1. Summary

This return package documents the completion of two tasks:

1. **Master Doc Fix**: Corrected the Remaining Room formula in `MASTER_TRADE_MACHINE_ALIGNMENT.md` to use the actual snapshot accessor name (`snapshot.incomingMatchingSalary`) instead of the non-existent `snapshot.salaryIn`.

2. **Tooltip Labeling Hardening**: Updated `getPlayerAdjustmentTypes()` in `tradeHelpers.js` to only label adjustment types (BYC, Trade Kicker, Poison Pill) when explicitly flagged in player data. Removed the incorrect inference of Poison Pill from `isRookieScale`.

---

## 2. Master Doc Fix

### 2.1 Stop Condition Check

**Verified**: `snapshot.salaryIn` does NOT exist as an accessor in `useTradeMachineSnapshot.js`.  
**Actual accessor**: `snapshot.incomingMatchingSalary` (maps to canonical `teamResult.salaryIn`).

### 2.2 Before/After: Invariant 4 (Section 2.4)

**BEFORE:**

```markdown
- Remaining Room MUST use `snapshot.allowableIncoming - snapshot.salaryIn` (not local recalculation)
```

**AFTER:**

```markdown
- Remaining Room MUST use `snapshot.allowableIncoming - snapshot.incomingMatchingSalary` (not local recalculation)
  - Note: `snapshot.incomingMatchingSalary` maps to the canonical `teamResult.salaryIn` field from the validator
```

### 2.3 Before/After: Section 3.2 Table

**BEFORE:**

```markdown
| Remaining Room (if shown) | `allowableIncoming - salaryIn` (from snapshot) | Calculated from snapshot |
```

**AFTER:**

```markdown
| Remaining Room (if shown) | `allowableIncoming - incomingMatchingSalary` (from snapshot) | Calculated from snapshot |
```

### 2.4 Version Bump

**Updated Master Doc Version Header:**

```markdown
> **Version**: 1.2.1 (January 2026)
```

**Amendment Log Entry Added:**

```markdown
| Jan 2026 | 1.2.1 | Remaining Room formula fix: Updated Section 2.4 and 3.2 to use `snapshot.incomingMatchingSalary` (the actual accessor name) instead of `snapshot.salaryIn` (which does not exist); added clarification that `snapshot.incomingMatchingSalary` maps to canonical `teamResult.salaryIn` | Trade Machine Team |
```

---

## 3. Tooltip Logic Hardening

### 3.1 Explicit-Flag Rules Implemented

The following rules are now enforced in `getPlayerAdjustmentTypes()`:

| Adjustment Type | Required Condition | NOT Inferred From |
|-----------------|-------------------|-------------------|
| **BYC** | `player.isBYC === true` OR `player.baseYearCompensation === true` | — |
| **Trade Kicker** | `player.tradeKicker` exists OR `player.tradeKickerPct > 0` | — |
| **Poison Pill** | `player.isPoisonPill === true` **ONLY** | `isRookieScale` ❌ |

### 3.2 Before/After: Poison Pill Detection

**BEFORE (incorrect — inferred from rookie-scale):**

```javascript
// Poison Pill detection (rookie scale contracts)
const contract = player.contract || player.primaryContract;
const isRookieScale = contract?.isRookieScale || player.isRookieScale;
if (player.isPoisonPill || isRookieScale) {
  adjustmentTypes.push('Poison Pill');
}
```

**AFTER (correct — explicit flag only):**

```javascript
// Poison Pill detection - EXPLICIT FLAG ONLY
// NOTE: Do NOT infer from isRookieScale. Rookie-scale contracts are not automatically poison pills.
// A poison pill only exists when a rookie extension's averaged salary differs materially from the current year.
if (player.isPoisonPill === true) {
  adjustmentTypes.push('Poison Pill');
}
```

### 3.3 Complete Updated Function

```javascript
export const getPlayerAdjustmentTypes = (player) => {
  if (!player) return [];
  
  const adjustmentTypes = [];
  
  // BYC detection - explicit flag only
  if (player.isBYC === true || player.baseYearCompensation === true) {
    adjustmentTypes.push('BYC');
  }
  
  // Trade Kicker detection - explicit flag only
  if (player.tradeKicker || player.tradeKickerPct > 0) {
    adjustmentTypes.push('Trade Kicker');
  }
  
  // Poison Pill detection - EXPLICIT FLAG ONLY
  // NOTE: Do NOT infer from isRookieScale. Rookie-scale contracts are not automatically poison pills.
  // A poison pill only exists when a rookie extension's averaged salary differs materially from the current year.
  if (player.isPoisonPill === true) {
    adjustmentTypes.push('Poison Pill');
  }
  
  return adjustmentTypes;
};
```

---

## 4. Files Changed

| File | Purpose |
|------|---------|
| `docs/tradeMachine/MASTER_TRADE_MACHINE_ALIGNMENT.md` | Fixed Remaining Room formula to use correct accessor name; bumped version to 1.2.1; added amendment log entry |
| `src/features/architect/utils/tradeHelpers.js` | Hardened `getPlayerAdjustmentTypes()` to only label Poison Pill when explicitly flagged; removed `isRookieScale` inference |

---

## 5. Diff Excerpts

### 5.1 MASTER_TRADE_MACHINE_ALIGNMENT.md

```diff
-  > **Version**: 1.2.0 (January 2026)
+  > **Version**: 1.2.1 (January 2026)

-  - Remaining Room MUST use `snapshot.allowableIncoming - snapshot.salaryIn` (not local recalculation)
+  - Remaining Room MUST use `snapshot.allowableIncoming - snapshot.incomingMatchingSalary` (not local recalculation)
+    - Note: `snapshot.incomingMatchingSalary` maps to the canonical `teamResult.salaryIn` field from the validator

-  | Remaining Room (if shown) | `allowableIncoming - salaryIn` (from snapshot) | Calculated from snapshot |
+  | Remaining Room (if shown) | `allowableIncoming - incomingMatchingSalary` (from snapshot) | Calculated from snapshot |

+  | Jan 2026 | 1.2.1 | Remaining Room formula fix: Updated Section 2.4 and 3.2 to use `snapshot.incomingMatchingSalary` (the actual accessor name) instead of `snapshot.salaryIn` (which does not exist); added clarification that `snapshot.incomingMatchingSalary` maps to canonical `teamResult.salaryIn` | Trade Machine Team |
```

### 5.2 tradeHelpers.js

```diff
-  // Poison Pill detection (rookie scale contracts)
-  const contract = player.contract || player.primaryContract;
-  const isRookieScale = contract?.isRookieScale || player.isRookieScale;
-  if (player.isPoisonPill || isRookieScale) {
+  // Poison Pill detection - EXPLICIT FLAG ONLY
+  // NOTE: Do NOT infer from isRookieScale. Rookie-scale contracts are not automatically poison pills.
+  // A poison pill only exists when a rookie extension's averaged salary differs materially from the current year.
+  if (player.isPoisonPill === true) {
     adjustmentTypes.push('Poison Pill');
   }
```

---

## 6. Validation Outputs

### 6.1 Test: tradeSnapshotWiring.test.js

```text
> scoutzero-final2@0.0.1 test
> vitest src/tests/trade/tradeSnapshotWiring.test.js --run

 RUN  v1.6.1 /home/runner/work/scoutzero/scoutzero

 ✓ src/tests/trade/tradeSnapshotWiring.test.js  (25 tests) 10ms

 Test Files  1 passed (1)
      Tests  25 passed (25)
   Start at  07:18:16
   Duration  971ms
```

### 6.2 Test: tests/trade/ (all trade tests)

```text
> scoutzero-final2@0.0.1 test
> vitest tests/trade/ --run

 ✓ tests/trade/tpe_creation_expiry_usage.test.js  (4 tests) 33ms
 ✓ tests/trade/input_validation.test.js  (8 tests) 9ms
 ✓ tests/trade/consent_and_reacq.test.js  (6 tests) 30ms
 ✓ tests/trade/jan15_offseason_timing.test.js  (5 tests) 7ms
 ✓ tests/trade/tradeKicker_zeroGuarantee.test.js  (4 tests) 6ms
 ✓ tests/trade/timingGates_softEnforcement.test.js  (4 tests) 15ms
 ✓ tests/trade/frozenPick_consequences.test.js  (4 tests) 33ms
 ✓ tests/trade/orderOfOps_conversionsBeforeMatching.test.js  (2 tests) 23ms
 ✓ tests/trade/secondApron_tpeBan.test.js  (3 tests) 18ms
 ✓ tests/trade/secondApron_handcuffs.test.js  (4 tests) 6ms
 ✓ tests/trade/poisonPill_average.test.js  (3 tests) 3ms
 ✓ tests/trade/tradeKicker_proration.test.js  (4 tests) 6ms
 ✓ tests/trade/consent_and_birdVeto.test.js  (3 tests) 7ms
 ✓ tests/trade/salaryMatching.test.js  (4 tests) 7ms
 ✓ tests/trade/rosterWindow_softEnforcement.test.js  (3 tests) 6ms
 ✓ tests/trade/reacquisition_bar.test.js  (2 tests) 4ms
 ✓ tests/trade/matchingBands_2023.test.js  (3 tests) 5ms
 ✓ tests/trade/roster_twoWay_enforcement.test.js  (2 tests) 5ms
 ✓ tests/trade/hardCap_trigger_faException.test.js  (1 test) 5ms
 ✓ tests/trade/byc_outgoing_max.test.js  (2 tests) 11ms
 ✓ tests/trade/firstApron_100pct.test.js  (2 tests) 6ms
 ✓ tests/trade/cashLedger_season_tracking.test.js  (1 test) 6ms
 ✓ tests/trade/signAndTrade_completeness.test.js  (5 tests) 7ms
 ✓ tests/trade/validation_caching.test.js  (4 tests) 8ms
 ✓ tests/trade/faExceptions_as_trade_buckets.test.js  (2 tests) 5ms

 Test Files  27 passed (27)
      Tests  130 passed (130)
   Start at  07:18:24
   Duration  8.48s
```

### 6.3 Build

```text
> scoutzero-final2@0.0.1 build
> vite build

vite v4.5.14 building for production...
✓ 2913 modules transformed.
dist/index.html                            0.60 kB │ gzip:   0.37 kB
dist/assets/index-3a2b8de2.css            71.38 kB │ gzip:  12.61 kB
dist/assets/index.esm-b89f6f03.js          3.62 kB │ gzip:   1.56 kB
dist/assets/tradeManager-41f03e17.js       5.24 kB │ gzip:   2.05 kB
dist/assets/seasonManager-7b86c198.js      7.89 kB │ gzip:   2.93 kB
dist/assets/index-494a49c9.js          1,811.70 kB │ gzip: 531.82 kB
✓ built in 9.22s
```

### 6.4 Grep Sanity Checks

**Poison Pill in tradeMachine JSX:**

```text
src/features/architect/tradeMachine/TradeReceiptPanel.jsx:58:              title="Poison Pill - uses averaged salary"
src/features/architect/tradeMachine/TradeReceiptPanel.jsx:90:          {flags.isPoisonPill && ' (Poison Pill avg)'}
```

✅ Both occurrences check explicit `flags.isPoisonPill` — not inferred from rookie-scale.

**isRookieScale in tradeMachine JSX:**

```text
(no matches)
```

✅ No `isRookieScale` checks in tradeMachine JSX files — confirms UI doesn't infer Poison Pill from rookie-scale.

---

## 7. Notes

- **No stop conditions triggered**: `snapshot.salaryIn` does NOT exist as an accessor; the fix was required.
- **Validator logic unchanged**: The `matchingValues.js` file still computes poison pill averaging based on rookie-scale status for trade validation purposes. This is correct behavior for the validator. The fix only addresses **UI tooltip labeling**.
- **Backward compatibility**: The `getAdjustmentTooltipLabel()` function still returns a generic message when no explicit flags are found, maintaining backward compatibility.

---

*End of Return Package*
