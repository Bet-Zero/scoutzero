# Phase 11.0 Return Package — Read-Only Entitlements Trade Machine

**DATE**: 2026-01-21  
**STATUS**: COMPLETE  
**MASTER DOC**: [PST_PICK_LEDGER_MASTER_PLAN.md](./PST_PICK_LEDGER_MASTER_PLAN.md)

---

## Summary

Implemented read-only entitlements display in the Trade Machine. When a team has entitlements loaded (via `resolveEntitlementsForTeam` from Phase 10), they now render in the Picks tab instead of the legacy `team.picks` array. This is UI-only with no trading, toggling, or interaction.

**Key behaviors:**

- Entitlements replace legacy picks visually when `team.entitlements?.length > 0`
- Legacy picks remain as fallback when entitlements absent or empty
- No modification to trade logic, `picksOut`, or Firestore
- No ability to select, trade, or interact with entitlements (Phase 11.1+)

---

## Files Created

### 1. `src/features/architect/utils/entitlements/formatEntitlement.js`

Central formatting utilities for entitlement display.

**Exports:**

- `formatEntitlementLabel(entitlement)` — Human-readable label from entitlement properties or description
- `getEntitlementKindTag(kind)` — Returns `{ label, colorClass }` for badge display
- `getKindSortPriority(kind)` — Sort order: `pick_ownership` (1) → `conveyance_right` (2) → `swap_right` (3)

**Kind badge mappings:**

| Kind               | Label       | Color                                       |
| ------------------ | ----------- | ------------------------------------------- |
| `pick_ownership`   | Own         | Green (`bg-green-600/30 text-green-400`)    |
| `conveyance_right` | Conditional | Amber (`bg-amber-600/30 text-amber-400`)    |
| `swap_right`       | Swap Option | Purple (`bg-purple-600/30 text-purple-400`) |

### 2. `src/features/architect/tradeMachine/EntitlementPickRow.jsx`

Read-only row component for a single entitlement.

**Props:**

- `entitlement` (EffectiveEntitlement) — The entitlement object to display
- `teamId` (string) — Team ID for potential styling context

**Display rules:**

- Shows `formatEntitlementLabel(entitlement)` as primary text
- Shows kind badge on right side
- Shows ⚠️ warning indicator when `underlyingStatus === 'encumbered'`
- No click handlers or interaction
- Consistent styling with existing Trade Machine picks

### 3. `src/features/architect/tradeMachine/EntitlementPicksList.jsx`

List component that renders multiple entitlements with filtering and sorting.

**Props:**

- `entitlements` (EffectiveEntitlement[]) — Array of entitlements to display
- `teamId` (string) — Team ID
- `showPooled` (boolean, default `false`) — Whether to show pooled entitlements

**Logic:**

- **Filters** out entitlements where `underlyingStatus === 'pooled'` (unless `showPooled=true`)
- **Sorts** by:
  1. `seasonYear` (ascending)
  2. `round` (1 then 2)
  3. `kind` priority (ownership → conditional → swap)
- **Groups** visually by year with year header labels
- **Header**: "Draft Assets (Entitlements)"
- **Empty state**: "No draft entitlements available"

---

## Files Modified

### 1. `src/features/architect/tradeMachine/TradeTeamCard.jsx`

**Changes:**

- Added import: `import { EntitlementPicksList } from './EntitlementPicksList';`
- Modified picks tab rendering (line ~717):

```jsx
{
  activeTab === 'picks' &&
    // Phase 11.0: Conditionally render entitlements or legacy picks
    (team.entitlements?.length > 0 ? (
      <EntitlementPicksList
        entitlements={team.entitlements}
        teamId={team.id}
        showPooled={false}
      />
    ) : (
      <OutgoingPicksList
        team={team}
        picks={picks}
        incomingPicks={incomingPicks}
        otherTeams={otherTeams}
        onTogglePick={onTogglePick}
        onEditPick={onEditPick}
      />
    ));
}
```

**Conditional logic:**

- If `team.entitlements` exists AND has length > 0 → render `EntitlementPicksList`
- Otherwise → render `OutgoingPicksList` (legacy behavior preserved)

### 2. `docs/team-scrape/PST_PICK_LEDGER_MASTER_PLAN.md`

**Changes:**

- Updated Phase Status table (line 33): `Phase 11.0` status changed from `PREFLIGHT` to `COMPLETE`
- Added detailed Phase 11.0 section at end of document with:
  - Goal statement
  - Files created/modified
  - Display rules
  - Validation results
  - Non-goals for Phase 11.1+

---

## How to Run

### Build Validation

```bash
npm run build
```

**Expected output:**

- Build completes successfully in ~40s
- No errors related to new entitlement components
- Warnings about chunk size are normal (existing)

### Manual Testing

```bash
npm run dev
```

1. Navigate to `http://localhost:5173/`
2. Open **GM Dashboard**
3. Go to **Trade Machine**
4. Select a team with entitlements (e.g., ATL, HOU)
5. Click **Picks** tab
6. Verify entitlements display with:
   - Year grouping headers
   - Correct kind badges (Own/Conditional/Swap Option)
   - Encumbered warnings where applicable
   - "Draft Assets (Entitlements)" header

7. Add secondary team with entitlements
8. Verify entitlements load for second team

9. Clear world selector (if applicable)
10. Verify fallback to legacy picks works for teams without entitlements

---

## Validation Results

### Build Validation

- ✅ **Build passes**: `npm run build` completes without errors
- ✅ **No type errors**: TypeScript compilation clean
- ✅ **No import errors**: All new imports resolve correctly

### Display Validation

- ✅ **Entitlements render**: When `team.entitlements?.length > 0`
- ✅ **Legacy fallback works**: When no entitlements present
- ✅ **Kind badges correct**:
  - Own (green) for `pick_ownership`
  - Conditional (amber) for `conveyance_right`
  - Swap Option (purple) for `swap_right`
- ✅ **Sorting correct**: Year ascending → Round (1, 2) → Kind priority
- ✅ **Year grouping**: Visual separation by season year
- ✅ **Encumbered indicator**: ⚠️ shown when `underlyingStatus === 'encumbered'`
- ✅ **Pooled filtering**: Pooled entitlements hidden by default
- ✅ **Header text**: "Draft Assets (Entitlements)" displays correctly

### Integration Validation

- ✅ **No impact on trade logic**: `picksOut` and trade validation unchanged
- ✅ **No Firestore writes**: Read-only as designed
- ✅ **Legacy picks preserved**: Still work when entitlements absent
- ✅ **Existing pick interactions preserved**: Toggle, edit, swap still work for legacy mode

---

## Display Rules Reference

### Entitlement Row Layout

```
[Description]           [Encumbered ⚠️]    [Kind Badge]
```

### Kind Badge Colors

- **Own** (green): `pick_ownership` — Team owns this pick outright
- **Conditional** (amber): `conveyance_right` — Will convey under certain conditions
- **Swap Option** (purple): `swap_right` — Right to swap with another team

### Sort Order

1. **Year**: 2026, 2027, 2028, ... (ascending)
2. **Round**: 1st, 2nd (ascending)
3. **Kind**: Own → Conditional → Swap (priority order)

### Filtering Rules

- **Pooled entitlements**: Hidden by default (`showPooled=false`)
- **Encumbered entitlements**: Visible with ⚠️ indicator
- **Active entitlements**: All shown

---

## Known Issues

None. Phase 11.0 is complete as designed.

---

## Next Blockers

Phase 11.0 is complete. No blockers for read-only display.

**Future work (Phase 11.1+):**

- Enable trading/toggling of entitlements
- Add `picksOut` integration for entitlement-based trades
- Add entitlement editing (swap type, conditions, etc.)
- Add world-aware entitlement override UI

---

## Acceptance Criteria — Status

| Criteria                                                 | Status  | Notes                                           |
| -------------------------------------------------------- | ------- | ----------------------------------------------- |
| Entitlements render instead of legacy picks when present | ✅ PASS | Conditional rendering in TradeTeamCard          |
| Legacy picks still render when entitlements absent       | ✅ PASS | Fallback to OutgoingPicksList preserved         |
| Correct badges per entitlement.kind                      | ✅ PASS | Own/Conditional/Swap Option with colors         |
| Correct sorting (year → round → kind)                    | ✅ PASS | Sorting in EntitlementPicksList                 |
| Pooled entitlements hidden by default                    | ✅ PASS | Filtered out unless showPooled=true             |
| Encumbered entitlements visibly marked                   | ✅ PASS | ⚠️ indicator when underlyingStatus='encumbered' |
| No trading or interaction                                | ✅ PASS | Read-only rows with no handlers                 |
| No modification to trade logic                           | ✅ PASS | picksOut, validation untouched                  |
| Build passes                                             | ✅ PASS | npm run build completes successfully            |

---

## File Manifest

**Created:**

```
src/features/architect/utils/entitlements/formatEntitlement.js
src/features/architect/tradeMachine/EntitlementPickRow.jsx
src/features/architect/tradeMachine/EntitlementPicksList.jsx
docs/team-scrape/PST_PHASE_11.0_RETURN_PACKAGE.md (this file)
```

**Modified:**

```
src/features/architect/tradeMachine/TradeTeamCard.jsx
docs/team-scrape/PST_PICK_LEDGER_MASTER_PLAN.md
```

**Unchanged (dependencies):**

```
src/features/architect/hooks/useTradeMachine.js (already loads entitlements)
src/features/architect/utils/entitlements/entitlementResolver.ts (Phase 10)
src/features/architect/tradeMachine/OutgoingPicksList.jsx (legacy fallback)
```

---

## Agent Handoff Notes

Phase 11.0 is complete. The Trade Machine now displays entitlements when available.

**For Phase 11.1 (Entitlement Trading):**

- Start with `picksOut` integration for entitlements
- Add toggle handlers to EntitlementPickRow
- Wire up entitlement selection to trade state
- Update validation to handle entitlement-based trades
- Consider swap type editing UI

**Data contract:**

- `team.entitlements` is loaded via `resolveEntitlementsForTeam(worldId, teamCode)` in useTradeMachine.js
- Each entitlement has: `id`, `kind`, `seasonYear`, `round`, `description`, `underlyingStatus`, etc.
- See Phase 10 docs for complete EffectiveEntitlement schema

---

**END OF PHASE 11.0 RETURN PACKAGE**
