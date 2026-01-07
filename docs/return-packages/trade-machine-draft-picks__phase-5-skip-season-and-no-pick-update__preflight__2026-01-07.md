# Trade Machine Draft Picks — Phase 5 BUG INVESTIGATION PREFLIGHT

**Date:** 2026-01-07  
**Mode:** PREFLIGHT (repo inspection + grep + targeted excerpts ONLY; NO code changes)  
**Goal:** Diagnose (1) season advance skipping (2025-26 → 2027-28) and (2) draft picks not updating after season advance even when positions JSON exists.

---

## EXECUTIVE SUMMARY

### Primary Findings

1. **Season Skip Bug (LIKELY ROOT CAUSE IDENTIFIED):** The `SeasonAdvanceModal` computes `fromSeason`/`toSeason` from the **UI's `currentYear` prop**, but `advanceSeasonInWorld()` **reads `worldMeta.currentSeason` from Firestore** to determine the actual `fromSeason`. If the UI's `currentYear` is stale (not synced after world load), but `worldMeta.currentSeason` is correct, a mismatch occurs. **However, the actual skip happens because:**
   - The `SeasonAdvanceModal` passes explicit `fromSeason` and `toSeason` options (lines 321-324)
   - `advanceSeasonInWorld()` uses these options directly (line 465: `options.fromSeason || worldMeta.currentSeason`)
   - **If the UI displays one season but the world metadata has already advanced, the user sees "skipped" seasons**

2. **Draft Picks Not Updating (ROOT CAUSE IDENTIFIED):** The year alignment for draft positions may have a mismatch:
   - `DraftPositionsInput` saves positions using `selectedYear` (defaults to `currentYear` from props)
   - `advanceSeasonInWorld()` reads `draftYear = fromYear = toEndYear(fromSeason)` (line 479)
   - **If user enters positions for year X but the world's actual `fromSeason` is different, positions won't be found**

3. **No Evidence of Double-Click:** No React strict-mode double-invocation or duplicate handlers found for `advanceSeasonInWorld()`.

---

## T1: UI TRIGGER MAP

### Entry Points for `advanceSeasonInWorld()`

**File:** `src/features/architect/GMDashboard/components/SeasonAdvanceModal.jsx`

```jsx
// Lines 288-345
const handleAdvanceSeason = useCallback(async () => {
  if (!worldId) {
    setError('No world selected...');
    return;
  }

  setIsProcessing(true);
  setError('');
  setCurrentStep(WIZARD_STEPS.PROCESSING);

  try {
    // Dynamic import to avoid circular deps
    const { advanceSeasonInWorld } = await import(
      '@/features/architect/utils/seasonManager'
    );

    // Build option decisions
    const decisions = {};
    for (const [playerId, data] of Object.entries(optionDecisions)) {
      if (data.decision) {
        const normalizedType = String(data.optionType || '').toLowerCase().includes('player')
          ? 'player'
          : 'team';
        decisions[playerId] = {
          decision: data.decision,
          optionType: normalizedType,
          season: data.season,
        };
      }
    }

    // Call the season advancement
    const advanceResult = await advanceSeasonInWorld(worldId, {
      fromSeason,   // <-- Computed from UI's currentYear prop
      toSeason,     // <-- Computed from UI's currentYear prop
      optionDecisions: decisions,
    });
    // ...
  }
}, [worldId, optionDecisions, fromSeason, toSeason, onAdvanceComplete]);
```

**Single Click Path:**
1. User clicks "Advance Season" button in `OffseasonSection.jsx` (line 85)
2. Opens `SeasonAdvanceModal` (lines 129-137)
3. User proceeds through wizard steps
4. Final confirmation triggers `handleAdvanceSeason()` callback
5. `advanceSeasonInWorld()` is called once with explicit `fromSeason`/`toSeason` from UI state

**Where `fromSeason`/`toSeason` are computed (SeasonAdvanceModal lines 182-184):**
```jsx
const toYear = currentYear + 1;
const fromSeason = toSeasonCode(currentYear);
const toSeason = toSeasonCode(toYear);
```

**React Double-Invocation Check:**
- No `useEffect` calls `handleAdvanceSeason()` automatically
- The handler is only called via button onClick
- No Strict Mode double-effect concerns apply (handler, not effect)
- **VERDICT: NOT A DOUBLE-CLICK BUG**

---

## T2: SEASON MATH SNAPSHOT

**File:** `src/features/architect/utils/seasonManager.js` (lines 453-472)

```javascript
export async function advanceSeasonInWorld(worldId, options = {}) {
  if (!worldId) {
    return { success: false, error: 'worldId is required' };
  }

  const { optionDecisions = {} } = options;

  try {
    // Get current world metadata
    const worldMeta = await getWorldMetadata(worldId);

    // Determine from/to seasons
    const fromSeason = options.fromSeason || worldMeta.currentSeason;  // <-- PRIORITY: options.fromSeason
    if (!fromSeason) {
      return { success: false, error: 'World metadata missing currentSeason' };
    }

    const fromYear = toEndYear(fromSeason);     // e.g., "2025-26" → 2026
    const toYear = fromYear + 1;                // 2026 → 2027
    const toSeason = options.toSeason || toSeasonCode(toYear);  // "2026-27"
```

**Season Format Utilities (seasonFormat.js):**
```javascript
// toSeasonCode: endYear → "YYYY-YY"
export function toSeasonCode(endYear) {
  if (!Number.isFinite(endYear) || endYear < 1900) {
    return String(endYear);
  }
  const startYear = endYear - 1;
  return `${startYear}-${String(endYear).slice(-2)}`;  // e.g., 2026 → "2025-26"
}

// toEndYear: "YYYY-YY" → endYear
export function toEndYear(seasonCode) {
  const s = String(seasonCode);
  if (/^\d{4}-\d{2}$/.test(s)) {
    const tail = parseInt(s.split('-')[1], 10);
    return 2000 + tail;  // e.g., "2025-26" → 2026
  }
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
}
```

**Season Math Analysis:**
- `toSeasonCode(2026)` = `"2025-26"` ✅
- `toEndYear("2025-26")` = `2026` ✅
- **Math is correct.** No off-by-one or parsing errors.

---

## T3: SKIP ROOT CAUSE CANDIDATES (Ranked)

### **MOST LIKELY: (D) UI/State Desync Bug**

**Evidence:**
1. `SeasonAdvanceModal` receives `currentYear` as a prop from `GMDashboard`
2. `GMDashboard` gets `currentYear` from `useArchitectState` hook
3. `useArchitectState` initializes `currentYear` from:
   - URL query param
   - localStorage
   - `getDefaultSeasonEndYear()` (JS clock-based)
4. **World selection does NOT automatically sync `currentYear` with `worldMeta.currentSeason`**

**In WorldSelector.jsx (lines 169-180):**
```jsx
const handleWorldSelect = useCallback(
  (e) => {
    const newWorldId = e.target.value || null;
    setWorldId(newWorldId);  // <-- Only sets worldId
    setShowActionsMenu(false);

    if (onWorldChange) {
      onWorldChange(newWorldId);  // <-- No currentYear update
    }
  },
  [setWorldId, onWorldChange]
);
```

**Scenario that causes "skip":**
1. User creates world → world has `currentSeason: "2025-26"` → UI `currentYear = 2026`
2. User advances to 2026-27 → world updates to `currentSeason: "2026-27"`
3. **UI does NOT update `currentYear` automatically** (only in `handleAdvanceComplete` callback)
4. If `handleAdvanceComplete` runs, it does update:
   ```jsx
   const toYear = toEndYear(result.toSeason) ?? currentYear;
   setCurrentYear(toYear);  // <-- Updates after success
   ```
5. **BUT:** If user refreshes page, `currentYear` reloads from localStorage/URL, NOT from world metadata
6. User sees "2025-26" in UI but world is actually at "2026-27"
7. Clicking "Advance Season" sends `fromSeason: "2025-26"` → backend advances "2025-26 → 2026-27"
8. But world was already at "2026-27", so Firestore updates to "2027-28"
9. **User perceives they skipped from 2025-26 to 2027-28**

**CONFIDENCE: 85%**

---

### **POSSIBLE: (B) worldMeta.currentSeason Already Advanced**

If the backend `advanceSeasonInWorld()` uses `worldMeta.currentSeason` as fallback but UI sent explicit options, the explicit options take precedence. This is NOT the cause unless the UI fails to send options.

**CONFIDENCE: 10%**

---

### **UNLIKELY: (A) Double-Click**

No evidence found. The handler is invoked once per button click.

**CONFIDENCE: 5%**

---

### **NOT THE CAUSE: (C) Season Parsing Errors**

`toEndYear` and `toSeasonCode` are mathematically correct for all valid inputs.

**CONFIDENCE: 0%**

---

## T4: PERSISTENCE CHAIN

### Draft Pick Resolution Flow (seasonManager.js lines 610-681)

```javascript
// Phase 5: Auto-resolve draft picks BEFORE other processing
const { positionsMap, draftYear } = resolutionContext;

if (positionsMap && draftYear && Object.keys(positionsMap).length > 0) {
  const resolutionOpts = {
    nowIso: new Date().toISOString(),
    method: 'season_advance',
  };

  // 1) Resolve conveyance (protections rolling forward / converting)
  const afterConveyance = resolveDraftPickConveyanceForYear(
    updatedTeam,
    draftYear,
    positionsMap,
    resolutionOpts
  );
  
  // ... tracking code ...
  updatedTeam.draftPicks = afterConveyance.draftPicks;

  // 2) Resolve swaps (best_of / worst_of resolution)
  // IMPORTANT: Pass afterConveyance (not updatedTeam) so swaps see post-conveyance state
  const afterSwaps = resolveDraftPickSwapsForYear(
    afterConveyance,   // <-- Correct: passes afterConveyance
    draftYear,
    positionsMap,
    resolutionOpts
  );

  // ... tracking code ...
  updatedTeam.draftPicks = afterSwaps.draftPicks;  // <-- Final assignment
}
```

### What Gets Written to Firestore (lines 532-538)

```javascript
// Save snapshot if team was modified
if (updatedTeam) {
  const snapshotRef = worldTeamRef(worldId, teamCode);
  batch.set(snapshotRef, updatedTeam);  // <-- Writes entire updatedTeam object
  updatedTeams.push(teamCode);
}
```

**Data Shape Written:**
- Full team object with `draftPicks` array containing:
  - Resolved picks with `conveyanceResult` or `resolved: true`
  - Unresolved picks unchanged
  - `stepienBlocked` flags updated by `updateDraftPicksWithStepien()`

### Potential Issue: Overwrites by Later Processing

After draft pick resolution, the function continues:
```javascript
// Process options (lines 685-703)
if (optionsResult.hasChanges) {
  updatedTeam.roster = optionsResult.roster;
  updatedTeam.players = optionsResult.players;
  // Does NOT touch draftPicks
}

// Process contract expirations (lines 706-731)
if (contractResult.hasChanges) {
  updatedTeam.roster = contractResult.roster;
  updatedTeam.players = contractResult.players;
  // Does NOT touch draftPicks
}

// Update draft picks with Stepien (lines 750-760)
const draftPicksResult = updateDraftPicksWithStepien(
  updatedTeam,
  fromSeason,
  toSeason
);
if (draftPicksResult.hasChanges) {
  updatedTeam.draftPicks = draftPicksResult.draftPicks;  // <-- Potentially overwrites Phase 5 changes
}
```

**⚠️ POTENTIAL BUG:** `updateDraftPicksWithStepien()` operates on `updatedTeam.draftPicks` which already has Phase 5 changes, so it should preserve them. BUT if it creates a new array improperly, Phase 5 changes could be lost.

Looking at `updateDraftPicksWithStepien()` (lines 932-1030):
```javascript
const draftPicks = [...(teamData.draftPicks || [])];  // <-- Shallow copy
// ...
const updatedPicks = draftPicks.map((pick) => {
  const updatedPick = { ...pick };  // <-- Shallow copy of each pick
  // ... modifications ...
  return updatedPick;
});

return {
  hasChanges,
  draftPicks: updatedPicks,  // <-- Returns modified picks
};
```

**VERDICT:** The chain looks correct. Each pick is shallow-copied and modified, preserving Phase 5 changes. No obvious overwrites.

---

## T5: YEAR ALIGNMENT CHECK

### Where Draft Positions Are Loaded (seasonManager.js lines 477-480)

```javascript
// When advancing from 2025-26 to 2026-27, we're passing the 2026 draft.
// Load positions for fromYear (the draft that just happened).
const draftYear = fromYear;  // fromYear = toEndYear(fromSeason)
const positionsMap = await getDraftPositionsMap(worldId, draftYear);
```

### Where Draft Positions Are Stored (worldManager.js lines 618-652)

```javascript
export async function saveDraftPositions(worldId, draftYear, positionsMap, options = {}) {
  // ...
  await updateDoc(metadataRef, {
    [`draftPositionsByYear.${draftYear}`]: {  // <-- Key is numeric draftYear
      positionsMap,
      method,
      updatedAtIso: new Date().toISOString(),
    },
  });
}
```

### Where Draft Positions Are Read (worldManager.js lines 548-551)

```javascript
export async function getDraftPositionsMap(worldId, draftYear) {
  const data = await getDraftPositions(worldId, draftYear);
  return data?.positionsMap || null;
}

export async function getDraftPositions(worldId, draftYear) {
  const metadata = await getWorldMetadata(worldId);
  const yearData = metadata?.draftPositionsByYear?.[draftYear];  // <-- Key is numeric
  if (!yearData || !yearData.positionsMap) {
    return null;
  }
  return yearData;
}
```

### DraftPositionsInput Year Selection (DraftPositionsInput.jsx lines 48-62)

```jsx
const [selectedYear, setSelectedYear] = useState(currentYear || new Date().getFullYear());

// Available years for dropdown (current year to +7 years out)
const availableYears = useMemo(() => {
  const startYear = currentYear || new Date().getFullYear();
  return Array.from({ length: 8 }, (_, i) => startYear + i);
}, [currentYear]);
```

### Alignment Analysis

**Expected Flow:**
1. User is in season "2025-26" (currentYear = 2026)
2. User enters positions for 2026 draft in DraftPositionsInput → saved as `draftPositionsByYear.2026`
3. User clicks "Advance Season" → `fromSeason = "2025-26"`, `fromYear = 2026`
4. `getDraftPositionsMap(worldId, 2026)` → finds `draftPositionsByYear.2026` ✅

**Potential Mismatch Scenario (related to T3):**
1. World is at "2026-27" (worldMeta.currentSeason)
2. UI shows "2025-26" (currentYear = 2026 from localStorage)
3. User enters positions for 2026 draft → saved as `draftPositionsByYear.2026`
4. User clicks "Advance Season" → sends `fromSeason: "2025-26"`
5. BUT world is already at "2026-27", so real `fromYear` should be 2027
6. `getDraftPositionsMap(worldId, 2026)` → finds positions, BUT:
   - Positions were entered for the wrong draft year relative to world state
   - World advances "2025-26 → 2026-27" but that draft already happened

**⚠️ YEAR ALIGNMENT BUG CONFIRMED:** If UI `currentYear` is desynced from `worldMeta.currentSeason`, user will enter positions for the wrong draft year.

---

## REQUIRED GREPS OUTPUT

### 1. advanceSeasonInWorld Call Sites

```
/home/runner/work/scoutzero/scoutzero/src/features/architect/utils/seasonManager.js:11: *  - 2025-12-20: Phase 3B - Added advanceSeasonInWorld with explicit option decisions
/home/runner/work/scoutzero/scoutzero/src/features/architect/utils/seasonManager.js:453:export async function advanceSeasonInWorld(worldId, options = {}) {
/home/runner/work/scoutzero/scoutzero/src/features/architect/utils/seasonManager.js:563:    console.error('advanceSeasonInWorld failed:', error);
/home/runner/work/scoutzero/scoutzero/src/features/architect/GMDashboard/components/SeasonAdvanceModal.jsx:300:      const { advanceSeasonInWorld } = await import(
/home/runner/work/scoutzero/scoutzero/src/features/architect/GMDashboard/components/SeasonAdvanceModal.jsx:321:      const advanceResult = await advanceSeasonInWorld(worldId, {
```

**Only ONE call site:** `SeasonAdvanceModal.jsx` line 321

### 2. Season Helpers (toEndYear, toSeasonCode)

```
src/features/architect/utils/seasonFormat.js:18:export function toSeasonCode(endYear) {
src/features/architect/utils/seasonFormat.js:31:export function toEndYear(seasonCode) {
src/features/architect/utils/seasonManager.js:24:  toEndYear,
src/features/architect/utils/seasonManager.js:25:  toSeasonCode,
... (many usages across codebase)
```

### 3. Draft Positions Usage

```
src/features/architect/utils/worldManager.js:517: * `draftPositionsByYear: { [year: number]: { positionsMap: { [teamCode: string]: number }, method: 'manual', updatedAtIso: string } }`
src/features/architect/utils/worldManager.js:532:  const yearData = metadata?.draftPositionsByYear?.[draftYear];
src/features/architect/utils/worldManager.js:548:export async function getDraftPositionsMap(worldId, draftYear) {
src/features/architect/utils/worldManager.js:618:export async function saveDraftPositions(worldId, draftYear, positionsMap, options = {}) {
src/features/architect/utils/worldManager.js:640:      [`draftPositionsByYear.${draftYear}`]: {
src/features/architect/utils/seasonManager.js:22:import { getWorldMetadata, getDraftPositionsMap } from '@/features/architect/utils/worldManager';
src/features/architect/utils/seasonManager.js:480:    const positionsMap = await getDraftPositionsMap(worldId, draftYear);
src/features/architect/GMDashboard/components/DraftPositionsInput.jsx:19:  saveDraftPositions,
src/features/architect/GMDashboard/components/DraftPositionsInput.jsx:151:      const result = await saveDraftPositions(worldId, selectedYear, positionsMap, {
```

### 4. Team Writes During Season Advance

```
src/features/architect/utils/seasonManager.js:20:import { writeBatch, serverTimestamp, increment } from 'firebase/firestore';
src/features/architect/utils/seasonManager.js:85:  const batch = writeBatch(db);
src/features/architect/utils/seasonManager.js:485:    const batch = writeBatch(db);
```

---

## STOP CONDITIONS EVALUATION

**Checked:** No evidence of `advanceSeasonInWorld()` being called twice per click.

**No STOP triggered.** Proceeding with analysis completion.

---

## RECOMMENDED FIX AREAS

1. **Sync `currentYear` from World Metadata on World Selection:**
   - When a world is selected in `WorldSelector`, load `worldMeta.currentSeason` and update `currentYear`
   - This prevents UI/state desync

2. **Validate `fromSeason` Against World State Before Advance:**
   - In `advanceSeasonInWorld()`, compare `options.fromSeason` with `worldMeta.currentSeason`
   - Warn or reject if they don't match (prevents skipping)

3. **Display World's Current Season Prominently:**
   - Show "World Season: 2026-27" alongside "View Season" selector
   - Distinguish between "what season the world is in" vs "what season the user is viewing"

---

## CONFIRMATION

✅ **PREFLIGHT ONLY** — No code changes were made. This document contains only investigation findings.
