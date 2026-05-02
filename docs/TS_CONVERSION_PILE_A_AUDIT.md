# Pile A JS → TS Conversion Audit

> Historical status: completed TypeScript campaign record.
> Current status: TypeScript migration and hardening are complete in this repo.
> Reopen only if a TypeScript maintenance gate regresses.
> Current entry point: [docs/typescript/README.md](typescript/README.md)

**Generated:** 2026-04-18  
**Purpose:** Survey of all Pile A files with conversion metadata. Feed this into Step 2+ of `docs/TS_CONVERSION_NEXT_STEPS.md`.

---

## src/constants/

| File                   | Lines | Exports                                                                                               | Imported by (non-Pile-A callers)          | Notes                                                                                                              |
| ---------------------- | ----- | ----------------------------------------------------------------------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `styles.js`            | 5     | `styles`                                                                                              | unknown (small scope)                     | Pure data — single Tailwind class string object.                                                                   |
| `badgeList.js`         | 27    | `BadgeList`                                                                                           | profile feature, tierMaker                | Pure data — array of badge objects `{ key, label, icon }`.                                                         |
| `scoutingConstants.js` | 35    | `TRAIT_ORDER`, `DEFAULT_TRAITS`, `getTraitColor`                                                      | profile/scouting feature                  | Mixed: two pure-data exports + one function with a rating→color chain.                                             |
| `teamList.js`          | 251   | `TeamListFull`, `TeamMap`, `TeamCodeMap`, `TeamSlugToCode`                                            | 20+ files across features and architect   | Master team reference; heavily imported. `as const` will narrow `TeamListFull` to a tuple of literal team objects. |
| `SubRoleMasterList.js` | 473   | `SubRoleMasterList`, `offensiveSubRoles`, `defensiveSubRoles`, `positiveSubRoles`, `negativeSubRoles` | roles/roleUtils (Pile A), profile, roster | Large static list of sub-role descriptors; helper arrays derived from it.                                          |
| `yearDefaults.js`      | 44    | `DEFAULT_SALARY_YEAR`, `getSalaryYearOptions`, `SALARY_YEAR_OPTIONS`                                  | 7 files (filters, roster, table)          | Imports `getCurrentSeasonYear` from `contracts/contractUtils` (already `.ts`). Will need correct return type.      |

---

## src/data/

| File                | Lines | Exports                                                                                                                                                                                                                   | Imported by (non-Pile-A callers)                   | Notes                                                                                                                                                            |
| ------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `firestorePaths.js` | 61    | `playerRef`, `contractsCol`, `seasonsCol`, `evalsCol`, `contractRef`, `seasonRef`, `evalRef`, `playersCol`, `basePlayersCol`, `basePlayerRef`, `baseTeamsCol`, `baseTeamRef`, `baseEntitlementsCol`, `baseEntitlementRef` | 5 architect files, `usePlayerDetail` hook (Pile A) | Wraps Firebase `doc`/`collection` — all return types already typed by Firebase SDK. Easy conversion once `@/constants/collections` (already `.ts`) is confirmed. |

---

## src/shared/utils/

### filtering/

| File                      | Lines | Exports                                                                                                                                                       | Pile A deps                                                                                                                                | Imported by (non-Pile-A)                               | Notes                                                                                                                                                                                |
| ------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `physicalOptions.js`      | 29    | `generateHeightOptions`, `generateWeightOptions`, `generateAgeOptions`                                                                                        | none                                                                                                                                       | re-exported by `filtering/index.js`; used by filter UI | Pure generators — no imports. Trivial leaf.                                                                                                                                          |
| `statFilters.js`          | 61    | `statOptions`, `getDefaultMaxValue`, `getActiveStatFilters`                                                                                                   | none                                                                                                                                       | re-exported by `filtering/index.js`; used by filter UI | No imports. Leaf. `getActiveStatFilters` takes an untyped `filters` object — will need a `FiltersState` type.                                                                        |
| `filterHelpers.js`        | 318   | `getFilterDisplayValue`, `getFilterStyles`                                                                                                                    | `@/shared/utils/formatting` (Pile A index)                                                                                                 | filter UI components (8 files)                         | Depends on `formatting/index.js`; convert formatting first. Contains a large paint-by-number style switch — untyped `key`/`value` params. Will surface need for `FiltersState` type. |
| `basicFilterUtils.js`     | 206   | `normalizeTeamCode`, `normalizeFreeAgentType`, `getPlayerFreeAgentType`, `teamOptions`, `playerHasOptionType`, `isPlayerTwoWay`, `getDefaultAddPlayerFilters` | `@/constants/teamList` (Pile A)                                                                                                            | roster/AddPlayerDrawer (6 files), `filtering/index.js` | Imports `TeamListFull` from `teamList.js`. Convert `teamList` first. `getDefaultAddPlayerFilters` returns a large literal object — good candidate for an exported type.              |
| `playerFilterDefaults.js` | 68    | `getDefaultPlayerFilters`                                                                                                                                     | `@/constants/yearDefaults` (Pile A)                                                                                                        | filters feature (5 files), `filtering/index.js`        | Imports `DEFAULT_SALARY_YEAR`. Convert `yearDefaults` first. Return type will become the `PlayerFilters` interface.                                                                  |
| `playerFilterUtils.js`    | 347   | `filterPlayers`, `sortPlayers`                                                                                                                                | `@/shared/utils/roles` (Pile A), `@/shared/utils/getPlayerId` (Pile A), `@/constants/teamList` (Pile A), `contracts/contractUtils` (`.ts`) | filters, roster, table (15 files)                      | Most complex filtering file. Multiple Pile A deps — convert all deps first. `filterPlayers(players, filters)` will require a proper `PlayerFilters` type.                            |
| `index.js` (filtering)    | 6     | re-exports all 6 above                                                                                                                                        | —                                                                                                                                          | see above callers                                      | Aggregator barrel; convert last in this sub-group.                                                                                                                                   |

### formatting/

| File                    | Lines | Exports                                                                                                                                           | Pile A deps                                           | Imported by (non-Pile-A)                             | Notes                                                                                        |
| ----------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | ---------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `basicFormatting.js`    | 101   | `formatHeight`, `formatSalary`, `formatMillions`, `formatCurrencyFull`, `formatCurrency`, `formatName`, `formatContractSummary`, `playerAliasMap` | none                                                  | 15+ files across architect, lists, roster            | No imports. Leaf. All functions take primitives and return strings — straightforward typing. |
| `teamColors.js`         | 399   | `TEAM_COLOR_MAP`, `getTeamColors`, `getTeamClassSet`                                                                                              | none                                                  | architect, shared components                         | No Pile A imports. Leaf. `TEAM_COLOR_MAP` shape is stable — good `as const` candidate.       |
| `teamLogos.js`          | 105   | `TEAM_LOGO_MAP`, `getTeamLogoFilename`                                                                                                            | none                                                  | shared components, architect                         | No imports. Leaf.                                                                            |
| `index.js` (formatting) | 3     | re-exports basicFormatting, teamColors, teamLogos                                                                                                 | `basicFormatting.js`, `teamColors.js`, `teamLogos.js` | `filterHelpers.js` (Pile A), 5 architect/trade files | Barrel. Convert leaves first.                                                                |

### roles/

| File               | Lines | Exports                                                                                                                                                                    | Pile A deps                              | Imported by (non-Pile-A)                                | Notes                                                                                                                     |
| ------------------ | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `roleUtils.js`     | 124   | `POSITION_MAP`, `getPlayerPositionLabel`, `expandPositionGroup`, `offensiveRoles`, `defensiveRoles`, `shootingProfileTiers`, `isPositiveSubRole`, `toggleSubroleSelection` | `@/constants/SubRoleMasterList` (Pile A) | 20 files across filters, roster, lists, profile, ranker | Imports `SubRoleMasterList`. Convert `SubRoleMasterList` first. `toggleSubroleSelection` has an untyped `subRoles` param. |
| `index.js` (roles) | 1     | re-exports roleUtils                                                                                                                                                       | `roleUtils.js`                           | —                                                       | Trivial barrel.                                                                                                           |

### selectors/

| File                              | Lines | Exports                                                                                                                                                                                                                                                                                                                                                                                                                                         | Pile A deps | Imported by (non-Pile-A)                                 | Notes                                                                                                                                                                                                                                                          |
| --------------------------------- | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `selectors/newSchemeSelectors.js` | 135   | `getDisplayName`, `getAge`, `getPosition`, `getHeight`, `getWeight`, `getTeamCode`, `getPTS`, `getAST`, `getREB`, `getFGPct`, `get3PPct`, `getFTPct`, `getStat`, `getContractView`, `getSalary`, `getYearsLeft`, `getFAYear`, `hasPlayerOption`, `hasTeamOption`, `getContractRights`, `hasEvaluations`, `getEvalGrades`, `getEvalRoles`, `getEvalSubroles`, `getEvalShootingProfile`, `getEvalTwoWay`, `getEvalBlurbs`, `assertSeasonDocShape` | none        | (usage TBD — name clash with profile selectors possible) | No imports. Leaf. All selectors take `seasonDoc` — a `SeasonDoc` type from `src/schemas/players_v2` should be the input. **Flag:** file is named `newSchemeSelectors.js` but the comment header says `newSchemaSelectors.js` — likely a typo in the file name. |

### top-level shared/utils/

| File                          | Lines | Exports                                                                                                                                                                                                              | Pile A deps | Imported by (non-Pile-A)                  | Notes                                                                                                                                                 |
| ----------------------------- | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `getPlayerId.js`              | 24    | `getPlayerId` (named + default)                                                                                                                                                                                      | none        | architect, roster, profile, table, ranker | No imports. Leaf. Tiny function.                                                                                                                      |
| `blurbs.js`                   | 86    | `DEFAULT_BLRUBS`, `normalizeBlurbs`                                                                                                                                                                                  | none        | profile feature                           | No imports. Leaf. Note: `BLRUBS` typo is in the public API — cannot rename without coordinating callers.                                              |
| `videoExamples.js`            | 165   | `createEmptyVideoExamples`, `isYouTubeUrl`, `extractYouTubeId`, `getYouTubeEmbedUrl`, `getYouTubeThumbnailUrl`, `buildVideoExample`, `normalizeVideoExampleList`, `normalizeVideoExamples`, `DEFAULT_VIDEO_EXAMPLES` | none        | profile feature                           | No imports. Leaf. Several internal helpers are not exported; return types will flow from the clear data shapes.                                       |
| `routing/playerRouteUtils.js` | 138   | `toPlayerSlug`, `getPlayerRouteId`, `getPlayerDisplayName`, `resolvePlayerProfileTarget`, `getPlayerProfileUrl`                                                                                                      | none        | profile/navigation hooks, pages           | No imports. Leaf. `resolvePlayerProfileTarget` returns a union `{ player, source, status }` — deserves a discriminated union or explicit return type. |

---

## src/shared/hooks/

| File                     | Lines | Exports                       | Pile A deps                                                          | Imported by (non-Pile-A)                      | Notes                                                                                                                                                                              |
| ------------------------ | ----- | ----------------------------- | -------------------------------------------------------------------- | --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `useClickOutside.js`     | 25    | default `useClickOutside`     | none                                                                 | UI components                                 | No Pile A imports. Trivial leaf. Params are `RefObject`, `(event) => void`, `boolean`.                                                                                             |
| `useImageDownload.js`    | 61    | default `useImageDownload`    | none                                                                 | export UI components                          | No Pile A imports. Leaf. Param is a `RefObject<HTMLElement>`. Returns `(filename: string, options?: {...}) => Promise<void>`.                                                      |
| `useAuth.js`             | 65    | named `useAuth`               | none                                                                 | architect GMDashboard, 20+ other files        | No Pile A imports. Leaf. Return type: `{ user: FirebaseUser \| null, userId: string \| null, loading: boolean }`.                                                                  |
| `useFirebaseQuery.js`    | 55    | default `useFirebaseQuery`    | none                                                                 | lists, tierMaker, roster, ranker (many files) | No Pile A imports. Leaf. Generic return: `{ data: T[], loading: boolean, error: Error \| null }`. Good candidate for `useFirebaseQuery<T>`.                                        |
| `useSeasonPlayerData.js` | 163   | default `useSeasonPlayerData` | `@/constants/collections` (`.ts`), `@/features/roster/utils` (`.js`) | (deprecated — emit warning)                   | **Deprecated** hook. Marked with `@deprecated` JSDoc. Still in use via `usePlayerData`/`useSimplePlayerData` wrappers. Low priority to convert; the deprecation path matters more. |
| `usePlayerDetail.js`     | 147   | default `usePlayerDetail`     | `@/data/firestorePaths.js` (Pile A), Zod schemas (`.ts`)             | profile hooks, architect player load          | Depends on `firestorePaths.js`. Convert that first. Already uses Zod validation (dev-only). Return type: `{ player: PlayerV2 \| null, loading: boolean, error: string \| null }`.  |

---

## src/firebase/

| File               | Lines | Exports                                                                                                                                                                                                                                                                               | Pile A deps                                          | Imported by (non-Pile-A)             | Notes                                                                                                                                                                              |
| ------------------ | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `rosterHelpers.js` | 80    | `createRosterProject`, `fetchAllRosterProjects`, `loadRosterProject`, `updateRosterProject`, `renameRosterProject`, `deleteRosterProject`                                                                                                                                             | none (only `@/constants/collections` which is `.ts`) | roster pages, hooks                  | Simplest Firebase helper. No ownership guard — no `userId` param. Firestore reads return untyped `doc.data()`. Needs `RosterProject` type + typed write params.                    |
| `listHelpers.js`   | 400   | `fetchAllLists`, `createList`, `createListWithPlayer`, `addPlayerToList`, `renameList`, `deleteList`, `saveList`, `fetchList`, `resolveTierListMode`, `inferTierListMode`, `fetchAllTierLists`, `createTierList`, `renameTierList`, `deleteTierList`, `fetchTierList`, `saveTierList` | none (only `@/constants/collections` which is `.ts`) | lists pages and components (9 files) | Largest helper. Two domains (lists + tier lists) in one file. Needs `PlayerList`, `TierList` types. `resolveTierListMode` returns `'standard' \| 'pyramid'` — good union type.     |
| `rankerHelpers.js` | 237   | `createRankerSession`, `updateRankerSession`, `getRankerSession`, `queryIncompleteRankerSessions`, `queryAllRankerSessions`, `deleteRankerSession`, `serializeSkippedPairs`, `deserializeSkippedPairs`, `serializeAdjustments`                                                        | none (only `@/constants/collections` which is `.ts`) | ranker hooks and tests               | Full ownership guard (userId on all ops). Needs `RankerSession` type. `updateRankerSession` takes `patch: Object` — needs a `RankerSessionPatch` type or `Partial<RankerSession>`. |

---

## Recommended Conversion Order

Leaves first. Files that are imported by other Pile A files go before the files that import them.

### Wave 1 — Pure leaves (no Pile A imports, no complex shapes)

1. `src/constants/styles.js` — 5 lines, trivial
2. `src/constants/badgeList.js` — 27 lines, pure data array
3. `src/constants/scoutingConstants.js` — 35 lines, data + one function
4. `src/shared/utils/getPlayerId.js` — 24 lines, one function
5. `src/shared/utils/routing/playerRouteUtils.js` — 138 lines, pure string/url logic
6. `src/shared/utils/blurbs.js` — 86 lines, normalizer
7. `src/shared/utils/videoExamples.js` — 165 lines, normalizer
8. `src/shared/utils/selectors/newSchemeSelectors.js` — 135 lines, accessor functions
9. `src/shared/utils/formatting/basicFormatting.js` — 101 lines, string formatters
10. `src/shared/utils/formatting/teamColors.js` — 399 lines, data + 2 functions
11. `src/shared/utils/formatting/teamLogos.js` — 105 lines, map + 1 function
12. `src/shared/hooks/useClickOutside.js` — 25 lines, trivial hook
13. `src/shared/hooks/useImageDownload.js` — 61 lines, async hook
14. `src/shared/hooks/useAuth.js` — 65 lines, Firebase auth hook
15. `src/shared/hooks/useFirebaseQuery.js` — 55 lines, generic Firebase query hook

### Wave 2 — Pile A deps, but stable once Wave 1 is done

1. `src/constants/teamList.js` — depends on nothing in Pile A; imported by many
2. `src/constants/SubRoleMasterList.js` — depends on nothing in Pile A
3. `src/constants/yearDefaults.js` — imports `contracts/contractUtils` (already `.ts`)
4. `src/data/firestorePaths.js` — imports `@/constants/collections` (already `.ts`)
5. `src/shared/utils/formatting/index.js` — after 9, 10, 11
6. `src/shared/utils/roles/roleUtils.js` — after 17 (`SubRoleMasterList`)
7. `src/shared/utils/roles/index.js` — after 21

### Wave 3 — Filtering (most cross-deps, needs Wave 2 done)

1. `src/shared/utils/filtering/physicalOptions.js` — leaf, but batch with filtering
2. `src/shared/utils/filtering/statFilters.js` — leaf, but batch with filtering
3. `src/shared/utils/filtering/filterHelpers.js` — after 20 (`formatting/index`)
4. `src/shared/utils/filtering/basicFilterUtils.js` — after 16 (`teamList`)
5. `src/shared/utils/filtering/playerFilterDefaults.js` — after 18 (`yearDefaults`)
6. `src/shared/utils/filtering/playerFilterUtils.js` — after 16, 22, 4, 17
7. `src/shared/utils/filtering/index.js` — after 23–28

### Wave 4 — Hooks that depend on Pile A utils

1. `src/shared/hooks/usePlayerDetail.js` — after 19 (`firestorePaths`)
2. `src/shared/hooks/useSeasonPlayerData.js` — **deprioritize**; deprecated hook; convert only after active hooks are done

### Wave 5 — Firebase helpers (highest stakes; convert last, one at a time)

1. `src/firebase/rosterHelpers.js` — simplest, no ownership guard
2. `src/firebase/rankerHelpers.js` — ownership guard, serialization helpers
3. `src/firebase/listHelpers.js` — largest, two domains, ownership + auto-claim logic

---

## Known follow-up items (pre-populated before conversion starts)

- **`BLRUBS` typo in `blurbs.js`:** `DEFAULT_BLRUBS` and `normalizeBlurbs` are the public exports. Cannot rename in-place without touching all callers. Note for the conversion commit: keep the typo, add a comment.
- **`newSchemeSelectors.js` filename typo:** Header comment says `newSchemaSelectors.js`, file is `newSchemeSelectors.js`. Investigate before converting — if callers import by the wrong path this will be a latent bug.
- **`rosterHelpers.js` has no ownership guard:** Unlike `listHelpers` and `rankerHelpers`, roster projects have no `userId` parameter anywhere. This is either intentional (public rosters) or a missing feature. Flag at conversion time.
- **`useSeasonPlayerData.js` is deprecated:** Marked `@deprecated`; has `console.warn` on every call. Conversion value is low; the migration path (replacing callers with `useSimplePlayerData`) is higher value. Consider deleting instead of converting.
- **`filterHelpers.js` duplicates stat abbreviation map from `statFilters.js`:** Both files define stat-key → display-label mappings. Consolidation opportunity after conversion.
- **`roleUtils.js` duplicates `POSITION_MAP`:** Both `POSITION_MAP` and `getPlayerPositionLabel` define the same position-to-abbreviation map. Consolidation opportunity.
