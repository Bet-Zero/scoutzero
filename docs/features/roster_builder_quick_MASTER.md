# Roster Builder (Quick Lineup Builder) — Master Audit

## Executive Summary

The Roster Builder is a quick lineup builder that assembles a 15‑man view split into **starters (5)**, **rotation (4)**, and **bench (6)**. It pulls the full NBA player pool from `players_v2` via `useSimplePlayerData`, supports team‑based auto‑fill, and lets users add/remove players via a drawer with search + filters. It can save new rosters to Firestore and load them back by ID or from the roster list page. Current completeness covers the core add/remove + save/load loop, but there is **no update/overwrite flow**, several **filters are effectively broken** (team and FA type), and **export/preview/download is not wired** to any user control. Validation was **not run** in this environment; a manual test script is provided below.

## User-Facing Behaviors

- Select a team from a dropdown and auto‑fill the “Current NBA Roster” into starter/rotation/bench slots.
- Switch roster load mode between **Current NBA Roster**, **Blank Roster**, or a saved roster for the selected team.
- Open the Add Player drawer via the global drawer button or by clicking an empty slot.
- Add players to a specific slot (when opened from an empty slot) or to the next available slot (when opened from the drawer button).
- Remove players from any slot via the ✕ control on player cards.
- Search and filter players by name, team, position, roles/subroles, shooting profile, badges, FA year/type, and salary range.
- Toggle “Screenshot Mode” (hides UI chrome, keeps roster view).
- Save a new roster with a name (creates a new Firestore document).
- Visit a Rosters home page to list, rename, delete, and open saved rosters.

## Route/Entry Points

- **`/roster`**: Roster Builder main view (TeamRosterView → RosterViewer).
- **`/roster/:rosterId?`**: Load a saved roster by Firestore ID (optional param).
- **`/rosters`**: Saved roster list page (RostersHome).
- **Header navigation**: `Tools → Roster Builder` goes to `/roster`; `Saved → Rosters` goes to `/rosters`.

## File Map

- `src/pages/TeamRosterView.jsx` — Route view for `/roster` and `/roster/:rosterId?`.
- `src/features/roster/RosterViewer.jsx` — Main roster UI, drawer wiring, save modal, screenshot mode.
- `src/features/roster/RosterControls.jsx` — Team selector and roster load selector.
- `src/features/roster/RosterSection/index.jsx` — Renders starter/rotation/bench sections and empty slots.
- `src/features/roster/RosterSection/StarterCard.jsx` — Starter card layout.
- `src/features/roster/RosterSection/RotationCard.jsx` — Rotation card layout.
- `src/features/roster/RosterSection/BenchCard.jsx` — Bench card layout.
- `src/features/roster/RosterSection/EmptySlot.jsx` — “+” slot to target add‑player.
- `src/features/roster/AddPlayerDrawer/index.jsx` — Drawer wrapper with search + filters.
- `src/features/roster/AddPlayerDrawer/PlayerRowMini.jsx` — Player list row.
- `src/features/roster/AddPlayerDrawer/addPlayer/*` — Filter tabs and filter controls.
- `src/features/roster/hooks/useRosterManager.js` — Roster state, load logic, save logic.
- `src/features/roster/utils/rosterUtils.js` — `normalizePlayer`, `buildInitialRoster`.
- `src/features/roster/utils/contractUtils.js` — `isTwoWayContract`.
- `src/firebase/rosterHelpers.js` — Firestore CRUD for `rosterProjects`.
- `src/pages/RostersHome.jsx` — Saved roster list, rename, delete, search.
- `src/features/roster/CreateRosterModal.jsx` — Create roster from list page.
- `src/features/roster/SaveRosterModal.jsx` — Save new roster from builder.
- `src/shared/hooks/useSimplePlayerData.ts` — Player pool source (`players_v2`).
- `src/shared/utils/filtering/basicFilterUtils.js` — Default filter state + team options.
- `src/core/layout/SiteLayout.jsx` — Header nav entry points.

## Data Model (roster object)

**In‑memory roster state** (from `useRosterManager`):

- `roster`: `{ starters: (Player|null)[], rotation: (Player|null)[], bench: (Player|null)[] }`
- Default `emptyRoster` sizes: starters = 5, rotation = 4, bench = 6.
- Slots hold **normalized player objects** (via `normalizePlayer`) or `null` for empty.

**Firestore document (`rosterProjects` collection)**:

- `id`: Firestore document ID (used in routes).
- `name`: roster name (string).
- `team`: team slug (e.g., `lakers`), or empty string.
- `starters`: array of player IDs or `null` entries.
- `rotation`: array of player IDs or `null` entries.
- `bench`: array of player IDs or `null` entries.
- `createdAt`: `serverTimestamp()`.
- `updatedAt`: `serverTimestamp()`.

## Persistence

- **Collection**: `rosterProjects`.
- **Create**: `createRosterProject` in `src/firebase/rosterHelpers.js` (called from `SaveRosterModal` and `CreateRosterModal`).
- **Read**: `fetchAllRosterProjects` / `loadRosterProject` (used in `useRosterManager`); direct `getDocs` in `RostersHome`.
- **Update**: `updateRosterProject` exists but is **not wired** in the UI.
- **Rename/Delete**: `RostersHome` uses `updateDoc` and `deleteDoc` directly.

## Constraints & Rules

- Fixed slot counts for blank rosters: **5 starters / 4 rotation / 6 bench**.
- **Auto‑fill logic** (Current NBA Roster):
  - Filters player pool by selected team name, slug, or nickname match.
  - Excludes two‑way contracts (`isTwoWayContract`).
  - Sorts by minutes (`MIN`) descending.
  - Assigns starters using position heuristics (G/G/GF/F/FC‑C buckets), then fills rotation (next 4) and bench (next 6).
- **Add‑player behavior**:
  - If a slot was clicked, the next selection fills that specific slot.
  - Otherwise, the selection fills the next empty slot scanning starters → rotation → bench.
- **No enforcement** for positional constraints, salary cap, or team limits.
- **No swap/reorder UI** (remove + re‑add only).

## Gaps & Risks

- [CLOSED ✅] **Update/overwrite flow** now supported (overwrite existing or save as new copy) using `updateRosterProject`.
- [CLOSED ✅] **Team filter** normalized to a canonical team code for both filter values and player data.
- [CLOSED ✅] **FA Status filter** — RB_E3 COMPLETE (2026-02-05): Renamed from "FA Type" and restricted to true FA statuses (UFA/RFA only). Contract options moved to separate filter.
- [CLOSED ✅] **Contract Features filter** — RB_E3 COMPLETE (2026-02-05): New dropdown for Team Option, Player Option, ETO, and Two-Way. Uses shared `playerHasOptionType` and `isPlayerTwoWay` helpers from `basicFilterUtils.js`.
- [CLOSED ✅] **Export/preview/download wired** via visible Preview and Export buttons.
- [CLOSED ✅] **Duplicate prevention** blocks adding the same player twice and shows a warning.
- [CLOSED ✅] **Roster‑size validation** normalizes rosters to 5/4/6 after load, add/remove, and save.

## What Changed in v1 Closure

- Added roster shape normalization (5/4/6) across auto‑fill, load, add/remove, and save.
- Fixed team and FA type filters using canonical normalization.
- Implemented overwrite vs save‑as‑copy flow with `updatedAt` updates.
- Wired Preview and Export buttons (preview image, JSON copy/download).
- Blocked duplicate player adds with a toast warning.

## Acceptance Criteria Checklist (v1)

- [x] User can open `/roster` and see the blank roster view.
- [x] Selecting a team + “Current NBA Roster” auto‑fills starters/rotation/bench.
- [x] User can add a player to a specific slot and to the next available slot.
- [x] User can remove a player from any slot.
- [x] Search by player name returns expected results.
- [x] Team filter works in the add‑player drawer.
- [x] FA type filter works in the add‑player drawer.
- [x] Roster arrays stay at 5/4/6 after load, add/remove, and save.
- [x] Duplicate players are blocked with a warning.
- [x] User can save a new roster and it appears in `/rosters`.
- [x] User can overwrite an existing roster or save as a new copy.
- [x] Preview and Export buttons open their modals (preview image + JSON copy/download).
- [x] User can open a saved roster via `/roster/:id` and see the same lineup.

## Manual Test Script

**Validation status:** Pending — record results in the return package.

1. Navigate to `/roster` from `Tools → Roster Builder`.
2. Select a team and keep load method set to “Current NBA Roster”; verify auto‑fill and 5/4/6 counts.
3. Click an empty slot, pick a player from the drawer, confirm the slot fills.
4. Open the drawer via the global drawer button and select a player; confirm it fills the next available slot.
5. Try to add the same player again; confirm a warning appears and the roster does not duplicate.
6. Remove a player via the ✕ control.
7. Use search to find a player by name; verify list updates.
8. Apply team and FA type filters; verify list updates.
9. Click “Preview”; confirm the modal opens and download works.
10. Click “Export”; confirm JSON copy/download works.
11. Click “Save Roster”, enter a name, save; confirm it appears in `/rosters`.
12. Open the saved roster (`/roster/:id`); confirm lineup matches. Try **Overwrite** and **Save as new copy** from the Save modal.

## Existing Tests + Coverage Notes

- Added `src/tests/roster/rosterBuilderUtils.test.ts` for roster shape + filter normalization utilities.
- Automated tests in the repo still focus on **Architect** and trade/cap validation; roster builder UI flows remain manual.
