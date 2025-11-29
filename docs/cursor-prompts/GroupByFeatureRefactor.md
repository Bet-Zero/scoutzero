# Group by Feature Refactor Plan (Starting from Current State)

## Current State

This plan starts from the existing ScoutZero codebase:

- `src/features/` already exists, with feature components grouped by feature (for example: `src/features/architect/...`, `src/features/profile/...`, `src/features/table/...`, etc.).
- There are still global buckets:
  - `src/components/` – shared UI, layout, diagnostics, etc.
  - `src/hooks/` – mix of shared hooks and feature-specific hooks.
  - `src/utils/` – mix of shared utilities and feature-specific utilities.
- There is no `src/shared/` or `src/core/` yet.

Nothing has been moved or refactored yet.
This document describes the first full reorganization pass.

---

## Target Architecture

### 1. Features

Feature components stay where they already are:

    src/features/<featureName>/components/...

Add per-feature folders for hooks and utils next to existing components:

    src/features/<featureName>/
      components/
      hooks/
      utils/

Examples (names must match the actual existing feature directories):

- `src/features/architect/{components,hooks,utils}`
- `src/features/profile/{components,hooks,utils}`
- `src/features/table/{components,hooks,utils}`
- `src/features/ranker/{components,hooks,utils}`
- `src/features/roster/{components,hooks,utils}`

### 2. Shared

Introduce a shared area for cross-feature code:

    src/shared/
      components/
      hooks/
      utils/

- `src/shared/components/` – multi-feature UI (logos, modal shells, selectors, etc.).
- `src/shared/hooks/` – reusable hooks used by 2+ features.
- `src/shared/utils/` – generic helpers, formatting, contracts, etc.

### 3. Core

Introduce a core area for app-level wiring:

    src/core/
      layout/

Initially, this primarily holds layout shells such as `SiteLayout`.

---

## File Mapping (Proposed)

These mappings are based on a proposed Cursor plan.
Treat them as targets: verify against the actual code and adjust if needed.

### Components → Shared/Core

Feature components under `src/features/*` are not moved in this plan.

| Existing Path                                            | Proposed New Path                                        | Target | Notes                               |
| :------------------------------------------------------- | :------------------------------------------------------- | :----- | :---------------------------------- |
| `src/components/shared/DropdownGroup.jsx`                | `src/shared/components/DropdownGroup.jsx`                | Shared | Used across features                |
| `src/components/shared/EditContractModal.jsx`            | `src/shared/components/EditContractModal.jsx`            | Shared | Used by architect, roster           |
| `src/components/shared/PlayerHeadshot.jsx`               | `src/shared/components/PlayerHeadshot.jsx`               | Shared | Used across features                |
| `src/components/shared/SeasonYearSelector.jsx`           | `src/shared/components/SeasonYearSelector.jsx`           | Shared | Used across features                |
| `src/components/shared/TeamLogo.jsx`                     | `src/shared/components/TeamLogo.jsx`                     | Shared | Used across features                |
| `src/components/shared/TeamSelectDropdown.jsx`           | `src/shared/components/TeamSelectDropdown.jsx`           | Shared | Used across features                |
| `src/components/shared/TradeExceptionModal.jsx`          | `src/shared/components/TradeExceptionModal.jsx`          | Shared | Used by architect                   |
| `src/components/shared/ui/Dialog.jsx`                    | `src/shared/components/ui/Dialog.jsx`                    | Shared | Used across features                |
| `src/components/shared/ui/Modal.jsx`                     | `src/shared/components/ui/Modal.jsx`                     | Shared | Used across features                |
| `src/components/shared/ui/ToggleButton.jsx`              | `src/shared/components/ui/ToggleButton.jsx`              | Shared | Used across features                |
| `src/components/shared/ui/VideoExamples.jsx`             | `src/shared/components/ui/VideoExamples.jsx`             | Shared | Used by profile                     |
| `src/components/shared/ui/drawers/DrawerShell.jsx`       | `src/shared/components/ui/drawers/DrawerShell.jsx`       | Shared | Used across features                |
| `src/components/shared/ui/drawers/OpenDrawerButton.jsx`  | `src/shared/components/ui/drawers/OpenDrawerButton.jsx`  | Shared | Used across features                |
| `src/components/shared/ui/filters/BadgeFilterSelect.jsx` | `src/shared/components/ui/filters/BadgeFilterSelect.jsx` | Shared | Used by filters, roster             |
| `src/components/shared/ui/filters/MultiSelectFilter.jsx` | `src/shared/components/ui/filters/MultiSelectFilter.jsx` | Shared | Used by filters, roster             |
| `src/components/shared/ui/filters/RangeSelector.jsx`     | `src/shared/components/ui/filters/RangeSelector.jsx`     | Shared | Used by filters                     |
| `src/components/shared/ui/filters/RoleChecklist.jsx`     | `src/shared/components/ui/filters/RoleChecklist.jsx`     | Shared | Used by filters, roster             |
| `src/components/shared/ui/filters/index.js`              | `src/shared/components/ui/filters/index.js`              | Shared | Existing barrel – keep for now      |
| `src/components/shared/ui/grades/OverallGradeBlock.jsx`  | `src/shared/components/ui/grades/OverallGradeBlock.jsx`  | Shared | Used by profile, table              |
| `src/components/layout/SiteLayout.jsx`                   | `src/core/layout/SiteLayout.jsx`                         | Core   | App-level layout                    |
| `src/components/diagnostic/FirestoreDataDiagnostic.jsx`  | `src/components/diagnostic/FirestoreDataDiagnostic.jsx`  | Leave  | Dev-only diagnostic – keep in place |

---

### Hooks → Features/Shared

| Existing Path                               | Proposed New Path                                        | Target    | Notes                           |
| :------------------------------------------ | :------------------------------------------------------- | :-------- | :------------------------------ |
| `src/hooks/useArchitectPlayerData.js`       | `src/features/architect/hooks/useArchitectPlayerData.js` | Architect | Architect-only                  |
| `src/hooks/useRosterManager.js`             | `src/features/roster/hooks/useRosterManager.js`          | Roster    | Roster / roster builder feature |
| `src/hooks/tradeMachine/useTradeMachine.js` | `src/features/architect/hooks/useTradeMachine.js`        | Architect | Trade Machine inside Architect  |
| `src/hooks/useFilteredPlayers.js`           | `src/features/table/hooks/useFilteredPlayers.js`         | Table     | Primarily used by player table  |
| `src/hooks/usePlayerData.js`                | `src/shared/hooks/usePlayerData.ts`                      | Shared    | Used across multiple features   |
| `src/hooks/useSimplePlayerData.js`          | `src/shared/hooks/useSimplePlayerData.ts`                | Shared    | Used across multiple features   |
| `src/hooks/useFirebaseQuery.js`             | `src/shared/hooks/useFirebaseQuery.js`                   | Shared    | Generic Firebase hook           |
| `src/hooks/usePlayerDetail.js`              | `src/shared/hooks/usePlayerDetail.js`                    | Shared    | Used by profile + others        |
| `src/hooks/useAutoSavePlayer.js`            | `src/features/profile/hooks/useAutoSavePlayer.js`        | Profile   | Player profile-specific         |
| `src/hooks/useImageDownload.js`             | `src/shared/hooks/useImageDownload.js`                   | Shared    | Used by multiple features       |
| `src/hooks/useSeasonPlayerData.js`          | `src/shared/hooks/useSeasonPlayerData.js`                | Shared    | Deprecated but still shared     |

---

### Utils → Features/Shared

| Existing Path                               | Proposed New Path                                  | Target    | Notes                                 |
| :------------------------------------------ | :------------------------------------------------- | :-------- | :------------------------------------ |
| `src/utils/architect/` (all files)          | `src/features/architect/utils/`                    | Architect | Architect-only logic                  |
| `src/utils/roster/` (all files)             | `src/features/roster/utils/`                       | Roster    | Roster / roster builder feature       |
| `src/utils/profileHelpers.js`               | `src/features/profile/utils/profileHelpers.js`     | Profile   | Player profile helpers                |
| `src/utils/ranker/rankingEngine.js`         | `src/features/ranker/utils/rankingEngine.js`       | Ranker    | Ranker-specific logic                 |
| `src/utils/contracts/` (all files)          | `src/shared/utils/contracts/`                      | Shared    | Used by architect + others            |
| `src/utils/filtering/` (all files)          | `src/shared/utils/filtering/`                      | Shared    | Used by table, filters, roster        |
| `src/utils/formatting/` (all files)         | `src/shared/utils/formatting/`                     | Shared    | Used broadly                          |
| `src/utils/roles/` (all files)              | `src/shared/utils/roles/`                          | Shared    | Role definitions used across features |
| `src/utils/selectors/newSchemeSelectors.js` | `src/shared/utils/selectors/newSchemeSelectors.js` | Shared    | Currently unused but generic          |

---

## New Folders to Create

Before moving files, create these folders (if they don’t exist):

    src/shared/
      components/
        ui/
          drawers/
          filters/
          grades/
      hooks/
      utils/
        contracts/
        filtering/
        formatting/
        roles/
        selectors/

    src/core/
      layout/

    src/features/architect/hooks/
    src/features/architect/utils/
    src/features/profile/hooks/
    src/features/profile/utils/
    src/features/table/hooks/
    src/features/roster/hooks/
    src/features/roster/utils/
    src/features/ranker/utils/

Adjust feature folder names to match the actual `src/features/*` directories.

---

## Execution Strategy (Chunks)

Run the refactor in 4 chunks.
Each chunk should be executed as a separate `/group-by-feature` run.

After each chunk:

- Ensure all imports are updated.
- Delete old files only after confirming no remaining references.
- Run tests or start the app and spot-check affected areas.

### Chunk 1: Shared Components & Core Layout

Goal: Move shared/layout components to `src/shared` and `src/core`.

Steps:

1. Create `src/shared/components/**` and `src/core/layout/`.
2. Move `src/components/shared/**` to `src/shared/components/**`.
3. Move `src/components/layout/SiteLayout.jsx` to `src/core/layout/SiteLayout.jsx`.
4. Update imports:
   - `@/components/shared/...` → `@/shared/components/...`
   - `@/components/layout/SiteLayout` → `@/core/layout/SiteLayout`
5. Delete the old files after all imports are fixed.
6. Run tests or start the app.

---

### Chunk 2: Shared Hooks & Shared Utils

Goal: Centralize cross-feature hooks and utilities.

Steps:

1. Create `src/shared/hooks/` and `src/shared/utils/**` (subfolders).
2. Move shared hooks from `src/hooks` to `src/shared/hooks` (per mapping).
3. Move shared utils from `src/utils` to `src/shared/utils` (per mapping).
4. Update imports:
   - `@/hooks/...` → `@/shared/hooks/...` (for shared hooks).
   - `@/utils/...` → `@/shared/utils/...` (for shared utils).
5. Delete originals after import updates.
6. Run tests or start the app.

---

### Chunk 3: Feature-Specific Hooks

Goal: Attach feature-specific hooks to their feature folders.

Steps:

1. Move each feature-specific hook from `src/hooks/**` into the corresponding feature’s `hooks/` folder (per mapping).
2. Update imports, for example:
   - `@/hooks/useArchitectPlayerData` → `@/features/architect/hooks/useArchitectPlayerData`
   - and similarly for roster, table, profile, etc.
3. Delete originals from `src/hooks/` after updates.
4. Run tests or start the app.

---

### Chunk 4: Feature-Specific Utils

Goal: Attach feature-specific utilities to their feature folders.

Steps:

1. Move feature-specific utils from `src/utils/**` into the matching feature’s `utils/` folder (per mapping).
2. Update imports, for example:
   - `@/utils/architect/...` → `@/features/architect/utils/...`
   - `@/utils/roster/...` → `@/features/roster/utils/...`
   - `@/utils/profileHelpers` → `@/features/profile/utils/profileHelpers`
   - `@/utils/ranker/rankingEngine` → `@/features/ranker/utils/rankingEngine`
3. Delete originals from `src/utils/**` after imports are updated.
4. Run tests or start the app.

---

## Import Path Rules

When updating imports, follow these patterns:

- Shared components:
  - `@/components/shared/X` → `@/shared/components/X`
- Shared hooks:
  - `@/hooks/usePlayerData` → `@/shared/hooks/usePlayerData`
- Shared utils:
  - `@/utils/formatting/formatSalary` → `@/shared/utils/formatting/formatSalary`
- Feature hooks:
  - `@/hooks/useArchitectPlayerData` → `@/features/architect/hooks/useArchitectPlayerData`
- Feature utils:
  - `@/utils/architect/applyCapRules` → `@/features/architect/utils/applyCapRules`
- Core layout:
  - `@/components/layout/SiteLayout` → `@/core/layout/SiteLayout`

---

## Safety Rules

1. Behavior-preserving only:
   - Do not change logic, JSX, props, or function signatures unless required to fix a path or import.
2. No new barrels:
   - Do not introduce new `index.ts` or `index.js` barrel files as part of this refactor.
   - Existing barrels (like `filters/index.js`) can remain temporarily.
3. Search before delete:
   - Use global search to ensure there are no remaining imports from the old path before deleting a file.
4. Test after each chunk:
   - After each chunk, run tests or start the app.
   - Spot-check Architect, Player Profiles, Player Table, Roster / Roster Builder, Ranker.
5. If ambiguous, don’t move:
   - If it is not clearly shared or feature-specific, leave it in place and (optionally) add a `TODO: clarify ownership` comment instead of guessing.
