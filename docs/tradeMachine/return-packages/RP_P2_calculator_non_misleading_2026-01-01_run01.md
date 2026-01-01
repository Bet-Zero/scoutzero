# Return Package: P2 Lock-in — TradeSalaryCalculator Non-Misleading Guardrails

> **Date**: 2026-01-01  
> **Run**: 01  
> **Master Doc Version**: 1.2.3  
> **Task**: TradeSalaryCalculator "cannot mislead" guardrails (P2 lock-in)

---

## 1. Summary (What Changed + Why)

### Background

The `TradeSalaryCalculator.jsx` component is the ONLY exception to Invariant 2 (Snapshot-Only for Official Values) per Master Doc Section 3.4. While it may show sandbox estimates for exploration, it must never contradict the authoritative validator snapshot in a way that misleads the user.

### Problem Identified

Before this change, the calculator could show a green "Valid Trade (Sandbox)" success state even when:
- Cap settings were missing or had zero values (making calculations invalid)
- The validator indicated salary matching was N/A (e.g., HARD_CAP_SKIP, TPE_ABSORPTION)
- The validator result contradicted the sandbox estimate

### What Changed

1. **Added `validatorSkipReason` prop** to TradeSalaryCalculator
   - Wired from TradeEditor.jsx: `teamResult?.rules?.salaryMatching?.skipReason`
   - Used to detect when validator indicates salary matching is N/A

2. **Added cap settings validation guards**
   - Detects when `capSettings` is missing or has zero critical values
   - Disables sandbox validation when cap settings are invalid

3. **Implemented "Non-Misleading" UI Guards**
   - **Rule A**: Official section ALWAYS renders when `hasValidatorResult=true` (even with skip reason)
   - **Rule B**: Shows "Sandbox Disabled" instead of green success when:
     - Cap settings missing/zero
     - Validator skipReason exists (HARD_CAP_SKIP, TPE_ABSORPTION, etc.)
   - **Rule C**: Shows "Sandbox vs Validator Mismatch" with "Validator wins" context when results contradict

4. **Added 5 new guardrail tests** verifying the non-misleading behavior

5. **Updated Master Doc Section 3.4** with "Non-Misleading Guardrails" subsection

---

## 2. Files Changed (With Paths)

| File | Action | Description |
|------|--------|-------------|
| `src/features/architect/tradeMachine/TradeSalaryCalculator.jsx` | **MODIFIED** | Added validatorSkipReason prop, cap settings validation, non-misleading UI guards |
| `src/features/architect/tradeMachine/TradeEditor.jsx` | **MODIFIED** | Wired validatorSkipReason prop to TradeSalaryCalculator |
| `src/tests/trade/TradeSalaryCalculator.guardrail.test.jsx` | **MODIFIED** | Added 5 new tests for P2 lock-in guardrails |
| `docs/tradeMachine/MASTER_TRADE_MACHINE_ALIGNMENT.md` | **MODIFIED** | Updated to v1.2.3, added "Non-Misleading Guardrails" subsection to Section 3.4 |
| `docs/tradeMachine/return-packages/RP_P2_calculator_non_misleading_2026-01-01_run01.md` | **NEW** | This document |

---

## 3. Prop Wiring Map (Parent → Props → Calculator)

### TradeEditor.jsx → TradeSalaryCalculator.jsx

```jsx
// TradeEditor.jsx (lines 261-288)
const teamResult = result?.teamResults?.[calculatorTeamIndex];
const hasValidatorResult = teamResult != null;
const validatorAllowableIncoming = teamResult?.rules?.salaryMatching?.allowableIncoming ?? null;
const validatorRule = teamResult?.rules?.salaryMatching?.details?.ruleApplied ?? null;
// P2 Lock-in: Wire skip reason for non-misleading guardrails
const validatorSkipReason = teamResult?.rules?.salaryMatching?.skipReason ?? null;

<TradeSalaryCalculator
  teamSalary={selectedTeam.team?.teamTotalSalary || selectedTeam.team?.totalSalary || 0}
  outgoingSalary={salaryOut[calculatorTeamIndex] || 0}
  incomingPlayers={incomingAssets[calculatorTeamIndex]?.players || []}
  tpes={selectedTeam.team?.tradeExceptions || []}
  capSettings={result?.capSettings || capProjections}
  yearKey={yearKey}
  // P2: Wire official validator results for comparison
  validatorAllowableIncoming={validatorAllowableIncoming}
  validatorRule={validatorRule}
  hasValidatorResult={hasValidatorResult}
  // P2 Lock-in: Wire skip reason for non-misleading guardrails
  validatorSkipReason={validatorSkipReason}
/>
```

### Canonical Field Paths

| Prop | Canonical Source Path |
|------|----------------------|
| `validatorAllowableIncoming` | `teamResult.rules.salaryMatching.allowableIncoming` |
| `validatorRule` | `teamResult.rules.salaryMatching.details.ruleApplied` |
| `validatorSkipReason` | `teamResult.rules.salaryMatching.skipReason` |
| `hasValidatorResult` | `teamResult != null` |

---

## 4. Guard Rules Implemented (A/B/C)

### Rule A: Official Section Always Renders When Validator Result Exists

```jsx
{/* P2: Official Validator Section (when available) - ALWAYS show when hasValidatorResult */}
{hasValidatorResult && (
  <div className="bg-blue-900/20 border border-blue-500/30 rounded p-3">
    <div className="text-xs font-semibold text-blue-300 mb-2 flex items-center gap-1">
      <span>✓</span> Official Validator Result
    </div>
    {/* P2 Lock-in: Show skip reason when salary matching is N/A */}
    {validatorSkipReason ? (
      <div className="text-sm text-blue-100">
        <span className="text-blue-200/60">Status: </span>
        Salary matching not applicable ({validatorSkipReason})
      </div>
    ) : validatorAllowableIncoming != null ? (
      // ... normal display
    )}
  </div>
)}
```

### Rule B: Sandbox Disabled When Cap Settings Missing/Zero or Skip Reason Exists

```jsx
// P2 Lock-in: Check if cap settings are missing or have zero critical values
const capSettingsMissing = !capSettings;
const capSettingsZero = capSettings && (
  (!capSettings.salaryCap && !capSettings.cap) ||
  (capSettings.salaryCap === 0 && capSettings.cap === 0)
);
const hasInvalidCapSettings = capSettingsMissing || capSettingsZero;

// P2 Lock-in: Sandbox success should be disabled when:
// 1. Cap settings are missing/zero
// 2. Validator indicates salary matching is N/A (skip reason present)
const sandboxDisabledReason = useMemo(() => {
  if (hasInvalidCapSettings) {
    return 'Missing cap settings';
  }
  if (validatorSkipReason) {
    return `Salary matching not applicable (${validatorSkipReason})`;
  }
  return null;
}, [hasInvalidCapSettings, validatorSkipReason]);

const isSandboxDisabled = !!sandboxDisabledReason;

// UI when disabled:
{isSandboxDisabled && (
  <div className="p-3 rounded bg-neutral-800/50 border border-neutral-600/30">
    <div className="font-medium flex items-center text-neutral-400">
      <span className="mr-2">⊘</span>
      <span>Sandbox Disabled</span>
    </div>
    <div className="text-sm mt-1 text-neutral-400">
      {sandboxDisabledReason}
    </div>
  </div>
)}
```

### Rule C: Validator Wins When Results Contradict

```jsx
// P2 Lock-in: Detect if validator result contradicts sandbox
const validatorContradictsSandbox = hasValidatorResult && 
  validatorAllowableIncoming != null &&
  !isSandboxDisabled &&
  ((incomingSalary <= allowableIncoming) !== (incomingSalary <= validatorAllowableIncoming));

// UI when contradicting:
{validatorContradictsSandbox && (
  <div className="p-3 rounded bg-amber-900/20 border border-amber-600/30">
    <div className="font-medium flex items-center text-amber-300">
      <span className="mr-2">⚠️</span>
      <span>Sandbox vs Validator Mismatch</span>
    </div>
    <div className="text-sm mt-1 text-amber-200/80">
      Sandbox: {incomingSalary <= allowableIncoming ? 'Valid' : 'Invalid'} | 
      <span className="font-semibold text-blue-300 ml-1">
        Validator (authoritative): {incomingSalary <= validatorAllowableIncoming ? 'Valid' : 'Invalid'}
      </span>
    </div>
    <div className="text-xs mt-2 text-amber-200/60 italic">
      The official validator result takes precedence over sandbox estimates.
    </div>
  </div>
)}
```

---

## 5. Tests Added

### File: `src/tests/trade/TradeSalaryCalculator.guardrail.test.jsx`

| Test ID | Assertion |
|---------|-----------|
| P2-GR-10 | Official section renders when validator result has skip reason |
| P2-GR-11 | Shows "Sandbox Disabled" when validatorSkipReason exists |
| P2-GR-12 | Shows disabled reason explanation text |
| P2-GR-13 | Component handles validator contradiction scenarios |
| P2-GR-14 | Official section renders when hasValidatorResult=true regardless of allowableIncoming |

---

## 6. Command Outputs

### Test 1: TradeSalaryCalculator Guardrail Tests

```
$ npm run test src/tests/trade/TradeSalaryCalculator.guardrail.test.jsx -- --run

 RUN  v1.6.1 /home/runner/work/scoutzero/scoutzero

 ✓ src/tests/trade/TradeSalaryCalculator.guardrail.test.jsx  (14 tests) 140ms

 Test Files  1 passed (1)
      Tests  14 passed (14)
   Start at  10:32:36
   Duration  1.26s
```

**RESULT: ✅ PASS (14/14)**

### Test 2: tests/trade/ (All Trade Tests)

```
$ npm run test tests/trade/ -- --run

 Test Files  28 passed (28)
      Tests  144 passed (144)
   Start at  10:32:45
   Duration  9.17s
```

**RESULT: ✅ PASS (144/144)**

### Test 3: src/tests/trade/ (Including New Guardrails)

```
$ npm run test src/tests/trade/ -- --run

 ✓ src/tests/trade/tradeSnapshotWiring.test.js  (25 tests)
 ✓ src/tests/trade/goldenTrades.test.js  (11 tests)
 ✓ src/tests/trade/TradeSalaryCalculator.guardrail.test.jsx  (14 tests)

 Test Files  3 passed (3)
      Tests  50 passed (50)
   Start at  10:33:02
   Duration  1.61s
```

**RESULT: ✅ PASS (50/50)**

### Test 4: Build

```
$ npm run build

vite v4.5.14 building for production...
✓ 2914 modules transformed.
dist/index.html                            0.60 kB │ gzip:   0.37 kB
dist/assets/index-70f1c36b.css            71.59 kB │ gzip:  12.64 kB
dist/assets/index.esm-e9aa5f88.js          3.62 kB │ gzip:   1.56 kB
dist/assets/tradeManager-f4f124c1.js       5.24 kB │ gzip:   2.05 kB
dist/assets/seasonManager-eff53a63.js      7.89 kB │ gzip:   2.93 kB
dist/assets/index-11ee9632.js          1,821.07 kB │ gzip: 534.09 kB
✓ built in 9.43s
```

**RESULT: ✅ PASS**

---

## 7. No-Scope Confirmation

**Explicit statement: No validator math changed.**

This P2 lock-in:
- ✅ Did NOT modify any validator logic files
- ✅ Did NOT change salary matching calculations
- ✅ Did NOT alter `validateSalaryMatching.js` or related validator rules
- ✅ Did NOT modify `getSalaryMatchingResult()` or `salaryMatchingRules.js`
- ✅ Only added UI guardrails and wiring to prevent misleading displays
- ✅ All existing tests continue to pass

---

## 8. Acceptance Criteria Verification

| Criteria | Status |
|----------|--------|
| Official Validator Result (blue section) with allowable incoming + rule label shows when validator exists | ✅ |
| Sandbox estimate clearly labeled as "local calculation" | ✅ |
| No green "Valid Trade (Sandbox)" when cap settings missing/zero | ✅ |
| No green "Valid Trade (Sandbox)" when validator skip reason exists | ✅ |
| "Validator wins" context when sandbox contradicts official | ✅ |
| All tests pass | ✅ (14 + 144 + 50 = 208 tests) |
| Build passes | ✅ |

---

*End of Return Package*
