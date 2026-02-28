# RANKER_PERSISTENCE_P1 — PREFLIGHT (Discovery Only)

**Date:** 2026-02-28  
**Mode:** PREFLIGHT / DISCOVERY ONLY (NO code changes)  
**Purpose:** Gather repo facts for implementing Ranker persistence safely and consistently

---

## 1) Existing Persistence Patterns

### 1.1 User-Owned Collection Patterns

| Collection       | File                            | ownerUid | createdAt | updatedAt | Auto-Claim | Notes                                |
| ---------------- | ------------------------------- | -------- | --------- | --------- | ---------- | ------------------------------------ |
| `lists`          | `src/firebase/listHelpers.js`   | ✅ YES   | ✅ YES    | ✅ YES    | ✅ YES     | Gold standard pattern                |
| `tierLists`      | `src/firebase/listHelpers.js`   | ✅ YES   | ✅ YES    | ✅ YES    | ✅ YES     | Same file, same pattern              |
| `rosterProjects` | `src/firebase/rosterHelpers.js` | ❌ NO    | ✅ YES    | ✅ YES    | ❌ NO      | **Legacy — lacks ownership scoping** |

**Recommendation:** Follow `lists`/`tierLists` pattern, NOT `rosterProjects`.

### 1.2 Ownership Helpers (from listHelpers.js)

**File:** `src/firebase/listHelpers.js`

```javascript
// Key functions (not exported, internal utilities):
claimOwnershipIfMissing(docRef, data, userId); // Auto-claims legacy docs
assertOwnership(ownerUid, userId); // Throws if not owner
readAndGuard(collectionName, id, userId); // Read + auto-claim + assert

// Create pattern (lines 87-99):
const newList = {
  name,
  playerIds: [],
  playerOrder: [],
  playerNotes: {},
  description: '',
  ownerUid: userId, // ✅ Required
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
};
```

### 1.3 Draft Persistence Pattern (sessionStorage)

**File:** `src/features/tierMaker/hooks/useTierDraft.ts`

```typescript
// Key pattern for ephemeral drafts:
const STORAGE_KEY = 'tiermaker_draft_v1'; // Versioned key
const DEBOUNCE_MS = 1000; // 1 second debounce

interface DraftEnvelope {
  draftStandard: DraftStandard | null;
  draftTieramid: DraftTieramid | null;
  draftUpdatedAt: number | null; // Timestamp for UI "last saved"
}

// Restore on mount:
sessionStorage.getItem(STORAGE_KEY);

// Save with debounce:
setTimeout(() => {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(envelope));
}, DEBOUNCE_MS);
```

**Recommendation:** Consider sessionStorage for in-progress sessions with Firestore for explicit saves.

### 1.4 Autosave Pattern (Firestore)

**File:** `src/features/profile/hooks/useAutoSavePlayer.js`

```javascript
const AUTOSAVE_DEBOUNCE_MS = 750;

// Key pattern:
- Tracks `hasChanges` flag
- Uses `changeTokenRef` to avoid stale saves
- Guarded `isSavingRef` to prevent concurrent writes
- Uses `writeBatch` for atomic multi-doc writes
```

**Recommendation:** For Ranker, simpler single-doc writes are sufficient (no batch needed).

---

## 2) Firestore + Auth Assumptions

### 2.1 How userId is Obtained in Ranker Today

**File:** `src/features/ranker/RankingBuilder.jsx` (lines 4, 33)

```javascript
import { useAuth } from '@/shared/hooks/useAuth';
// ...
const { userId } = useAuth();
```

**Confirmed:** Ranker already imports and uses `useAuth` hook.

### 2.2 Anonymous Auth Availability

**File:** `src/shared/hooks/useAuth.js`

```javascript
// E4: Auto sign-in anonymously in all environments (one attempt per mount)
signInAnonymously(auth).then((cred) => {
  console.log('🔐 Anonymous sign-in successful:', cred.user.uid);
});
```

**Confirmed:** Anonymous auth is ALWAYS available. Every user gets a `userId` automatically.

### 2.3 Ranker Scope

| Question                   | Answer | Evidence                                |
| -------------------------- | ------ | --------------------------------------- |
| Is Ranker world-scoped?    | ❌ NO  | No `worldId` references in ranker files |
| Is Ranker user-owned tool? | ✅ YES | Uses `useAuth` for list import already  |
| Should use ownerUid?       | ✅ YES | Consistent with lists/tierLists         |

**Conclusion:** Ranker is a **user-owned tool** (like lists/tierLists), NOT a world-scoped feature (like Architect).

---

## 3) Proposed Ranker Session Schema (v1)

### 3.1 Collection Name

**Proposed:** `rankerSessions`

**Rationale:**

- Follows naming pattern: `lists`, `tierLists`, `rosterProjects`
- Plural noun, camelCase
- Clear ownership scope

### 3.2 Document Schema

```typescript
interface RankerSessionDoc {
  // === Ownership & Metadata ===
  ownerUid: string; // Required — user who owns this session
  createdAt: Timestamp; // serverTimestamp() on create
  updatedAt: Timestamp; // serverTimestamp() on every update
  schemaVersion: 1; // For future migrations

  // === Session Identity ===
  name: string; // User-provided name (default: "Ranking {date}")

  // === Pool State ===
  playerPoolIds: string[]; // Array of player IDs (not full objects)

  // === Setup Data ===
  setupData: {
    topTier: string[]; // Player IDs marked as top
    bottomTier: string[]; // Player IDs marked as bottom
    anchor: string | null; // Anchor player ID
    firstPlace: string | null;
    lastPlace: string | null;
  } | null;

  // === Comparison State ===
  results: Array<{
    // Completed comparisons
    winner: string; // Player ID
    loser: string; // Player ID
  }>;

  // === Progress State ===
  anchorDone: boolean; // Has anchor comparison phase completed
  isFinished: boolean; // Is ranking complete

  // === Optional: Adjustment Results ===
  adjustments: string[] | null; // Adjusted ranking (player IDs in order), only set after manual adjustment
}
```

### 3.3 What NOT to Store

| Omitted             | Reason                                          |
| ------------------- | ----------------------------------------------- |
| `currentPair`       | Derived from `suggestNextPair()` — recomputable |
| `skippedPairs`      | Ephemeral UI state — reset on load              |
| `closureCache`      | Recomputed from `results` on load               |
| `groupedPlayers`    | Derived from `results` + `setupData`            |
| Full player objects | Store IDs only — lookup from `players_v2`       |

### 3.4 Migration Plan

**v1 (initial):**

- All fields as defined above
- No breaking changes expected

**Future considerations:**

- If `results` grows very large (hundreds of comparisons), may add pagination or archival
- If multi-session merge is needed, add `parentSessionId` field

---

## 4) Write/Read Surfaces

### 4.1 Save Triggers (Where Writes Would Live)

| Trigger                      | File                 | Integration Point                            | Write Type          |
| ---------------------------- | -------------------- | -------------------------------------------- | ------------------- |
| Explicit Save button         | `RankingBuilder.jsx` | Add "Save Draft" button near "Start Ranking" | Create new doc      |
| Auto-save on comparison      | `RankingSession.jsx` | In `handleSelect` callback                   | Update existing doc |
| Auto-save on undo            | `RankingSession.jsx` | In `handleUndo` callback                     | Update existing doc |
| Auto-save on setup complete  | `RankingSession.jsx` | In `handleComplete` (setup)                  | Update existing doc |
| Auto-save on anchor complete | `RankingSession.jsx` | In `handleAnchorComplete`                    | Update existing doc |
| Save finished ranking        | `RankingResults.jsx` | Optional explicit save                       | Update existing doc |
| Save adjustments             | `RankingResults.jsx` | In `handleSaveAdjustments`                   | Update existing doc |

### 4.2 Load / Resume Logic (Where Reads Would Live)

| Entry Point  | File                                | Behavior                                      |
| ------------ | ----------------------------------- | --------------------------------------------- |
| Page load    | `RankingBuilder.jsx`                | Check for incomplete sessions, show resume UI |
| Resume click | `RankingBuilder.jsx`                | Load session doc, pass to `RankingSession`    |
| Direct URL   | Future: `/player-ranker/:sessionId` | Load specific session                         |

### 4.3 Page Open Behavior (Incomplete Session Exists)

**Proposed UX:**

```
┌─────────────────────────────────────────────────────────┐
│  Player Ranker                                          │
├─────────────────────────────────────────────────────────┤
│  ⚠️ You have an incomplete ranking session              │
│                                                         │
│  "My Draft Rankings" — 12/15 comparisons done          │
│  Last updated: Feb 28, 2026 at 10:30 AM                │
│                                                         │
│  [Resume Session]   [Start New]   [View All Sessions]  │
└─────────────────────────────────────────────────────────┘
```

**Logic:**

1. On mount, query `rankerSessions` for `ownerUid == userId` and `isFinished == false`
2. If found, show resume banner
3. "Resume" → load session and hydrate state
4. "Start New" → clear state and begin fresh (prompt to delete old?)
5. "View All" → navigate to session list (future feature)

### 4.4 New Files Needed

| File                                            | Purpose                              |
| ----------------------------------------------- | ------------------------------------ |
| `src/firebase/rankerHelpers.js`                 | CRUD operations for `rankerSessions` |
| `src/features/ranker/hooks/useRankerSession.js` | Hook for load/save/autosave logic    |

### 4.5 Files to Modify

| File                                     | Changes                                                        |
| ---------------------------------------- | -------------------------------------------------------------- |
| `src/features/ranker/RankingBuilder.jsx` | Add session check, resume UI, pass sessionId to RankingSession |
| `src/features/ranker/RankingSession.jsx` | Accept `sessionId` prop, call save on state changes            |
| `src/features/ranker/RankingResults.jsx` | Wire up `onRankingAdjusted` to save adjustments                |
| `src/constants/collections.ts`           | Add `RANKER_SESSIONS_COLLECTION` constant                      |

---

## 5) STOP Checks

### 5.1 Does Ranker Write to Read-Only Collections?

**Search results:**

```bash
grep -r "setDoc\|addDoc\|updateDoc\|deleteDoc" src/features/ranker/
# Result: NO MATCHES
```

**Confirmed:** Ranker does NOT write to any collections today. Safe to add writes to new `rankerSessions` collection.

### 5.2 Any Prohibited Write Targets?

| Collection              | Read-Only?              | Ranker Touches? |
| ----------------------- | ----------------------- | --------------- |
| `players_v2`            | ✅ YES (source data)    | ❌ NO           |
| `architect_basePlayers` | ✅ YES (source data)    | ❌ NO           |
| `architect_baseTeams`   | ✅ YES (source data)    | ❌ NO           |
| `lists`                 | ❌ NO (user-owned)      | READ ONLY       |
| `tierLists`             | ❌ NO (user-owned)      | ❌ NO           |
| `rankerSessions`        | ❌ NO (new, user-owned) | WILL WRITE      |

**Confirmed:** No prohibited write targets. Safe to proceed.

---

## 6) Summary

### Ready for Implementation

| Item              | Status                        |
| ----------------- | ----------------------------- |
| Auth pattern      | ✅ `useAuth` already in use   |
| Ownership pattern | ✅ Copy from `listHelpers.js` |
| Collection name   | ✅ `rankerSessions`           |
| Schema            | ✅ v1 defined above           |
| Write surfaces    | ✅ Identified                 |
| Read surfaces     | ✅ Identified                 |
| STOP checks       | ✅ PASSED                     |

### Recommended Implementation Order

1. Add `RANKER_SESSIONS_COLLECTION` to `src/constants/collections.ts`
2. Create `src/firebase/rankerHelpers.js` with CRUD operations
3. Create `src/features/ranker/hooks/useRankerSession.js` for state management
4. Modify `RankingBuilder.jsx` to check for incomplete sessions
5. Modify `RankingSession.jsx` to auto-save on state changes
6. Wire `RankingResults.jsx` adjustment callback

### Estimated LOC

| File                         | Estimated Lines |
| ---------------------------- | --------------- |
| `rankerHelpers.js`           | ~120            |
| `useRankerSession.js`        | ~150            |
| `RankingBuilder.jsx` changes | ~50             |
| `RankingSession.jsx` changes | ~30             |
| `RankingResults.jsx` changes | ~10             |
| **Total**                    | **~360 lines**  |

---

_Preflight complete. Ready for P2 implementation._
