# STEP 4 — World-Aware Loading, Reload, and Downstream State Application

## Scope

League / World Time / As-Of — Step 4: World-Aware Loading, Reload, and Downstream State Application

**Date:** 2026-04-03  
**Source:** Direct live-code inspection

---

## Purpose of this Step

Review the world-aware load / reload / downstream-state-application system to determine whether world-scoped team data, metadata, roster index, and player overrides are loaded and reapplied correctly across Architect.

Main questions:

- whether world-aware load / reload behavior is structurally clean and authoritative
- whether baseline team data, active cap sheet data, world metadata, roster index, and player overrides all tell one coherent reload story
- whether world reload after mutation is trustworthy
- whether any duplicate, fallback, stale, or weaker state-application paths still exist
- whether downstream Architect state is clearly tied to the same world-aware load / reload source of truth

---

## Executive Verdict

**RISK**

The world-aware loading / reload / state-application system is mostly coherent, but the correct verdict is still **RISK** rather than **PASS**.

The strongest parts of the seam are clean:

- `useArchitectState.ts` is the central owner for world-aware team loading, metadata loading for `worldAsOfDate`, roster-index refresh, player overrides, merged `worldAwarePlayers`, and derived `freeAgents`
- `worldTeamData.ts` provides a readable dashboard-facing load surface through `loadWorldTeamData(...)`
- `teamLoader.ts` provides a coherent fallback chain for team snapshots, league reads, and player override reads
- `GMDashboard.tsx` fans the hook-owned state out into downstream sections instead of making every section load its own main team snapshot
- `TradeSection.tsx` and `FreeAgencySection.tsx` are mostly prop-fed wrappers, which is good source-of-truth discipline

The remaining risks are:

- post-mutation reload / reapply behavior is not fully centralized in one owner seam; `useArchitectActions.ts` contains lighter mutation-side sync/reload paths rather than always routing through `useArchitectState.reloadActiveWorldTeamData()`
- world metadata truth is not fully centralized; `OffseasonSection.tsx` independently loads `currentSeason` from `getWorldMetadata(...)` into local section state
- the feature still depends on multiple coordinated read/apply seams (team snapshot load, metadata read, league/roster-index refresh, override merge) that are close but not fully unified into one reload owner path

These are not active proof of breakage, but they are enough to keep the right verdict at **RISK**.

---

## World-Aware Load / Reload / State-Application Map

### 1. Central state owner

`useArchitectState.ts` is the primary owner of the world-aware dashboard state surface.

It owns:

- world-aware team loading through `loadWorldTeamData(worldId, teamId)`
- active-world reload through `reloadActiveWorldTeamData()`
- metadata loading for `worldAsOfDate`
- league-backed roster-index refresh through `refreshWorldRosterIndex()`
- `worldPlayerOverrides`
- merged `worldAwarePlayers`
- derived `freeAgents`
- export of `teamCapSheet`, `playersMap`, `freeAgents`, `worldId`, `worldAsOfDate`, and `worldModeBoundary`

This is the strongest owner seam in the current design.

### 2. Dashboard-facing team loader

`worldTeamData.ts` provides the dashboard-facing load helper:

- `loadWorldTeamData(worldId, teamId)`

This helper:

- resolves the team code
- routes base mode through `loadTeamCapSheet(...)`
- routes world mode through `teamLoader.getTeam(...)`
- normalizes exception ownership
- synchronizes team totals snapshots before returning data

This is the main readable entry point for dashboard-side world-aware team reads.

### 3. Fallback-chain loader layer

`teamLoader.ts` owns the lower-level fallback chain and world/base data lookup logic.

Important surfaces:

- `getTeam(worldId, teamCode)`
- `getLeague(worldId)`
- `getPlayer(worldId, teamCode, playerId)`
- `hydrateTeamFromSnapshot(...)`
- `mergePlayerOverride(...)`

Its team fallback story is:

**world snapshot → parent world → base team**

Its league read story is:

- batch world snapshots first
- then parent/base fallback per missing team

Its player read story is:

- base player first
- then world/player override
- then parent override fallback

### 4. Downstream application layer

`GMDashboard.tsx` is the main fan-out boundary that hands hook-owned state into downstream sections.

It passes world-aware values such as:

- `teamCapSheet`
- `playersMap`
- `freeAgents`
- `worldId`
- `worldAsOfDate`
- `worldModeBoundary`
- active-world / world-time owners
- `onReloadWorldData`

This is broadly a good pattern because the main sections mostly consume world-aware state instead of loading it independently.

---

## Team Data / Metadata / Roster-Index / Override Analysis

### Team snapshot loading

The team snapshot story is coherent.

`useArchitectState.ts` fetches team data through `loadWorldTeamData(worldId, teamId)` and applies that result to both:

- `baselineCapSheet`
- `teamCapSheet`

`reloadActiveWorldTeamData()` uses the same team loader again for active-world reload.

This part of the system is structurally clean.

### Metadata loading

The metadata story is only partially centralized.

`useArchitectState.ts` clearly owns `worldAsOfDate` loading by reading `getWorldMetadata(worldId)`:

- during main fetch on world switch
- during `reloadActiveWorldTeamData()`

That is good for the as-of seam.

However, `OffseasonSection.tsx` separately reads `getWorldMetadata(worldId)` to maintain a local `worldSeason` state for season-advance UI.

That means downstream metadata truth is not fully centralized through the hook owner.

### Roster-index loading

The roster-index story is coherent but intentionally separate from the team snapshot story.

`refreshWorldRosterIndex()` in `useArchitectState.ts` calls `getLeague(worldId)` and rebuilds:

- `worldRosterIndex`
- `worldPlayerOverrides`

This is what powers the world-aware `freeAgents` derivation.

This design is reasonable, but it means the overall world-aware state depends on a second coordinated world read path beyond the main team snapshot loader.

### Player override application

Player override application is structurally clean.

`useArchitectState.ts` merges base players with `worldPlayerOverrides` inside `worldAwarePlayers`, then rebuilds `playersMap` from the merged set.

This is a good downstream application seam.

The main risk is not the merge itself — it is whether all mutation/reload flows keep this merge in sync through one owner story.

---

## World Reload After Mutation

### What is strong

There is a real full hook-owned reload path:

- `reloadActiveWorldTeamData()`

This path reloads:

- team snapshot
- roster index / player overrides
- `worldAsOfDate`

That is the cleanest complete reload owner in the feature.

World season advancement in `OffseasonSection.tsx` also uses a reasonably careful aftermath flow:

- apply committed aftermath locally
- then call `onReloadWorldData` if available

### What is risky

Many other mutation aftermath flows do not route through the full hook-owned reload path.

`useArchitectActions.ts` contains mutation-side sync paths such as:

- `syncTeamFromMutationResult(...)`
- world-mode signing / sign-and-trade / offer-sheet execution flows
- other mutation completion paths that use changed-team snapshots or direct `loadWorldTeamData(...)` reloads plus `refreshWorldRosterIndex()`

Those paths can be logically valid, but they are still lighter parallel reload/application seams rather than one central reload owner.

That split means the reload story is not fully singular.

---

## Misleading, Duplicated, Stale, or Weakly Owned Paths

### Real weakness 1: split reload ownership after mutations

`useArchitectState.ts` has the full authoritative reload path, but `useArchitectActions.ts` also contains its own mutation-side reload/application logic instead of always delegating to that owner.

This is the biggest Step 4 risk.

### Real weakness 2: metadata truth is not fully centralized

`OffseasonSection.tsx` independently loads `currentSeason` from world metadata and keeps a local `worldSeason` state.

That is understandable for the section, but it means not all world metadata truth flows through the same central owner.

### Real weakness 3: coordinated but separate read paths

The full downstream state depends on multiple coordinated reads:

- main team snapshot loader
- metadata read for `worldAsOfDate`
- league/roster-index read
- override merge

These seams currently work together, but they are not fully unified into one single reload contract.

### Real weakness 4: base-mode vs world-mode team loading differ structurally

`loadWorldTeamData(...)` uses `loadTeamCapSheet(...)` in base mode and `teamLoader.getTeam(...)` in world mode.

That is not proven wrong, but it is another place where long-term application-shape drift could emerge.

---

## PASS / RISK / FAIL

### Result: RISK

### Why this is not FAIL

- there is a real central owner in `useArchitectState.ts`
- the lower-level fallback chain in `teamLoader.ts` is coherent
- roster index and overrides are rebuilt intentionally from league truth
- major downstream sections are mostly hook-fed rather than self-loading their own main team snapshots

### Why this is not PASS

- post-mutation reload/application is not fully centralized
- downstream metadata truth is not fully centralized
- the feature still depends on multiple coordinated load/apply seams that are close but not yet one complete owner story

---

## Files Reviewed

- `src/features/architect/GMDashboard/hooks/useArchitectState.ts`
- `src/features/architect/utils/worldTeamData.ts`
- `src/features/architect/utils/teamLoader.ts`
- `src/features/architect/GMDashboard/hooks/useArchitectActions.ts`
- `src/features/architect/GMDashboard/GMDashboard.tsx`
- `src/features/architect/GMDashboard/sections/OffseasonSection.tsx`
- `src/features/architect/GMDashboard/sections/TradeSection.tsx`
- `src/features/architect/GMDashboard/sections/FreeAgencySection.tsx`

---

## Exact File + Function Anchors

### `src/features/architect/GMDashboard/hooks/useArchitectState.ts`

- `useArchitectState`
- `reloadActiveWorldTeamData`
- `refreshWorldRosterIndex`
- `worldAwarePlayers`
- free-agent derivation effect
- main fetch effect that loads team snapshot + metadata

### `src/features/architect/utils/worldTeamData.ts`

- `loadWorldTeamData`
- `resolveTeamCode`
- loaded-team totals / exception-owner normalization helpers

### `src/features/architect/utils/teamLoader.ts`

- `getTeam`
- `getLeague`
- `getPlayer`
- `hydrateTeamFromSnapshot`
- `mergePlayerOverride`

### `src/features/architect/GMDashboard/hooks/useArchitectActions.ts`

- `syncTeamFromMutationResult`
- `runAuthoritativeFAMutation`
- world-mode signing / sign-and-trade / offer-sheet execution paths that directly reload/apply team snapshots
- mutation-side roster-index refresh usage

### `src/features/architect/GMDashboard/GMDashboard.tsx`

- main state fan-out into downstream sections
- `onReloadWorldData`
- handoff of `teamCapSheet`, `playersMap`, `freeAgents`, `worldId`, `worldAsOfDate`

### `src/features/architect/GMDashboard/sections/OffseasonSection.tsx`

- `loadWorldSeason`
- `handleCommittedWorldAdvanceComplete`
- local `worldSeason` state
- `onReloadWorldData` usage

### `src/features/architect/GMDashboard/sections/TradeSection.tsx`

- `TradeSection`

### `src/features/architect/GMDashboard/sections/FreeAgencySection.tsx`

- `FreeAgencySection`

---

## Final Conclusion

The world-aware loading / reload / downstream-state-application system is mostly correct and largely coherent, but it still contains enough split reload ownership and metadata-centralization weakness to keep the right Step 4 verdict at:

**RISK**
