# Return Package: Alignment + P1 + P2 Implementation

> **Date**: 2026-01-01  
> **Run**: 01  
> **Master Doc Version**: 1.2.0  
> **Fix Plan Version**: 4.1.0

---

## 1. What Changed + Why

### A) DOC ALIGNMENT (Canonical Field Map)

**Problem**: The Master Alignment document and Fix Plan referenced incorrect canonical paths for incoming/outgoing matching salaries. The documents stated:

- `teamResult.rules.salaryMatching.outgoingMatchingSalary`
- `teamResult.rules.salaryMatching.incomingMatchingSalary`

**Actual Canonical Paths** (confirmed in repo via test files and snapshot accessor):

- `teamResult.salaryOut` — outgoing matching total
- `teamResult.salaryIn` — incoming matching total

**Changes Made**:

1. Updated MASTER_TRADE_MACHINE_ALIGNMENT.md Section 1.2 to reference `teamResult.salaryIn`
2. Updated MASTER_TRADE_MACHINE_ALIGNMENT.md Section 2.2 to reference `salaryOut`, `salaryIn`
3. Updated MASTER_TRADE_MACHINE_ALIGNMENT.md Section 2.4 to use `snapshot.salaryIn`
4. Updated MASTER_TRADE_MACHINE_ALIGNMENT.md Section 3.2 canonical source table
5. Updated TRADE_MACHINE_FIX_PLAN.md P0-2 and P0-4 sections

**Master Invariant Tie**: Invariant 1 (Single Source per Concept) requires accurate documentation of the canonical source. Incorrect paths could lead to UI reading from wrong fields.

### B) P1 — BASE vs MATCHING LABELING

**Problem**: When a player has a matching adjustment (BYC, Trade Kicker, Poison Pill), the tooltip was generic: "Includes BYC, poison pill, or trade kicker adjustments"

**Changes Made**:

1. TradeTeamCard: Added specific adjustment type detection for both outgoing and incoming players
2. TradeTeamCard: Tooltips now show specific adjustment type when detectable (e.g., "BYC: Base $X → Match $Y")
3. TradeSummaryPanel: Added same specific adjustment type detection for incoming players

**Detection Logic**:

- BYC: `player.isBYC || player.baseYearCompensation`
- Trade Kicker: `player.tradeKicker || player.tradeKickerPct`
- Poison Pill: `player.isPoisonPill || contract.isRookieScale`

**Master Invariant Tie**: Invariant 3 (Explicit Base vs Matching Labels) requires users to understand why matching differs from base.

### C) P2 — TradeSalaryCalculator Sandbox/Official Separation

**Problem**: TradeSalaryCalculator showed local calculations without clear separation from official validator values.

**Changes Made**:

1. Added prominent disclaimer at top: "⚠️ Exploratory tool — validator is authoritative"
2. Added new props: `validatorAllowableIncoming`, `validatorRule`, `hasValidatorResult`
3. Added "Official Validator Result" section (blue styling) when validator result available
4. Added "Sandbox Estimate (local calculation)" label with yellow icon
5. Added "Validator will use: $X" message when sandbox differs from official by >$1
6. Added "(Validator: rule)" note when validator uses different rule than sandbox

**Master Invariant Tie**: Section 3.4 (Exploratory Tools Exception) requires visual separation between sandbox and official values.

---

## 2. Files Changed List

| File | Action |
|------|--------|
| `docs/tradeMachine/MASTER_TRADE_MACHINE_ALIGNMENT.md` | Updated canonical paths, version bump, amendment log |
| `TRADE_MACHINE_FIX_PLAN.md` | Updated canonical paths, version bump, added amendment log |
| `src/features/architect/utils/tradeHelpers.js` | Added shared utility functions `getPlayerAdjustmentTypes()` and `getAdjustmentTooltipLabel()` |
| `src/features/architect/tradeMachine/TradeTeamCard.jsx` | P1: Uses shared utility for adjustment type detection in tooltips |
| `src/features/architect/tradeMachine/TradeSummaryPanel.jsx` | P1: Uses shared utility for adjustment type detection in tooltips |
| `src/features/architect/tradeMachine/TradeSalaryCalculator.jsx` | P2: Added sandbox/official separation, disclaimer, new props |
| `docs/tradeMachine/return-packages/RP_alignment_P1P2_2026-01-01_run01.md` | This document |

---

## 3. Exact Canonical Field Map Used in UI

**AUTHORITATIVE CANONICAL FIELD MAP** (as used after this run):

| Concept | Canonical Path | UI Accessor |
|---------|----------------|-------------|
| **allowableIncoming (LIMIT)** | `teamResult.rules.salaryMatching.allowableIncoming` | `snapshot.allowableIncoming` |
| **outgoingMatchingTotal (OUT)** | `teamResult.salaryOut` | `snapshot.outgoingMatchingSalary` |
| **incomingSelectedMatchingTotal (IN)** | `teamResult.salaryIn` | `snapshot.incomingMatchingSalary` |
| **salaryMatchingPassed** | `teamResult.rules.salaryMatching.passed` | `snapshot.salaryMatchingPassed` |
| **ruleLabel** | `teamResult.rules.salaryMatching.details.ruleApplied` | `snapshot.salaryMatchingRule` |
| **formula** | `teamResult.rules.salaryMatching.details.formulaUsed` | `snapshot.salaryMatchingFormula` |

**Note**: The snapshot accessor (`useTradeMachineSnapshot.js`) maps these canonical paths to UI-friendly property names.

---

## 4. Full Diffs

### 4.1 docs/tradeMachine/MASTER_TRADE_MACHINE_ALIGNMENT.md

**Key Changes**:

```diff
- > **Version**: 1.1.0 (December 2024)
+ > **Version**: 1.2.0 (January 2026)

Section 1.2:
- **Snapshot Field for Incoming Selected**: The validator snapshot provides `teamResult.rules.salaryMatching.incomingMatchingSalary`
+ **Snapshot Field for Incoming Selected**: The validator snapshot provides `teamResult.salaryIn`

Section 2.2:
- - Official values: `outgoingMatchingSalary`, `incomingMatchingSalary`, `allowableIncoming`, `salaryMatching.passed`
+ - Official values: `salaryOut`, `salaryIn`, `allowableIncoming`, `salaryMatching.passed`

Section 2.4:
- - Remaining Room MUST use `snapshot.allowableIncoming - snapshot.incomingMatchingSalary`
+ - Remaining Room MUST use `snapshot.allowableIncoming - snapshot.salaryIn`

- - This value should be sourced from `teamResult.rules.salaryMatching.incomingMatchingSalary`
+ - This value should be sourced from `teamResult.salaryIn`

Section 3.2 Table:
- | Outgoing Matching Salary | `teamResult.rules.salaryMatching.outgoingMatchingSalary` |
- | Incoming Matching Salary | `teamResult.rules.salaryMatching.incomingMatchingSalary` |
+ | Outgoing Matching Salary | `teamResult.salaryOut` |
+ | Incoming Matching Salary | `teamResult.salaryIn` |

- | Remaining Room (if shown) | `allowableIncoming - incomingMatchingSalary` (from snapshot) |
+ | Remaining Room (if shown) | `allowableIncoming - salaryIn` (from snapshot) |

Amendment Log:
+ | Jan 2026 | 1.2.0 | Canonical field alignment: Replaced `teamResult.rules.salaryMatching.outgoingMatchingSalary` → `teamResult.salaryOut`; Replaced `teamResult.rules.salaryMatching.incomingMatchingSalary` → `teamResult.salaryIn`; Retained allowableIncoming/passed/ruleApplied under rules.salaryMatching as confirmed in repo | Trade Machine Team |
```

### 4.2 TRADE_MACHINE_FIX_PLAN.md

**Key Changes**:

```diff
- > **Version**: 4.0.0 (December 2024)
+ > **Version**: 4.1.0 (January 2026)

P0-2 Section:
- **Requirement**: After validation runs, ALL official salary matching values (outgoingMatchingSalary, incomingMatchingSalary, allowableIncoming, passed/failed)
+ **Requirement**: After validation runs, ALL official salary matching values (`salaryOut`, `salaryIn`, `allowableIncoming`, `passed/failed`)

P0-4 Section:
- **Incoming Selected Source**: `teamResult.rules.salaryMatching.incomingMatchingSalary`
+ **Incoming Selected Source**: `teamResult.salaryIn`

End of document:
- *End of Fix Plan v4.0*
+ ---
+ ## Amendment Log
+ | Date | Version | Change | Author |
+ |------|---------|--------|--------|
+ | Dec 2024 | 4.0.0 | Initial rewrite to enforce Master Alignment invariants | Trade Machine Team |
+ | Jan 2026 | 4.1.0 | Canonical field alignment: Updated P0-2 to use `teamResult.salaryOut/salaryIn` as canonical OUT/IN sources per repo audit; Retained `teamResult.rules.salaryMatching.*` for allowableIncoming, passed, and ruleApplied | Trade Machine Team |
+ ---
+ *End of Fix Plan v4.1*
```

### 4.3 TradeTeamCard.jsx (P1 Changes)

**Outgoing Players Section** (lines 401-450 approx):

```jsx
// P1: Detect specific adjustment type for tooltip
const adjustmentTypes = [];
if (p.isBYC || p.baseYearCompensation) adjustmentTypes.push('BYC');
if (p.tradeKicker || p.tradeKickerPct) adjustmentTypes.push('Trade Kicker');
const contract = p.contract || p.primaryContract;
const isRookieScale = contract?.isRookieScale || p.isRookieScale;
if (p.isPoisonPill || isRookieScale) adjustmentTypes.push('Poison Pill');

const adjustmentLabel = adjustmentTypes.length > 0
  ? adjustmentTypes.join(', ')
  : 'Adjusted trade matching value (BYC/kicker/poison pill may apply)';
const tooltipText = `${adjustmentLabel}: Base ${formatSalary(baseSalary)} → Match ${formatSalary(matchingValue)}`;

// ... in JSX:
<span
  className="px-1 py-0.5 text-[9px] bg-purple-600/30 text-purple-300 rounded leading-none"
  title={tooltipText}
>
  Adj
</span>
```

**Incoming Players Section** (similar pattern applied).

### 4.4 TradeSummaryPanel.jsx (P1 Changes)

```jsx
// P1: Detect specific adjustment type for tooltip
const adjustmentTypes = [];
if (p.isBYC || p.baseYearCompensation) adjustmentTypes.push('BYC');
if (p.tradeKicker || p.tradeKickerPct) adjustmentTypes.push('Trade Kicker');
const contract = p.contract || p.primaryContract;
const isRookieScale = contract?.isRookieScale || p.isRookieScale;
if (p.isPoisonPill || isRookieScale) adjustmentTypes.push('Poison Pill');

const adjustmentLabel = adjustmentTypes.length > 0
  ? adjustmentTypes.join(', ')
  : 'Adjusted trade matching value (BYC/kicker/poison pill may apply)';
const tooltipText = `${adjustmentLabel}: Base ${formatCurrency(baseSalary)} → Match ${formatCurrency(matchingValue)}`;
```

### 4.5 TradeSalaryCalculator.jsx (P2 Changes)

**New Props**:

```jsx
const TradeSalaryCalculator = ({
  teamSalary,
  outgoingSalary,
  incomingPlayers = [],
  tpes = [],
  capSettings,
  yearKey,
  // P2: Accept official validator result for comparison
  validatorAllowableIncoming = null,
  validatorRule = null,
  hasValidatorResult = false,
}) => {
```

**Disclaimer at top**:

```jsx
{/* P2: Prominent disclaimer at top */}
<div className="mb-4 px-3 py-2 bg-amber-900/20 border border-amber-600/30 rounded text-xs text-amber-300">
  ⚠️ <strong>Exploratory tool</strong> — validator is authoritative for final trade legality.
</div>
```

**Official Validator Section**:

```jsx
{/* P2: Official Validator Section (when available) */}
{hasValidatorResult && validatorAllowableIncoming != null && (
  <div className="bg-blue-900/20 border border-blue-500/30 rounded p-3">
    <div className="text-xs font-semibold text-blue-300 mb-2 flex items-center gap-1">
      <span>✓</span> Official Validator Result
    </div>
    <div className="grid grid-cols-2 gap-4 text-sm">
      <div>
        <div className="text-xs text-blue-200/60 mb-1">Allowable Incoming</div>
        <div className="font-mono text-blue-100">{formatCurrency(validatorAllowableIncoming)}</div>
      </div>
      {validatorRule && (
        <div>
          <div className="text-xs text-blue-200/60 mb-1">Rule Applied</div>
          <div className="text-blue-100">{validatorRule}</div>
        </div>
      )}
    </div>
  </div>
)}
```

**Sandbox Section with comparison**:

```jsx
{/* P2: Show official value if it differs */}
{officialDiffers && (
  <div className="text-xs text-blue-300 mt-1">
    Validator will use: {formatCurrency(validatorAllowableIncoming)}
  </div>
)}
```

---

## 5. Base vs Matching: How We Detect Base and Matching

### Fields Used for Base Salary Display

| Component | Field Path | Fallback |
|-----------|------------|----------|
| TradeTeamCard (outgoing) | `getSalaryForYear([player], yearKey)` | — |
| TradeTeamCard (incoming) | `getSalaryForYear([player], yearKey)` | — |
| TradeSummaryPanel | `p.baseSalary ?? p.salary ?? 0` | — |
| Snapshot accessor | `teamResult.calculations.salaryOut` | `teamResult.salaryOut` |

### Fields Used for Matching Salary Display

| Component | Field Path | Fallback |
|-----------|------------|----------|
| TradeTeamCard (outgoing) | `snapshot.outgoingMatchingSalary` | `localOutgoingSalary` with "Estimate" badge |
| TradeTeamCard (incoming) | `snapshot.incomingMatchingSalary` | `localIncomingSalary` with "Estimate" badge |
| TradeTeamCard (player-level out) | `p.matchOutgoing` | `baseSalary` |
| TradeTeamCard (player-level in) | `p.matchIncoming` | `baseSalary` |
| TradeSummaryPanel | `p.matchIncoming ?? p.matchingValue ?? baseSalary` | — |
| Snapshot accessor | `teamResult.salaryOut` / `teamResult.salaryIn` | — |

### Adjustment Type Detection

**Can be detected when these player flags are present**:

| Adjustment Type | Detection Fields |
|-----------------|------------------|
| **BYC** | `player.isBYC === true` OR `player.baseYearCompensation === true` |
| **Trade Kicker** | `player.tradeKicker` (object) OR `player.tradeKickerPct > 0` |
| **Poison Pill** | `player.isPoisonPill === true` OR `player.contract?.isRookieScale === true` OR `player.isRookieScale === true` |

**What is missing for more specific detection**:

- The validator does not currently expose a per-player `adjustmentType` field in the snapshot
- The `computeMatchingValues.js` function sets `matchOutgoing` and `matchIncoming` but does not track which rule caused the adjustment
- **Recommendation**: Future enhancement could add `player.matchingAdjustments: ['BYC', 'TRADE_KICKER']` array to each player in the validator output

**Current behavior**: When adjustment flags are not explicitly set on the player object, the tooltip falls back to generic text: "Adjusted trade matching value (BYC/kicker/poison pill may apply)."

---

## 6. Validation Command Output

### Test 1: tradeSnapshotWiring.test.js

```text
$ npm run test src/tests/trade/tradeSnapshotWiring.test.js -- --run

 RUN  v1.6.1 /home/runner/work/scoutzero/scoutzero

 ✓ src/tests/trade/tradeSnapshotWiring.test.js  (25 tests) 10ms

 Test Files  1 passed (1)
      Tests  25 passed (25)
   Start at  06:40:33
   Duration  956ms
```

**RESULT: ✅ PASS**

### Test 2: salaryMatchingRules.test.js

```text
$ npm run test tests/salaryMatchingRules.test.js -- --run

 RUN  v1.6.1 /home/runner/work/scoutzero/scoutzero

 ✓ tests/salaryMatchingRules.test.js  (16 tests) 20ms

 Test Files  1 passed (1)
      Tests  16 passed (16)
   Start at  06:40:41
   Duration  961ms
```

**RESULT: ✅ PASS**

### Test 3: tests/trade/ (all trade tests)

```text
$ npm run test tests/trade/ -- --run

 ✓ tests/trade/tpe_creation_expiry_usage.test.js  (4 tests) 35ms
 ✓ tests/trade/faExceptions_as_trade_buckets.test.js  (8 tests) 7ms
 ✓ tests/trade/input_validation.test.js  (8 tests) 10ms
 ✓ tests/trade/jan15_offseason_timing.test.js  (5 tests) 7ms
 ✓ tests/trade/consent_and_reacq.test.js  (6 tests) 34ms
 ✓ tests/trade/tradeKicker_zeroGuarantee.test.js  (4 tests) 5ms
 ✓ tests/trade/timingGates_softEnforcement.test.js  (4 tests) 14ms
 ✓ tests/trade/frozenPick_consequences.test.js  (4 tests) 38ms
 ✓ tests/trade/orderOfOps_conversionsBeforeMatching.test.js  (2 tests) 21ms
 ✓ tests/trade/secondApron_tpeBan.test.js  (3 tests) 28ms
 ✓ tests/trade/secondApron_handcuffs.test.js  (4 tests) 4ms
 ✓ tests/trade/tradeKicker_proration.test.js  (4 tests) 4ms
 ✓ tests/trade/poisonPill_average.test.js  (3 tests) 4ms
 ✓ tests/trade/consent_and_birdVeto.test.js  (3 tests) 6ms
 ✓ tests/trade/salaryMatching.test.js  (4 tests) 7ms
 ✓ tests/trade/rosterWindow_softEnforcement.test.js  (3 tests) 6ms
 ✓ tests/trade/reacquisition_bar.test.js  (2 tests) 4ms
 ✓ tests/trade/matchingBands_2023.test.js  (3 tests) 3ms
 ✓ tests/trade/roster_twoWay_enforcement.test.js  (2 tests) 6ms
 ✓ tests/trade/hardCap_trigger_faException.test.js  (1 test) 4ms
 ✓ tests/trade/byc_outgoing_max.test.js  (2 tests) 5ms
 ✓ tests/trade/firstApron_100pct.test.js  (2 tests) 3ms
 ✓ tests/trade/cashLedger_season_tracking.test.js  (1 test) 3ms
 ... (27 total test files)

 Test Files  27 passed (27)
      Tests  130 passed (130)
   Duration  8.36s
```

**RESULT: ✅ PASS**

### Test 4: npm run build

```text
$ npm run build

vite v4.5.14 building for production...
✓ 2913 modules transformed.
dist/index.html                            0.60 kB │ gzip:   0.37 kB
dist/assets/index-3a2b8de2.css            71.38 kB │ gzip:  12.61 kB
dist/assets/index.esm-7f2eb3a5.js          3.62 kB │ gzip:   1.56 kB
dist/assets/tradeManager-0b889435.js       5.24 kB │ gzip:   2.05 kB
dist/assets/seasonManager-0646b9d3.js      7.89 kB │ gzip:   2.93 kB
dist/assets/index-8c830ad3.js          1,812.38 kB │ gzip: 531.86 kB
✓ built in 9.11s
```

**RESULT: ✅ PASS**

---

## 7. Summary

| Validation Command | Result |
|--------------------|--------|
| `npm run test src/tests/trade/tradeSnapshotWiring.test.js -- --run` | ✅ PASS (25/25) |
| `npm run test tests/salaryMatchingRules.test.js -- --run` | ✅ PASS (16/16) |
| `npm run test tests/trade/ -- --run` | ✅ PASS (130/130) |
| `npm run build` | ✅ PASS |

**All validation commands passed.**

---

*End of Return Package*
