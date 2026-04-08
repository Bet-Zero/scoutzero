# ARCHITECT ROSTER - STEP 1 REVIEW RECORD

## Scope

Architect Roster - Step 1: Roster Display Adapter, World/Base Truth Dependency, and Legacy Boundary

**Date:** 2026-04-08  
**Source:** Direct live-code inspection

This review intentionally scoped to the live roster surface used by Architect. It did not expand into the old standalone roster feature beyond the legacy files directly exercised by Architect.

## Purpose of this Step

Determine whether Architect Roster is a small display-only seam or a larger feature that needs multiple review steps.

Main questions:

- how the dashboard roster tab enters the live roster surface
- where roster state and player truth come from
- whether roster correctness depends on world-aware `playersMap` and upstream world/base merging
- how roster shaping and hydration work
- how the final render path flows into legacy roster components
- whether there are hidden persistence or source-of-truth risks
- whether legacy/shared roster code introduces duplicate path risk
- whether existing tests meaningfully cover roster truth

## Executive Verdict

**RISK**

Architect Roster is coherent and small enough to be a one-step feature, but it is not clean enough to call `PASS`.

The strong parts:

- the live entry is easy to trace from `GMDashboard`
- the roster tab consumes `teamCapSheet` and `playersMap` from `useArchitectState`
- `RosterSection` is a thin adapter into `RosterVisual`
- `RosterVisual` is display-only and does not write Firestore or mutate dashboard state
- legacy roster add/remove controls are hidden through `isExport`
- the broader old roster manager path is not live in Architect

The main risk:

- roster correctness depends on upstream world/base data loading and `playersMap` override merging, but that dependency is implicit at the display adapter
- `RosterVisual` uses loose records and `any`, merges only selected player lookup keys, and duplicates some player/headshot fallback logic already present in legacy utilities/cards
- Architect depends on legacy roster utilities and card components without focused guardrails that pin the display-only boundary
- existing tests are mostly smoke/import coverage and do not prove roster truth across world/base dependencies

## Final Feature Shape Decision

**Architect Roster should be modeled as a one-step feature.**

Reason:

- the local roster surface is one tab/display adapter seam
- no hidden roster persistence path appears inside the live Architect roster render path
- upstream team/player truth exists outside this seam, but roster is a consumer of that truth rather than an authoritative owner
- the needed follow-up work is small and can be handled as Step 1 execution with two adjacent substeps

No stop condition triggered.

## Exact System Map

### 1. Dashboard tab entry

`GMDashboard` reads `teamId` from `useParams`, normalizes it, and calls `useArchitectState`.

The roster tab is part of the dashboard tab bar. Clicking the tab calls:

- `setActiveTab('roster')`

The default active tab in `useArchitectState` is:

- `useState<ActiveTab>('roster')`

When active, `GMDashboard` renders:

- `GMDashboard/sections/RosterSection`

with:

- `teamCapSheet={teamCapSheet}`
- `playersMap={playersMap}`
- `teamId={normalizedTeamId}`

### 2. State/data source

`useArchitectState` owns the dashboard data source for the roster tab.

It loads `teamCapSheet` through:

- `loadCoordinatedWorldBundle(worldId)`
- `loadWorldTeamData(worldId, teamId)`

`loadWorldTeamData` resolves team data as:

- base mode: `loadTeamCapSheet(teamId)`
- world mode: `getTeam(worldId, teamCode)`

`getTeam` resolves:

- world team snapshot
- parent world team snapshot
- base team fallback

Base team hydration reads base roster IDs and hydrates them from base player docs through `hydrateBaseTeam`.

### 3. World-aware player truth / playersMap dependency

`useArchitectState` separately loads base player data through:

- `useArchitectPlayerData`
- `subscribeArchitectPlayerData`
- `architect_basePlayers`

In world mode, it gathers a league-wide roster/player override bundle through:

- `resolveWorldRosterBundle(worldId)`
- `getLeague(worldId)`

That bundle builds:

- `worldRosterIndex`
- `worldPlayerOverrides`

`worldAwarePlayers` merges each world override onto the matching base player through `mergeWorldPlayerOverride`.

`playersMap` is then built from `worldAwarePlayers` with keys for:

- `name`
- normalized `name`
- `id`
- `player_id`
- `bio.playerId`

The roster display therefore depends on upstream world/base truth being merged correctly before `RosterVisual` receives `playersMap`.

### 4. Roster shaping / hydration logic

`GMDashboard/sections/RosterSection` is only a wrapper. It passes props into:

- `src/features/architect/shared/RosterVisual/RosterVisual.tsx`

`RosterVisual` reads:

- `teamCapSheet.players`
- `playersMap`
- `teamId` or route `teamId`

It enriches each player by trying:

- `playersMap[p.name]`
- `playersMap[p.displayName]`
- `playersMap[p.id]`

Then it merges:

- `...details`
- `...p`

This means the hydrated team player object wins over the broader player-map detail object. It also preserves/derives `bio`, `name`, `displayName`, and `headshot`.

It separates players into:

- standard players through `!isTwoWayContract(p)`
- two-way players through `isTwoWayContract(p)`

It sorts standard players by:

- `MIN`
- fallback `latestSeasonStats.MIN`

It builds the main 15-slot roster through:

- `buildInitialRoster(sorted)`

If the roster has fewer than 15 players and there are two-way players, it fills empty bench slots with two-way players through:

- `normalizePlayer(player)`

### 5. Final rendering path

`RosterVisual` renders the legacy roster display component:

- `src/features/roster/RosterSection/index.jsx`

It renders three sections:

- starters
- rotation
- bench

Each section maps to legacy cards:

- `StarterCard`
- `RotationCard`
- `BenchCard`

Architect passes `isExport`, so the legacy cards receive `showRemove={!isExport}` as `false`. Empty-slot add controls are also not rendered in export mode.

## Display-Only / Hidden Persistence Analysis

The live Architect roster view appears display-only.

Evidence:

- `GMDashboard/sections/RosterSection` only passes props to `RosterVisual`
- `RosterVisual` uses `useMemo` for shaping and renders markup; it does not call Firestore, actions, setters, or persistence helpers
- the legacy `RosterSection` gets `isExport`, so add/remove UI paths are hidden
- legacy cards only render remove buttons when `showRemove` is true
- `EmptySlot` is not rendered in export mode

Important caveat:

- `useArchitectState` has unrelated persistence for active world selection, world time, and current season URL/localStorage state, but those are not roster-display persistence paths.

Conclusion:

- no hidden roster mutation or roster persistence risk was found inside the live Architect roster render path
- the risk is dependency and boundary clarity, not active persistence

## World/Base Truth Dependency Analysis

Roster display correctness depends on upstream truth from two places:

1. `teamCapSheet.players`, loaded from base or world team data.
2. `playersMap`, built from base player subscription data plus world player overrides.

The local roster surface does not determine membership truth. It displays the players it receives.

That is coherent, but it makes the adapter boundary important:

- if upstream `teamCapSheet.players` is stale, roster display will be stale
- if `playersMap` does not include a world override, roster enrichment can miss world-specific player truth
- if the display adapter misses a lookup key, enrichment can silently degrade

Current weak point:

- `playersMap` contains more keys than `RosterVisual` uses. `RosterVisual` does not currently try `p.player_id`, `p.bio?.playerId`, or the normalized-name key even though `useArchitectState` builds those keys.

This is not proof of a current product bug, but it is enough to keep the verdict at `RISK`.

## What Is Coherent

- the live roster seam is compact and easy to trace
- `GMDashboard` owns tab state and passes state-derived truth down
- `useArchitectState` is the single dashboard state/data owner
- `loadWorldTeamData` uses the expected world snapshot -> parent world -> base team fallback chain
- `playersMap` is intentionally world-aware in world mode
- `RosterSection` is a minimal adapter
- `RosterVisual` is a read-only display shaper
- the old mutable roster manager path is not part of the live Architect path
- Architect renders the legacy roster component in export/display mode

## What Is Weak

- the display adapter uses loose `Record<string, unknown>` shapes and `any`
- `RosterVisual` has an implicit merge contract between hydrated team players and `playersMap` details
- not all `playersMap` lookup keys are used by `RosterVisual`
- roster shaping ignores `teamCapSheet.roster` and requires `teamCapSheet.players` to be hydrated upstream
- headshot/name/bio fallback logic is duplicated across `RosterVisual`, `normalizePlayer`, and legacy cards
- two-way handling depends on legacy roster utility behavior from outside the Architect feature
- no focused test proves world/base roster truth or player override hydration through the display adapter

## Duplicate / Fallback / Legacy / Alternate Path Analysis

### Legacy path risk

Architect uses legacy roster display code:

- `src/features/roster/RosterSection/index.jsx`
- legacy roster cards
- `src/features/roster/utils`

That is acceptable because Architect uses it as a display-only renderer, but the boundary is convention-based.

The old standalone roster manager path is not live in the inspected Architect path:

- `useRosterManager`
- `AddPlayerDrawer`
- manual roster add/remove workflows

Those should stay out of scope unless future live imports prove otherwise.

### Duplicate logic risk

There is duplicated player display normalization/fallback logic across:

- `RosterVisual`
- `normalizePlayer`
- legacy cards

This mainly affects headshot, display name, and position fallback behavior. It is a maintainability/test risk, not a discovered persistence bug.

### Fallback path risk

The main fallback chain is upstream:

- world snapshot
- parent world snapshot
- base team

That chain is coherent and expected. The roster view does not own it.

The local fallback risk is that `RosterVisual` silently returns `null` if `teamCapSheet.players` is missing or not an array. This is acceptable only if upstream loaders reliably hydrate `players`.

### Alternate path risk

No alternate live Architect roster render path was found.

Other Architect features import `isTwoWayContract` from roster utilities, but the reviewed roster tab path remains:

`GMDashboard` -> `GMDashboard/sections/RosterSection` -> `RosterVisual` -> legacy roster display.

## Existing Validation / Test Surface

Existing direct or adjacent tests:

- `GMDashboard.smoke.test.tsx` verifies dashboard loading/tab basics, but mocks `RosterSection`, so it does not test roster truth.
- `internalWrapperBatch.e125.guardrail.test.tsx` verifies `RosterVisual` extensionless import parity, but does not test roster behavior.
- `grouped33FileScope.ui.behavior.test.tsx` renders `RosterVisual` and verifies starters/rotation/bench output, but mocks legacy roster utilities and does not exercise real world/base player truth or `playersMap` override behavior.

Conclusion:

- there is meaningful smoke/import coverage
- there is a shallow RosterVisual rendering test
- there is not meaningful roster truth coverage for world/base player merging, `playersMap` lookup behavior, or display-only legacy boundary durability

## PASS / RISK / FAIL

### Result: RISK

### Why this is not FAIL

- no hidden roster persistence path was found
- the live seam is compact and coherent
- the broader old roster manager path is not live in Architect
- world/base truth is upstream and the roster view is a reasonable consumer

### Why this is not PASS

- the adapter/truth contract is too implicit
- `RosterVisual` uses loose shapes and partial `playersMap` lookup coverage
- legacy roster dependency is not strongly pinned as display-only
- tests do not meaningfully cover roster truth or world override behavior

## Final Conclusion

Architect Roster should proceed as a one-step feature.

The correct next prompt is Step 1 execution, likely batching `AR-1A` and `AR-1B` because the code seam and validation surface are the same. The execution should stay narrow: clarify the display adapter and add focused guardrails. It should not redesign upstream world team loading or reopen the standalone roster feature.

## Files Reviewed

Process/reference:

- `docs/_working/architect/ARCHITECT_CHAT_WORKFLOW_CONTINUATION_GUIDE_V3.md`
- `docs/_working/architect/ARCHITECT_REMAINING_REVIEW_ROADMAP.md`

Primary Architect roster seam:

- `src/features/architect/GMDashboard/GMDashboard.tsx`
- `src/features/architect/GMDashboard/hooks/useArchitectState.ts`
- `src/features/architect/GMDashboard/sections/RosterSection.tsx`
- `src/features/architect/shared/RosterVisual/RosterVisual.tsx`

Legacy/shared files directly exercised by Architect:

- `src/features/roster/RosterSection/index.jsx`
- `src/features/roster/RosterSection/StarterCard.jsx`
- `src/features/roster/RosterSection/RotationCard.jsx`
- `src/features/roster/RosterSection/BenchCard.jsx`
- `src/features/roster/utils/index.js`
- `src/features/roster/utils/rosterUtils.js`
- `src/features/roster/utils/contractUtils.js`

Upstream truth dependencies:

- `src/features/architect/utils/worldTeamData.ts`
- `src/features/architect/utils/teamLoader.ts`
- `src/features/architect/utils/firebaseTeamPlanHelpers.ts`
- `src/features/architect/hooks/useArchitectPlayerData.ts`
- `src/features/architect/utils/subscribeArchitectPlayerData.ts`
- `src/features/architect/utils/architectFirestorePaths.ts`

Relevant tests / guardrails:

- `src/tests/architect/GMDashboard.smoke.test.tsx`
- `src/tests/architect/internalWrapperBatch.e125.guardrail.test.tsx`
- `src/tests/architect/grouped33FileScope.ui.behavior.test.tsx`
