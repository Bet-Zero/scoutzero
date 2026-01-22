# Phase 11.1 Preflight Return Package — Entitlement Trading (Selection + World Save)

**DATE**: 2026-01-21  
**STATUS**: PREFLIGHT (HOTFIX APPLIED 2026-01-22)  
**MODE**: READ-ONLY — NO CODE CHANGES  
**MASTER DOC**: [PST_PICK_LEDGER_MASTER_PLAN.md](./PST_PICK_LEDGER_MASTER_PLAN.md)

---

## CHANGES MADE (Hotfix 2026-01-22)

**Corrected two incorrect assumptions from initial preflight:**

1. **Pooled entitlements ARE tradeable**
   - `conveyance_right` and `swap_right` represent tradeable NBA assets even when underlying reality is "pooled"
   - Only `pick_ownership` with `underlyingStatus='pooled'` should be hidden (already filtered by Phase 11.0 UI)
   - Previous guidance incorrectly stated ALL pooled entitlements must be blocked — now corrected

2. **Removed `toTeamId` routing from Phase 11.1 scope**
   - Phase 11.1 stays minimal: mirror existing `picksOut` semantics
   - Multi-team routing deferred to future phase
   - Apply-trade algorithm now uses simple "incoming from all others" pattern (matches current pick logic)

**Impact**: State shape simplified, validation rules corrected, execution prompt updated.

---

## Goal

Design the safest, minimal implementation plan for **trading Entitlement Assets** in the Trade Machine:

- User can **select** entitlements to send/receive (like picks today)
- Trade Machine state tracks those selections cleanly
- On "Apply Trade" / "Save World Mutation," we **move entitlementIds** between teams in the world
- We do NOT change baseTeams or baseEntitlements
- We do NOT implement lottery resolution

---

## 1. Current Pick Selection Model

### State Location

**File**: [src/features/architect/hooks/useTradeMachine.js](../../src/features/architect/hooks/useTradeMachine.js)

**State Shape** (per team slot, lines 197-211):

```javascript
const teamSlot = {
  team: TeamObject, // full team data including picks, entitlements, etc.
  sends: [], // players selected for trading out (ArchitectPlayer[])
  picksOut: [], // picks selected for trading out (DraftPick[])
};

const [teams, setTeams] = useState([]); // Array of teamSlot objects
```

### Key Functions

| Function                  | Location                           | Purpose                                           |
| ------------------------- | ---------------------------------- | ------------------------------------------------- |
| `togglePick(index, pick)` | `useTradeMachine.js` lines 380-400 | Add/remove pick from `picksOut` for team at index |
| `areSamePick(a, b)`       | `tradeHelpers.js`                  | Compare picks for equality                        |
| `ensurePickId(pick)`      | `pickIdUtils.js`                   | Assign canonical ID if missing                    |

### Pick Toggle Implementation (lines 380-400)

```javascript
const togglePick = useCallback((index, pick) => {
  setTeams((prev) => {
    const newTeams = [...prev];
    const pickWithId = ensurePickId(pick);
    const existingIndex = newTeams[index].picksOut.findIndex((p) =>
      areSamePick(p, pickWithId)
    );

    if (existingIndex >= 0) {
      newTeams[index].picksOut.splice(existingIndex, 1); // Remove
    } else {
      newTeams[index].picksOut = [
        ...newTeams[index].picksOut,
        { ...pickWithId, fromTeamId: newTeams[index].team?.id },
      ];
    }
    return newTeams;
  });
}, []);
```

### UI Flow

1. `TradeEditor.jsx` → passes `togglePick` as prop
2. `TradeTeamCard.jsx` → receives `onTogglePick` prop, passes to `OutgoingPicksList`
3. `OutgoingPicksList.jsx` → maps picks and renders `TradePickRow` with `onToggle`
4. `TradePickRow.jsx` → renders checkbox/toggle, calls `onToggle(pick)` on click

### Current Entitlements Flow (Read-Only)

`TradeTeamCard.jsx` lines 717-735 conditionally renders:

- `EntitlementPicksList` when `team.entitlements?.length > 0`
- `OutgoingPicksList` (legacy) when no entitlements

`EntitlementPicksList` currently does NOT receive toggle handlers — read-only display only.

---

## 2. Trade Commit / Firestore Write Pipeline

### Call Chain

```
TradeEditor.jsx: Apply Trade button
  → exportCurrentTrade()              // (useTradeMachine.js:590-612)
  → onApplyTrade(tradeData)           // Callback from GMDashboard
    → applyTradeToCapSheet(tradeData) // (useArchitectActions.ts:431-594)
      → persistMutation('executeTrade', { teams })  // (useArchitectActions.ts:594)
        → applyWorldMutation(...)     // (mutationPipeline.js)
          → loadStateForMutation()    // Load current team states
          → validateMutation()        // Validate via validateTrade()
          → computeWorldMutation()    // computeTradeResult()
          → persistWorldMutation()    // Atomic batch write
```

### exportCurrentTrade() (lines 590-612)

```javascript
const exportCurrentTrade = useCallback(() => {
  const tradeData = teams
    .filter((t) => t.team)
    .map((t) => ({
      teamId: t.team.id,
      outgoingPlayers: t.sends,
      outgoingPicks: t.picksOut,
      incomingPlayers: ...,
      incomingPicks: ...,
      usedTradeExceptions: ...,
    }));
  return tradeData;
}, [teams, incomingAssets]);
```

### Firestore Write Paths

**Atomic batch writes** in `persistWorldMutation()` (lines 2003-2094):

| Collection Path                                                  | Write Type       | Purpose                                            |
| ---------------------------------------------------------------- | ---------------- | -------------------------------------------------- |
| `architect_worlds/{worldId}/teams/{teamCode}`                    | `batch.set()`    | Full team snapshot (includes `entitlementIds`)     |
| `architect_worlds/{worldId}/teams/{teamCode}/players/{playerId}` | `batch.set()`    | Player overrides (when applicable)                 |
| `architect_worlds/{worldId}/events/{eventId}`                    | `batch.set()`    | Mutation event log                                 |
| `architect_worlds/{worldId}`                                     | `batch.update()` | World metadata (lastModifiedAt, lastModifiedTeams) |

### computeTradeResult() Pick Handling (lines 930-943)

Current implementation handles legacy picks:

```javascript
// Update draft picks if any
const outgoingPicks = teamTrade.picksOut || [];
const incomingPicks = [];
payload.teams.forEach((otherTeamTrade, otherIndex) => {
  if (otherIndex !== i) {
    incomingPicks.push(...(otherTeamTrade.picksOut || []));
  }
});

updatedTeam.draftPicks = [
  ...(team.draftPicks || []).filter(
    (pick) => !(outgoingPicks.some(/* matching logic */))
  ),
  ...incomingPicks,
];
```

**Key observation**: Current code modifies `draftPicks`, not `entitlementIds`. Phase 11.1 must add parallel logic for entitlements.

---

## 3. Team Snapshot Schema Expectations

### Schema Definition

**File**: [src/schemas/architect.ts](../../src/schemas/architect.ts) (lines 248-278)

```typescript
export const BaseTeamDocZ = z.object({
  teamCode: TeamCodeZ,
  teamName: z.string(),
  season: SeasonCodeZ,
  // ... other fields
  entitlementIds: z.array(z.string()).optional().default([]),
  // ... more fields
});

// World snapshot extends base team
export const WorldTeamSnapshotZ = BaseTeamDocZ.extend({});
```

### Current Write Pattern

`persistWorldMutation()` uses `batch.set()` with full team snapshot:

```javascript
for (const { teamCode, team } of computeResult.teamUpdates) {
  const sanitizedTeam = removeUndefinedDeep(team);
  const teamRef = worldTeamRef(worldId, teamCode);
  batch.set(teamRef, sanitizedTeam); // Full document write
}
```

**Implication**: We must include `entitlementIds` in the team snapshot written. Current system writes full snapshots, so adding/changing `entitlementIds` fits the existing pattern without needing partial updates.

### entitlementIds Resolution Priority

From `entitlementResolver.ts` (lines 105-132):

1. World team snapshot (`architect_worlds/{worldId}/teams/{teamCode}.entitlementIds`)
2. Base team fallback (`architect_baseTeams/{teamCode}.entitlementIds`)

When we write world team snapshots with updated `entitlementIds`, those override base automatically.

---

## 4. Recommended Entitlement Selection State Model

### Recommendation: Separate `entitlementsOut[]` per team

**Rationale**:

- Parallel structure to existing `picksOut[]`
- Minimal disruption to existing code
- Clear separation of concerns (picks vs entitlements)
- Easier debugging and testing

**Rejected Alternatives**:

- **Unified `assetsOut[]` with kind tags**: Would require rewriting all pick handling code
- **Separate `tradeAssets` object**: Adds unnecessary nesting, harder to integrate

### Proposed State Shape

```javascript
const teamSlot = {
  team: TeamObject, // unchanged
  sends: [], // unchanged (players)
  picksOut: [], // unchanged (legacy picks)
  entitlementsOut: [], // NEW: entitlements selected for trade
};
```

### entitlementsOut Element Structure

```typescript
interface SelectedEntitlement {
  entitlementId: string; // REQUIRED: Canonical entitlement ID
  fromTeamId?: string; // Auto-set on selection (sending team)
  // Additional metadata copied from entitlement for display
  kind?: 'pick_ownership' | 'conveyance_right' | 'swap_right';
  seasonYear?: number;
  round?: number;
  description?: string;
}
```

**Note**: `toTeamId` routing removed from Phase 11.1 scope. Multi-team trades use same "distribute to all others" pattern as existing picks.

### Selection/Deselection Logic

```javascript
const toggleEntitlement = useCallback((index, entitlement) => {
  setTeams((prev) => {
    const newTeams = [...prev];
    const entitlementId = entitlement.id || entitlement.entitlementId;
    const existingIndex = newTeams[index].entitlementsOut.findIndex(
      (e) => (e.id || e.entitlementId) === entitlementId
    );

    if (existingIndex >= 0) {
      // Remove from selection
      newTeams[index].entitlementsOut.splice(existingIndex, 1);
    } else {
      // Add to selection
      newTeams[index].entitlementsOut = [
        ...newTeams[index].entitlementsOut,
        {
          ...entitlement,
          entitlementId,
          fromTeamId: newTeams[index].team?.id,
        },
      ];
    }
    return newTeams;
  });
}, []);
```

---

## 5. Entitlement Trade Apply Algorithm

### Pseudo-Code

```
FUNCTION applyEntitlementTrade(worldId, tradePayload):

  FOR each team in tradePayload.teams:
    teamCode = team.teamCode
    outgoingEntitlementIds = team.entitlementsOut.map(e => e.entitlementId)

    // Collect incoming entitlement IDs from all other teams
    // (mirrors existing picksOut logic - no routing)
    incomingEntitlementIds = []
    FOR each otherTeam in tradePayload.teams WHERE otherTeam != team:
      FOR each entitlement in otherTeam.entitlementsOut:
        incomingEntitlementIds.push(entitlement.entitlementId)

    // Load current team snapshot
    currentTeam = loadTeamSnapshot(worldId, teamCode)
    currentEntitlementIds = currentTeam.entitlementIds || []

    // Compute new entitlementIds array
    newEntitlementIds = currentEntitlementIds
      .filter(id => !outgoingEntitlementIds.includes(id))  // Remove outgoing
      .concat(incomingEntitlementIds)                      // Add incoming

    // Update team snapshot with new entitlementIds
    updatedTeam = {
      ...currentTeam,
      entitlementIds: newEntitlementIds,
    }

    // Add to batch write
    teamUpdates.push({ teamCode, team: updatedTeam })

  // Write all updates atomically
  persistWorldMutation({ worldId, teamUpdates, ... })
```

### Integration Point

In `computeTradeResult()` (mutationPipeline.js), add after draftPicks handling:

```javascript
// NEW: Update entitlementIds if any
const outgoingEntitlementIds = (teamTrade.entitlementsOut || []).map(
  (e) => e.entitlementId || e.id
);
const incomingEntitlementIds = [];
payload.teams.forEach((otherTeamTrade, otherIndex) => {
  if (otherIndex !== i) {
    // Collect all entitlementsOut from other teams (no routing - mirrors picksOut)
    (otherTeamTrade.entitlementsOut || []).forEach((e) => {
      incomingEntitlementIds.push(e.entitlementId || e.id);
    });
  }
});

updatedTeam.entitlementIds = [
  ...(team.entitlementIds || []).filter(
    (id) => !outgoingEntitlementIds.includes(id)
  ),
  ...incomingEntitlementIds,
];
```

---

## 6. Edge Cases

### 6.1 Pooled Underlying Picks (`underlyingStatus === 'pooled'`)

**Understanding "Pooled"**:

- **Pooled physical slots** (`pick_ownership` with `underlyingStatus='pooled'`): Hidden by Phase 11.0 UI — these represent unresolved lottery outcomes
- **Pooled rights** (`conveyance_right`, `swap_right`): **ARE TRADEABLE** — these are legitimate NBA assets (e.g., "Most favorable of DAL/PHX 2029 1st")

**Phase 11.1 Policy**:

- `conveyance_right`: **Selectable and tradeable** (even if underlying reality is pooled)
- `swap_right`: **Selectable and tradeable**
- `pick_ownership` with `underlyingStatus='pooled'`: **Already hidden** by `EntitlementPicksList` (`showPooled=false`) — no additional blocking needed

**No validation blocking required** — UI already prevents selection of pooled physical slots.

### 6.2 Encumbered Picks (`underlyingStatus === 'encumbered'`)

**Risk**: Encumbered picks are coupled with swap rights. Trading the pick without the swap right may break invariants.

**Decision for Phase 11.1**:

- ALLOW trading encumbered picks (they are still physical slots)
- Display warning indicator in UI (already implemented: ⚠️ icon)
- Do NOT automatically move swap rights — that's separate entitlement
- Add advisory warning in validation (non-blocking):

```javascript
if (entitlement.underlyingStatus === 'encumbered') {
  warnings.push({
    rule: 'ENCUMBERED_PICK_TRADED',
    message: `${entitlement.id} is encumbered by swap rights. Swap rights remain with original controller.`,
  });
}
```

### 6.3 World Overrides (Entitlement Overrides in World)

**Risk**: If an entitlement has world-level overrides, trading the entitlementId doesn't transfer overrides.

**Observation**: Current architecture stores overrides at `architect_worlds/{worldId}/entitlements/{entitlementId}`. When entitlementId moves between teams:

- Team A loses the entitlement (removed from `entitlementIds`)
- Team B gains the entitlement (added to `entitlementIds`)
- Override document stays at same path — now applies to Team B

**Conclusion**: No change needed. Override documents are keyed by `entitlementId`, not by team. The resolver will correctly apply overrides for the new owner.

### 6.4 Missing worldId

**Risk**: Trading entitlements without a world would break persistence.

**Current Protection**: `applyWorldMutation()` already validates worldId presence:

```javascript
if (!worldId) {
  return { success: false, error: 'worldId is required' };
}
```

**Phase 11.1 UI Enhancement**: Disable entitlement selection when `worldId` is null.

### 6.5 Stepien Rule (Consecutive First-Round Picks)

**Risk**: Trading `pick_ownership` entitlements may violate Stepien rule.

**Phase 11.1 Scope**: NOT IN SCOPE. Current Stepien validation operates on `draftPicks` array. Full Stepien integration with entitlements requires Phase 12+.

**Mitigation**: Add warning if first-round `pick_ownership` entitlements are traded:

```javascript
if (entitlement.kind === 'pick_ownership' && entitlement.round === 1) {
  warnings.push({
    rule: 'PICK_OWNERSHIP_TRADED_STEPIEN_NOT_VALIDATED',
    message: `First-round pick ownership traded. Stepien validation not yet implemented for entitlements.`,
  });
}
```

---

## 7. Minimal UI Changes Required

### 7.1 `useTradeMachine.js` Changes

| Change                                              | Location                  | Description                                   |
| --------------------------------------------------- | ------------------------- | --------------------------------------------- |
| Add `entitlementsOut[]` to team slot                | `useState` initialization | New empty array per team                      |
| Add `toggleEntitlement(index, entitlement)`         | New callback              | Add/remove entitlement from `entitlementsOut` |
| Include `entitlementsOut` in `exportCurrentTrade()` | `exportCurrentTrade()`    | Add to trade export payload                   |
| Expose `toggleEntitlement` in return                | Return object             | Make available to components                  |

### 7.2 `TradeEditor.jsx` Changes

| Change                                        | Description      |
| --------------------------------------------- | ---------------- |
| Destructure `toggleEntitlement` from hook     | Get new function |
| Pass `onToggleEntitlement` to `TradeTeamCard` | Wire to children |

### 7.3 `TradeTeamCard.jsx` Changes

| Change                                                  | Description             |
| ------------------------------------------------------- | ----------------------- |
| Accept `onToggleEntitlement` prop                       | New prop                |
| Pass to `EntitlementPicksList`                          | Wire toggle handler     |
| Accept `entitlementsOut` prop                           | To track selected state |
| Pass `selectedEntitlementIds` to `EntitlementPicksList` | For checkbox state      |

### 7.4 `EntitlementPicksList.jsx` Changes

| Change                               | Description                     |
| ------------------------------------ | ------------------------------- |
| Accept `onToggleEntitlement` prop    | New callback prop               |
| Accept `selectedEntitlementIds` prop | Array of selected IDs           |
| Pass to `EntitlementPickRow`         | Wire toggle and selection state |

### 7.5 `EntitlementPickRow.jsx` Changes

| Change                                      | Description                       |
| ------------------------------------------- | --------------------------------- |
| Accept `onToggle` prop                      | Callback for toggle               |
| Accept `isSelected` prop                    | Boolean selection state           |
| Add checkbox/toggle UI                      | Similar to `TradePickRow` pattern |
| Handle click → call `onToggle(entitlement)` | Selection behavior                |

### 7.6 `mutationPipeline.js` Changes

| Change                                               | Location                  | Description                               |
| ---------------------------------------------------- | ------------------------- | ----------------------------------------- |
| Handle `entitlementsOut` in `loadStateForMutation()` | `executeTrade` case       | Already loads full team, no change needed |
| Add entitlementIds update in `computeTradeResult()`  | After draftPicks handling | Compute new `entitlementIds` per team     |
| Add pooled entitlement validation                    | `validateMutation()`      | Block pooled entitlements in trades       |

### 7.7 File Count Summary

| Category      | Files       | Changes                                                                                      |
| ------------- | ----------- | -------------------------------------------------------------------------------------------- |
| Hooks         | 1           | `useTradeMachine.js`                                                                         |
| UI Components | 4           | `TradeEditor.jsx`, `TradeTeamCard.jsx`, `EntitlementPicksList.jsx`, `EntitlementPickRow.jsx` |
| Pipeline      | 1           | `mutationPipeline.js`                                                                        |
| **TOTAL**     | **6 files** |                                                                                              |

---

## 8. Acceptance Criteria

### AC-1: State Model

- [ ] `useTradeMachine` state includes `entitlementsOut[]` per team slot
- [ ] `toggleEntitlement()` correctly adds/removes entitlements
- [ ] `exportCurrentTrade()` includes `outgoingEntitlements` in export

### AC-2: UI Selection

- [ ] `EntitlementPickRow` renders checkbox/toggle control
- [ ] Clicking entitlement row toggles selection state
- [ ] Selected entitlements show visual indicator (highlighted, checked)
- [ ] Pooled physical slots (`pick_ownership` with `underlyingStatus='pooled'`) remain hidden (Phase 11.0 behavior)
- [ ] Pooled rights (`conveyance_right`, `swap_right`) ARE selectable

### AC-3: Trade Export

- [ ] Trade payload includes `outgoingEntitlements` per team
- [ ] Each element contains `entitlementId`, `fromTeamId`, metadata

### AC-4: Firestore Persistence

- [ ] `computeTradeResult()` computes updated `entitlementIds` for each team
- [ ] Outgoing entitlementIds removed from sending team
- [ ] Incoming entitlementIds added to receiving team
- [ ] World team snapshots written with updated `entitlementIds`

### AC-5: Validation

- [ ] Encumbered entitlements emit advisory warning (non-blocking)
- [ ] First-round `pick_ownership` trades emit Stepien warning (non-blocking)
- [ ] Missing worldId blocks trade (existing behavior)
- [ ] No validation blocking for pooled rights (conveyance/swap are tradeable)

### AC-6: Resolver Compatibility

- [ ] After trade, `resolveEntitlementsForTeam()` returns correct entitlements for new owner
- [ ] World overrides still apply correctly to transferred entitlements

---

## 9. Validation Plan

### Manual Testing

1. **Start emulator**: `firebase emulators:start`
2. **Create test world** with 2+ teams having entitlements
3. **Open Trade Machine** → Select Team A and Team B
4. **Verify entitlements display** in Picks tab for both teams
5. **Select 1-2 entitlements** from Team A
6. **Verify selection state** (visual indicator)
7. **Click Apply Trade**
8. **Verify Firestore writes** in emulator console:
   - Team A `entitlementIds` should be missing traded IDs
   - Team B `entitlementIds` should include acquired IDs
9. **Reload Trade Machine** → Verify Team B now shows acquired entitlements
10. **Verify resolver** → Team B's `resolveEntitlementsForTeam()` returns new entitlements

### Automated Tests

Add to `tests/architect/tradeMachine/`:

```javascript
describe('Entitlement Trading (Phase 11.1)', () => {
  it('toggleEntitlement adds entitlement to entitlementsOut', () => {...});
  it('toggleEntitlement removes entitlement when already selected', () => {...});
  it('exportCurrentTrade includes outgoingEntitlements', () => {...});
  it('computeTradeResult updates entitlementIds correctly', () => {...});
  it('conveyance_right and swap_right are tradeable (even if pooled)', () => {...});
  it('encumbered entitlements produce warning but pass', () => {...});
  it('first-round pick_ownership trades produce Stepien warning', () => {...});
});
```

---

## 10. Stop Conditions / Blockers

### Hard Blockers (Must resolve before execution)

1. **World ownership validation**: Confirm `persistWorldMutation()` checks `createdBy` matches current user — VERIFIED (existing behavior)
2. **entitlementIds in schema**: Confirm `WorldTeamSnapshotZ` includes `entitlementIds` — VERIFIED (lines 268, 393)

### Soft Blockers (Can proceed with warnings)

1. **Stepien validation not wired** — Add warning, defer to Phase 12
2. **Encumbered pick coupling** — Add warning, defer swap coupling to future phase

### Known Limitations

- Lottery resolution not implemented — pooled **physical slots** remain hidden in UI
- Multi-team trade routing deferred to future phase (Phase 11.1 uses simple "all to all" pattern)
- No UI for "Incoming Entitlements" section yet (can add in Phase 11.2)
- Stepien validation not wired for entitlements (Phase 12+)

---

## 11. File List for Execution (Minimal)

| #   | File Path                                                      | Change Type | Priority |
| --- | -------------------------------------------------------------- | ----------- | -------- |
| 1   | `src/features/architect/hooks/useTradeMachine.js`              | MODIFY      | P0       |
| 2   | `src/features/architect/tradeMachine/TradeEditor.jsx`          | MODIFY      | P0       |
| 3   | `src/features/architect/tradeMachine/TradeTeamCard.jsx`        | MODIFY      | P0       |
| 4   | `src/features/architect/tradeMachine/EntitlementPicksList.jsx` | MODIFY      | P0       |
| 5   | `src/features/architect/tradeMachine/EntitlementPickRow.jsx`   | MODIFY      | P0       |
| 6   | `src/features/architect/utils/mutationPipeline.js`             | MODIFY      | P0       |

---

## Phase 11.1 EXECUTION Prompt Draft

````markdown
# AGENT PROMPT — PHASE 11.1 EXECUTION

## Trade Machine — Entitlement Trading (Selection + World Save)

## MODE

EXECUTION — CODE CHANGES ALLOWED

## MASTER DOC

docs/team-scrape/PST_PICK_LEDGER_MASTER_PLAN.md

## PREFLIGHT DOC

docs/team-scrape/PST_PHASE_11_1_ENTITLEMENT_TRADING_PREFLIGHT_RETURN_PACKAGE.md

---

## GOAL

Implement entitlement trading in the Trade Machine:

1. Add `entitlementsOut[]` state per team
2. Add `toggleEntitlement()` callback
3. Update UI components with selection capability
4. Update `computeTradeResult()` to modify `entitlementIds`
5. Add validation for pooled entitlements

---

## IMPLEMENTATION STEPS

### Step 1: Update useTradeMachine.js

1. Add `entitlementsOut: []` to team slot initialization (lines ~197-211)
2. Add `toggleEntitlement` callback (pattern from `togglePick`)
3. Include `outgoingEntitlements: t.entitlementsOut` in `exportCurrentTrade()`
4. Expose `toggleEntitlement` in return object

### Step 2: Update TradeEditor.jsx

1. Destructure `toggleEntitlement` from `useTradeMachine()`
2. Pass `onToggleEntitlement={(e) => toggleEntitlement(idx, e)}` to `TradeTeamCard`
3. Pass `entitlementsOut={t.entitlementsOut}` to `TradeTeamCard`

### Step 3: Update TradeTeamCard.jsx

1. Accept `onToggleEntitlement` and `entitlementsOut` props
2. Compute `selectedEntitlementIds` from `entitlementsOut`
3. Pass to `EntitlementPicksList`:
   - `onToggleEntitlement={onToggleEntitlement}`
   - `selectedEntitlementIds={selectedEntitlementIds}`

### Step 4: Update EntitlementPicksList.jsx

1. Accept `onToggleEntitlement` and `selectedEntitlementIds` props
2. Compute `isSelected` per entitlement: `selectedEntitlementIds.includes(e.id)`
3. Pass to `EntitlementPickRow`:
   - `onToggle={onToggleEntitlement}`
   - `isSelected={isSelected}`
4. No special handling for pooled rights — they are selectable (Phase 11.0 already hides pooled physical slots)

### Step 5: Update EntitlementPickRow.jsx

1. Accept `onToggle` and `isSelected` props
2. Add checkbox or toggle indicator (left side)
3. Handle click: `onClick={() => onToggle && onToggle(entitlement)}`
4. Style selected state (highlight background, check icon)
5. No special handling needed — pooled physical slots already filtered by Phase 11.0

### Step 6: Update mutationPipeline.js

1. In `computeTradeResult()` after draftPicks handling (~line 943):

   ```javascript
   // Update entitlementIds
   const outgoingEntitlementIds = (teamTrade.entitlementsOut || []).map(
     (e) => e.entitlementId || e.id
   );
   const incomingEntitlementIds = [];
   payload.teams.forEach((otherTeamTrade, otherIndex) => {
     if (otherIndex !== i) {
       // Collect all entitlementsOut from other teams (mirrors picksOut logic)
       (otherTeamTrade.entitlementsOut || []).forEach((e) => {
         incomingEntitlementIds.push(e.entitlementId || e.id);
       });
     }
   });

   updatedTeam.entitlementIds = [
     ...(team.entitlementIds || []).filter(
       (id) => !outgoingEntitlementIds.includes(id)
     ),
     ...incomingEntitlementIds,
   ];
   ```
````

1. In `validateMutation()` for `executeTrade`:
   - Add warning for encumbered entitlements (non-blocking)
   - Add Stepien warning for first-round `pick_ownership` (non-blocking)
   - No blocking validation for pooled rights (conveyance/swap are tradeable)

---

## VALIDATION

1. `npm run build` — must pass
2. Manual test in dev server:
   - Select entitlements → verify selection state
   - Apply trade → verify Firestore writes
   - Reload → verify entitlements transferred
3. Add unit tests for new functions

---

## ACCEPTANCE CRITERIA

See Section 8 of Preflight Return Package.

---

## RETURN PACKAGE

Create: `docs/team-scrape/PST_PHASE_11_1_ENTITLEMENT_TRADING_RETURN_PACKAGE.md`

Include:

1. Files changed (with line numbers)
2. Validation results (build, manual, tests)
3. Known issues / next steps
4. Update Master Doc Phase Status

```

---

**Phase 11.1 preflight complete**
```
