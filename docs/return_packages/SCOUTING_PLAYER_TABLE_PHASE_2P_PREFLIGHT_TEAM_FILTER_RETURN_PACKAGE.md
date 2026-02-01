# SCOUTING_PLAYER_TABLE — Phase 2P PREFLIGHT

## Team Filter "Zero Results" Wiring Audit

**MODE**: PREFLIGHT (Discovery Only — NO code changes)  
**DATE**: 2026-02-01  
**STATUS**: ✅ COMPLETE  
**MASTER DOC**: [SCOUTING_PLAYER_TABLE_MASTER_AUDIT.md](../scouting/SCOUTING_PLAYER_TABLE_MASTER_AUDIT.md)

---

## EXECUTIVE SUMMARY

**ROOT CAUSE IDENTIFIED**: The Team filter produces 0 results because of a **value format mismatch**:

- **Dropdown stores**: `"celtics"` (lowercased team nickname from `TeamListFull[].id`)
- **Player data contains**: `"Boston Celtics"` (full team name in `bio.display.team`)
- **Filter predicate compares**: `p.bio?.display?.team.toLowerCase() !== filters.team.toLowerCase()`

The comparison `"boston celtics" !== "celtics"` is always `true`, so all players are filtered out.

---

## 1. TEAM FILTER UI/CONFIG ANALYSIS

### 1A. Dropdown Location

**File**: [TopControlsBar.jsx](../../src/features/table/PlayerTable/PlayerTableHeader/TopControlsBar.jsx#L54-L61)

```jsx
<MultiSelectFilter
  value={filters.team || ''}
  options={TeamListFull}
  onChange={(val) => update('team', val)}
  allLabel="Team"
  containerClass="shrink-0"
  selectClass={selectClass}
/>
```

### 1B. TeamListFull Options (5 Sample Teams)

**File**: [teamList.js](../../src/constants/teamList.js)

| id (value written) | code | teamName          | nickname |
| ------------------ | ---- | ----------------- | -------- |
| `hawks`            | ATL  | Atlanta Hawks     | Hawks    |
| `celtics`          | BOS  | Boston Celtics    | Celtics  |
| `nets`             | BKN  | Brooklyn Nets     | Nets     |
| `hornets`          | CHA  | Charlotte Hornets | Hornets  |

| `bulls` | CHI | Chicago Bulls | Bulls |

### 1C. MultiSelectFilter Value Extraction

**File**: [MultiSelectFilter.jsx](../../src/shared/components/ui/filters/MultiSelectFilter.jsx#L36-L40)

```jsx
{
  options.map((opt) => {
    const isObj = typeof opt === 'object';
    const val = isObj ? opt.id : opt;
    const label = isObj ? opt.teamName || opt.label : opt;
    return (
      <option key={val} value={val}>
        {label}
      </option>
    );
  });
}
```

**Conclusion**: When user selects "Boston Celtics", the **value written to `filters.team`** is `"celtics"` (the `id` field).

### 1D. Filter State Key

- **Key**: `filters.team`
- **Type**: `string` (lowercased nickname/id)
- **Example Value**: `"celtics"`

---

## 2. PLAYER TEAM FIELD ANALYSIS

### 2A. Sample Player Data (10 Players)

**Source**: `player-scrape/firestore_staging/_artifacts/output/players_v2/*.json`

| Player        | bio.display.team       | bio.display.teamId |
| ------------- | ---------------------- | ------------------ |
| Jayson Tatum  | `"Boston Celtics"`     | `"BOS"`            |
| Trae Young    | `"Atlanta Hawks"`      | `"ATL"`            |
| LeBron James  | `"Los Angeles Lakers"` | `"LAL"`            |
| Anthony Davis | `"Dallas Mavericks"`   | `"DAL"`            |

| Nikola Jokić | `"Denver Nuggets"` | `"DEN"` |
| Brandon Ingram | `"Toronto Raptors"` | `"TOR"` |
| Kris Dunn | `"LA Clippers"` | `"LAC"` |
| Alec Burks | `"Free Agent"` | `"FREE"` |

### 2B. Team Field Schema

**Source**: [players_v2.ts](../../src/schemas/players_v2.ts#L42-L51)

```typescript
export const PlayerDisplayZ = z.object({
  team: z.string().optional().nullable(), // Full team name: "Boston Celtics"
  teamId: TeamCodeZ.optional().nullable(), // 3-letter code: "BOS"
  // ...other fields
});
```

### 2C. enrichPlayerData Team Assignment

**File**: [enrichPlayerData.js](../../src/features/roster/utils/enrichPlayerData.js#L276)

```javascript
team: playerData.bio?.display?.team || null,
```

**Conclusion**: Player's `team` field is the **full team name** from `bio.display.team`.

---

## 3. TEAM FILTER PREDICATE ANALYSIS

### 3A. Filter Function Location

**File**: [playerFilterUtils.js](../../src/shared/utils/filtering/playerFilterUtils.js#L52-L55)
**Function**: `filterPlayers(players, filters)`

### 3B. Exact Predicate Code

```javascript
if (
  filters.team &&
  (p.bio?.display?.team || '').toLowerCase() !== filters.team.toLowerCase()
) {
  return false;
}
```

### 3C. What the Predicate Does

1. If `filters.team` is truthy (user selected a team)
2. Get player's team: `p.bio?.display?.team` (e.g., `"Boston Celtics"`)
3. Lowercase both sides
4. Compare: `"boston celtics" !== "celtics"` → **TRUE** (they don't match)
5. Return `false` → **Player is filtered out**

---

## 4. MISMATCH PROOF (Boston Celtics Example)

### Step-by-Step Trace

| Step | Source | Value |

|---|---|---|

| 1. User clicks Team dropdown | UI | Shows "Boston Celtics" |
| 2. User selects "Boston Celtics" | UI | - |
| 3. MultiSelectFilter extracts value | `opt.id` | `"celtics"` |
| 4. State update | `filters.team` | `"celtics"` |
| 5. Filter runs for Jayson Tatum | `p.bio?.display?.team` | `"Boston Celtics"` |
| 6. Comparison | `"boston celtics" !== "celtics"` | `true` |
| 7. Player included? | `return false` | **NO — Filtered out** |

### Why Zero Results

Every player is filtered out because:

- **Filter value**: `"celtics"`, `"hawks"`, `"lakers"`, etc.
- **Player value**: `"Boston Celtics"`, `"Atlanta Hawks"`, `"Los Angeles Lakers"`, etc.
- **Comparison**: Never matches

---

## 5. SSOT RECOMMENDATION

### Recommended Canonical Team Key: `teamId` (3-letter code)

| Option                 | Example            | Pros                       | Cons                               |
| ---------------------- | ------------------ | -------------------------- | ---------------------------------- |
| ❌ `id` (nickname)     | `"celtics"`        | Currently used by dropdown | Not present in player data         |
| ❌ Full name           | `"Boston Celtics"` | Matches player data        | Verbose, case-sensitive edge cases |
| ✅ **`teamId` (code)** | `"BOS"`            | Already in both datasets   | Requires minor changes             |

### Justification

1. **Already exists in player data**: `bio.display.teamId` = `"BOS"`
2. **Already exists in TeamListFull**: `code` = `"BOS"`
3. **Consistent with team-scrape data and architect patterns**
4. **Short, stable, no case sensitivity issues**

---

## 6. RECOMMENDED FIX APPROACH

### Option A: Fix Dropdown Value (RECOMMENDED)

**Change MultiSelectFilter to emit `opt.code` instead of `opt.id`**

```jsx
// In MultiSelectFilter.jsx or TeamListFull usage
const val = isObj ? opt.code : opt; // Was: opt.id
```

**Change filter predicate to compare against `teamId`**

```javascript
// In playerFilterUtils.js
if (
  filters.team &&
  (p.bio?.display?.teamId || '').toUpperCase() !== filters.team.toUpperCase()
) {
  return false;
}
```

### Option B: Fix Filter Predicate (NOT RECOMMENDED)

Change predicate to match full team name — but this requires the dropdown to emit full team names, which creates other issues.

### Affected Files

| File | Change Required |

|---|---|
| [TopControlsBar.jsx](../../src/features/table/PlayerTable/PlayerTableHeader/TopControlsBar.jsx) | Use `code` as value (or create new prop) |
| [MultiSelectFilter.jsx](../../src/shared/components/ui/filters/MultiSelectFilter.jsx) | Support custom value extraction |

| [playerFilterUtils.js](../../src/shared/utils/filtering/playerFilterUtils.js) | Compare against `bio.display.teamId` |
| [AddPlayerDrawer/BasicFilters.jsx](../../src/features/roster/AddPlayerDrawer/addPlayer/BasicFilters.jsx) | Same team dropdown fix |
| [TierMakerBoard.jsx](../../src/features/tierMaker/TierMakerBoard.jsx) | Already uses `selectedTeam.id` — needs audit |

| [RankingBuilder.jsx](../../src/features/ranker/RankingBuilder.jsx) | Already uses `selectedTeam.id` — needs audit |

---

## 7. STOP CONDITIONS EVALUATION

### ❌ Multiple Competing Team Fields

**Status**: No competing fields. All components use `bio.display.team` for display and `bio.display.teamId` for ID.

### ❌ Team Options from Different Dataset

**Status**: Team options come from `TeamListFull` constant, NOT from player collection. This is intentional (static list of NBA teams).

### ✅ No Stop Conditions Triggered

Proceed with fix.

---

## 8. NEXT STEPS

1. **Phase 2P-EXEC**: Implement Option A fix
   - Update `TopControlsBar.jsx` to emit `code` instead of `id`
   - Update `playerFilterUtils.js` to compare against `teamId`
   - Audit TierMaker and RankingBuilder for consistency

2. **Update Master Audit**: Add "Team Filter Wiring" section documenting the issue and resolution

---

## APPENDIX: Related Code Patterns

### TierMakerBoard Team Filtering (Reference)

**File**: [TierMakerBoard.jsx](../../src/features/tierMaker/TierMakerBoard.jsx#L205-L207)

```javascript
const teamPlayers = allPlayers.filter(
  (p) => (p.bio?.display?.team || '').toLowerCase() === selectedTeam.id
);
```

This has the **same bug** — comparing full team name to nickname ID.

### RankingBuilder Team Filtering (Reference)

**File**: [RankingBuilder.jsx](../../src/features/ranker/RankingBuilder.jsx#L116-L117)

```javascript
(p) => (p.bio?.display?.team || '').toLowerCase() === selectedTeam.id;
```

Same pattern, same bug.

---

**END OF PREFLIGHT REPORT**
