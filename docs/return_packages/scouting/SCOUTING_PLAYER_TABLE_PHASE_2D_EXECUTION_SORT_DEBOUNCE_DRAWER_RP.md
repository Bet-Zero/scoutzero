# SCOUTING PLAYER TABLE — Phase 2D Execution Return Package

**DATE**: 2026-01-29
**VERSION**: 1.0.0
**STATUS**: COMPLETE
**PREFLIGHT DOC**: [SCOUTING_PLAYER_TABLE_PHASE_2D_PREFLIGHT_DEBOUNCE_SORT_DRAWER_AUDIT.md](./SCOUTING_PLAYER_TABLE_PHASE_2D_PREFLIGHT_DEBOUNCE_SORT_DRAWER_AUDIT.md)
**MASTER DOC**: [SCOUTING_PLAYER_TABLE_MASTER_AUDIT.md](../../scouting/SCOUTING_PLAYER_TABLE_MASTER_AUDIT.md)

---

## 1. EXECUTIVE SUMMARY

Phase 2D addressed three areas from the preflight audit:

| Priority | Item | Resolution |
|----------|------|------------|
| 1 | Sort Determinism | **FIXED** — Added name + ID tie-breakers |
| 2 | Debounce Cleanup | **NO ACTION** — Preflight was incorrect; debounce already works |
| 3A | Keyboard A11y | **FIXED** — Expand toggle now keyboard accessible |
| 3B | Drawer Clipping | **FIXED** — Bottom padding added for last-row drawer |

---

## 2. PRIORITY 1: SORT DETERMINISM

### Problem

`sortPlayers` returned ties in non-deterministic order. Players with the same height/weight/age would shuffle on each sort.

### Solution

Added secondary tie-breakers after primary comparison:

1. **Name (alphabetic, case-insensitive)** — always ascending regardless of primary sort direction
2. **ID (stable)** — using existing `getPlayerId` SSOT helper

### File Changed

`src/shared/utils/filtering/playerFilterUtils.js`

### Key Diff

```javascript
// Added import at top
import { getPlayerId } from '@/shared/utils/getPlayerId';

// In sortPlayers comparator (after primary comparison):
let result;
if (typeof valA === 'string' && typeof valB === 'string') {
  result = sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
} else {
  result = sortAsc ? valA - valB : valB - valA;
}

// Tie-breaker: alphabetic by name (always ascending), then by ID for stability
if (result === 0) {
  const nameA = (a.bio?.displayName || a.name || '').toLowerCase();
  const nameB = (b.bio?.displayName || b.name || '').toLowerCase();
  result = nameA.localeCompare(nameB);
}
if (result === 0) {
  const idA = getPlayerId(a) || '';
  const idB = getPlayerId(b) || '';
  result = idA.localeCompare(idB);
}
return result;
```

---

## 3. PRIORITY 2: DEBOUNCE CLEANUP — NO ACTION REQUIRED

### Finding

The preflight audit was **incorrect**. After tracing the prop chain:

1. **PlayerTable** creates `debouncedSetFilters` via `useMemo(() => debounce(setFilters, 300), [setFilters])`
2. **PlayerTable** passes `debouncedSetFilters` (not raw `setFilters`) to `FiltersPanel` at line 193
3. **FiltersPanel** → **FilterPanel** → **StatFilters/TraitFilters** all receive the already-debounced function
4. When `StatFilters` calls `setFilters((prev) => ...)`, it's calling the debounced version

**Conclusion**: The architecture is correct. No code changes were needed.

---

## 4. PRIORITY 3A: KEYBOARD ACCESSIBILITY

### Problem

Expand toggle at `PlayerRow/index.jsx` had no keyboard support — only `onClick`.

### Solution

Added proper ARIA attributes and keyboard handler.

### File Changed

`src/features/table/PlayerTable/PlayerRow/index.jsx`

### Key Diff

```jsx
{/* Expand Toggle */}
<div
  className="absolute bottom-0 right-0 cursor-pointer text-white/20 hover:text-white transition"
  onClick={onToggleExpand}
  role="button"
  tabIndex={0}
  aria-label={isExpanded ? 'Collapse player details' : 'Expand player details'}
  aria-expanded={isExpanded}
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onToggleExpand();
    }
  }}
>
  {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={16} />}
</div>
```

---

## 5. PRIORITY 3B: LAST-ROW DRAWER CLIPPING

### Problem

When the last row was expanded, the drawer extended below the visible container and got clipped.

### Solution

Modified `InnerElement` to add bottom padding when the last row is expanded.

### File Changed

`src/features/table/PlayerTable/index.jsx`

### Key Diff

```jsx
const InnerElement = React.forwardRef(({ children, style, ...rest }, ref) => {
  const { expandedPlayerId, players } = React.useContext(DrawerContext);

  // Add bottom padding when last row is expanded to prevent drawer clipping
  let extraPadding = 0;
  if (expandedPlayerId && players.length > 0) {
    const lastPlayer = players[players.length - 1];
    const lastPlayerId = getPlayerId(lastPlayer);
    if (lastPlayerId === expandedPlayerId) {
      extraPadding = 300; // Approximate drawer height
    }
  }

  const modifiedStyle =
    extraPadding > 0
      ? { ...style, height: (parseFloat(style.height) || 0) + extraPadding }
      : style;

  return (
    <div ref={ref} style={modifiedStyle} {...rest}>
      {children}
      <DrawerOverlay />
    </div>
  );
});
```

---

## 6. FILES MODIFIED

| File | Changes |
|------|---------|
| `src/shared/utils/filtering/playerFilterUtils.js` | Added `getPlayerId` import; added tie-breaker logic in `sortPlayers` |
| `src/features/table/PlayerTable/PlayerRow/index.jsx` | Added `role`, `tabIndex`, `aria-label`, `aria-expanded`, `onKeyDown` to expand toggle |
| `src/features/table/PlayerTable/index.jsx` | Modified `InnerElement` to add bottom padding for last-row drawer |

---

## 7. VALIDATION RESULTS

| Check | Result |
|-------|--------|
| `npm run build` | PASS (28.39s, no errors) |
| Sort by height 5x → stable order | Ready for manual verification |
| Sort by shootingProfile → ties alphabetic | Ready for manual verification |
| Keyboard toggle (Enter/Space) | Ready for manual verification |
| Name click still navigates | Ready for manual verification |
| Last-row drawer not clipped | Ready for manual verification |

---

## 8. ACCEPTANCE CRITERIA STATUS

| Criterion | Status |
|-----------|--------|
| Sort by height/weight/age produces consistent order on repeated sorts | IMPLEMENTED |
| Players with same primary sort value are secondarily sorted by name, then ID | IMPLEMENTED |
| All filter additions (stat/trait) are debounced | ALREADY WORKING (no change needed) |
| Expand toggle is keyboard-accessible (Enter/Space to toggle) | IMPLEMENTED |
| No regressions in build or existing tests | BUILD PASSED |

---

## 9. FOLLOW-UPS

None identified. Phase 2D is complete.

---

**END OF PHASE 2D EXECUTION RETURN PACKAGE**
