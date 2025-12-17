# Architect Feature Gap Analysis

> **Created**: December 17, 2025  
> **Purpose**: Comprehensive review of Architect feature completeness for production readiness  
> **Status**: Review Complete - Ready for Phase 2 Implementation

---

## Executive Summary

The Architect feature is a sophisticated NBA roster scenario planning system with significant functionality already implemented. However, several critical components remain incomplete or disconnected. This analysis identifies all gaps organized by system, provides dependency mapping, and prioritizes next actions.

### Overall Assessment: ~55% Complete

| Category | Status | Notes |
|----------|--------|-------|
| **Core Infrastructure** | ✅ 85% | worldManager, teamLoader, seasonManager implemented |
| **Trade Machine** | ✅ 90% | Comprehensive CBA validation, well-structured rules |
| **Contract Logic** | ⚠️ 70% | Extensions/signing work but not persisted |
| **Firestore Persistence** | ❌ 30% | Read-only client, no world snapshots written |
| **Multi-Season/Branching** | ❌ 20% | Logic exists but not wired to UI |
| **UI Integration** | ⚠️ 60% | GMDashboard works but uses legacy `teamPlans` not worlds |
| **Data Population** | ❌ 10% | `architect_baseTeams/basePlayers` collections empty |

---

## Phase 1: Core Logic & Data Gaps

### 1.1 Firestore Collections - NOT POPULATED ❌

**Critical Blocker**: The architect collections do not exist in Firestore yet.

| Collection | Expected | Actual |
|------------|----------|--------|
| `architect_baseTeams` | 30 team documents | Empty |
| `architect_basePlayers` | ~530 player documents | Empty |
| `architect_worlds` | World metadata + snapshots | Empty |

**Evidence**: 
- `firebaseTeamPlanHelpers.js` loads from `architect_baseTeams` via `baseTeamRef()` 
- All data scraping infrastructure exists in `/team-scrape/` folder
- Sample outputs exist for 5 teams but not uploaded

**Required Action**: Run data migration (Phase 2 per docs)

---

### 1.2 World System - PARTIALLY IMPLEMENTED ⚠️

**File**: `src/features/architect/utils/worldManager.js`

| Function | Status | Issue |
|----------|--------|-------|
| `createWorld()` | ✅ Implemented | Works but not called from UI |
| `getWorldMetadata()` | ✅ Implemented | Works |
| `listUserWorlds()` | ✅ Implemented | Works |
| `updateWorldMetadata()` | ✅ Implemented | Works |
| `deleteWorld()` | ⚠️ Partial | Has TODO: "Recursively delete all subcollections" (line 310) |
| `branchWorld()` | ✅ Implemented | Works but not wired to UI |
| `updateWorldStats()` | ✅ Implemented | Works |

**Gap**: World system is fully coded but **not connected to GMDashboard**. The dashboard uses legacy `teamPlans` collection instead.

---

### 1.3 Team Loading - IMPLEMENTED BUT NOT USED ✅ → ⚠️

**File**: `src/features/architect/utils/teamLoader.js`

| Function | Status | Notes |
|----------|--------|-------|
| `getTeam()` | ✅ Implemented | Fallback chain: world → parent → base |
| `getLeague()` | ✅ Implemented | Batch read for 30 teams |
| `getPlayer()` | ✅ Implemented | Override merging works |
| `mergePlayerOverride()` | ✅ Implemented | Deep merge logic correct |
| `mergeSalariesByYear()` | ✅ Implemented | Season-based merge |

**Gap**: GMDashboard does NOT use `teamLoader.getTeam()`. Instead it uses:
- `loadTeamCapSheet()` from `firebaseTeamPlanHelpers.js` (line 170)
- This reads from `architect_baseTeams` directly without world context

**Required**: Wire `useArchitectState.ts` to use `teamLoader` with worldId.

---

### 1.4 Trade Manager - READ-ONLY, NO PERSISTENCE ⚠️

**File**: `src/features/architect/utils/tradeManager.js`

**Critical Finding**: Module header explicitly states:
```javascript
// This module is intentionally READ-ONLY with respect to Firestore.
// It computes updated team/player snapshots and returns them to callers,
// but does not persist them. Persistence must be handled server-side.
```

| Function | Status | Persistence |
|----------|--------|-------------|
| `executeTrade()` | ✅ Computes | ❌ Does not write |
| `signFreeAgent()` | ✅ Computes | ❌ Does not write |
| `waivePlayer()` | ✅ Computes | ❌ Does not write |
| `extendPlayer()` | ✅ Computes | ❌ Does not write |
| `updateTeamCapTotals()` | ✅ Computes | N/A (helper) |

**Gap**: All roster transactions compute correctly but:
1. Don't write world snapshots to Firestore
2. Don't update world metadata (actionCount, modifiedTeams)
3. Don't create TPE records

**Required**: Add persistence layer - either client-side batched writes or Cloud Function.

---

### 1.5 Season Manager - IMPLEMENTED BUT UNTESTED ⚠️

**File**: `src/features/architect/utils/seasonManager.js`

| Function | Status | Notes |
|----------|--------|-------|
| `advanceSeason()` | ✅ Implemented | Writes to Firestore |
| `processSeasonTransition()` | ✅ Implemented | Batch writes all teams |
| `processContractExpirations()` | ✅ Implemented | Removes expired contracts |
| `processOptions()` | ⚠️ Partial | Defaults option to exercised (line 286) |
| `processEmptyRosterCharges()` | ✅ Implemented | Uses 2025-26 minimum |
| `updateCapHolds()` | ✅ Implemented | Filters expired |
| `updateDraftPicks()` | ⚠️ Partial | "Would need full Stepien calculation" (line 401) |

**Gap**: Season advancement DOES write to Firestore but:
1. Uses hard-coded minimum salary ($1,119,563) instead of year-appropriate value
2. Option processing defaults to "exercised" without user input
3. Stepien rule updating is incomplete

---

### 1.6 Contract & Signing Logic - WORKS BUT DISCONNECTED ⚠️

**Files**: 
- `useArchitectActions.ts` - Handles all contract actions
- `contractUtils.js` - Cap hold calculations
- `extensionRules.js` - Marked as `@deprecated`, points to Salary Engine

| Action | UI Works | Persists | Notes |
|--------|----------|----------|-------|
| Sign FA | ✅ | ⚠️ Legacy | Saves to `teamPlans` not worlds |
| Extend | ✅ | ⚠️ Legacy | Saves to `teamPlans` |
| Waive | ✅ | ⚠️ Legacy | Saves to `teamPlans` |
| Option Accept/Decline | ✅ | ⚠️ Legacy | Saves to `teamPlans` |
| Renounce Rights | ✅ | ⚠️ Legacy | Clears cap hold |

**Gap**: All actions work in UI but persist to legacy `teamPlans` collection, not `architect_worlds`.

---

### 1.7 CBA Rule Engine - COMPREHENSIVE ✅

**Files**: `src/features/architect/utils/tradeMachine/rules/*`

The trade validation engine is the most complete subsystem:

| Rule | File | Status |
|------|------|--------|
| Salary Matching | `validateSalaryMatching.js` | ✅ Complete |
| Hard Cap | `validateHardCap.ts`, `hardCapValidation.js` | ✅ Complete |
| Stepien Rule | `validateStepien.js/.ts` | ✅ Complete |
| Trade Exceptions | `validateTradeExceptions.js` | ✅ Complete |
| Second Apron | `validateSecondApronRules.js` | ✅ Complete |
| Sign & Trade | `validateSignAndTrade.js` | ✅ Complete |
| Aggregation | `validateAggregation.js` | ✅ Complete |
| Roster Size | `validateRoster.js/.ts` | ✅ Complete |
| Eligibility | `validateEligibility.js` | ✅ Complete |
| Consent | `validateConsent.js` | ✅ Complete |
| FA Exception Usage | `validateFaExceptionUsage.js` | ✅ Complete |

**Minor Gaps**:
- Test coverage at 66% due to mock issues (not logic issues)
- Some rules duplicated between Trade Machine and Architect core

---

### 1.8 Salary Engine - IMPLEMENTED ✅

**File**: `src/features/architect/utils/salaryEngine/`

Modern, well-typed module providing:
- `getSalaryProfile()` - Unified salary calculations
- `getMaxSalaryProfile()` - Max contract calculations
- `getMinSalaryProfile()` - Minimum salary by YOS
- `getBirdRightsProfile()` - Bird rights determination
- `getExtensionProfile()` - Extension eligibility/terms
- `getRFAProfile()` - RFA/QO calculations

**Gap**: `extensionRules.js` is marked `@deprecated` but still imported by `EditContractModal.jsx` as fallback.

---

### 1.9 Cap Projections - COMPLETE ✅

**File**: `src/features/architect/utils/capProjections.js`

Covers seasons 2024-25 through 2031-32 with:
- Salary cap, floor, tax line
- First/second apron thresholds
- MLE variants (full, taxpayer, room)
- BAE amounts
- Growth rates

---

## Phase 2: UI & Interaction Gaps

### 2.1 GMDashboard - WORKS BUT LEGACY-BOUND ⚠️

**File**: `src/features/architect/GMDashboard/GMDashboard.jsx`

| Component | Status | Issue |
|-----------|--------|-------|
| Roster Tab | ✅ Works | |
| Cap Sheet Tab | ✅ Works | |
| Full Cap Table | ✅ Works | |
| Trade Machine Tab | ✅ Works | |
| Free Agency Tab | ✅ Works | |
| Offseason Tab | ✅ Works | |
| History Tab | ✅ Works | |
| Season Selector | ✅ Works | From `capProjections` |
| View Mode Toggle | ✅ Works | Plan/Baseline modes |
| Plan Picker | ✅ Works | Uses legacy `teamPlans` |
| Save Plan | ✅ Works | Uses legacy `teamPlans` |

**Missing UI Components**:
- ❌ World Selector (no UI to create/select worlds)
- ❌ Branch Button (world branching not exposed)
- ❌ Season Navigator (advance through seasons)
- ❌ World Management Panel (delete, rename, archive)

---

### 2.2 State Management - REFACTORED BUT INCOMPLETE ⚠️

**File**: `src/features/architect/GMDashboard/hooks/useArchitectState.ts`

**What's Good**:
- Clean TypeScript with proper types
- Centralized state management
- Auto-save to `teamPlans` (debounced)
- Free agent derivation from player pool

**What's Missing**:
- No `worldId` in state
- Doesn't call `worldManager` functions
- Doesn't use `teamLoader.getTeam()` with world context
- Auto-save targets legacy collection

---

### 2.3 EditContractModal - FUNCTIONAL BUT COMPLEX ⚠️

**File**: `src/shared/components/EditContractModal.jsx`

At 1,063 lines, this modal handles:
- Option accept/decline
- Free agent signing
- Extensions
- Waivers (regular, stretch, buyout)
- Validation warnings

**Gaps**:
- Uses deprecated `extensionRules.js` as fallback (lines 21-24)
- Cap validation runs but doesn't block illegal actions
- "Force Action" button bypasses all validation

---

### 2.4 Trade Machine UI - COMPREHENSIVE ✅

**Files**: `src/features/architect/tradeMachine/*`

| Component | Status |
|-----------|--------|
| TradeEditor | ✅ Main orchestrator |
| TradeTeamCard | ✅ Per-team selection |
| TradeSummaryPanel | ✅ Trade overview |
| TradeValidationPanel | ✅ Rule violations |
| TradeLegalChecker | ✅ Legal status |
| TradeExceptionDashboard | ✅ TPE management |
| TradePreviewModal | ✅ Confirmation dialog |
| TradeDebugPanel | ✅ Developer debugging |

**Gap**: After trade validation:
1. `onApplyTrade()` updates local `teamCapSheet` state
2. Does NOT call `tradeManager.executeTrade()` to compute world snapshot
3. Does NOT persist to `architect_worlds`

---

## Dependency Map

```
Phase 2A: Data Population (BLOCKING)
├── Run team scrapers for 30 teams
├── Run player scraper for ~530 players  
├── Upload to architect_baseTeams
├── Upload to architect_basePlayers
└── Verify in Firebase Console

Phase 2B: Wire World System (BLOCKING)
├── Add worldId to useArchitectState
├── Replace loadTeamCapSheet() with teamLoader.getTeam(worldId)
├── Add WorldSelector component
├── Add Create World / Branch World UI
└── Update plan picker to show worlds

Phase 3A: Add Persistence Layer (CRITICAL)
├── Option A: Client-side batched writes
│   ├── Modify tradeManager to accept worldId
│   ├── Add writeBatch calls after computing snapshots
│   └── Call updateWorldStats after mutations
├── Option B: Cloud Functions
│   ├── Create executeTrade Cloud Function
│   ├── Create signPlayer Cloud Function
│   └── Create waivePlayer Cloud Function
└── Either option: Update UI to call new persistence

Phase 3B: Complete Season Advancement (IMPORTANT)
├── Replace hard-coded minimum with year-appropriate value
├── Add UI for option decisions before advancing
├── Implement full Stepien recalculation
└── Add season advancement UI to GMDashboard

Phase 4: Polish & Edge Cases (RECOMMENDED)
├── Remove deprecated extensionRules.js imports
├── Add World rename/delete/archive UI
├── Add branch visualization
├── Improve test coverage (fix mock issues)
└── Add E2E tests for complete workflows
```

---

## Critical Call-Outs

### 1. Logic Duplicated Across Systems

| Logic | Locations | Risk |
|-------|-----------|------|
| Salary matching tiers | `cbaConstants.js`, `salaryMatching.js` | Drift possible |
| Cap hold calculation | `contractUtils.js`, `capHolds.ts` | Uses different formulas |
| Extension eligibility | `extensionRules.js` (deprecated), `salaryEngine` | Fallback uses old logic |
| Season format parsing | `seasonFormat.js`, `seasonHelpers.ts`, `seasonUtils.js` | 3 different files |

**Recommendation**: Consolidate to single source of truth, remove deprecated paths.

### 2. Dangerous Assumptions

| Assumption | Location | Risk |
|------------|----------|------|
| Options default to exercised | `seasonManager.js:286` | Incorrect roster projection |
| Empty roster charge = $1.1M | `seasonManager.js:318` | Wrong for non-2025 seasons |
| salaryCap required but continues with placeholder | `birdRightsRules.js:81-82` | Incorrect calculations |
| hasTenure = 7+ YOS (stubbed) | `extensionRules.js:236` | Supermax eligibility wrong |

### 3. Rules Applied Inconsistently

| Rule | Trade Machine | Architect Core |
|------|--------------|----------------|
| Hard cap triggers | ✅ Full validation | ⚠️ Sets flag but doesn't block |
| Second apron restrictions | ✅ Full validation | ❌ Not checked in signings |
| Aggregation prohibition | ✅ Validated in trades | ❌ Not checked in multi-signings |

---

## Ordered Next Actions

### Priority 1: Critical Correctness (BLOCKING)

1. **Populate Firestore Collections**
   - Run `/team-scrape/` scripts for all 30 teams
   - Validate against schema
   - Upload to `architect_baseTeams` and `architect_basePlayers`

2. **Wire World System to UI**
   - Add `worldId` state to `useArchitectState.ts`
   - Create `WorldSelector` component
   - Update data loading to use `teamLoader.getTeam(worldId)`

3. **Add Persistence to Mutations**
   - Modify `tradeManager.executeTrade()` to write world snapshots
   - Add `writeBatch` calls for trade, sign, waive, extend actions
   - Call `updateWorldStats()` after each mutation

### Priority 2: System-Blocking Issues

4. **Fix Season Advancement**
   - Use `capProjections` for year-appropriate minimums
   - Add UI for option decisions before advancing
   - Implement proper Stepien recalculation

5. **Remove Deprecated Code Paths**
   - Update `EditContractModal.jsx` to use `salaryEngine` exclusively
   - Remove fallback to `extensionRules.js`
   - Consolidate season format utilities

### Priority 3: UX Polish

6. **Add World Management UI**
   - Branch button
   - Rename/delete/archive worlds
   - Decision tree visualization

7. **Improve Validation UX**
   - Block illegal actions instead of "Force Action"
   - Show specific rule violations inline
   - Add confirmation dialogs for destructive actions

8. **Complete Test Coverage**
   - Fix Firebase mock issues (see `tests/architect/TEST_STATUS.md`)
   - Target 90%+ coverage
   - Add E2E workflow tests

---

## Conclusion

**What Architect Already Does**:
- Comprehensive CBA trade validation (90%+ of rules)
- Full contract editing UI with validation warnings
- Multi-year cap projections and salary calculations
- Bird rights, extensions, RFA, minimum salary logic
- Offseason simulation (contracts, options, TPEs, dead cap)
- Team loading with fallback chain (coded but not used)
- World management (coded but not used)

**What Is Incomplete/Missing**:
- Firestore data population (architect collections empty)
- World system not connected to UI
- All mutations are read-only (no persistence)
- Season advancement has hard-coded values
- Some deprecated code still in use
- Test suite at 66% due to mock issues

**What Must Be Done (Priority Order)**:
1. Populate `architect_baseTeams` and `architect_basePlayers`
2. Wire world system to GMDashboard
3. Add persistence layer for all roster mutations
4. Fix season advancement to use dynamic values
5. Add world management UI
6. Remove deprecated code paths
7. Complete test coverage

**Estimated Effort**:
- Phase 2 (Data Migration): 3-4 days
- Phase 3 (Core Implementation): 5-7 days
- Phase 4 (UI & Polish): 3-5 days
- Total: ~2-3 weeks for production readiness

---

## Related Documentation

- [Implementation Status](./architect-teams-plan/00-IMPLEMENTATION-STATUS.md)
- [Combined Summary](../architect-plan-summary/COMBINED-SUMMARY.md)
- [Target Schema](./architect-teams-plan/03-TARGET-SCHEMA.md)
- [Save/Load Logic](./architect-teams-plan/05-SAVE-LOAD-LOGIC.md)
- [Test Status](../tests/architect/TEST_STATUS.md)
