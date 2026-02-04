# PST Phase 17: Entitlement Resolution Engine Master Doc

**MODE**: MASTER DOC (Doc-First source of truth)  
**DATE**: 2026-02-04  
**STATUS**: IN_PROGRESS (Phase 17.1 Complete)  
**OWNER**: architect/entitlements  
**PARENT DOC**: [PST_PICK_LEDGER_MASTER_PLAN.md](./PST_PICK_LEDGER_MASTER_PLAN.md)

---

## Phase Status

| Phase | Description                      | Status                 | Date       |
| ----- | -------------------------------- | ---------------------- | ---------- |
| 17.1  | Protections + Simple Conveyance  | ✅ COMPLETE — VERIFIED | 2026-02-04 |
| 17.2  | Best-of 2-Team Swap              | ✅ COMPLETE — VERIFIED | 2026-02-04 |
| 17.3  | Multi-Year Ladders + Conversion  | ⏳ NOT STARTED         | -          |
| 17.4  | Multi-Team Pools + Chained Swaps | ⏳ NOT STARTED         | -          |
| 17.5  | Ranked Conveyance + Priority     | ⏳ NOT STARTED         | -          |

---

## Executive Summary

Phase 17 implements the **Entitlement Resolution Engine** - the system that determines final pick ownership when draft positions are known. This engine handles:

- **Protections**: top-N, lottery, multi-year ladders
- **Conveyance**: conditional transfer, roll-forward, conversion to 2RP
- **Swaps**: best-of/worst-of between 2 teams, pool-based swaps
- **Ranked Conveyance**: priority ordering when multiple obligations exist

The DARE (Draft Asset Resolution Engine) subsystem already exists with partial implementations. Phase 17 fills gaps for production-grade resolution with deterministic behavior.

---

## 1. File Map + Call Graph

### 1.1 Core DARE Files (Entitlement-Based Resolution)

| File                                                                            | Purpose                                       | Status      |
| ------------------------------------------------------------------------------- | --------------------------------------------- | ----------- |
| `src/features/architect/utils/entitlements/dare/index.ts`                       | Barrel exports for DARE                       | ✅ Complete |
| `src/features/architect/utils/entitlements/dare/types.ts`                       | TypeScript interfaces for DARE                | ✅ Complete |
| `src/features/architect/utils/entitlements/dare/dareResolver.ts`                | Core orchestrator - `resolveAllDraftAssets()` | ✅ Partial  |
| `src/features/architect/utils/entitlements/dare/conveyanceResolutionAdapter.ts` | Conveyance resolution for entitlements        | ✅ Partial  |
| `src/features/architect/utils/entitlements/dare/swapResolutionAdapter.ts`       | Swap resolution for entitlements              | ✅ Partial  |
| `src/features/architect/utils/entitlements/dare/protectionLadderFactory.ts`     | Build protection ladders from pickRules       | ✅ Complete |
| `src/features/architect/utils/entitlements/dare/entitlementMutator.ts`          | World-scoped entitlement writes               | ✅ Complete |
| `src/features/architect/utils/entitlements/dare/resolutionReceipt.ts`           | Human-readable resolution summaries           | ✅ Complete |

### 1.2 Legacy Resolution Files (draftPicks-Based)

| File                                                                      | Purpose                      | Reads Legacy?                | Needs Replacement? |
| ------------------------------------------------------------------------- | ---------------------------- | ---------------------------- | ------------------ |
| `src/features/architect/utils/tradeMachine/utils/swapResolution.js`       | Legacy swap resolution       | ✅ Yes (`pick.originalTeam`) | Phase 17.2         |
| `src/features/architect/utils/tradeMachine/utils/conveyanceResolution.js` | Legacy conveyance resolution | ✅ Yes (`pick.conveyance`)   | Phase 17.1         |

### 1.3 Integration Points

| File                                                                   | Function                                   | Role                                          | Reads From                           |
| ---------------------------------------------------------------------- | ------------------------------------------ | --------------------------------------------- | ------------------------------------ |
| `src/features/architect/utils/seasonManager.js:636`                    | `advanceSeasonInWorld()`                   | Calls DARE during season advance              | entitlements                         |
| `src/features/architect/utils/seasonManager.js:571`                    | `getDraftPositionsMap()`                   | Fetches lottery positions                     | `world.draftPositionsByYear`         |
| `src/features/architect/utils/seasonManager.js:777-825`                | `processTeamSeasonTransitionWithOptions()` | Projects entitlements to `_derivedDraftPicks` | entitlements                         |
| `src/features/architect/utils/entitlements/seasonManagerProjection.js` | `projectEntitlementsToSeasonManagerView()` | READ-ONLY projection layer                    | entitlements + pickRules             |
| `src/features/architect/utils/entitlements/pickRulesResolver.ts`       | `resolvePickRulesByIds()`                  | Fetches protection/condition rules            | `architect_basePickRules`            |
| `src/features/architect/utils/entitlements/entitlementResolver.ts`     | `resolveEntitlementsForTeam()`             | Merges base + world entitlements              | `architect_baseEntitlements` + world |

### 1.4 Call Graph: Season Advance → DARE

```
advanceSeasonInWorld(worldId)
├─ getDraftPositionsMap(worldId, draftYear)  → positionsMap
├─ getLeague(worldId)                        → teams[]
├─ FOR EACH team:
│   ├─ resolveEntitlementsForTeam()          → entitlements[]
│   ├─ resolvePickRulesByIds()               → pickRulesById
│   └─ projectEntitlementsToSeasonManagerView() → _derivedDraftPicks
├─ resolveAllDraftAssets(db, dareInput)      ← DARE ENTRY POINT
│   ├─ buildProtectionLadder()               → ladders per entitlement
│   ├─ resolveConveyanceForEntitlement()     → conveyed/rolled/converted
│   ├─ resolveSwapForEntitlement()           → swap_resolved
│   ├─ buildEntitlementWritesFromResolution() → DAREEntitlementWrite[]
│   └─ buildTeamUpdatesFromResolutions()     → DARETeamUpdate[]
└─ applyDAREResultsToBatch()                 → Firestore writes
```

---

## 2. Schema Inventory

### 2.1 Entitlement Asset Schema (`EntitlementAssetZ`)

**Source**: `src/schemas/architect.ts:12-37`

| Field                     | Type                                                     | Used For                         | Present?          |
| ------------------------- | -------------------------------------------------------- | -------------------------------- | ----------------- |
| `id`                      | `string`                                                 | Unique entitlement identifier    | ✅                |
| `holderTeam`              | `TeamCodeZ`                                              | Current owner of entitlement     | ✅                |
| `seasonYear`              | `number`                                                 | Draft year this applies to       | ✅                |
| `round`                   | `number`                                                 | 1 or 2                           | ✅                |
| `kind`                    | `'pick_ownership' \| 'conveyance_right' \| 'swap_right'` | Entitlement type                 | ✅                |
| `description`             | `string`                                                 | Human-readable description       | ✅                |
| `underlyingPickId`        | `string?`                                                | e.g., `LAL_2027_1st`             | ✅                |
| `poolUnderlyingPickIds`   | `string[]?`                                              | For ranked conveyance pools      | ✅                |
| `receivesRank`            | `number[]?`                                              | e.g., `[1]` for "most favorable" | ✅                |
| `receivesComparator`      | `'more_favorable' \| 'less_favorable' \| 'middle'?`      | Pool selection logic             | ✅                |
| `swapControllerPickId`    | `string?`                                                | Controller's pick for swap       | ✅                |
| `swapTargetDefinition`    | `string?`                                                | "Option to swap with MIL pool"   | ✅                |
| `underlyingStatus`        | `'pooled' \| 'encumbered' \| 'clean'?`                   | Whether pick is contested        | ✅                |
| `coveredByEntitlementIds` | `string[]?`                                              | Links to covering rights         | ✅                |
| `resolved`                | `boolean?`                                               | Whether already resolved         | ✅ (world-scoped) |

### 2.2 Pick Rules Schema (`PickRuleDoc`)

**Source**: `src/features/architect/utils/entitlements/pickRulesResolver.ts:25-48`

| Field                          | Type                                                      | Used For                   | Present? |
| ------------------------------ | --------------------------------------------------------- | -------------------------- | -------- |
| `pickId`                       | `string`                                                  | e.g., `LAL_2027_1st`       | ✅       |
| `seasonYear`                   | `number`                                                  | Draft year                 | ✅       |
| `round`                        | `1 \| 2`                                                  | Round number               | ✅       |
| `protections`                  | `PickRuleProtection[]?`                                   | Protection tiers           | ✅       |
| `protections[].type`           | `'top_n' \| 'range' \| 'lottery'`                         | Protection type            | ✅       |
| `protections[].protectedRange` | `string?`                                                 | e.g., `"1-3"`              | ✅       |
| `protections[].appliesToYears` | `number[]?`                                               | Which years                | ✅       |
| `conditions`                   | `PickRuleCondition[]?`                                    | Swap/conveyance conditions | ✅       |
| `conditions[].kind`            | `'swap' \| 'swap_right' \| 'conveys' \| 'did_not_convey'` | Condition type             | ✅       |
| `conditions[].relatedPickIds`  | `string[]?`                                               | e.g., conversion target    | ✅       |
| `conditions[].appliesToYears`  | `number[]?`                                               | Which years                | ✅       |
| `conditions[].controller`      | `string?`                                                 | Swap controller team       | ✅       |

### 2.3 Field Availability Matrix

| Feature                 | Field(s) Used                                    | Source      | Present? | Gap?                     |
| ----------------------- | ------------------------------------------------ | ----------- | -------- | ------------------------ |
| **Protection top-N**    | `protections[].type='top_n'`, `protectedRange`   | pickRules   | ✅       | None                     |
| **Protection lottery**  | `protections[].type='lottery'`                   | pickRules   | ✅       | None                     |
| **Multi-year ladder**   | `protections[].appliesToYears`                   | pickRules   | ✅       | None                     |
| **Roll forward**        | `buildProtectionLadder()` → `ifTriggered='roll'` | DARE        | ✅       | None                     |
| **Conversion to 2RP**   | `conditions[].relatedPickIds` with `2nd`         | pickRules   | ✅       | None                     |
| **Swap best_of 2-team** | `swapControllerPickId`, `swapTargetDefinition`   | entitlement | ✅       | None                     |
| **Swap worst_of**       | `swapType` or parsed from description            | entitlement | ✅       | None                     |
| **Swap 3+ team pool**   | `poolUnderlyingPickIds`                          | entitlement | ✅       | Resolution logic missing |
| **Ranked conveyance**   | `receivesRank`, `receivesComparator`             | entitlement | ✅       | Resolution logic missing |
| **Priority ordering**   | (not present)                                    | -           | ❌       | Need priority field      |

---

## 3. Phase 17 Engine Interface

### 3.1 Core Function Signatures

```typescript
// Main entry point (already exists in dareResolver.ts)
function resolveAllDraftAssets(
  db: Firestore,
  input: DAREInput
): Promise<DAREOutput>;

// Input contract
interface DAREInput {
  worldId: string;
  draftYear: number;
  positionsMap: Record<string, number>; // teamCode → position (1-60)
  teams: DARETeamInput[];
  nowIso?: string;
  method?: 'lottery' | 'season_advance' | 'manual';
  entitlementsByTeam?: Map<string, EffectiveEntitlement[]>;
  pickRulesById?: Record<string, PickRuleDoc>;
}

// Output contract
interface DAREOutput {
  success: boolean;
  error?: string;
  teamEntitlementIdUpdates: DARETeamUpdate[];
  entitlementDocWrites: DAREEntitlementWrite[];
  resolutionReceipt: DAREResolutionReceipt;
  meta: DAREMeta;
}
```

### 3.2 Resolution Outcomes

```typescript
type EntitlementResolutionOutcome =
  | 'conveyed' // Pick conveyed to receiving team
  | 'rolled' // Protection triggered, rolled to next year
  | 'converted' // Protection triggered, converted to 2RP
  | 'swap_resolved' // Swap determined winner
  | 'expired' // Final year reached, must convey
  | 'unchanged'; // No resolution needed
```

### 3.3 Determinism Rules

1. **Stable ordering**: Entitlements processed in `id` alphabetical order within each team
2. **Tie-breaks for swaps**: Controller team (teamA) wins ties
3. **Priority for conflicts**: Lower `receivesRank[0]` wins (most favorable = 1)
4. **Resolution order**: Conveyance first → Swaps second (per DARE design)

---

## 4. Behavior Matrix

### 4.1 Protections

| Pattern               | Inputs                                                           | Resolution Steps              | Output                | Edge Cases                    | Test Required              |
| --------------------- | ---------------------------------------------------------------- | ----------------------------- | --------------------- | ----------------------------- | -------------------------- |
| **Top-N protected**   | `protections[].type='top_n'`, `protectedRange='1-3'`, position=2 | Check `position <= threshold` | `rolled` to next year | Position exactly at threshold | ✅ `test_topN_at_boundary` |
| **Top-N conveys**     | `protections[].type='top_n'`, `protectedRange='1-3'`, position=7 | Check `position > threshold`  | `conveyed`            | Position just outside         | ✅ `test_topN_conveys`     |
| **Lottery protected** | `protections[].type='lottery'`, position=12                      | Check `position <= 14`        | `rolled`              | Position=14 (boundary)        | ✅ `test_lottery_boundary` |
| **Lottery conveys**   | `protections[].type='lottery'`, position=18                      | Check `position > 14`         | `conveyed`            | -                             | ✅ `test_lottery_conveys`  |

### 4.2 Multi-Year Ladders

| Pattern                | Inputs                                                              | Resolution Steps                      | Output                                                  | Edge Cases          | Test Required                 |
| ---------------------- | ------------------------------------------------------------------- | ------------------------------------- | ------------------------------------------------------- | ------------------- | ----------------------------- |
| **Ladder roll Year 1** | `protections: [{year:2027, Top 5}, {year:2028, Top 3}]`, position=4 | Year 2027 triggers → roll to 2028     | `rolled`, `newYear=2028`, `newProtection='Top 3'`       | -                   | ✅ `test_ladder_roll_y1`      |
| **Ladder roll Year 2** | Same ladder, year=2028, position=2                                  | Year 2028 triggers → unprotected 2029 | `rolled`, `newYear=2029`, `newProtection='Unprotected'` | Final year behavior | ✅ `test_ladder_roll_y2`      |
| **Ladder convey mid**  | Ladder active, position outside threshold                           | Conveys immediately                   | `conveyed`                                              | -                   | ✅ `test_ladder_convey_mid`   |
| **Ladder final year**  | Final tier, position in range                                       | `ifTriggered='cancel'`                | `expired` (cancel)                                      | No more rolls       | ✅ `test_ladder_final_cancel` |

### 4.3 Conversions

| Pattern                   | Inputs                                                           | Resolution Steps                         | Output                            | Edge Cases              | Test Required                |
| ------------------------- | ---------------------------------------------------------------- | ---------------------------------------- | --------------------------------- | ----------------------- | ---------------------------- |
| **Convert to 2RP**        | `conditions[].kind='conveys'`, `relatedPickIds=['XXX_2027_2nd']` | Protection triggers → convert            | `converted`, `convertedToRound=2` | New entitlement created | ✅ `test_convert_to_2rp`     |
| **Convert at final year** | Final tier with conversion                                       | Protection triggers → convert (not roll) | `converted`                       | -                       | ✅ `test_convert_final_tier` |

### 4.4 Swaps (2-Team)

| Pattern                   | Inputs                                                           | Resolution Steps               | Output                              | Edge Cases             | Test Required              |
| ------------------------- | ---------------------------------------------------------------- | ------------------------------ | ----------------------------------- | ---------------------- | -------------------------- |
| **Best-of swap**          | `kind='swap_right'`, controller=NOP(pos=10), target=MIL(pos=5)   | Compare positions, lower wins  | `swap_resolved`, `swapWinner='MIL'` | Tie goes to controller | ✅ `test_swap_best_of`     |
| **Worst-of swap**         | `swapType='worst_of'`, controller=NOP(pos=10), target=MIL(pos=5) | Compare positions, higher wins | `swap_resolved`, `swapWinner='NOP'` | -                      | ✅ `test_swap_worst_of`    |
| **Swap with tie**         | Controller pos=10, target pos=10                                 | Tie-break: controller wins     | `swapWinner` = controller           | Deterministic          | ✅ `test_swap_tie_break`   |
| **Missing position data** | Target team not in positionsMap                                  | Return `unchanged` with reason | `unchanged`                         | Guardrail              | ✅ `test_swap_missing_pos` |

### 4.5 Swaps (3+ Team / Pool) — Phase 17.4

| Pattern              | Inputs                                            | Resolution Steps              | Output                        | Edge Cases          | Test Required             |
| -------------------- | ------------------------------------------------- | ----------------------------- | ----------------------------- | ------------------- | ------------------------- |
| **Best-of 3 teams**  | `poolUnderlyingPickIds=['A_1st','B_1st','C_1st']` | Find min position across pool | `swapWinner` = best team      | All 3 same position | ⏳ `test_pool_best_of_3`  |
| **Worst-of 3 teams** | Same + `swapType='worst_of'`                      | Find max position across pool | `swapWinner` = worst team     | -                   | ⏳ `test_pool_worst_of_3` |
| **Chained swaps**    | A↔B and B↔C in same year                        | Topological resolution order  | Resolve A↔B first, then B↔C | Circular detection  | ⏳ `test_chained_swaps`   |

### 4.6 Ranked Conveyance / Priority

| Pattern                            | Inputs                                                    | Resolution Steps                | Output               | Edge Cases          | Test Required                    |
| ---------------------------------- | --------------------------------------------------------- | ------------------------------- | -------------------- | ------------------- | -------------------------------- |
| **Most favorable**                 | `receivesComparator='more_favorable'`, `receivesRank=[1]` | Sort pool by position, take min | Receives best pick   | -                   | ⏳ `test_ranked_most_favorable`  |
| **Least favorable**                | `receivesComparator='less_favorable'`, `receivesRank=[1]` | Sort pool by position, take max | Receives worst pick  | -                   | ⏳ `test_ranked_least_favorable` |
| **Multiple obligations same year** | 2 entitlements for same underlying pick                   | Priority by... (TBD)            | Higher priority wins | Need priority field | ⏳ `test_priority_conflict`      |

### 4.7 Guardrails / Edge Cases

| Pattern                      | Inputs                                   | Resolution Steps         | Output               | Test Required                |
| ---------------------------- | ---------------------------------------- | ------------------------ | -------------------- | ---------------------------- |
| **Already resolved**         | `entitlement.resolved=true`              | Skip, return `unchanged` | `unchanged`          | ✅ `test_skip_resolved`      |
| **Wrong year**               | `entitlement.seasonYear` ≠ `draftYear`   | Skip, return `unchanged` | `unchanged`          | ✅ `test_skip_wrong_year`    |
| **Missing underlyingPickId** | `underlyingPickId=null`                  | Cannot parse team        | `unchanged` + reason | ✅ `test_missing_underlying` |
| **Invalid team in pool**     | `poolUnderlyingPickIds` has unknown team | Skip that pick in pool   | Partial resolution   | ⏳ `test_partial_pool`       |

---

## 5. Phased Execution Plan

### Phase 17.1: Protections + Simple Conveyance (Week 1)

**Scope**:

- Top-N protections (position ≤ threshold)
- Lottery protections (1-14)
- Simple conveyance (convey when outside protection)
- Single-obligation picks only

**Acceptance Criteria**:

- [ ] `protectionTriggers()` correctly evaluates Top 3, Top 5, Top 10, Lottery
- [ ] `resolveConveyanceForEntitlement()` returns `conveyed` or `rolled`

- [ ] Protection ladder builds correctly from `pickRules.protections[]`
- [ ] 6 tests passing: `test_topN_*`, `test_lottery_*`

**Files to Modify**:

- None (DARE already implements this)

**Files to Verify**:

- `conveyanceResolutionAdapter.ts` - verify logic completeness
- `protectionLadderFactory.ts` - verify ladder building

---

### Phase 17.2: Best-of 2-Team Swap (Week 1)

**Scope**:

- 2-team `best_of` swaps

- 2-team `worst_of` swaps
- Tie-break rules (controller wins)

**Acceptance Criteria**:

- [ ] `resolveSwapForEntitlement()` returns `swap_resolved` with winner

- [ ] Swap type parsed from `swapType` field or description
- [ ] Controller team parsed from `swapControllerPickId`
- [ ] Target team parsed from `swapTargetDefinition` or `underlyingPickId`

- [ ] 4 tests passing: `test_swap_*`

**Files to Modify**:

- None (DARE already implements this)

**Files to Verify**:

- `swapResolutionAdapter.ts` - verify 2-team logic

---

### Phase 17.3: Multi-Year Ladders + Conversion (Week 2)

**Scope**:

- Multi-year protection ladders (2027 Top 10 → 2028 Top 5 → 2029 Unprotected)

- Conversion to 2nd round pick
- Final year behavior (`ifTriggered='cancel'`)

**Acceptance Criteria**:

- [ ] Ladder iterates correctly across years
- [ ] `rolled` creates new entitlement for next year with updated protection
- [ ] `converted` creates new entitlement with `round=2`
- [ ] Original entitlement marked `resolved=true`
- [ ] 4 tests passing: `test_ladder_*`, `test_convert_*`

**Files to Modify**:

- `conveyanceResolutionAdapter.ts` - verify ladder iteration
- `entitlementMutator.ts` - verify `buildRolledEntitlementDoc`, `buildConvertedEntitlementDoc`

---

### Phase 17.4: Multi-Team Pools + Chained Swaps (Week 3)

**Scope**:

- 3+ team pool swaps (`poolUnderlyingPickIds`)
- Chained swaps (A↔B, B↔C in same year)
- Circular swap detection

**Acceptance Criteria**:

- [ ] Pool swap finds best/worst across all pool teams

- [ ] Chained swaps resolve in topological order
- [ ] Circular chains return error
- [ ] 3 tests passing: `test_pool_*`, `test_chained_*`

**Files to Modify**:

- `swapResolutionAdapter.ts` - add pool resolution logic
- `dareResolver.ts` - add topological sort for chained swaps

---

### Phase 17.5: Ranked Conveyance + Priority (Week 3)

**Scope**:

- `receivesRank` / `receivesComparator` resolution
- Priority ordering for conflicting obligations
- Guardrails for "WARN" classified entitlements

**Acceptance Criteria**:

- [ ] `more_favorable` selects lowest position from pool
- [ ] `less_favorable` selects highest position from pool
- [ ] Priority ordering prevents double-counting
- [ ] 3 tests passing: `test_ranked_*`, `test_priority_*`

**Files to Modify**:

- `conveyanceResolutionAdapter.ts` - add ranked resolution logic
- `dareResolver.ts` - add priority ordering pass

---

## 6. Test & Fixture Strategy

### 6.1 Test Location

| Test Type | Location | Framework |

|-----------|----------|-----------|
| Unit tests (DARE) | `src/tests/architect/dare/` | Vitest |
| Integration tests | `src/tests/architect/` | Vitest |
| Fixtures | `src/tests/fixtures/dare/` | JSON |

### 6.2 Existing Test Coverage

| File                                  | Tests | Coverage                     |
| ------------------------------------- | ----- | ---------------------------- |
| `dareResolver.test.js`                | 10+   | Mocked adapters              |
| `conveyanceResolutionAdapter.test.js` | 12+   | Protection ladder evaluation |
| `swapResolutionAdapter.test.js`       | 8+    | 2-team swap resolution       |
| `protectionLadderFactory.test.js`     | 15+   | Ladder building + parsing    |

### 6.3 Required Test Cases (12 Minimum)

| # | Test Name | Category | Setup | Expected Output |

|---|-----------|----------|-------|-----------------|
| 1 | `test_topN_at_boundary` | Protection | Top 3 protected, position=3 | `rolled` |
| 2 | `test_topN_conveys` | Protection | Top 3 protected, position=7 | `conveyed` |
| 3 | `test_lottery_boundary` | Protection | Lottery protected, position=14 | `rolled` |
| 4 | `test_lottery_conveys` | Protection | Lottery protected, position=18 | `conveyed` |
| 5 | `test_ladder_roll_y1` | Ladder | 2027 Top 5 → 2028 Top 3, year=2027, pos=4 | `rolled`, year=2028 |
| 6 | `test_ladder_final_cancel` | Ladder | Final tier, pos in range | `expired` |
| 7 | `test_convert_to_2rp` | Conversion | Has conversion condition, triggers | `converted`, round=2 |
| 8 | `test_convert_final_tier` | Conversion | Final tier with conversion | `converted` |
| 9 | `test_swap_best_of` | Swap | NOP pos=10, MIL pos=5 | winner=MIL |
| 10 | `test_swap_worst_of` | Swap | NOP pos=10, MIL pos=5, worst_of | winner=NOP |
| 11 | `test_swap_tie_break` | Swap | Both pos=10 | winner=controller |
| 12 | `test_skip_resolved` | Guardrail | Already resolved=true | `unchanged` |

### 6.4 Fixture Strategy

**Synthetic World Fixture**:

```json
{
  "worldId": "test-world-phase17",
  "draftYear": 2027,
  "positionsMap": {
    "LAL": 3,
    "BOS": 8,
    "MIA": 15,
    "NOP": 10,
    "MIL": 5,
    "PHI": 12,
    "OKC": 1,
    "HOU": 6,
    "CLE": 20,
    "ATL": 25
  },
  "teams": [
    { "teamCode": "LAL", "entitlementIds": ["ent:LAL:2027:1:own"] },
    { "teamCode": "BOS", "entitlementIds": ["ent:BOS:2027:1:swap:MIL"] }
  ]
}
```

---

## 7. Integration Wiring Diagram

### 7.1 Current Integration (Already Wired)

```

seasonManager.advanceSeasonInWorld()
      │
      ├─► getDraftPositionsMap(worldId, draftYear)
      │       └─► world.draftPositionsByYear[year]
      │
      ├─► FOR EACH team:
      │       └─► processTeamSeasonTransitionWithOptions()
      │               └─► resolveEntitlementsForTeam()

      │               └─► projectEntitlementsToSeasonManagerView()
      │
      ├─► resolveAllDraftAssets(db, dareInput)  ← DARE
      │       ├─► resolveConveyanceForEntitlement()
      │       ├─► resolveSwapForEntitlement()
      │       └─► buildEntitlementWritesFromResolution()
      │
      └─► applyDAREResultsToBatch(db, batch, worldId, dareOutput)
              └─► Firestore writes to:
                  - architect_worlds/{worldId}/entitlements/{id}

                  - architect_worlds/{worldId}/teams/{teamCode}.entitlementIds
```

### 7.2 Engine Granularity Decision

**Decision**: **Per-Year Resolution** (not per-team)

Rationale:

- DARE already runs once per `advanceSeasonInWorld()` call with all teams
- Swaps require cross-team position comparison
- Chained swaps require global ordering
- Per-team would require multiple passes for interdependent resolutions

### 7.3 Entitlements Read Location

**Decision**: Read from **world entitlements** (not base) during season advance

Rationale:

- World may have traded entitlements
- World may have rolled entitlements from prior years

- Base is never modified post-scrape

### 7.4 Phase 17 Write Behavior

| Phase | Write Behavior |
| ----- | -------------- |

| 17.1 | `resolved` flag + resolution metadata → world entitlement |
| 17.1 | New rolled entitlement → world entitlement (new doc) |
| 17.3 | New converted entitlement → world entitlement (new doc) |
| 17.3 | Team `entitlementIds` update → world team snapshot |

---

## 8. Stop Conditions

### 8.1 Blocking Issues (None Found)

| Condition                              | Status | Notes                                        |
| -------------------------------------- | ------ | -------------------------------------------- |
| pickRules lacks protection/ladder data | ✅ OK  | `protections[]` and `appliesToYears` present |

| entitlements lack `underlyingPickId` linkage | ✅ OK | Present on all `pick_ownership` |
| seasonManager depends on fields not in entitlements | ✅ OK | `_derivedDraftPicks` projection handles this |

### 8.2 Known Gaps (Non-Blocking)

| Gap | Impact | Workaround | Phase to Address |

|-----|--------|------------|------------------|
| Multi-team pool resolution not implemented | 3+ team swaps won't resolve | Return `unchanged` with warning | 17.4 |
| Ranked conveyance resolution not implemented | `receivesRank` entitlements won't resolve | Return `unchanged` with warning | 17.5 |
| Priority field for conflicting obligations | Multiple same-year obligations may conflict | First-by-id wins | 17.5 |
| `swapType` field often missing | Default to `best_of` | Already implemented | None |

---

## 9. Key Decisions

### 9.1 Engine Granularity

**Decision**: Per-year (all teams at once)

### 9.2 Priority Ordering

**Decision**: Alphabetical by entitlement ID for determinism

### 9.3 SwapType Default

**Decision**: Default to `best_of` when not specified (conservative for receiving team)

### 9.4 Resolution Order

**Decision**: Conveyance first, then swaps (per existing DARE design)

---

## 10. Return Package Link

See: [PST_PHASE_17_ENTITLEMENT_RESOLUTION_ENGINE_PREFLIGHT_RETURN_PACKAGE.md](../return_packages/PST_PHASE_17_ENTITLEMENT_RESOLUTION_ENGINE_PREFLIGHT_RETURN_PACKAGE.md)

---

## Appendix A: Entitlement Kind Reference

| Kind               | Purpose                                | Resolution Behavior                |
| ------------------ | -------------------------------------- | ---------------------------------- |
| `pick_ownership`   | Team owns the pick outright            | Subject to protections/conveyance  |
| `swap_right`       | Right to swap with another team's pick | Resolved via position comparison   |
| `conveyance_right` | Right to receive a pick conditionally  | Resolved via protection evaluation |

---

## Appendix B: Protection Ladder Example

```
LAL 2027 1st (to BOS)
├─ 2027: Top 10 protected → if triggers, roll to 2028
├─ 2028: Top 5 protected → if triggers, roll to 2029
└─ 2029: Unprotected → must convey

If LAL picks at position 8 in 2027:
  → Protection triggers (8 ≤ 10)
  → Rolled to 2028 with "Top 5" protection
  → New entitlement created: ent:BOS:2028:1:conv:LAL
```
