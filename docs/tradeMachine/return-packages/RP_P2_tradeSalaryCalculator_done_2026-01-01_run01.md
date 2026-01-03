# Return Package: P2 TradeSalaryCalculator DONE Pass + Guardrails

> **Date**: 2026-01-01  
> **Run**: 01  
> **Master Doc Version**: 1.2.1  
> **Task**: TradeSalaryCalculator "DONE" pass (P2) + guardrails

---

## 1. Summary (What Changed + Why)

### Background

The `TradeSalaryCalculator.jsx` component already had P2 changes applied (as documented in `RP_alignment_P1P2_2026-01-01_run01.md`). This DONE pass verified compliance with Master Doc v1.2.1 Section 3.4 (Exploratory Tools Exception) and added guardrail tests to prevent regression.

### What Changed

1. **Added guardrail tests** (`src/tests/trade/TradeSalaryCalculator.guardrail.test.jsx`)
   - 9 tests verifying visual separation, official value sourcing, and disclaimer requirements
   - Tests will fail if someone removes the sandbox/official separation or changes value sources

2. **No component code changes required**
   - The existing `TradeSalaryCalculator.jsx` already complies with Master Doc Section 3.4
   - The component has:
     - ✅ Prominent disclaimer: "⚠️ Exploratory tool — validator is authoritative"
     - ✅ Official Validator Result section (blue styling) when `hasValidatorResult=true`
     - ✅ Sandbox Estimate section (local calculation)
     - ✅ "Validator will use: $X" message when sandbox differs from official by >$1
     - ✅ Props for receiving official validator values (`validatorAllowableIncoming`, `validatorRule`, `hasValidatorResult`)

### Why

Per Master Doc Section 3.4, TradeSalaryCalculator is the **ONLY** allowed exception to Invariant 2 (Snapshot-Only for Official Values). The visual separation requirement ensures users can distinguish exploratory sandbox calculations from authoritative validator results.

---

## 2. Files Changed (With Paths)

| File | Action |
|------|--------|
| `src/tests/trade/TradeSalaryCalculator.guardrail.test.jsx` | **NEW** - Guardrail tests for P2 requirements |
| `docs/tradeMachine/return-packages/RP_P2_tradeSalaryCalculator_done_2026-01-01_run01.md` | **NEW** - This document |

---

## 3. Before/After UI Section Headings

### Final UI Section Headings Rendered

When `hasValidatorResult=true` and `validatorAllowableIncoming` is provided:

```text
┌─────────────────────────────────────────────────────────────────────────┐
│ ⚠️ Exploratory tool — validator is authoritative for final trade legality │
├─────────────────────────────────────────────────────────────────────────┤
│ Salary Matching Calculator                                               │
├─────────────────────────────────────────────────────────────────────────┤
│ ┌─ Blue Section ──────────────────────────────────────────────────────┐ │
│ │ ✓ Official Validator Result                                         │ │
│ │   Allowable Incoming: $X,XXX,XXX (from validatorAllowableIncoming)  │ │
│ │   Rule Applied: <validatorRule>                                     │ │
│ └────────────────────────────────────────────────────────────────────┘ │
│ ┌─ Gray Section ──────────────────────────────────────────────────────┐ │
│ │ ⚡ Sandbox Estimate (local calculation)                              │ │
│ │   Outgoing Salary: $X,XXX,XXX                                       │ │
│ │   Allowable Incoming: $X,XXX,XXX (local getSalaryMatchingResult)    │ │
│ │   [If differs >$1] Validator will use: $X,XXX,XXX                   │ │
│ │   Rule Applied: <local rule> (Validator: <official rule>)           │ │
│ └────────────────────────────────────────────────────────────────────┘ │
│ [Test Incoming Salary input]                                            │
│ [Validation Result section]                                             │
└─────────────────────────────────────────────────────────────────────────┘
```

When `hasValidatorResult=false`:

```text
┌─────────────────────────────────────────────────────────────────────────┐
│ ⚠️ Exploratory tool — validator is authoritative for final trade legality │
├─────────────────────────────────────────────────────────────────────────┤
│ Salary Matching Calculator                                               │
├─────────────────────────────────────────────────────────────────────────┤
│ Sandbox Estimate                                                         │
│   [Outgoing Salary, Allowable Incoming, Rule Breakdown]                 │
│ [Test Incoming Salary input]                                            │
│ [Validation Result section]                                             │
└─────────────────────────────────────────────────────────────────────────┘
```

### Exact Source Fields for Official Values

| Official Value | Canonical Path | Accessor Name in Component |
|----------------|----------------|----------------------------|
| **Allowable Incoming (LIMIT)** | `teamResult.rules.salaryMatching.allowableIncoming` | `validatorAllowableIncoming` prop |
| **Rule Applied** | `teamResult.rules.salaryMatching.details.ruleApplied` | `validatorRule` prop |
| **Has Validator Result** | Presence of validation result | `hasValidatorResult` prop |

---

## 4. Prop Wiring Map

### Parent File → Props → TradeSalaryCalculator Usage

**Current Status**: Component is NOT currently wired from any parent. Props are ready for integration.

| Parent | Prop Names | TradeSalaryCalculator Usage |
|--------|------------|----------------------------|
| *(Not wired)* | `teamSalary` | Team's current total salary (required) |
| *(Not wired)* | `outgoingSalary` | Sum of outgoing player salaries (required) |
| *(Not wired)* | `incomingPlayers` | Array of incoming players for min salary exception calc |
| *(Not wired)* | `tpes` | Array of TPEs for TPE allowance calc |
| *(Not wired)* | `capSettings` | Cap thresholds: `{salaryCap, firstApron, secondApron}` |
| *(Not wired)* | `yearKey` | Trade year (e.g., 2025) |
| *(Not wired)* | `validatorAllowableIncoming` | Official allowable incoming from `teamResult.rules.salaryMatching.allowableIncoming` |
| *(Not wired)* | `validatorRule` | Official rule label from `teamResult.rules.salaryMatching.details.ruleApplied` |
| *(Not wired)* | `hasValidatorResult` | Boolean indicating if validator result is available |

**Future Integration Note**: When wiring from `TradeEditor.jsx` or similar parent, ensure:

```jsx
<TradeSalaryCalculator
  teamSalary={team.totalSalary}
  outgoingSalary={localOutgoingSalary}
  incomingPlayers={incomingPlayers}
  tpes={team.tpes || []}
  capSettings={result?.capSettings}
  yearKey={yearKey}
  // P2: Wire official values from validator snapshot
  hasValidatorResult={!!result && !!teamResult}
  validatorAllowableIncoming={teamResult?.rules?.salaryMatching?.allowableIncoming}
  validatorRule={teamResult?.rules?.salaryMatching?.details?.ruleApplied}
/>
```

---

## 5. Test Added/Updated

### File Path

`src/tests/trade/TradeSalaryCalculator.guardrail.test.jsx`

### What It Asserts (Bullets)

**Visual Separation Requirement (Master Doc 3.4)**:

- P2-GR-01: Renders "Official Validator Result" section when validator result exists
- P2-GR-02: Renders "Sandbox Estimate (local calculation)" when validator result exists
- P2-GR-03: Renders "Sandbox Estimate" when NO validator result exists
- P2-GR-04: Does NOT render "Official Validator Result" when NO validator result exists

**Official Values Source (Master Doc Invariant 2)**:

- P2-GR-05: Official `allowableIncoming` displayed is from `validatorAllowableIncoming` prop (not local calc)
- P2-GR-06: Official rule displayed is from `validatorRule` prop

**Disclaimer Requirement (Master Doc 3.4)**:

- P2-GR-07: Always renders "Exploratory tool" disclaimer with "validator is authoritative" text
- P2-GR-08: Disclaimer present even when no validator result

**Validator Differs Message (Master Doc 3.4)**:

- P2-GR-09: Shows "Validator will use: $X" when sandbox differs from official by >$1

---

## 6. Command Outputs

### Test 1: TradeSalaryCalculator Guardrail Tests

```text
$ npm run test src/tests/trade/TradeSalaryCalculator.guardrail.test.jsx -- --run

 RUN  v1.6.1 /home/runner/work/scoutzero/scoutzero

 ✓ src/tests/trade/TradeSalaryCalculator.guardrail.test.jsx  (9 tests) 109ms

 Test Files  1 passed (1)
      Tests  9 passed (9)
   Start at  09:04:30
   Duration  1.25s
```

**RESULT: ✅ PASS (9/9)**

### Test 2: tradeSnapshotWiring.test.js

```text
$ npm run test src/tests/trade/tradeSnapshotWiring.test.js -- --run

 RUN  v1.6.1 /home/runner/work/scoutzero/scoutzero

 ✓ src/tests/trade/tradeSnapshotWiring.test.js  (25 tests) 14ms

 Test Files  1 passed (1)
      Tests  25 passed (25)
   Start at  09:04:41
   Duration  1.65s
```

**RESULT: ✅ PASS (25/25)**

### Test 3: tests/trade/ (All Trade Tests)

```text
$ npm run test tests/trade/ -- --run

 ✓ tests/trade/signAndTrade_completeness.test.js  (6 tests)
 ✓ tests/trade/faExceptions_as_trade_buckets.test.js  (8 tests)
 ✓ tests/trade/tpe_creation_expiry_usage.test.js  (4 tests)
 ... (28 total test files)

 Test Files  28 passed (28)
      Tests  139 passed (139)
   Start at  09:04:41
   Duration  9.58s
```

**RESULT: ✅ PASS (139/139)**

### Test 4: src/tests/trade/ (Including New Guardrails)

```text
$ npm run test src/tests/trade/ -- --run

 ✓ src/tests/trade/goldenTrades.test.js  (11 tests)
 ✓ src/tests/trade/tradeSnapshotWiring.test.js  (25 tests)
 ✓ src/tests/trade/TradeSalaryCalculator.guardrail.test.jsx  (9 tests)

 Test Files  3 passed (3)
      Tests  45 passed (45)
   Start at  09:05:00
   Duration  2.38s
```

**RESULT: ✅ PASS (45/45)**

### Test 5: Build Result

```text
$ npm run build

vite v4.5.14 building for production...
✓ 2913 modules transformed.
dist/index.html                            0.60 kB │ gzip:   0.37 kB
dist/assets/index-3a2b8de2.css            71.38 kB │ gzip:  12.61 kB
dist/assets/index.esm-6d8b1843.js          3.62 kB │ gzip:   1.56 kB
dist/assets/tradeManager-39c79e3d.js       5.24 kB │ gzip:   2.05 kB
dist/assets/seasonManager-69ec2935.js      7.89 kB │ gzip:   2.93 kB
dist/assets/index-16d0721e.js          1,812.16 kB │ gzip: 531.96 kB
✓ built in 11.15s
```

**RESULT: ✅ PASS**

---

## 7. No-Scope Confirmation

**Explicit statement: No validator math changed.**

This DONE pass:

- ✅ Did NOT modify any validator logic files
- ✅ Did NOT change salary matching calculations
- ✅ Did NOT alter `validateSalaryMatching.js` or related validator rules
- ✅ Did NOT modify `getSalaryMatchingResult()` or `salaryMatchingRules.js`
- ✅ Only added guardrail tests to verify existing P2 compliance

The existing `TradeSalaryCalculator.jsx` component was already compliant with Master Doc Section 3.4 requirements. This pass validated that compliance and added test guardrails.

---

*End of Return Package*
