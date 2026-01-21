# PST Phase 11.0 — Trade Machine Read-Only Entitlements View

## PREFLIGHT RETURN PACKAGE

**Date**: 2026-01-21  
**Status**: PREFLIGHT COMPLETE  
**Mode**: READ-ONLY (no code changes in this phase)

---

## 1) Current TM Pick Pipeline (What Files, How It Works)

### Data Loading Flow

```
GMDashboard.jsx
  └─ worldId (from useArchitectState)
  └─ teamCapSheet (from useArchitectState)
        │
        ▼
TradeSection.jsx
  └─ passes worldId, primaryTeamData to TradeEditor
        │
        ▼
TradeEditor.jsx
  └─ calls useTradeMachine(primaryTeam, capProjections, currentYear, primaryTeamData, worldId)
        │
        ▼
useTradeMachine.js (src/features/architect/hooks/useTradeMachine.js)
  └─ PICKS SOURCE (lines 175-178):
      const rawPicks = data.draftAssets?.picks || data.draftPicks || data.picks || [];
      const picksWithIds = rawPicks.map(p => ensurePickId(p));
      teamObj.picks = picksWithIds;
  └─ ENTITLEMENTS LOADING (lines 188-199):
      if (worldId || (data.entitlementIds && data.entitlementIds.length)) {
        const entitlements = await resolveEntitlementsForTeam(worldId, resolvedTeamCode);
        teamObj.entitlements = entitlements;
      }
```

### Key Findings

| Aspect                  | Current State                                                                      |
| ----------------------- | ---------------------------------------------------------------------------------- |
| **Pick Source**         | `team.picks` (populated from `draftAssets.picks`, `draftPicks`, or legacy `picks`) |
| **Entitlements Source** | `team.entitlements` (populated via `resolveEntitlementsForTeam()`)                 |
| **Local Trade State**   | `picksOut[]` array per team (stores picks marked for trade)                        |
| **Already Loaded**      | Entitlements ARE loaded onto `teamObj.entitlements` but NOT rendered               |

### Critical File Paths

| File                                                               | Purpose                                    |
| ------------------------------------------------------------------ | ------------------------------------------ |
| `src/features/architect/hooks/useTradeMachine.js`                  | Main hook, loads team + entitlements       |
| `src/features/architect/hooks/useTeamEntitlements.ts`              | Hook wrapper for resolver                  |
| `src/features/architect/utils/entitlements/entitlementResolver.ts` | Fetches + merges base + world entitlements |

---

## 2) Components Involved in Rendering Picks

### Current Pick Render Path

```
TradeTeamCard.jsx
  └─ picks={t.picksOut}          // picks selected for trade
  └─ team.picks                   // available picks
        │
        ▼
OutgoingPicksList.jsx (src/features/architect/tradeMachine/OutgoingPicksList.jsx)
  └─ available = [...incomingPicks, ...team.picks.filter(not selected)]
  └─ maps to TradePickRow
        │
        ▼
TradePickRow.jsx (src/features/architect/tradeMachine/TradePickRow.jsx)
  └─ Renders single pick row/card
  └─ Shows assetType badge (Outright/Conditional/Swap) if present
  └─ Calls formatPick() for display label
```

### Props Expected by TradePickRow

```typescript
interface TradePickRowProps {
  pick: {
    year: number;
    round: number;
    originalTeam?: string;
    originalTeamId?: string;
    teamId?: string;
    owner?: string;
    via?: string;
    protection?: string;
    protectionMeta?: { type: string; maxPosition?: number };
    isSwap?: boolean;
    swapType?: 'best_of' | 'worst_of';
    swapWithTeamId?: string;
    assetType?: 'outright_pick' | 'conditional_right' | 'swap_right';
    conditionsText?: string;
    note?: string;
  };
  pickObj: object | null; // The pick from picksOut if selected
  teamId: string;
  otherTeams: Team[];
  onToggle: (pick) => void;
  onEdit: (pick, field, value) => void;
  // ...menu state props
}
```

### Reusability Assessment

| Component           | Reusable?   | Notes                                                                   |
| ------------------- | ----------- | ----------------------------------------------------------------------- |
| `TradePickRow`      | **Partial** | Already has `assetType` badge display; can adapt for entitlement `kind` |
| `OutgoingPicksList` | **No**      | Hardcoded to use `team.picks`; needs parallel entitlements path         |
| `formatPick()`      | **Extend**  | Add entitlement-aware formatting option                                 |

---

## 3) Where worldId/teamCode Are Obtained

### worldId Flow

```
useArchitectState.ts (GMDashboard/hooks/)
  └─ worldId state (user-selected from WorldSelector)
        │
        ▼
GMDashboard.jsx
  └─ Destructures worldId from state
  └─ Passes to TradeSection
        │
        ▼
TradeSection.jsx
  └─ Passes worldId prop to TradeEditor
        │
        ▼
TradeEditor.jsx
  └─ Passes worldId to useTradeMachine
        │
        ▼
useTradeMachine.js
  └─ Uses worldId for:
      1. resolveEntitlementsForTeam(worldId, teamCode)
      2. loadWorldTeamData(worldId, teamId)
```

### teamCode Flow

| Team Slot            | Source                                                       |
| -------------------- | ------------------------------------------------------------ |
| Primary (index 0)    | `teamId` from URL params via `useParams()`                   |
| Secondary (index 1+) | Selected via `selectTeam(index, teamId)` → `TeamMap[teamId]` |

### Parameters Available for useTeamEntitlements

```typescript
// For primary team:
useTeamEntitlements(worldId, teamId); // teamId from URL

// For secondary teams:
useTeamEntitlements(worldId, selectedTeamId); // from dropdown selection
```

---

## 4) Proposed Execution Plan (Minimal Read-Only)

### Goal

Display entitlements as the pick source in Trade Machine when available, keeping legacy `team.picks` as fallback.

### Files to Create

| File                                                             | Purpose                                           |
| ---------------------------------------------------------------- | ------------------------------------------------- |
| `src/features/architect/tradeMachine/EntitlementPickRow.tsx`     | New component for entitlement-based pick display  |
| `src/features/architect/tradeMachine/EntitlementPicksList.tsx`   | New list component that maps entitlements to rows |
| `src/features/architect/utils/entitlements/formatEntitlement.ts` | Format entitlement for display                    |

### Files to Modify

| File                                                        | Change                                                               |
| ----------------------------------------------------------- | -------------------------------------------------------------------- |
| `src/features/architect/tradeMachine/TradeTeamCard.jsx`     | Add entitlements prop, switch to EntitlementPicksList when available |
| `src/features/architect/tradeMachine/OutgoingPicksList.jsx` | Add conditional render path for entitlements mode                    |
| `src/features/architect/hooks/useTradeMachine.js`           | Ensure entitlements propagate to team slots (already done)           |

### Minimal Implementation Approach

```
Phase 11.0: READ-ONLY
├─ EntitlementPickRow (display only, no toggle/edit)
├─ EntitlementPicksList (maps entitlements → rows)
└─ TradeTeamCard switch logic:
     if (team.entitlements?.length) {
       <EntitlementPicksList entitlements={team.entitlements} />
     } else {
       <OutgoingPicksList ... />  // legacy fallback
     }
```

---

## 5) Display Rules (Entitlement Kind → UI)

### Mapping entitlement.kind to Display

| `kind`             | Display As      | Badge Color      | Tag Text        |
| ------------------ | --------------- | ---------------- | --------------- |
| `pick_ownership`   | Normal pick row | Green (#22c55e)  | "Own" or no tag |
| `conveyance_right` | Conditional row | Amber (#f59e0b)  | "Conditional"   |
| `swap_right`       | Swap option row | Purple (#a855f7) | "Swap Option"   |

### underlyingStatus Display Rules

| `underlyingStatus` | Behavior                                                 |
| ------------------ | -------------------------------------------------------- |
| `clean`            | Normal display, tradeable                                |
| `encumbered`       | Show with ⚠️ icon + "Encumbered" tooltip                 |
| `pooled`           | **HIDE BY DEFAULT** (underlying is in a conveyance pool) |

### Sorting/Grouping

1. **Group by year** (ascending: 2026, 2027, ...)
2. **Within year, group by round** (1st, 2nd)
3. **Within round, sort by kind priority**:
   - `pick_ownership` first
   - `conveyance_right` second
   - `swap_right` third

### Display Format

```
{seasonYear} {roundLabel}      [{kindTag}]
{description}                  {statusIndicator}

Examples:
────────────────────────────────────────────
2026 1st Round                 [Own]
ATL 2026 1st Round Pick (via MIL)   ⚠️

2026 1st Round                 [Conditional]
Hawks option to swap (less favorable)

2027 1st Round                 [Swap Option]
Option to swap with CLE
────────────────────────────────────────────
```

---

## 6) Acceptance Criteria for Phase 11.0 Execution

### Must Have

- [ ] **AC-1**: EntitlementPickRow renders each entitlement with correct kind badge
- [ ] **AC-2**: EntitlementPicksList maps entitlements array to rows
- [ ] **AC-3**: TradeTeamCard switches to entitlements view when `team.entitlements?.length > 0`
- [ ] **AC-4**: Legacy `OutgoingPicksList` continues to work when no entitlements
- [ ] **AC-5**: Entitlements with `underlyingStatus === 'pooled'` are hidden by default
- [ ] **AC-6**: Entitlements with `underlyingStatus === 'encumbered'` show indicator
- [ ] **AC-7**: Rows sorted by year → round → kind priority
- [ ] **AC-8**: No drag/drop or trading functionality (read-only)

### Validation Steps

1. Load Trade Machine with a team that has entitlements (e.g., ATL)
2. Verify entitlements display with correct badges
3. Verify pooled picks are hidden
4. Verify encumbered picks show indicator
5. Select secondary team, verify entitlements load for it too
6. Clear worldId, verify fallback to legacy picks

---

## 7) Risks / Edge Cases

### Risk 1: Dual Pick Arrays

**Issue**: Teams now have BOTH `team.picks` (legacy) AND `team.entitlements` (new). Without clear gating, UI could show duplicates or mismatched data.

**Mitigation**: Phase 11.0 switches entirely to entitlements when present. Legacy picks are fallback only.

### Risk 2: picksOut State Incompatibility

**Issue**: Current `picksOut[]` expects legacy pick objects with `year`, `round`, `originalTeam`. Entitlements have different structure (`id`, `underlyingPickId`, `kind`).

**Mitigation for Phase 11.0**: READ-ONLY mode means no `picksOut` interaction. Phase 11.1+ will add entitlement-aware toggle logic.

### Risk 3: Missing worldId

**Issue**: If `worldId` is null, `resolveEntitlementsForTeam` falls back to base entitlements. This is correct behavior but could confuse users expecting "real world" data.

**Mitigation**: Add visual indicator when viewing base (null world) vs. world scenario.

### Risk 4: formatPick() Incompatibility

**Issue**: `formatPick()` expects legacy pick schema. Entitlements have `description` field instead.

**Mitigation**: Create `formatEntitlement()` helper or use `entitlement.description` directly.

### Risk 5: Performance

**Issue**: Resolving entitlements requires Firestore reads for each team.

**Mitigation**: Already handled in Phase 10 via `resolveEntitlementsForTeam` with batching.

---

## 8) Stop Conditions / Open Questions

### Open Questions (for User)

1. **Q1**: Should we show a toggle between "Entitlements View" and "Legacy Picks View" for debugging, or always prefer entitlements when available?

2. **Q2**: Should pooled picks be completely hidden, or shown in a collapsed/dimmed state?

3. **Q3**: For Phase 11.1+ (trading entitlements), should we track `entitlementsOut[]` separately from `picksOut[]`?

### Stop Conditions

- ❌ STOP if entitlement resolution fails silently (would show empty picks)
- ❌ STOP if legacy picks and entitlements both render simultaneously (duplicates)
- ❌ STOP if build fails after adding TypeScript components

---

## 9) EXECUTION PROMPT DRAFT (Phase 11.0)

````markdown
# AGENT PROMPT — PHASE 11.0 EXECUTION: TRADE MACHINE READ-ONLY ENTITLEMENTS VIEW

## MODE

EXECUTION

## MASTER DOC (UPDATE REQUIRED)

docs/team-scrape/PST_PICK_LEDGER_MASTER_PLAN.md

Update Phase 11.0:

- Status: COMPLETE
- Date: 2026-01-21

---

## GOAL

Implement read-only entitlements display in Trade Machine, switching from legacy `team.picks` to `team.entitlements` when available.

---

## FILES TO CREATE

### 1. src/features/architect/tradeMachine/EntitlementPickRow.tsx

```typescript
/**
 * Renders a single entitlement as a pick row in Trade Machine.
 * READ-ONLY in Phase 11.0 (no toggle/edit handlers).
 */
```
````

Props:

- `entitlement: EffectiveEntitlement`
- `teamId: string`

Display:

- Kind badge (Own/Conditional/Swap Option)
- Description text
- Encumbered indicator if applicable

### 2. src/features/architect/tradeMachine/EntitlementPicksList.tsx

```typescript
/**
 * Renders list of entitlements grouped by year/round.
 * Hides pooled entitlements by default.
 */
```

Props:

- `entitlements: EffectiveEntitlement[]`
- `teamId: string`
- `showPooled?: boolean` (default: false)

Logic:

- Filter out `underlyingStatus === 'pooled'`
- Sort by year → round → kind priority
- Map to EntitlementPickRow

### 3. src/features/architect/utils/entitlements/formatEntitlement.ts

```typescript
/**
 * Formats entitlement for display.
 */
export function formatEntitlementLabel(e: EffectiveEntitlement): string;
export function getEntitlementKindTag(kind: string): {
  label: string;
  color: string;
};
```

---

## FILES TO MODIFY

### 1. src/features/architect/tradeMachine/TradeTeamCard.jsx

Add conditional render in picks section:

```jsx
{team.entitlements?.length > 0 ? (
  <EntitlementPicksList entitlements={team.entitlements} teamId={team.id} />
) : (
  <OutgoingPicksList ... />
)}
```

### 2. src/features/architect/tradeMachine/OutgoingPicksList.jsx

Add header text change for clarity:

```jsx
<h4 className="text-sm text-white/70 mb-1">
  {isEntitlementsMode ? 'Draft Assets (Entitlements)' : 'Outgoing Picks'}
</h4>
```

---

## ACCEPTANCE CRITERIA

- [ ] AC-1: EntitlementPickRow renders with correct kind badge
- [ ] AC-2: EntitlementPicksList shows sorted entitlements
- [ ] AC-3: TradeTeamCard switches view when entitlements present
- [ ] AC-4: Legacy mode works when no entitlements
- [ ] AC-5: Pooled entitlements hidden
- [ ] AC-6: Encumbered entitlements show indicator
- [ ] AC-7: Sorted by year → round → kind
- [ ] AC-8: No trading functionality (read-only)

---

## VALIDATION STEPS

1. `npm run build` — must pass
2. `npm run lint -- src/features/architect/tradeMachine/` — no new errors
3. Start dev server, load /gm/ATL
4. Go to Trade Machine tab
5. Verify entitlements display (ATL has known entitlements)
6. Add secondary team with entitlements
7. Verify both teams show entitlements correctly
8. Clear world selector, verify fallback to base entitlements

---

## RETURN PACKAGE

Create: docs/team-scrape/PST_PHASE_11_0_TRADE_MACHINE_ENTITLEMENTS_EXECUTION_RETURN_PACKAGE.md

Include:

- Files created/modified
- Test results
- Screenshots (if applicable)
- Any open issues

---

## STOP CONDITION

Stop after creating return package. Do not proceed to Phase 11.1 (trading entitlements).

```

---

**Phase 11.0 preflight complete**
```
