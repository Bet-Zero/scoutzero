# PST Phase 13 — Mutation Entitlement SSOT Preflight Return Package

**MODE**: PREFLIGHT (READ-ONLY)  
**DATE**: 2026-02-01  
**STATUS**: COMPLETE  
**MASTER DOC**: [PST_PICK_LEDGER_MASTER_PLAN.md](../PST_PICK_LEDGER_MASTER_PLAN.md)

---

## A. World Snapshot Draft Asset Write Map

### A.1 — executeTrade: Draft Asset Field Writes

| Field                   | Written by executeTrade? | Write Type   | Source                                | Notes                                                                               |
| ----------------------- | ------------------------ | ------------ | ------------------------------------- | ----------------------------------------------------------------------------------- |
| `entitlementIds`        | ✅ **YES**               | FULL REPLACE | `buildPostTradeTeamsSnapshot()` L217- | Removes outgoing IDs, adds incoming IDs (with toTeamId routing support)             |
| `draftPicks`            | ✅ **YES**               | FULL REPLACE | `buildPostTradeTeamsSnapshot()` L195- | Filters out outgoing picks, adds incoming picks (by year/round/owner match)         |
| `draftPicksInventory`   | ❌ NO                    | —            | —                                     | **NEVER UPDATED** by mutation pipeline; may become stale                            |
| `draftPicksObligations` | ❌ NO                    | —            | —                                     | **NEVER UPDATED** by mutation pipeline; used as fallback for Stepien validation     |
| `draftPicksContested`   | ❌ NO                    | —            | —                                     | **NEVER UPDATED** by mutation pipeline; swaps not explicitly tracked at world level |

**Key Finding**: The mutation pipeline (`tradeContext.js` L195-211, L211-260) correctly updates:

1. `entitlementIds` — Removes outgoing entitlement IDs, adds incoming IDs with proper `toTeamId` routing
2. `draftPicks` — Removes outgoing picks, adds incoming picks using year/round/owner matching

However, the ledger "view" arrays (`draftPicksInventory`, `draftPicksObligations`, `draftPicksContested`) are **NEVER touched** during trades. They remain at their base/initial values and drift from reality.

### A.2 — Other Mutation Types: Draft Asset Writes

| Mutation Type       | Writes Draft Fields? | Fields Written   | Notes                                                        |
| ------------------- | -------------------- | ---------------- | ------------------------------------------------------------ |
| `signFreeAgent`     | ❌ NO                | —                | Contract signing only; no draft asset changes                |
| `waivePlayer`       | ❌ NO                | —                | Player release only; no draft asset changes                  |
| `extendPlayer`      | ❌ NO                | —                | Contract modification only; no draft asset changes           |
| `optionDecision`    | ❌ NO                | —                | Contract option handling only; no draft asset changes        |
| `renounceRights`    | ❌ NO                | —                | Cap hold removal only; no draft asset changes                |
| `signAndTrade`      | ✅ Delegates         | Via executeTrade | Internally calls trade mechanics; inherits same field writes |
| `storeOfferSheet`   | ❌ NO                | —                | RFA mechanics only; no draft asset changes                   |
| `matchOfferSheet`   | ❌ NO                | —                | RFA mechanics only; no draft asset changes                   |
| `declineOfferSheet` | ❌ NO                | —                | RFA mechanics only; no draft asset changes                   |
| `setDeadCap`        | ❌ NO                | —                | Dead cap only; no draft asset changes                        |
| `setExceptions`     | ❌ NO                | —                | Exception management only; no draft asset changes            |

**Finding**: Only `executeTrade` (and `signAndTrade` via delegation) modify draft asset fields.

### A.3 — Write Mechanics Summary

**buildPostTradeTeamsSnapshot() in tradeContext.js:**

```javascript
// L195-211: Legacy draftPicks update (FULL REPLACE)
updatedTeam.draftPicks = [
  ...(team.draftPicks || []).filter(
    (pick) =>
      !outgoingPicks.some(
        (outgoing) =>
          outgoing.year === pick.year &&
          outgoing.round === pick.round &&
          outgoing.owner === pick.owner
      )
  ),
  ...incomingPicks,
];

// L212-260: entitlementIds update (FULL REPLACE with routing)
if (outgoingEntitlementIds.length > 0 || incomingEntitlementIds.length > 0) {
  const currentEntitlementIds = team.entitlementIds || [];
  const newEntitlementIds = [
    ...currentEntitlementIds.filter(
      (id) => !outgoingEntitlementIds.includes(id)
    ),
    ...incomingEntitlementIds,
  ];
  updatedTeam.entitlementIds = [...new Set(newEntitlementIds)];
}
```

**persistWorldMutation() in mutationPipeline.js:**

```javascript
// L2345-2362: Team snapshot persistence (FULL SET, not merge)
for (const { teamCode, team } of computeResult.teamUpdates) {
  // ... sanitization and validation ...
  const sanitizedTeam = removeUndefinedDeep(afterTpeNormalize);
  const teamRef = worldTeamRef(worldId, teamCode);
  batch.set(teamRef, sanitizedTeam); // ← FULL REPLACE, not merge
}
```

---

## B. SSOT Drift Risks

### B.1 — Concrete Drift Scenarios

| #   | Scenario                                                                                                                                                                             | Affected Surface                        | Risk Level   | Manifestation                                                                            |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------- | ------------ | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ---------------------------------------------- | ---- | ----------------------------------------------------------------------- |
| 1   | **Stepien Fallback Mismatch**: Trade executed in world, team's `draftPicksObligations` remains at base value. Stepien validation uses entitlements for one team, legacy for another. | `validateStepien.js` L165 fallback      | **CRITICAL** | Trade may be incorrectly validated as legal/illegal due to inconsistent baseline sources |
| 2   | **UI Legacy Tab Stale**: User opens legacy "Outgoing Picks" view for team that has traded picks via entitlements. `team.picks` (derived from `draftPicks`) shows pre-trade state.    | `OutgoingPicksList.jsx`                 | HIGH         | User sees picks that were already traded away                                            |
| 3   | **draftPicksInventory Drift**: Trade updates `draftPicks` but not `draftPicksInventory`. Code reading `draftPicksInventory` sees stale data.                                         | `firebaseTeamPlanHelpers.js` L167       | HIGH         | Loader fallback chain: `draftPicksInventory                                              |                                                                                       | draftPicks` may mask drift but cause confusion |
| 4   | **Swap Resolution Stale**: `draftPicksContested` never updated. Swap resolution functions operating on world data see pre-trade swap state.                                          | `swapResolution.js`, `seasonManager.js` | HIGH         | Swap owners incorrect after trade; lottery resolution wrong                              |
| 5   | **Test Fixture Divergence**: Tests may use `draftPicksObligations` fixtures that don't match what entitlements-based flow would produce.                                             | `stepienObligations.test.js`            | MEDIUM       | Tests pass but production behavior differs                                               |
| 6   | **useTradeMachine Priority Chain**: Hook uses `draftAssets.picks                                                                                                                     |                                         | draftPicks   |                                                                                          | picks`. If`draftPicks` is stale from world snapshot, user sees wrong available picks. | `useTradeMachine.js` L293, L626                | HIGH | Trade Machine shows incorrect tradeable inventory after world mutations |
| 7   | **schemaAdapter Legacy Pass-through**: `buildTradeTeamInput()` copies `draftPicks` from team state. If state has stale world `draftPicks`, validator gets wrong input.               | `schemaAdapter.js` L94                  | MEDIUM       | Validation runs on stale pick data                                                       |
| 8   | **tradeManager Dual Write**: Legacy `tradeManager.js` L167 also writes `draftPicks`. If both code paths active, writes may conflict or produce inconsistent results.                 | `tradeManager.js` L167                  | LOW          | Dead code path but creates maintenance confusion                                         |

### B.2 — Consumer Analysis (Legacy Pick Fields Still Read)

| File                                                  | Field Read                                                                          | Purpose                       | Entitlements Path Exists?   | Fallback Behavior                                    |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------- | ----------------------------- | --------------------------- | ---------------------------------------------------- |
| `useTradeMachine.js` L293, L626                       | `draftAssets.picks`, `draftPicks`, `picks`                                          | Load tradeable picks          | ✅ Yes (entitlements)       | Falls back to legacy if no entitlements              |
| `firebaseTeamPlanHelpers.js` L164-171                 | `draftPicks`, `draftPicksInventory`, `draftPicksObligations`, `draftPicksContested` | Hydrate base team             | ✅ Yes (entitlementIds)     | Always includes legacy for backward compat           |
| `validateStepien.js` L165                             | `draftPicksObligations`                                                             | Stepien baseline (fallback)   | ✅ Yes (entitlements first) | Uses legacy if `validationEntitlements.length === 0` |
| `swapResolution.js`, `conveyanceResolution.js`        | `team.draftPicks`                                                                   | Resolution input              | ❌ No                       | Operates purely on legacy picks                      |
| `seasonManager.js` L205, L460, L728, L761, L887, etc. | `updatedTeam.draftPicks`, `draftPicksResult.draftPicks`                             | Season advance and resolution | ❌ No                       | Operates purely on legacy picks                      |
| `schemaAdapter.js` L94                                | `teamState.draftPicks`                                                              | Trade input building          | ❌ No                       | Copies legacy field to validator input               |
| `tradeManager.js` L167                                | `updatedTeam.draftPicks`                                                            | Trade result computation      | ❌ No                       | Parallel to mutationPipeline (unused?)               |
| Phase 62 test fixtures                                | `draftPicksInventory`, `draftPicksObligations`, `draftPicksContested`               | Schema validation testing     | N/A                         | Test-only                                            |

---

## C. Phase 13 Execution Plan (Tight)

### Step 1: Establish Field Canonicity (DESIGN DECISION)

**What becomes canonical (SSOT):**

- `entitlementIds` — Array of entitlement IDs owned by team (already updated by trades)
- `draftPicks` — Legacy array, kept in sync for backward compatibility during transition

**What becomes deprecated (kept but not updated):**

- `draftPicksInventory` — Deprecated alias; consumers should read from resolved entitlements
- `draftPicksObligations` — Deprecated; Stepien baseline from entitlements only
- `draftPicksContested` — Deprecated; swap/conveyance info lives in entitlement definitions

### Step 2: Remove Stepien Legacy Fallback (RUNTIME)

**File**: `src/features/architect/utils/tradeMachine/rules/validateStepien.js`

**Change**: Remove L165 fallback to `draftPicksObligations`. Require entitlements for Stepien validation.

**Before (dual mode):**

```javascript
const baseline =
  validationEntitlements.length > 0
    ? buildStepienBaselinePicksFromEntitlements(validationEntitlements)
    : team.draftPicksObligations || [];
```

**After (entitlements SSOT):**

```javascript
const baseline = buildStepienBaselinePicksFromEntitlements(
  validationEntitlements
);
// If no entitlements, baseline is empty (team has full pick inventory)
```

**Stop Condition**: Stepien validation must pass for all 30 teams with entitlements-only baseline.

### Step 3: Add Integration Test for entitlementIds Transfer (TEST)

**File**: `src/tests/architect/phase13_entitlementIds_transfer.test.js` (new)

**Coverage**:

1. After trade, sending team's `entitlementIds` decreases by transferred IDs
2. After trade, receiving team's `entitlementIds` increases by transferred IDs
3. Multi-team trade with `toTeamId` routing: only target team receives ID
4. Trade with mixed assets (entitlements + players): both transfer correctly
5. Re-trade of received entitlement: ID transfers correctly through chain

**Stop Condition**: All 5 test cases pass on emulator.

### Step 4: Validate UI Reads Entitlements Only (TEST)

**File**: `src/tests/architect/phase13_ui_entitlements_only.test.js` (new)

**Coverage**:

1. TradeTeamCard renders `EntitlementPicksList` (not `OutgoingPicksList`) when `team.entitlements.length > 0`
2. After trade mutation, UI shows updated entitlement inventory (not stale picks)
3. Legacy picks tab not rendered when entitlements available

**Stop Condition**: UI tests pass; manual verification in emulator confirms correct display.

### Step 5: Add Deprecation Markers to Schema (TEST-ADJACENT)

**File**: `src/schemas/architect.ts`

**Change**: Add JSDoc deprecation comments to legacy fields:

```typescript
/**
 * @deprecated Use resolved entitlements instead. This field is no longer updated by trades.
 */
draftPicksInventory: z.array(DraftPickZ).optional().default([]),

/**
 * @deprecated Stepien baseline now derived from entitlements. See validateStepien.js.
 */
draftPicksObligations: z.array(DraftPickZ).optional().default([]),

/**
 * @deprecated Swap/conveyance info lives in entitlement definitions.
 */
draftPicksContested: z.array(DraftPickZ).optional().default([]),
```

**Stop Condition**: Build passes; deprecation visible in IDE tooltips.

### Step 6: Update Return Package and Close Phase (DOC)

- Mark Phase 13 COMPLETE in `PST_PICK_LEDGER_MASTER_PLAN.md`
- Create execution return package with test results
- Document any discovered edge cases for Phase 14

---

## D. Summary

### Current State

- ✅ `entitlementIds` correctly transferred during trades (Phase 11.3.2)
- ✅ `draftPicks` correctly transferred during trades (legacy compatibility)
- ❌ `draftPicksInventory`, `draftPicksObligations`, `draftPicksContested` **NEVER updated** by trades
- ❌ Stepien validation has fallback to `draftPicksObligations` (causes SSOT drift)
- ❌ Season resolution functions operate on legacy `draftPicks` only (not entitlement-aware)

### Phase 13 Deliverables

1. Remove Stepien fallback → entitlements-only baseline
2. Add integration tests for entitlementIds transfer correctness
3. Add UI tests confirming entitlements-only rendering
4. Add schema deprecation markers
5. Update master plan

### Out of Scope for Phase 13

- Removing legacy UI components (`OutgoingPicksList`, `TradePickRow`) — Phase 14
- Making `seasonManager.js` entitlement-aware — Future phase
- Removing deprecated schema fields — Phase 15+

---

**END OF RETURN PACKAGE**
