# JS → TS Conversion — Pile C UI Plan

**Purpose:** Convert the remaining runtime JS/JSX app surface to TypeScript without changing product behavior or visual layout.

**Relationship to prior plan:** `docs/TS_CONVERSION_NEXT_STEPS.md` is complete. Pile A and Pile B are done. This document is the successor plan for Pile C only.

**How this doc works:** When the user says "keep working on Pile C" or "keep working on `docs/TS_CONVERSION_PILE_C_PLAN.md`," find the first step below with status `TODO` or `IN PROGRESS`, do it, update the status/note, validate narrowly, and commit the source change plus this plan update together.

**Commit & status hygiene:**

1. Use the commit message specified in each step.
2. Before committing source changes, update this file with the step status or a dated progress note.
3. Include the plan update in the same commit as the conversion work.
4. If a step cannot finish, leave it `IN PROGRESS` and state the blocker plainly.

**Scope boundary:**

- Pile C includes runtime UI/page/component JS/JSX under `src/`.
- Pile C excludes `src/tests/**/*.js(x)` unless a test must be typed to cover the source conversion.
- Pile C excludes broad redesign, component rewrites, or styling changes. Conversion should preserve behavior and layout.
- If a converted UI component exposes an actual prop contract bug, fix the truthful call site instead of widening types to hide it.

**Validation rules:**

- Always run `npm run typecheck`.
- Run `npm run validate:project` after renames, new files, deleted files, or export/index changes.
- Run the narrowest relevant UI/feature tests with `--reporter=dot`.
- Run `npm run build` after meaningful page/route/component batches.
- Do not run the full suite unless the prompt contains `RUN FULL SUITE`.
- If a UI component has no meaningful coverage and the conversion is more than a trivial leaf rename, add a small smoke test first.

**Current runtime JS/JSX inventory (2026-04-18):**

- `140` runtime JS/JSX files remain under `src/`.
- Feature UI: filters `16`, lists `19`, profile `17`, ranker `10`, roster `22`, table `17`, tierMaker `5`.
- Other runtime: pages/app shell `17`, shared/diagnostic UI `11`, bootstrap/config/legacy support `6`.
- Tests remaining in JS/JSX: `104` under `src/tests/**`; those are a separate test migration track.

---

## Pile C Audit (2026-04-19)

### Recount and Coverage Summary

Recount: `140` runtime JS/JSX files remain under `src/`, excluding `src/tests/**`. The inventory still matches the 2026-04-18 headline count.

| Tree | Count | Nearby coverage | Recommended step |
| --- | ---: | --- | --- |
| `src/config`, `src/firebaseConfig.js`, `src/firebaseHelpers.js`, `src/fonts`, `src/hooks` | 6 | No direct component tests; validate with `typecheck`, `validate:project`, and `test:diff`. | Step 2 |
| `src/shared/components/**`, `src/components/diagnostic/**` | 11 | `tests/PlayerHeadshot.test.jsx`, `src/tests/videoExamples.undefined.test.ts`; most shell components have no direct smoke coverage. | Step 3 |
| `src/features/filters/**` | 16 | `src/tests/filters/useActiveFilterCount.test.tsx`, `src/tests/scouting/player_filters_wiring_contract.test.ts`; component coverage is mostly indirect. | Step 4 |
| `src/features/table/**` | 17 | `src/tests/table/useFilterDiagnostics.test.tsx`, `src/tests/table/useFilteredPlayers.test.tsx`, `src/tests/table/usePlayerTableDensity.test.tsx`; row/header components are mostly indirect. | Step 4 |
| `src/features/profile/**` | 17 | `src/tests/scouting/playerProfile.behavior.test.tsx`, `src/tests/scouting/useAutoSavePlayer.test.tsx`, `src/tests/scouting/usePlayerProfileState.test.tsx`. | Step 5 |
| `src/features/roster/**` | 22 | `tests/roster/rosterBuilder.ui.test.jsx`, `src/tests/roster/rosterBuilderHelpers.test.ts`, `src/tests/roster/rosterBuilderUtils.test.ts`, `src/tests/roster/rosterHelpers.smoke.test.ts`. | Step 6 |
| `src/features/lists/**` | 19 | `tests/listHelpers.smoke.test.ts`, tier/list bridge tests; list component coverage is mostly indirect. | Step 7 |
| `src/features/tierMaker/**` | 5 | `tests/tierMakerBoards.ui.test.jsx`, `tests/tierMakerRoutes.ui.test.jsx`, tier persistence/order tests. | Step 7 |
| `src/features/ranker/**` | 10 | `tests/RankingSetup.test.jsx`, `tests/AnchorComparison.test.jsx`, `src/tests/ranker/useRankerSession.test.tsx`, ranker node tests. | Step 8 |
| `src/pages/**`, `src/App.jsx`, `src/main.jsx`, `src/PasswordGate.jsx`, `src/core/layout/SiteLayout.jsx` | 17 | Route coverage is mixed; `tests/tierMakerRoutes.ui.test.jsx` and architect route smoke tests cover some shells. | Step 9, except feature-coupled pages may move with Steps 5-8 |

### Ordering Check

The planned order below still matches the codebase. Step 2 should run first because the support files are leaf-like and include app bootstrap contracts. Step 3 should still precede feature UI conversion because shared component prop types flow into table, profile, roster, list, and ranker surfaces. Step 4 should keep table and filters together because the active-filter display, drawer, table header, diagnostics panel, and table rows share typed filter/player contracts. Steps 5-8 can then proceed by feature tree, with coupled route pages converted inside their feature step when that avoids temporary prop widening. Step 9 should remain last for `App`, `main`, auth gate, layout, and any pages not converted with their feature tree.

No order changes are recommended.

### File Inventory by Conversion Step

#### Step 2 — Bootstrap and Support JS

| File | Role | Recommended step |
| --- | --- | --- |
| `src/config/ownerConfig.js` | Owner/admin configuration gate. | Step 2 |
| `src/config/validationFlags.js` | Runtime validation feature flags. | Step 2 |
| `src/firebaseConfig.js` | Firebase app/service initialization. | Step 2 |
| `src/firebaseHelpers.js` | Shared Firebase helper exports. | Step 2 |
| `src/fonts/antonBase64.js` | Embedded Anton font data for exports/capture. | Step 2 |
| `src/hooks/useImageDownload.js` | Legacy image download hook wrapper/duplicate check. | Step 2 |

#### Step 3 — Shared UI Leaves and Diagnostics

| File | Role | Recommended step |
| --- | --- | --- |
| `src/shared/components/PlayerHeadshot.jsx` | Player image display with fallback behavior. | Step 3 |
| `src/shared/components/ErrorBoundary.jsx` | React error boundary shell. | Step 3 |
| `src/shared/components/SeasonYearSelector.jsx` | Shared season/year selector control. | Step 3 |
| `src/shared/components/DropdownGroup.jsx` | Shared grouped dropdown control. | Step 3 |
| `src/shared/components/ui/drawers/OpenDrawerButton.jsx` | Shared drawer trigger button. | Step 3 |
| `src/shared/components/ui/drawers/DrawerShell.jsx` | Shared drawer layout shell. | Step 3 |
| `src/shared/components/ui/Modal.jsx` | Shared modal shell. | Step 3 |
| `src/shared/components/ui/VideoExamples.jsx` | Shared video examples renderer. | Step 3 |
| `src/shared/components/ui/ToggleButton.jsx` | Shared toggle button. | Step 3 |
| `src/shared/components/ui/grades/OverallGradeBlock.jsx` | Shared overall-grade display block. | Step 3 |
| `src/components/diagnostic/FirestoreDataDiagnostic.jsx` | Firestore diagnostics UI. | Step 3 |

#### Step 4 — Filters UI

| File | Role | Recommended step |
| --- | --- | --- |
| `src/features/filters/ActiveFiltersDisplay/index.jsx` | Active filter summary container. | Step 4 |
| `src/features/filters/ActiveFiltersDisplay/FilterPill/FilterPill.jsx` | Individual active filter pill. | Step 4 |
| `src/features/filters/ActiveFiltersDisplay/FilterPill/FilterContent.jsx` | Filter pill label/value content. | Step 4 |
| `src/features/filters/ActiveFiltersDrawer.jsx` | Mobile/secondary active-filters drawer. | Step 4 |
| `src/features/filters/FiltersPanel/FilterPanelCondensed.jsx` | Condensed filters panel variant. | Step 4 |
| `src/features/filters/FiltersPanel/index.jsx` | Filters panel container. | Step 4 |
| `src/features/filters/FiltersPanel/FilterPanel/index.jsx` | Full filter panel shell. | Step 4 |
| `src/features/filters/FiltersPanel/FilterPanel/sections/StatFilters.jsx` | Statistical filter section. | Step 4 |
| `src/features/filters/FiltersPanel/FilterPanel/sections/OverallGradeFilter.jsx` | Overall grade filter section. | Step 4 |
| `src/features/filters/FiltersPanel/FilterPanel/sections/RoleFilters.jsx` | Role filter section. | Step 4 |
| `src/features/filters/FiltersPanel/FilterPanel/sections/PhysicalFilters.jsx` | Physical profile filter section. | Step 4 |
| `src/features/filters/FiltersPanel/FilterPanel/sections/MetadataFilters.jsx` | Metadata filter section. | Step 4 |
| `src/features/filters/FiltersPanel/FilterPanel/sections/TraitFilters.jsx` | Trait filter section. | Step 4 |
| `src/features/filters/FiltersPanel/FilterPanel/sections/BadgeFilters.jsx` | Badge filter section. | Step 4 |
| `src/features/filters/FiltersPanel/FilterPanel/sections/ContractFilters.jsx` | Contract filter section. | Step 4 |
| `src/features/filters/FiltersPanel/FilterPanel/sections/ViewControls.jsx` | Filter/table view controls. | Step 4 |

#### Step 4 — Table UI

| File | Role | Recommended step |
| --- | --- | --- |
| `src/features/table/PlayerTable/index.jsx` | Player table container. | Step 4 |
| `src/features/table/PlayerTable/FilterDiagnosticsPanel.jsx` | Table filter diagnostics display. | Step 4 |
| `src/features/table/PlayerTable/PlayerRow/index.jsx` | Main player row. | Step 4 |
| `src/features/table/PlayerTable/PlayerRow/RolePill.jsx` | Role pill in table rows. | Step 4 |
| `src/features/table/PlayerTable/PlayerRow/ShootingProfileMini.jsx` | Shooting profile row mini. | Step 4 |
| `src/features/table/PlayerTable/PlayerRow/PlayerNameMini.jsx` | Player name row mini. | Step 4 |
| `src/features/table/PlayerTable/PlayerRow/PlayerDrawer/index.jsx` | Player drawer container. | Step 4 |
| `src/features/table/PlayerTable/PlayerRow/PlayerDrawer/OverallBlurbMini.jsx` | Drawer blurb mini. | Step 4 |
| `src/features/table/PlayerTable/PlayerRow/PlayerDrawer/BadgeMini.jsx` | Drawer badge mini. | Step 4 |
| `src/features/table/PlayerTable/PlayerRow/PlayerDrawer/PlayerSubRolesMini.jsx` | Drawer sub-role mini. | Step 4 |
| `src/features/table/PlayerTable/PlayerRow/PlayerDrawer/PlayerContractMini.jsx` | Drawer contract mini. | Step 4 |
| `src/features/table/PlayerTable/PlayerRow/PlayerDrawer/PlayerTraitsMiniGrid.jsx` | Drawer traits mini grid. | Step 4 |
| `src/features/table/PlayerTable/PlayerRow/PlayerDrawer/PlayerStatsMini.jsx` | Drawer stats mini. | Step 4 |
| `src/features/table/PlayerTable/PlayerTableHeader/SearchBar.jsx` | Table search control. | Step 4 |
| `src/features/table/PlayerTable/PlayerTableHeader/index.jsx` | Table header container. | Step 4 |
| `src/features/table/PlayerTable/PlayerTableHeader/DensityToggle.jsx` | Table density control. | Step 4 |
| `src/features/table/PlayerTable/PlayerTableHeader/TopControlsBar.jsx` | Table top controls row. | Step 4 |

#### Step 5 — Profile UI

| File | Role | Recommended step |
| --- | --- | --- |
| `src/features/profile/PlayerNavigation.jsx` | Profile previous/next navigation. | Step 5 |
| `src/features/profile/PlayerSearchBar.jsx` | Profile player search. | Step 5 |
| `src/features/profile/PlayerDetails/BadgeSelector.jsx` | Profile badge selector. | Step 5 |
| `src/features/profile/PlayerDetails/index.jsx` | Player details container. | Step 5 |
| `src/features/profile/PlayerDetails/OverallBlurbBox.jsx` | Profile overall blurb editor/display. | Step 5 |
| `src/features/profile/PlayerDetails/PlayerTraitsGrid.jsx` | Profile traits grid. | Step 5 |
| `src/features/profile/PlayerDetails/PlayerHeader/index.jsx` | Profile header container. | Step 5 |
| `src/features/profile/PlayerDetails/PlayerHeader/ProfilePlayerPosition.jsx` | Profile position header field. | Step 5 |
| `src/features/profile/PlayerDetails/PlayerHeader/ProfilePlayerName.jsx` | Profile name header field. | Step 5 |
| `src/features/profile/PlayerDetails/PlayerStatsTable.jsx` | Profile stats table. | Step 5 |
| `src/features/profile/PlayerDetails/PlayerRolesSection/index.jsx` | Profile roles section container. | Step 5 |
| `src/features/profile/PlayerDetails/PlayerRolesSection/ShootingProfileSelector.jsx` | Shooting profile selector. | Step 5 |
| `src/features/profile/PlayerDetails/PlayerRolesSection/SubRoleSelector.jsx` | Sub-role selector. | Step 5 |
| `src/features/profile/PlayerDetails/PlayerRolesSection/TwoWayMeter.jsx` | Two-way meter control. | Step 5 |
| `src/features/profile/SaveStatusIndicator.jsx` | Profile save status display. | Step 5 |
| `src/features/profile/TeamPlayerDropdowns.jsx` | Team/player dropdown controls. | Step 5 |
| `src/features/profile/BreakdownModal.jsx` | Profile breakdown modal. | Step 5 |
| `src/pages/PlayerProfileView.jsx` | Profile route page; convert with Step 5 if prop typing requires it. | Step 5 or Step 9 |

#### Step 6 — Roster UI

| File | Role | Recommended step |
| --- | --- | --- |
| `src/features/roster/RosterControls.jsx` | Roster toolbar controls. | Step 6 |
| `src/features/roster/RosterExportModal.jsx` | Roster export modal. | Step 6 |
| `src/features/roster/RosterSection/BenchCard.jsx` | Bench player card. | Step 6 |
| `src/features/roster/RosterSection/index.jsx` | Roster section container. | Step 6 |
| `src/features/roster/RosterSection/StarterCard.jsx` | Starter player card. | Step 6 |
| `src/features/roster/RosterSection/RotationCard.jsx` | Rotation player card. | Step 6 |
| `src/features/roster/RosterSection/EmptySlot.jsx` | Empty roster slot placeholder. | Step 6 |
| `src/features/roster/AddPlayerDrawer/addPlayer/PlayerSearchBar.jsx` | Add-player drawer search. | Step 6 |
| `src/features/roster/AddPlayerDrawer/addPlayer/BasicFilters.jsx` | Add-player basic filters. | Step 6 |
| `src/features/roster/AddPlayerDrawer/addPlayer/RolesFilters.jsx` | Add-player role filters. | Step 6 |
| `src/features/roster/AddPlayerDrawer/addPlayer/StatsFilters.jsx` | Add-player stat filters. | Step 6 |
| `src/features/roster/AddPlayerDrawer/addPlayer/PhysicalFilters.jsx` | Add-player physical filters. | Step 6 |
| `src/features/roster/AddPlayerDrawer/addPlayer/DrawerHeader.jsx` | Add-player drawer header. | Step 6 |
| `src/features/roster/AddPlayerDrawer/addPlayer/ContractFilters.jsx` | Add-player contract filters. | Step 6 |
| `src/features/roster/AddPlayerDrawer/addPlayer/FilterTabs.jsx` | Add-player filter tabs. | Step 6 |
| `src/features/roster/AddPlayerDrawer/index.jsx` | Add-player drawer container. | Step 6 |
| `src/features/roster/AddPlayerDrawer/PlayerRowMini.jsx` | Add-player result row. | Step 6 |
| `src/features/roster/RosterExportCapture.jsx` | Roster export capture surface. | Step 6 |
| `src/features/roster/RosterPreviewModal.jsx` | Roster preview modal. | Step 6 |
| `src/features/roster/RosterViewer.jsx` | Roster viewer container. | Step 6 |
| `src/features/roster/SaveRosterModal.jsx` | Save roster modal. | Step 6 |
| `src/features/roster/CreateRosterModal.jsx` | Create roster modal. | Step 6 |
| `src/pages/TeamRosterView.jsx` | Team roster route page; convert with Step 6 if prop typing requires it. | Step 6 or Step 9 |
| `src/pages/RostersHome.jsx` | Rosters home route page; convert with Step 6 if prop typing requires it. | Step 6 or Step 9 |

#### Step 7 — Lists UI

| File | Role | Recommended step |
| --- | --- | --- |
| `src/features/lists/AddToListButton/index.jsx` | Add-to-list button wrapper. | Step 7 |
| `src/features/lists/AddToListButton/AddToListModal.jsx` | Add-to-list modal. | Step 7 |
| `src/features/lists/ListRowStyleToggle.jsx` | List row style toggle. | Step 7 |
| `src/features/lists/RankedListTierToggle.jsx` | Ranked/tier list toggle. | Step 7 |
| `src/features/lists/ListRankToggle.jsx` | List ranking toggle. | Step 7 |
| `src/features/lists/TierPlayerTile.jsx` | Tier player tile. | Step 7 |
| `src/features/lists/ExportOptionsModal.jsx` | List export options modal. | Step 7 |
| `src/features/lists/ListPreviewModal/index.jsx` | List preview modal container. | Step 7 |
| `src/features/lists/ListPreviewModal/ListExportWrapper/index.jsx` | List export wrapper. | Step 7 |
| `src/features/lists/ListPreviewModal/ListExportWrapper/ListExportRowCompact.jsx` | Compact export row. | Step 7 |
| `src/features/lists/ListPreviewModal/ListExportWrapper/ListExportPlayerRow.jsx` | Export player row. | Step 7 |
| `src/features/lists/ListPreviewModal/ListExportWrapper/ListTierExport/index.jsx` | Tier export renderer. | Step 7 |
| `src/features/lists/ListSearchBar.jsx` | List search control. | Step 7 |
| `src/features/lists/ListControls.jsx` | List controls bar. | Step 7 |
| `src/features/lists/ListTierHeader/index.jsx` | Tier header container. | Step 7 |
| `src/features/lists/ListTierHeader/ListPlayerRow.jsx` | List player row. | Step 7 |
| `src/features/lists/CreateListModal.jsx` | Create list modal. | Step 7 |
| `src/features/lists/TieredListView/index.jsx` | Tiered list view container. | Step 7 |
| `src/features/lists/ListColumnToggle.jsx` | List column visibility toggle. | Step 7 |
| `src/pages/ListManager.jsx` | List manager route page. | Step 7 or Step 9 |
| `src/pages/ListsHome.jsx` | Lists home route page. | Step 7 or Step 9 |

#### Step 7 — Tier Maker UI

| File | Role | Recommended step |
| --- | --- | --- |
| `src/features/tierMaker/TierRow.jsx` | Tier row renderer. | Step 7 |
| `src/features/tierMaker/TieramidPlayerTile.jsx` | Tieramid player tile. | Step 7 |
| `src/features/tierMaker/CreateTierListModal.jsx` | Create tier list modal. | Step 7 |
| `src/features/tierMaker/TieramidBoard.jsx` | Tieramid board. | Step 7 |
| `src/features/tierMaker/TierMakerBoard.jsx` | Tier maker board. | Step 7 |
| `src/pages/TierListsHome.jsx` | Tier lists home route page. | Step 7 or Step 9 |
| `src/pages/TierMakerView.jsx` | Tier maker route page. | Step 7 or Step 9 |

#### Step 8 — Ranker UI

| File | Role | Recommended step |
| --- | --- | --- |
| `src/features/ranker/AdjustableRankings.jsx` | Adjustable ranking list. | Step 8 |
| `src/features/ranker/tournamentRanker.js` | Ranker tournament logic. | Step 8 |
| `src/features/ranker/AnchorComparison.jsx` | Anchor comparison UI. | Step 8 |
| `src/features/ranker/ComparisonMatrixDrawer.jsx` | Comparison matrix drawer. | Step 8 |
| `src/features/ranker/ComparisonMatrix.jsx` | Comparison matrix display. | Step 8 |
| `src/features/ranker/RankingResults.jsx` | Ranker results display. | Step 8 |
| `src/features/ranker/RankingSetup.jsx` | Ranker setup UI. | Step 8 |
| `src/features/ranker/RankingSession.jsx` | Ranking session container. | Step 8 |
| `src/features/ranker/RankingBuilder.jsx` | Ranker builder container. | Step 8 |
| `src/features/ranker/PlayerCompareCard.jsx` | Player comparison card. | Step 8 |
| `src/pages/PlayerRankerPage.jsx` | Ranker route page. | Step 8 or Step 9 |

#### Step 9 — App Shell and Remaining Pages

| File | Role | Recommended step |
| --- | --- | --- |
| `src/App.jsx` | Top-level route/app shell. | Step 9 |
| `src/main.jsx` | Vite/React bootstrap entry. | Step 9 |
| `src/PasswordGate.jsx` | Password gate wrapper. | Step 9 |
| `src/core/layout/SiteLayout.jsx` | Site layout wrapper. | Step 9 |
| `src/pages/PlayerTableView.jsx` | Player table route page. | Step 9 after Step 4 |
| `src/pages/GmDashboardView.jsx` | Architect dashboard route page. | Step 9 |
| `src/pages/GmLeagueView.jsx` | Architect league route page. | Step 9 |
| `src/pages/DataDiagnosticPage.jsx` | Data diagnostics route page. | Step 9 after Step 3 |
| `src/pages/NotFound.jsx` | Not-found route page. | Step 9 |

---

## Step 1 — Pile C Audit and Ordering Check

**Status:** DONE  
Completed 2026-04-19: Recounted `140` runtime JS/JSX files outside `src/tests/**`, added grouped file inventory, nearby coverage notes, and confirmed no order changes are needed.

**Goal:** Produce a concise audit section in this file that confirms each remaining runtime JS/JSX file, its role, and its recommended conversion step.

**Instructions:**

- Recount `src/**/*.js(x)` excluding `src/tests/**`.
- Group files by feature/tree.
- Note existing nearby tests or missing coverage for each group.
- Confirm whether the step order below still matches the current codebase.
- Do not convert source files in this step.

**Done when:** This doc has a `Pile C Audit` section with grouped counts, key test coverage, and any order changes. Commit message: `docs: audit Pile C UI TypeScript conversion`.

---

## Step 2 — Convert Bootstrap and Support JS

**Status:** DONE  
Completed 2026-04-19: Converted all six support files to TypeScript, removed obsolete ambient shims for `@/firebaseConfig` and `validationFlags`, updated stale `.js` import specifiers for renamed support modules, and kept the legacy ranker `src/hooks/useImageDownload.ts` separate because its export behavior differs from `src/shared/hooks/useImageDownload.ts`.

**Goal:** Convert small non-UI runtime support files that are not feature components.

**Files:**

- `src/config/ownerConfig.js`
- `src/config/validationFlags.js`
- `src/firebaseConfig.js`
- `src/firebaseHelpers.js`
- `src/fonts/antonBase64.js`
- `src/hooks/useImageDownload.js`

**Instructions:**

- Convert leaf files one at a time unless they are tightly coupled.
- Preserve environment variable behavior exactly.
- For Firebase config/helpers, keep the public exported API stable.
- If `src/hooks/useImageDownload.js` duplicates `src/shared/hooks/useImageDownload.ts`, do not delete it unless all imports are safely redirected and validated.

**Validation:** `npm run typecheck`, `npm run validate:project`, and `npm run test:diff -- --reporter=dot`.

**Done when:** These six files are `.ts` or intentionally documented as deferred. Commit message: `refactor: convert bootstrap support files to TypeScript`.

---

## Step 3 — Convert Shared UI Leaves

**Status:** DONE  
Completed 2026-04-19: Converted all shared UI leaf and diagnostic files to TSX, exported prop types for shared consumers, fixed the stale `SeasonYearSelector` season utility import, added focused shared UI smoke coverage, and updated explicit test imports for renamed modules.

**Goal:** Convert shared leaf components before feature components depend on their prop types.

**Files:**

- `src/shared/components/PlayerHeadshot.jsx`
- `src/shared/components/ErrorBoundary.jsx`
- `src/shared/components/SeasonYearSelector.jsx`
- `src/shared/components/DropdownGroup.jsx`
- `src/shared/components/ui/drawers/OpenDrawerButton.jsx`
- `src/shared/components/ui/drawers/DrawerShell.jsx`
- `src/shared/components/ui/Modal.jsx`
- `src/shared/components/ui/VideoExamples.jsx`
- `src/shared/components/ui/ToggleButton.jsx`
- `src/shared/components/ui/grades/OverallGradeBlock.jsx`
- `src/components/diagnostic/FirestoreDataDiagnostic.jsx`

**Instructions:**

- Convert true leaves first: buttons, toggles, modal shells, grade block.
- Export named prop types where multiple feature components consume the component.
- Keep class names, markup, and behavior unchanged.
- Add minimal smoke tests only where the component has meaningful conditional behavior and no coverage.

**Validation:** `npm run typecheck`, `npm run validate:project`, `npm run test:ui -- --reporter=dot` with relevant UI tests, and `npm run build`.

**Done when:** Shared UI leaves are `.tsx` or explicitly deferred with a blocker note. Commit message: `refactor: convert shared UI leaves to TypeScript`.

---

## Step 4 — Convert Table and Filters UI

**Status:** DONE  
Completed 2026-04-19: Converted all table and filters runtime UI files to TSX, added focused table/filter UI smoke coverage, exported/reused the typed filterable player contract for table rows and drawers, aligned `optionYear` with its numeric UI behavior, and refreshed filter catalog source references after the rename.

**Goal:** Convert the player table and filters UI tree after its hooks and utilities are already typed.

**Files:**

- `src/features/table/**.jsx`
- `src/features/filters/**.jsx`

**Instructions:**

- Convert filter controls and active-filter display leaves before table containers.
- Convert `PlayerRow` drawer minis before the main `PlayerRow`.
- Convert `PlayerTableHeader` controls before `PlayerTable/index.jsx`.
- Reuse existing `PlayerFilters`, filter catalog, and typed table hook contracts instead of redefining filter/player shapes.
- Do not change table density, drawer behavior, or visual layout.

**Validation:** `npm run typecheck`, `npm run validate:project`, `npm run test:ui -- --reporter=dot src/tests/table src/tests/filters`, and `npm run build`.

**Done when:** Table and filters runtime UI files are `.tsx`. Commit message: `refactor: convert table and filters UI to TypeScript`.

---

## Step 5 — Convert Profile UI

**Status:** DONE  
Completed 2026-04-19: Converted the profile UI tree and `PlayerProfileView` route to TSX, kept the route conversion in Step 5 because it owns the typed modal/profile state wiring, and widened the shared enriched stats contract to match canonical `PlayerV2` stat maps without changing runtime normalization.

**Goal:** Convert Player Profile UI components using the typed profile hooks and helper contracts from Pile B.

**Files:**

- `src/features/profile/**.jsx`
- `src/pages/PlayerProfileView.jsx` may convert in this step if component prop typing makes it easier.

**Instructions:**

- Convert leaf player detail components first: header fields, stats table, role selectors, trait grid, save indicator.
- Convert `BreakdownModal`, `TeamPlayerDropdowns`, `PlayerSearchBar`, and navigation after the leaf prop types exist.
- Reuse `UsePlayerNavigationResult`, `UsePlayerProfileStateResult`, `ModalSavePayload`, `ProfileRoles`, `PlayerSubRoles`, `Blurbs`, and `NormalizedVideoExamples` rather than creating duplicate interfaces.
- Preserve autosave/modal semantics exactly.

**Validation:** `npm run typecheck`, `npm run validate:project`, `npm run test:scouting -- --reporter=dot`, and `npm run build`.

**Done when:** Profile runtime UI files are `.tsx`. Commit message: `refactor: convert profile UI to TypeScript`.

---

## Step 6 — Convert Roster UI

**Status:** DONE  
Completed 2026-04-19: Converted the roster UI tree and the roster route pages to TSX, typed the roster section/export/viewer contracts around the existing roster manager utilities, removed the obsolete `RosterSection` ambient shim, and aligned the Architect roster visual bridge with the typed roster shape so its read-only preview path still feeds the shared roster section component truthfully.

**Goal:** Convert Roster Builder UI components after `useRosterManager.ts` and roster utils are typed.

**Files:**

- `src/features/roster/**.jsx`
- `src/pages/TeamRosterView.jsx` and `src/pages/RostersHome.jsx` may convert here if required by prop contracts.

**Instructions:**

- Convert `RosterSection` cards and empty slot leaves first.
- Convert add-player drawer leaves and filter controls next.
- Convert modal/export/capture components before `RosterViewer.jsx`.
- Reuse `UseRosterManagerResult`, `RosterManagerPlayer`, roster shape/player types, and typed filter utility shapes.
- Preserve missing-player placeholder behavior and saved-roster overwrite payloads.

**Validation:** `npm run typecheck`, `npm run validate:project`, `npm run test:roster -- --reporter=dot`, `npm run test:ui -- --reporter=dot tests/roster/rosterBuilder.ui.test.jsx`, and `npm run build`.

**Done when:** Roster runtime UI files are `.tsx`. Commit message: `refactor: convert roster UI to TypeScript`.

---

## Step 7 — Convert Lists and Tier Maker UI

**Status:** DONE  
Completed 2026-04-19: Converted the lists, list export/preview, tier-maker, tieramid, and related route page UI files to TSX, typed the list/tier board data contracts around `listHelpers`, `useTierDraft`, and the roster drawer player shape, and fixed stale list/tier imports and header comments after the rename.

**Goal:** Convert list-management, list-preview/export, and tier-maker UI trees together because their data contracts overlap.

**Files:**

- `src/features/lists/**.jsx`
- `src/features/tierMaker/**.jsx`
- `src/pages/ListManager.jsx`
- `src/pages/ListsHome.jsx`
- `src/pages/TierListsHome.jsx`
- `src/pages/TierMakerView.jsx`

**Instructions:**

- Convert list/tier leaf tiles and row components first.
- Convert modals and export wrappers before boards/pages.
- Reuse typed list helper inputs, tier save-as-list bridge types, and existing player/list shapes.
- Do not change list ordering, tier mode persistence, export layout, or save-as-list behavior.

**Validation:** `npm run typecheck`, `npm run validate:project`, relevant list/tier node tests with `--reporter=dot`, relevant UI tests with `--reporter=dot`, and `npm run build`.

**Done when:** Lists and tier-maker runtime UI files are `.tsx`. Commit message: `refactor: convert lists and tier maker UI to TypeScript`.

---

## Step 8 — Convert Ranker UI

**Status:** DONE  
Completed 2026-04-19: Converted the ranker UI tree, legacy tournament ranker helper, and `PlayerRankerPage` route to TypeScript, reused the typed ranker engine/session contracts, aligned the ranker add-player drawer data with the roster drawer shape, and updated the existing ranker UI tests to import the renamed components extensionlessly.

**Goal:** Convert the ranker UI tree after `useRankerSession.ts`, ranker utilities, and Firestore helpers are typed.

**Files:**

- `src/features/ranker/**.jsx`
- `src/features/ranker/tournamentRanker.js`
- `src/pages/PlayerRankerPage.jsx`

**Instructions:**

- Convert `tournamentRanker.js` before UI if it exports logic used by components.
- Convert leaf cards, setup, matrix, results, and adjustable ranking components before `RankingSession.jsx` and `RankingBuilder.jsx`.
- Reuse `RankerPlayer`, `RankerComparison`, `ClosureCache`, and `UseRankerSessionResult`.
- Preserve local-first persistence and owner-only Firestore save behavior.

**Validation:** `npm run typecheck`, `npm run validate:project`, ranker node tests with `--reporter=dot`, ranker UI tests with `--reporter=dot`, and `npm run build`.

**Done when:** Ranker runtime UI files are `.tsx` / `.ts`. Commit message: `refactor: convert ranker UI to TypeScript`.

---

## Step 9 — Convert Page Shells and App Entry

**Status:** DONE  
Completed 2026-04-19: Converted the remaining app shell, password gate, layout, diagnostic/table/GM route pages, and React entrypoint to TSX, updated route wrapper guardrails for the renamed GM pages, and confirmed no runtime `src/**/*.js(x)` files remain outside `src/tests/**`.

**Goal:** Convert top-level route views and app shell after their child feature trees have typed props.

**Files:**

- `src/App.jsx`
- `src/main.jsx`
- `src/PasswordGate.jsx`
- `src/core/layout/SiteLayout.jsx`
- Remaining `src/pages/*.jsx`

**Instructions:**

- Convert route views after their feature components are typed.
- Keep default exports for top-level page views.
- Preserve routing, auth gate behavior, and layout structure.
- Convert `src/main.jsx` last.

**Validation:** `npm run typecheck`, `npm run validate:project`, `npm run test:ui -- --reporter=dot` for routed UI coverage, and `npm run build`.

**Done when:** No runtime `src/**/*.js(x)` files remain outside explicitly deferred files. Commit message: `refactor: convert app shell and route pages to TypeScript`.

---

## Step 10 — Pile C Closeout

**Status:** DONE  
Completed 2026-04-19: Recounted runtime and test JS/JSX after Step 9, confirmed there are no deferred runtime files, and documented that the remaining JS/JSX belongs to the separate test/support migration track.

**Goal:** Confirm runtime JS/JSX is gone or explicitly documented, and decide whether to start a separate test migration track.

**Instructions:**

- Recount runtime `src/**/*.js(x)` excluding `src/tests/**`.
- List any intentionally deferred runtime JS/JSX files and why.
- Recount remaining test JS/JSX files.
- Document open follow-up items found during Pile C.
- State whether a separate test migration plan is needed.

**Validation:** `npm run typecheck`, `npm run validate:project`, `npm run build`, and the narrowest relevant aggregate UI/test commands run during the final step. Do not run full suite without `RUN FULL SUITE`.

**Done when:** This doc has a `Pile C Closeout` section and all Pile C steps are `DONE` or explicitly deferred. Commit message: `docs: close out Pile C TypeScript conversion`.

---

## Pile C Closeout (2026-04-19)

### Runtime Result

- Runtime `src/**/*.js(x)` excluding `src/tests/**`: `0`.
- Intentionally deferred runtime JS/JSX files: none.
- Pile C source conversion is complete; no runtime app/page/component JS/JSX remains under `src/`.

### Remaining Test JS/JSX

- `src/tests/**/*.js(x)`: `104`.
- `tests/**/*.js(x)`: `127`.
- Total test/support JS/JSX files remaining: `231`.

### Follow-Up Decision

A separate test migration plan is needed if the project wants to eliminate JS/JSX from tests and test support files. That track should be planned separately from Pile C because the runtime migration is complete and the remaining files are test-only.

No Pile C runtime follow-up items were deferred.

---

## Follow-Up Items

Use this section for issues discovered during Pile C that should not be fixed inside a conversion step.
