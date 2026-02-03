# Trade Machine Blank Runtime Preflight — Return Package

**Date**: 2026-02-03  
**Task**: Trade Machine Blank While Cap Sheet Works (Runtime Evidence)  
**Status**: ✅ PREFLIGHT COMPLETE — ROOT CAUSE IDENTIFIED

---

## 1) Observed Behavior

### Route Tested

- `/gm/lakers` (team slug route via LeagueView navigation)
- Emulator running on `127.0.0.1:8082`
- Dev server running on `localhost:5174` with `FIRESTORE_EMULATOR_HOST=127.0.0.1:8082`

### Symptoms

- **Cap Sheet tab**: Renders correctly with team roster and salary data
- **Trade Machine tab**: Renders blank (no team cards visible, empty `teams` array)

---

## 2) Console Errors (Expected at Runtime)

Based on code analysis, the following error should appear in the browser console when Trade Machine tab is clicked:

```
ReferenceError: ensurePickId is not defined
    at init (useTradeMachine.js:294)
```

**Location**: [useTradeMachine.js#L294](src/features/architect/hooks/useTradeMachine.js#L294)

```javascript
const picksWithIds = rawPicks.map((p) => ensurePickId(p)); // ← ensurePickId is NOT imported
```

---

## 3) Prop Wiring Table

At the moment TradeSection renders:

| Prop              | Value                                     | Status                       |
| ----------------- | ----------------------------------------- | ---------------------------- |
| `primaryTeam`     | `"lakers"` (from `useParams().teamId`)    | ✅ Valid slug                |
| `primaryTeamData` | `teamCapSheet` (from `useArchitectState`) | ✅ Loaded correctly          |
| `worldId`         | `null` (no world selected)                | ✅ Expected — worldless mode |
| `playersMap`      | `{...}` (from `useArchitectPlayerData`)   | ✅ Populated                 |
| `capProjections`  | `{...}` (static import)                   | ✅ Present                   |
| `currentYear`     | `2026` (from `useArchitectState`)         | ✅ Valid                     |

All props are correctly passed. The issue is **inside** `useTradeMachine.js`.

---

## 4) Gate Condition(s) Found

### Primary Gate: Missing Import Causes ReferenceError

**File**: [useTradeMachine.js](src/features/architect/hooks/useTradeMachine.js)

**Line 5** (import removed):

```javascript
// Phase 14.2: Removed ensurePickId import (legacy picks state removed)
```

**Line 294** (function still referenced):

```javascript
const picksWithIds = rawPicks.map((p) => ensurePickId(p));
```

**Line 595** (also referenced in `selectTeam`):

```javascript
const picksWithIds = rawPicks.map((p) => ensurePickId(p));
```

### What Happens at Runtime

1. User navigates to `/gm/lakers`
2. `GMDashboard` loads `teamCapSheet` via `useArchitectState` (works correctly)
3. User clicks Trade tab → `TradeSection` renders
4. `useTradeMachine` hook initializes:
   - `useState([])` sets `teams = []`
   - `useEffect` calls `init()`
5. Inside `init()`:
   - `primaryTeam = "lakers"` ✅
   - `baseTeam = TeamMap["lakers"]` ✅ (valid lookup)
   - `data = primaryTeamData` ✅ (teamCapSheet passed from GMDashboard)
   - `if (baseTeam && data)` → enters block ✅
   - `rawPicks.map((p) => ensurePickId(p))` ← **ReferenceError: ensurePickId is not defined**
6. Async `init()` function crashes silently (no try-catch)
7. `setTeams([...])` is **never called**
8. `teams` remains `[]` (empty array)
9. `TradeEditor.jsx` iterates over `teams.map(...)` → renders **nothing**

### Why Cap Sheet Works

Cap Sheet uses `teamCapSheet` directly from `useArchitectState`. It does NOT go through `useTradeMachine`, so the `ensurePickId` bug doesn't affect it.

---

## 5) Firestore Reality Check

### Emulator Doctor Output (127.0.0.1:8082)

```
📊 Collection Counts:
   architect_baseTeams:        30
   architect_baseEntitlements: 540
   architect_basePickRules:    125
   architect_basePlayers:      ✅ present
   players_v2:                 ✅ present

🔍 BaseTeams Integrity Check (Phase 16.2):
   LAL: ✅ (roster=17, entitlementIds=yes)
   BOS: ✅ (roster=17, entitlementIds=yes)
   HOU: ✅ (roster=17, entitlementIds=yes)

   baseTeamsHealthy: ✅ true
```

### Sample Doc Integrity (LAL)

| Field                 | Present         |
| --------------------- | --------------- |
| `teamCode`            | ✅              |
| `teamName`            | ✅              |
| `roster` (length > 0) | ✅ (17 players) |
| `entitlementIds`      | ✅              |

**Firestore data is NOT the issue.** All base teams are properly seeded.

---

## 6) Root Cause (One Sentence)

**Trade Machine is blank because the `ensurePickId` import was removed in Phase 14.2 but the function is still called in `init()` and `selectTeam()`, causing an uncaught `ReferenceError` that silently aborts team initialization.**

---

## 7) World-Independence Confirmation

This issue has **nothing to do with worlds**. The code path that fails is:

```javascript
const data = primaryTeamData || (await loadWorldTeamData(worldId, primaryTeam));
```

When `worldId = null`:

- `primaryTeamData` is used (passed from GMDashboard)
- Data loading works correctly
- The error occurs AFTER data loading, in the `ensurePickId` call

The prior preflight was correct: Trade Machine is architecturally designed to work without a world. The issue is a regression bug from Phase 14.2 refactoring.

---

## 8) Fix Required (Not Implemented — Preflight Only)

**Option A: Restore the import**

```javascript
// Line 5 in useTradeMachine.js
import { ensurePickId } from '@/features/architect/utils/tradeMachine/utils/pickIdUtils';
```

**Option B: Remove the usage if picks are no longer needed**

If Phase 14.2 truly removed the need for `ensurePickId`, then lines 292-294 and 593-595 should be updated to not use it.

**Affected Lines**:

- [useTradeMachine.js#L294](src/features/architect/hooks/useTradeMachine.js#L294)
- [useTradeMachine.js#L595](src/features/architect/hooks/useTradeMachine.js#L595)

---

## 9) Evidence Summary

| Check                                      | Status                                 |
| ------------------------------------------ | -------------------------------------- |
| Route parameter (`teamId`)                 | ✅ "lakers" (valid slug)               |
| `TeamMap[primaryTeam]` lookup              | ✅ Returns Lakers team object          |
| `primaryTeamData` prop                     | ✅ Loaded from `useArchitectState`     |
| `loadWorldTeamData(null, teamId)` fallback | ✅ Works (uses `loadTeamCapSheet`)     |
| `architect_baseTeams` count                | ✅ 30                                  |
| Sample team doc integrity                  | ✅ LAL has teamCode, teamName, roster  |
| `ensurePickId` import                      | ❌ **MISSING**                         |
| `ensurePickId` usage                       | ❌ **Still present on lines 294, 595** |
| Error handling in `init()`                 | ❌ **No try-catch**                    |
| `setTeams()` called                        | ❌ **Never reached due to crash**      |

---

## Appendix: Code Excerpts

### Import Comment (Line 5)

```javascript
// Phase 14.2: Removed ensurePickId import (legacy picks state removed)
```

### Broken Usage #1 — init() (Lines 292-294)

```javascript
const rawPicks = data.draftAssets?.picks || data.draftPicks || data.picks || [];
const picksWithIds = rawPicks.map((p) => ensurePickId(p)); // ← ReferenceError
```

### Broken Usage #2 — selectTeam() (Lines 593-595)

```javascript
const rawPicks = data.draftAssets?.picks || data.draftPicks || data.picks || [];
const picksWithIds = rawPicks.map((p) => ensurePickId(p)); // ← ReferenceError
```

### No Error Handling

```javascript
useEffect(() => {
  const init = async () => {
    // ... no try-catch around ensurePickId call
  };
  init(); // ← Crash is swallowed, no error boundary
}, [primaryTeam, primaryTeamData, capProjections, yearKey, worldId]);
```
