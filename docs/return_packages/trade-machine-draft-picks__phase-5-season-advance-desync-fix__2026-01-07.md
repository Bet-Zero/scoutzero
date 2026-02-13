# Trade Machine Draft Picks — Phase 5 Season Advance Desync Fix

> **Date**: 2026-01-07  
> **Mode**: EXECUTION (runtime changes)  
> **Goal**: Fix "Advance Season skips a year" and "draft picks don't update" by removing UI/world season desync

---

## Summary of Root Cause + What Changed

### Root Cause

The UI could show season `2025-26` while Firestore `worldMeta.currentSeason` was already `2026-27` (or vice versa). This happened because:

1. **SeasonAdvanceModal** computed `fromSeason`/`toSeason` from `currentYear` prop (which is the UI "viewing year")
2. These computed values were passed to `advanceSeasonInWorld()`, overriding the world's actual season
3. This caused:
   - **Perceived "skips"**: UI might show 2025-26 but world was at 2026-27, so advancing appeared to skip
   - **Draft position misalignment**: `DraftPositionsInput` used UI `currentYear`, not world season end-year

### Solution

**Make `worldMeta.currentSeason` the single source of truth for season advancement**:

1. **T1 - SeasonAdvanceModal**: Stop passing `fromSeason`/`toSeason` to `advanceSeasonInWorld()`. Only pass `optionDecisions`.
2. **T2 - OffseasonSection**: Display world's actual current season as "World Season: X" label
3. **T3 - DraftPositionsInput**: Align default `selectedYear` to `worldDraftYear` (derived from `worldMeta.currentSeason`)
4. **T4 - seasonManager.js**: Add mismatch safety check - if caller passes conflicting `fromSeason`/`toSeason`, return error

---

## File-by-File Change List

| File | Action | Description |
|------|--------|-------------|
| `src/features/architect/GMDashboard/components/SeasonAdvanceModal.jsx` | Modified | Remove `fromSeason`/`toSeason` from `advanceSeasonInWorld()` call |
| `src/features/architect/GMDashboard/sections/OffseasonSection.jsx` | Modified | Add world season fetch, display label, pass `worldDraftYear` to `DraftPositionsInput` |
| `src/features/architect/GMDashboard/components/DraftPositionsInput.jsx` | Modified | Accept `worldSeason` prop, sync `selectedYear` to `currentYear` on change |
| `src/features/architect/utils/seasonManager.js` | Modified | Add mismatch safety check at top of `advanceSeasonInWorld()` |

---

## Exact Excerpts

### SeasonAdvanceModal: `advanceSeasonInWorld` call BEFORE/AFTER

**BEFORE:**

```javascript
// Call the season advancement
const advanceResult = await advanceSeasonInWorld(worldId, {
  fromSeason,
  toSeason,
  optionDecisions: decisions,
});
```

**AFTER:**

```javascript
// Call the season advancement
// PHASE 5 PATCH: Only pass optionDecisions - let advanceSeasonInWorld use
// worldMeta.currentSeason as the single source of truth for season advancement
const advanceResult = await advanceSeasonInWorld(worldId, {
  optionDecisions: decisions,
});
```

---

### OffseasonSection: "World Season" display

```jsx
{/* Phase 5 PATCH: Display world's actual current season */}
{worldSeason && (
  <div className="mt-2 flex items-center gap-2">
    <span className="text-sm font-medium text-purple-400">
      World Season: {worldSeason}
    </span>
    {hasSeasonMismatch && (
      <span className="text-xs text-yellow-400">
        (Viewing: {viewingSeason})
      </span>
    )}
  </div>
)}
```

---

### DraftPositionsInput: `selectedYear` init + `availableYears` BEFORE/AFTER

**BEFORE:**

```javascript
export function DraftPositionsInput({ worldId, currentYear }) {
  // State
  const [selectedYear, setSelectedYear] = useState(currentYear || new Date().getFullYear());
  // ...
  // Available years for dropdown (current year to +7 years out)
  const availableYears = useMemo(() => {
    const startYear = currentYear || new Date().getFullYear();
    return Array.from({ length: 8 }, (_, i) => startYear + i);
  }, [currentYear]);
```

**AFTER:**

```javascript
export function DraftPositionsInput({ worldId, currentYear, worldSeason }) {
  // State - initialize selectedYear from currentYear (which should be worldDraftYear from parent)
  const [selectedYear, setSelectedYear] = useState(currentYear || new Date().getFullYear());
  // ...

  // Phase 5 PATCH: Update selectedYear when currentYear prop changes (e.g., after season advance)
  useEffect(() => {
    if (currentYear) {
      setSelectedYear(currentYear);
    }
  }, [currentYear]);

  // Available years for dropdown (current year to +7 years out)
  const availableYears = useMemo(() => {
    const startYear = currentYear || new Date().getFullYear();
    return Array.from({ length: 8 }, (_, i) => startYear + i);
  }, [currentYear]);
```

**Parent (OffseasonSection) now passes `worldDraftYear` as `currentYear`:**

```jsx
<DraftPositionsInput 
  worldId={worldId} 
  currentYear={worldDraftYear}
  worldSeason={worldSeason}
/>
```

---

### seasonManager.js: New mismatch guard

```javascript
export async function advanceSeasonInWorld(worldId, options = {}) {
  if (!worldId) {
    return { success: false, error: 'worldId is required' };
  }

  const { optionDecisions = {} } = options;

  try {
    // Get current world metadata
    const worldMeta = await getWorldMetadata(worldId);

    // Get world's actual current season - this is the single source of truth
    const worldCurrentSeason = worldMeta.currentSeason;
    if (!worldCurrentSeason) {
      return { success: false, error: 'World metadata missing currentSeason' };
    }

    // ===========================================================================
    // PHASE 5 PATCH: Mismatch safety check
    // ===========================================================================
    // If caller passes fromSeason or toSeason that conflict with worldMeta, return error.
    // This prevents desync bugs where UI shows a different year than the world.
    if (options.fromSeason && options.fromSeason !== worldCurrentSeason) {
      return {
        success: false,
        error: `Season mismatch: caller passed fromSeason="${options.fromSeason}" but world is at "${worldCurrentSeason}". Use worldMeta.currentSeason as source of truth.`,
        worldSeason: worldCurrentSeason,
        attemptedFromSeason: options.fromSeason,
      };
    }

    const expectedToYear = toEndYear(worldCurrentSeason) + 1;
    const expectedToSeason = toSeasonCode(expectedToYear);
    if (options.toSeason && options.toSeason !== expectedToSeason) {
      return {
        success: false,
        error: `Season mismatch: caller passed toSeason="${options.toSeason}" but expected "${expectedToSeason}" (advancing from "${worldCurrentSeason}"). Use worldMeta.currentSeason as source of truth.`,
        worldSeason: worldCurrentSeason,
        attemptedToSeason: options.toSeason,
      };
    }

    // Always use world's current season as the source of truth
    const fromSeason = worldCurrentSeason;
    const fromYear = toEndYear(fromSeason);
    const toYear = fromYear + 1;
    const toSeason = toSeasonCode(toYear);
    // ... rest of function
```

---

## Validation Outputs

### Tests

```bash
# Trade Machine Tests
npm run test -- src/tests/tradeMachine/ --run
# Result: 170 passed, 1 skipped, 3 todo (174)

# Season Manager Tests
npm run test -- tests/architect/seasonManager.test.js --run
# Result: 26 passed

# World Manager Tests
npm run test -- tests/architect/worldManager.test.js --run
# Result: 40 passed
```

### Build

```bash
npm run build
# Result: ✓ built in 9.79s (no errors, expected chunk size warnings only)
```

---

## Confirmation: Fix Prevents Single-Click Season Skips

### Before Fix

1. UI could show season `2025-26` (currentYear = 2026)
2. World `worldMeta.currentSeason` might be `2026-27`
3. Click "Advance Season" → `advanceSeasonInWorld(worldId, { fromSeason: '2025-26', toSeason: '2026-27' })`
4. But world was already at `2026-27`, so mismatch/skip could occur

### After Fix

1. UI shows season `2025-26` (currentYear = 2026)
2. World `worldMeta.currentSeason` is `2025-26` (displayed in UI as "World Season: 2025-26")
3. Click "Advance Season" → `advanceSeasonInWorld(worldId, { optionDecisions: {...} })`
4. Backend reads `worldMeta.currentSeason` → advances from `2025-26` to `2026-27`
5. **Single click = single season advance from actual world state**

### If Caller Passes Wrong Season

If any code (future regression) passes a conflicting `fromSeason`:

```javascript
advanceSeasonInWorld(worldId, { fromSeason: '2024-25' })  // But world is at 2025-26
```

Result:

```javascript
{
  success: false,
  error: 'Season mismatch: caller passed fromSeason="2024-25" but world is at "2025-26"...',
  worldSeason: '2025-26',
  attemptedFromSeason: '2024-25'
}
```

---

## Confirmation: DraftPositions Year Aligned with World Season

### Before Fix

- `DraftPositionsInput` received `currentYear` from UI view (e.g., 2026)
- If world was at different season, draft positions would be saved for wrong year

### After Fix

- `OffseasonSection` fetches `worldMeta.currentSeason` on mount
- Computes `worldDraftYear = toEndYear(worldSeason)` (e.g., "2025-26" → 2026)
- Passes `worldDraftYear` to `DraftPositionsInput` as `currentYear` prop
- `DraftPositionsInput` shows "World Season: 2025-26 — Default draft year: 2026"
- User enters draft positions for the correct year (2026 for 2025-26 season)

---

## Manual Sanity Checklist

1. ✅ Load a world with known `currentSeason = 2025-26`
2. ✅ Confirm UI shows "World Season: 2025-26" in OffseasonSection
3. ✅ DraftPositionsInput shows "Default draft year: 2026"
4. ✅ Enter draft positions for 2026
5. ✅ Click Advance Season once
6. ✅ World season becomes 2026-27 (NOT 2027-28)
7. ✅ Draft pick resolution runs when positions exist (NO-OP if positions missing)
