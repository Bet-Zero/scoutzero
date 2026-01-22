# PST Phase 11.2 — Entitlement Trade UX + Warnings Preflight Return Package

**DATE**: 2026-01-22  
**STATUS**: PREFLIGHT COMPLETE  
**GOAL**: Add Outgoing Entitlements display to Trade Summary + non-blocking warnings for encumbered picks and first-round entitlements.

---

## 1. Current Trade Summary Surface Analysis

### 1.1 Primary Component: TradeSummaryPanel

**File**: [src/features/architect/tradeMachine/TradeSummaryPanel.jsx](src/features/architect/tradeMachine/TradeSummaryPanel.jsx)

**Purpose**: Renders the validation summary after trade validation, showing per-team cards with:

- Legal/illegal status banner
- Salary matching values (Matching In / Allowed)
- Players Received section
- Picks Received section

**Current Props**:

```javascript
{
  result,           // Validator result object
  teams = [],       // Array of team slot objects from TradeEditor
  forceTrade = false,
  showRuleExplanations = true,
  isValidating = false,
}
```

**Data Sources**:

- `result.summaryByTeamIndex[]` - per-team summary from validator
- `result.teamResults[]` - detailed per-team validation results
- `teamResult.incomingPlayers` / `teamResult.picksIn` - incoming assets

**Key Observation**: Currently shows **incoming** assets only. Does NOT show outgoing assets (players/picks/entitlements).

### 1.2 Parent Component: ValidationDetailsPanel

**File**: [src/features/architect/tradeMachine/ValidationDetailsPanel.jsx](src/features/architect/tradeMachine/ValidationDetailsPanel.jsx)

**Purpose**: Collapsible panel containing TradeSummaryPanel plus other validation sections.

**Sections**:

1. Validation Summary (Official) → `TradeSummaryPanel`
2. Rule Compliance Overview (Official) → `TradeLegalChecker`
3. Trade Exception Analysis (Official) → `TradeExceptionDashboard` + `FaExceptionTracker`
4. Salary Calculator (Exploratory) → `TradeSalaryCalculator`
5. Trade Receipt (Debug) → `TradeReceiptPanel`

### 1.3 Trade Data Export (useTradeMachine)

**File**: [src/features/architect/hooks/useTradeMachine.js](src/features/architect/hooks/useTradeMachine.js)

**`exportCurrentTrade()` returns**:

```javascript
{
  teamId,
  outgoingPlayers: t.sends,
  outgoingPicks: t.picksOut,
  outgoingEntitlements: t.entitlementsOut || [],  // ← ALREADY INCLUDED
  incomingPlayers: [...],
  incomingPicks: [...],
  usedTradeExceptions: [...],
}
```

**`t.entitlementsOut` shape** (array of entitlement objects):

```typescript
{
  id: string,
  entitlementId?: string,  // same as id
  kind: 'pick_ownership' | 'conveyance_right' | 'swap_right',
  seasonYear: number,
  round: number,
  description: string,
  underlyingPickId?: string,
  underlyingStatus?: 'pooled' | 'encumbered' | 'clean',
  coveredByEntitlementIds?: string[],  // ← CRITICAL for warning logic
}
```

---

## 2. Proposed UI Location for Outgoing Entitlements

### 2.1 Option Analysis

| Option | Component                                          | Pros                                 | Cons                                          |
| ------ | -------------------------------------------------- | ------------------------------------ | --------------------------------------------- |
| A      | TradeSummaryPanel (per-team card)                  | Consistent with existing structure   | Need to pass entitlementsOut from TradeEditor |
| B      | TradeTeamCard (existing Outgoing section)          | Already shows outgoing players/picks | Not visible post-validation                   |
| C      | New EntitlementSummarySection in TradeSummaryPanel | Clean separation                     | More changes                                  |

### 2.2 Recommended: Option A — Extend TradeSummaryPanel

**Rationale**:

- Matches existing pattern of showing assets per team
- TradeSummaryPanel already receives `teams[]` from ValidationDetailsPanel
- Can add `entitlementsOut` to the data flow

**Insertion Point**: After "Picks Received" section in each team card, add "Entitlements Traded" section.

**Data Flow**:

```
TradeEditor
  → teams[].entitlementsOut
    → ValidationDetailsPanel (receives teams)
      → TradeSummaryPanel (receives teams)
        → per-team card: extract t.entitlementsOut for matching teamId
```

**Note**: Currently TradeSummaryPanel uses `result.summaryByTeamIndex` and `result.teamResults` from validator. We need to cross-reference with `teams[]` prop to get `entitlementsOut` for each team.

---

## 3. Warning Rules and Messages (Deterministic)

### 3.1 Warning A: Encumbered Pick Ownership Without Linked Swap Right

**Trigger Logic** (pseudo):

```
FOR each outgoing entitlement e in team.entitlementsOut:
  IF e.kind === 'pick_ownership'
     AND e.underlyingStatus === 'encumbered':

    # Option 1: Use coveredByEntitlementIds if available
    IF e.coveredByEntitlementIds exists AND length > 0:
      linkedSwapRights = e.coveredByEntitlementIds.filter(
        id => team.entitlementsOut.some(oe => oe.id === id AND oe.kind === 'swap_right')
      )
      IF linkedSwapRights.length === 0:
        EMIT WARNING
    ELSE:
      # Option 2: Fallback - always warn for encumbered pick_ownership
      EMIT WARNING
```

**Warning Message**:

```
"⚠️ Encumbered pick traded without linked swap right. Recipient may not receive expected value."
```

**Secondary (more specific if coveredByEntitlementIds available)**:

```
"⚠️ {YEAR} Round {ROUND} pick is encumbered. Consider also trading the associated swap right."
```

### 3.2 Warning B: First-Round Entitlement Traded (Stepien Not Enforced)

**Trigger Logic** (pseudo):

```
FOR each outgoing entitlement e in team.entitlementsOut:
  IF e.round === 1
     AND e.kind IN ('pick_ownership', 'conveyance_right', 'swap_right'):
    EMIT WARNING
```

**Warning Message**:

```
"⚠️ First-round entitlement traded. Stepien Rule not yet enforced for entitlements."
```

### 3.3 Warning Display

Warnings are **advisory only** — they do NOT block trades.

**Display Location**: Inside each team card in TradeSummaryPanel, below the "Entitlements Traded" list.

**Visual Style**:

```jsx
<div className="mt-2 p-2 bg-amber-900/20 border border-amber-500/30 rounded text-xs text-amber-300">
  <div className="flex items-center gap-1 mb-1 font-medium">
    <AlertTriangle size={12} />
    <span>Entitlement Warnings</span>
  </div>
  <ul className="list-disc list-inside space-y-0.5">
    {warnings.map((w, i) => (
      <li key={i}>{w}</li>
    ))}
  </ul>
</div>
```

---

## 4. Current Error/Warning Display Patterns

### 4.1 Errors (Blocking)

**Location**: TradeSummaryPanel, lines 56-67

```jsx
{
  showRuleExplanations && result?.failures?.length > 0 && (
    <div className="bg-[#121212] border border-red-500/30 rounded p-3">
      <div className="font-semibold mb-2">Why it fails</div>
      <ul className="list-disc list-inside space-y-1">
        {result.failures.map((f, idx) => (
          <li key={idx} className="text-red-300">
            {f.message || f.reason || String(f)}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

**Pattern**: Red border, "Why it fails" header, list of failure messages.

### 4.2 Warnings (Non-Blocking)

**Current State**: No dedicated warnings channel exists in TradeSummaryPanel.

**Existing Warning Patterns Elsewhere**:

- `EntitlementPickRow.jsx` shows amber AlertTriangle icon for encumbered status
- Validator result has no `warnings[]` array currently

**Recommended Approach**:

- Do NOT add warnings to validator result (that's for legality)
- Compute warnings client-side in TradeSummaryPanel or a small helper
- Display in amber styling (distinct from red errors)

---

## 5. Minimal File List for Execution

| File                                                               | Change Type | Description                                                   |
| ------------------------------------------------------------------ | ----------- | ------------------------------------------------------------- |
| `src/features/architect/tradeMachine/TradeSummaryPanel.jsx`        | MODIFY      | Add Entitlements Traded section + warning computation/display |
| `src/features/architect/tradeMachine/utils/entitlementWarnings.js` | CREATE      | Helper to compute entitlement warnings from entitlementsOut   |
| `docs/team-scrape/PST_PICK_LEDGER_MASTER_PLAN.md`                  | UPDATE      | Mark Phase 11.2 as COMPLETE                                   |

**Optional (if data flow issue)**:

| File                                                             | Change Type | Description                                          |
| ---------------------------------------------------------------- | ----------- | ---------------------------------------------------- |
| `src/features/architect/tradeMachine/ValidationDetailsPanel.jsx` | MODIFY      | Pass teams prop more explicitly to TradeSummaryPanel |

**Total Files**: 2-3 files (minimal)

---

## 6. Acceptance Criteria for Phase 11.2 Execution

### 6.1 Outgoing Entitlements Display

- [ ] Each team card in TradeSummaryPanel shows "Entitlements Traded" section
- [ ] Lists all entitlements from `entitlementsOut` for that team
- [ ] Shows kind badge (pick_ownership/conveyance_right/swap_right)
- [ ] Shows year and round
- [ ] Empty state: "None" or hidden section

### 6.2 Warning A: Encumbered Pick Without Swap

- [ ] Warning appears when trading `pick_ownership` with `underlyingStatus='encumbered'`
- [ ] Warning does NOT appear if linked `swap_right` is also being traded (via coveredByEntitlementIds check)
- [ ] Fallback: if no coveredByEntitlementIds, always warn for encumbered pick_ownership
- [ ] Warning text is clear and actionable

### 6.3 Warning B: First-Round Stepien Advisory

- [ ] Warning appears for any round=1 entitlement (pick_ownership, conveyance_right, swap_right)
- [ ] Warning text clearly states "Stepien Rule not yet enforced for entitlements"

### 6.4 Non-Blocking Behavior

- [ ] Warnings displayed in amber styling (NOT red)
- [ ] Trades can still be applied with warnings present
- [ ] No new validation failures added

### 6.5 UX Quality

- [ ] Warnings appear inside team card, near entitlements section
- [ ] Multiple warnings stack cleanly
- [ ] Warnings use AlertTriangle icon for consistency with EntitlementPickRow

---

## 7. Validation Plan

### 7.1 Manual Test Cases

| Test Case                       | Setup                                                   | Expected                   |
| ------------------------------- | ------------------------------------------------------- | -------------------------- |
| TC1: Encumbered pick only       | Trade team's encumbered pick_ownership                  | Warning A appears          |
| TC2: Encumbered + swap together | Trade encumbered pick_ownership + its linked swap_right | No Warning A               |
| TC3: First-round pick           | Trade any round=1 pick_ownership                        | Warning B appears          |
| TC4: First-round swap           | Trade any round=1 swap_right                            | Warning B appears          |
| TC5: Second-round clean         | Trade round=2 clean pick_ownership                      | No warnings                |
| TC6: Multiple warnings          | Encumbered + first-round                                | Both warnings appear       |
| TC7: Trade still works          | Apply trade with warnings                               | Trade applies successfully |

### 7.2 Regression Checks

- [ ] Existing TradeSummaryPanel functionality unchanged
- [ ] Players Received / Picks Received still display correctly
- [ ] Salary matching values unchanged
- [ ] Force Trade still works

---

## 8. Stop Conditions / Blockers

### 8.1 Stop if

- `teams[]` prop in TradeSummaryPanel doesn't contain `entitlementsOut`
- Cross-referencing teamId between `result.summaryByTeamIndex` and `teams[]` fails
- `coveredByEntitlementIds` is never populated in production data

### 8.2 Mitigations

- For data flow: Add `entitlementsOut` explicitly to TradeSummaryPanel props if needed
- For coveredByEntitlementIds: Fall back to "always warn on encumbered" rule

### 8.3 Out of Scope

- Stepien enforcement for entitlements (future phase)
- Blocking trades on warnings
- Editing entitlements mid-trade

---

## 9. Phase 11.2 Execution Prompt Draft

````markdown
# AGENT PROMPT — PHASE 11.2 EXECUTION

## Trade Machine — Entitlement UX + Legality Warnings (Non-Blocking)

## MODE

EXECUTION — IMPLEMENT THE FOLLOWING

## MASTER DOC

docs/team-scrape/PST_PICK_LEDGER_MASTER_PLAN.md

- Update Phase 11.2 status from PREFLIGHT → IN_PROGRESS at start
- Update to COMPLETE when done

## PREFLIGHT REFERENCE

docs/team-scrape/PST_PHASE_11_2_ENTITLEMENT_UX_WARNINGS_PREFLIGHT_RETURN_PACKAGE.md

---

## GOAL

Implement minimal entitlement UX improvements in TradeSummaryPanel:

1. Add "Entitlements Traded" section per team
2. Add non-blocking warnings for encumbered picks and first-round entitlements

---

## IMPLEMENTATION TASKS

### Task A: Create Warning Helper

File: `src/features/architect/tradeMachine/utils/entitlementWarnings.js`

Create a pure function:

```javascript
/**
 * computeEntitlementWarnings
 * @param {Array} entitlementsOut - Array of entitlement objects being traded
 * @returns {Array<string>} - Array of warning message strings
 */
export function computeEntitlementWarnings(entitlementsOut) {
  // Implement Warning A: Encumbered pick_ownership without linked swap_right
  // Implement Warning B: First-round entitlement (Stepien advisory)
  // Return array of warning strings
}
```
````

### Task B: Update TradeSummaryPanel

File: `src/features/architect/tradeMachine/TradeSummaryPanel.jsx`

1. Import `computeEntitlementWarnings` from new helper
2. Inside each team card (in `result.summaryByTeamIndex.map`):
   a. Find matching team slot from `teams[]` prop using teamId
   b. Extract `entitlementsOut` from that slot
   c. Add "Entitlements Traded" section after "Picks Received"
   d. Compute warnings via `computeEntitlementWarnings(entitlementsOut)`
   e. Display warnings in amber box if any

### Task C: Update Master Doc

Mark Phase 11.2 as COMPLETE in PST_PICK_LEDGER_MASTER_PLAN.md

---

## ACCEPTANCE CRITERIA

(Copy from Preflight Return Package Section 6)

---

## VALIDATION

Run manual test cases from Preflight Return Package Section 7.1

---

## FILES TO TOUCH

1. `src/features/architect/tradeMachine/utils/entitlementWarnings.js` (CREATE)
2. `src/features/architect/tradeMachine/TradeSummaryPanel.jsx` (MODIFY)
3. `docs/team-scrape/PST_PICK_LEDGER_MASTER_PLAN.md` (UPDATE status)

---

## STOP CONDITION

Stop after all acceptance criteria pass and master doc is updated.

```

---

## Summary

Phase 11.2 Preflight identified:

1. **Trade Summary Surface**: `TradeSummaryPanel.jsx` shows per-team cards with incoming assets; adding outgoing entitlements is straightforward.

2. **Data Available**: `teams[].entitlementsOut` already contains full entitlement objects with `kind`, `underlyingStatus`, and `coveredByEntitlementIds`.

3. **Warning Logic**: Two deterministic warnings using existing data fields — no new data fetches needed.

4. **Display Pattern**: Amber warning box (distinct from red errors), non-blocking.

5. **Minimal Changes**: 2 files to modify/create, plus master doc update.

**Ready for execution.**
```
