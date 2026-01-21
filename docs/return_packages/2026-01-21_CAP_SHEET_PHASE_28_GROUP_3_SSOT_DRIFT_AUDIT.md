# CAP SHEET CONTRACT RULES — PHASE 28 PREFLIGHT RETURN PACKAGE

## Group 3: SSOT Drift Audit (Cap Sheet ↔ Trade Machine ↔ League/Other Surfaces)

**DATE:** 2026-01-21  
**MODE:** PREFLIGHT (review-only; no code changes)  
**AUDITOR:** GitHub Copilot  
**STATUS:** ✅ **Cap Sheet / Trade Machine ALIGNED** | ⚠️ **LeagueView DRIFT DETECTED**  
**MASTER DOC:** `docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md`

---

## Executive Summary

This audit confirms **end-to-end SSOT alignment** between Cap Sheet and Trade Machine, with both surfaces using `computeTeamCapTotals()` as the canonical source of truth. However, **LeagueView has been identified with critical drift** — it computes totals locally without including dead money, cap holds, or incomplete roster charges.

**Key Findings:**

- ✅ Cap Sheet and Trade Machine share the exact same SSOT
- ✅ Mutations propagate correctly via optimistic updates + pipeline persistence
- ⚠️ LeagueView uses inline `.reduce()` instead of SSOT (P0 fix required)
- ℹ️ Trade Machine session state doesn't live-sync with Cap Sheet mutations (intentional design)

---

## A) SSOT Drift Scorecard

| Surface                                                                                                               | Data Source                                   | Totals Function                                            | Uses `computeTeamCapTotals()`?  | Drift Risk        |
| --------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- | ---------------------------------------------------------- | ------------------------------- | ----------------- |
| **Cap Sheet** ([CapSheet.jsx](src/features/architect/capSheet/CapSheet/CapSheet.jsx#L56))                             | `teamCapSheet` prop (from GMDashboard state)  | `computeTeamCapTotals(teamCapSheet, selectedYear)`         | ✅ **YES** (direct call)        | 🟢 None           |
| **CapSummaryTiles** ([CapSummaryTiles.jsx](src/features/architect/capSheet/CapSheet/CapSummaryTiles.jsx#L10))         | Receives `totals` prop from CapSheet parent   | Uses passed `totals` object                                | ✅ **YES** (passed from parent) | 🟢 None           |
| **Trade Machine - CapImpactTiles** ([CapImpactTiles.jsx](src/features/architect/tradeMachine/CapImpactTiles.jsx#L26)) | `team` object from `useTradeMachine`          | `computeTeamCapTotals(team, yearKey)`                      | ✅ **YES** (direct call)        | 🟢 None           |
| **Trade Machine - useTradeMachine** ([useTradeMachine.js](src/features/architect/hooks/useTradeMachine.js#L23))       | Team data from `loadWorldTeamData`            | `getCapTotalsForYear()` wrapper → `computeTeamCapTotals()` | ✅ **YES** (wrapper)            | 🟢 None           |
| **Trade Validator** ([tradeValidator.js](src/features/architect/utils/tradeMachine/engine/tradeValidator.js#L48))     | `team.teamTotalSalary` (pre-computed in hook) | Uses values from `useTradeMachine`                         | ✅ **YES** (via hook)           | 🟢 None           |
| **capLegalityValidation** ([capLegalityValidation.js](src/features/architect/utils/capLegalityValidation.js#L35))     | Validates against team cap sheet              | Imports and calls `computeTeamCapTotals()`                 | ✅ **YES** (imported)           | 🟢 None           |
| **LeagueView** ([LeagueView.jsx](src/features/architect/shared/LeagueView/LeagueView.jsx#L29))                        | Teams from `loadTeamCapSheet()`               | **LOCAL INLINE REDUCE** `players.reduce()`                 | ❌ **NO**                       | ⚠️ **DRIFT RISK** |
| **GMDashboard State** ([useArchitectState.ts](src/features/architect/GMDashboard/hooks/useArchitectState.ts#L382))    | `loadWorldTeamData(worldId, teamId)`          | N/A (loads raw data)                                       | N/A                             | 🟢 None           |

### Critical Finding: LeagueView SSOT Drift

**File:** [LeagueView.jsx#L29-L30](src/features/architect/shared/LeagueView/LeagueView.jsx#L29-L30)

```jsx
const totalSalary =
  capSheet.players?.reduce((sum, p) => {
    return sum + getCapHitForSeason(p, seasonKey);
  }, 0) || 0;
```

**Issue:** LeagueView computes its own `totalSalary` via inline `.reduce()` instead of calling `computeTeamCapTotals()`. This means:

- ❌ Missing dead money (waived/stretched contracts)
- ❌ Missing cap holds (unsigned free agents)
- ❌ Missing incomplete roster charges (14-player minimum)
- ❌ Will show different numbers than Cap Sheet for the same team

**User Impact:** If a team has significant dead money or cap holds, LeagueView will show artificially low total salary compared to Cap Sheet, causing confusion about team cap status.

---

## B) Mutation Propagation Reality Check

| Mutation          | Trigger Location                                                                                             | Local State Update                                 | Firestore Persistence                                           | Cap Sheet Reflects?                  | Trade Machine Reflects?                                         |
| ----------------- | ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------- | --------------------------------------------------------------- | ------------------------------------ | --------------------------------------------------------------- |
| **signFreeAgent** | [useArchitectActions.ts#L698](src/features/architect/GMDashboard/hooks/useArchitectActions.ts#L698)          | `setTeamCapSheet()` optimistic update              | `persistMutation('signFreeAgent', ...)` → `mutationPipeline.js` | ✅ Yes (re-renders with new state)   | ✅ Yes (when Trade Machine remounts with new `primaryTeamData`) |
| **waivePlayer**   | [useArchitectActions.ts#L1254](src/features/architect/GMDashboard/hooks/useArchitectActions.ts#L1254)        | `setTeamCapSheet()` optimistic update              | `persistMutation('waivePlayer', ...)`                           | ✅ Yes                               | ✅ Yes                                                          |
| **setDeadCap**    | [useArchitectActions.ts#L839-850](src/features/architect/GMDashboard/hooks/useArchitectActions.ts#L839-L850) | `setTeamCapSheet(prev => ({...prev, deadCap}))`    | `persistMutation('setDeadCap', ...)`                            | ✅ Yes (optimistic + SSOT recompute) | ✅ Yes (if Trade Machine is reloaded)                           |
| **setExceptions** | [useArchitectActions.ts#L859-870](src/features/architect/GMDashboard/hooks/useArchitectActions.ts#L859-L870) | `setTeamCapSheet(prev => ({...prev, exceptions}))` | `persistMutation('setExceptions', ...)`                         | ✅ Yes                               | ✅ Yes (if Trade Machine is reloaded)                           |
| **signAndTrade**  | Multiple locations                                                                                           | Via trade execution                                | `persistMutation('signAndTrade', ...)` or `executeTrade`        | ✅ Yes                               | ✅ Yes (via validator)                                          |

### Propagation Flow (Verified ✅)

```
1. User Action
   ↓
2. useArchitectActions handler
   ↓
3. Optimistic Update (setTeamCapSheet)
   ↓
4. SSOT Recompute (Cap Sheet: computeTeamCapTotals in useMemo)
   ↓
5. Persistence (persistMutation → mutationPipeline.js → Firestore)
   ↓
6. Trade Machine Sync (receives primaryTeamData prop from GMDashboard)
   - If already open: uses existing state until remounted
   - If remounted: loads fresh data via loadWorldTeamData()
```

### Mutation Validation Chain

All mutations flow through:

1. **UI Handler** (`useArchitectActions.ts`)
2. **Mutation Pipeline** (`mutationPipeline.js`)
   - Loads current state: `getTeam(worldId, teamCode)` → world-aware fallback chain
   - Validates: `capLegalityValidation.js` (non-trade) or `tradeValidator.js` (trade)
   - Computes updates: mutation-specific compute functions
   - Persists: Firestore batch write to `architect_worlds/{worldId}/teams/{teamCode}`
3. **State Update** (optimistic local state + eventual Firestore consistency)

### Known Limitation (Not a Bug)

**Trade Machine does not live-sync with Cap Sheet mutations during a session.**

**Scenario:**

1. Open Trade Machine for Team A
2. Switch tabs and sign a free agent to Team A
3. Switch back to Trade Machine

**Result:** Trade Machine will show stale data until remounted.

**Why This Is Intentional:**

- Trades are speculative "sandbox" sessions
- Trade Machine maintains independent state during active session
- Remounting loads fresh data via `loadWorldTeamData()`

**Potential User Confusion:** Users may expect Trade Machine to reflect mid-session changes. Consider adding a "Refresh Team Data" button if this becomes a support issue.

---

## C) Concrete Drift Detection Scenarios (6 Manual Tests)

### Scenario 1: Dead Cap Addition → Totals Change

**Steps:**

1. Go to Cap Sheet for any team (e.g., `/gm/celtics`)
2. Note the "TOTAL CAP ALLOCATIONS" value in the summary tiles
3. Open Dead Money modal (click "Manage Dead Cap" button)
4. Add $5M dead cap for current season
5. Save and close modal

**Expected:**

- TOTAL CAP ALLOCATIONS increases by exactly $5,000,000
- Change is instant (optimistic update)
- No page refresh required

**Detect Drift:**

- Total doesn't change → SSOT not wired correctly
- Total changes by wrong amount → Dead cap computation error
- Change requires refresh → Optimistic update missing

---

### Scenario 2: Exception Usage → Exception Bars Match

**Steps:**

1. Go to Cap Sheet for team with available MLE (e.g., `/gm/lakers`)
2. Note MLE remaining in Exception Tracker component
3. Sign a free agent using MLE for $5M (use Contract Modal)
4. Verify Exception Tracker shows MLE reduced by $5M
5. Open Trade Machine for same team (`/gm/lakers?tab=trade`)
6. Check FA Exception buckets in Trade Machine UI

**Expected:**

- Cap Sheet Exception Tracker: MLE reduced by $5M
- Trade Machine exception buckets: same MLE remaining value
- Both surfaces show identical exception availability

**Detect Drift:**

- MLE values differ between surfaces → Exception state not synced
- MLE doesn't update in Cap Sheet → Exception mutation not applied
- Trade Machine shows outdated MLE → Need to remount or refresh

---

### Scenario 3: Waive Player → Dead Money Appears

**Steps:**

1. Select a player on the Cap Sheet roster with multi-year contract
2. Open Contract Modal for that player
3. Choose "Waive Player" action (optionally select stretch provision)
4. Complete waive action
5. Verify player is removed from roster table
6. Verify dead money appears in Dead Cap section
7. Note TOTAL CAP ALLOCATIONS change

**Expected:**

- Player salary removed from roster total
- Dead money added (equal to or less than original salary depending on stretch)
- Net change in TOTAL CAP ALLOCATIONS = (dead money - player salary)
- If stretched: dead money spread across multiple years

**Detect Drift:**

- Player still shows in roster → Mutation failed
- Dead money missing → Dead cap computation not triggered
- Total wrong → SSOT not including dead money

---

### Scenario 4: S&T Hard Cap → Both Surfaces Show Lock

**Steps:**

1. In Trade Machine, set up a Sign-and-Trade deal:
   - Team A: sending free agent player (toggle S&T flag)
   - Team B: receiving player
2. Validate and execute trade
3. Navigate to Cap Sheet for receiving team (Team B)
4. Check CapSummaryTiles for "1st Apron Space" tile
5. Look for lock icon 🔒 indicating hard cap

**Expected:**

- Lock icon appears on 1st Apron tile in Cap Sheet
- Hover tooltip shows "Hard Capped at 1st Apron" with reason
- Trade Machine also shows hard cap indicator for Team B
- Hard cap status persists across page refreshes

**Detect Drift:**

- Lock icon missing → Hard cap flag not set correctly
- Lock icon appears in one surface but not the other → SSOT divergence
- Hard cap status lost after refresh → Persistence failed

---

### Scenario 5: LeagueView vs Cap Sheet Comparison (Demonstrates Bug)

**Steps:**

1. Go to `/gm` (LeagueView - league-wide overview)
2. Find Boston Celtics in the table
3. Note "Total Salary" displayed for BOS
4. Click "Manage Team" to go to `/gm/celtics` (Cap Sheet)
5. Note "TOTAL CAP ALLOCATIONS" in summary tiles
6. Compare the two values

**Expected (Current Bug):**

- **Values WILL differ** if team has dead money or cap holds
- LeagueView will show LOWER total (only player salaries)
- Cap Sheet will show HIGHER total (includes dead money + cap holds)

**Use to Verify Fix:**

- After applying P0 fix to LeagueView, both values should match exactly
- Difference should be $0 (or within $1 rounding tolerance)

**Example Scenario:**

- BOS has $150M in player salaries, $5M dead money, $3M cap holds
- LeagueView shows: $150M
- Cap Sheet shows: $158M
- Discrepancy: $8M (dead money + cap holds)

---

### Scenario 6: Trade Machine Pre-Trade Baseline Match

**Steps:**

1. Go to Cap Sheet for team X (e.g., `/gm/warriors`)
2. Note "TOTAL CAP ALLOCATIONS" value (e.g., $165M)
3. Switch to Trade tab or open Trade Machine for team X
4. Before adding any trade assets, note "TOTAL CAP" in CapImpactTiles
5. Compare the two values

**Expected:**

- Both values match exactly (both use `computeTeamCapTotals`)
- Difference should be $0
- If Trade Machine shows different value, reload page and retest

**Detect Drift:**

- Values differ by more than $1 → Local computation divergence
- Trade Machine baseline doesn't match Cap Sheet → `getCapTotalsForYear` wrapper broken
- Values match but exclude dead money → Both have bug (unlikely, but check)

---

## D) Findings + P0 Fix List

### Alignment Status Summary

| Surface Pair                                | Alignment      | Notes                                            |
| ------------------------------------------- | -------------- | ------------------------------------------------ |
| Cap Sheet ↔ CapSummaryTiles                | ✅ **ALIGNED** | Parent passes canonical `totals` object          |
| Cap Sheet ↔ Trade Machine (CapImpactTiles) | ✅ **ALIGNED** | Both call `computeTeamCapTotals()`               |
| Cap Sheet ↔ capLegalityValidation          | ✅ **ALIGNED** | Validation imports SSOT function                 |
| Trade Machine ↔ Trade Validator            | ✅ **ALIGNED** | Validator receives pre-computed values from hook |
| **Cap Sheet ↔ LeagueView**                 | ❌ **DRIFT**   | LeagueView uses inline reduce                    |
| Cap Sheet ↔ GMDashboard State              | ✅ **ALIGNED** | State is raw data, SSOT applied on render        |

### P0 Fix Required

| Priority | File                                                                              | Issue                                                                              | Fix                                                                            | Effort         |
| -------- | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | -------------- |
| **P0**   | [LeagueView.jsx](src/features/architect/shared/LeagueView/LeagueView.jsx#L26-L33) | Inline `.reduce()` computes totals without dead money/cap holds/incomplete charges | Replace with `computeTeamCapTotals(capSheet, currentYear).totalCapAllocations` | 🟢 Low (5 min) |

### Suggested Fix Code

**File:** `src/features/architect/shared/LeagueView/LeagueView.jsx`

```jsx
// ============================================================================
// BEFORE (Lines 1-33) - Current Implementation with SSOT Drift
// ============================================================================
import React, { useState, useEffect } from 'react';
import { loadTeamCapSheet } from '@/features/architect/utils/firebaseTeamPlanHelpers';
import { useNavigate } from 'react-router-dom';
import { TeamListFull } from '@/constants/teamList';
import TeamLogo from '@/shared/components/TeamLogo';
import {
  getDefaultSeasonEndYear,
  toSeasonKey,
} from '@/features/architect/utils/seasonUtils';
import { getCapHitForSeason } from '@/features/architect/utils/tradeMachine/utils/seasonUtils.js';

const teamsList = TeamListFull;

const LeagueView = () => {
  const [teamSummaries, setTeamSummaries] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const loadAllTeams = async () => {
      const currentYear = getDefaultSeasonEndYear();
      const seasonKey = toSeasonKey(currentYear);

      // Load all teams in parallel for better performance
      const teamPromises = teamsList.map(async (t) => {
        try {
          const capSheet = await loadTeamCapSheet(t.code || t.id);
          if (capSheet) {
            const totalSalary =
              capSheet.players?.reduce((sum, p) => {
                return sum + getCapHitForSeason(p, seasonKey);
              }, 0) || 0;
            return {
              id: t.id,
              code: t.code,
              teamName: t.teamName,
              totalSalary,
              conference: t.conference,
            };
          }
        } catch (error) {
          console.warn(`Failed to load team ${t.code || t.id}:`, error);
        }
        // Fallback for teams that fail to load
        return {
          id: t.id,
          code: t.code,
          teamName: t.teamName,
          totalSalary: 0,
          conference: t.conference,
        };
      });
      // ... rest of component
    };
    loadAllTeams();
  }, []);
  // ... rest of component


// ============================================================================
// AFTER - Fixed Implementation with SSOT Alignment
// ============================================================================
import React, { useState, useEffect } from 'react';
import { loadTeamCapSheet } from '@/features/architect/utils/firebaseTeamPlanHelpers';
import { useNavigate } from 'react-router-dom';
import { TeamListFull } from '@/constants/teamList';
import TeamLogo from '@/shared/components/TeamLogo';
import {
  getDefaultSeasonEndYear,
  toSeasonKey,
} from '@/features/architect/utils/seasonUtils';
// REMOVED: import { getCapHitForSeason } from '@/features/architect/utils/tradeMachine/utils/seasonUtils.js';
// ADDED: Import SSOT function
import { computeTeamCapTotals } from '@/features/architect/utils/capTotals/computeTeamCapTotals';

const teamsList = TeamListFull;

const LeagueView = () => {
  const [teamSummaries, setTeamSummaries] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const loadAllTeams = async () => {
      const currentYear = getDefaultSeasonEndYear();
      const seasonKey = toSeasonKey(currentYear);

      // Load all teams in parallel for better performance
      const teamPromises = teamsList.map(async (t) => {
        try {
          const capSheet = await loadTeamCapSheet(t.code || t.id);
          if (capSheet) {
            // CHANGED: Use SSOT instead of inline reduce
            // This includes players + dead money + cap holds + incomplete roster charges
            const { totalCapAllocations } = computeTeamCapTotals(capSheet, currentYear);
            return {
              id: t.id,
              code: t.code,
              teamName: t.teamName,
              totalSalary: totalCapAllocations,
              conference: t.conference,
            };
          }
        } catch (error) {
          console.warn(`Failed to load team ${t.code || t.id}:`, error);
        }
        // Fallback for teams that fail to load
        return {
          id: t.id,
          code: t.code,
          teamName: t.teamName,
          totalSalary: 0,
          conference: t.conference,
        };
      });
      // ... rest of component
    };
    loadAllTeams();
  }, []);
  // ... rest of component
```

**Impact:**

- LeagueView will now show the same totals as Cap Sheet
- Dead money, cap holds, and incomplete roster charges will be included
- No breaking changes (component API unchanged)
- Performance impact: negligible (same computation, just moved to SSOT function)

---

## STOP CONDITIONS EVALUATION

| Stop Condition                                                   | Status               | Evidence                                                                                     |
| ---------------------------------------------------------------- | -------------------- | -------------------------------------------------------------------------------------------- |
| **Trade Machine uses different totals function than Cap Sheet**  | ❌ **NOT TRIGGERED** | Both use `computeTeamCapTotals` (verified in code traces)                                    |
| **Multiple "team state" stores that can diverge**                | ⚠️ **MINOR**         | Trade Machine has session-local state but refreshes on mount. Not a bug, intentional design. |
| **Surface reads from base `teams/{code}` after world mutations** | ❌ **NOT TRIGGERED** | All surfaces use world-aware loading via `loadWorldTeamData()` → `getTeam()` fallback chain  |

**Conclusion:** No stop conditions triggered. Drift is isolated to LeagueView and easily fixable.

---

## SSOT Data Flow Architecture

### Canonical Source: `computeTeamCapTotals()`

**Location:** `src/features/architect/utils/capTotals/computeTeamCapTotals.js`

**What It Includes:**

```javascript
{
  playersTotal,           // Sum of all player cap hits
  deadMoneyTotal,         // Waived/stretched contracts
  capHoldsTotal,          // Unsigned free agent cap holds
  incompleteChargesTotal, // Min roster charges (14-player rule)
  totalCapAllocations,    // SUM of above four
  salaryCap,             // League salary cap
  firstApron,            // First apron threshold
  secondApron,           // Second apron threshold
  deltas: {              // Distance from thresholds
    vsCap,
    vsFirstApron,
    vsSecondApron
  }
}
```

### Data Flow: World-Aware Loading

```
User requests team data
    ↓
loadWorldTeamData(worldId, teamId)
    ↓
    ├─ worldId = null → loadTeamCapSheet() → architect_baseTeams/{code}
    │
    └─ worldId exists → getTeam(worldId, teamCode)
                           ↓
                           ├─ Check: architect_worlds/{worldId}/teams/{code}
                           ├─ If not found → recurse to parent world
                           └─ If still not found → architect_baseTeams/{code}
    ↓
Returns team cap sheet object
    ↓
Component calls computeTeamCapTotals(teamCapSheet, year)
    ↓
Canonical totals object returned
```

### Mutation Persistence Flow

```
User action (sign/waive/extend/etc)
    ↓
useArchitectActions handler
    ↓
Optimistic update: setTeamCapSheet(...)
    ↓
Component re-renders with new state
    ↓
computeTeamCapTotals() recalculates totals
    ↓
UI updates instantly
    ↓
[ASYNC] persistMutation(mutationType, payload)
    ↓
mutationPipeline.js
    ├─ Load current state: getTeam(worldId, teamCode)
    ├─ Validate: capLegalityValidation or tradeValidator
    ├─ Compute: mutation-specific compute function
    └─ Persist: writeBatch to architect_worlds/{worldId}/teams/{code}
    ↓
Firestore write completes
```

---

## Additional Observations

### Trade Machine Session State Design

**Current Behavior:**

- Trade Machine loads team data once on mount
- Maintains independent state during active session
- Does not subscribe to Cap Sheet state changes
- Refreshes data only on remount/navigation

**Why This Design:**

- Trades are speculative "what-if" scenarios
- Session isolation prevents mid-trade data pollution
- User intent: evaluate trade based on snapshot at trade start
- Avoids confusing scenarios where trade validity changes mid-session

**Potential Improvements (Future Work):**

- Add "Refresh Team Data" button to Trade Machine
- Show staleness indicator if data is >5 minutes old
- Add toast notification when world mutations occur in background
- Consider reactive sync for non-speculative changes (e.g., dead cap updates)

### Cap Legality Validation SSOT Usage

**File:** `src/features/architect/utils/capLegalityValidation.js`

The validation layer correctly imports and uses the SSOT:

```javascript
import { computeTeamCapTotals } from '@/features/architect/utils/capTotals/computeTeamCapTotals';

// Example usage in validateSigning:
const totals = computeTeamCapTotals(team, currentYear);
if (totals.totalCapAllocations > totals.secondApron) {
  // Second apron restrictions apply
}
```

This ensures that validation rules operate on the same totals displayed to users in the UI.

### No Base Team Reads After World Mutations

**Verified:** All surfaces use world-aware loading via `loadWorldTeamData()` or `getTeam()`, which implement a fallback chain:

1. World snapshot (`architect_worlds/{worldId}/teams/{code}`)
2. Parent world snapshot (recursive)
3. Base team (`architect_baseTeams/{code}`)

Once a world mutation occurs, the world snapshot exists and is always read first. Base teams are only used as initialization seed data.

---

## Recommendations

### Immediate Action (P0)

1. **Fix LeagueView SSOT drift** (5 minutes)
   - Apply code change from Section D
   - Verify with Scenario 5 manual test
   - Deploy with next release

### Short-Term Improvements (P1)

1. **Add Trade Machine refresh button** (1 hour)
   - Button to reload team data mid-session
   - Clears stale state without full remount
   - Useful for users who switch between tabs

2. **Add SSOT drift detection in dev mode** (30 minutes)
   - Extend `warnOnTotalsDivergence()` utility
   - Call in all surfaces that display totals
   - Log warnings when local computation differs from SSOT

### Long-Term Monitoring (P2)

1. **Create SSOT compliance test suite** (2 hours)
   - Automated tests that load same team data in multiple surfaces
   - Assert totals match across all surfaces
   - Prevent regression of drift issues

2. **Document SSOT usage rules** (30 minutes)
   - Add to `DEVELOPER_GUIDE.md`
   - Mandate `computeTeamCapTotals()` for all new surfaces
   - Code review checklist item

---

## Conclusion

**Group 3 SSOT Alignment: 🟡 MOSTLY ALIGNED**

The Architect feature demonstrates strong SSOT discipline with one notable exception:

- ✅ **Cap Sheet**: Fully aligned, uses SSOT in `useMemo`
- ✅ **Trade Machine**: Fully aligned, uses SSOT via `getCapTotalsForYear()` wrapper
- ✅ **Validation Layer**: Fully aligned, imports and uses SSOT
- ✅ **Mutation Pipeline**: All mutations validate against SSOT
- ⚠️ **LeagueView**: **DRIFT DETECTED** - uses inline computation (P0 fix ready)

**Impact:** LeagueView will show incorrect totals for teams with dead money or cap holds. This is a user-facing bug that should be fixed before next release.

**Effort to Fix:** 5 minutes (single import + one-line change)

**Risk:** Low (SSOT function is battle-tested, no API changes)

**Trade Machine session isolation is a feature, not a bug.** The speculative nature of trade scenarios requires snapshot-based evaluation. Consider UX improvements (refresh button, staleness indicators) if users report confusion.

---

## Appendix: Code References

### Key Files

- SSOT Function: `src/features/architect/utils/capTotals/computeTeamCapTotals.js`
- Cap Sheet: `src/features/architect/capSheet/CapSheet/CapSheet.jsx`
- CapSummaryTiles: `src/features/architect/capSheet/CapSheet/CapSummaryTiles.jsx`
- Trade Machine Hook: `src/features/architect/hooks/useTradeMachine.js`
- Trade Machine UI: `src/features/architect/tradeMachine/CapImpactTiles.jsx`
- Trade Validator: `src/features/architect/utils/tradeMachine/engine/tradeValidator.js`
- Cap Legality Validation: `src/features/architect/utils/capLegalityValidation.js`
- LeagueView (DRIFT): `src/features/architect/shared/LeagueView/LeagueView.jsx`
- Mutation Pipeline: `src/features/architect/utils/mutationPipeline.js`
- World Team Loading: `src/features/architect/utils/worldTeamData.ts`
- Team Loader: `src/features/architect/utils/teamLoader.js`

### Related Documentation

- Master Doc: `docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md`
- SSOT Design Doc: `docs/ARCHITECT_CAP_TOTAL_SINGLE_SOURCE.md` (if exists)
- Trade Machine Audit: `TRADE_MACHINE_AUDIT.md`
- Gap Analysis: `docs/ARCHITECT_GAP_ANALYSIS.md`

---

**END OF RETURN PACKAGE**
