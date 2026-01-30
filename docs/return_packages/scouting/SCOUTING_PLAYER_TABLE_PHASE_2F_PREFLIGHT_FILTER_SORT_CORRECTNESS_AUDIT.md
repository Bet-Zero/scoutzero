# SCOUTING PLAYER TABLE — Phase 2F PREFLIGHT RETURN PACKAGE

## Filter + Sort Correctness Audit

**Date:** 2026-01-30
**Mode:** PREFLIGHT (Discovery Only — No Code Changes)
**Master Doc:** `docs/scouting/SCOUTING_PLAYER_TABLE_MASTER_AUDIT.md`

---

## 1. EXECUTIVE SUMMARY

This audit examined the `/players` table filter and sort systems for correctness, edge-case handling, and field mapping accuracy. The analysis uncovered **3 HIGH-severity sort bugs** (field name mismatches), **1 HIGH-severity hardcoded year bug**, and several MEDIUM/LOW-severity edge cases.

### Key Findings

| Severity | Count | Category |
|----------|-------|----------|
| HIGH | 4 | Sort field mismatches (TRB, MP, 3P%), hardcoded year |
| MEDIUM | 3 | Badge array safety, percentage scaling, salary exclusion |
| LOW | 5 | Edge cases with null defaults, case sensitivity |

---

## 2. FILTER COVERAGE MAP

### A. Complete Filter Control Inventory

| # | UI Control | Filter Key | UI Component Path | Logic Location | Player Field(s) Read | Transform/Mapping | Edge Cases |
|---|------------|------------|-------------------|----------------|---------------------|-------------------|------------|
| 1 | Search | `nameSearch` | `PlayerTableHeader/SearchBar.jsx` | `playerFilterUtils.js:38-46` | `p.bio?.displayName`, `p.bio?.name` | lowercase, `.includes()` | Missing name → empty string matches |
| 2 | Team | `team` | `FilterPanel/sections/MetadataFilters.jsx` | `playerFilterUtils.js:48-53` | `p.bio?.display?.team` | Case-insensitive exact match | Null → excluded if filter active |
| 3 | Position | `position` | `FilterPanel/sections/MetadataFilters.jsx` | `playerFilterUtils.js:55-57` | `p.formattedPosition` | `expandPositionGroup()` via `roleUtils.js` | Unknown group → `[]` filters all |
| 4 | Show Free Agents | `showFreeAgents` | `FilterPanel/sections/MetadataFilters.jsx` | `playerFilterUtils.js:29-36` | `p.bio?.display?.teamId`, `p.bio?.display?.team` | `teamId === 'FREE'` OR `team === 'Free Agent'` | Case-sensitive string match |
| 5 | Height Min | `minHeight` | `FilterPanel/sections/PhysicalFilters.jsx` | `playerFilterUtils.js:59-64` | `p.heightInInches` | Numeric comparison (inches) | Missing → 0, filters out |
| 6 | Height Max | `maxHeight` | `FilterPanel/sections/PhysicalFilters.jsx` | `playerFilterUtils.js:59-64` | `p.heightInInches` | `null` = no max applied | Explicit null check |
| 7 | Weight Min | `minWeight` | `FilterPanel/sections/PhysicalFilters.jsx` | `playerFilterUtils.js:66-71` | `p.weight` | Numeric (lbs) | Missing → 0 |
| 8 | Weight Max | `maxWeight` | `FilterPanel/sections/PhysicalFilters.jsx` | `playerFilterUtils.js:66-71` | `p.weight` | `null` = no max | Explicit null check |
| 9 | Age Min | `minAge` | `FilterPanel/sections/PhysicalFilters.jsx` | `playerFilterUtils.js:73-78` | `p.age` | Numeric | Calculated from DOB if missing |
| 10 | Age Max | `maxAge` | `FilterPanel/sections/PhysicalFilters.jsx` | `playerFilterUtils.js:73-78` | `p.age` | `null` = no max | Invalid DOB → age 0 |
| 11 | Salary Min | `minSalary` | `FilterPanel/sections/ContractFilters.jsx` | `playerFilterUtils.js:80-87` | `p.salaryByYear?.[filters.salaryYear]` | Must be `typeof === 'number'` | Missing salary → **excluded** |
| 12 | Salary Max | `maxSalary` | `FilterPanel/sections/ContractFilters.jsx` | `playerFilterUtils.js:80-87` | `p.salaryByYear?.[filters.salaryYear]` | Requires numeric type | Non-number → excluded |
| 13 | Salary Year | `salaryYear` | `ViewControls.jsx` | `playerFilterUtils.js:81` | N/A (selector for salaryByYear key) | Default: 2025 | — |
| 14 | Free Agent Year | `freeAgentYear` | `FilterPanel/sections/ContractFilters.jsx` | `playerFilterUtils.js:89-94` | `p.freeAgentYear` | `parseInt()` both sides | Non-numeric → NaN comparison fails |
| 15 | Free Agent Type | `freeAgentType` | `FilterPanel/sections/ContractFilters.jsx` | `playerFilterUtils.js:96-98` | `p.freeAgentType` | **Exact string match** | Case-sensitive! |
| 16 | Offense Role | `offenseRole` | `FilterPanel/sections/RoleFilters.jsx` | `playerFilterUtils.js:100-109` | `p.offenseRole`, `p.primaryEvaluation?.roles?.offense2` | Lowercase substring match | Checks both primary and secondary |
| 17 | Defense Role | `defenseRole` | `FilterPanel/sections/RoleFilters.jsx` | `playerFilterUtils.js:111-120` | `p.defenseRole`, `p.primaryEvaluation?.roles?.defense2` | Lowercase substring match | Checks both primary and secondary |
| 18 | Shooting Profile | `shootingProfile` | `FilterPanel/sections/RoleFilters.jsx` | `playerFilterUtils.js:122-127` | `p.shootingProfile` | **Exact string match** | Case-sensitive |
| 19 | Offense SubRoles | `subRoles.offense` | `FilterPanel/sections/RoleFilters.jsx` | `playerFilterUtils.js:129-149` | `p.subRoles.offense` | `.every()` — player must have ALL | Empty array → no filter |
| 20 | Defense SubRoles | `subRoles.defense` | `FilterPanel/sections/RoleFilters.jsx` | `playerFilterUtils.js:129-149` | `p.subRoles.defense` | `.every()` — player must have ALL | Empty array → no filter |
| 21 | Stat: PPG | `min_PPG`, `max_PPG` | `FilterPanel/sections/StatFilters.jsx` | `playerFilterUtils.js:151-168` | `p.PTS` | `parseFloat()`, no scaling | Default: 0–50 |
| 22 | Stat: RPG | `min_RPG`, `max_RPG` | `FilterPanel/sections/StatFilters.jsx` | `playerFilterUtils.js:151-168` | `p.REB` | `parseFloat()`, no scaling | Default: 0–20 |
| 23 | Stat: APG | `min_APG`, `max_APG` | `FilterPanel/sections/StatFilters.jsx` | `playerFilterUtils.js:151-168` | `p.AST` | `parseFloat()`, no scaling | Default: 0–20 |
| 24 | Stat: FG% | `min_FGP`, `max_FGP` | `FilterPanel/sections/StatFilters.jsx` | `playerFilterUtils.js:151-168` | `p['FG%']` | `× 100` if stored as decimal | Default: 0–100 |
| 25 | Stat: 3PT% | `min_TPP`, `max_TPP` | `FilterPanel/sections/StatFilters.jsx` | `playerFilterUtils.js:151-168` | `p['3PT%']` | `× 100` if stored as decimal | Default: 0–100 |
| 26 | Stat: FT% | `min_FTP`, `max_FTP` | `FilterPanel/sections/StatFilters.jsx` | `playerFilterUtils.js:151-168` | `p['FT%']` | `× 100` if stored as decimal | Default: 0–100 |
| 27 | Stat: eFG% | `min_eFGP`, `max_eFGP` | `FilterPanel/sections/StatFilters.jsx` | `playerFilterUtils.js:151-168` | `p['eFG%']` | `× 100` if stored as decimal | Default: 0–100 |
| 28 | Stat: MIN | `min_MIN`, `max_MIN` | `FilterPanel/sections/StatFilters.jsx` | `playerFilterUtils.js:151-168` | `p.MIN` | `parseFloat()`, no scaling | Default: 0–48 |
| 29 | Stat: G | `min_G`, `max_G` | `FilterPanel/sections/StatFilters.jsx` | `playerFilterUtils.js:151-168` | `p.GP` | `parseFloat()`, no scaling | Default: 0–82 |
| 30 | Trait: Shooting | `min_Shooting`, `max_Shooting` | `FilterPanel/sections/TraitFilters.jsx` | `playerFilterUtils.js:170-186` | `p.traits?.Shooting` | `parseFloat()` | Missing → 0 |
| 31 | Trait: Passing | `min_Passing`, `max_Passing` | `FilterPanel/sections/TraitFilters.jsx` | `playerFilterUtils.js:170-186` | `p.traits?.Passing` | `parseFloat()` | Missing → 0 |
| 32 | Trait: Playmaking | `min_Playmaking`, `max_Playmaking` | `FilterPanel/sections/TraitFilters.jsx` | `playerFilterUtils.js:170-186` | `p.traits?.Playmaking` | `parseFloat()` | Missing → 0 |
| 33 | Trait: Rebounding | `min_Rebounding`, `max_Rebounding` | `FilterPanel/sections/TraitFilters.jsx` | `playerFilterUtils.js:170-186` | `p.traits?.Rebounding` | `parseFloat()` | Missing → 0 |
| 34 | Trait: Defense | `min_Defense`, `max_Defense` | `FilterPanel/sections/TraitFilters.jsx` | `playerFilterUtils.js:170-186` | `p.traits?.Defense` | `parseFloat()` | Missing → 0 |
| 35 | Trait: IQ | `min_IQ`, `max_IQ` | `FilterPanel/sections/TraitFilters.jsx` | `playerFilterUtils.js:170-186` | `p.traits?.IQ` | `parseFloat()` | Missing → 0 |
| 36 | Trait: Feel | `min_Feel`, `max_Feel` | `FilterPanel/sections/TraitFilters.jsx` | `playerFilterUtils.js:170-186` | `p.traits?.Feel` | `parseFloat()` | Missing → 0 |
| 37 | Trait: Energy | `min_Energy`, `max_Energy` | `FilterPanel/sections/TraitFilters.jsx` | `playerFilterUtils.js:170-186` | `p.traits?.Energy` | `parseFloat()` | Missing → 0 |
| 38 | Badges | `badges` | `FilterPanel/sections/BadgeFilters.jsx` | `playerFilterUtils.js:188-193` | `p.badges` | `.every()` — player must have ALL | Assumes array |

### B. ActiveFiltersDisplay Exclusions

The following filters are **NOT shown** as removable pills in `ActiveFiltersDisplay`:

- `nameSearch` (shown in SearchBar instead)
- `salaryYear` (shown in ViewControls)
- `sortBy` (shown in ViewControls)
- `sortAsc` (shown in ViewControls)

**Potential Issue:** If a user sets salaryYear=2028 and doesn't realize, filters may appear to not work correctly because salary data for that year may not exist for most players.

---

## 3. SORT COVERAGE MAP

### A. Complete Sort Option Inventory

| # | UI Label | sortBy Value | Logic Location | Player Field Read | Data Type | Missing Fallback | Tie-Breaker | Status |
|---|----------|--------------|----------------|-------------------|-----------|------------------|-------------|--------|
| 1 | Default (A-Z) | `""` | `playerFilterUtils.js:346` | Falls through to name | string | — | name→id | ✅ OK |
| 2 | Name | `"name"` | `playerFilterUtils.js:301-302` | `bio?.displayName` or `name` | string | `""` | id | ✅ OK |
| 3 | Height | `"height"` | `playerFilterUtils.js:303-307` | `heightInInches` | number | -1 | name→id | ✅ OK |
| 4 | Weight | `"weight"` | `playerFilterUtils.js:308-310` | `weight` | number | -1 | name→id | ✅ OK |
| 5 | Age | `"age"` | `playerFilterUtils.js:311-313` | `age` | number | -1 | name→id | ✅ OK |
| 6 | Salary | `"salary"` | `playerFilterUtils.js:314-315` | `salaryByYear[salaryYear]` | number | -1 | name→id | ✅ OK |
| 7 | PTS | `"PTS"` | `playerFilterUtils.js:295-299` | `PTS` | number | -1 | name→id | ✅ OK |
| 8 | **TRB** | `"TRB"` | `playerFilterUtils.js:295-299` | **Looks for `TRB`** | number | -1 | name→id | 🔴 **BUG** |
| 9 | AST | `"AST"` | `playerFilterUtils.js:295-299` | `AST` | number | -1 | name→id | ✅ OK |
| 10 | FG% | `"FG%"` | `playerFilterUtils.js:295-299` | `FG%` | number | -1 | name→id | ✅ OK |
| 11 | **3P%** | `"3P%"` | `playerFilterUtils.js:295-299` | **Looks for `3P%`** | number | -1 | name→id | 🔴 **BUG** |
| 12 | FT% | `"FT%"` | `playerFilterUtils.js:295-299` | `FT%` | number | -1 | name→id | ✅ OK |
| 13 | eFG% | `"eFG%"` | `playerFilterUtils.js:295-299` | `eFG%` | number | -1 | name→id | ✅ OK |
| 14 | **Minutes** | `"MP"` | `playerFilterUtils.js:295-299` | **Looks for `MP`** | number | -1 | name→id | 🔴 **BUG** |
| 15 | Defense | `"Defense"` | `playerFilterUtils.js:293` | `traits.Defense` | number | -1 | name→id | ✅ OK |
| 16 | Energy | `"Energy"` | `playerFilterUtils.js:293` | `traits.Energy` | number | -1 | name→id | ✅ OK |
| 17 | Feel | `"Feel"` | `playerFilterUtils.js:293` | `traits.Feel` | number | -1 | name→id | ✅ OK |
| 18 | IQ | `"IQ"` | `playerFilterUtils.js:293` | `traits.IQ` | number | -1 | name→id | ✅ OK |
| 19 | Passing | `"Passing"` | `playerFilterUtils.js:293` | `traits.Passing` | number | -1 | name→id | ✅ OK |
| 20 | Playmaking | `"Playmaking"` | `playerFilterUtils.js:293` | `traits.Playmaking` | number | -1 | name→id | ✅ OK |
| 21 | Rebounding | `"Rebounding"` | `playerFilterUtils.js:293` | `traits.Rebounding` | number | -1 | name→id | ✅ OK |
| 22 | Shooting | `"Shooting"` | `playerFilterUtils.js:293` | `traits.Shooting` | number | -1 | name→id | ✅ OK |
| 23 | Shooting Profile | `"shootingProfile"` | `playerFilterUtils.js:316-317` | `shootingProfile` → rank | number | 0 | name→id | ✅ OK |
| 24 | **Years Remaining** | `"yearsRemaining"` | `playerFilterUtils.js:318-324` | `freeAgentYear - 2024` | number | -1 | name→id | 🔴 **BUG** |
| 25 | Total Contract | `"totalContract"` | `playerFilterUtils.js:325-339` | `primaryContract.salariesByYear` sum | number | -1 | name→id | ✅ OK |
| 26 | Overall Grade | `"overall"` | `playerFilterUtils.js:340-344` | `overallGrade` | number | -1 | name→id | ✅ OK |

### B. Sort Field Name Analysis

**Filtering uses these field names** (playerFilterUtils.js:157-165):

- `PTS` ✓
- `REB` ✓
- `AST` ✓
- `FG%` ✓
- `3PT%` ✓
- `FT%` ✓
- `eFG%` ✓
- `MIN` ✓
- `GP` ✓

**enrichPlayerData spreads** (enrichPlayerData.js:306):

```javascript
...latestSeasonStats  // Spreads whatever fields exist in stats
```

**ViewControls sort options use** (ViewControls.jsx:42-48):

- `TRB` ← **WRONG** (actual field: `REB`)
- `3P%` ← **WRONG** (actual field: `3PT%`)
- `MP` ← **WRONG** (actual field: `MIN`)

---

## 4. BUGS & ISSUES IDENTIFIED

### 🔴 HIGH SEVERITY

#### BUG-001: Sort by TRB field mismatch

- **Symptom:** Sorting by "TRB" (rebounds) has no effect — falls back to name sort
- **Root Cause:** `ViewControls.jsx:42` uses `value="TRB"` but player data has field `REB`
- **Code Path:** `sortPlayers()` line 295-299 checks `hasOwnProperty(player, 'TRB')` → false → returns -1
- **File:** `src/features/filters/FiltersPanel/FilterPanel/sections/ViewControls.jsx:42`
- **Severity:** HIGH — Core sort functionality broken
- **Fix:** Change `<option value="TRB">` to `<option value="REB">`

#### BUG-002: Sort by MP (Minutes) field mismatch

- **Symptom:** Sorting by "Minutes" has no effect — falls back to name sort
- **Root Cause:** `ViewControls.jsx:48` uses `value="MP"` but player data has field `MIN`
- **Code Path:** Same as BUG-001
- **File:** `src/features/filters/FiltersPanel/FilterPanel/sections/ViewControls.jsx:48`
- **Severity:** HIGH — Core sort functionality broken
- **Fix:** Change `<option value="MP">` to `<option value="MIN">`

#### BUG-003: Sort by 3P% field mismatch

- **Symptom:** Sorting by "3P%" has no effect — falls back to name sort
- **Root Cause:** `ViewControls.jsx:45` uses `value="3P%"` but player data has field `3PT%`
- **Code Path:** Same as BUG-001
- **File:** `src/features/filters/FiltersPanel/FilterPanel/sections/ViewControls.jsx:45`
- **Severity:** HIGH — Core sort functionality broken
- **Fix:** Change `<option value="3P%">` to `<option value="3PT%">`

#### BUG-004: Years Remaining hardcoded to 2024

- **Symptom:** Years remaining calculation is off by 2 years (shows +2 extra years)
- **Root Cause:** `playerFilterUtils.js:323` hardcodes `parsed - 2024` instead of using current year
- **Example:** A 2027 free agent shows 3 years remaining (correct: 1 year as of 2026)
- **File:** `src/shared/utils/filtering/playerFilterUtils.js:323`
- **Severity:** HIGH — Incorrect data displayed to users
- **Fix:** Replace `2024` with `new Date().getFullYear()` or a config constant

### 🟠 MEDIUM SEVERITY

#### BUG-005: Badge filter assumes array exists

- **Symptom:** Potential runtime error if player.badges is undefined
- **Root Cause:** `playerFilterUtils.js:190` calls `p.badges.includes()` without null check
- **File:** `src/shared/utils/filtering/playerFilterUtils.js:190`
- **Severity:** MEDIUM — Crash if data not enriched
- **Mitigation:** `enrichPlayerData` normalizes badges to array, but direct data access could fail
- **Fix:** Add guard: `(p.badges || []).includes(b)`

#### BUG-006: Percentage stat double-scaling risk

- **Symptom:** If stats are stored as 45.6 (already percent) instead of 0.456, filter multiplies by 100 → 4560
- **Root Cause:** `playerFilterUtils.js:152` applies `× 100` if key includes `%`
- **File:** `src/shared/utils/filtering/playerFilterUtils.js:152`
- **Severity:** MEDIUM — Filter produces wrong results if data format varies
- **Fix:** Verify data source format; remove `× 100` if stats already stored as percentages

#### BUG-007: Salary filter excludes players with missing salary data

- **Symptom:** Any salary filter active excludes all players without salary data for that year
- **Root Cause:** `playerFilterUtils.js:82` returns false if `typeof salary !== 'number'`
- **File:** `src/shared/utils/filtering/playerFilterUtils.js:82`
- **Severity:** MEDIUM — May unexpectedly hide valid players
- **Design Decision:** May be intentional. Consider "Include players with no salary data" checkbox.

### 🟢 LOW SEVERITY

#### EDGE-001: Free Agent Type case-sensitive

- **Symptom:** Filter for "UFA" won't match player with "ufa"
- **File:** `src/shared/utils/filtering/playerFilterUtils.js:96`
- **Severity:** LOW — Data is likely consistent, but no validation

#### EDGE-002: Shooting Profile case-sensitive

- **Symptom:** Filter for "Elite" won't match "elite"
- **File:** `src/shared/utils/filtering/playerFilterUtils.js:124`
- **Severity:** LOW — Data is likely consistent

#### EDGE-003: SubRoles assumes array on player

- **Symptom:** `p.subRoles.offense.includes()` could fail if subRoles not normalized
- **File:** `src/shared/utils/filtering/playerFilterUtils.js:136`
- **Severity:** LOW — `enrichPlayerData` normalizes this

#### EDGE-004: Traits default to 0 (indistinguishable from "no trait")

- **Symptom:** Player with trait=0 and player with missing trait both treated as 0
- **File:** `src/shared/utils/filtering/playerFilterUtils.js:171`
- **Severity:** LOW — May be intentional design

#### EDGE-005: Position filter with unknown group returns empty array

- **Symptom:** Filtering by an invalid position group excludes all players
- **File:** `src/shared/utils/roles/roleUtils.js` (`expandPositionGroup`)
- **Severity:** LOW — UI only offers valid options

---

## 5. TRUTH TEST CHECKLIST

Manual tests a human can run in the UI to verify correctness:

### Filter Tests

| # | Test | Steps | Expected Result | Validates |
|---|------|-------|-----------------|-----------|
| 1 | Team filter | Set Team="LAL" | First 20 rows all show "LAL" in team column | Filter correctness |
| 2 | Height min | Set Height Min="6'8"" (80 inches) | No visible rows under 6'8" | Range filter min |
| 3 | Height max | Set Height Max="6'6"" (78 inches) | No visible rows over 6'6" | Range filter max |
| 4 | Age range | Set Age Min=25, Max=30 | All visible players aged 25-30 | Range filter both |
| 5 | Free agent hide | Uncheck "Show Free Agents" | No rows with "Free Agent" team | Boolean filter |
| 6 | Offense role | Set Offense Role="Playmaker" | All visible rows have offense role containing "Playmaker" | Substring match |
| 7 | Shooting profile | Set Shooting Profile="Elite" | All visible rows show "Elite" shooting | Exact match |
| 8 | Salary filter | Set Salary Min=10, Year=2025 | All visible rows have 2025 salary ≥ $10M | Salary + year |
| 9 | Name search | Type "lebron" | Only LeBron James visible | Case-insensitive search |
| 10 | Trait filter | Add "Defense ≥ 80" | All visible players have Defense trait ≥ 80 | Dynamic filter |

### Sort Tests

| # | Test | Steps | Expected Result | Validates |
|---|------|-------|-----------------|-----------|
| 11 | Sort height desc | Sort by Height, Descending | Top 10 heights are non-increasing (e.g., 85, 84, 84, 83...) | Numeric sort |
| 12 | Sort stability | Sort by Height 3 times | Order is identical each time | Determinism |
| 13 | Sort name asc | Sort by Name, Ascending | A-Z order (Aaron, Anthony, Bam...) | String sort |
| 14 | **Sort TRB** | Sort by TRB, Descending | **EXPECTED BUG:** Reverts to name sort | BUG-001 |
| 15 | **Sort Minutes** | Sort by Minutes, Descending | **EXPECTED BUG:** Reverts to name sort | BUG-002 |
| 16 | Sort Salary | Sort by Salary (year 2025), Descending | Highest paid players first | Salary sort |
| 17 | Sort Overall | Sort by Overall Grade, Descending | Highest grades first | Grade sort |
| 18 | Tie-breaker | Sort by Age where many players are same age | Players with same age sorted alphabetically by name | Tie-breaker |

### Edge Case Tests

| # | Test | Steps | Expected Result | Validates |
|---|------|-------|-----------------|-----------|
| 19 | Clear filters | Apply 5 filters, click "Clear All" | All filters reset, full player list | Reset logic |
| 20 | Filter combo | Team=LAL + Position=Guard + Salary Min=5 | Only LAL guards with salary ≥ $5M | Multi-filter AND |
| 21 | Empty result | Set impossible filter (Height Min=90) | "No players found" or empty state | Empty handling |
| 22 | Filter + Sort | Filter to Guards, Sort by PTS desc | Guards only, sorted by points | Filter-sort combo |

---

## 6. DATA FLOW DIAGRAM

```
┌─────────────────────────────────────────────────────────────────────┐
│                         UI COMPONENTS                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌────────────────┐    ┌────────────────┐    ┌──────────────────┐  │
│  │   SearchBar    │    │  FiltersPanel  │    │   ViewControls   │  │
│  │  (nameSearch)  │    │ (all filters)  │    │ (sortBy, sortAsc)│  │
│  └───────┬────────┘    └───────┬────────┘    └────────┬─────────┘  │
│          │                     │                      │             │
│          └─────────────────────┴──────────────────────┘             │
│                                │                                     │
│                                ▼                                     │
│                    ┌─────────────────────┐                          │
│                    │  setFilters(prev)   │ (debounced 200-300ms)    │
│                    └──────────┬──────────┘                          │
│                               │                                      │
└───────────────────────────────┼──────────────────────────────────────┘
                                │
                                ▼
┌───────────────────────────────────────────────────────────────────────┐
│                        HOOK LAYER                                      │
├───────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  ┌────────────────────────────────────────────────────────────────┐   │
│  │              useFilteredPlayers(players, filters)               │   │
│  │                                                                 │   │
│  │   1. filterPlayers(players, filters)                           │   │
│  │      └─> Returns players matching ALL filter criteria          │   │
│  │                                                                 │   │
│  │   2. sortPlayers(filtered, sortBy, sortAsc, filters)           │   │
│  │      └─> Sorts by field, with name→id tie-breakers             │   │
│  │                                                                 │   │
│  └────────────────────────────────────────────────────────────────┘   │
│                                                                        │
└───────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌───────────────────────────────────────────────────────────────────────┐
│                        LOGIC LAYER                                     │
├───────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  File: src/shared/utils/filtering/playerFilterUtils.js                │
│                                                                        │
│  filterPlayers():                                                      │
│    - Iterates all filter conditions (AND logic)                       │
│    - Early return false on first failed condition                     │
│    - Uses player.* fields from enriched data                          │
│                                                                        │
│  sortPlayers():                                                        │
│    - getValue() extracts comparable value for sort key                │
│    - Numeric comparison for numbers, localeCompare for strings        │
│    - Tie-breaker: name (asc), then id (asc)                          │
│                                                                        │
│  🔴 BUGS HERE:                                                        │
│    - Line 42: TRB → should be REB                                     │
│    - Line 45: 3P% → should be 3PT%                                    │
│    - Line 48: MP → should be MIN                                      │
│    - Line 323: 2024 hardcoded → should be dynamic year                │
│                                                                        │
└───────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌───────────────────────────────────────────────────────────────────────┐
│                        DATA LAYER                                      │
├───────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  File: src/features/roster/utils/enrichPlayerData.js                  │
│                                                                        │
│  Input: Raw Firestore player document (players_v2)                    │
│                                                                        │
│  Output: Enriched player object with:                                 │
│    - name, formattedPosition, heightInInches, weight, age             │
│    - team, headshotUrl                                                │
│    - offenseRole, defenseRole, shootingProfile, subRoles              │
│    - traits: { Defense, Energy, Feel, IQ, Passing, Playmaking, ... } │
│    - badges: []                                                       │
│    - salaryByYear: { '2025': 10.5, '2026': 11.2, ... }               │
│    - PPG, RPG, APG (aliases)                                          │
│    - ...latestSeasonStats (PTS, REB, AST, FG%, 3PT%, FT%, MIN, GP)   │
│                                                                        │
│  ⚠️ NOTE: Stats field names are REB, MIN, 3PT% (not TRB, MP, 3P%)    │
│                                                                        │
└───────────────────────────────────────────────────────────────────────┘
```

---

## 7. EXECUTION CHECKLIST (Phase 2F-EXEC)

Minimal fixes for identified bugs:

### Immediate Fixes (HIGH)

- [ ] **BUG-001:** `ViewControls.jsx:42` — Change `value="TRB"` to `value="REB"`
- [ ] **BUG-002:** `ViewControls.jsx:48` — Change `value="MP"` to `value="MIN"`
- [ ] **BUG-003:** `ViewControls.jsx:45` — Change `value="3P%"` to `value="3PT%"`
- [ ] **BUG-004:** `playerFilterUtils.js:323` — Replace `2024` with `new Date().getFullYear()`

### Defensive Improvements (MEDIUM)

- [ ] **BUG-005:** `playerFilterUtils.js:190` — Add `(p.badges || [])` guard
- [ ] **BUG-006:** Verify stat percentage format in data source

### Optional Enhancements (LOW)

- [ ] Add case-insensitive comparison for freeAgentType
- [ ] Add case-insensitive comparison for shootingProfile
- [ ] Add "Include players without salary data" option

---

## 8. FILE REFERENCE INDEX

| File | Purpose | Lines of Interest |
|------|---------|-------------------|
| `src/features/filters/FiltersPanel/FilterPanel/sections/ViewControls.jsx` | Sort UI options | 35-61 (sort options) |
| `src/shared/utils/filtering/playerFilterUtils.js` | Filter + Sort logic | 24-196 (filters), 284-373 (sort) |
| `src/shared/utils/filtering/playerFilterDefaults.js` | Default filter values | All |
| `src/features/roster/utils/enrichPlayerData.js` | Data transformation | 303-306 (stats spread) |
| `src/features/filters/FiltersPanel/FilterPanel/sections/MetadataFilters.jsx` | Team/Position/FA filter UI | All |
| `src/features/filters/FiltersPanel/FilterPanel/sections/RoleFilters.jsx` | Role filter UI | All |
| `src/features/filters/FiltersPanel/FilterPanel/sections/ContractFilters.jsx` | Salary/FA filter UI | All |
| `src/features/filters/FiltersPanel/FilterPanel/sections/PhysicalFilters.jsx` | Height/Weight/Age UI | All |
| `src/features/filters/FiltersPanel/FilterPanel/sections/StatFilters.jsx` | Stat filter UI | All |
| `src/features/filters/FiltersPanel/FilterPanel/sections/TraitFilters.jsx` | Trait filter UI | All |
| `src/features/filters/FiltersPanel/FilterPanel/sections/BadgeFilters.jsx` | Badge filter UI | All |
| `src/features/filters/ActiveFiltersDisplay/index.jsx` | Active filter pills | All |
| `src/features/table/PlayerTable/PlayerTableHeader/SearchBar.jsx` | Name search UI | All |
| `src/features/table/hooks/useFilteredPlayers.js` | Hook wrapper | All |

---

## 9. ACCEPTANCE CRITERIA STATUS

| Criteria | Status |
|----------|--------|
| Return package file exists at correct path | ✅ |
| Master Doc updated with Phase 2F section | ⏳ (to be done) |
| Filter coverage map complete | ✅ |
| Sort coverage map complete | ✅ |
| Truth test checklist usable and specific | ✅ |
| Issues pinned to real code locations | ✅ |

---

**END OF PHASE 2F PREFLIGHT RETURN PACKAGE**
