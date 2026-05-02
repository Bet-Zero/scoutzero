# Developer Guide

HoopZero is a React + Firebase application that provides a public-facing view of the internal ScoutZero scouting tool. This guide explains the project structure and how the pieces fit together for future contributors and AI tools.

## TypeScript Status

TypeScript migration, hardening, and zero-exception hardening are complete in this repository. Treat TypeScript as a maintenance gate, not as an active campaign. For current routing, regression rules, and historical campaign records, start with [../typescript/README.md](../typescript/README.md).

## Folder Structure

```text
src/
├── components/          # Layout wrappers and shared UI pieces
│   ├── layout/          # Site wide layout components
│   └── shared/          # Reusable UI widgets
├── constants/           # Data lists and enums
├── features/            # Domain modules grouped by feature
│   ├── architect/       # Architect GM + Trade Machine tools
│   ├── filters/         # Filtering UI and logic
│   ├── lists/           # Ranked list components
│   ├── profile/         # Player profile editor
│   ├── roster/          # Roster building tools
│   ├── table/           # Player table view
│   └── tierMaker/       # Tier list creation tools
├── hooks/               # Custom React hooks
├── pages/               # Top level route views
├── utils/               # Helper functions and data transforms
├── firebase/            # Firestore helper modules
├── schemas/             # Canonical Zod schemas for Firestore collections
└── styles/              # Additional style sheets
```

> ### src/components/
>
> - **layout/** – currently only `SiteLayout.jsx` for shared page chrome.
> - **shared/** – generic pieces like `PlayerHeadshot`, `TeamLogo`, modals, drawers and filter widgets.
>
> ### src/features/
>
> Features encapsulate major areas of the UI. Each contains React components specific to that feature.
>
> - **architect/** – internal GM dashboard, trade machine, and world-aware tooling.
> - **filters/** – filter panel, active filter pills and filter sections.
> - **lists/** – functionality for creating ranked lists of players.
> - **profile/** – player profile view with editable traits, roles and blurbs.
> - **roster/** – team roster builder with add-player drawer and card display.
> - **table/** – main player table and mini row components.
> - **tierMaker/** – drag-and-drop tier board for custom lists.
>
> Architect-specific SSOT utilities live under `src/features/architect/utils/`. The offseason transition pipeline is centralized in `src/features/architect/utils/offseason/`.
>
> ### src/hooks/
>
> Custom React hooks used throughout the app:
>
> - `useFirebaseQuery` – fetches a Firestore collection and tracks loading state.
> - `usePlayerData` – loads player documents then normalizes them.
> - `useFilteredPlayers` – applies filter logic and sorting to player arrays.
>
> ### src/pages/
>
> Route level components rendered by React Router. Examples include `PlayerTableView`, `PlayerProfileView`, `TeamRosterView`, etc.
>
> ### src/utils/
>
> Utility modules grouped by domain:
>
> - **filtering/** – functions for filter defaults, options and helpers.
> - **formatting/** – formatting helpers like `formatHeight` and `formatSalary`.
> - **roles/** – position/role mapping utilities and option lists.
> - **roster/** – contract helpers and roster building utilities.
> - `profileHelpers.js` – modal and blurb helpers.
>
> ## Key Components
>
> - **PlayerTable** (`features/table/PlayerTable.jsx`) – central table with search, filters and sort options.
> - **FilterPanel** and **ActiveFiltersDisplay** – manage filter selection and show active pills.
> - **PlayerProfileView** (`pages/PlayerProfileView.jsx`) – edit-mode page for individual players with trait and role breakdown modals.
> - **RosterViewer** (`features/roster/RosterViewer.jsx`) – interactive roster builder. Uses **AddPlayerDrawer** for search/filtering and **RosterViewerActions** for save, preview, and export flows.
> - **AddPlayerDrawer** and **PlayerRowMini** – allow quick searching and selecting players for roster slots. Filters are cumulative across team, role, contract, bio, and stat criteria.
>
> Many mini components in `features/table` (e.g. `PlayerRow`, `PlayerDrawer`, `RolePill`, `PlayerStatsMini`) compose the table UI. Shared UI primitives such as `RangeSelector` and `BadgeFilterSelect` live under `components/shared/ui/`.
>
> ## Custom Hooks
>
> - **useFirebaseQuery** – generic Firestore fetch wrapper returning `{ data, loading, error }`. Defined in `src/hooks/useFirebaseQuery.js`.
> - **useSimplePlayerData** – primary player-list hook for the `players_v2` source collection. Prefer this for roster and scouting surfaces.
> - **usePlayerData** – diagnostics wrapper around `useSimplePlayerData` when extra logging or debug context is needed.
> - **useFilteredPlayers** – memoizes calls to `filterPlayers` and `sortPlayers` from `utils/filtering/playerFilterUtils.js`.
>
> ## Utilities and Constants
>
> Filtering logic lives in `src/utils/filtering`. Default filter values are defined in `playerFilterDefaults.js`:
>
> ```js
> export function getDefaultPlayerFilters() {
>   return {
>     nameSearch: '',
>     nameOrder: 'az',
>     // ...
>   };
> }
> ```
>
> Role options come from `utils/roles/roleOptions.js` while the comprehensive sub-role list is exported from `constants/SubRoleMasterList.js`.
>
> The roster utilities provide helpers like `buildInitialRoster` which auto-fills starter, rotation and bench groups based on position priorities.
>
> Formatting helpers (`formatHeight`, `formatSalary`) handle display of numbers. `profileHelpers.js` resolves modal titles and blurb text keys.
>
> ## State Flow and Filtering
>
> Player documents are loaded from Firestore via `usePlayerData`. These normalized player objects are passed through `useFilteredPlayers` which applies the current filter set. Filters come from `getDefaultPlayerFilters()` and are updated via the filter UI. Sorting is performed by `sortPlayers` inside `playerFilterUtils.js`.
>
> Firebase documents are expected to contain bio info, contract data, traits, roles, subRoles, badges, stats and blurbs. Normalization adds convenience fields like `formattedPosition` and `salaryByYear` for quicker lookups.
>
> ## Modals and Blurb Editing
>
> Several attributes have explanatory blurbs with optional video. `getModalTitle` and `getBlurbValue` in `profileHelpers.js` map keys such as `trait_Shooting` or `role_offense1` to a user-friendly title and stored text. `Modal.jsx` supports generic popups and is reused for these breakdown editors.
>
> ## Roster Tools
>
> `RosterViewer` orchestrates the starter/rotation/bench sections using **RosterSection** and a fixed 5/4/6 roster shape. It supports current-team auto-fill, blank rosters, and saved-roster deep links (`/roster/:rosterId`). Saved rosters keep their saved team locked in the UI, and unresolved player IDs render as explicit placeholders instead of being silently dropped.
>
> ## Developer Conventions
>
> - Import paths use the alias `@/` pointing to `src/` (configured in `jsconfig.json`).
> - Components are organized by feature; shared UI lives under `src/components/shared`.
> - Many utilities export functions individually so they can be tree-shaken.
> - Keep new components small and reusable—follow patterns in `features/table` for mini components.
>
> ## Contributing Notes
>
> - Automated validation exists. Default to `npm run test:diff -- --reporter=dot`; use `npm run test:roster -- --reporter=dot` for roster logic and targeted `npm run test:ui -- --reporter=dot ...` for UI-heavy changes.
> - Run `npm run build` after meaningful UI or route changes and `npm run validate:project` after structural changes.
> - Firebase credentials are loaded from environment variables (`src/firebaseConfig.js`).
> - When adding new filters or roster behaviors, update shared defaults/helpers in `src/shared/utils/filtering/` and the roster feature doc.

## Data Model Overview

Player source data lives in the hierarchical `players_v2` collection, with canonical Zod schemas in `src/schemas/` and generated references under `docs/schema/`. Roster Builder reads denormalized player views through `useSimplePlayerData`, normalizes them into a fixed `{ starters, rotation, bench }` shape, and persists user-created snapshots to `rosterProjects`.

## Firestore Collections and Data Sources

This project reads canonical player/team data from source collections and stores user-created artifacts separately:

| Collection | Purpose |
| ---------- | ------- |
| `players_v2` | Canonical read-only player source with bio, contracts, seasons, evaluations, roles, badges, and display fields |
| `architect_baseTeams` and related architect base collections | Read-only Architect source data |
| `rosterProjects` | User-created roster builder snapshots |
| `lists`, `tierLists`, `architect_worlds` | Other user-created feature data |

- Use `useSimplePlayerData()` for the shared player pool.
- Use feature-specific Firebase helpers in `src/firebase/` for user-created content such as roster saves.
- Import Firestore collection names from `src/constants/collections.ts`; do not hardcode collection strings.

📄 Refer to [`docs/architecture/DATA_SOURCE_MAP.md`](./docs/architecture/DATA_SOURCE_MAP.md) for usage rules  
📄 Refer to [`docs/schema/CURRENT_FIRESTORE_SCHEMA.md`](./docs/schema/CURRENT_FIRESTORE_SCHEMA.md) for canonical schema reference

## Documentation Structure

The `docs/` folder is organized into specialized subdirectories:

- **`docs/architecture/`** - Technical architecture documents, schemas, and project context
- **`docs/guides/`** - User-facing guides for data population, collection naming, and diagnostics
- **`docs/api/`** - Auto-generated component hierarchies and API documentation
- **`docs/compliance/`** - Audit certificates and compliance matrices

## Adding Filters or Traits

1. Define default values in `src/utils/filtering/playerFilterDefaults.js`.
2. Add label helpers in `src/utils/filtering/filterHelpers.js` or constants files.
3. Extend the UI under `src/features/filters/FiltersPanel/FilterPanel/sections`.
4. Update `profileHelpers.js` and `constants/badgeList.js` when introducing new trait labels.

## Typical Workflow

1. Install dependencies with `npm install`.
2. Start the dev server via `npm run dev`.
3. Add components within feature folders and split files over ~200 lines.
4. Run the most relevant scoped validation (`npm run test:diff -- --reporter=dot`, `npm run test:roster -- --reporter=dot`, or targeted `npm run test:ui -- --reporter=dot ...`) plus `npm run build` when UI changes are involved.

## Validation & CI

The repository structure and conventions are documented and validated via the **Project Schema** system:

- **Schema Documentation**: [PROJECT_SCHEMA.md](../architecture/PROJECT_SCHEMA.md) - Authoritative documentation of repo layout, naming conventions, script interfaces, and data contracts
- **Machine Schema**: `project.schema.json` - Machine-readable contract for automated validation
- **Validation Tool**: Run `npm run validate:project` to check:
  - Required directories exist
  - Player contract files follow naming conventions
  - Filename ↔ playerId consistency
  - File structure matches documented patterns

The validator runs automatically in CI on all PRs and pushes to ensure the repository structure stays consistent with documentation.

## Schemas

- Canonical source of truth is code-first Zod schemas in `src/schemas/`.
- Generated references live under `docs/schema/`.
- Do not declare duplicate `Player*` or `Contract*` interfaces outside `src/schemas/`.

### Running Validation Locally

```bash
# Validate project structure and naming conventions
npm run validate:project

# Should output:
# ✅ All validations passed!
```

### When to Update Schema

Update `PROJECT_SCHEMA.md` and `project.schema.json` when:

- Adding new top-level directories
- Adding new script entry points
- Changing artifact output locations
- Modifying naming conventions
- Adding new validation rules

See the Contributing Rules section in `PROJECT_SCHEMA.md` for complete guidelines.
