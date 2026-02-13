# SCOUTING_PLAYER_TABLE — Phase 2Q RETURN PACKAGE

## Full Filter + Sort Wiring Contract Audit

**DATE**: 2026-02-01  
**MODE**: PREFLIGHT (Discovery-only — NO code changes)  
**STATUS**: ✅ COMPLETE  
**MASTER DOC**: [SCOUTING_PLAYER_TABLE_MASTER_AUDIT.md](../../docs/scouting/SCOUTING_PLAYER_TABLE_MASTER_AUDIT.md)

---

## EXECUTIVE SUMMARY

This audit traced **every filter and sort control** on the `/players` table through the complete wiring path:

**UI control → stored filter value → predicate field(s) → player schema field(s) → enriched player data**

### Key Findings

| Severity    | Count | Category                                                                                                               |
| ----------- | ----- | ---------------------------------------------------------------------------------------------------------------------- |
| 🔴 CRITICAL | 3     | Free Agency filters (freeAgentYear, freeAgentType, birdRights) — predicates check fields that don't exist at top level |
| 🔴 HIGH     | 1     | Overall Grade filter — NO predicate exists, filter UI is dead code                                                     |
| 🟡 MEDIUM   | 2     | MetadataFilters Team dropdown missing `valueKey` (fixed in TopControlsBar but not in advanced panel)                   |
| 🟢 OK       | 35    | All other filters and sorts correctly wired                                                                            |

### Dominant Failure Pattern

**Field Path Mismatch**: The predicates in `playerFilterUtils.js` check for `p.freeAgentYear`, `p.freeAgentType`, and `p.birdRights` at the top level of the player object, but `enrichPlayerData.js` **never exposes these fields at top level**. The data exists at:

- `p.bio.display.freeAgentYear`
- `p.currentContractView.freeAgentYear`
- `p.primaryContract.freeAgency.freeAgentYear`

---

## FILTER_CATALOG

### A. Basic Filters (TopControlsBar — Always Visible)

| #   | Control Label | Component         | File Path            | State Key                 | Value Format                                           | Notes                                       |
| --- | ------------- | ----------------- | -------------------- | ------------------------- | ------------------------------------------------------ | ------------------------------------------- |
| 1   | Team          | MultiSelectFilter | `TopControlsBar.jsx` | `filters.team`            | `string` (3-letter code, e.g., "BOS")                  | ✅ Fixed in Phase 2P with `valueKey="code"` |
| 2   | Position      | MultiSelectFilter | `TopControlsBar.jsx` | `filters.position`        | `string` ("Guard", "Wing", "Forward", "Big", "Center") |                                             |
| 3   | Off Role      | MultiSelectFilter | `TopControlsBar.jsx` | `filters.offenseRole`     | `string` (role name)                                   |                                             |
| 4   | Def Role      | MultiSelectFilter | `TopControlsBar.jsx` | `filters.defenseRole`     | `string` (role name)                                   |                                             |
| 5   | Shooting      | MultiSelectFilter | `TopControlsBar.jsx` | `filters.shootingProfile` | `string` ("Elite", "Plus", "Capable", etc.)            |                                             |
| 6   | Salary Year   | select            | `TopControlsBar.jsx` | `filters.salaryYear`      | `number` (2025, 2026, etc.)                            |                                             |
| 7   | Sort By       | select            | `TopControlsBar.jsx` | `filters.sortBy`          | `string` ("name", "height", "PTS", etc.)               |                                             |
| 8   | Sort Order    | button            | `TopControlsBar.jsx` | `filters.sortAsc`         | `boolean`                                              |                                             |

### B. Advanced Filters — MetadataFilters Section

| #   | Control Label    | Component         | File Path             | State Key                | Value Format | Notes                                           |
| --- | ---------------- | ----------------- | --------------------- | ------------------------ | ------------ | ----------------------------------------------- |
| 9   | Team             | MultiSelectFilter | `MetadataFilters.jsx` | `filters.team`           | `string`     | ⚠️ Missing `valueKey="code"` — uses `id` (slug) |
| 10  | Position         | MultiSelectFilter | `MetadataFilters.jsx` | `filters.position`       | `string`     |                                                 |
| 11  | Show Free Agents | checkbox          | `MetadataFilters.jsx` | `filters.showFreeAgents` | `boolean`    |                                                 |

### C. Advanced Filters — ContractFilters Section

| #   | Control Label          | Component | File Path             | State Key                      | Value Format                                                   | Notes               |
| --- | ---------------------- | --------- | --------------------- | ------------------------------ | -------------------------------------------------------------- | ------------------- |
| 12  | Salary Min             | input     | `ContractFilters.jsx` | `filters.minSalary`            | `number \| undefined`                                          | In millions         |
| 13  | Salary Max             | input     | `ContractFilters.jsx` | `filters.maxSalary`            | `number \| undefined`                                          | In millions         |
| 14  | Include Missing Salary | checkbox  | `ContractFilters.jsx` | `filters.includeMissingSalary` | `boolean`                                                      | Default: true       |
| 15  | Free Agent Year        | select    | `ContractFilters.jsx` | `filters.freeAgentYear`        | `string` ("2025", "2026", etc.)                                | ⚠️ Stored as string |
| 16  | Free Agent Type        | select    | `ContractFilters.jsx` | `filters.freeAgentType`        | `string` ("UFA", "RFA", "TO", "PO", "2W")                      |                     |
| 17  | Bird Rights            | select    | `ContractFilters.jsx` | `filters.birdRights`           | `string` ("None", "Non-Bird", "Early Bird", "Bird", "Two-Way") |                     |

### D. Advanced Filters — RoleFilters Section

| #   | Control Label    | Component    | File Path         | State Key                  | Value Format | Notes |
| --- | ---------------- | ------------ | ----------------- | -------------------------- | ------------ | ----- |
| 18  | Offense Role     | select       | `RoleFilters.jsx` | `filters.offenseRole`      | `string`     |       |
| 19  | Defense Role     | select       | `RoleFilters.jsx` | `filters.defenseRole`      | `string`     |       |
| 20  | Shooting Profile | select       | `RoleFilters.jsx` | `filters.shootingProfile`  | `string`     |       |
| 21  | Offense SubRoles | multi-select | `RoleFilters.jsx` | `filters.subRoles.offense` | `string[]`   |       |
| 22  | Defense SubRoles | multi-select | `RoleFilters.jsx` | `filters.subRoles.defense` | `string[]`   |       |

### E. Advanced Filters — PhysicalFilters Section

| #   | Control Label | Component     | File Path             | State Key           | Value Format      | Notes |
| --- | ------------- | ------------- | --------------------- | ------------------- | ----------------- | ----- |
| 23  | Height Min    | RangeSelector | `PhysicalFilters.jsx` | `filters.minHeight` | `number` (inches) |       |
| 24  | Height Max    | RangeSelector | `PhysicalFilters.jsx` | `filters.maxHeight` | `number \| null`  |       |
| 25  | Weight Min    | RangeSelector | `PhysicalFilters.jsx` | `filters.minWeight` | `number` (lbs)    |       |
| 26  | Weight Max    | RangeSelector | `PhysicalFilters.jsx` | `filters.maxWeight` | `number \| null`  |       |
| 27  | Age Min       | RangeSelector | `PhysicalFilters.jsx` | `filters.minAge`    | `number`          |       |
| 28  | Age Max       | RangeSelector | `PhysicalFilters.jsx` | `filters.maxAge`    | `number \| null`  |       |

### F. Advanced Filters — StatFilters Section

| #   | Control Label | Component   | File Path         | State Key                       | Value Format     | Notes |
| --- | ------------- | ----------- | ----------------- | ------------------------------- | ---------------- | ----- |
| 29  | PPG           | dynamic add | `StatFilters.jsx` | `filters.min_PPG` / `max_PPG`   | `number`         |       |
| 30  | RPG           | dynamic add | `StatFilters.jsx` | `filters.min_RPG` / `max_RPG`   | `number`         |       |
| 31  | APG           | dynamic add | `StatFilters.jsx` | `filters.min_APG` / `max_APG`   | `number`         |       |
| 32  | FGP           | dynamic add | `StatFilters.jsx` | `filters.min_FGP` / `max_FGP`   | `number` (0-100) |       |
| 33  | TPP           | dynamic add | `StatFilters.jsx` | `filters.min_TPP` / `max_TPP`   | `number` (0-100) |       |
| 34  | FTP           | dynamic add | `StatFilters.jsx` | `filters.min_FTP` / `max_FTP`   | `number` (0-100) |       |
| 35  | eFGP          | dynamic add | `StatFilters.jsx` | `filters.min_eFGP` / `max_eFGP` | `number` (0-100) |       |
| 36  | MIN           | dynamic add | `StatFilters.jsx` | `filters.min_MIN` / `max_MIN`   | `number`         |       |
| 37  | G             | dynamic add | `StatFilters.jsx` | `filters.min_G` / `max_G`       | `number`         |       |

### G. Advanced Filters — TraitFilters Section

| #   | Control Label | Component   | File Path          | State Key                                   | Value Format     | Notes |
| --- | ------------- | ----------- | ------------------ | ------------------------------------------- | ---------------- | ----- |
| 38  | Shooting      | dynamic add | `TraitFilters.jsx` | `filters.min_Shooting` / `max_Shooting`     | `number` (0-100) |       |
| 39  | Passing       | dynamic add | `TraitFilters.jsx` | `filters.min_Passing` / `max_Passing`       | `number` (0-100) |       |
| 40  | Playmaking    | dynamic add | `TraitFilters.jsx` | `filters.min_Playmaking` / `max_Playmaking` | `number` (0-100) |       |
| 41  | Rebounding    | dynamic add | `TraitFilters.jsx` | `filters.min_Rebounding` / `max_Rebounding` | `number` (0-100) |       |
| 42  | Defense       | dynamic add | `TraitFilters.jsx` | `filters.min_Defense` / `max_Defense`       | `number` (0-100) |       |
| 43  | IQ            | dynamic add | `TraitFilters.jsx` | `filters.min_IQ` / `max_IQ`                 | `number` (0-100) |       |
| 44  | Feel          | dynamic add | `TraitFilters.jsx` | `filters.min_Feel` / `max_Feel`             | `number` (0-100) |       |
| 45  | Energy        | dynamic add | `TraitFilters.jsx` | `filters.min_Energy` / `max_Energy`         | `number` (0-100) |       |

### H. Advanced Filters — OverallGradeFilter Section

| #   | Control Label     | Component | File Path                | State Key                   | Value Format          | Notes           |
| --- | ----------------- | --------- | ------------------------ | --------------------------- | --------------------- | --------------- |
| 46  | Overall Grade Min | input     | `OverallGradeFilter.jsx` | `filters.min_overall_grade` | `number \| undefined` | 🔴 NO PREDICATE |
| 47  | Overall Grade Max | input     | `OverallGradeFilter.jsx` | `filters.max_overall_grade` | `number \| undefined` | 🔴 NO PREDICATE |

### I. Advanced Filters — BadgeFilters Section

| #   | Control Label | Component         | File Path          | State Key        | Value Format | Notes |
| --- | ------------- | ----------------- | ------------------ | ---------------- | ------------ | ----- |
| 48  | Badges        | BadgeFilterSelect | `BadgeFilters.jsx` | `filters.badges` | `string[]`   |       |

### J. Sort Options (ViewControls + TopControlsBar)

| #   | UI Label          | sortBy Value        | Player Field                         | Notes                                                  |
| --- | ----------------- | ------------------- | ------------------------------------ | ------------------------------------------------------ |
| 49  | Default (A-Z)     | `""`                | Falls through to name                | ✅                                                     |
| 50  | Name              | `"name"`            | `bio.displayName` / `name`           | ✅                                                     |
| 51  | Height            | `"height"`          | `heightInInches`                     | ✅                                                     |
| 52  | Weight            | `"weight"`          | `weight`                             | ✅                                                     |
| 53  | Age               | `"age"`             | `age`                                | ✅                                                     |
| 54  | Salary            | `"salary"`          | `salaryByYear[salaryYear]`           | ✅                                                     |
| 55  | PTS               | `"PTS"`             | `PTS`                                | ✅                                                     |
| 56  | TRB (displays as) | `"REB"`             | `REB`                                | ✅ Fixed in Phase 2F                                   |
| 57  | AST               | `"AST"`             | `AST`                                | ✅                                                     |
| 58  | Overall           | `"overall"`         | `overallGrade`                       | ✅                                                     |
| 59  | Shooting Profile  | `"shootingProfile"` | `shootingProfile` → rank             | ✅                                                     |
| 60  | Years Remaining   | `"yearsRemaining"`  | `freeAgentYear - CURRENT_YEAR`       | ⚠️ Uses `freeAgentYear` or `bio.display.freeAgentYear` |
| 61  | Total Contract    | `"totalContract"`   | `primaryContract.salariesByYear` sum | ✅                                                     |

---

## FILTER_WIRING_MATRIX

| #   | Control                | Filter Key                              | Value Format   | Predicate Location | Player Field(s) Read                                    | Data Format in Player             | Status     | Mismatch Details                                                                     |
| --- | ---------------------- | --------------------------------------- | -------------- | ------------------ | ------------------------------------------------------- | --------------------------------- | ---------- | ------------------------------------------------------------------------------------ |
| 1   | Search                 | `nameSearch`                            | string         | L38-46             | `p.bio?.displayName`, `p.bio?.name`                     | string                            | ✅ Wired   | —                                                                                    |
| 2   | Team (TopControlsBar)  | `team`                                  | string (code)  | L49-61             | `p.bio?.display?.teamId`                                | string (3-letter code)            | ✅ Wired   | Fixed in Phase 2P                                                                    |
| 3   | Team (MetadataFilters) | `team`                                  | string (slug?) | L49-61             | `p.bio?.display?.teamId`                                | string (3-letter code)            | ⚠️ Partial | Missing `valueKey="code"` in MetadataFilters                                         |
| 4   | Position               | `position`                              | string         | L63-65             | `p.formattedPosition`                                   | string                            | ✅ Wired   | —                                                                                    |
| 5   | Show Free Agents       | `showFreeAgents`                        | boolean        | L34-41             | `p.bio?.display?.teamId`, `p.bio?.display?.team`        | string                            | ✅ Wired   | —                                                                                    |
| 6   | Height Min/Max         | `minHeight`/`maxHeight`                 | number         | L67-72             | `p.heightInInches`                                      | number (inches)                   | ✅ Wired   | —                                                                                    |
| 7   | Weight Min/Max         | `minWeight`/`maxWeight`                 | number         | L74-79             | `p.weight`                                              | number (lbs)                      | ✅ Wired   | —                                                                                    |
| 8   | Age Min/Max            | `minAge`/`maxAge`                       | number         | L81-86             | `p.age`                                                 | number                            | ✅ Wired   | —                                                                                    |
| 9   | Salary Min/Max         | `minSalary`/`maxSalary`                 | number         | L88-102            | `p.salaryByYear?.[filters.salaryYear]`                  | number (millions)                 | ✅ Wired   | —                                                                                    |
| 10  | Include Missing Salary | `includeMissingSalary`                  | boolean        | L95-96             | N/A (controls inclusion)                                | —                                 | ✅ Wired   | —                                                                                    |
| 11  | **Free Agent Year**    | `freeAgentYear`                         | string         | L104-108           | **`p.freeAgentYear`**                                   | **DOES NOT EXIST**                | ❌ Broken  | Data is at `p.bio?.display?.freeAgentYear` or `p.currentContractView?.freeAgentYear` |
| 12  | **Free Agent Type**    | `freeAgentType`                         | string         | L110-112           | **`p.freeAgentType`**                                   | **DOES NOT EXIST**                | ❌ Broken  | Data is at `p.bio?.display?.freeAgentType` or `p.currentContractView?.freeAgentType` |
| 13  | **Bird Rights**        | `birdRights`                            | string         | **NO PREDICATE**   | —                                                       | Object: `{ status, eligibleFor }` | ❌ Broken  | No predicate exists; also data is object not string                                  |
| 14  | Offense Role           | `offenseRole`                           | string         | L114-123           | `p.offenseRole`, `p.primaryEvaluation?.roles?.offense2` | string                            | ✅ Wired   | —                                                                                    |
| 15  | Defense Role           | `defenseRole`                           | string         | L125-134           | `p.defenseRole`, `p.primaryEvaluation?.roles?.defense2` | string                            | ✅ Wired   | —                                                                                    |
| 16  | Shooting Profile       | `shootingProfile`                       | string         | L136-140           | `p.shootingProfile`                                     | string                            | ✅ Wired   | —                                                                                    |
| 17  | Offense SubRoles       | `subRoles.offense`                      | string[]       | L142-157           | `p.subRoles.offense`                                    | string[]                          | ✅ Wired   | —                                                                                    |
| 18  | Defense SubRoles       | `subRoles.defense`                      | string[]       | L142-157           | `p.subRoles.defense`                                    | string[]                          | ✅ Wired   | —                                                                                    |
| 19  | PPG                    | `min_PPG`/`max_PPG`                     | number         | L159-177           | `p.PTS`                                                 | number                            | ✅ Wired   | —                                                                                    |
| 20  | RPG                    | `min_RPG`/`max_RPG`                     | number         | L159-177           | `p.REB`                                                 | number                            | ✅ Wired   | —                                                                                    |
| 21  | APG                    | `min_APG`/`max_APG`                     | number         | L159-177           | `p.AST`                                                 | number                            | ✅ Wired   | —                                                                                    |
| 22  | FGP                    | `min_FGP`/`max_FGP`                     | number         | L159-177           | `p['FG%']`                                              | decimal (×100)                    | ✅ Wired   | —                                                                                    |
| 23  | TPP                    | `min_TPP`/`max_TPP`                     | number         | L159-177           | `p['3PT%']`                                             | decimal (×100)                    | ✅ Wired   | —                                                                                    |
| 24  | FTP                    | `min_FTP`/`max_FTP`                     | number         | L159-177           | `p['FT%']`                                              | decimal (×100)                    | ✅ Wired   | —                                                                                    |
| 25  | eFGP                   | `min_eFGP`/`max_eFGP`                   | number         | L159-177           | `p['eFG%']`                                             | decimal (×100)                    | ✅ Wired   | —                                                                                    |
| 26  | MIN                    | `min_MIN`/`max_MIN`                     | number         | L159-177           | `p.MIN`                                                 | number                            | ✅ Wired   | —                                                                                    |
| 27  | G                      | `min_G`/`max_G`                         | number         | L159-177           | `p.GP`                                                  | number                            | ✅ Wired   | —                                                                                    |
| 28  | Trait: Shooting        | `min_Shooting`/`max_Shooting`           | number         | L179-195           | `p.traits?.Shooting`                                    | number                            | ✅ Wired   | —                                                                                    |
| 29  | Trait: Passing         | `min_Passing`/`max_Passing`             | number         | L179-195           | `p.traits?.Passing`                                     | number                            | ✅ Wired   | —                                                                                    |
| 30  | Trait: Playmaking      | `min_Playmaking`/`max_Playmaking`       | number         | L179-195           | `p.traits?.Playmaking`                                  | number                            | ✅ Wired   | —                                                                                    |
| 31  | Trait: Rebounding      | `min_Rebounding`/`max_Rebounding`       | number         | L179-195           | `p.traits?.Rebounding`                                  | number                            | ✅ Wired   | —                                                                                    |
| 32  | Trait: Defense         | `min_Defense`/`max_Defense`             | number         | L179-195           | `p.traits?.Defense`                                     | number                            | ✅ Wired   | —                                                                                    |
| 33  | Trait: IQ              | `min_IQ`/`max_IQ`                       | number         | L179-195           | `p.traits?.IQ`                                          | number                            | ✅ Wired   | —                                                                                    |
| 34  | Trait: Feel            | `min_Feel`/`max_Feel`                   | number         | L179-195           | `p.traits?.Feel`                                        | number                            | ✅ Wired   | —                                                                                    |
| 35  | Trait: Energy          | `min_Energy`/`max_Energy`               | number         | L179-195           | `p.traits?.Energy`                                      | number                            | ✅ Wired   | —                                                                                    |
| 36  | **Overall Grade**      | `min_overall_grade`/`max_overall_grade` | number         | **NO PREDICATE**   | —                                                       | `p.overallGrade` exists           | ❌ Broken  | UI writes keys, but no predicate checks them                                         |
| 37  | Badges                 | `badges`                                | string[]       | L197-201           | `p.badges`                                              | string[]                          | ✅ Wired   | Uses `(p.badges \|\| [])` guard                                                      |

---

## FREE_AGENCY_WIRING_PROOF

### The Problem

The Free Agency filters (Year, Type, Bird Rights) are completely non-functional. Here's the proof:

### 1. UI Control Analysis

**File**: `src/features/filters/FiltersPanel/FilterPanel/sections/ContractFilters.jsx`

```jsx
// Free Agent Year — writes string value to filters.freeAgentYear
<select
  value={filters.freeAgentYear ?? ''}
  onChange={(e) => update('freeAgentYear', e.target.value)}
>
  <option value="">All</option>
  {[2025, 2026, 2027, 2028, 2029, 2030, 2031, 2032].map((year) => (
    <option key={year} value={year}>{year}</option>
  ))}
</select>

// Free Agent Type — writes string value to filters.freeAgentType
<select
  value={filters.freeAgentType ?? ''}
  onChange={(e) => update('freeAgentType', e.target.value)}
>
  <option value="">All</option>
  <option value="UFA">UFA</option>
  <option value="RFA">RFA</option>
  <option value="TO">Team Option</option>
  <option value="PO">Player Option</option>
  <option value="2W">Two-Way</option>
</select>

// Bird Rights — writes string value to filters.birdRights
<select
  value={filters.birdRights ?? ''}
  onChange={(e) => update('birdRights', e.target.value)}
>
  <option value="">All</option>
  {['None', 'Non-Bird', 'Early Bird', 'Bird', 'Two-Way'].map((br) => (
    <option key={br} value={br}>{br}</option>
  ))}
</select>
```

### 2. Predicate Analysis

**File**: `src/shared/utils/filtering/playerFilterUtils.js`

```javascript
// Lines 104-108 — freeAgentYear predicate
if (
  filters.freeAgentYear &&
  parseInt(p.freeAgentYear || 0) !== parseInt(filters.freeAgentYear)
) {
  return false;
}

// Lines 110-112 — freeAgentType predicate
if (filters.freeAgentType && p.freeAgentType !== filters.freeAgentType) {
  return false;
}

// ❌ NO birdRights predicate exists anywhere in the file
```

### 3. Player Data Analysis

**File**: `src/features/roster/utils/enrichPlayerData.js`

The return object (lines 270-309) does NOT include `freeAgentYear`, `freeAgentType`, or `birdRights` at the top level:

```javascript
return {
  ...playerData,
  name: playerData.bio?.displayName || '',
  formattedPosition,
  heightInInches: playerData.bio?.height || 0,
  weight: playerData.bio?.weight || 0,
  age,
  team: playerData.bio?.display?.team || null,
  headshotUrl: getHeadshotPath(playerData.bio?.playerId || playerData.id),
  offenseRole: evaluationData.roles?.offense1 || '—',
  defenseRole: evaluationData.roles?.defense1 || '—',
  shootingProfile,
  // ...
  primaryContract, // ← freeAgency data is NESTED inside this
  currentContractView: playerData.currentContractView, // ← freeAgency data is NESTED inside this
  // ...
  // ❌ NO freeAgentYear, freeAgentType, or birdRights at top level
};
```

### 4. Where the Data Actually Lives

From `firestore_staging/docs/players_v2_structure.md` (Toumani Camara example):

```json
{
  "bio": {
    "display": {
      "freeAgentYear": 2030, // ← HERE (number)
      "freeAgentType": "UFA" // ← HERE (string)
    }
  },
  "currentContractView": {
    "freeAgentYear": 2030, // ← OR HERE (number)
    "freeAgentType": "UFA", // ← OR HERE (string)
    "birdRights": {
      // ← Bird Rights is an OBJECT
      "status": "Bird",
      "eligibleFor": ["Bird Exception"]
    }
  }
}
```

### 5. Proof of Mismatch

| What Predicate Checks | What Data Has                     | Result                         |
| --------------------- | --------------------------------- | ------------------------------ |
| `p.freeAgentYear`     | `undefined` (field doesn't exist) | Always filters OUT all players |
| `p.freeAgentType`     | `undefined` (field doesn't exist) | Always filters OUT all players |
| `p.birdRights`        | N/A (no predicate)                | Filter does nothing            |

### 6. Additional Issue: Value Format Mismatch

Even if the predicates checked the correct path, there are format issues:

| Filter Value                  | Data Value                         | Match?                        |
| ----------------------------- | ---------------------------------- | ----------------------------- |
| `"2030"` (string from select) | `2030` (number in Firestore)       | ⚠️ Works due to `parseInt()`  |
| `"TO"` (Team Option)          | `"UFA"`, `"RFA"` (actual values)   | ❌ "TO" never appears in data |
| `"PO"` (Player Option)        | N/A                                | ❌ "PO" never appears in data |
| `"2W"` (Two-Way)              | `"TWO_WAY"` (enum value)           | ❌ Case/format mismatch       |
| `"Bird"`                      | `{ status: "Bird", ... }` (object) | ❌ Object vs string           |

---

## RUNTIME_SANITY_TABLE

Based on code analysis (no runtime test executed due to PREFLIGHT mode):

| Filter                | Expected Behavior                      | Actual Behavior                 | Status           |
| --------------------- | -------------------------------------- | ------------------------------- | ---------------- |
| Team (TopControlsBar) | Filters to selected team               | Works correctly                 | ✅               |
| Position              | Filters to position group              | Works correctly                 | ✅               |
| Height Min/Max        | Filters by height range                | Works correctly                 | ✅               |
| Weight Min/Max        | Filters by weight range                | Works correctly                 | ✅               |
| Age Min/Max           | Filters by age range                   | Works correctly                 | ✅               |
| Salary Min/Max        | Filters by salary range                | Works correctly                 | ✅               |
| **Free Agent Year**   | Filters to players FA in selected year | **Returns 0 players always**    | ❌               |
| **Free Agent Type**   | Filters to UFA/RFA/etc.                | **Returns 0 players always**    | ❌               |
| **Bird Rights**       | Filters to bird rights status          | **Does nothing (no predicate)** | ❌               |
| Offense Role          | Filters by offense role                | Works correctly                 | ✅               |
| Defense Role          | Filters by defense role                | Works correctly                 | ✅               |
| Shooting Profile      | Filters by shooting tier               | Works correctly                 | ✅               |
| SubRoles              | Filters by subrole tags                | Works correctly                 | ✅               |
| Stat Filters          | Filters by stat thresholds             | Works correctly                 | ✅               |
| Trait Filters         | Filters by trait grades                | Works correctly                 | ✅               |
| **Overall Grade**     | Filters by overall grade range         | **Does nothing (no predicate)** | ❌               |
| Badges                | Filters by badges                      | Works correctly                 | ✅               |
| Sort by REB           | Sorts by rebounds                      | Works correctly                 | ✅ (Fixed in 2F) |
| Sort by MIN           | Sorts by minutes                       | Works correctly                 | ✅ (Fixed in 2F) |
| Sort by 3PT%          | Sorts by 3P%                           | Works correctly                 | ✅ (Fixed in 2F) |

---

## TOP 5 BROKEN ITEMS

### 1. 🔴 Free Agent Year Filter — CRITICAL

- **UI**: `ContractFilters.jsx` → `filters.freeAgentYear`
- **Predicate**: `playerFilterUtils.js:104-108` checks `p.freeAgentYear`
- **Data**: Field does not exist at top level
- **Fix**: Either add `freeAgentYear` to `enrichPlayerData` return, OR change predicate to check `p.bio?.display?.freeAgentYear || p.currentContractView?.freeAgentYear`

### 2. 🔴 Free Agent Type Filter — CRITICAL

- **UI**: `ContractFilters.jsx` → `filters.freeAgentType`
- **Predicate**: `playerFilterUtils.js:110-112` checks `p.freeAgentType`
- **Data**: Field does not exist at top level
- **Additional Issue**: UI values ("TO", "PO", "2W") don't match data values ("UFA", "RFA", "TWO_WAY")
- **Fix**: Add `freeAgentType` to `enrichPlayerData`, AND fix value mapping in UI or predicate

### 3. 🔴 Bird Rights Filter — CRITICAL

- **UI**: `ContractFilters.jsx` → `filters.birdRights`
- **Predicate**: **NONE EXISTS**
- **Data**: Object `{ status: "Bird", eligibleFor: [...] }` not string
- **Fix**: Add predicate to `playerFilterUtils.js` that checks `p.currentContractView?.birdRights?.status` or `p.primaryContract?.birdRights?.status`

### 4. 🔴 Overall Grade Filter — HIGH

- **UI**: `OverallGradeFilter.jsx` → `filters.min_overall_grade` / `filters.max_overall_grade`
- **Predicate**: **NONE EXISTS**
- **Data**: `p.overallGrade` exists and is populated
- **Fix**: Add predicate to `playerFilterUtils.js` similar to trait filters

### 5. 🟡 MetadataFilters Team Dropdown — MEDIUM

- **UI**: `MetadataFilters.jsx` → `filters.team`
- **Issue**: Missing `valueKey="code"` prop on MultiSelectFilter
- **Result**: Emits slug (`"celtics"`) instead of code (`"BOS"`)
- **Mitigation**: Predicate has back-compat mapping via `TeamSlugToCode`
- **Fix**: Add `valueKey="code"` and `labelKey="teamName"` to match TopControlsBar

---

## RECOMMENDED FIX STRATEGY

### Option A: Enrich at Source (Preferred)

Add missing fields to `enrichPlayerData.js` return object:

```javascript
return {
  ...playerData,
  // Existing fields...

  // ADD these convenience fields for FA filtering:
  freeAgentYear:
    playerData.currentContractView?.freeAgentYear ||
    playerData.bio?.display?.freeAgentYear ||
    null,
  freeAgentType:
    playerData.currentContractView?.freeAgentType ||
    playerData.bio?.display?.freeAgentType ||
    null,
  birdRightsStatus: playerData.currentContractView?.birdRights?.status || null,
};
```

Then add birdRights and overallGrade predicates to `playerFilterUtils.js`.

### Option B: Fix Predicates Only (Faster, More Fragile)

Update predicates to check nested paths directly:

```javascript
// freeAgentYear
if (filters.freeAgentYear) {
  const playerFAYear =
    p.currentContractView?.freeAgentYear || p.bio?.display?.freeAgentYear;
  if (parseInt(playerFAYear || 0) !== parseInt(filters.freeAgentYear)) {
    return false;
  }
}
```

**Recommendation**: Option A is cleaner and follows the existing pattern of exposing convenience fields at top level.

---

## FILES REQUIRING CHANGES

| File                                                                         | Change Required                                                                               |
| ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `src/features/roster/utils/enrichPlayerData.js`                              | Add `freeAgentYear`, `freeAgentType`, `birdRightsStatus` to return                            |
| `src/shared/utils/filtering/playerFilterUtils.js`                            | Add `birdRights` and `overallGrade` predicates; optionally fix FA predicates if not enriching |
| `src/features/filters/FiltersPanel/FilterPanel/sections/ContractFilters.jsx` | Fix FA Type option values to match data ("UFA", "RFA", "TWO_WAY" instead of "TO", "PO", "2W") |
| `src/features/filters/FiltersPanel/FilterPanel/sections/MetadataFilters.jsx` | Add `valueKey="code"` `labelKey="teamName"` to Team filter                                    |
| `src/shared/utils/filtering/playerFilterDefaults.js`                         | Optionally add `min_overall_grade` and `max_overall_grade` defaults                           |

---

## APPENDIX: Complete File Paths

### Filter UI Components

- `src/features/table/PlayerTable/PlayerTableHeader/TopControlsBar.jsx`
- `src/features/filters/FiltersPanel/index.jsx`
- `src/features/filters/FiltersPanel/FilterPanel/index.jsx`
- `src/features/filters/FiltersPanel/FilterPanel/sections/MetadataFilters.jsx`
- `src/features/filters/FiltersPanel/FilterPanel/sections/ContractFilters.jsx`
- `src/features/filters/FiltersPanel/FilterPanel/sections/RoleFilters.jsx`
- `src/features/filters/FiltersPanel/FilterPanel/sections/PhysicalFilters.jsx`
- `src/features/filters/FiltersPanel/FilterPanel/sections/StatFilters.jsx`
- `src/features/filters/FiltersPanel/FilterPanel/sections/TraitFilters.jsx`
- `src/features/filters/FiltersPanel/FilterPanel/sections/OverallGradeFilter.jsx`
- `src/features/filters/FiltersPanel/FilterPanel/sections/BadgeFilters.jsx`
- `src/features/filters/FiltersPanel/FilterPanel/sections/ViewControls.jsx`

### Filter Logic

- `src/shared/utils/filtering/playerFilterUtils.js`
- `src/shared/utils/filtering/playerFilterDefaults.js`
- `src/features/table/hooks/useFilteredPlayers.js`

### Data Enrichment

- `src/features/roster/utils/enrichPlayerData.js`
- `src/shared/hooks/useSimplePlayerData.ts`

### Schema Reference

- `src/schemas/players_v2.ts`
- `firestore_staging/docs/players_v2_structure.md`
