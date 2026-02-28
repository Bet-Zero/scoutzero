# RANKER_DEEP_REVIEW_P0.1 — Proof Pass (No Implementation)

**Audit Date:** 2026-02-28  
**Mode:** REVIEW ONLY (no code changes)  
**Purpose:** Validate P0 review claims with direct evidence and fill missing deep backend checks

---

## 1) Persistence Absence — PROVEN ✅

### Evidence: localStorage/sessionStorage

**Search command:**

```bash
grep -r "localStorage\|sessionStorage" src/features/ranker/ 2>/dev/null
```

**Result:** `NO MATCHES FOUND`

### Evidence: Firestore Write Operations

**Search command:**

```bash
grep -r "setDoc\|addDoc\|updateDoc\|deleteDoc" src/features/ranker/ 2>/dev/null
```

**Result:** `NO MATCHES FOUND`

### Evidence: Firebase Imports

**Search command:**

```bash
grep -r "import.*from.*firebase" src/features/ranker/
```

**Result:** Single match — READ-ONLY usage:

```javascript
// src/features/ranker/RankingBuilder.jsx:5
import { where } from 'firebase/firestore';

// Usage at line 36 — constraint for reading lists, NOT writing
() => (userId ? [where('ownerUid', '==', userId)] : []);
```

### Conclusion

**PERSISTENCE IS TRULY ABSENT.**

| Storage Type     | Files Checked        | Result                          |
| ---------------- | -------------------- | ------------------------------- |
| localStorage     | All 11 ranker files  | ❌ NO USAGE                     |
| sessionStorage   | All 11 ranker files  | ❌ NO USAGE                     |
| Firestore writes | All 11 ranker files  | ❌ NO USAGE                     |
| Firebase imports | `RankingBuilder.jsx` | READ-ONLY (`where` for queries) |

---

## 2) Undo / Skip / Rebuild Correctness Audit

### 2.1 Handler: `handleSelect`

**Location:** `src/features/ranker/RankingSession.jsx` lines 79-85

```javascript
const handleSelect = useCallback((winner, loser) => {
  // Incrementally update closure cache with the new edge
  closureCacheRef.current.addEdge(winner.id, loser.id);
  setResults((prev) => [...prev, { winner: winner.id, loser: loser.id }]);
  // Clear skipped pairs — new info may make previously skipped pairs relevant
  setSkippedPairs(new Set());
}, []);
```

**State Mutated:**

| State                     | Mutation                                          |
| ------------------------- | ------------------------------------------------- |
| `closureCacheRef.current` | `addEdge(winnerId, loserId)` — incremental update |
| `results`                 | Append `{ winner, loser }`                        |
| `skippedPairs`            | Reset to empty `Set`                              |

**Invariants:**

- Closure cache must contain same edges as `results` array
- After `addEdge`, transitive closure is propagated

**Desync Risk:** ✅ LOW — Both are updated atomically in same callback

---

### 2.2 Handler: `handleSkip`

**Location:** `src/features/ranker/RankingSession.jsx` lines 87-110

```javascript
const handleSkip = useCallback(() => {
  if (currentPair.length < 2) return;
  const key =
    currentPair[0].id < currentPair[1].id
      ? `${currentPair[0].id}<>${currentPair[1].id}`
      : `${currentPair[1].id}<>${currentPair[0].id}`;
  const newSkipped = new Set(skippedPairs);
  newSkipped.add(key);

  const next = suggestNextPair(results, groupedPlayers, {
    skippedPairs: newSkipped,
    closureCache: closureCacheRef.current,
  });
  if (next.length === 0) {
    // All remaining pairs have been skipped — cycle back by clearing skips
    setSkippedPairs(new Set());
    const reset = suggestNextPair(results, groupedPlayers, {
      closureCache: closureCacheRef.current,
    });
    if (reset.length > 0) setCurrentPair(reset);
  } else {
    setSkippedPairs(newSkipped);
    setCurrentPair(next);
  }
}, [currentPair, skippedPairs, results, groupedPlayers]);
```

**State Mutated:**

| State          | Mutation                                               |
| -------------- | ------------------------------------------------------ |
| `skippedPairs` | Add current pair key, OR reset to empty if all skipped |
| `currentPair`  | Set to next suggested pair                             |

**Invariants:**

- Skip key format: `${smallerId}<>${largerId}` (alphabetical order)
- `suggestNextPair` respects `skippedPairs` set

**Edge Cases:**

| Case                           | Behavior                                       | Status     |
| ------------------------------ | ---------------------------------------------- | ---------- |
| Skip all pairs                 | Clears `skippedPairs`, restarts iteration      | ✅ HANDLED |
| Skip starvation loop           | Prevented by clearing skips when all skipped   | ✅ HANDLED |
| Skip after anchor bulk compare | Works — `suggestNextPair` uses grouped players | ✅ HANDLED |

**Desync Risk:** ✅ NONE — Closure cache is read-only in skip handler

---

### 2.3 Handler: `handleUndo`

**Location:** `src/features/ranker/RankingSession.jsx` lines 112-120

```javascript
const handleUndo = useCallback(() => {
  if (results.length === 0) return;
  const newResults = results.slice(0, -1);
  // Rebuild closure cache from scratch after undo (one edge removed = full rebuild needed)
  closureCacheRef.current.rebuild(newResults);
  setResults(newResults);
  setIsFinished(false);
  setSkippedPairs(new Set());
}, [results]);
```

**State Mutated:**

| State                     | Mutation                                |
| ------------------------- | --------------------------------------- |
| `results`                 | Remove last element                     |
| `closureCacheRef.current` | **Full rebuild** from remaining results |
| `isFinished`              | Reset to `false`                        |
| `skippedPairs`            | Reset to empty `Set`                    |

**Invariants:**

- After `rebuild()`, closure cache must match `newResults` exactly
- `isFinished` must be `false` to allow new comparisons

**Critical Analysis of `rebuild()`:**

**Location:** `src/features/ranker/utils/rankingEngine.js` lines 119-138

```javascript
rebuild(comparisons) {
  // Clear existing state
  for (const key in closure) delete closure[key];
  for (const key in directEdges) delete directEdges[key];

  // Rebuild direct edges
  comparisons.forEach(({ winner, loser }) => {
    ensureNode(winner);
    ensureNode(loser);
    directEdges[winner].add(loser);
  });

  // Rebuild transitive closure
  for (const a in directEdges) {
    closure[a] = new Set();
    const stack = [...directEdges[a]];
    while (stack.length > 0) {
      const next = stack.pop();
      if (!closure[a].has(next)) {
        closure[a].add(next);
        directEdges[next]?.forEach((n) => stack.push(n));
      }
    }
  }
}
```

**Edge Cases:**

| Case                           | Behavior                                                  | Status        |
| ------------------------------ | --------------------------------------------------------- | ------------- |
| Undo with 0 results            | Early return, no action                                   | ✅ HANDLED    |
| Undo after anchor bulk compare | Rebuild from all remaining (including anchor comparisons) | ✅ CORRECT    |
| Undo multiple times rapidly    | Each undo is atomic; React batching may apply             | ⚠️ MINOR RISK |
| Undo after isFinished=true     | Sets `isFinished=false`, resumes session                  | ✅ CORRECT    |

**Desync Risk:** ✅ LOW — Full rebuild ensures consistency. The `rebuild()` function clears all state before rebuilding, preventing stale data.

---

### 2.4 Closure Cache Desync Analysis

**Question:** Can closure cache become desynchronized from `results`?

| Scenario                   | Risk Level     | Analysis                                                  |
| -------------------------- | -------------- | --------------------------------------------------------- |
| Normal flow (select)       | ✅ NONE        | `addEdge` + `setResults` in same callback                 |
| Skip                       | ✅ NONE        | Cache is read-only                                        |
| Undo                       | ✅ NONE        | Full rebuild ensures sync                                 |
| Browser crash mid-callback | N/A            | No persistence, session lost anyway                       |
| Concurrent state updates   | ⚠️ THEORETICAL | React's `useCallback` + `useState` provide atomic updates |

**Conclusion:** Closure cache **cannot desync** under normal operation. The design correctly uses incremental updates on `addEdge` and full rebuild on `undo`.

---

## 3) Cycle Safety — Engine-Level Audit

### Can the engine accept an edge that creates a cycle?

**Answer:** ⚠️ **YES — NO CYCLE GUARD EXISTS**

**Evidence from `addEdge()`:**

**Location:** `src/features/ranker/utils/rankingEngine.js` lines 98-117

```javascript
addEdge(winnerId, loserId) {
  ensureNode(winnerId);
  ensureNode(loserId);
  if (directEdges[winnerId].has(loserId)) return; // Duplicate check only
  directEdges[winnerId].add(loserId);
  // ... propagate transitive closure
}
```

**Missing check:**

```javascript
// NOT PRESENT:
if (closure[loserId]?.has(winnerId)) {
  throw new Error(`Cycle detected: ${loserId} → ${winnerId} already exists`);
}
```

### What happens if a cycle is created?

**Simulation:** If `addEdge('A', 'B')` then `addEdge('B', 'A')`:

1. First call: `closure['A'] = Set(['B'])`
2. Second call: `closure['B'] = Set(['A'])`
3. Propagation: `closure['A']` gains `'A'` (reaches itself via B)

**Result:**

- `closure['A'].has('A') === true` (self-loop)
- `closure['B'].has('B') === true` (self-loop)
- Topological sort behavior: **UNDEFINED** — DFS may hang or produce wrong order

### Current Protection

| Layer  | Protection                            | Effectiveness                     |
| ------ | ------------------------------------- | --------------------------------- |
| UI     | Only shows one winner button per pair | ✅ Prevents user-initiated cycles |
| Engine | **NONE**                              | ❌ API misuse can create cycles   |
| Tests  | No cycle tests                        | ❌ Not validated                  |

### Recommendation

**Add defensive cycle guard in `addEdge()`:**

```javascript
addEdge(winnerId, loserId) {
  ensureNode(winnerId);
  ensureNode(loserId);

  // DEFENSIVE: Check for cycle before adding
  if (closure[loserId]?.has(winnerId)) {
    console.error(`[rankingEngine] Cycle rejected: ${winnerId} → ${loserId} would create cycle`);
    return false; // Or throw
  }

  if (directEdges[winnerId].has(loserId)) return true; // Already exists
  // ... rest of implementation
}
```

**Severity:** MED — UI prevents user-triggered cycles, but API lacks safety net for:

- Future code changes
- Direct API usage
- Test fixtures with bad data

---

## 4) ID Validity Enforcement

### Where are comparisons created?

| Entry Point            | Location                 | Source of IDs                                           |
| ---------------------- | ------------------------ | ------------------------------------------------------- |
| `handleSelect`         | `RankingSession.jsx:79`  | `winner.id`, `loser.id` from `currentPair`              |
| `handleAnchorComplete` | `RankingSession.jsx:199` | `buildAnchorComparisons(anchorId, untagged, betterIds)` |

### Trace: `handleSelect`

```javascript
// RankingSession.jsx:79
const handleSelect = useCallback((winner, loser) => {
  closureCacheRef.current.addEdge(winner.id, loser.id);  // Uses .id directly
  setResults((prev) => [...prev, { winner: winner.id, loser: loser.id }]);
}, []);

// Called from PlayerCompareCard.jsx:14
onClick={() => onSelect(left, right)}  // left/right are player objects

// left/right come from currentPair, set by:
setCurrentPair(next);  // next from suggestNextPair()
```

**Validation chain:**

1. `suggestNextPair()` → returns players from `groupedPlayers`
2. `groupedPlayers` → derived from `players` prop
3. `players` → derived from `playerPool` prop to `RankingSession`
4. `playerPool` → managed by `RankingBuilder`, sourced from `allPlayers`

**Conclusion:** IDs come from pool transitively. **No explicit validation exists**, but source chain is trusted.

### Trace: `handleAnchorComplete`

```javascript
// RankingSession.jsx:199
const handleAnchorComplete = (betterIds) => {
  const newResults = buildAnchorComparisons(
    setupData.anchor, // ID from setupData
    untagged, // Players filtered from pool
    betterIds // User-selected IDs from AnchorComparison
  );
  // ...
};

// buildAnchorComparisons (rankingEngine.js:411)
export function buildAnchorComparisons(anchorId, players, betterIds = []) {
  const betterSet = new Set(betterIds);
  return players.map((p) =>
    betterSet.has(p.id)
      ? { winner: p.id, loser: anchorId }
      : { winner: anchorId, loser: p.id }
  );
}
```

**Risk:** `betterIds` comes from user selection in `AnchorComparison`:

```javascript
// AnchorComparison.jsx:16
const toggle = (id) => {
  setBetter((prev) =>
    prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
  );
};

// Buttons rendered from players prop
{
  players.map((p) => (
    <PlayerButton
      key={p.id}
      player={p}
      selected={better.includes(p.id)}
      onClick={() => toggle(p.id)}
    />
  ));
}
```

**Conclusion:** `betterIds` are constrained to IDs from `players` prop (which is filtered from pool). **Cannot select invalid ID via UI.**

### Is there explicit validation?

**Search for validation:**

```bash
grep -r "assert\|throw.*id\|invalid.*id" src/features/ranker/
# Result: NO MATCHES
```

**Answer:** ❌ **NO EXPLICIT VALIDATION**

### Risk Assessment

| Scenario                   | Likelihood | Impact                       | Severity |
| -------------------------- | ---------- | ---------------------------- | -------- |
| UI bug passes wrong player | LOW        | Wrong comparison stored      | MED      |
| API misuse (direct call)   | LOW        | Invalid ID in results        | MED      |
| Data corruption            | VERY LOW   | Unknown behavior in toposort | HIGH     |

**Verdict:** **MED** — Low likelihood due to trusted source chain, but no defensive guard.

**Recommendation:** Add assertion in `addEdge()`:

```javascript
addEdge(winnerId, loserId) {
  if (typeof winnerId !== 'string' || typeof loserId !== 'string') {
    console.error('[rankingEngine] Invalid ID type');
    return false;
  }
  // ...
}
```

---

## 5) Export Correctness

### Export Functions Identified

**Location:** `src/features/ranker/RankingResults.jsx`

| Function              | Lines   | Format            | Source Data                    |
| --------------------- | ------- | ----------------- | ------------------------------ |
| `handleCopy`          | 138-142 | Text (clipboard)  | `currentRanking`               |
| `handleExportCSV`     | 144-155 | CSV file download | `currentRanking`               |
| `handleDownloadImage` | 157-166 | PNG screenshot    | `exportViewRef` (rendered DOM) |

### What is `currentRanking`?

```javascript
// RankingResults.jsx:120
const [currentRanking, setCurrentRanking] = useState(ranking);

// Synced from parent prop:
useEffect(() => {
  setCurrentRanking(ranking);
}, [ranking]);

// Updated by adjustments:
const handleSaveAdjustments = (adjusted) => {
  setCurrentRanking(adjusted); // Local state only
  setIsAdjustMode(false);
  onRankingAdjusted?.(adjusted); // Callback to parent
};
```

### Does export reflect correct data?

| Question                  | Answer     | Evidence                                                               |
| ------------------------- | ---------- | ---------------------------------------------------------------------- |
| Final ranking output?     | ✅ YES     | `currentRanking` starts from `generateRankingFromComparisons()` result |
| Post-adjustment ordering? | ⚠️ PARTIAL | Local state updated, but...                                            |
| Adjustments persisted?    | ❌ NO      | `onRankingAdjusted` not passed by `RankingSession`                     |

### Critical Finding: Adjustment Disconnect

**Problem:** `RankingSession.jsx` renders `RankingResults` WITHOUT `onRankingAdjusted`:

```javascript
// RankingSession.jsx:131
<RankingResults ranking={ranking} /> // NO onRankingAdjusted prop!
```

**Impact:**

1. User adjusts ranking in `AdjustableRankings`
2. Adjustment saved to `currentRanking` in `RankingResults` local state
3. Export **correctly** uses adjusted ranking
4. **BUT:** If user navigates away and back, adjustment is LOST

### Export Format Analysis

**Copy (clipboard):**

```javascript
const text = currentRanking
  .map((p, idx) => `#${idx + 1} ${getPlayerName(p)}`)
  .join('\n');
```

Output: `#1 LeBron James\n#2 Kevin Durant\n...`  
**Status:** ✅ Correct format, uses adjusted ranking

**CSV:**

```javascript
const rows = currentRanking
  .map((p, idx) => `${idx + 1},"${getPlayerName(p).replace(/"/g, '""')}"`)
  .join('\n');
const csv = `Rank,Name\n${rows}`;
```

Output: `Rank,Name\n1,"LeBron James"\n2,"Kevin Durant"\n...`  
**Status:** ✅ Correct CSV format, handles quotes, uses adjusted ranking

**PNG:**

```javascript
await downloadImage(`rankings-${date}.png`);
```

Uses `useImageDownload` hook on `exportViewRef` (the rendered ranking view).  
**Status:** ✅ Screenshots current view (includes adjustments)

### Metadata in Export?

| Format | Includes Metadata? | Details                     |
| ------ | ------------------ | --------------------------- |
| Copy   | ❌ NO              | Just rank + name            |
| CSV    | ❌ NO              | Just rank + name            |
| PNG    | ✅ PARTIAL         | Date shown in rendered view |

**Missing metadata:**

- Pool size
- Number of comparisons
- Total time
- Setup configuration

### Mismatch Risks

| Risk                    | Likelihood | Impact                               |
| ----------------------- | ---------- | ------------------------------------ |
| Export wrong ranking    | ❌ NONE    | All exports use `currentRanking`     |
| Lose adjustments on nav | ✅ YES     | No callback wired up                 |
| Stale screenshot        | ❌ NONE    | `exportViewRef` captures current DOM |

---

## Summary of Findings

### Confirmed from P0

| Claim                         | Status    | Evidence                     |
| ----------------------------- | --------- | ---------------------------- |
| No localStorage               | ✅ PROVEN | grep search: 0 matches       |
| No sessionStorage             | ✅ PROVEN | grep search: 0 matches       |
| No Firestore writes           | ✅ PROVEN | grep search: 0 matches       |
| Closure cache correct on undo | ✅ PROVEN | Full rebuild in `handleUndo` |

### New Findings

| Issue                     | Severity | Location             | Description                    |
| ------------------------- | -------- | -------------------- | ------------------------------ |
| No cycle guard in engine  | **MED**  | `addEdge()`          | Can accept contradictory edges |
| No ID validation          | **MED**  | `addEdge()`          | No type/existence check on IDs |
| Adjustments not persisted | **MED**  | `RankingSession.jsx` | `onRankingAdjusted` not wired  |
| No undo/rebuild tests     | **LOW**  | `tests/`             | Closure cache untested         |

### Test Coverage Gaps

| Area              | Has Tests? | Priority |
| ----------------- | ---------- | -------- |
| Closure `addEdge` | ❌ NO      | HIGH     |
| Closure `rebuild` | ❌ NO      | HIGH     |
| Cycle injection   | ❌ NO      | MED      |
| Skip starvation   | ❌ NO      | LOW      |
| Undo after anchor | ❌ NO      | LOW      |

---

## Recommendations

### Must Fix Before Ship

1. **Add persistence** (BLOCKER from P0)

### Should Fix

1. **Add cycle guard in `addEdge()`** — Defensive programming
2. **Wire `onRankingAdjusted` callback** — Preserve adjustments
3. **Add closure cache unit tests** — `addEdge`, `rebuild`, edge cases

### Nice to Have

1. Add metadata to exports
2. Add ID type validation

---

_Report generated: 2026-02-28_  
_Files examined: 14_  
_New issues found: 4_
