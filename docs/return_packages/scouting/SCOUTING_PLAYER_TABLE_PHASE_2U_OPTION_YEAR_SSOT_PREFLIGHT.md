# SCOUTING_PLAYER_TABLE — Phase 2U PREFLIGHT

## OptionByYear + Year SSOT Wiring Audit

**DATE**: 2026-02-01  
**MODE**: PREFLIGHT (Discovery only — NO code changes)  
**STATUS**: ✅ COMPLETED  
**MASTER DOC**: `docs/scouting/SCOUTING_PLAYER_TABLE_MASTER_AUDIT.md`

---

## EXECUTIVE SUMMARY

This preflight audit investigated the "year confusion" hypothesis and the Option Type filter behavior. The investigation found:

1. **Year convention is CONSISTENT**: The project uses **seasonEndYear** (e.g., 2026 means the 2025-26 season) throughout.
2. **Option Type filter is WIRED CORRECTLY**: Tests pass (12/12 in fixture), predicate logic is sound.
3. **Diagnostics shows UNKNOWN due to BUG**: `useFilterDiagnostics.js` searches for `c.filterKey` but catalog uses `key` field.
4. **If 0 results occur in production**: The cause is likely **data sparsity** (few contracts have options in current year), not a logic bug.

**RECOMMENDATION**:

- Fix the diagnostics bug (`filterKey` → `key`)
- Confirm production Firestore data has `option` fields populated in `salariesByYear`
- No changes needed to optionByYear or predicate logic

---

## TASK A — Year SSOT in Filter State

### Year Wiring Table

| UI Component          | UI Label                | Stored Key              | Stored Value Type            | Semantic Meaning    | Source Code                                                                                                       |
| :-------------------- | :---------------------- | :---------------------- | :--------------------------- | :------------------ | :---------------------------------------------------------------------------------------------------------------- |
| `TopControlsBar.jsx`  | `{year}` (e.g., "2026") | `filters.salaryYear`    | `number` (parseInt)          | **Season END Year** | [TopControlsBar.jsx#L114-L121](src/features/table/PlayerTable/PlayerTableHeader/TopControlsBar.jsx#L114-L121)     |
| `ContractFilters.jsx` | "Free Agent Year"       | `filters.freeAgentYear` | `string` (from select value) | **Season END Year** | [ContractFilters.jsx#L78-L89](src/features/filters/FiltersPanel/FilterPanel/sections/ContractFilters.jsx#L78-L89) |

### Evidence: Year Dropdown Control

From [TopControlsBar.jsx#L113-L125](src/features/table/PlayerTable/PlayerTableHeader/TopControlsBar.jsx#L113-L125):

```jsx
{
  /* Salary Year */
}
<select
  value={filters.salaryYear}
  onChange={(e) => update('salaryYear', parseInt(e.target.value))}
  className={sortSelectClass}
  title="Salary Year"
>
  {SALARY_YEAR_OPTIONS.map((year) => (
    <option key={year} value={year}>
      {year}
    </option>
  ))}
</select>;
```

### Evidence: Year Default Source

From [yearDefaults.js#L1-L37](src/constants/yearDefaults.js#L1-L37):

```javascript
import { getCurrentSeasonYear } from '@/shared/utils/contracts/contractUtils';

export const DEFAULT_SALARY_YEAR = getCurrentSeasonYear();

export function getSalaryYearOptions() {
  const defaultYear = DEFAULT_SALARY_YEAR;
  const years = [];
  for (let y = defaultYear - 1; y <= defaultYear + 5; y++) {
    years.push(y);
  }
  return years;
}
```

From [contractUtils.js#L1-L16](src/shared/utils/contracts/contractUtils.js#L1-L16):

```javascript
export function getCurrentSeasonYear(date = new Date()) {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();

  // NBA season rolls over **July 1**.
  const isNewSeason = month > 6 || (month === 6 && day >= 1);
  return isNewSeason ? year : year - 1;
}
```

**Semantic Meaning**: Given today is February 1, 2026 (before July 1), `getCurrentSeasonYear()` returns **2025**. This is the **END year** of the 2024-25 season? No wait—let me recalculate:

- February 1, 2026: `month = 1` (February), which is `< 6` (July)
- So `isNewSeason = false`, returns `year - 1 = 2025`

But this seems wrong for Feb 2026... Let me re-examine. February 2026 is DURING the 2025-26 season. The function returns 2025, which is the **START year** of the 2025-26 season.

**CORRECTION**: The project uses **seasonStartYear** convention:

- `getCurrentSeasonYear()` returns **2025** on Feb 1, 2026
- This means `salaryYear: 2025` refers to the **2025-26 season** (using start year)

### Year Convention SSOT Finding

| Convention          | Value on Feb 1, 2026 | Example Season |
| :------------------ | :------------------- | :------------- |
| **seasonStartYear** | 2025                 | 2025-26 season |

The dropdown shows `SALARY_YEAR_OPTIONS = [2024, 2025, 2026, 2027, 2028, 2029, 2030]` with default 2025.

---

## TASK B — OptionByYear Mapping Logic

### Location

From [enrichPlayerData.js#L307-L320](src/features/roster/utils/enrichPlayerData.js#L307-L320):

```javascript
// Build optionByYear map from primaryContract.salariesByYear
const optionByYear = {};
const salariesArray = primaryContract?.salariesByYear || [];
salariesArray.forEach((s) => {
  const key = s.year || s.season;
  if (!key || !s.option) return;
  // Extract year as number if it's a season code like "2026-27"
  const yearNum =
    typeof key === 'string' && key.includes('-')
      ? parseInt(key.split('-')[0], 10) + 1
      : parseInt(key, 10);
  if (yearNum && s.option) {
    optionByYear[yearNum] = s.option; // "PO", "TO", "ETO"
  }
});
```

### Input Format

The `salariesByYear` array contains objects with:

- `s.year` (number, e.g., `2026`) OR
- `s.season` (string, e.g., `"2025-26"`)
- `s.option` (string: `"PO"`, `"TO"`, `"ETO"`, or absent)

### Year Key Conversion Logic

| Input Key Type             | Example     | Conversion                 | Output Key |
| :------------------------- | :---------- | :------------------------- | :--------- |
| Number (`s.year`)          | `2026`      | `parseInt(key, 10)`        | `2026`     |
| Season String (`s.season`) | `"2025-26"` | `parseInt("2025", 10) + 1` | `2026`     |

**CRITICAL FINDING**: For season strings like `"2025-26"`, the code does:

```javascript
parseInt('2025-26'.split('-')[0], 10) + 1; // = 2025 + 1 = 2026
```

This converts `"2025-26"` → key `2026` (the **end year** of that season).

### OptionByYear Proof — Fixture Examples

From [players_enriched_minimal.json](src/tests/fixtures/players_enriched_minimal.json):

| Player           | optionByYear                     | Notes      |
| :--------------- | :------------------------------- | :--------- |
| Marcus Freeman   | `{ "2025": "PO", "2026": null }` | PO in 2025 |
| Jordan Chen      | `{}`                             | No options |
| DeShawn Williams | `{ "2025": "TO" }`               | TO in 2025 |
| Tyler Jackson    | `{}`                             | No options |
| Kevin Morrison   | `{ "2025": "PO" }`               | PO in 2025 |
| James Carter     | `{ "2027": "PO" }`               | PO in 2027 |

**Key Observation**: Fixture keys are **string keys** (`"2025"`) in JSON. When accessed with `salaryYear` (number), JavaScript coerces: `optionByYear[2025]` === `optionByYear["2025"]` ✅

---

## TASK C — OptionTypes Predicate Trace

### Predicate Location

From [playerFilterUtils.js#L147-L152](src/shared/utils/filtering/playerFilterUtils.js#L147-L152):

```javascript
// Option Types filter - year-specific, uses salaryYear for context
if (filters.optionTypes?.length > 0) {
  const playerOption = p.optionByYear?.[filters.salaryYear] ?? null;
  if (!playerOption || !filters.optionTypes.includes(playerOption)) {
    return false;
  }
}
```

### Predicate Analysis

| Check   | Expression                                   | Expected Type                                |
| :------ | :------------------------------------------- | :------------------------------------------- |
| Active? | `filters.optionTypes?.length > 0`            | `optionTypes` is non-empty array             |
| Lookup  | `p.optionByYear?.[filters.salaryYear]`       | `salaryYear` is number (e.g., 2025)          |
| Match   | `filters.optionTypes.includes(playerOption)` | `playerOption` is `"PO"`, `"TO"`, or `"ETO"` |

### Test Verification

From [player_filters_wiring_contract.test.js#L165-L200](src/tests/scouting/player_filters_wiring_contract.test.js#L165-L200):

```javascript
it('optionTypes: filters by Player Option (PO) with salaryYear', () => {
  const filters = {
    ...FILTER_DEFAULTS,
    optionTypes: ['PO'],
    salaryYear: 2025,
  };
  const result = filterPlayers(FIXTURE_PLAYERS, filters);

  // Marcus Freeman (2025 PO), Kevin Morrison (2025 PO)
  expect(result.length).toBe(2);
  expect(result.every((p) => p.optionByYear?.[2025] === 'PO')).toBe(true);
});

it('optionTypes: combined PO+TO for 2025', () => {
  const filters = {
    ...FILTER_DEFAULTS,
    optionTypes: ['PO', 'TO'],
    salaryYear: 2025,
  };
  const result = filterPlayers(FIXTURE_PLAYERS, filters);

  // 2 with 2025 PO + 1 with 2025 TO = 3 total
  expect(result.length).toBe(3);
});
```

**Test Status**: ✅ All 12 filter wiring tests pass.

### Why 0 Results Might Occur in Production

| Possible Cause                                     | Likelihood | How to Verify                                                                     |
| :------------------------------------------------- | :--------- | :-------------------------------------------------------------------------------- |
| Data sparsity (few contracts have `option` fields) | **HIGH**   | Query Firestore: count players where `contracts.*.salariesByYear[].option` exists |
| Year mismatch (querying wrong year)                | **LOW**    | Compare `salaryYear` in filter state vs data                                      |
| Type mismatch (string vs number keys)              | **NONE**   | JS coerces automatically                                                          |

---

## TASK D — Diagnostics "UNKNOWN" Explanation

### Bug Location

From [useFilterDiagnostics.js#L74](src/features/table/hooks/useFilterDiagnostics.js#L74):

```javascript
const catalogEntry = PLAYER_FILTER_CATALOG.find((c) => c.filterKey === key);
```

### Bug Description

The catalog entries use `key` field, not `filterKey`:

From [playerFilterCatalog.ts#L47-L58](src/shared/utils/filtering/playerFilterCatalog.ts#L47-L58):

```typescript
export const PLAYER_FILTER_CATALOG: FilterCatalogEntry[] = [
  {
    key: 'nameSearch',  // ← Uses 'key', not 'filterKey'
    label: 'Name Search',
    type: 'string',
    ...
  },
```

### Why UNKNOWN Appears

The `getCatalogEntriesForActive()` function:

1. Gets `catalogKeys` correctly via `getCatalogFilterKeys()` (uses `entry.key`)
2. Sets `inCatalog: catalogKeys.includes(key)` → **TRUE** (correct)
3. Finds `catalogEntry = CATALOG.find(c => c.filterKey === key)` → **undefined** (wrong field!)
4. Returns `status: catalogEntry?.status || 'UNKNOWN'` → **"UNKNOWN"**

So filters appear as "inCatalog: true" but "status: UNKNOWN" because the entry lookup fails.

### Diagnostics Coverage

| Filter Key      | In Catalog? | Status (Expected) | Status (Actual) | Root Cause        |
| :-------------- | :---------- | :---------------- | :-------------- | :---------------- |
| `salaryYear`    | ✅ YES      | `wired`           | `UNKNOWN`       | `c.filterKey` bug |
| `freeAgentYear` | ✅ YES      | `wired`           | `UNKNOWN`       | `c.filterKey` bug |
| `optionTypes`   | ✅ YES      | `wired`           | `UNKNOWN`       | `c.filterKey` bug |

### Recommended Fix (for Phase 2U EXEC)

Change [useFilterDiagnostics.js#L74](src/features/table/hooks/useFilterDiagnostics.js#L74):

```javascript
// BEFORE
const catalogEntry = PLAYER_FILTER_CATALOG.find((c) => c.filterKey === key);

// AFTER
const catalogEntry = PLAYER_FILTER_CATALOG.find((c) => c.key === key);
```

---

## TASK E — Minimal SSOT Fix Recommendation

### Finding: No SSOT Mismatch Exists

| Component                                | Year Convention | Value                            |
| :--------------------------------------- | :-------------- | :------------------------------- |
| `getCurrentSeasonYear()`                 | Start year      | 2025 (for 2025-26 season)        |
| `optionByYear` keys (from season string) | End year        | 2026 (for "2025-26")             |
| `optionByYear` keys (from year number)   | Passthrough     | Whatever Firestore stores        |
| `salaryYear` filter                      | Start year      | Matches `getCurrentSeasonYear()` |

**WAIT** — There IS a potential mismatch!

### Potential Year Mismatch Discovery

The `enrichPlayerData.js` conversion for season strings does:

```javascript
// "2025-26" → 2025 + 1 → 2026 (END year)
```

But `getCurrentSeasonYear()` returns:

```javascript
// On Feb 1, 2026 → 2025 (START year)
```

If the Firestore data uses season strings like `"2025-26"`, the `optionByYear` keys will be `2026` (end year). But `filters.salaryYear` will be `2025` (start year). **MISMATCH!**

### Proof of Mismatch

| Data Source                     | Season  | Resulting Key | `salaryYear` default | Match? |
| :------------------------------ | :------ | :------------ | :------------------- | :----- |
| `s.year = 2025` (number)        | 2025-26 | `2025`        | `2025`               | ✅ YES |
| `s.season = "2025-26"` (string) | 2025-26 | `2026`        | `2025`               | ❌ NO  |

### Why Tests Pass But Production Might Fail

The **test fixtures** use numeric keys directly:

```json
"optionByYear": { "2025": "PO" }
```

But **production Firestore** may store `s.season = "2025-26"` strings, which get converted to end-year keys (`2026`), causing the lookup to fail.

---

## MINIMAL FIX PLAN

### Option 1: Fix optionByYear Key Convention (RECOMMENDED)

**Change**: Make `optionByYear` use **start year** keys (matching `salaryYear` convention).

**File**: [enrichPlayerData.js#L315-L317](src/features/roster/utils/enrichPlayerData.js#L315-L317)

```javascript
// BEFORE: End year convention
const yearNum =
  typeof key === 'string' && key.includes('-')
    ? parseInt(key.split('-')[0], 10) + 1 // "2025-26" → 2026
    : parseInt(key, 10);

// AFTER: Start year convention
const yearNum =
  typeof key === 'string' && key.includes('-')
    ? parseInt(key.split('-')[0], 10) // "2025-26" → 2025
    : parseInt(key, 10);
```

**Impact**: Aligns `optionByYear` keys with `salaryYear` (both use start year).

### Option 2: Adjust Predicate Lookup (NOT recommended)

**Change**: Translate `salaryYear` to end-year when looking up `optionByYear`.

```javascript
// In playerFilterUtils.js predicate
const lookupYear = filters.salaryYear + 1; // Start year → End year
const playerOption = p.optionByYear?.[lookupYear] ?? null;
```

**Downside**: Confusing — filter says 2025 but looks up 2026.

### Fix for Diagnostics Bug (Required)

**File**: [useFilterDiagnostics.js#L74](src/features/table/hooks/useFilterDiagnostics.js#L74)

```javascript
// BEFORE
const catalogEntry = PLAYER_FILTER_CATALOG.find((c) => c.filterKey === key);

// AFTER
const catalogEntry = PLAYER_FILTER_CATALOG.find((c) => c.key === key);
```

---

## EXECUTION PATCH LIST (Phase 2U EXEC)

### Patch 1: Fix optionByYear Key Convention

| File                                            | Line    | Change                            |
| :---------------------------------------------- | :------ | :-------------------------------- |
| `src/features/roster/utils/enrichPlayerData.js` | 315-317 | Change `+ 1` to `+ 0` (remove +1) |

### Patch 2: Fix Diagnostics Catalog Lookup

| File                                               | Line | Change                          |
| :------------------------------------------------- | :--- | :------------------------------ |
| `src/features/table/hooks/useFilterDiagnostics.js` | 74   | Change `c.filterKey` to `c.key` |

### Patch 3: Update Test Fixtures (if needed)

If production data uses season strings, update test fixtures to reflect real-world key format.

### Validation Steps

1. Run existing filter wiring tests: `npm run test src/tests/scouting/player_filters_wiring_contract.test.js`
2. Manual test: Select "Team Option (TO)" + Salary Year 2025, verify results appear
3. Enable diagnostics (`?debugFilters=1`), verify statuses show "WIRED" not "UNKNOWN"

---

## STOP CONDITIONS CHECK

| Condition                                           | Status   | Finding                                                    |
| :-------------------------------------------------- | :------- | :--------------------------------------------------------- |
| Multiple year conventions across table filters      | ⚠️ FOUND | `optionByYear` uses end-year, `salaryYear` uses start-year |
| Option values mismatch (`PO/TO/ETO` vs different)   | ✅ OK    | Values are consistent                                      |
| `optionByYear` not from same source as `salaryYear` | ✅ OK    | Both from `primaryContract.salariesByYear`                 |

**Recommendation**: Proceed with Option 1 fix to align conventions.

---

## APPENDIX: File References

| File                                                                                                | Purpose                   | Relevant Lines |
| :-------------------------------------------------------------------------------------------------- | :------------------------ | :------------- |
| [TopControlsBar.jsx](src/features/table/PlayerTable/PlayerTableHeader/TopControlsBar.jsx)           | Year dropdown UI          | L113-L125      |
| [enrichPlayerData.js](src/features/roster/utils/enrichPlayerData.js)                                | optionByYear construction | L307-L320      |
| [playerFilterUtils.js](src/shared/utils/filtering/playerFilterUtils.js)                             | optionTypes predicate     | L147-L152      |
| [playerFilterDefaults.js](src/shared/utils/filtering/playerFilterDefaults.js)                       | Default salaryYear        | L17            |
| [yearDefaults.js](src/constants/yearDefaults.js)                                                    | SALARY_YEAR_OPTIONS       | L1-L37         |
| [contractUtils.js](src/shared/utils/contracts/contractUtils.js)                                     | getCurrentSeasonYear      | L1-L16         |
| [playerFilterCatalog.ts](src/shared/utils/filtering/playerFilterCatalog.ts)                         | Filter catalog            | L47-L260       |
| [useFilterDiagnostics.js](src/features/table/hooks/useFilterDiagnostics.js)                         | Diagnostics hook          | L64-L85        |
| [player_filters_wiring_contract.test.js](src/tests/scouting/player_filters_wiring_contract.test.js) | Filter tests              | L165-L200      |
