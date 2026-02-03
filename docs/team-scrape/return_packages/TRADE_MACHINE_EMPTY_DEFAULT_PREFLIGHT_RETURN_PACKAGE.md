# Trade Machine Empty by Default — Preflight Return Package

**Date**: 2026-02-02  
**Task**: World Dependency Diagnostic  
**Status**: ✅ PREFLIGHT COMPLETE

---

## 1) Executive Summary

- **Trade Machine is NOT empty because of a worldId hard-requirement** — the data loading path correctly falls back to `architect_baseTeams` when `worldId` is null
- **Both Cap Sheet and Trade Machine use the SAME data pipeline** (`loadWorldTeamData` → `loadTeamCapSheet` fallback for worldless mode)
- **The issue is likely presentation/initialization**, not data sourcing — Trade Machine initializes with `[{team: teamObj}, {team: null}]` which should show the primary team
- **If Trade Machine shows empty teams**: The most likely cause is either (a) no team is selected in the route, (b) `architect_baseTeams` collection is empty in the emulator, or (c) the Trade Machine tab is rendering before data loads

---

## 2) Observed Behavior

### Emulator State Check

The emulator was **not running** during this preflight (`FIRESTORE_EMULATOR_HOST` not set). To fully verify:

```bash
npm run emu
FIRESTORE_EMULATOR_HOST=127.0.0.1:8082 npm run emu:doctor
```

### Expected Behavior Based on Code Analysis

- When navigating to `/gm/:teamId`, GMDashboard loads team data via `useArchitectState`
- `useArchitectState` calls `loadWorldTeamData(worldId, teamId)` where `worldId` is initially `null`
- `loadWorldTeamData(null, teamId)` falls back to `loadTeamCapSheet(teamId)`
- Both Cap Sheet and Trade Machine receive `teamCapSheet` from the same source

### Potential Console Errors to Check

- `"Unable to resolve team code for: ..."` — indicates `resolveTeamCode` failure
- `"No base team data found for: ..."` — indicates `architect_baseTeams/{code}` doc missing
- `"[init] Could not resolve team code for slot 0"` — Trade Machine init failure

---

## 3) Cap Sheet Data Path

```
Route: /gm/:teamId
  │
  └─ GmDashboardView.jsx
       └─ GMDashboard.jsx (line 62)
            │
            └─ useArchitectState({ teamId, userId, authLoading })
                 │
                 │  [Effect: line ~373-395]
                 └─ loadWorldTeamData(worldId, teamId)
                      │
                      │  [worldTeamData.ts line 81-101]
                      │  worldId = null → falls back to:
                      └─ loadTeamCapSheet(teamId)
                           │
                           │  [firebaseTeamPlanHelpers.js line 190-204]
                           └─ getDoc(baseTeamRef(teamCode))
                                │
                                └─ Firestore: architect_baseTeams/{teamCode}
                                     │
                                     └─ hydrateBaseTeam(teamCode, baseDoc)
                                          │
                                          └─ Returns: teamCapSheet (CapSheet object)

Cap Sheet Tab (line 280):
  <CapSheetSection
    teamCapSheet={teamCapSheet}  ← from useArchitectState
    currentYear={currentYear}
    ...
  />
```

**Key Files:**

- [GMDashboard.jsx](src/features/architect/GMDashboard/GMDashboard.jsx#L62) — calls `useArchitectState`
- [useArchitectState.ts](src/features/architect/GMDashboard/hooks/useArchitectState.ts#L382) — loads team data
- [worldTeamData.ts](src/features/architect/utils/worldTeamData.ts#L81) — `loadWorldTeamData` with fallback
- [firebaseTeamPlanHelpers.js](src/features/architect/utils/firebaseTeamPlanHelpers.js#L190) — `loadTeamCapSheet`
- [CapSheetSection.jsx](src/features/architect/GMDashboard/sections/CapSheetSection.jsx#L17) — receives `teamCapSheet`

---

## 4) Trade Machine Data Path

```
Route: /gm/:teamId  (same as Cap Sheet)
  │
  └─ GMDashboard.jsx (line 295)
       │
       └─ TradeSection
            │  primaryTeam={teamId}
            │  primaryTeamData={teamCapSheet}    ← SAME DATA as Cap Sheet
            │  worldId={worldId}
            │
            └─ TradeEditor.jsx (line 46)
                 │
                 └─ useTradeMachine(primaryTeam, capProjections, currentYear, primaryTeamData, worldId)
                      │
                      │  [useTradeMachine.js line 277-384]
                      │
                      │  if (!primaryTeam) return;  ← Early return if no team
                      │
                      │  Uses primaryTeamData if provided (already from GMDashboard)
                      │  OR loads via loadWorldTeamData(worldId, primaryTeam)
                      │
                      └─ setTeams([
                           { team: teamObj, sends: [], entitlementsOut: [] },
                           { team: null, sends: [], entitlementsOut: [] }
                         ])
```

**Key Files:**

- [GMDashboard.jsx](src/features/architect/GMDashboard/GMDashboard.jsx#L295) — passes `primaryTeamData={teamCapSheet}`
- [TradeSection.jsx](src/features/architect/GMDashboard/sections/TradeSection.jsx#L13) — wrapper component
- [TradeEditor.jsx](src/features/architect/tradeMachine/TradeEditor.jsx#L46) — calls `useTradeMachine`
- [useTradeMachine.js](src/features/architect/hooks/useTradeMachine.js#L277) — initializes teams state

---

## 5) World Assumption Findings

### NO Hard World Requirement in Trade Machine

The code explicitly supports worldless mode:

**Location 1: `worldTeamData.ts` line 91-94**

```typescript
// If no worldId, use base-only loading (same as before)
if (!worldId) {
  return await loadTeamCapSheet(teamId);
}
```

**Location 2: `useTradeMachine.js` line 284-285**

```javascript
// Use primaryTeamData if provided (already world-aware from GMDashboard)
// Otherwise load with world-awareness via loadWorldTeamData
const data = primaryTeamData || (await loadWorldTeamData(worldId, primaryTeam));
```

**Location 3: `selectTeam` function (useTradeMachine.js line 585-587)**

```javascript
// World-aware loading for secondary teams in trade machine
const data = await loadWorldTeamData(worldId, teamId);
```

### Existing Guardrails Confirm Worldless Support

From `docs/tradeMachine/return-packages/RP_P0_worldless_baseline_salary_2026-01-03.md`:

> "Worldless Fallback is CORRECT: `loadWorldTeamData(null, teamId)` correctly falls back to `loadTeamCapSheet()`"

37 guardrail tests already exist to verify this behavior works correctly.

---

## 6) Firestore Reality Check

**Emulator was not running during preflight.** Manual verification needed:

```bash
# Start emulator
npm run emu

# In another terminal, check data counts
FIRESTORE_EMULATOR_HOST=127.0.0.1:8082 npm run emu:doctor
```

### Expected Counts (from scripts/emu/README.md)

| Collection                   | Expected Count     | Notes                          |
| ---------------------------- | ------------------ | ------------------------------ |
| `architect_baseTeams`        | 30                 | All NBA teams with roster data |
| `architect_basePlayers`      | ~500+              | Player data hydrated per team  |
| `architect_baseEntitlements` | 30+ per team       | Draft pick entitlements        |
| `architect_basePickRules`    | 100+               | Pick swap/protection rules     |
| `architect_worlds`           | 0 (unless created) | User-created scenarios         |

### Key Firestore Paths

- **Base teams**: `architect_baseTeams/{teamCode}` (e.g., `architect_baseTeams/LAL`)
- **Base players**: `architect_basePlayers/{playerId}`
- **World teams** (if world selected): `architect_worlds/{worldId}/teams/{teamCode}`

---

## 7) Root Cause

**Trade Machine is architecturally designed to work WITHOUT a world selected.** The `loadWorldTeamData` function explicitly handles `null` worldId by falling back to base team data.

If Trade Machine shows empty teams, the most likely causes are:

1. **Data not loaded yet**: Trade Machine renders before `useArchitectState` finishes loading
2. **Empty Firestore**: `architect_baseTeams` collection has no documents in the emulator
3. **Route issue**: No `teamId` in URL (navigating to `/gm` instead of `/gm/LAL`)
4. **primaryTeam resolution failure**: `TeamMap[primaryTeam]` returns undefined if team slug doesn't match

The code does NOT have a "world required" assumption. Both surfaces use the same data pipeline.

---

## 8) Fix Options (Ranked by Blast Radius)

### Option A: No Code Fix Needed — Verify Data

**Blast radius: NONE**

1. Start emulator (`npm run emu`)
2. Run doctor to verify base teams exist (`emu:doctor`)
3. Navigate to `/gm/LAL` (or any valid team)
4. Confirm Trade Machine loads the team

If base teams are empty: `npm run emu:reseed:baseTeams`

### Option B: Add Loading State Guard to TradeEditor

**Blast radius: MINIMAL**

If Trade Machine flashes empty before data loads, add:

```jsx
// In TradeEditor.jsx, before rendering team cards
if (teams.length === 0 || !teams[0]?.team) {
  return <div>Loading trade machine...</div>;
}
```

**Files affected:** `src/features/architect/tradeMachine/TradeEditor.jsx`

### Option C: Ensure Team Slot 1 Defaults to First Available Team

**Blast radius: LOW**

If the user expectation is "Trade Machine shows two teams by default", wire slot 1 to auto-populate with a suggested trade partner:

```javascript
// In useTradeMachine init effect
setTeams([
  { team: teamObj, sends: [], entitlementsOut: [] },
  { team: null, sends: [], entitlementsOut: [] }, // ← Could be auto-filled
]);
```

**Files affected:** `src/features/architect/hooks/useTradeMachine.js`

---

## 9) Stop Conditions / Unknowns

### Verified ✅

- Trade Machine hook does NOT require worldId
- Fallback chain is correct (`loadWorldTeamData(null, teamId)` → `loadTeamCapSheet`)
- Cap Sheet and Trade Machine share the same data source

### Needs Runtime Verification ⚠️

- Actual Firestore emulator state (is `architect_baseTeams` populated?)
- Console errors when Trade Machine renders
- Whether "empty" means "no teams" or "teams with empty rosters"

### Not Applicable (Ruled Out)

- World-dependent early returns in Trade Machine (none found)
- Separate data paths between Cap Sheet and Trade Machine (they share one)

---

## 10) Recommended Next Steps

1. **Run emulator + doctor** to confirm base teams are seeded
2. **Navigate to `/gm/LAL`** and check console for errors
3. **If data exists and still empty**: Capture exact console output for Phase 2 debugging
4. **If data missing**: Run `npm run emu:reseed:baseTeams` and re-test

---

## Appendix: Key Code Excerpts

### useTradeMachine.js — Init Early Return (line 279)

```javascript
if (!primaryTeam) return;
```

This only returns early if no `primaryTeam` prop is passed — not if worldId is missing.

### worldTeamData.ts — Fallback Logic (line 91-101)

```typescript
if (!worldId) {
  return await loadTeamCapSheet(teamId);
}
// World-aware loading via teamLoader
const teamData = await getTeam(worldId, teamCode);
return teamData as CapSheet;
```

### GMDashboard.jsx — TradeSection Props (line 295-302)

```jsx
<TradeSection
  primaryTeam={teamId}
  capProjections={capProjections}
  currentYear={currentYear}
  playersMap={playersMap}
  onApplyTrade={actions.applyTradeToCapSheet}
  primaryTeamData={teamCapSheet} // ← Same data Cap Sheet uses
  onEditContract={actions.handleEditContract}
  worldId={worldId}
/>
```
