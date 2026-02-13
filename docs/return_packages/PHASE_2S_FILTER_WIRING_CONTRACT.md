# PHASE 2S: Filter Wiring Contract — Return Package

| Field          | Value                  |
| -------------- | ---------------------- |
| Phase          | 2S                     |
| Title          | Filter Wiring Contract |
| Status         | ✅ COMPLETE            |
| Date           | 2025-01-31             |
| Requested By   | User                   |
| Implemented By | Copilot                |

---

## 1. Summary

Phase 2S establishes a **Filter Wiring Contract** for the scouting player table. This provides:

1. **Single Source of Truth** — A catalog documenting every filter key, its status, and how it maps to player data
2. **Contract Tests** — Vitest guardrails ensuring filter logic remains stable across refactors
3. **Fixture Players** — 8 enriched players covering key FA/bird rights/option combinations
4. **Dev Diagnostics Panel** — Real-time filter debugging via `?debugFilters=1` query param

---

## 2. Files Created

### 2.1 Filter Catalog

**Path:** `src/shared/utils/filtering/playerFilterCatalog.ts`

Single source of truth documenting 50+ filter entries with:

- `filterKey`: Key used in filter state object
- `playerField`: Corresponding field in enriched player object
- `status`: WIRED | STUB | DEPRECATED
- `predicateType`: string | number | array | boolean | nested | custom
- `uiControl`: Control type (text input, dropdown, slider, etc.)
- `notes`: Implementation details and edge cases

Helper functions:

- `getCatalogFilterKeys()` — Returns array of all filter keys
- `getRequiredPlayerFields()` — Returns fields needed for all wired filters
- `validatePlayerFields(player)` — Checks if player has required fields
- `getFiltersByStatus(status)` — Returns filters with given status

### 2.2 Fixture Players

**Path:** `src/tests/fixtures/players_enriched_minimal.json`

8 enriched players covering:

| ID                       | Name             | FA Year | FA Type | Bird Rights | Options |
| ------------------------ | ---------------- | ------- | ------- | ----------- | ------- |
| fixture-ufa-bird-opt     | Marcus Freeman   | 2025    | UFA     | Full Bird   | 2025 PO |
| fixture-rfa-early-no-opt | Jordan Chen      | 2026    | RFA     | Early Bird  | None    |
| fixture-ufa-non-bird-to  | DeShawn Williams | 2025    | UFA     | Non-Bird    | 2025 TO |
| fixture-rfa-bird-no-opt  | Tyler Jackson    | 2027    | RFA     | Full Bird   | None    |
| fixture-locked-no-fa     | Andre Thompson   | null    | null    | null        | None    |
| fixture-ufa-early-po     | Kevin Morrison   | 2025    | UFA     | Early Bird  | 2025 PO |
| fixture-two-way          | Marcus Bell      | 2025    | RFA     | Non-Bird    | None    |
| fixture-max-player       | James Carter     | 2028    | UFA     | Full Bird   | 2027 PO |

### 2.3 Contract Tests

**Path:** `src/tests/scouting/player_filters_wiring_contract.test.js`

Vitest test suite with 29 test cases covering:

- Identity & Basic Filters (nameSearch, team, position)
- Free Agency Filters (freeAgentYear, freeAgentType as string)
- Bird Rights Filters (birdRights as string: Full Bird, Early Bird, Non-Bird)
- Contract Option Filters (optionTypes array + salaryYear context)
- Grade Filters (min/max overall_grade)
- Age Filters (minAge/maxAge)
- Combined Filter Scenarios
- Edge Cases

**Key Discovery:** The filter API uses:

- `freeAgentType` and `birdRights` as **strings** (single-select dropdowns), not arrays
- `optionTypes` as an array, checked against `optionByYear[salaryYear]`
- Age filters use `minAge`/`maxAge` (camelCase)
- Grade filters use `min_overall_grade`/`max_overall_grade`

**Run tests:**

```bash
npm run test -- --run src/tests/scouting/player_filters_wiring_contract.test.js
```

### 2.4 Diagnostics Hook

**Path:** `src/features/table/hooks/useFilterDiagnostics.js`

React hook providing:

- Active filter detection (non-default values)
- Catalog entry lookup for active filters
- Reduction stats (total → filtered → removed)
- Uncataloged filter warnings
- Catalog coverage metrics

Returns `null` when debug mode is off for zero performance impact.

### 2.5 Diagnostics Panel

**Path:** `src/features/table/PlayerTable/FilterDiagnosticsPanel.jsx`

Fixed-position overlay panel showing:

- Reduction stats bar
- Active filter list with status badges
- Uncataloged filter warnings
- Catalog coverage progress bar
- Collapsible UI

---

## 3. Integration Required

### 3.1 PlayerTable Integration

Add to `src/features/table/PlayerTable/index.jsx`:

```jsx
// Add imports at top
import { FilterDiagnosticsPanel } from './FilterDiagnosticsPanel';
import { useFilterDiagnostics } from '../hooks/useFilterDiagnostics';

// Inside component, after filteredPlayers computation
const diagnostics = useFilterDiagnostics(players, filteredPlayers, filters);

// Before closing </div>, add panel
<FilterDiagnosticsPanel diagnostics={diagnostics} />;
```

---

## 4. Usage

### Run Contract Tests

```bash
npm run test -- --run src/tests/scouting/player_filters_wiring_contract.test.js
```

### Enable Debug Panel

Navigate to: `http://localhost:5173/players?debugFilters=1`

### Import Catalog Helpers

```javascript
import {
  PLAYER_FILTER_CATALOG,
  getCatalogFilterKeys,
  getRequiredPlayerFields,
  validatePlayerFields,
  getFiltersByStatus,
} from '@/shared/utils/filtering/playerFilterCatalog';
```

---

## 5. Validation Checklist

- [x] Run contract tests: All 29 tests pass
- [x] Build succeeds: `npm run build`
- [ ] Debug panel renders at `?debugFilters=1`
- [ ] Panel shows active filters when filters applied
- [ ] Panel shows reduction stats correctly
- [ ] Panel collapses/expands on header click
- [ ] Panel hidden when query param removed

---

## 6. Future Enhancements

1. **STUB → WIRED Migration** — Wire remaining stub filters as needed
2. **Per-Filter Reduction** — Show how many players each filter removes
3. **Filter Performance** — Add timing metrics to diagnostics
4. **Export Diagnostics** — Button to copy diagnostics as JSON

---

## 7. Related Phases

| Phase  | Title                      | Status          |
| ------ | -------------------------- | --------------- |
| 2Q     | Filter Audit               | ✅ Complete     |
| 2R     | Filter Infrastructure      | ✅ Complete     |
| **2S** | **Filter Wiring Contract** | **✅ Complete** |
| 2T     | Filter UI Polish           | 🔜 Planned      |

---

_Generated by Copilot — Phase 2S Filter Wiring Contract_
