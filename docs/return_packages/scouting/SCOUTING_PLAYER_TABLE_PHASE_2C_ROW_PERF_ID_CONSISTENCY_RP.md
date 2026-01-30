# SCOUTING PLAYER TABLE — Phase 2C Return Package

**DATE**: 2026-01-29  
**VERSION**: 1.0.0  
**STATUS**: ✅ COMPLETE

---

## 1. SUMMARY

Phase 2C implemented **row performance optimization** and **ID consistency** for the `/players` table:

- **Memoized PlayerRow** using `React.memo` with a custom comparator matching react-window's `areEqual` pattern
- **Standardized player ID extraction** via a new `getPlayerId(player)` helper used everywhere (Row, DrawerOverlay, toggle handlers)
- **Fixed sort edge cases** for NaN/null fields in `sortPlayers` to prevent sorting issues with incomplete player data

---

## 2. FILES CHANGED

| File                                                 | Change Type | Purpose                                                                                       |
| ---------------------------------------------------- | ----------- | --------------------------------------------------------------------------------------------- |
| `src/shared/utils/getPlayerId.js`                    | **NEW**     | Single source of truth for player ID extraction                                               |
| `src/features/table/PlayerTable/PlayerRow/index.jsx` | MODIFIED    | Wrapped export in `React.memo` with custom areEqual comparator                                |
| `src/features/table/PlayerTable/index.jsx`           | MODIFIED    | Import `getPlayerId`; use in Row component and DrawerOverlay                                  |
| `src/shared/utils/filtering/playerFilterUtils.js`    | MODIFIED    | Added safe defaults for `height`, `weight`, `age`, `yearsRemaining`, `overall` to prevent NaN |

---

## 3. KEY DIFFS

### 3.1 New Helper: `getPlayerId.js`

**Path**: `src/shared/utils/getPlayerId.js`

```javascript
export function getPlayerId(player) {
  if (!player) return null;
  return player.id || player.bio?.playerId || null;
}

export default getPlayerId;
```

### 3.2 Memoization: `PlayerRow/index.jsx`

**Path**: `src/features/table/PlayerTable/PlayerRow/index.jsx` (lines 236-248)

```jsx
/**
 * Memoized PlayerRow for react-window.
 * Uses react-window's areEqual comparison pattern for optimal virtualization perf.
 * Row only rerenders when player data, isExpanded, or onToggleExpand changes.
 */
const MemoizedPlayerRow = React.memo(PlayerRow, (prevProps, nextProps) => {
  // react-window areEqual pattern: return true if props are equal (skip rerender)
  return (
    prevProps.isExpanded === nextProps.isExpanded &&
    prevProps.player === nextProps.player &&
    prevProps.onToggleExpand === nextProps.onToggleExpand
  );
});

export default MemoizedPlayerRow;
```

### 3.3 ID Consistency: `PlayerTable/index.jsx`

**Path**: `src/features/table/PlayerTable/index.jsx`

Import added (line 29):

```jsx
import getPlayerId from '@/shared/utils/getPlayerId';
```

Row component (lines 32-36):

```jsx
const Row = ({ index, style, data }) => {
  const { players, expandedPlayerId, toggleExpand } = data;
  const player = players[index];
  const playerId = getPlayerId(player);
  const isExpanded = expandedPlayerId === playerId;
  // ...
  onToggleExpand={() => toggleExpand(playerId)}
```

DrawerOverlay (line 66):

```jsx
const index = players.findIndex((p) => getPlayerId(p) === expandedPlayerId);
```

### 3.4 Sort Safety: `playerFilterUtils.js`

**Path**: `src/shared/utils/filtering/playerFilterUtils.js` (lines 303-348)

```javascript
case 'height':
  // Safe default: treat missing height as -1 (sorts to bottom)
  return typeof player.heightInInches === 'number' ? player.heightInInches : -1;
case 'weight':
  // Safe default: treat missing weight as -1 (sorts to bottom)
  return typeof player.weight === 'number' ? player.weight : -1;
case 'age':
  // Safe default: treat missing age as -1 (sorts to bottom)
  return typeof player.age === 'number' ? player.age : -1;
case 'yearsRemaining': {
  const faYear = player.freeAgentYear || player.bio?.display?.freeAgentYear;
  const parsed = parseInt(faYear, 10);
  // Safe default: NaN check to prevent NaN arithmetic
  return !isNaN(parsed) ? parsed - 2024 : -1;
}
case 'overall': {
  // Safe default: parseFloat can return NaN, use -1 as fallback
  const grade = parseFloat(player.overallGrade);
  return isNaN(grade) ? -1 : grade;
}
```

---

## 4. VALIDATION STATUS

| Check                    | Result                                                    |
| ------------------------ | --------------------------------------------------------- |
| `npm run build`          | ✅ Passes (30.43s)                                        |
| TypeScript/ESLint errors | ✅ None in changed files                                  |
| Chunk warnings           | ⚠️ Pre-existing (>500KB chunk — unrelated to this change) |

---

## 5. MANUAL TEST CHECKLIST

| Test                               | Expected                       | Pass? |
| ---------------------------------- | ------------------------------ | ----- |
| Load `/players`, hard refresh 5×   | List always renders            | ☐     |
| Open drawer → change sort order    | Drawer resets or stays correct | ☐     |
| Open drawer → apply filter         | Drawer resets or stays correct | ☐     |
| Open drawer → clear filter         | Drawer resets or stays correct | ☐     |
| Fast scroll through player list    | No jank, smooth scrolling      | ☐     |
| Sort by height (with missing data) | No NaN issues, sorts cleanly   | ☐     |
| Sort by age (with missing data)    | No NaN issues, sorts cleanly   | ☐     |

---

## 6. DISCREPANCIES vs PASTED RP

**None found.** All claimed changes were verified in-repo:

- ✅ `getPlayerId` helper exists at claimed path with expected implementation
- ✅ `MemoizedPlayerRow` wrapper exists with areEqual comparator
- ✅ `getPlayerId` imported and used in Row + DrawerOverlay
- ✅ Sort safety guards added for `height`, `weight`, `age`, `yearsRemaining`, `overall`

---

## 7. RELATED DOCS

- Master Audit: [`docs/scouting/SCOUTING_PLAYER_TABLE_MASTER_AUDIT.md`](../../scouting/SCOUTING_PLAYER_TABLE_MASTER_AUDIT.md)
- Phase 2A (Profile Nav): [`SCOUTING_PLAYER_TABLE_PHASE_2A_PROFILE_NAV_RP.md`](./SCOUTING_PLAYER_TABLE_PHASE_2A_PROFILE_NAV_RP.md)
- Phase 2B (Sticky Header): Applied inline in Phase 2 execution
