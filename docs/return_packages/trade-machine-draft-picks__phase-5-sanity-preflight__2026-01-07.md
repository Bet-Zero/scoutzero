# Trade Machine Draft Picks — Phase 5 Sanity Preflight

**Date:** 2026-01-07  
**Mode:** PREFLIGHT (repo inspection + grep + small readouts ONLY; NO code changes)  
**Goal:** Verify Phase 5 auto-resolution wiring uses the correct draftYear and positionsMap during season advance.

---

## 1. Finding Summary

| Check | Status | Notes |
|-------|--------|-------|
| Off-by-one risk | ✅ **PASS** | `draftYear = fromYear` correctly resolves the draft that just happened |
| positionsMap loaded for correct year | ✅ **PASS** | Uses `fromYear` (end year of current season) |
| Ordering hazard | ✅ **PASS** | Conveyance → Swaps order is correct |
| Storage overwrites | ✅ **PASS** | Uses `updateDoc()` with dot notation (merge behavior) |

**Overall: ✅ SAFE — No off-by-one bugs detected.**

---

## 2. DraftYear Determination

### Variable Flow in `advanceSeasonInWorld()`

Location: `src/features/architect/utils/seasonManager.js:453-569`

```javascript
// Line 465-472: Determine from/to seasons
const fromSeason = options.fromSeason || worldMeta.currentSeason;  // e.g., "2025-26"
const fromYear = toEndYear(fromSeason);  // e.g., 2026
const toYear = fromYear + 1;             // e.g., 2027
const toSeason = options.toSeason || toSeasonCode(toYear);  // e.g., "2026-27"

// Line 478-480: Load positions for the draft that just happened
// When advancing from 2025-26 to 2026-27, we're passing the 2026 draft.
const draftYear = fromYear;  // Correctly uses fromYear (2026)
const positionsMap = await getDraftPositionsMap(worldId, draftYear);
```

### Example: Advancing from "2025-26" → "2026-27"

| Variable | Value | Explanation |
|----------|-------|-------------|
| `fromSeason` | "2025-26" | Current season being completed |
| `fromYear` | 2026 | End year of current season (via `toEndYear()`) |
| `toYear` | 2027 | Next calendar year |
| `toSeason` | "2026-27" | Target season |
| `draftYear` | **2026** | Correctly resolves the 2026 draft that just happened |

**Verdict:** ✅ Correct. The code resolves the 2026 draft (correct) NOT the 2027 draft (wrong).

---

## 3. Guardrails / NO-OP Proof

### Guard Conditions

**Location 1:** `processTeamSeasonTransitionWithOptions()` at line 612

```javascript
if (positionsMap && draftYear && Object.keys(positionsMap).length > 0) {
  // Only then proceed with resolution
}
```

**Location 2:** `resolveDraftPickSwapsForYear()` at line 1063-1066

```javascript
// Return team unchanged if no positions provided (NO-OP)
if (!positionsMap || typeof positionsMap !== 'object' || Object.keys(positionsMap).length === 0) {
  return team;
}
```

**Location 3:** `resolveDraftPickConveyanceForYear()` at line 1151-1154

```javascript
// Return team unchanged if no positions provided (NO-OP)
if (!positionsMap || typeof positionsMap !== 'object' || Object.keys(positionsMap).length === 0) {
  return team;
}
```

**Additional Guards:**

- Both functions also check for `!team?.draftPicks || !Array.isArray(team.draftPicks)` (lines 1069-1071, 1157-1159)
- Both skip picks not matching `draftYear` (lines 1090, 1178)
- Both skip already-resolved picks (lines 1095-1097, 1188-1190)

**Verdict:** ✅ Complete NO-OP protection when positionsMap is absent/empty.

---

## 4. Ordering (Conveyance vs Swaps)

### Order in Code

Location: `src/features/architect/utils/seasonManager.js:606-681`

```javascript
// Line 606-609: Comment explains ordering rationale
// ===========================================================================
// PHASE 5: Auto-resolve draft picks BEFORE other processing
// ===========================================================================
// Resolution order: conveyance first, then swaps
// This ensures that rolled picks are properly tracked before swap resolution

// Line 618-624: FIRST - Conveyance resolution
const afterConveyance = resolveDraftPickConveyanceForYear(
  updatedTeam,
  draftYear,
  positionsMap,
  resolutionOpts
);

// Line 650-656: SECOND - Swap resolution
const afterSwaps = resolveDraftPickSwapsForYear(
  updatedTeam,  // Note: updatedTeam.draftPicks already updated from afterConveyance
  draftYear,
  positionsMap,
  resolutionOpts
);
```

### Rationale (from code comment)

> "This ensures that rolled picks are properly tracked before swap resolution"

The flow is:

1. Conveyance resolution (determines if pick conveyed, rolled forward, or converted)
2. Swap resolution (determines best_of/worst_of outcomes based on final positions)

**Verdict:** ✅ Correct order. Conveyance must happen first so rolled/converted picks are tracked before swap evaluation.

---

## 5. Storage Read/Write Shape

### worldManager.js Functions

**`getDraftPositionsMap(worldId, draftYear)`** (line 548-551)

```javascript
export async function getDraftPositionsMap(worldId, draftYear) {
  const data = await getDraftPositions(worldId, draftYear);
  return data?.positionsMap || null;  // Returns null if year missing
}
```

**`getDraftPositions(worldId, draftYear)`** (line 526-538)

```javascript
const metadata = await getWorldMetadata(worldId);
const yearData = metadata?.draftPositionsByYear?.[draftYear];

if (!yearData || !yearData.positionsMap) {
  return null;  // Returns null if draftPositionsByYear or year missing
}
return yearData;
```

**`saveDraftPositions(worldId, draftYear, positionsMap, options)`** (line 618-652)

```javascript
// Uses updateDoc with dot notation (MERGE behavior, not overwrite)
await updateDoc(metadataRef, {
  [`draftPositionsByYear.${draftYear}`]: {
    positionsMap,
    method,
    updatedAtIso: new Date().toISOString(),
  },
  lastModifiedAt: serverTimestamp(),
});
```

### Firestore Field Paths

| Operation | Path | Behavior |
|-----------|------|----------|
| Read | `worlds/{worldId}` → `metadata.draftPositionsByYear[draftYear].positionsMap` | Returns null if missing |
| Write | `worlds/{worldId}` → `draftPositionsByYear.${draftYear}` | **Merge** (dot notation in `updateDoc`) |
| Clear | `worlds/{worldId}` → `draftPositionsByYear.${draftYear}` = null | Sets to null |

**`validateDraftPositionsMap(positionsMap)`** (line 559-602)

Validation rules:

- Must be non-null object
- Cannot be empty
- Team codes must match `/^[A-Z]{3}$/` (3 uppercase letters)
- Positions must be integers 1-60
- No duplicate positions allowed

**Verdict:** ✅ Safe. Uses `updateDoc()` with dot notation which preserves sibling fields (true merge behavior).

---

## 6. UI Wiring Confirmation

### Where Component Renders

**Location:** `src/features/architect/GMDashboard/sections/OffseasonSection.jsx:94-99`

```jsx
{/* Phase 5: Draft Positions Input */}
{worldId && (
  <div className="mb-6">
    <DraftPositionsInput worldId={worldId} currentYear={currentYear} />
  </div>
)}
```

### Props Received

| Prop | Source | Purpose |
|------|--------|---------|
| `worldId` | `OffseasonSection` prop | World to save positions for |
| `currentYear` | `OffseasonSection` prop | Default year for dropdown |

### Save Path

`DraftPositionsInput.jsx` line 151:

```javascript
const result = await saveDraftPositions(worldId, selectedYear, positionsMap, {
  method: 'manual',
});
```

**Flow:**

1. User enters JSON in component
2. Component calls `validateDraftPositionsMap()` from worldManager
3. Component calls `saveDraftPositions()` from worldManager
4. worldManager writes to Firestore with merge behavior

**Verdict:** ✅ UI correctly wired. Direct call to worldManager (no intermediate hook).

---

## 7. Grep Outputs

### Draft positions storage/read

```
$ grep -rn "draftPositionsByYear" src/

src/features/architect/utils/worldManager.js:517: * `draftPositionsByYear: { [year: number]: { positionsMap: { [teamCode: string]: number }, method: 'manual', updatedAtIso: string } }`
src/features/architect/utils/worldManager.js:532:  const yearData = metadata?.draftPositionsByYear?.[draftYear];
src/features/architect/utils/worldManager.js:609: * `draftPositionsByYear.{year}.positionsMap`
src/features/architect/utils/worldManager.js:640:      [`draftPositionsByYear.${draftYear}`]: {
src/features/architect/utils/worldManager.js:677:      [`draftPositionsByYear.${draftYear}`]: null,
src/features/architect/utils/seasonManager.js:16: *                         - Reads positionsMap from world.draftPositionsByYear
src/tests/tradeMachine/phase5DraftPositions.test.js:9: * - Data model validation for draftPositionsByYear
```

```
$ grep -rn "getDraftPositionsMap" src/

src/features/architect/utils/seasonManager.js:22:import { getWorldMetadata, getDraftPositionsMap } from '@/features/architect/utils/worldManager';
src/features/architect/utils/seasonManager.js:480:    const positionsMap = await getDraftPositionsMap(worldId, draftYear);
src/features/architect/utils/worldManager.js:548:export async function getDraftPositionsMap(worldId, draftYear) {
```

```
$ grep -rn "saveDraftPositions" src/

src/features/architect/GMDashboard/components/DraftPositionsInput.jsx:11: *  - worldManager.js: getDraftPositions, saveDraftPositions, validateDraftPositionsMap
src/features/architect/GMDashboard/components/DraftPositionsInput.jsx:19:  saveDraftPositions,
src/features/architect/GMDashboard/components/DraftPositionsInput.jsx:151:      const result = await saveDraftPositions(worldId, selectedYear, positionsMap, {
src/features/architect/utils/worldManager.js:618:export async function saveDraftPositions(worldId, draftYear, positionsMap, options = {}) {
src/features/architect/utils/worldManager.js:650:    console.error('saveDraftPositions failed:', error);
```

### Season advance year selection

```
$ grep -rn "advanceSeasonInWorld" src/features/architect/utils/seasonManager.js

src/features/architect/utils/seasonManager.js:11: *  - 2025-12-20: Phase 3B - Added advanceSeasonInWorld with explicit option decisions
src/features/architect/utils/seasonManager.js:453:export async function advanceSeasonInWorld(worldId, options = {}) {
src/features/architect/utils/seasonManager.js:563:    console.error('advanceSeasonInWorld failed:', error);
```

```
$ grep -rn "draftYear\|fromYear" src/features/architect/utils/seasonManager.js

src/features/architect/utils/seasonManager.js:470:    const fromYear = toEndYear(fromSeason);
src/features/architect/utils/seasonManager.js:471:    const toYear = fromYear + 1;
src/features/architect/utils/seasonManager.js:478:    // Load positions for fromYear (the draft that just happened).
src/features/architect/utils/seasonManager.js:479:    const draftYear = fromYear;
src/features/architect/utils/seasonManager.js:480:    const positionsMap = await getDraftPositionsMap(worldId, draftYear);
src/features/architect/utils/seasonManager.js:502:      // Phase 5: Also pass positionsMap + draftYear for auto-resolution
src/features/architect/utils/seasonManager.js:508:        { positionsMap, draftYear }
src/features/architect/utils/seasonManager.js:559:        ? { draftYear, hadPositions: true, resolvedConveyances: summary.conveyanceResolutions.length, resolvedSwaps: summary.swapResolutions.length }
src/features/architect/utils/seasonManager.js:560:        : { draftYear, hadPositions: false },
src/features/architect/utils/seasonManager.js:580: * @param {number} [resolutionContext.draftYear] - Draft year to resolve
src/features/architect/utils/seasonManager.js:610:  const { positionsMap, draftYear } = resolutionContext;
src/features/architect/utils/seasonManager.js:612:  if (positionsMap && draftYear && Object.keys(positionsMap).length > 0) {
src/features/architect/utils/seasonManager.js:621:      draftYear,
src/features/architect/utils/seasonManager.js:653:      draftYear,
src/features/architect/utils/seasonManager.js:788:  const fromYear = toEndYear(fromSeason);
src/features/architect/utils/seasonManager.js:1055: * @param {number} draftYear - Year to resolve swaps for
src/features/architect/utils/seasonManager.js:1062:export function resolveDraftPickSwapsForYear(team, draftYear, positionsMap, opts = {}) {
src/features/architect/utils/seasonManager.js:1090:    if (pick.year !== draftYear) {
src/features/architect/utils/seasonManager.js:1137: * - no picks match the specified draftYear with conveyance conditions
src/features/architect/utils/seasonManager.js:1143: * @param {number} draftYear - Year to resolve conveyance for
src/features/architect/utils/seasonManager.js:1150:export function resolveDraftPickConveyanceForYear(team, draftYear, positionsMap, opts = {}) {
src/features/architect/utils/seasonManager.js:1178:    if (pick.year !== draftYear) {
src/features/architect/utils/seasonManager.js:1194:      return resolveConveyanceForPick(pick, positionsMap, { draftYear, nowIso, method });
```

### Resolution calls

```
$ grep -rn "resolveDraftPickConveyanceForYear" src/features/architect/utils/seasonManager.js

src/features/architect/utils/seasonManager.js:619:    const afterConveyance = resolveDraftPickConveyanceForYear(
src/features/architect/utils/seasonManager.js:1150:export function resolveDraftPickConveyanceForYear(team, draftYear, positionsMap, opts = {}) {
```

```
$ grep -rn "resolveDraftPickSwapsForYear" src/features/architect/utils/seasonManager.js

src/features/architect/utils/seasonManager.js:14: *  - 2026-01-04: Phase 3 - Added resolveDraftPickSwapsForYear for swap resolution
src/features/architect/utils/seasonManager.js:651:    const afterSwaps = resolveDraftPickSwapsForYear(
src/features/architect/utils/seasonManager.js:1062:export function resolveDraftPickSwapsForYear(team, draftYear, positionsMap, opts = {}) {
src/features/architect/utils/seasonManager.js:1139: * This function mirrors the pattern of resolveDraftPickSwapsForYear()
```

### UI presence

```
$ grep -rn "DraftPositionsInput" src/features/architect/GMDashboard/

src/features/architect/GMDashboard/sections/OffseasonSection.jsx:5: *          Phase 5: Added DraftPositionsInput for real draft results input.
src/features/architect/GMDashboard/sections/OffseasonSection.jsx:11: *  - 2026-01-07: Phase 5 - Added DraftPositionsInput for entering draft positions.
src/features/architect/GMDashboard/sections/OffseasonSection.jsx:20:import { SeasonAdvanceModal, DraftPositionsInput } from '@/features/architect/GMDashboard/components';
src/features/architect/GMDashboard/sections/OffseasonSection.jsx:97:          <DraftPositionsInput worldId={worldId} currentYear={currentYear} />
src/features/architect/GMDashboard/components/index.js:10: *  - 2026-01-07: Added DraftPositionsInput for Phase 5
src/features/architect/GMDashboard/components/index.js:16: *  - DraftPositionsInput: ./DraftPositionsInput.jsx
src/features/architect/GMDashboard/components/index.js:22:export { DraftPositionsInput } from './DraftPositionsInput';
src/features/architect/GMDashboard/components/DraftPositionsInput.jsx:2: * FILE: src/features/architect/GMDashboard/components/DraftPositionsInput.jsx
src/features/architect/GMDashboard/components/DraftPositionsInput.jsx:42: * DraftPositionsInput - Minimal UI for entering draft positions JSON
src/features/architect/GMDashboard/components/DraftPositionsInput.jsx:48:export function DraftPositionsInput({ worldId, currentYear }) {
src/features/architect/GMDashboard/components/DraftPositionsInput.jsx:305:DraftPositionsInput.propTypes = {
src/features/architect/GMDashboard/components/DraftPositionsInput.jsx:310:DraftPositionsInput.defaultProps = {
src/features/architect/GMDashboard/components/DraftPositionsInput.jsx:314:export default DraftPositionsInput;
```

---

## 8. Next-Step Recommendation

**Status: ✅ SAFE**

No code changes required. The Phase 5 implementation correctly:

1. Uses `fromYear` (end year of current season) as `draftYear` — resolves the correct draft
2. Has comprehensive NO-OP guards for missing/empty positionsMap
3. Orders resolution correctly: conveyance → swaps
4. Uses merge-safe Firestore writes (dot notation in `updateDoc`)
5. Exposes UI in correct location with proper props

**Optional Enhancements (not required):**

- Add unit test specifically verifying `draftYear = fromYear` mapping in advanceSeasonInWorld
- Add integration test with mock world advancing from "2025-26" → "2026-27" verifying 2026 positions are used

---

*Generated by Phase 5 Sanity Preflight — 2026-01-07*
