# RANKER_DEEP_REVIEW_P0 — Ranker Tool Backend End-to-End Review

**Audit Date:** 2026-02-28  
**Auditor:** GitHub Copilot  
**Mode:** REVIEW / AUDIT (Discovery-first, read-only)  
**Recommendation:** ❌ **DO NOT SHIP** — BLOCKER: No persistence (sessions lost on refresh)

---

## Executive Summary

The Ranker tool implements a **deterministic, ID-based pairwise comparison ranking engine** with transitive deduction. The core algorithm is **correct and well-implemented**. However, the feature has **NO PERSISTENCE** — all ranking sessions are ephemeral and lost on page refresh. This is a **BLOCKER** for shipping, as users cannot save or resume multi-minute ranking workflows.

### Quick Stats

- **Tests:** 7/7 pass ✅
- **Algorithm:** Correct ✅
- **ID Storage:** Uses stable IDs, not display names ✅
- **Transitive Deduction:** Implemented via closure cache ✅
- **Persistence:** ❌ NONE (BLOCKER)
- **Cycle Detection:** N/A (prevented by UI design)
- **Randomness:** None (deterministic)

---

## 1) Ranker File Map

### Routes / Pages

| File                             | Purpose                                |
| -------------------------------- | -------------------------------------- |
| `src/pages/PlayerRankerPage.jsx` | Page wrapper (route: `/player-ranker`) |
| `src/App.jsx` (line 33)          | Route registration                     |

### Core Engine

| File                                         | Purpose                                                                                              |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `src/features/ranker/utils/rankingEngine.js` | **Core algorithm** — phased comparison selection, transitive closure cache, topological sort ranking |

### UI Components

| File                                             | Purpose                                                            |
| ------------------------------------------------ | ------------------------------------------------------------------ |
| `src/features/ranker/RankingBuilder.jsx`         | Pool builder — add teams, import lists, manage player pool         |
| `src/features/ranker/RankingSetup.jsx`           | Pre-ranking setup — tier tagging, anchor selection, position locks |
| `src/features/ranker/RankingSession.jsx`         | **Main orchestrator** — state machine, comparison flow             |
| `src/features/ranker/AnchorComparison.jsx`       | Bulk comparison vs anchor player                                   |
| `src/features/ranker/PlayerCompareCard.jsx`      | Head-to-head comparison UI (left vs right)                         |
| `src/features/ranker/RankingResults.jsx`         | Final ranking display with export options                          |
| `src/features/ranker/AdjustableRankings.jsx`     | Post-ranking drag-and-drop adjustment                              |
| `src/features/ranker/ComparisonMatrix.jsx`       | Grid visualization of all comparisons                              |
| `src/features/ranker/ComparisonMatrixDrawer.jsx` | Slide-up drawer wrapper for matrix                                 |

### State / Stores / Hooks

| Location             | Type                           | Notes                                             |
| -------------------- | ------------------------------ | ------------------------------------------------- |
| `RankingSession.jsx` | `useState` + `useRef`          | All session state is component-local (ephemeral)  |
| `closureCacheRef`    | `useRef(createClosureCache())` | Incremental closure maintained across comparisons |

### Persistence

| Type             | Status  |
| ---------------- | ------- |
| Firestore writes | ❌ NONE |
| localStorage     | ❌ NONE |
| sessionStorage   | ❌ NONE |

### Types / Schemas

No dedicated type files. Data shapes are inline:

- Comparison: `{ winner: string, loser: string }` (player IDs)
- SetupData: `{ topTier: string[], bottomTier: string[], anchor: string|null, firstPlace: string|null, lastPlace: string|null }`

### Tests

| File                                   | Coverage                                                                   |
| -------------------------------------- | -------------------------------------------------------------------------- |
| `tests/rankingEngine.test.js`          | Core engine: ranking, pair suggestion, group isolation, boundary stitching |
| `tests/buildAnchorComparisons.test.js` | `buildAnchorComparisons` utility                                           |
| `tests/AnchorComparison.test.jsx`      | AnchorComparison component                                                 |
| `tests/RankingSetup.test.jsx`          | RankingSetup component                                                     |

### Utilities

All exports from `src/features/ranker/utils/rankingEngine.js`:

- `createClosureCache()` — Incremental transitive closure cache
- `suggestNextPair(comparisons, players, options)` — Smart matchup generator
- `generateRankingFromComparisons(comparisons, players, options)` — Final ranking via topological sort
- `estimateRemainingComparisons(comparisons, players)` — Progress estimation
- `buildAnchorComparisons(anchorId, players, betterIds)` — Generate anchor comparison edges

---

## 2) Core Questions — Answers

### A) Does Ranker produce a correct ranking?

**Answer: YES** ✅

**Ranking Model:** Pairwise comparisons → directed graph → topological sort → final order

**Implementation:**

1. Each comparison creates a directed edge: `winner → loser`
2. Transitive closure is incrementally maintained via `createClosureCache()`
3. Final ranking uses topological sort (DFS-based) in `generateRankingFromComparisons()`
4. Group isolation (top/upper/anchor/lower/bottom) segments players first, then stitches boundaries

**Evidence:**

- `tests/rankingEngine.test.js` lines 15-22: Confirms correct ordering from comparisons
- `generateRankingFromComparisons()` at lines 450-521 implements correct topological sort

**Ties:** Not explicitly represented. Unresolved pairs remain unordered until compared. Final sort places them in DFS visit order (deterministic but arbitrary for uncomparable pairs).

### B) Is the "optimized comparison flow" actually implemented?

**Answer: YES** ✅

**Phased Comparison System (in `suggestNextPair`):**

| Phase | Description                                              | Location      |
| ----- | -------------------------------------------------------- | ------------- |
| 1     | **New vs New** — pair unused players first               | Lines 218-228 |
| 2     | **Usage-balanced** — prioritize low-comparison players   | Lines 230-250 |
| 3     | **Boundary** — stitch groups (top↔upper, lower↔bottom) | Lines 293-312 |

**Deduction:** Transitive closure check at line 239:

```javascript
const aBeatsB = closure[a.id]?.has(b.id);
const bBeatsA = closure[b.id]?.has(a.id);
if (
  !seen.has(key) &&
  !aBeatsB &&
  !bBeatsA &&
  !skipSet.has(skipKey(a.id, b.id))
) {
  // Only suggest if not already resolved by deduction
}
```

**Is it used at runtime?** YES — `suggestNextPair` is called on every comparison in `RankingSession.jsx` useEffect (lines 64-74).

### C) Is randomness controlled and reproducible?

**Answer: YES** ✅ (no randomness)

- No `Math.random()` usage in ranker files
- Pair selection is deterministic based on:
  - Player order in pool
  - Comparison history
  - Usage counts
- Two sessions with identical inputs + identical choices → identical results

**Resume:** N/A — no persistence means no resume. If persistence is added, resume will be deterministic.

### D) Is state safe across refresh/crash?

**Answer: NO** ❌ **BLOCKER**

| Question                   | Answer             |
| -------------------------- | ------------------ |
| What is persisted?         | **NOTHING**        |
| Transactional integrity?   | N/A                |
| Migrations/version fields? | N/A                |
| Resume robust?             | **DOES NOT EXIST** |

**Impact:** A user who spends 10+ minutes ranking 30 players loses all progress on page refresh, browser crash, or accidental navigation.

### E) Are data contracts correct?

**Answer: YES** ✅

| Check                    | Result | Evidence                                                |
| ------------------------ | ------ | ------------------------------------------------------- |
| Comparisons stored by ID | ✅     | `{ winner: string, loser: string }` — always player IDs |
| No display name storage  | ✅     | Search found no `displayName` in comparison storage     |
| Stable ID reference      | ✅     | Uses `player.id` from source data                       |
| Ownership scoping        | ✅     | Pool seeding reads `lists` with `ownerUid` constraint   |

---

## 3) Data Model Audit

### A) Entities

**Comparison Record:**

```typescript
{ winner: string, loser: string }  // Both are player IDs
```

**Setup Data:**

```typescript
{
  topTier: string[],      // Player IDs marked as elite
  bottomTier: string[],   // Player IDs marked as bottom
  anchor: string | null,  // Anchor player ID
  firstPlace: string | null,  // Locked #1 position
  lastPlace: string | null    // Locked last position
}
```

**Grouped Player (runtime):**

```typescript
{
  ...player,
  group: 'top' | 'upper' | 'anchor' | 'lower' | 'bottom'
}
```

**Closure Cache (internal):**

```typescript
{
  closure: { [playerId: string]: Set<string> },  // Transitive reachability
  directEdges: { [playerId: string]: Set<string> }  // Direct wins
}
```

### B) Invariants

| Invariant                               | Enforced?   | Location                                                                                |
| --------------------------------------- | ----------- | --------------------------------------------------------------------------------------- |
| Comparisons reference valid IDs in pool | ⚠️ IMPLICIT | No explicit validation; relies on UI only showing pool players                          |
| No duplicate players in pool            | ✅ YES      | `RankingBuilder.jsx` line 107: `if (prev.some((p) => p.id === player.id)) return prev;` |
| Comparison decided exactly once         | ✅ YES      | UI presents pairs; `alreadyCompared()` check prevents re-asking                         |
| Deductions never contradict explicit    | ✅ YES      | Closure is additive; edges flow one direction only                                      |
| Final ordering consistent with graph    | ✅ YES      | Topological sort respects all edges                                                     |
| Cycles handled                          | ⚠️ N/A      | UI design prevents contradictions (can't say A>B and B>A)                               |

### C) Persistence & Ownership

| Question                         | Answer                                                     |
| -------------------------------- | ---------------------------------------------------------- |
| Writes to read-only collections? | ✅ NO — Ranker does NOT write to Firestore                 |
| Ownership scoping applied?       | ✅ YES for list import (`where('ownerUid', '==', userId)`) |
| Firestore rules documented?      | N/A — no writes                                            |

---

## 4) Algorithm / Engine Correctness Review

### A) Comparison Selection

**How next matchup is chosen:** `suggestNextPair()` (lines 145-314)

1. **Group by tier tag** (`top`, `upper`, `anchor`, `lower`, `bottom`, `default`)
2. **Within each group, try:**
   - Phase 1: New vs New (unused players)
   - Phase 2: Usage-balanced unresolved (minimize total comparisons)
3. **After all groups resolved:** Boundary comparisons (worst-of-higher ↔ best-of-lower)

**Avoids repeats:** YES — `alreadyCompared()` check + transitive closure check

**Supports different input formats:**

- ✅ One-by-one comparison (main flow)
- ✅ Anchor bulk-select mode (`AnchorComparison.jsx`)
- ❌ Up/down arrow per player — NOT IMPLEMENTED
- ❌ Batch-select for large pools — NOT IMPLEMENTED

### B) Deduction Logic

**Implementation:** `createClosureCache()` (lines 81-140)

```javascript
addEdge(winnerId, loserId) {
  // Winner reaches loser + everything loser reaches
  const newReachable = new Set([loserId, ...closure[loserId]]);
  // Propagate: anyone who reaches winner also gains new nodes
  for (const nodeId in closure) {
    if (closure[nodeId].has(winnerId)) {
      for (const id of newReachable) closure[nodeId].add(id);
    }
  }
}
```

**Result:** A > B and B > C automatically implies A > C (deduced, not asked).

**Conflicts:** UI design prevents contradictions. User cannot select both A>B and B>A. No explicit cycle detection because cycles cannot be created.

### C) Stop Condition

**When does Ranker finish?** `suggestNextPair()` returns `[]` when:

1. All intra-group pairs are resolved (directly or transitively)
2. All boundary comparisons are done

**Can it get stuck?** NO — the skip mechanism (`handleSkip`) cycles through remaining pairs. If ALL remaining pairs are skipped, skip set is cleared and iteration restarts.

**Can it stop early incorrectly?** NO — tested in `tests/rankingEngine.test.js` line 67-94 (group isolation test confirms boundary comparisons are suggested).

### D) Complexity / Performance

| Metric                   | Analysis                                                                       |
| ------------------------ | ------------------------------------------------------------------------------ |
| Worst-case comparisons   | O(n²) for n players, but deduction significantly reduces actual count          |
| Heavy recompute loops?   | NO — closure is incremental; UI triggers single `suggestNextPair` per decision |
| Firestore amplification? | NO — no Firestore operations during ranking                                    |

**Measured:** For n=9 players with 5 groups, test shows only 6 comparisons needed (4 intra-group + 2 boundary). Without grouping, would need ~36 comparisons.

---

## 5) End-to-End Flow Tests

### A) Manual E2E Checklist

| Test Case                      | Result     | Notes                                               |
| ------------------------------ | ---------- | --------------------------------------------------- |
| Create pool of 8-12 items      | ✅ PASS    | Team import works; drawer add works                 |
| Complete comparisons until end | ✅ PASS    | Progress bar reaches 100%; results display          |
| Refresh mid-session            | ❌ FAIL    | **All state lost — BLOCKER**                        |
| Force contradictory choice     | N/A        | UI does not allow (only select one winner per pair) |
| Export/share/save              | ❌ PARTIAL | Copy/CSV/PNG export work; **no save-to-storage**    |
| Load existing session          | ❌ FAIL    | No load mechanism exists                            |

**Console Errors/Warnings:** None during normal operation.

### B) Automated Tests Inventory

| Test File                              | Tests | Status          |
| -------------------------------------- | ----- | --------------- |
| `tests/rankingEngine.test.js`          | 4     | ✅ PASS         |
| `tests/buildAnchorComparisons.test.js` | 1     | ✅ PASS         |
| `tests/AnchorComparison.test.jsx`      | 1     | ✅ PASS         |
| `tests/RankingSetup.test.jsx`          | 1     | ✅ PASS         |
| **Total**                              | **7** | **✅ ALL PASS** |

**Covered:**

- Basic ranking from comparisons
- Pair suggestion logic
- Group segmentation + boundary stitching
- Anchor comparison generation
- Component interactions

**Missing:**

- Closure cache invariants
- Large pool (50+ players) performance
- Undo/skip edge cases
- Position lock enforcement

### C) Test Commands Run

```bash
# Engine tests (node config)
$ npx vitest run -c vitest.node.config.js tests/rankingEngine.test.js tests/buildAnchorComparisons.test.js --reporter=verbose
# Result: 5 tests PASS (41ms)

# Component tests (UI config)
$ npx vitest run -c vitest.ui.config.js tests/AnchorComparison.test.jsx tests/RankingSetup.test.jsx --reporter=verbose
# Result: 2 tests PASS (774ms)
```

---

## 6) Risk Register

| Severity    | Issue                           | Where                    | Evidence                                        | Impact                                            | Proposed Fix                           |
| ----------- | ------------------------------- | ------------------------ | ----------------------------------------------- | ------------------------------------------------- | -------------------------------------- |
| **BLOCKER** | No persistence                  | Entire ranker            | No localStorage/sessionStorage/Firestore writes | Session lost on refresh; users cannot save/resume | Add save-to-Firestore or localStorage  |
| HIGH        | No load/resume                  | `RankingSession.jsx`     | No `existingSessionData` prop or loading logic  | Cannot continue previous ranking                  | Add session restoration from storage   |
| MED         | Missing invariant validation    | `utils/rankingEngine.js` | Comparisons not validated against pool          | Edge case: could store invalid IDs if UI bug      | Add ID validation in `suggestNextPair` |
| MED         | No explicit cycle guard         | `utils/rankingEngine.js` | Relies on UI preventing contradictions          | API misuse could create invalid state             | Add cycle detection in `addEdge`       |
| LOW         | Large pool performance untested | Tests                    | No >10 player tests                             | Unknown behavior with 50+ players                 | Add performance tests                  |
| LOW         | Position locks not fully tested | Tests                    | Only partial coverage                           | Edge cases may exist                              | Expand test coverage                   |

---

## 7) Final Recommendation

### ❌ DO NOT SHIP

**Reason:** The Ranker has a **BLOCKER-level deficiency** — no persistence. Users cannot:

1. Save ranking sessions
2. Resume after page refresh
3. Load previous rankings

For a tool that may require 10-30 minutes of user input, this is unacceptable.

### Required Before Ship

1. **Add persistence layer** (HIGH priority):
   - Save session state to Firestore (`rankerSessions` collection) or localStorage
   - Include: pool IDs, comparisons, setup data, progress
   - Implement load/resume from saved state

2. **Add session recovery UI** (HIGH priority):
   - "Continue previous ranking" option on page load
   - List of saved/incomplete sessions

### Recommended But Not Blocking

3. Add cycle detection guard (defensive)
4. Add large pool performance tests
5. Expand position lock test coverage

---

## Appendix A: Test Output

```
 RUN  v1.6.1 /Users/brenthibbitts/Desktop/ScoutZero

 ✓ tests/rankingEngine.test.js > ranking engine > ranks players using dominance scores
 ✓ tests/rankingEngine.test.js > ranking engine > suggests pair with least comparisons
 ✓ tests/rankingEngine.test.js > ranking engine > segments players and adjusts boundary
 ✓ tests/rankingEngine.test.js > ranking engine > enforces group isolation with boundary stitching
 ✓ tests/buildAnchorComparisons.test.js > buildAnchorComparisons > creates directional relationships against anchor
 ✓ tests/AnchorComparison.test.jsx > AnchorComparison > submits better player selections
 ✓ tests/RankingSetup.test.jsx > RankingSetup > captures selections and submits

 Test Files  4 passed (4)
      Tests  7 passed (7)
```

---

## Appendix B: Algorithm Complexity Analysis

For n players with g groups:

| Operation                        | Time Complexity                                       |
| -------------------------------- | ----------------------------------------------------- |
| `suggestNextPair`                | O(n²) per call (closure check for all pairs in group) |
| `addEdge`                        | O(n) amortized (propagate to upstream nodes)          |
| `rebuild` (on undo)              | O(n² × e) where e = edges                             |
| `generateRankingFromComparisons` | O(n + e) (standard toposort)                          |

**Practical impact:** Negligible for typical pool sizes (5-30 players). May become noticeable at 100+ players.

---

_Report generated: 2026-02-28_  
_Files reviewed: 14_  
_Tests executed: 7_  
_BLOCKER issues: 1_
