# PST_PHASE_16_SEASONMANAGER_ENTITLEMENTS_PREFLIGHT_RETURN_PACKAGE.md

**Phase**: 16 — SeasonManager Entitlement Awareness (Preflight)
**Status**: PREFLIGHT COMPLETE
**Date**: 2026-02-01

---

## 1) Executive Summary

SeasonManager (`src/features/architect/utils/seasonManager.js`) currently reads/writes legacy `team.draftPicks[]` arrays for draft pick inventory during season advance. The Trade Machine (Phases 14-15) and Stepien validation (Phase 13) already use entitlements SSOT exclusively. This preflight maps all pick-related dependencies in SeasonManager and proposes a minimal migration to use entitlements instead.

**Key Finding**: SeasonManager's pick logic is isolated to 4 functions totaling ~280 lines. A single projection helper can convert entitlements to the legacy draftPick shape these functions expect, enabling a non-breaking migration.

**Recommended Approach**: Create `projectEntitlementsToSeasonManagerView()` helper and wire it into `processTeamSeasonTransitionWithOptions()`. Phase 16.1 is READ-ONLY (no entitlement writes).

---

## 2) Entry Point Table

| File Path | Function Name | Called By | Inputs Shape | Outputs |
|-----------|---------------|-----------|--------------|---------|
| `seasonManager.js:487-648` | `advanceSeasonInWorld()` | UI controllers, tests | `worldId, options: { optionDecisions, fromSeason?, toSeason? }` | `{ success, fromSeason, toSeason, updatedTeams, summary, draftResolutionInfo }` |
| `seasonManager.js:663-926` | `processTeamSeasonTransitionWithOptions()` | `advanceSeasonInWorld()` | `teamData, fromSeason, toSeason, optionDecisions, resolutionContext` | `{ updatedTeam, teamSummary }` |
| `seasonManager.js:1108-1209` | `updateDraftPicksWithStepien()` | `processTeamSeasonTransitionWithOptions()` | `teamData, fromSeason, toSeason` | `{ hasChanges, draftPicks[], stepienUpdates[] }` |
| `seasonManager.js:1242-1316` | `resolveDraftPickSwapsForYear()` | `processTeamSeasonTransitionWithOptions()` | `team, draftYear, positionsMap, opts` | `team` with updated `draftPicks[]` |
| `seasonManager.js:1340-1409` | `resolveDraftPickConveyanceForYear()` | `processTeamSeasonTransitionWithOptions()` | `team, draftYear, positionsMap, opts` | `team` with updated `draftPicks[]` |
| `seasonManager.js:437-464` | `updateDraftPicks()` | Legacy `processTeamSeasonTransition()` | `teamData, fromSeason, toSeason` | `{ hasChanges, draftPicks[] }` |

---

## 3) Pick Dependency Matrix (R/W)

| Function | `draftPicks[]` | `pick.year` | `pick.round` | `pick.isSwap` | `pick.swapWithTeamId` | `pick.conveyance` | `pick.resolved` | `pick.stepienBlocked` | `pick.status` |
|----------|----------------|-------------|--------------|---------------|----------------------|-------------------|-----------------|----------------------|---------------|
| `updateDraftPicksWithStepien()` | R | R | R | - | - | - | - | **W** | **W** |
| `resolveDraftPickSwapsForYear()` | R | R | R | R | R | - | **W** | - | - |
| `resolveDraftPickConveyanceForYear()` | R | R | R | - | - | R | - | - | **W** |
| `updateDraftPicks()` (legacy) | R | R | - | - | - | - | - | - | **W** |

**Additional Fields Written**:

- `resolveDraftPickSwapsForYear()`: `resolvedOwner`, `resolvedPosition`, `resolutionMeta`
- `resolveDraftPickConveyanceForYear()`: `conveyanceResult`
- `updateDraftPicksWithStepien()`: `stepienReason`

---

## 4) Entitlement Replacement Map

| Legacy Field | Replacement Source | Resolution Required | Notes |
|--------------|-------------------|---------------------|-------|
| `team.draftPicks[]` | `resolveEntitlementsForTeam(worldId, teamCode)` | Yes - async Firestore call | Returns `EffectiveEntitlement[]` |
| `pick.year` | `entitlement.seasonYear` | Direct mapping | Integer year (2026, 2027...) |
| `pick.round` | `entitlement.round` | Direct mapping | Integer (1 or 2) |
| `pick.isSwap` | `entitlement.kind === 'swap_right'` | Derived | Boolean |
| `pick.swapWithTeamId` | Parse from `entitlement.swapControllerPickId` | Derived | Format: `"LAL_2027_1st"` → `"LAL"` |
| `pick.originalTeam` | Parse from `entitlement.underlyingPickId` | Derived | Format: `"BOS_2026_1st"` → `"BOS"` |
| `pick.owner` / `pick.currentOwner` | `entitlement.holderTeam` | Direct mapping | 3-letter team code |
| `pick.conveyance` | `resolvePickRulesByIds([underlyingPickId])` | Yes - async call | Returns `PickRuleDoc` with `protections[]`, `conditions[]` |
| `pick.protection` | `pickRule.protections[0].description` | Derived from pick rules | Human-readable string |
| `pick.swapType` | Default to `'best_of'` | Conservative default | Not explicitly stored in entitlements |

**Remaining Unknowns**:

- `swapType` is not stored in entitlements; default `'best_of'` is conservative (reserves year for Stepien)
- Lottery positions (`positionsMap`) come from external source (`getDraftPositionsMap()`) - unchanged

---

## 5) Minimal Intermediate Model

**Proposed Name**: `SeasonManagerPickView`

**Purpose**: Read-only derived view that projects entitlements into legacy draftPick-compatible shape.

```typescript
interface SeasonManagerPickView {
  // Core identity
  id: string;                    // Entitlement ID
  year: number;                  // seasonYear
  round: number;                 // 1 or 2

  // Ownership
  owner: string;                 // holderTeam (current)
  currentOwner: string;          // holderTeam (alias)
  originalTeam: string;          // Parsed from underlyingPickId

  // Swap data
  isSwap: boolean;               // kind === 'swap_right'
  swapType?: 'best_of' | 'worst_of';  // Default 'best_of'
  swapWithTeamId?: string;       // Parsed from swapControllerPickId

  // Protection (from pick rules)
  protection?: string;           // Human-readable
  conveyance?: {                 // From pick rules conditions
    conditions: object;
  };

  // Status flags (writable)
  status: string;                // 'owned' | 'available' | 'future'
  resolved: boolean;             // For swap resolution
  resolvedOwner?: string;
  resolvedPosition?: number;
  stepienBlocked: boolean;
  stepienReason?: string;
  conveyanceResult?: object;

  // Debug metadata
  _sourceEntitlementId: string;
  _sourceKind: string;
  _underlyingStatus?: string;
}
```

**Derivation Flow**:

1. Call `resolveEntitlementsForTeam(worldId, teamCode)` → `EffectiveEntitlement[]`
2. Extract all `underlyingPickId` values
3. Call `resolvePickRulesByIds(pickIds)` → `Map<pickId, PickRuleDoc>`
4. Project each entitlement to `SeasonManagerPickView` via helper function
5. Return array for SeasonManager functions to consume

---

## 6) Phase 16.1 Proposed Execution Checklist

### Step 1: Create `seasonManagerProjection.js` helper

- **File**: `src/features/architect/utils/entitlements/seasonManagerProjection.js`
- **Function**: `projectEntitlementsToSeasonManagerView({ entitlements, pickRulesById, teamCode })`
- **Returns**: `SeasonManagerPickView[]`
- **LOC**: ~100 lines

### Step 2: Wire helper into `processTeamSeasonTransitionWithOptions()`

- **Location**: `seasonManager.js:663-670` (function entry)
- **Change**: Add entitlement resolution and projection calls
- **Store as**: `team._derivedDraftPicks` for downstream functions
- **Pattern**: Dual-read - prefer derived, fallback to legacy `draftPicks`

### Step 3: Update `updateDraftPicksWithStepien()` to accept derived view

- **Location**: `seasonManager.js:1111`
- **Change**: `const draftPicks = teamData._derivedDraftPicks || teamData.draftPicks || []`
- **Impact**: ~3 lines changed

### Step 4: Add Phase 16.1 guardrail test suite

- **File**: `src/tests/architect/phase16_seasonmanager_entitlements_ssot.test.js`
- **Tests**:
  - Projection produces correct shape
  - Stepien from entitlements matches legacy
  - Season advance with entitlements produces same output

### Step 5: Add deprecation notices

- **Location**: Top of `seasonManager.js`
- **Content**: Phase 16 migration notice

---

## 7) Acceptance Criteria (Phase 16.1)

| Criterion | Validation Method |
|-----------|-------------------|
| `projectEntitlementsToSeasonManagerView` returns empty array for empty input | Unit test assertion |
| `projectEntitlementsToSeasonManagerView` maps `seasonYear` → `year` correctly | Unit test assertion |
| `projectEntitlementsToSeasonManagerView` sets `isSwap=true` for `swap_right` kind | Unit test assertion |
| `projectEntitlementsToSeasonManagerView` parses `originalTeam` from `underlyingPickId` | Unit test assertion |
| `projectEntitlementsToSeasonManagerView` includes conveyance from pick rules | Unit test assertion |
| Existing `seasonSwapResolution.test.js` passes with no changes | Test run |
| Existing `stepienObligations.test.js` passes with no changes | Test run |
| Season advance 2025-26 → 2026-27 produces identical Stepien flags | Integration test |

---

## 8) Validation Plan (Phase 16.1)

### Pre-Implementation Validation

```bash
# Run existing season advance tests
npm test -- --testPathPattern="seasonSwapResolution|phase5DraftPositions|stepienObligations"
```

### Post-Implementation Validation

```bash
# Run new Phase 16.1 guardrail tests
npm test -- --testPathPattern="phase16_seasonmanager"

# Run full Stepien test suite
npm test -- --testPathPattern="stepien"

# Verify no regressions
npm test -- --testPathPattern="seasonManager|tradeMachine"
```

### Manual Validation

1. Load a world with active trades in Trade Machine
2. Execute season advance via UI
3. Verify Stepien flags appear correctly on pick cards
4. Verify swap resolution produces expected outcomes

---

## 9) Stop Conditions / Unknowns

### Stop Conditions

- If `resolveEntitlementsForTeam()` returns empty for teams that should have picks → investigate data sync
- If Stepien flags differ between entitlement-derived and legacy → debug projection logic before proceeding
- If Firestore read latency exceeds 500ms per team → implement caching strategy

### Unknowns Requiring Resolution

| Unknown | Impact | Mitigation |
|---------|--------|------------|
| `swapType` not in entitlements | Medium | Default to `'best_of'` (conservative) |
| Some entitlements may lack pick rules | Low | Return `null` for protection gracefully |
| World-specific entitlement overrides | Low | `resolveEntitlementsForTeam` already handles |
| Test fixtures use legacy `draftPicks` | Medium | Dual-read pattern preserves backward compat |

---

## 10) Master Doc Update Confirmation

**Action Required**: Add Phase 16 row to `docs/team-scrape/PST_PICK_LEDGER_MASTER_PLAN.md` Phase Status table:

```markdown
| Phase 16     | SeasonManager Entitlement Awareness (Preflight) | IN_PROGRESS | 2026-02-01 |
```

**Location**: After Phase 15 row in the Phase Status table (around line 55).

**Note**: Do NOT mark COMPLETE until Phase 16.1 execution is verified.

---

## Appendix A: Grep Evidence (Pick Field Locations)

### `draftPicks` Array Access

```
seasonManager.js:1111    const draftPicks = [...(teamData.draftPicks || [])]
seasonManager.js:1258    if (!team?.draftPicks || !Array.isArray(team.draftPicks))
seasonManager.js:1264    const updatedPicks = team.draftPicks.map((pick) => {
seasonManager.js:1314    draftPicks: updatedPicks,
seasonManager.js:1356    if (!team?.draftPicks || !Array.isArray(team.draftPicks))
seasonManager.js:1362    const updatedPicks = team.draftPicks.map((pick) => {
seasonManager.js:439     const draftPicks = [...(teamData.draftPicks || [])]
```

### Pick Field Reads

```
seasonManager.js:1120    pick.round === 1 || pick.round === '1'
seasonManager.js:1127    pick.currentOwner === teamCode
seasonManager.js:1128    pick.owner === teamCode && !pick.tradedTo
seasonManager.js:1130    pick.originalTeam === teamCode
seasonManager.js:1266    pick.isSwap !== true
seasonManager.js:1280    pick.year !== draftYear
seasonManager.js:1285    pick.resolved === true
seasonManager.js:1290    pick.swapWithTeamId
seasonManager.js:1295    pick.originalTeam
seasonManager.js:1383    pick.conveyance && pick.conveyance.conditions
seasonManager.js:1388    pick.conveyanceResult
```

### Pick Field Writes

```
seasonManager.js:1184-1196  updatedPick.stepienBlocked, updatedPick.stepienReason
seasonManager.js:1156       updatedPick.status = 'available'
seasonManager.js:1305       resolvePickSwap() → resolved, resolvedOwner, resolvedPosition
seasonManager.js:1394       resolveConveyanceForPick() → conveyanceResult, status
```

---

## Appendix B: Critical File Paths

| Purpose | File Path |
|---------|-----------|
| SeasonManager (target) | `src/features/architect/utils/seasonManager.js` |
| Entitlement Resolver | `src/features/architect/utils/entitlements/entitlementResolver.ts` |
| Pick Rules Resolver | `src/features/architect/utils/entitlements/pickRulesResolver.ts` |
| Existing PickRow Projection | `src/features/architect/utils/entitlements/entitlementPickRowProjection.js` |
| Stepien Entitlement Utils | `src/features/architect/utils/tradeMachine/utils/stepienEntitlementUtils.js` |
| Schema | `src/schemas/architect.ts` |
| Swap Resolution | `src/features/architect/utils/tradeMachine/utils/swapResolution.js` |
| Conveyance Resolution | `src/features/architect/utils/tradeMachine/utils/conveyanceResolution.js` |

---

**END OF RETURN PACKAGE**
