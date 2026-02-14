# TM_SEC_A4 — UI Numbers Truth + Summary/Export Audit

**Audit Date:** 2026-02-14  
**Mode:** PREFLIGHT (Discovery-only; NO functional code changes)  
**Sections Audited:** 10 (UI Numbers + Messaging), 11 (Summary + Export)  
**Status:** ✅ PASS

---

## 1. Numbers Inventory

### All Numeric Values Displayed in Trade UI

| Label in UI                        | Component(s)                    | Source Function/Selector                  | Uses Official Snapshot?        | Risk |
| ---------------------------------- | ------------------------------- | ----------------------------------------- | ------------------------------ | ---- |
| **Matching In / Allowed**          | TradeSummaryPanel.jsx:L186-203  | `getOfficialSalaryMatchingSnapshot()`     | ✅ YES                         | LOW  |
| **Salary Match Ceiling**           | TradeSummaryPanel.jsx:L208-215  | `officialSnapshot.allowableIncoming`      | ✅ YES                         | LOW  |
| **Hard Cap Ceiling**               | TradeSummaryPanel.jsx:L216-230  | `officialSnapshot.hardCapIncomingCeiling` | ✅ YES                         | LOW  |
| **Over by $X**                     | TradeSummaryPanel.jsx:L195      | Computed: `salaryIn - allowedIncoming`    | ✅ YES (from snapshot)         | LOW  |
| **Outgoing Salary/Matching Value** | TradeTeamCard.jsx:L375-380      | `snapshot.outgoingMatchingSalary`         | ✅ YES                         | LOW  |
| **Incoming Salary/Matching Value** | TradeTeamCard.jsx:L468-473      | `snapshot.incomingMatchingSalary`         | ✅ YES                         | LOW  |
| **Outgoing Base Salary**           | TradeTeamCard.jsx:L399          | `snapshot.outgoingBaseSalary`             | ✅ YES                         | LOW  |
| **Incoming Base Salary**           | TradeTeamCard.jsx:L523          | `snapshot.incomingBaseSalary`             | ✅ YES                         | LOW  |
| **Allowable Incoming**             | TradeTeamCard.jsx:L584-598      | `snapshot.allowableIncoming`              | ✅ YES                         | LOW  |
| **TOTAL CAP (projected)**          | CapImpactTiles.jsx:L109         | `snapshot.projectedSalary`                | ✅ YES                         | LOW  |
| **CAP SPACE**                      | CapImpactTiles.jsx:L115-121     | `salaryCap - projectedSalary`             | ✅ YES (derived from snapshot) | LOW  |
| **1ST APRON space**                | CapImpactTiles.jsx:L127-141     | `firstApron - projectedSalary`            | ✅ YES (derived from snapshot) | LOW  |
| **2ND APRON space**                | CapImpactTiles.jsx:L156-164     | `secondApron - projectedSalary`           | ✅ YES (derived from snapshot) | LOW  |
| **Cap Impact (Export)**            | TradeExportCapture.jsx:L275-277 | `summaryByTeamIndex[].capDelta`           | ✅ YES (validator output)      | LOW  |
| **Player salary (Export)**         | TradeExportCapture.jsx:L184     | `baseSalary` via `getSalaryForYear()`     | BASE ONLY (intentional)        | LOW  |
| **Player salary (Summary)**        | TradeSummaryPanel.jsx:L265      | `baseSalary` (not matching)               | BASE ONLY (intentional)        | LOW  |

### Key Observations

1. **All legality-affecting numeric values** (outgoing, incoming, allowable) use `getOfficialSalaryMatchingSnapshot()` as the canonical selector
2. **Cap/apron displays** derive from validator's `projectedSalary` snapshot
3. **Player salaries in summary lists** intentionally show BASE salary (not matching) — matching totals shown separately
4. **Export shows BASE salaries** with explicit disclaimer note: "Salaries shown are base contract values"

---

## 2. Single Source of Truth Check

### Canonical Selector

**File:** `src/features/architect/tradeMachine/utils/getOfficialSalaryMatchingSnapshot.js`

```javascript
// CANONICAL SELECTOR for official salary matching values from validator output.
// This is the SINGLE SOURCE OF TRUTH for all UI surfaces displaying salary matching data.
```

### Selector Usage Audit

| Component             | How It Accesses Snapshot                                                                                 | Status       |
| --------------------- | -------------------------------------------------------------------------------------------------------- | ------------ |
| TradeSummaryPanel.jsx | Direct: `getOfficialSalaryMatchingSnapshot(teamResult)`                                                  | ✅ CANONICAL |
| TradeTeamCard.jsx     | Via accessor: `getTeamSnapshot(teamId, result)` which delegates to `getOfficialSalaryMatchingSnapshot()` | ✅ CANONICAL |
| CapImpactTiles.jsx    | Via `snapshot` prop (passed from TradeTeamCard)                                                          | ✅ CANONICAL |

### Alternate Compute Paths

**TradeTeamCard.jsx Lines 152-162:** Local fallback calculation retained for DEV divergence warnings only:

```javascript
// Use snapshot values when available, fallback to local with Estimate indicator
const outgoingSalary = hasValidatorResult
  ? snapshot.outgoingMatchingSalary
  : localOutgoingSalary;
```

**Risk Mitigation:**

- `Estimate` badge shown when using local values
- `warnOnTotalsDivergence()` guardrail detects drift in DEV mode

---

## 3. Summary Wiring

### Data Flow: Trade Session → Summary Panel

```
1. TradeEditor.jsx
   └── manages trade session state (teams[], sends[], entitlementsOut[])
   └── calls validateTrade() → returns result

2. validateTrade() (tradeValidator.js)
   └── computes teamResults[], summaryByTeamIndex[]
   └── teamResults[i] includes: salaryOut, salaryIn, rules.salaryMatching.*

3. TradeSummaryPanel.jsx (receives result prop)
   └── iterates result.summaryByTeamIndex for team cards
   └── calls getOfficialSalaryMatchingSnapshot(teamResult) per team
   └── displays officialSnapshot.salaryIn, effectiveAllowableIncoming, etc.
```

### Evidence: Summary Uses Validated Results

**TradeSummaryPanel.jsx Lines 138-163:**

```javascript
// CANONICAL SOURCE: Use getOfficialSalaryMatchingSnapshot for all salary matching values
const officialSnapshot = getOfficialSalaryMatchingSnapshot(teamResult);

// Incoming salary from official selector
const salaryIn = officialSnapshot.salaryIn ?? 0;

// TM_FIX_A2_E1: Use effectiveAllowableIncoming when available
const effectiveAllowed = officialSnapshot.effectiveAllowableIncoming;
```

**Status:** ✅ Summary uses validated results via canonical selector

---

## 4. Export Wiring

### Data Flow: Trade Session → Export

```
1. TradeEditor.jsx
   └── passes teams[], result props to TradeExportCapture

2. TradeExportCapture.jsx
   └── Receives same teams[] and result as TradeSummaryPanel
   └── Gets capDelta from result.summaryByTeamIndex[].capDelta
   └── Gets player baseSalary via getSalaryForYear() (NOT matching)
```

### Evidence: Export Matches Summary Source

**TradeExportCapture.jsx Lines 100-103:**

```javascript
const summary = result?.summaryByTeamIndex?.find(
  (s) => s.teamName === tm.team.teamName
);
const capDelta = summary?.capDelta || 0;
```

**The Same Props Flow:**

- Both TradeSummaryPanel and TradeExportCapture receive:
  - `teams` - same array reference
  - `result` - same validator output

### Base Salary vs Matching - Intentional Design

**Export (TradeExportCapture.jsx L181-184):**

```javascript
// Phase 2.2: Export uses BASE salary only (roster reality)
// Matching values should never appear here unless explicitly labeled
const baseSalary = p.baseSalary ?? getSalaryForYear([p], yearKey);
```

**Disclaimer (TradeExportCapture.jsx L289-292):**

```javascript
<div className="text-center text-xs text-neutral-500 ...">
  Salaries shown are base contract values. Matching values for trade legality
  may differ (BYC, trade kicker, poison pill adjustments).
</div>
```

**Status:** ✅ Export uses same source; base vs matching difference is intentional and documented

---

## 5. Mismatch Analysis

### UI ≠ Validator Inputs Check

| Check              | Location          | Finding                                               | Status   |
| ------------------ | ----------------- | ----------------------------------------------------- | -------- |
| Outgoing salary    | TradeTeamCard     | Uses `snapshot.outgoingMatchingSalary` from validator | ✅ MATCH |
| Incoming salary    | TradeTeamCard     | Uses `snapshot.incomingMatchingSalary` from validator | ✅ MATCH |
| Allowable incoming | TradeTeamCard     | Uses `snapshot.allowableIncoming` from validator      | ✅ MATCH |
| Projected salary   | CapImpactTiles    | Uses `snapshot.projectedSalary` from validator        | ✅ MATCH |
| Summary salaryIn   | TradeSummaryPanel | Uses `officialSnapshot.salaryIn`                      | ✅ MATCH |

### Summary ≠ Export Check

| Value         | Summary Source                         | Export Source                          | Match? |
| ------------- | -------------------------------------- | -------------------------------------- | ------ |
| capDelta      | `result.summaryByTeamIndex[].capDelta` | `result.summaryByTeamIndex[].capDelta` | ✅ YES |
| Player salary | `baseSalary` (not matching)            | `baseSalary` (not matching)            | ✅ YES |
| Entitlements  | `teams[].entitlementsOut`              | `teams[].entitlementsOut`              | ✅ YES |
| Legal status  | `result.legal`                         | `result.legal`                         | ✅ YES |

### Displayed But Not Validated Values

**None found.** All displayed numeric values trace back to validator output or are clearly labeled as estimates.

---

## 6. Files Referenced (10 total)

1. `src/features/architect/tradeMachine/TradeSummaryPanel.jsx`
2. `src/features/architect/tradeMachine/TradeTeamCard.jsx`
3. `src/features/architect/tradeMachine/CapImpactTiles.jsx`
4. `src/features/architect/tradeMachine/TradeExportCapture.jsx`
5. `src/features/architect/tradeMachine/TradeReceiptPanel.jsx`
6. `src/features/architect/tradeMachine/utils/getOfficialSalaryMatchingSnapshot.js`
7. `src/features/architect/hooks/useTradeMachineSnapshot.js`
8. `src/features/architect/utils/tradeMachine/engine/tradeValidator.js`
9. `src/features/architect/utils/capTotals.js`
10. `src/features/architect/utils/tradeHelpers.js`

---

## 7. Summary

| Section                         | Items | Implemented | Validated | Single Source | Risk    | Verdict |
| ------------------------------- | ----- | ----------- | --------- | ------------- | ------- | ------- |
| **Section 10** (UI Numbers)     | 6/6   | 6/6         | 6/6       | 6/6           | ALL LOW | ✅ PASS |
| **Section 11** (Summary/Export) | 6/6   | 6/6         | 6/6       | 6/6           | ALL LOW | ✅ PASS |

### Key Strengths

1. **Single canonical selector** (`getOfficialSalaryMatchingSnapshot`) used consistently
2. **Divergence guardrails** (`warnOnTotalsDivergence()`) detect drift in DEV mode
3. **Estimate indicators** clearly shown when validation hasn't run
4. **Loading states** shown during validation in-flight
5. **Export disclaimer** documents BASE vs MATCHING difference

### No FAIL/HIGH Items

All items in Sections 10 and 11 pass. No evidence entries required (FAIL/HIGH only).
