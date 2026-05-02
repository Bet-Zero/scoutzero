# Pile B JS → TS Conversion Audit

> Historical status: completed TypeScript campaign record.
> Current status: TypeScript migration and hardening are complete in this repo.
> Reopen only if a TypeScript maintenance gate regresses.
> Current entry point: [docs/typescript/README.md](typescript/README.md)

**Generated:** 2026-04-18  
**Purpose:** Survey of remaining non-Architect feature hooks, utilities, and bridge files for Step 11+ of `docs/TS_CONVERSION_NEXT_STEPS.md`.

---

## Scope Summary

Pile B currently contains **19 JS files** under `src/features/**/hooks/**` and `src/features/**/utils/**`, excluding Architect. The files span `filters`, `profile`, `ranker`, `roster`, `table`, and `tierMaker`.

High-risk boundary types in this pile:

- **Firestore writes / ownership:** `useAutoSavePlayer.js`, `useRankerSession.js`, `useRosterManager.js`, `tierMaker/utils/saveAsListBridge.js`.
- **Browser storage:** `rankerLocalDraft.js`, `usePlayerTableDensity.js`.
- **URL / routing:** `usePlayerNavigation.js`.
- **Cross-feature shared logic:** `profile/hooks/usePlayerProfileState.js` imports roster enrichment; `roster/utils/index.js` feeds shared hooks and Architect roster visuals.

---

## filters

Feature owner: filters / player table controls.

| File | Lines | Exports | Imports | Imported by | Pile A deps | Notes |
|------|-------|---------|---------|-------------|-------------|-------|
| `src/features/filters/hooks/useActiveFilterCount.js` | 68 | default `useActiveFilterCount` | `react`, `@/constants/yearDefaults` | `src/features/table/PlayerTable/index.jsx` | `@/constants/yearDefaults` | Counts non-default filter values for the table badge; simple hook, but depends on the typed salary-year constant. |

---

## profile

Feature owner: profile / scouting.

| File | Lines | Exports | Imports | Imported by | Pile A deps | Notes |
|------|-------|---------|---------|-------------|-------------|-------|
| `src/features/profile/utils/profileHelpers.js` | 161 | `getPlayersForTeam`, `getModalTitle`, `getBlurbValue`, `getVideoExamplesForKey`, `setVideoExamplesForKey`, `addVideoExampleForKey`, `removeVideoExampleForKey`, `setBlurbForKey`, `updateVideoExampleLabelForKey` | `@/shared/utils/blurbs`, `@/shared/utils/videoExamples` | profile UI, `usePlayerNavigation.js`, `usePlayerProfileState.js`, scouting tests | `blurbs`, `videoExamples` | Pure profile helper layer around team player lookup, blurb keys, and video example mutation. Convert before profile hooks. |
| `src/features/profile/hooks/usePlayerNavigation.js` | 222 | default `usePlayerNavigation` | `react`, `react-router-dom`, `@/shared/hooks/useSimplePlayerData`, `@/shared/hooks/usePlayerDetail`, `@/features/profile/utils/profileHelpers`, `@/shared/utils/routing/playerRouteUtils` | `src/pages/PlayerProfileView.jsx`, scouting tests | `useSimplePlayerData`, `usePlayerDetail`, `playerRouteUtils` | URL param, slug, team filtering, and keyboard navigation hook. This is the profile routing boundary and should use typed route/result shapes. |
| `src/features/profile/hooks/usePlayerProfileState.js` | 200 | default `usePlayerProfileState` | `react`, `@/features/roster/utils/enrichPlayerData`, `@/shared/utils/blurbs`, `@/shared/utils/videoExamples`, `@/features/profile/utils/profileHelpers`, `@/constants/scoutingConstants` | `src/pages/PlayerProfileView.jsx` | `blurbs`, `videoExamples`, `scoutingConstants` | Central evaluation state hook for traits, roles, blurbs, videos, badges, and dirty tracking. Depends on roster enrichment and profile helpers. |
| `src/features/profile/hooks/useAutoSavePlayer.js` | 351 | default `useAutoSavePlayer` | `react`, `firebase/firestore`, `@/firebaseConfig`, `@/data/firestorePaths`, `@/shared/utils/blurbs`, `@/shared/utils/videoExamples` | `src/pages/PlayerProfileView.jsx` | `firestorePaths`, `blurbs`, `videoExamples` | Highest-risk profile file: debounced Firestore write boundary for evaluations/current plus denormalized season/player updates. Convert after profile state shapes are named. |

---

## ranker

Feature owner: ranker.

| File | Lines | Exports | Imports | Imported by | Pile A deps | Notes |
|------|-------|---------|---------|-------------|-------------|-------|
| `src/features/ranker/utils/rankingEngine.js` | 570 | `createClosureCache`, `suggestNextPair`, `estimateRemainingComparisons`, `buildAnchorComparisons`, `generateRankingFromComparisons` | none | `RankingSession.jsx`, `useRankerSession.js`, ranker tests | none | Largest pure algorithm utility. No Pile A dependency, but needs careful graph/comparison types and existing test coverage first. |
| `src/features/ranker/utils/saveAsListBridge.js` | 63 | `buildRankerListName`, `resolveFinalOrderIds`, `createRankerListFromRanking` | none | `useRankerSession.js`, `tests/rankerSaveAsList.test.js` | none direct | Small bridge with injected `createListFn`/`saveListFn`; good early conversion before the ranker hook. |
| `src/features/ranker/utils/rankerLocalDraft.js` | 226 | `loadLocalDraft`, `saveLocalDraftImmediate`, `clearLocalDraft`, `hasLocalDraft`, `saveLocalDraftDebounced`, `flushPendingDraftSave`, `createInitialDraft`, `__testing`, default object | none | `RankingBuilder.jsx`, `useRankerSession.js`, `tests/rankerLocalDraft.test.js` | none | Browser `sessionStorage` persistence boundary for local drafts. Needs a `RankerDraft` type and runtime validation on `JSON.parse`. |
| `src/features/ranker/hooks/useRankerSession.js` | 496 | `useRankerSession`, default `useRankerSession` | `react`, `@/shared/hooks/useAuth`, `@/config/ownerConfig`, `@/firebase/rankerHelpers`, `@/firebase/listHelpers`, ranker utils | `RankingBuilder.jsx` | `useAuth`, `rankerHelpers`, `listHelpers` | High-risk hook combining local draft persistence, owner-only Firestore sessions, ranking closure rebuild, and save-as-list behavior. Convert after ranker utilities. |

---

## roster

Feature owner: roster builder.

| File | Lines | Exports | Imports | Imported by | Pile A deps | Notes |
|------|-------|---------|---------|-------------|-------------|-------|
| `src/features/roster/utils/contractUtils.js` | 23 | `isTwoWayContract` | none | Re-exported by `src/features/roster/utils/index.js`; no direct import detected | none | Tiny two-way detector. It overlaps conceptually with shared filtering `isPlayerTwoWay`, but keep behavior stable during conversion. |
| `src/features/roster/utils/rosterUtils.js` | 120 | `normalizeHeadshotId`, `normalizePlayer`, `createMissingRosterPlayer`, `isRosterFull`, `buildInitialRoster`, `createEmptyRoster`, `normalizeRosterShape` | none | Re-exported by roster utils barrel | none | Core roster shape normalizer. Convert before the barrel and hook. |
| `src/features/roster/utils/rosterBuilderHelpers.js` | 282 | `findSalaryForYear`, `hasActiveAddPlayerFilters`, `filterRosterDrawerPlayers`, `getPlayersForSelectedTeam` | `@/constants/yearDefaults`, `@/shared/utils/filtering`, `@/shared/utils/roles` | Re-exported by roster utils barrel; roster drawer tests | `yearDefaults`, `filtering`, `roles` | Roster drawer filtering and salary lookup. Depends heavily on newly typed Pile A filters/roles. |
| `src/features/roster/utils/enrichPlayerData.js` | 424 | `enrichPlayerData` | `@/shared/utils/roles/roleUtils`, `@/shared/utils/blurbs`, `@/shared/utils/videoExamples` | `usePlayerProfileState.js`, scouting tests | `roles/roleUtils`, `blurbs`, `videoExamples` | Large enrichment bridge that adapts player documents into profile/table-friendly fields. Cross-feature dependency for profile state. |
| `src/features/roster/utils/index.js` | 5 | re-exports `contractUtils.js`, `enrichPlayerData.js`, `rosterBuilderHelpers.js`, `rosterUtils.js` | local roster utils | `useRosterManager.js`, shared player-data hooks, roster UI, Architect `RosterVisual`, roster tests | indirect | Barrel should convert last in roster utils, after export paths no longer include `.js` suffixes. |
| `src/features/roster/hooks/useRosterManager.js` | 361 | `emptyRoster`, `useRosterManager` | `react`, `@/features/roster/utils`, `@/shared/utils/roles`, `@/shared/utils/filtering`, `@/firebase/rosterHelpers`, `@/constants/teamList` | `RosterViewer.jsx` | `roles`, `filtering`, `rosterHelpers`, `teamList` | High-risk roster hook: roster project CRUD, team selection, roster normalization, add/remove/move operations, and saved roster loading. Convert after roster utils and barrel. |

---

## table

Feature owner: player table.

| File | Lines | Exports | Imports | Imported by | Pile A deps | Notes |
|------|-------|---------|---------|-------------|-------------|-------|
| `src/features/table/PlayerTable/hooks/usePlayerTableDensity.js` | 98 | `usePlayerTableDensity`, `DENSITY_MODES`, `DENSITY_SCALES`, default `usePlayerTableDensity` | `react` | `DensityToggle.jsx`, `PlayerTable/index.jsx` | none | LocalStorage-backed density preference hook. Needs literal union types for density modes. |
| `src/features/table/hooks/useFilteredPlayers.js` | 15 | default `useFilteredPlayers` | `react`, `@/shared/utils/filtering/playerFilterUtils` | `PlayerTable/index.jsx` | `playerFilterUtils` | Thin memoized wrapper over Pile A `filterPlayers`/`sortPlayers`; should be simple once player/filter types are imported. |
| `src/features/table/hooks/useFilterDiagnostics.js` | 311 | `useFilterDiagnostics`, default `useFilterDiagnostics` | `react`, `@/shared/utils/filtering/playerFilterCatalog`, `@/shared/utils/filtering/playerFilterDefaults` | `PlayerTable/index.jsx` | `playerFilterCatalog`, `playerFilterDefaults` | Dev diagnostics hook gated by `?debugFilters=1`. Touches URL query params and diagnostic object shapes, but no persistence. |

---

## tierMaker

Feature owner: tier maker.

| File | Lines | Exports | Imports | Imported by | Pile A deps | Notes |
|------|-------|---------|---------|-------------|-------------|-------|
| `src/features/tierMaker/utils/saveAsListBridge.js` | 213 | `buildListPayloadFromTierMaker`, `buildListPayloadFromTieramid`, `saveTierAsList`, `generateDefaultListName` | `@/firebase/listHelpers` | `TierMakerBoard.jsx`, `TieramidBoard.jsx`, `tests/tierSaveAsList.test.js` | `listHelpers` | Bridge from tier boards to list documents. External boundary is list creation/save through typed Firebase helpers. |

---

## Recommended Conversion Order

The order below keeps Step 11 on utilities/bridges first, then Step 12 on hooks. Files that feed barrels or hooks come before their consumers.

### Step 11 order — utils and bridges

1. `src/features/roster/utils/contractUtils.js` — tiny leaf, exported through roster barrel.
2. `src/features/roster/utils/rosterUtils.js` — core roster shape leaf; needed by the barrel and manager hook.
3. `src/features/ranker/utils/saveAsListBridge.js` — small pure bridge with injected persistence functions.
4. `src/features/profile/utils/profileHelpers.js` — pure profile helpers; required by profile hooks.
5. `src/features/ranker/utils/rankerLocalDraft.js` — sessionStorage boundary; convert before the ranker hook.
6. `src/features/ranker/utils/rankingEngine.js` — largest pure utility; convert before the ranker hook and keep ranking tests close.
7. `src/features/roster/utils/rosterBuilderHelpers.js` — depends on typed Pile A filtering/roles and feeds roster barrel.
8. `src/features/roster/utils/enrichPlayerData.js` — cross-feature player enrichment; convert before profile state.
9. `src/features/tierMaker/utils/saveAsListBridge.js` — Firebase list bridge; convert with tier save-as-list tests.
10. `src/features/roster/utils/index.js` — convert roster barrel last, after local re-exports are `.ts`.

### Step 12 order — hooks

1. `src/features/table/PlayerTable/hooks/usePlayerTableDensity.js` — localStorage leaf hook with narrow density literals.
2. `src/features/table/hooks/useFilteredPlayers.js` — thin Pile A wrapper; low complexity.
3. `src/features/filters/hooks/useActiveFilterCount.js` — simple derived count hook.
4. `src/features/table/hooks/useFilterDiagnostics.js` — debug diagnostics hook; depends on typed filter defaults/catalog.
5. `src/features/profile/hooks/usePlayerNavigation.js` — route/search-param boundary; convert after `profileHelpers.ts`.
6. `src/features/profile/hooks/usePlayerProfileState.js` — evaluation state hook; convert after `profileHelpers.ts` and `enrichPlayerData.ts`.
7. `src/features/profile/hooks/useAutoSavePlayer.js` — Firestore write boundary; convert after profile state shapes are named.
8. `src/features/roster/hooks/useRosterManager.js` — roster CRUD and normalization hook; convert after the roster utils barrel.
9. `src/features/ranker/hooks/useRankerSession.js` — largest hook and highest ranker blast radius; convert after all ranker utilities.

### Tight-coupling notes

- `profileHelpers.js`, `usePlayerNavigation.js`, and `usePlayerProfileState.js` share modal key, blurb, and video-example contracts. Convert `profileHelpers.js` first and reuse its exported types in both hooks.
- `roster/utils/index.js` should not convert before its leaf modules. The current barrel includes `.js` suffixes that should become extensionless exports after the leaf conversions.
- `useRankerSession.js` should wait for all three ranker utilities. It currently coordinates local drafts, closure cache rebuilds, Firestore helpers, and save-as-list behavior.
- `useAutoSavePlayer.js` and `tierMaker/utils/saveAsListBridge.js` are the two clearest external write boundaries in this pile. They should get the most focused validation.
