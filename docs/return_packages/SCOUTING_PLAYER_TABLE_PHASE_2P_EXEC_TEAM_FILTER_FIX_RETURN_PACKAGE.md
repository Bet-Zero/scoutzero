# SCOUTING_PLAYER_TABLE — Phase 2P EXECUTION RETURN PACKAGE

## Fix Team Filter SSOT (teamId) + Repair Related Team Filters

**DATE**: 2026-02-01  
**STATUS**: ✅ COMPLETE  
**MASTER DOC**: [SCOUTING_PLAYER_TABLE_MASTER_AUDIT.md](../scouting/SCOUTING_PLAYER_TABLE_MASTER_AUDIT.md)

---

## Summary

Fixed the Team filter returning zero results by aligning team selection and predicates to a single SSOT team key: `bio.display.teamId` (3-letter code like `BOS`).

**Root Cause**: MultiSelectFilter used `opt.id` (slug like `"celtics"`) for values, while the filter predicate compared against `p.bio.display.team` (full name like `"Boston Celtics"`). These never matched.

**Solution**: Use 3-letter team codes (`BOS`, `LAL`, `DEN`) as the SSOT:

- Added `valueKey`/`labelKey` props to MultiSelectFilter for flexible key extraction
- Wired Team dropdowns to emit `code` values
- Changed predicates to compare against `bio.display.teamId`

---

## Changes By Task

### Task 1 — Add teamId alias to teamList.js ✅

**File**: [src/constants/teamList.js](../../src/constants/teamList.js)

Added `teamId` field to all 30 team objects as an alias for `code`:

```javascript
// BEFORE
{
  id: 'celtics',
  code: 'BOS',
  teamName: 'Boston Celtics',
  nickname: 'Celtics',
  conference: 'East',
},

// AFTER
{
  id: 'celtics',
  code: 'BOS',
  teamId: 'BOS',  // <-- NEW: alias for code
  teamName: 'Boston Celtics',
  nickname: 'Celtics',
  conference: 'East',
},
```

**Impact**: Non-breaking. All 30 teams now have `teamId` field for clarity.

---

### Task 2 — Add valueKey/labelKey props to MultiSelectFilter ✅

**File**: [src/shared/components/ui/filters/MultiSelectFilter.jsx](../../src/shared/components/ui/filters/MultiSelectFilter.jsx)

Added optional `valueKey` and `labelKey` props with backwards-compatible defaults:

```jsx
// BEFORE
const MultiSelectFilter = ({
  label,
  value,
  options = [],
  onChange,
  allLabel = 'All',
  containerClass = '',
  selectClass = '',
}) => {
  // ...
  const val = isObj ? opt.id : opt; // hardcoded
  const label = isObj ? opt.teamName || opt.label : opt; // hardcoded
};

// AFTER
const MultiSelectFilter = ({
  label,
  value,
  options = [],
  onChange,
  allLabel = 'All',
  containerClass = '',
  selectClass = '',
  valueKey = 'id', // <-- NEW: default preserves old behavior
  labelKey = 'teamName', // <-- NEW: default preserves old behavior
}) => {
  // ...
  const val = isObj ? (opt[valueKey] ?? opt.id) : opt; // uses valueKey
  const optLabel = isObj ? opt[labelKey] || opt.label : opt; // uses labelKey
};
```

**Impact**: Backwards compatible. Existing callers unchanged. New callers can use `valueKey="code"`.

---

### Task 3 — Wire TopControlsBar Team filter to use code ✅

**File**: [src/features/table/PlayerTable/PlayerTableHeader/TopControlsBar.jsx](../../src/features/table/PlayerTable/PlayerTableHeader/TopControlsBar.jsx)

```jsx
// BEFORE
<MultiSelectFilter
  value={filters.team || ''}
  options={TeamListFull}
  onChange={(val) => update('team', val)}
  allLabel="Team"
  containerClass="shrink-0"
  selectClass={selectClass}
/>

// AFTER
<MultiSelectFilter
  value={filters.team || ''}
  options={TeamListFull}
  onChange={(val) => update('team', val)}
  allLabel="Team"
  containerClass="shrink-0"
  selectClass={selectClass}
  valueKey="code"       // <-- NEW: emits "BOS" instead of "celtics"
  labelKey="teamName"   // <-- NEW: displays "Boston Celtics"
/>
```

**Impact**: Selecting "Boston Celtics" now sets `filters.team = "BOS"`.

---

### Task 4 — Fix playerFilterUtils Team predicate ✅

**File**: [src/shared/utils/filtering/playerFilterUtils.js](../../src/shared/utils/filtering/playerFilterUtils.js)

```javascript
// BEFORE
if (
  filters.team &&
  (p.bio?.display?.team || '').toLowerCase() !== filters.team.toLowerCase()
) {
  return false;
}

// AFTER
// Team filter: compare against bio.display.teamId (3-letter code like "BOS")
// Back-compat: if filters.team is a slug (e.g., "celtics"), map it to code first
if (filters.team) {
  let teamCode = filters.team;
  // If it's not a 3-letter code, try to map from slug
  if (teamCode.length !== 3) {
    teamCode = TeamSlugToCode[teamCode.toLowerCase()] || teamCode;
  }
  const playerTeamId = (p.bio?.display?.teamId || '').toUpperCase();
  if (playerTeamId !== teamCode.toUpperCase()) {
    return false;
  }
}
```

**Import Added**:

```javascript
import { TeamSlugToCode } from '@/constants/teamList';
```

**Impact**:

- Now compares `bio.display.teamId` vs filter value
- Old slug values (e.g., `"celtics"`) transparently mapped to codes (e.g., `"BOS"`)
- Case-insensitive comparison

---

### Task 5 — Fix TierMakerBoard team filtering ✅

**File**: [src/features/tierMaker/TierMakerBoard.jsx](../../src/features/tierMaker/TierMakerBoard.jsx)

```javascript
// BEFORE
const handleAddTeamRoster = () => {
  if (!selectedTeam) return;
  const teamPlayers = allPlayers.filter(
    (p) => (p.bio?.display?.team || '').toLowerCase() === selectedTeam.id
  );
  addPlayersToPool(teamPlayers);
  setSelectedTeam(null);
};

// AFTER
const handleAddTeamRoster = () => {
  if (!selectedTeam) return;
  const teamCode = (
    selectedTeam.code ||
    selectedTeam.teamId ||
    ''
  ).toUpperCase();
  const teamPlayers = allPlayers.filter(
    (p) => (p.bio?.display?.teamId || '').toUpperCase() === teamCode
  );
  addPlayersToPool(teamPlayers);
  setSelectedTeam(null);
};
```

**Impact**: "Add Team" button now correctly filters by `teamId` vs `code`.

---

### Task 6 — Fix RankingBuilder team filtering ✅

**File**: [src/features/ranker/RankingBuilder.jsx](../../src/features/ranker/RankingBuilder.jsx)

```javascript
// BEFORE
const handleAddTeam = () => {
  if (!selectedTeam) return;
  const teamPlayers = allPlayers.filter(
    (p) => (p.bio?.display?.team || '').toLowerCase() === selectedTeam.id
  );
  addPlayersToPool(teamPlayers);
  setSelectedTeam(null);
};

// AFTER
const handleAddTeam = () => {
  if (!selectedTeam) return;
  const teamCode = (
    selectedTeam.code ||
    selectedTeam.teamId ||
    ''
  ).toUpperCase();
  const teamPlayers = allPlayers.filter(
    (p) => (p.bio?.display?.teamId || '').toUpperCase() === teamCode
  );
  addPlayersToPool(teamPlayers);
  setSelectedTeam(null);
};
```

**Impact**: "Add Team" button now correctly filters by `teamId` vs `code`.

---

### Task 7 — Fix BasicFilters.jsx team filter ✅

**File**: [src/features/roster/AddPlayerDrawer/addPlayer/BasicFilters.jsx](../../src/features/roster/AddPlayerDrawer/addPlayer/BasicFilters.jsx)

```jsx
// BEFORE
{
  teamOptions.map((team) => (
    <option key={team.id} value={team.id}>
      {team.teamName}
    </option>
  ));
}

// AFTER
{
  teamOptions.map((team) => (
    <option key={team.code} value={team.code}>
      {team.teamName}
    </option>
  ));
}
```

**Impact**: Team dropdown now emits `code` values (`"BOS"`) instead of `id` slugs (`"celtics"`).

---

## Files Touched

| File                                                                                                                                             | Change                                                |
| ------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------- |
| [src/constants/teamList.js](../../src/constants/teamList.js)                                                                                     | Added `teamId` alias to all 30 teams                  |
| [src/shared/components/ui/filters/MultiSelectFilter.jsx](../../src/shared/components/ui/filters/MultiSelectFilter.jsx)                           | Added `valueKey`/`labelKey` props                     |
| [src/features/table/PlayerTable/PlayerTableHeader/TopControlsBar.jsx](../../src/features/table/PlayerTable/PlayerTableHeader/TopControlsBar.jsx) | Added `valueKey="code"` to Team filter                |
| [src/shared/utils/filtering/playerFilterUtils.js](../../src/shared/utils/filtering/playerFilterUtils.js)                                         | Changed predicate to use `teamId` with slug migration |
| [src/features/tierMaker/TierMakerBoard.jsx](../../src/features/tierMaker/TierMakerBoard.jsx)                                                     | Fixed `handleAddTeamRoster` predicate                 |
| [src/features/ranker/RankingBuilder.jsx](../../src/features/ranker/RankingBuilder.jsx)                                                           | Fixed `handleAddTeam` predicate                       |
| [src/features/roster/AddPlayerDrawer/addPlayer/BasicFilters.jsx](../../src/features/roster/AddPlayerDrawer/addPlayer/BasicFilters.jsx)           | Changed team select to use `code`                     |

---

## Build Output

```
> scoutzero-final2@0.0.1 build
> vite build

✓ 2968 modules transformed.
dist/index.html                            0.60 kB │ gzip:   0.37 kB
dist/assets/index-5a13d02f.css            76.05 kB │ gzip:  13.27 kB
dist/assets/index.esm-950815c5.js          3.62 kB │ gzip:   1.56 kB
dist/assets/tradeManager-09cd4370.js       6.59 kB │ gzip:   2.47 kB
dist/assets/seasonManager-eec1fd02.js     15.72 kB │ gzip:   5.33 kB
dist/assets/index-89ec1d03.js          2,020.03 kB │ gzip: 587.47 kB
✓ built in 39.40s
```

**Status**: ✅ BUILD PASSED

---

## Manual Verification Notes

**Pending manual verification on dev server**:

### /players Page

- [ ] Select Team = Boston Celtics → list includes Jayson Tatum
- [ ] Select Team = Los Angeles Lakers → list includes LeBron James
- [ ] Select Team = Denver Nuggets → list includes Nikola Jokić
- [ ] Clear Team filter → list returns to normal
- [ ] Other filters (Position, Off Role) still work
- [ ] No visual layout shift in header

### TierMaker

- [ ] Select a team → "Add Team" button populates pool with that team's players

### RankingBuilder

- [ ] Select a team → "Add Team" button filters players correctly

---

## Acceptance Criteria Status

| Criterion                                           | Status                                       |
| --------------------------------------------------- | -------------------------------------------- |
| Team filter returns correct players for BOS/LAL/DEN | ⏳ Pending manual verification               |
| No "all teams produce 0 results" scenario           | ⏳ Pending manual verification               |
| TierMaker team filtering works                      | ⏳ Pending manual verification               |
| RankingBuilder team filtering works                 | ⏳ Pending manual verification               |
| `npm run build` passes                              | ✅ PASSED                                    |
| MultiSelectFilter remains backwards compatible      | ✅ VERIFIED (defaults preserve old behavior) |

---

## Stop Conditions Encountered

None. All implementation proceeded as planned.

---

## SSOT Summary

| Layer            | Field                  | Example           |
| ---------------- | ---------------------- | ----------------- |
| **TeamListFull** | `code` / `teamId`      | `"BOS"`           |
| **Filter state** | `filters.team`         | `"BOS"`           |
| **Player data**  | `bio.display.teamId`   | `"BOS"`           |
| **Comparison**   | Case-insensitive `===` | `"BOS" === "BOS"` |

All components now aligned to use 3-letter team codes as the canonical team identifier.
