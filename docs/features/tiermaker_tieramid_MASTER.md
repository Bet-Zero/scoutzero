# Tiermaker / Tieramid — Feature Master

## Executive Summary

- The feature exists as two UI modes under the same route: Tiermaker (standard tier list) and Tieramid (pyramid layout) in `src/pages/TierMakerView.jsx`.
- There is no drag-and-drop library or implementation; all movement is button-driven.
- Persistence uses Firestore `tierLists` with `tiers` as a map of tier/row name → player ID array and `tierOrder` as the display order.

## Current UX (What a User Can Do Right Now)

Tier Lists Home (`/tier-lists`)

- View existing tier lists.
- Search tier lists via `ListSearchBar`.
- Rename or delete lists.
- Create a new list (modal).

Tiermaker (standard mode)

- Start with tiers `S, A, B, C, D, Pool` and an empty pool.
- Add players via drawer search/filters, “Add Team,” or “Add List.”
- Move players up/down between tiers via arrow buttons.
- Remove a player from a tier (returns to Pool).
- Add a tier, rename a tier (prompt), delete a tier (moves tier players into Pool), reset board.
- Save and load tier lists.
- Toggle “Screenshot View” to hide controls.

Tieramid (pyramid mode)

- Pyramid rows `Row1…Row5` plus `Pool` with row capacity = row index + 1.
- Add players via drawer search/filters, “Add Team,” or “Add List.”
- Place a pool player into the pyramid with “Place.”
- Move players up/down/left/right via arrow buttons.
- Remove a placed player back to Pool.
- Add a row (up to 10), delete last row, rename row (prompt).
- Save and load tier lists.
- Toggle “Screenshot View” to hide controls.

## Layout Modes

Tiermaker

- Horizontal tier rows with labels and per-player buttons.
- Pool row always last.

Tieramid

- Pyramid layout with centered rows and fixed slot counts.
- Pool displayed under pyramid.

## File Map (Routes / Components / Hooks / Utils)

Routes

- `src/pages/TierMakerView.jsx` (mode toggle, `/tier-maker/:tierListId?`).
- `src/pages/TierListsHome.jsx` (list management, `/tier-lists`).

Tiermaker feature components

- `src/features/tierMaker/TierMakerBoard.jsx`
- `src/features/tierMaker/TierRow.jsx`
- `src/features/tierMaker/TieramidBoard.jsx`
- `src/features/tierMaker/TieramidPlayerTile.jsx`
- `src/features/tierMaker/CreateTierListModal.jsx`
- `src/features/lists/TierPlayerTile.jsx`

Shared data and helpers

- `src/shared/hooks/useSimplePlayerData.ts` (players from `/players_v2`).
- `src/shared/hooks/useFirebaseQuery.js` (reads `lists`, `tierLists`).
- `src/firebase/listHelpers.js` (tier list CRUD).
- `src/constants/teamList.js` (team metadata).
- `src/features/roster/AddPlayerDrawer/index.jsx` (search + filters).

## State Model (Tiers + Items)

Tiermaker local state

- `tiers: Record<string, Player[]>` where each player includes `player_id`.
- `tierOrder: string[]` including `Pool`.

Tieramid local state

- `rows: Record<string, Player[]>` including `Pool`.
- `rowOrder: string[]` including `Pool`.

Firestore `tierLists` document

- `name: string`
- `tiers: Record<string, string[]>` (player IDs)
- `tierOrder: string[]`
- `createdAt`, `updatedAt` timestamps

## Persistence (Where/How It Saves)

- Create list: `createTierList()` in `src/firebase/listHelpers.js`.
- Save list: `saveTierList()` updates `tiers` and `tierOrder`.
- Load list: `fetchTierList()` then rehydrates IDs to player objects.
- Storage is Firestore only; no localStorage fallback.

## Export / Share

- No built-in export image or share link.
- “Screenshot View” hides controls for manual capture.
- Lists are only shareable by direct URL (`/tier-maker/:tierListId`).

## Gaps & Risks

[BLOCKER]

- No drag-and-drop support.

[MAJOR]

- No tier or row reordering UI (order is implicit or append-only).

[MINOR]

- None identified in current pass.

## Validated Findings (2026-02-05)

- Cross-mode is now defined and enforced in Tieramid with capacity normalization.
- **[CLOSED]** Cross-mode auto-load: Switching Tiermaker ↔ Tieramid now keeps the same list via URL routing.
- **[CLOSED]** Refresh persistence: Both list ID (path param) and mode (query param) are persisted across refresh.
- **[CLOSED]** Tieramid empty default: Pool no longer starts with all players; must be populated via drawer/team/list/load.
- **[CLOSED]** Full pyramid eviction: Now evicts bottom/last player (not top) when pyramid is full.

## URL Routing (Added 2026-02-05)

The tier maker now uses URL-based state persistence:

```
/tier-maker                             → Empty Tiermaker (no list loaded)
/tier-maker/:tierListId                 → Tiermaker with list auto-loaded
/tier-maker/:tierListId?mode=standard   → Explicit Tiermaker mode
/tier-maker/:tierListId?mode=tieramid   → Tieramid mode with same list
```

- Mode toggle updates query param without losing tier list ID
- Refresh preserves both list and mode
- Cross-mode navigation auto-loads the same list

## Acceptance Criteria Checklist (v1)

- [x] Tiermaker and Tieramid are both accessible at `/tier-maker` with a clear mode toggle.
- [x] Users can add players via search/filters, team rosters, and saved lists.
- [ ] Primary interaction supports drag-and-drop or a documented button-only alternative.
- [x] Users can remove players back to Pool in both modes.
- [ ] Users can add, rename, delete, and reorder tiers or rows.
- [x] Save and load tier lists persist and restore tiers, order, and pool.
- [x] Tieramid "Add Team" works correctly with team IDs.
- [ ] Export/share provides either a stable share link or built-in export image.
- [ ] No console errors in normal use.
- [x] Cross-mode auto-load: Switching modes keeps the same list.
- [x] Refresh persistence: Both list and mode survive browser refresh.
- [x] Tieramid starts with empty Pool (not all players).
- [x] Full pyramid eviction: Bottom/last player evicted (not top).

## Cross-mode Compatibility (Defined)

- A tier list can be viewed in either layout (Tiermaker or Tieramid) using the same `tierListId` route parameter.
- Tieramid enforces row capacity on load and during normalization; any overflow players are moved to Pool to guarantee no hidden players.
- This means Tiermaker tiers that exceed Tieramid row capacity will still load, but excess players are placed in Pool.

## Known Issues / Fixes

### Pool Crash Fix (2026-02-05)

**Issue:** Creating or loading tier lists caused `TypeError: prev.Pool is undefined` when attempting to add players.

**Root Cause:** Loaded tier lists from Firestore did not guarantee `Pool` existed in the tiers map, and operations assumed it was always present.

**Fix Applied:**

1. Created `normalizeTiers()` helper function that enforces invariant:
   - `tiers` must always include `Pool: []`
   - `tierOrder` must always include `"Pool"` as last element
2. Applied normalizer in:
   - Initial state creation (`getInitialTiers`)
   - Data load from Firestore (`handleLoadTierList`)
   - Board reset (`resetBoard`)
3. Made all Pool operations defensive:
   - `addPlayerToPool`, `addPlayersToPool`, `removePlayer`, `deleteTier`
   - All operations now use `prev.Pool || []` pattern
4. Applied similar defensive fixes to TieramidBoard

**Validation:** Build passes. Manual testing recommended.

**Return Package:** `return_packages/tiermaker/2026-02-05_execution-1c-pool-crash-fix.md`

### Order Invariants + Fallback Rendering (2026-02-05)

**Issue:** Tiermaker and Tieramid rendered only the Pool row — no tier rows (S/A/B/C/D) and no pyramid rows (Row1–Row5) were visible.

**Root Cause:** Three interacting bugs:

1. `normalizeTiers` / `normalizeRows` only ensured Pool existed — they did not inject default tiers/rows when loaded data had zero non-Pool entries.
2. `createTierList` saved `{ tiers: {}, tierOrder: [] }` — empty but truthy values that bypassed fallback logic.
3. `handleLoadTierList` used `data.tierOrder || fallback` — `[]` is truthy, so the fallback never fired.
4. (Compounding) Create flow called `onTierListChange` (URL navigate) before save completed, triggering autoload of the empty doc.

**Fix Applied:**

1. Enhanced `normalizeTiers` / `normalizeRows` to inject DEFAULT_TIERS (`S/A/B/C/D`) or default rows (`Row1–Row5`) when no non-Pool entries exist.
2. Fixed `createTierList` to seed documents with proper default structure based on mode.
3. Fixed `handleLoadTierList` to use `.length` check instead of `||` for tierOrder.
4. Fixed create-then-navigate race: save completes before URL navigation; `initialLoaded` set immediately.
5. Added rendering fallbacks: if `tierOrder` / `rowOrder` is unexpectedly empty at render time, falls back to defaults.

**Validation:** Build passes. No console errors.

**Return Package:** `return_packages/tiermaker/2026-02-05_execution-1d-restore-rows-and-order.md`

---

## Manual Test Script

1. Navigate to `/tier-lists` and create a new tier list.
2. Open it in `/tier-maker/:tierListId`.
3. Add players via the drawer, “Add Team,” and “Add List.”
4. Move players between tiers and remove a player.
5. Save, reload, and load the saved list.
6. Switch to Tieramid mode and place players into the pyramid.
7. Move players up/down/left/right and attempt to remove to Pool.
8. Save, reload, and load in Tieramid.
9. Confirm no console errors and no hidden players in rows.

## Existing Tests + Coverage Notes

- No tests found covering Tiermaker or Tieramid.
- No unit, integration, or e2e coverage specific to this feature.
