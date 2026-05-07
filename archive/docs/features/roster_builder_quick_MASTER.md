# Roster Builder (Quick Lineup Builder) — Master Audit

## Executive Summary

The Roster Builder assembles a normalized 15-man roster split into **starters (5)**, **rotation (4)**, and **bench (6)**. It reads the player pool from `players_v2` through `useSimplePlayerData`, supports current-team auto-fill, blank rosters, and saved-roster deep links (`/roster/:rosterId`), and saves user-created roster documents to `rosterProjects`. The current builder supports overwrite/save-as-copy, preview/download, and JSON export. Recent hardening also makes add-player filters cumulative, disables the global add button when the roster is full, disables team switching while a saved roster is active, and preserves unresolved saved player IDs as visible placeholders instead of silently dropping them.

---

## ✅ v1 CLOSURE — 2026-02-05

**Status:** CLOSED  
**Closure Date:** 2026-02-05  
**Executions:**

- **RB_E1**: Core v1 closure (duplicate prevention, overwrite/save-as-copy, preview/export wiring, roster size normalization)
- **RB_E2**: FA Status extraction (renamed from FA Type, restricted to UFA/RFA)
- **RB_E3**: Contract Features filter (Team Option, Player Option, ETO, Two-Way)

### What v1 Includes

- ✅ Team-based auto-fill with position heuristics (5 starters / 4 rotation / 6 bench)
- ✅ Add/remove players via drawer with search + filters
- ✅ Save new rosters to Firestore (`rosterProjects` collection)
- ✅ Load saved rosters by ID or from roster list page
- ✅ Overwrite existing roster or save as new copy
- ✅ Duplicate player prevention with warning toast
- ✅ Preview roster (screenshot mode + downloadable image)
- ✅ Export roster (JSON copy/download)
- ✅ Search by player name
- ✅ Filter by team (normalized to canonical team codes)
- ✅ Filter by position, roles/subroles, shooting profile, badges
- ✅ Filter by FA Status (UFA/RFA only)
- ✅ Filter by Contract Features (Team Option, Player Option, ETO, Two-Way)
- ✅ Filter by salary range
- ✅ Roster size normalization (5/4/6) enforced across load, add/remove, and save
- ✅ Rename/delete rosters from list page (`/rosters`)

### Validation Evidence

**Automated coverage now includes:**

- `src/tests/roster/rosterBuilderUtils.test.ts` for roster normalization and utility behavior
- `src/tests/roster/rosterBuilderHelpers.test.ts` for cumulative filter logic, team-code matching, salary lookup, and missing-player placeholder handling
- `tests/roster/rosterBuilder.ui.test.jsx` for saved-roster deep links, disabled invalid controls, missing-player warnings, overwrite preservation, and rename metadata refresh

**Build validation:** use `npm run build` after meaningful roster UI or route changes.

### Known Non-Goals (Out of Scope for v1)

- ❌ Positional constraints (can add 5 centers if desired)
- ❌ Salary cap enforcement or validation
- ❌ Team size limits (15-man roster not enforced)
- ❌ Swap/reorder UI (must remove + re-add to reorganize)
- ❌ Drag-and-drop slot reordering
- ❌ Multi-team rosters or "All-Star" mode
- ❌ Advanced trade machine integration

---

## User-Facing Behaviors

- Select a team from a dropdown and auto‑fill the “Current NBA Roster” into starter/rotation/bench slots.
- Switch roster load mode between **Current NBA Roster**, **Blank Roster**, or a saved roster for the selected team.
- Open the Add Player drawer via the global drawer button or by clicking an empty slot.
- Add players to a specific slot (when opened from an empty slot) or to the next available slot (when opened from the drawer button).
- The global drawer button is disabled when all 15 roster slots are full.
- Remove players from any slot via the ✕ control on player cards.
- Search and filter players by name, team, position, roles/subroles, shooting profile, badges, FA year/status, contract features, salary range, bio ranges, and stat ranges. Active filters are cumulative.
- Toggle “Screenshot Mode” (hides UI chrome, keeps roster view).
- Save a new roster with a name, overwrite an existing saved roster, or save as a new copy.
- Deep-link directly to a saved roster with `/roster/:rosterId`.
- Saved-roster mode keeps the saved team locked in the UI; the team selector is disabled until the user switches back to Current NBA Roster or Blank Roster.
- If a saved roster references a player ID that no longer resolves from `players_v2`, the slot stays visible as a “Missing Player” placeholder and the original ID is preserved on overwrite/export.
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
- `src/firebase/rosterHelpers.ts` — Firestore CRUD for `rosterProjects` with typed writes and Zod-validated reads.
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
- `ownerUid`: Firebase Auth UID for the roster owner. New docs always write this; legacy ownerless docs are auto-claimed on first signed-in access.
- `createdAt`: `serverTimestamp()`.
- `updatedAt`: `serverTimestamp()`.

## Persistence

- **Collection**: `rosterProjects`.
- **Constant**: `ROSTER_PROJECTS_COLLECTION` in `src/constants/collections.ts`.
- **Create**: `createRosterProject(name, userId, ...)` in `src/firebase/rosterHelpers.ts` (called from `SaveRosterModal` and `CreateRosterModal`).
- **Read**: `fetchAllRosterProjects(userId)` / `loadRosterProject(id, userId)` in `src/firebase/rosterHelpers.ts` (used in `useRosterManager` and `RostersHome`).
- **Update**: `updateRosterProject(id, userId, patch)` is wired to the overwrite flow in `RosterViewerActions`.
- **Rename/Delete**: `RostersHome` uses `renameRosterProject(id, newName, userId)` / `deleteRosterProject(id, userId)`; rename updates `updatedAt`.
- **Ownership policy**: The app now treats roster projects as user-owned content. `rosterHelpers.ts` blocks non-owner writes and auto-claims legacy ownerless docs on first signed-in access.

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
- **Persistence gating**:
  - Saving requires an initialized Firebase Auth session.
  - `/rosters` only shows the current user's owned rosters plus any legacy ownerless rosters that get claimed during that visit.
- **No enforcement** for positional constraints, salary cap, or team limits.
- **No swap/reorder UI** (remove + re‑add only).

## Gaps & Risks

- The builder intentionally does not enforce salary cap, positional legality, or roster-balance rules.
- Saved-roster rendering depends on `players_v2` remaining internally consistent. Missing player IDs are now preserved, but they still require manual replacement or removal by the user.
- Salary display currently relies on the shared default salary year constant; review this on season rollover.
- Firestore rules for `rosterProjects` have not been tightened to match the new app-level owner contract yet, so the helper layer remains the current enforcement point.

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
- [x] FA status and contract feature filters work cumulatively in the add‑player drawer.
- [x] Roster arrays stay at 5/4/6 after load, add/remove, and save.
- [x] Duplicate players are blocked with a warning.
- [x] User can save a new roster and it appears in `/rosters`.
- [x] User can overwrite an existing roster or save as a new copy.
- [x] Preview and Export buttons open their modals (preview image + JSON copy/download).
- [x] User can open a saved roster via `/roster/:id` and see the same lineup.
- [x] The global add button disables when the roster is full.
- [x] Saved rosters with unresolved player IDs surface placeholder warnings instead of silently deleting those slots.

## Manual Test Script

**Validation status:** Pending — record results in the return package.

1. Navigate to `/roster` from `Tools → Roster Builder`.
2. Select a team and keep load method set to “Current NBA Roster”; verify auto‑fill and 5/4/6 counts.
3. Click an empty slot, pick a player from the drawer, confirm the slot fills.
4. Open the drawer via the global drawer button and select a player; confirm it fills the next available slot.
5. Try to add the same player again; confirm a warning appears and the roster does not duplicate.
6. Remove a player via the ✕ control.
7. Use search to find a player by name; verify list updates.
8. Apply stacked filters (for example FA year + contract feature); verify list updates cumulatively.
9. Click “Preview”; confirm the modal opens and download works.
10. Click “Export”; confirm JSON copy/download works.
11. Click “Save Roster”, enter a name, save; confirm it appears in `/rosters`.
12. Fill all 15 slots and confirm the global add button disables with explanatory copy.
13. Open the saved roster (`/roster/:id`); confirm lineup matches, the team selector is disabled, and **Overwrite** / **Save as new copy** work from the Save modal.
14. Verify a saved roster with a missing player ID shows a placeholder warning and preserves the missing ID in overwrite/export output.

## Existing Tests + Coverage Notes

- `src/tests/roster/rosterBuilderUtils.test.ts` covers roster shape and normalization helpers.
- `src/tests/roster/rosterBuilderHelpers.test.ts` covers filter composition, salary lookup, team matching, and missing placeholders.
- `tests/roster/rosterBuilder.ui.test.jsx` covers saved-roster route loads, disabled invalid controls, missing-player warnings, overwrite preservation, and rename metadata refresh.
- Manual verification is still useful for clipboard/download browser behavior and real Firestore data edge cases.
