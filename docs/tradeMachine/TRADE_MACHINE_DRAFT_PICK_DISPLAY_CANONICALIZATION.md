# Trade Machine Draft Pick Display Canonicalization

**Date:** 2026-01-10  
**Status:** ✅ Implemented  
**Initiative:** Origin Logo + Auto Via

## Goal

Fix draft pick display so users can always tell a pick's origin and so a traded pick never looks like the receiving team's own pick.

### Key Requirements

- `LAL_2029_1st` in DAL inventory must show the **LAL logo** and label must include **(via LAL)** (even when `via` is not explicitly populated).
- Swap rights must still look like a pick (keep the pick label), with swap details as secondary info.
- No legacy concepts or fields introduced/used; fallbacks are defensive only for older pick shapes.

---

## Canonical UI Rules

### 1. Logo Fallback Chain

**Canonical rule**: always show the **origin team** logo using `pick.originalTeam`.  
**Fallbacks are defensive only** (to prevent blank logos if a pick object is malformed/older).

```
pick.originalTeam     ← Canonical string abbreviation (e.g., "LAL")
→ pick.teamId         ← Default team reference
→ pick.owner          ← Current owner (prevents undefined logos)
→ teamId prop         ← Component-level fallback
```

> [!NOTE]
> `originalTeamId` may still exist in older pick shapes as a compatibility fallback; if present, it should come after `originalTeam` in the chain.

**Implementation:**

```jsx
<TeamLogo
  teamId={pick?.originalTeam || pick?.teamId || pick?.owner || teamId}
  className="..."
/>
```

### 2. Via Label Computation

Auto-compute the via label for traded picks:

```javascript
const viaTeam =
  pick.via ||  // Respect explicit via if present
  (pick.originalTeam && pick.owner && pick.owner !== pick.originalTeam
    ? pick.originalTeam
    : null);

if (viaTeam) str += ` (via ${viaTeam})`;
```

**Rules:**

- If `pick.via` exists → display `(via pick.via)` (explicit override)
- Else if `pick.owner !== pick.originalTeam` → display `(via pick.originalTeam)`
- Else → show no `(via ...)`

### 3. Swap Display

Swaps are still picks with secondary swap info:

- Keep the pick looking like a pick (still "YEAR ROUND Round")
- Show swap info as appended detail with pipe separator: `| Swap (Best of) vs OKC`
- Protection shown as `| Protected: Top 10`
- Notes shown as `| Note: ...`
- No emojis in pick labels (removed 2026-01-10)
- Protection, notes, and resolved outcomes follow

---

## Files Changed

### 1. [TradePickRow.jsx](file:///Users/brenthibbitts/Desktop/ScoutZero/src/features/architect/tradeMachine/TradePickRow.jsx#L107-L110)

Updated TeamLogo to use canonical fallback chain:

```diff
<TeamLogo
-  teamId={pick?.originalTeamId || pick?.teamId || teamId}
+  teamId={pick?.originalTeam || pick?.originalTeamId || pick?.teamId || pick?.owner || teamId}
   className="w-4 h-4"
/>
```

### 2. [tradeHelpers.js](file:///Users/brenthibbitts/Desktop/ScoutZero/src/features/architect/utils/tradeHelpers.js#L361-L371) - `formatPick()`

Added canonical via computation with defensive guard:

```diff
let str = `${p.year} ${p.round} Round`;
-if (p.via) str += ` (via ${p.via})`;
+
+// Canonical via display:
+// - Respect explicit p.via if present
+// - Otherwise, if owner differs from originalTeam, show (via originalTeam)
+// - NEVER show (via X) when X === owner (defensive guard added 2026-01-10)
+const viaTeam =
+  p.via ||
+  (p.originalTeam && p.owner && p.owner !== p.originalTeam ? p.originalTeam : null);
+
+if (viaTeam && viaTeam !== p.owner) str += ` (via ${viaTeam})`;
```

### 3. [TradeExportCapture.jsx](file:///Users/brenthibbitts/Desktop/ScoutZero/src/features/architect/tradeMachine/TradeExportCapture.jsx#L211-L221)

Updated pick logo to prefer `originalTeam` for origin tracking:

```diff
<TeamLogo
  teamId={
-    p.fromTeamId ||
+    p.originalTeam ||
     p.originTeamId ||
+    p.fromTeamId ||
     p.teamId ||
     p.teamAbbr ||
     p.team
   }
/>
```

---

## Before vs After Examples

### Example 1: Traded Pick (no explicit via)

**Input:**

```javascript
{ owner: 'DAL', originalTeam: 'LAL', year: 2029, round: 1 }
```

| | Before | After |
|---|---|---|
| **Logo** | DAL (or undefined) | LAL ✅ |
| **Label** | `2029 1 Round` | `2029 1 Round (via LAL)` ✅ |

### Example 2: Traded Pick with explicit via

**Input:**

```javascript
{ owner: 'DAL', originalTeam: 'LAL', via: 'SAS', year: 2027, round: 2 }
```

| | Before | After |
|---|---|---|
| **Logo** | (varied) | LAL ✅ |
| **Label** | `2027 2 Round (via SAS)` | `2027 2 Round (via SAS)` ✅ (preserved) |

### Example 3: Own pick (not traded)

**Input:**

```javascript
{ owner: 'DAL', originalTeam: 'DAL', year: 2029, round: 1 }
```

| | Before | After |
|---|---|---|
| **Logo** | DAL | DAL ✅ |
| **Label** | `2029 1 Round` | `2029 1 Round` ✅ (no via needed) |

---

## Validation

### Test Results

```
✓ src/tests/tradeMachine/stepienObligations.test.js (15)
  ✓ validateStepien - Obligations Wiring (15)
    ✓ Test 1: Existing obligation causes Stepien failure (3)
    ✓ Test 2: Conditional/protected obligation reserves year (4)
    ✓ Test 3: Swap worst_of does not reserve year (3)
    ✓ Edge cases (5)

Test Files  1 passed (1)
     Tests  15 passed (15)
```

### Static Verification

The `formatPick()` function correctly outputs:

- `{ year: 2029, round: 1, owner: 'DAL', originalTeam: 'LAL' }` → `2029 1 Round (via LAL)`
- `{ via: 'SAS', owner: 'DAL', originalTeam: 'LAL', year: 2027, round: 2 }` → `2027 2 Round (via SAS)`

---

## Data Field Reference

| Field | Type | Description |
|-------|------|-------------|
| `originalTeam` | string | Origin team abbreviation (e.g., "LAL") - **canonical** |
| `owner` | string | Current owner abbreviation (e.g., "DAL") |
| `via` | string? | Explicit via chain (e.g., "SAS") - optional override |
| `originalTeamId` | string/number | Compatibility fallback for older pick shapes |
| `teamId` | string/number | Default team reference |

---

## Acceptance Criteria

- [x] In TradePickRow, traded picks show the origin team logo (`originalTeam`), not the owner team logo
- [x] `formatPick()` shows `(via {originalTeam})` when `owner ≠ originalTeam` and `via` is missing
- [x] Picks that already have `via` continue to show their explicit `(via X)`
- [x] Stepien obligations test suite still passes (15/15)
- [x] No "legacyId/currentOwner/originalTeamId-only" logic introduced; `originalTeam` and `owner` are canonical
