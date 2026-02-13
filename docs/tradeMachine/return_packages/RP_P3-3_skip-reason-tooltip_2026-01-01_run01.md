# Return Package: P3-3 Skip Reason Tooltip

**Date**: 2026-01-01  
**Run**: 01

---

## 1) Summary

- Added tooltip on "—" display when allowable incoming is not applicable (e.g., hard cap, TPE absorption)
- Added "(N/A)" tag next to "—" when a skip reason exists from the validator snapshot
- Created `formatSkipReasonLabel()` helper to convert internal codes (e.g., `HARD_CAP_SKIP`) to readable labels ("Hard cap skip")
- Tooltip text format: `Not applicable: <readable reason>`
- No changes when allowable incoming is a number, or when "—" has no skip reason

---

## 2) Files Changed

| File Path | Purpose | Description |
|-----------|---------|-------------|
| `src/features/architect/tradeMachine/TradeTeamCard.jsx` | UI component | Added `formatSkipReasonLabel` helper and tooltip/N/A tag on allowable incoming display |

---

## 3) Exact Implementation Notes

### Where the tooltip was added

- **Component section**: Allowable Incoming display block (lines 593-611)
- The `<span>` wrapping "—" now includes a `title` attribute when `salaryMatchingSkipReason` exists
- A separate "(N/A)" `<span>` appears after the value with a matching tooltip

### Final tooltip string format

```text
Not applicable: <readable reason>
```

Example: `Not applicable: Hard cap skip`

### Internal code → readable label transformation rule

1. If already human-readable (contains spaces, no underscores) → return as-is
2. Otherwise: replace `_` with space → lowercase all → title-case first letter
   - `HARD_CAP_SKIP` → `Hard cap skip`
   - `TPE_ABSORPTION` → `Tpe absorption`

---

## 4) Code Excerpt

### formatSkipReasonLabel helper (lines 28-48)

```jsx
/**
 * P3-3: Convert internal skip reason codes to human-readable labels.
 * Example: "HARD_CAP_SKIP" → "Hard cap skip", "TPE_ABSORPTION" → "TPE absorption"
 * If already readable (no underscores, already has spaces), returns as-is.
 */
function formatSkipReasonLabel(skipReason) {
  if (!skipReason || typeof skipReason !== 'string') return null;
  
  // If already looks human-readable (contains spaces, no underscores), return as-is
  if (skipReason.includes(' ') && !skipReason.includes('_')) {
    return skipReason;
  }
  
  // Replace underscores with spaces, lowercase, then title-case first letter
  const formatted = skipReason
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/^\w/, (c) => c.toUpperCase());
  
  return formatted;
}
```

### Allowable Incoming display with tooltip (lines 590-611)

```jsx
                ) : (
                  allowableIncomingNoTPE != null
                    ? formatSalary(allowableIncomingNoTPE)
                    : (
                      /* P3-3: Add tooltip explaining why salary matching is not applicable */
                      <span
                        title={salaryMatchingSkipReason ? `Not applicable: ${formatSkipReasonLabel(salaryMatchingSkipReason)}` : undefined}
                      >
                        —
                      </span>
                    )
                )}
              </span>
              {/* P3-3: Show (N/A) tag when salary matching not applicable and skip reason exists */}
              {!isValidating && allowableIncomingNoTPE == null && salaryMatchingSkipReason && (
                <span
                  className="ml-1 text-white/40 text-[10px]"
                  title={`Not applicable: ${formatSkipReasonLabel(salaryMatchingSkipReason)}`}
                >
                  (N/A)
                </span>
              )}
```

---

## 5) Validation Output

### tests/trade/ (27 files, 130 tests)

```text
 ✓ src/tests/trade/tradeSnapshotWiring.test.js (25)
 ✓ tests/trade/validation_caching.test.js (6) 1024ms
 ✓ src/tests/trade/goldenTrades.test.js (11) 904ms
 ✓ tests/trade/signAndTrade_completeness.test.js (6) 643ms
 ✓ tests/trade/faExceptions_as_trade_buckets.test.js (8)
 ✓ tests/trade/tpe_creation_expiry_usage.test.js (4)
 ✓ tests/trade/consent_and_reacq.test.js (6) 929ms
 ✓ tests/trade/input_validation.test.js (8)
 ✓ tests/trade/jan15_offseason_timing.test.js (5)
 ✓ tests/trade/tradeKicker_zeroGuarantee.test.js (4)
 ✓ tests/trade/timingGates_softEnforcement.test.js (4)
 ✓ tests/trade/frozenPick_consequences.test.js (4) 435ms
 ✓ tests/trade/orderOfOps_conversionsBeforeMatching.test.js (2)
 ✓ tests/trade/secondApron_tpeBan.test.js (3) 551ms
 ✓ tests/trade/secondApron_handcuffs.test.js (4)
 ✓ tests/trade/tradeKicker_proration.test.js (4)
 ✓ tests/trade/poisonPill_average.test.js (3)
 ✓ tests/trade/consent_and_birdVeto.test.js (3) 402ms
 ✓ tests/trade/salaryMatching.test.js (4)
 ✓ tests/trade/reacquisition_bar.test.js (2)
 ✓ tests/trade/rosterWindow_softEnforcement.test.js (3)
 ✓ tests/trade/matchingBands_2023.test.js (3)
 ✓ tests/trade/hardCap_trigger_faException.test.js (1)
 ✓ tests/trade/roster_twoWay_enforcement.test.js (2)
 ✓ tests/trade/byc_outgoing_max.test.js (2)
 ✓ tests/trade/firstApron_100pct.test.js (2)
 ✓ tests/trade/cashLedger_season_tracking.test.js (1)

 Test Files  27 passed (27)
      Tests  130 passed (130)
   Duration  106.15s
```

### tradeSnapshotWiring.test.js (25 tests)

```text
 ✓ src/tests/trade/tradeSnapshotWiring.test.js (25)
   ✓ Trade Snapshot Wiring Tests (25)
     ✓ Core Wiring: teamResults is source of truth (5)
     ✓ Base vs Matching Salary Distinction (1)
     ✓ NULL Handling for Non-Applicable Scenarios (1)
     ✓ Formatting Helpers Preserve Numeric Source (2)
     ✓ Global Trade Snapshot (2)
     ✓ Edge Cases (3)
     ✓ P0-1: Multi-Surface Consistency (4)
     ✓ P0-2: Canonical Source Enforcement (5)
     ✓ P0-3: No Local Recalculation After Validation (2)

 Test Files  1 passed (1)
      Tests  25 passed (25)
   Duration  18.96s
```

### Build

```text
vite v4.5.14 building for production...
✓ 2913 modules transformed.
dist/index.html                            0.60 kB │ gzip:   0.37 kB
dist/assets/index-3a2b8de2.css            71.38 kB │ gzip:  12.61 kB
dist/assets/index.esm-6eb0379d.js          3.62 kB │ gzip:   1.56 kB
dist/assets/tradeManager-2ff92854.js       5.24 kB │ gzip:   2.05 kB
dist/assets/seasonManager-65db2338.js      7.89 kB │ gzip:   2.93 kB
dist/assets/index-5974e0dd.js          1,812.34 kB │ gzip: 532.15 kB
✓ built in 1m 17s
Exit code: 0
```

---

## 6) No-Scope Confirmation

**No validator logic or salary matching math was modified.** This change is strictly a UX tooltip enhancement in `TradeTeamCard.jsx`. The `salaryMatchingSkipReason` field already exists in the snapshot accessor (`useTradeMachineSnapshot.js`) and was not changed.
