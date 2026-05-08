# Tiermaker / Tieramid — Feature Master

## Executive Summary

- The feature exists as two UI modes under the same route: Tiermaker (standard tier list) and Tieramid (pyramid layout) in `src/pages/TierMakerView.jsx`.
- There is no drag-and-drop library or implementation; all movement is button-driven.
- Persistence uses Firestore `tierLists` with `tiers` as a map of tier/row name → player ID array, `tierOrder` as the display order, `mode` as the saved default reopen layout, and `ownerUid` for owner-only access.

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
- Toggle “Screenshot View” to hide controls and the Pool row for manual capture.

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
- `mode: 'standard' | 'pyramid'`
- `ownerUid: string`
- `createdAt`, `updatedAt` timestamps

## Persistence (Where/How It Saves)

- Create list: `createTierList()` in `src/firebase/listHelpers.js` seeds the default structure for the requested mode.
- Save list: `saveTierList()` updates `tiers`, `tierOrder`, and `mode`.
- Load list: `fetchTierList()` owner-enforces the read, auto-claims legacy ownerless docs, repairs legacy wrong-mode docs when needed, then rehydrates IDs to player objects.
- Storage is Firestore only; no localStorage fallback.

## Export / Share

- No built-in export image.
- “Copy Reopen Link” copies the canonical saved-list reopen URL (`/tier-maker/:tierListId?mode=...`).
- Reopen links are owner-only: a different anonymous session sees an unavailable state instead of the saved board.
- “Screenshot View” hides controls for manual capture, and Tiermaker also hides Pool in that mode.

## Gaps & Risks

[BLOCKER]

- No drag-and-drop support.

[DEFERRED — v2]

- Export-to-image (PNG/JPEG) — requires new dependency (html2canvas or similar). Screenshot View + device capture is the v1 path.
- "Copy Reopen Link" from draft mode — current UX uses a toast hint to save first.

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
/tier-maker/:tierListId                 → Saved route that resolves stored mode, then normalizes to `?mode=...`
/tier-maker/:tierListId?mode=standard   → Explicit Tiermaker mode
/tier-maker/:tierListId?mode=tieramid   → Tieramid mode with same list
```

- Mode toggle updates query param without losing tier list ID
- Saved routes without a valid `mode` param fetch the list once and replace the URL with the resolved saved mode
- Refresh preserves both list and mode
- Cross-mode navigation auto-loads the same list
- Tier Lists Home opens saved lists using the resolved stored mode

## Acceptance Criteria Checklist (v1)

- [x] Tiermaker and Tieramid are both accessible at `/tier-maker` with a clear mode toggle.
- [x] Users can add players via search/filters, team rosters, and saved lists.
- [ ] Primary interaction supports drag-and-drop or a documented button-only alternative.
- [x] Users can remove players back to Pool in both modes.
- [x] Users can add, rename, delete, and reorder tiers or rows.
- [x] Save and load tier lists persist and restore tiers, order, and pool.
- [x] Tieramid "Add Team" works correctly with team IDs.
- [x] Saved lists provide a stable owner-only reopen link; export-to-image remains deferred.
- [x] No console errors in normal use.
- [x] Cross-mode auto-load: Switching modes keeps the same list.
- [x] Refresh persistence: Both list and mode survive browser refresh.
- [x] Tieramid starts with empty Pool (not all players).
- [x] Full pyramid eviction: Bottom/last player evicted (not top).
- [x] **[CLOSED]** Draft Mode: Toggle Tiermaker ↔ Tieramid without losing work (via conversion).
- [x] **[CLOSED]** Draft Mode: Refresh restores state from sessionStorage.
- [x] **[CLOSED]** Draft Mode: Clear Draft wipes state and sessionStorage.
- [x] **[CLOSED]** Saved Mode: sessionStorage does not interfere with Firestore load/save.
- [x] **[CLOSED]** Cross-mode conversion: All players preserved, order deterministic.
- [x] **[CLOSED]** Tier/row reordering persists in Draft and Saved modes.
- [x] **[CLOSED]** Copy Reopen Link is one-click for saved lists and disabled with a hint toast in draft mode.
- [x] **[CLOSED]** Screenshot View hides controls in both modes and hides Pool in standard mode.
- [x] **[CLOSED]** No duplicate players from repeated add operations.

## Cross-mode Compatibility (Defined)

- A tier list can be viewed in either layout (Tiermaker or Tieramid) using the same `tierListId` route parameter.
- Tieramid enforces row capacity on load and during normalization; any overflow players are moved to Pool to guarantee no hidden players.
- This means Tiermaker tiers that exceed Tieramid row capacity will still load, but excess players are placed in Pool.

## Draft vs Saved Mode (Added 2026-02-05)

The tier maker operates in two distinct modes depending on whether a `tierListId` is present in the URL:

### Saved Mode (`:tierListId` present)

- Boards load data from Firestore via `fetchTierList()` with owner enforcement.
- Save writes back to Firestore via `saveTierList()` and persists the current board mode as the default reopen layout.
- Refresh reloads from Firestore.
- Wrong-session reopen attempts render an unavailable state with a link back to `/tier-lists`.
- **sessionStorage is never read or written** in saved mode.

### Draft Mode (no `:tierListId`)

- Board state lives in a lifted draft container managed by `useTierDraft` hook in `TierMakerView`.
- Both layouts are tracked simultaneously:
  - `draftStandard`: `{ tiers: Record<string, string[]>, tierOrder: string[] }`
  - `draftTieramid`: `{ rows: Record<string, string[]>, rowOrder: string[] }`
  - `draftUpdatedAt`: timestamp (epoch ms)
- **sessionStorage key**: `tiermaker_draft_v1`
- **Debounce**: ~1000ms for sessionStorage writes
- **Restore on mount**: Reads sessionStorage on first load of `/tier-maker` (no listId), parses JSON, and sets draft state.
- **Clear Draft**: A "Clear Draft" button appears in the mode toggle bar when draft has content. Clicking it:
  - Wipes draft state to null
  - Removes sessionStorage key
  - Both boards reset to empty defaults
- **Save from Draft**: When a user creates and saves a tier list from draft mode:
  - Firestore document is created
  - URL navigates to `/tier-maker/:id?mode=...`
  - Draft sessionStorage is cleared automatically

### Draft ↔ Board Communication

- Draft stores player **IDs only** (not player objects) — same format as Firestore.
- Boards rehydrate IDs → player objects using `playersMap` on initialization.
- Boards serialize player objects → IDs and report changes back to the draft (debounced at ~300ms).
- This keeps sessionStorage small and consistent with the Firestore format.

### Implementation Files

- `src/features/tierMaker/hooks/useTierDraft.ts` — sessionStorage persistence hook
- `src/pages/TierMakerView.jsx` — draft orchestration, conversion on toggle
- Board components accept `isDraftMode`, `draftData`, `onDraftChange`, `draftRestored` props

## Cross-Mode Conversion Rules (v1) (Added 2026-02-05)

### Conversion Trigger

When toggling modes **in draft mode only**:

- If the target mode is **empty** AND the source mode has content → auto-generate target using conversion rules.
- If the target mode **already has edits/content** → do NOT overwrite it automatically.

### "Empty" Definitions

- **Standard empty**: All tiers (including Pool) have zero player IDs, OR draft is null/undefined.
- **Tieramid empty**: All rows (including Pool) have zero player IDs, OR draft is null/undefined.

### Standard → Tieramid (`standardToTieramid`)

1. Flatten `tierOrder` top → bottom (excluding Pool), preserving left → right order within each tier.
2. Fill `Row1`(1 spot), `Row2`(2 spots), `Row3`(3 spots)… left → right.
3. Add rows beyond the default 5 as needed so ALL players fit (no hidden players).
4. Pool IDs copy directly to Pool.

**Example**: S=[a,b], A=[c,d,e] → Row1=[a], Row2=[b,c], Row3=[d,e,_], Pool=Pool

### Tieramid → Standard (`tieramidToStandard`)

1. Each row becomes a tier with the same name (Row1 → tier "Row1", Row2 → tier "Row2", etc.).
2. Left → right order within each row is preserved.
3. Pool stays Pool.

### Implementation File

- `src/features/tierMaker/utils/draftConversion.ts` — pure functions, no React dependencies

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
2. Open it in `/tier-maker/:tierListId?mode=standard` or click it from `/tier-lists`.
3. Add players via the drawer, “Add Team,” and “Add List.”
4. Move players between tiers and remove a player.
5. Save, reload, and load the saved list.
6. Switch to Tieramid mode and place players into the pyramid.
7. Copy the reopen link and verify it reopens only for the same session.
8. Move players up/down/left/right and attempt to remove to Pool.
9. Save, reload, and load in Tieramid.
10. Enter Screenshot View and verify Tiermaker hides Pool.
11. Confirm no console errors and no hidden players in rows.

## Existing Tests + Coverage Notes

- `tests/tierSaveAsList.test.js` covers Tiermaker/Tieramid → List export payloads.
- `tests/tierMakerListOrder.test.js` covers tier/list ordering behavior used by imports.
- `tests/tierListModePersistence.test.js` covers mode resolution, create/save persistence, auto-repair, and owner-only read errors.
- `tests/tierMakerRoutes.ui.test.jsx` covers saved-route mode normalization, owner-only unavailable state, and `/tier-lists` reopening saved pyramid lists in Tieramid.
- `tests/tierMakerBoards.ui.test.jsx` covers Tiermaker screenshot Pool hiding, standard-mode invalid-control removal, and Tieramid edge-button disabling.

---

## v1 Closure — CLOSED ✅

**Closure Date**: 2026-02-13

### What v1 Includes

- **Dual mode UI**: Tiermaker (standard tier rows) and Tieramid (pyramid layout) under a single route with toggle.
- **Draft mode + sessionStorage**: Unsaved work persists across refresh via `sessionStorage`; `useTierDraft` hook manages lifecycle.
- **Cross-mode conversion**: Standard → Tieramid and Tieramid → Standard with deterministic player placement and no hidden players.
- **Tier/row reordering**: ▲/▼ buttons on tier headers and row labels; Pool pinned last; persists in both Draft and Saved modes.
- **Copy Reopen Link**: One-click owner-only URL copy for saved lists; disabled with hint toast in draft mode.
- **Screenshot View**: Hides controls in both modes; Tiermaker also hides Pool for manual screen capture.
- **Dedupe hardening**: Repeated adds from drawer/team/list are silently skipped across all tiers/rows.
- **URL-based persistence**: List ID in path, mode in query param; both survive refresh.
- **Save/load via Firestore**: Full CRUD (create, save, load, rename, delete) for tier lists.
- **Pool crash fix**: Defensive `Pool` invariant enforced on every state transition.
- **Order invariant fix**: Default tiers/rows injected when loaded data has no non-Pool entries.

### Explicitly Deferred to v2

| Item                             | Reason                                                                                             |
| -------------------------------- | -------------------------------------------------------------------------------------------------- |
| Export-to-image (PNG/JPEG)       | Requires new dependency (html2canvas or similar); Screenshot View + device capture is the v1 path. |
| "Save & Copy Link" in draft mode | Adds create→save→navigate→copy complexity; current toast hint is acceptable for v1.                |
| Drag-and-drop                    | No DnD library added; all movement is button-driven by design in v1.                               |

### Validation Evidence

- **Build**: `npm run build`
- **Targeted tests**:
  - `npm run test:node -- --reporter=dot tests/tierSaveAsList.test.js tests/tierMakerListOrder.test.js tests/tierListModePersistence.test.js`
  - `npm run test:ui -- --reporter=dot tests/tierMakerRoutes.ui.test.jsx tests/tierMakerBoards.ui.test.jsx`
- **Manual scenarios to keep verifying**: Draft mode persistence, saved mode round-trip, screenshot view, dedupe, cross-mode conversion, owner-only reopen link.

---

## Known Limitations (v1)

1. **Tieramid → Tiermaker maps rows to tiers by name**: Converting from Tieramid to Tiermaker creates tiers named `Row1`, `Row2`, etc. — these are functional but not semantically meaningful tier labels (S/A/B/C/D).
2. **No true export-to-image**: Screenshot View hides controls for manual device capture, but there is no in-app PNG/JPEG export. Deferred to v2.
3. **No drag-and-drop**: All player movement is button-based (▲/▼/←/→/Place/Remove). This is by design in v1, not a missing feature.
