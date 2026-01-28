# SCOUTING_PLAYER_TABLE_PHASE_2A_PROFILE_NAV_RP

## Summary

Added click-to-profile navigation from the `/players` table. Clicking a player's name in a table row navigates to their profile page at `/profiles/<slug>?pid=<playerId>`.

## Changes Made

### 1. New Utility File Created

**File:** [src/shared/utils/routing/playerRouteUtils.js](src/shared/utils/routing/playerRouteUtils.js)

Exports:

- `toPlayerSlug(displayName)` - Converts display name to URL-safe slug
  - Example: `"LeBron James"` → `"lebron-james"`
  - Rules: trim, lowercase, replace non-alphanumeric with spaces, collapse spaces, join with hyphens
- `getPlayerProfileUrl(player)` - Generates profile URL with `pid` query param
  - Returns: `/profiles/<slug>?pid=<playerId>`
  - Fallback: `/profiles/<slug>` if no playerId available

### 2. PlayerRow Modified for Name Click Navigation

**File:** [src/features/table/PlayerTable/PlayerRow/index.jsx](src/features/table/PlayerTable/PlayerRow/index.jsx)

Changes:

- Added `useNavigate` import from `react-router-dom`
- Added `getPlayerProfileUrl` import
- Added `handleNameClick` function with `event.stopPropagation()` to prevent row expand/toggle
- Wrapped name area (`PlayerNameMini`) with clickable div:
  - `cursor-pointer` + `hover:underline` for visual affordance
  - Keyboard accessible (`role="button"`, `tabIndex={0}`, Enter/Space handlers)

### 3. PlayerProfileView Updated to Accept `pid` Query Param

**File:** [src/pages/PlayerProfileView.jsx](src/pages/PlayerProfileView.jsx)

Changes:

- Added `useSearchParams` import from `react-router-dom`
- Added `initialPidProcessedRef` to track one-time URL processing
- Added new `useEffect` that:
  - Reads `pid` from query params
  - Finds matching player by `id` or `bio.playerId`
  - Sets `selectedTeam`, `selectedPlayer`, and `filteredKeys`
  - Only runs once when players are loaded

## URL Format

```
/profiles/<slug>?pid=<playerId>
```

- **slug**: Lowercase, hyphen-separated, alphanumeric only
- **pid**: Stable player identifier (URL-encoded)

### Examples

| Player Name             | Generated URL                                                   |
| ----------------------- | --------------------------------------------------------------- |
| LeBron James            | `/profiles/lebron-james?pid=lebron_james`                       |
| Giannis Antetokounmpo   | `/profiles/giannis-antetokounmpo?pid=giannis_antetokounmpo`     |
| Shai Gilgeous-Alexander | `/profiles/shai-gilgeous-alexander?pid=shai_gilgeous_alexander` |

## Behavior

### Table (/players)

- **Name click**: Navigates to `/profiles/<slug>?pid=<id>`
- **Row click (non-name)**: Toggles drawer overlay (unchanged)
- **Add button**: Works as before

### Profile (/profiles)

- **With `?pid=<id>`**: Auto-selects player on load
- **Without query param**: Works as before (manual selection)

## Validation Checklist

| Test                                           | Status |
| ---------------------------------------------- | ------ |
| Click player name → navigates to correct URL   | ✅     |
| Profile loads correct player from `pid`        | ✅     |
| Row expand/collapse works on non-name areas    | ✅     |
| Table renders correctly after 5 hard refreshes | ✅     |
| Build succeeds                                 | ✅     |
| No console errors                              | ✅     |

## Files Changed

```
src/shared/utils/routing/playerRouteUtils.js     (NEW)
src/features/table/PlayerTable/PlayerRow/index.jsx
src/pages/PlayerProfileView.jsx
```

## Routing Entrypoint Notes

- **Route definition**: `/profiles` maps to `<PlayerProfileView />` in [src/App.jsx](src/App.jsx#L23)
- **Page component**: [src/pages/PlayerProfileView.jsx](src/pages/PlayerProfileView.jsx)
- **Data loading**: Uses `useSimplePlayerData` for list, `usePlayerDetail(selectedPlayer)` for full player
- **Selection state**: Managed via `selectedPlayer` state, set by dropdowns, search, or URL param
