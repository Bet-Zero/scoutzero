# Trade Machine UI Wiring Audit — Reconciled Plan

**Date:** 2025-12-28  
**Status:** Reconciled Expert Review — Final Plan  
**Scope:** All numeric values displayed in the Trade Machine UI  
**Version:** 2.0.0 (incorporates second expert review)

---

## Executive Summary

This document reconciles the original Trade Machine UI Wiring Audit with a second expert review. The goal is to produce **ONE final, high-confidence plan** that addresses:

1. **Single Source of Truth**: All legality-affecting numbers must come from the validator
2. **UX Accuracy**: Clear distinction between matching values and base salaries
3. **Snapshot Discipline**: Thin snapshot derived from existing validator outputs
4. **Phased Implementation**: Legality correctness first, then UX clarity, then cleanup

---

## 1. Reconciliation Principle Evaluations

### 1.1 Validator Authority (Non-Negotiable)

**Principle:** Any number that affects trade legality must come DIRECTLY from validator output. UI calling `getSalaryMatchingResult()` or other rule helpers is NOT acceptable as final state.

**Original Audit Position:** Marked several items as "✅ USES UNIFIED RULES" when they called `getSalaryMatchingResult()` directly in UI.

**Second Expert Position:** This is still recomputation, even if using the same rules. The validator has already evaluated this; UI should consume that evaluation.

**AGREED — Reclassification Required**

The second expert is correct. While `getSalaryMatchingResult()` uses unified rules, calling it from UI:
- Creates a second code path that could diverge if parameters differ slightly
- Requires UI to have all the same inputs as the validator (which could drift)
- Defeats the purpose of single-source-of-truth architecture

**Updated Status for Affected Items:**

| Original Status | Item | Revised Status |
|-----------------|------|----------------|
| ✅ USES UNIFIED RULES | TradeTeamCard `allowableIncoming` (L148-163) | ⚠️ **SHOULD USE VALIDATOR OUTPUT** |
| ✅ USES UNIFIED RULES | TradeSalaryCalculator `breakdown` (L73) | ⚠️ **SHOULD USE VALIDATOR OUTPUT** |
| ✅ CORRECT | TradeTeamCard `salaryMatchingResult.ruleLabel` | ⚠️ **SHOULD USE VALIDATOR OUTPUT** |

**Rationale:** Even though these use unified rules, they represent a separate computation that must be aligned with the validator's actual evaluation for consistency. The validator already computes these values; we should consume them rather than recompute.

---

### 1.2 Allowable Incoming Is a "Golden Number"

**Principle:** "Allowable Incoming" must have exactly ONE authoritative value per team per trade state, sourced from the validator's evaluated result.

**Original Audit Position:** Proposed wiring `allowableIncoming` from validator but retained `getSalaryMatchingResult()` as a parallel path.

**Second Expert Position:** There should be NO parallel computation. Validator owns this number.

**AGREED — No Parallel Computation**

The original audit's Step 4 (§6) proposed:
```javascript
const allowableIncomingNoTPE = teamSnapshot?.allowableIncoming ?? 0;
```

This is correct, but the audit should also explicitly state: **Remove the `getSalaryMatchingResult()` call entirely from TradeTeamCard.jsx** once snapshot wiring is complete.

**Implementation Note:** During transition, the existing `getSalaryMatchingResult()` call can remain as a DEV-only divergence check (already patterned in the codebase at TradeTeamCard L94-111), but must not be used for display values.

---

### 1.3 Matching Values vs Base Salaries (UX Accuracy)

**Principle:** Matching values (BYC, poison pill, trade kicker adjustments) are legality concepts. Base salary is roster reality. UI may display BOTH, but must NEVER silently replace base salary with matching salary without labeling.

**Original Audit Position:** Proposed `outgoingMatchingSalary` and `incomingMatchingSalary` as primary values in snapshot, with base salaries also available.

**Second Expert Position:** This is correct, but exports and player lists must not show matching values labeled as "salary."

**AGREED — With Clarification**

The original audit's snapshot schema (§6.1) correctly includes both:
- `outgoingBaseSalary` / `incomingBaseSalary` — roster reality
- `outgoingMatchingSalary` / `incomingMatchingSalary` — legality values

**Clarification Needed:** The audit should specify WHERE each is displayed:

| Display Context | Value to Use | Label |
|-----------------|--------------|-------|
| Trade legality summary | `matchingSalary` | "Matching Value" or "Trade Value" |
| Player salary display | `baseSalary` | "Salary" or "Cap Hit" |
| Export/download | `baseSalary` | "Salary" — matching value only if explicitly requested |
| Salary matching breakdown | Both | Show calculation: "Base: $X → Match: $Y" |

**TradeExportCapture.jsx Correction:**

The original audit (Step 7) proposed:
```javascript
const salary = p.matchIncoming ?? p.matchOutgoing ?? getSalaryForYear([p], yearKey);
```

**This is incorrect.** For exports, we should default to base salary:
```javascript
const salary = p.baseSalary ?? getSalaryForYear([p], yearKey);
// If user requests "show matching values," then use p.matchingValue
```

---

### 1.4 Snapshot Scope Discipline

**Principle:** The `tradeSnapshot` should be THIN and derived from existing validator outputs. Avoid duplicating logic already in `teamResults`, `salaryMatchingEvaluation`, or receipt data.

**Original Audit Position:** Proposed a fairly comprehensive snapshot schema with ~25 fields per team.

**Second Expert Position:** Many of these fields may already exist in existing structures and would be duplication.

**PARTIALLY AGREED — Refine Snapshot Shape**

After reviewing the existing validator output structure, the snapshot should be **a facade over existing data**, not a new parallel structure.

**Existing Validator Outputs (from `generateTradeReceipt`):**

```typescript
// result.teamResults[i] shape:
interface TeamResult {
  teamId: string;
  teamName: string;
  preTradeTeamSalary: number;
  postTradeSalary: number;
  totals: {
    outgoingBase: number;
    outgoingMatch: number;
    incomingBase: number;
    incomingMatch: number;
  };
  salaryMatchingEvaluation: {
    allowable: number;
    actual: number;
    margin: number;
    rule: string;
    passed: boolean;
  };
  rules: {
    salaryMatching: SalaryMatchingRule;
    hardCap: HardCapRule;
    // ... other rules
  };
}
```

**Revised Snapshot Strategy — Thin Accessor Layer:**

Instead of creating a new `tradeSnapshot` object with duplicated fields, create a **thin accessor hook**:

```javascript
// useTradeMachineSnapshot.js
export function useTeamSnapshot(teamId, result) {
  const teamResult = result?.teamResults?.find(t => t.teamId === teamId);
  const receipt = result?.receipt?.teams?.find(t => t.teamCode === teamId);
  
  if (!teamResult) return null;
  
  return {
    // Derived from existing teamResult — no new computation
    get preTradeTeamSalary() { return teamResult.preTradeTeamSalary; },
    get outgoingBaseSalary() { return receipt?.totals?.outgoingBase ?? teamResult.totals?.outgoingBase; },
    get outgoingMatchingSalary() { return receipt?.totals?.outgoingMatch ?? teamResult.salaryOut; },
    get incomingBaseSalary() { return receipt?.totals?.incomingBase; },
    get incomingMatchingSalary() { return receipt?.totals?.incomingMatch ?? teamResult.salaryIn; },
    get allowableIncoming() { return teamResult.rules?.salaryMatching?.allowableIncoming; },
    get salaryMatchingRule() { return teamResult.rules?.salaryMatching?.details?.ruleApplied; },
    get margin() { return teamResult.rules?.salaryMatching?.margin; },
    get projectedSalary() { return teamResult.postTradeSalary; },
    // ... other getters as needed
  };
}
```

**Benefit:** No new object shape to maintain; getters derive from existing structures.

**Deferred Fields (Not in Phase 1/2):**

The following fields from the original snapshot proposal should be deferred or removed as they require new computation:

| Field | Issue | Recommendation |
|-------|-------|----------------|
| `capSpace` | Derived from `salaryCap - projectedSalary` | Keep as computed in accessor, but document definition |
| `firstApronSpace` | Derived | Same |
| `secondApronSpace` | Derived | Same |
| `isHardCapped` | Already in `teamResult.rules.hardCap.triggered` | Use existing |
| `violations[]` | Already in `result.allViolations` | Use existing |
| `warnings[]` | Not currently computed by validator | Defer to Phase 3 |

---

### 1.5 Cap / Apron Numbers Must Match Definitions

**Principle:** Any "projected salary," "cap space," or "apron space" must be tied to a clearly defined concept (players only? + dead money? + cap holds? + likely incentives?).

**Original Audit Position:** Did not explicitly define what `projectedSalary` includes.

**Second Expert Position:** This ambiguity is a risk. Must document what's included.

**AGREED — Definition Required**

**Proposed Definitions:**

| Field | Definition | Includes |
|-------|------------|----------|
| `preTradeTeamSalary` | Team's total salary obligations before trade executes | Players + Dead Money + Cap Holds (unsigned) |
| `postTradeSalary` (aka `projectedSalary`) | Team's total salary obligations after trade executes | `preTradeTeamSalary - outgoingBase + incomingBase` + TPE usage adjustments |
| `capSpace` | Room under the salary cap | `salaryCap - projectedSalary` |
| `apronSpace` | Room under the specified apron | `apron - projectedSalary` |

**Current Implementation Check:**

Looking at `tradeValidator.js` and `CapImpactTiles.jsx`:

1. **CapImpactTiles** computes `projectedTotal = salaryTotal + capHoldsTotal` (L62-63)
2. **Validator** uses `teamTotalSalary` which is computed in `useTradeMachine.js` via `payrollForYearFromCapSheet` + `deadMoneyForYear` (L225-235)

**Gap Identified:** CapImpactTiles includes cap holds, but the validator's `teamTotalSalary` may not consistently include them depending on data source.

**Action Item (Phase 1):** Verify that `teamTotalSalary` fed to validator includes the same components (players + dead money + cap holds) as `projectedTotal` in CapImpactTiles. Add explicit documentation to both.

---

### 1.6 Priority Order Refinement

**Principle:** Phase 1 should make UI incapable of lying about legality. Phase 2 improves UX. The original audit's fix order mixed these concerns.

**Original Audit Position:** Single "Fix Order" with Priority 1/2/3 loosely by impact.

**Second Expert Position:** Strict separation: first legality cannot lie, then UX improvements.

**AGREED — Reorganized Fix Order**

See Section 4 for the reorganized phased implementation plan.

---

## 2. Disagreements & Open Questions

### 2.1 Active Disagreements

| # | Topic | Original Audit Position | Second Expert Position | This Document's Position | Resolution Needed |
|---|-------|------------------------|----------------------|--------------------------|-------------------|
| **D1** | Snapshot as new object vs accessor layer | Create `tradeSnapshot` object attached to `result` | N/A (no explicit position) | **Accessor layer preferred** — less duplication, easier maintenance | Confirm accessor approach meets performance needs |
| **D2** | TradeExportCapture player salaries | Use matching values with fallback | Show base salary by default | **Show base salary by default** — matching only if explicitly labeled | Confirm UX preference with stakeholders |

### 2.2 Open Questions Requiring Decision

| # | Question | Options | Recommendation |
|---|----------|---------|----------------|
| **Q1** | Should `TradeSalaryCalculator` show its own breakdown or consume validator's? | A) Keep local calculation for interactive preview<br>B) Always show validator result | **Option A for now** — The calculator is exploratory/educational; validator is authoritative for final trade. Add disclaimer. |
| **Q2** | How to handle pre-validation state (before validator has run)? | A) Show "—" or loading state<br>B) Show local calculation with "unvalidated" warning | **Option B** — Better UX, but must clearly indicate values are preliminary |
| **Q3** | Should cap holds be explicitly separated in UI? | A) Lump into "Total Salary"<br>B) Show "Salary: $X + Holds: $Y = $Z" | **Option B preferred** for clarity, but defer to Phase 2 |
| **Q4** | What happens when validator has no result but UI needs to display? | A) Blank/loading<br>B) Fallback to local calculation | **Option B** with warning — but local calc should be clearly marked as "estimate" |

### 2.3 Questions for Stakeholder Resolution

1. **Export Format Preference:** When exporting trade images, should player salaries show:
   - Base salary (roster reality)?
   - Matching value (trade legality)?
   - Both with labels?

2. **Calculator Behavior:** Should `TradeSalaryCalculator` be locked to validator output or remain interactive for exploration?

3. **Divergence Warnings:** Should DEV-only divergence warnings be logged to console, shown in UI, or both?

---

## 3. Updated Audit Map

### 3.1 Reclassified Items

Based on Principle 1.1, the following items are reclassified:

| Component | Line | Original Status | Revised Status | Reason |
|-----------|------|-----------------|----------------|--------|
| TradeTeamCard | 148-163 | ✅ USES UNIFIED RULES | ⚠️ **RECOMPUTATION** | Calls `getSalaryMatchingResult()` instead of consuming validator output |
| TradeTeamCard | 334-341 | ✅ CORRECT | ⚠️ **SHOULD USE VALIDATOR** | `ruleLabel` should come from `teamResult.rules.salaryMatching.details.ruleApplied` |
| TradeSalaryCalculator | 73 | ✅ USES UNIFIED RULES | ℹ️ **EXPLORATORY** | Keep for interactive preview, but add disclaimer |
| TradeSalaryCalculator | 117-125 | ✅ CORRECT | ℹ️ **EXPLORATORY** | Same as above |

### 3.2 Complete Status Summary

| Status | Count | Items |
|--------|-------|-------|
| ✅ CORRECT | 17 | TradeReceiptPanel (all), TradeSummaryPanel (most), TPE amounts, cap settings |
| ⚠️ RECOMPUTATION | 8 | TradeTeamCard (outgoing/incoming/allowable), CapImpactTiles (projected/cap/apron), useTradeMachine (salaryOut), TradeExportCapture (player salary) |
| ℹ️ EXPLORATORY | 2 | TradeSalaryCalculator breakdown (acceptable as interactive tool) |
| ℹ️ PURE DISPLAY | 2 | Player count, picks count |

---

## 4. Reorganized Fix Order

### Phase 1: Legality Correctness (UI Cannot Lie)

**Goal:** Any number affecting trade legality MUST come from validator. No UI recomputation of legality-critical values.

| Order | Task | Files | Acceptance Criteria |
|-------|------|-------|---------------------|
| **1.1** | Wire `outgoingSalary` from validator | `TradeTeamCard.jsx` | Display uses `teamResult.salaryOut` or `teamResult.totals.outgoingMatch` |
| **1.2** | Wire `incomingSalary` from validator | `TradeTeamCard.jsx` | Display uses `teamResult.salaryIn` or `teamResult.totals.incomingMatch` |
| **1.3** | Wire `allowableIncoming` from validator | `TradeTeamCard.jsx` | Display uses `teamResult.rules.salaryMatching.allowableIncoming`, NOT `getSalaryMatchingResult()` |
| **1.4** | Wire salary matching rule/label from validator | `TradeTeamCard.jsx` | Label uses `teamResult.rules.salaryMatching.details.ruleApplied` |
| **1.5** | Remove `salaryOut` recomputation in hook | `useTradeMachine.js` | Hook exposes `teamResult.salaryOut`, not `getSalaryForYear(sends)` |
| **1.6** | Wire `projectedSalary` from validator | `CapImpactTiles.jsx` | Display uses `teamResult.postTradeSalary` |
| **1.7** | Document `projectedSalary` definition | Validator + UI docs | Clear definition of what's included (players + dead + holds) |
| **1.8** | Add DEV-only divergence warnings | `TradeTeamCard.jsx`, `CapImpactTiles.jsx` | Console warnings when local calc would differ from validator |

**Phase 1 Definition of Done:**
- [ ] All legality-affecting numbers in UI come from validator `result` object
- [ ] No `getSalaryMatchingResult()` call in UI for display values
- [ ] No `getSalaryForYear()` call in UI for totals used in trade matching
- [ ] DEV divergence warnings active for removed calculations

### Phase 2: UX Clarity (Base vs Matching, Labels)

**Goal:** User can clearly distinguish between base salary (roster) and matching value (trade legality).

| Order | Task | Files | Acceptance Criteria |
|-------|------|-------|---------------------|
| **2.1** | Expose both base and matching in accessor | `useTradeMachineSnapshot.js` (new) | Accessor provides `outgoingBaseSalary` and `outgoingMatchingSalary` distinctly |
| **2.2** | Update TradeExportCapture to use base salary | `TradeExportCapture.jsx` | Player salaries show base salary, not matching |
| **2.3** | Add "Matching Value" label where appropriate | `TradeTeamCard.jsx` | If showing matching value, UI says "Trade Value" or similar |
| **2.4** | Show BYC/Poison Pill indicators | `TradeTeamCard.jsx`, Player rows | Visual indicator when player has matching adjustment |
| **2.5** | Add cap holds breakdown | `CapImpactTiles.jsx` | Show "Salary: $X + Holds: $Y" if significant |
| **2.6** | Add disclaimer to TradeSalaryCalculator | `TradeSalaryCalculator.jsx` | Text: "This is an exploratory tool. Final trade uses validator calculations." |

**Phase 2 Definition of Done:**
- [ ] User can distinguish base salary from matching value in all displays
- [ ] Exports show base salary by default
- [ ] Cap hold component of "Total Salary" is visible when non-zero
- [ ] Interactive calculator has disclaimer

### Phase 3: Cleanup & Consistency

**Goal:** Remove cruft, consolidate utilities, ensure consistency.

| Order | Task | Files | Acceptance Criteria |
|-------|------|-------|---------------------|
| **3.1** | Consolidate `toSeasonKey` usages | `useTradeMachine.js`, `seasonUtils.js` | Single import, no local definitions |
| **3.2** | Standardize formatting functions | Various | Document which function for which context |
| **3.3** | Remove DEV-only divergence code (optional) | Various | Once confident, can remove the console.warn checks |
| **3.4** | Add integration tests for snapshot wiring | `tests/tradeSnapshotWiring.test.js` | Tests verify UI values match validator values |
| **3.5** | Archive/remove `getSalaryMatchingResult` UI calls | `TradeTeamCard.jsx` | Once Phase 1 complete, remove dead code |

**Phase 3 Definition of Done:**
- [ ] No duplicate utility definitions
- [ ] Consistent formatting throughout
- [ ] Test coverage for snapshot wiring
- [ ] No dead code from migration

---

## 5. Implementation Architecture

### 5.1 Accessor Layer (Recommended Over Flat Snapshot)

Rather than generating a new `tradeSnapshot` object, create an accessor hook:

```javascript
// src/features/architect/hooks/useTradeMachineSnapshot.js

/**
 * Thin accessor layer over validator result for UI consumption.
 * Does NOT recompute values — only provides structured access to existing data.
 */
export function useTeamSnapshot(teamId, result) {
  if (!result || !teamId) return null;
  
  const teamResult = result.teamResults?.find(
    (t) => t.teamId === teamId || t.teamCode === teamId
  );
  
  if (!teamResult) return null;
  
  // Receipt may have additional detail if available
  const receiptTeam = result.receipt?.teams?.find(
    (t) => t.teamCode === teamId
  );
  
  return {
    // Identity
    teamId: teamResult.teamId,
    teamName: teamResult.teamName,
    
    // Pre-trade (from validator)
    preTradeTeamSalary: teamResult.preTradeTeamSalary,
    
    // Outgoing — prefer receipt totals if available
    outgoingBaseSalary: receiptTeam?.totals?.outgoingBase ?? teamResult.totals?.outgoingBase ?? 0,
    outgoingMatchingSalary: receiptTeam?.totals?.outgoingMatch ?? teamResult.salaryOut ?? 0,
    
    // Incoming
    incomingBaseSalary: receiptTeam?.totals?.incomingBase ?? teamResult.totals?.incomingBase ?? 0,
    incomingMatchingSalary: receiptTeam?.totals?.incomingMatch ?? teamResult.salaryIn ?? 0,
    
    // Salary matching evaluation
    allowableIncoming: teamResult.rules?.salaryMatching?.allowableIncoming ?? 0,
    salaryMatchingRule: teamResult.rules?.salaryMatching?.details?.ruleApplied ?? 'unknown',
    salaryMatchingFormula: teamResult.rules?.salaryMatching?.details?.formula ?? '',
    margin: teamResult.rules?.salaryMatching?.margin ?? 0,
    salaryMatchingPassed: teamResult.rules?.salaryMatching?.passed ?? false,
    
    // Post-trade projections
    projectedSalary: teamResult.postTradeSalary ?? 0,
    
    // Status flags (from existing rule evaluations)
    isOverCap: teamResult.isOverCap ?? false,
    isAboveFirstApron: teamResult.isFirstApron ?? false,
    isAboveSecondApron: teamResult.isSecondApron ?? false,
    isHardCapped: teamResult.rules?.hardCap?.triggered ?? false,
    
    // Violations (from existing)
    violations: teamResult.violations ?? [],
  };
}

/**
 * Global trade snapshot accessor
 */
export function useTradeSnapshot(result) {
  if (!result) return null;
  
  return {
    isLegal: result.isLegal ?? false,
    primaryViolation: result.reason ?? null,
    yearKey: result.yearKey,
    seasonKey: result.seasonKey,
    capSettings: result.receipt?.capSettingsUsed ?? null,
  };
}
```

### 5.2 Updated Hook Export

```javascript
// In useTradeMachine.js — add to return object
return {
  teams,
  result,
  // ... existing exports
  
  // Phase 1 addition: expose result for snapshot accessor
  // UI components use: const snapshot = useTeamSnapshot(teamId, result);
};
```

### 5.3 Component Migration Pattern

```javascript
// TradeTeamCard.jsx — Phase 1 migration

// BEFORE (recomputation):
const outgoingSalary = useMemo(
  () => getSalaryForYear(sends, yearKey),
  [sends, yearKey]
);

// AFTER (snapshot consumption):
import { useTeamSnapshot } from '@/features/architect/hooks/useTradeMachineSnapshot';

// In component:
const snapshot = useTeamSnapshot(team?.id, result);
const outgoingSalary = snapshot?.outgoingMatchingSalary ?? 0;

// DEV-only divergence check (temporary):
if (import.meta.env.DEV && snapshot) {
  const localCalc = getSalaryForYear(sends, yearKey);
  if (Math.abs(localCalc - outgoingSalary) > 1) {
    console.warn('[TradeTeamCard] outgoingSalary DIVERGENCE', {
      local: localCalc,
      snapshot: outgoingSalary,
      diff: localCalc - outgoingSalary,
    });
  }
}
```

---

## 6. Risk Mitigation

### 6.1 Gradual Rollout

1. **Phase 1.1-1.4** — Wire TradeTeamCard first (highest visibility)
2. **Phase 1.5** — Wire hook exposure
3. **Phase 1.6-1.7** — Wire CapImpactTiles
4. **Phase 1.8** — Add divergence warnings throughout

### 6.2 Fallback Strategy

If snapshot accessor returns `null` (no result yet), components should:
1. Show loading state OR
2. Use local calculation with visual indicator "Pending validation..."

### 6.3 Testing Strategy

1. **Unit Tests:** Verify accessor extracts correct paths from result
2. **Integration Tests:** Verify UI displays match validator internals
3. **Divergence Tests:** Verify DEV warnings fire when expected

---

## 7. Summary

### What We Agree On

| Principle | Status |
|-----------|--------|
| Validator authority for legality numbers | ✅ Agreed |
| Allowable incoming is a golden number | ✅ Agreed |
| Base vs matching salary distinction | ✅ Agreed |
| Thin snapshot / accessor layer | ✅ Agreed (refined to accessor) |
| Cap number definitions required | ✅ Agreed |
| Phased implementation | ✅ Agreed (reorganized) |

### What We Refined

| Topic | Original | Refined |
|-------|----------|---------|
| Snapshot implementation | New `tradeSnapshot` object | Accessor hook over existing data |
| TradeExportCapture | Use matching values | Use base salary by default |
| "Unified rules" status | Marked as correct | Reclassified as recomputation |
| Fix order | Mixed concerns | Strict phase separation |

### Remaining Open Questions

1. TradeSalaryCalculator behavior (interactive vs locked)
2. Export salary preference (stakeholder decision)
3. Pre-validation display strategy

---

## Appendix A: Validator Output Reference

Key paths in `result` object for UI consumption:

```typescript
// Validator result shape
interface TradeValidatorResult {
  isLegal: boolean;
  reason: string | null;
  yearKey: number;
  seasonKey: string;
  
  teamResults: Array<{
    teamId: string;
    teamName: string;
    preTradeTeamSalary: number;
    postTradeSalary: number;
    salaryIn: number;      // Incoming with matching adjustments
    salaryOut: number;     // Outgoing with matching adjustments
    totals: {
      outgoingBase: number;
      outgoingMatch: number;
      incomingBase: number;
      incomingMatch: number;
    };
    rules: {
      salaryMatching: {
        passed: boolean;
        allowableIncoming: number;
        margin: number;
        details: {
          ruleApplied: string;
          formula: string;
        };
      };
      hardCap: {
        passed: boolean;
        triggered: boolean;
        // ... other fields
      };
      // ... other rules
    };
    violations: string[];
  }>;
  
  receipt: {
    capSettingsUsed: {
      salaryCap: number;
      firstApron: number;
      secondApron: number;
      // ... other settings
    };
    teams: Array<{
      // ... detailed receipt data
    }>;
  };
}
}
```

---

## Appendix B: Glossary Updates

| Term | Definition |
|------|------------|
| **Validator Authority** | The principle that any value affecting trade legality must come from validator output, not UI recomputation |
| **Golden Number** | A value with exactly one authoritative source; no parallel computations allowed |
| **Accessor Layer** | A thin hook/utility that provides structured access to existing data without recomputation |
| **Base Salary** | The actual salary cap hit for a player — roster reality |
| **Matching Value** | The adjusted salary used for trade matching calculations (may include BYC, poison pill, kicker adjustments) |
| **Divergence Warning** | A DEV-only console log that fires when UI would have calculated a different value than the validator |

---

## Document History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2025-12-28 | Original audit |
| 2.0.0 | 2025-12-28 | Reconciled with second expert review; reclassified items; reorganized phases; added accessor layer approach |
