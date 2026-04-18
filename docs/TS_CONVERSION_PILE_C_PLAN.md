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

## Step 1 — Pile C Audit and Ordering Check

**Status:** TODO

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

**Status:** TODO

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

**Status:** TODO

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

**Status:** TODO

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

**Status:** TODO

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

**Status:** TODO

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

**Status:** TODO

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

**Status:** TODO

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

**Status:** TODO

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

**Status:** TODO

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

## Follow-Up Items

Use this section for issues discovered during Pile C that should not be fixed inside a conversion step.
