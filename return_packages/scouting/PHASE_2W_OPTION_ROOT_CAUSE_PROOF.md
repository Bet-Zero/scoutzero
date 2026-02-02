# PHASE 2W RETURN PACKAGE: Option Types Root-Cause Proof

**DATE**: 2026-02-01  
**STATUS**: ✅ COMPLETE  
**MASTER DOC**: `docs/scouting/SCOUTING_PLAYER_TABLE_MASTER_AUDIT.md`

---

## EXECUTIVE SUMMARY

**ROOT CAUSE IDENTIFIED**: The Option Types filter returns 0 players because:

1. **`enrichPlayerData` expects `contractsView.seasons[].optionType`** — but this field **DOES NOT EXIST** in current Firestore schema
2. **Option year→type mapping ONLY exists in the `contracts` subcollection** — which is **NOT fetched** by `useSimplePlayerData`
3. **`currentContractView.options[]` exists** with values like `["PO"]` or `["TO"]` — but has **NO year association**

**VERDICT**: This is a **DATA STRUCTURE GAP**, not a code bug. The option data exists in Firestore but cannot be accessed without either:

- **Solution A**: Denormalize option year mapping into `currentContractView` (Cloud Function update)
- **Solution B**: Fetch contracts subcollection in `useSimplePlayerData` (performance tradeoff)
- **Solution C**: Create `contractsView.seasons[]` as a new denormalized view

---

## RAW DATA PROBE RESULTS

### Firestore Structure Analysis

| Source Path                                      | Exists? | Count            | Contains Year Mapping?            |
| :----------------------------------------------- | :------ | :--------------- | :-------------------------------- |
| `currentContractView.options[]`                  | ✅ YES  | 260 players      | ❌ NO (just `["PO"]` or `["TO"]`) |
| `contractsView.seasons[].optionType`             | ❌ NO   | 0 players        | N/A                               |
| `contracts/{contractId}.salariesByYear[].option` | ✅ YES  | In subcollection | ✅ YES (e.g., `2025-26: PO`)      |

### Raw Option Value Breakdown

```
currentContractView.options values:
  "PO": 72 players
  "TO": 188 players
  Total: 260 players with option data
```

### Sample Players with Options

| Player        | ID            | currentContractView.options | Actual Option Years (subcollection) |
| :------------ | :------------ | :-------------------------- | :---------------------------------- |
| Aaron Gordon  | aaron_gordon  | `["PO"]`                    | 2025-26: PO, 2028-29: PO            |
| Aaron Wiggins | aaron_wiggins | `["TO"]`                    | 2028-29: TO                         |
| Ace Bailey    | ace_bailey    | `["TO"]`                    | 2027-28: TO, 2028-29: TO            |
| Al Horford    | al_horford    | `["PO"]`                    | 2026: PO                            |
| Alex Sarr     | alex_sarr     | `["TO"]`                    | 2026-27: TO, 2027-28: TO            |

---

## ENRICHED DATA ANALYSIS

### enrichPlayerData.js Logic (Lines 175-189)

The current enrichment tries to merge options from `contractsView.seasons`:

```javascript
// Merge option data from contractsView.seasons (has optionType field)
if (playerData.contractsView?.seasons) {
  const optionMap = {};
  playerData.contractsView.seasons.forEach((season) => {
    if (season.optionType && season.season) {
      // Extract start year from season string "2025-26" → 2025
      const yearNum = /* ... */;
      optionMap[yearNum] = season.optionType;
    }
  });
  // Merge into salariesArray...
}
```

**Problem**: `playerData.contractsView` is **always undefined** because this field doesn't exist in the current schema.

### optionByYear After Enrichment

| Metric                               | Count |
| :----------------------------------- | :---- |
| Players with ANY `optionByYear` keys | **0** |
| Players with `optionByYear[2025]`    | **0** |
| Option Types filter matches          | **0** |

---

## SOLUTION OPTIONS

### Option A: Denormalize to currentContractView (RECOMMENDED)

**Effort**: Medium (Cloud Function update)  
**Tradeoff**: Adds ~100 bytes per player doc

Add `optionsByYear` object to `currentContractView`:

```javascript
currentContractView: {
  // existing fields...
  optionsByYear: {
    2025: "PO",
    2028: "PO"
  }
}
```

Update `enrichPlayerData` to read from this field instead of `contractsView.seasons`.

### Option B: Fetch Contracts Subcollection

**Effort**: Low (code change only)  
**Tradeoff**: N+1 queries (one per player) — significant performance hit

Modify `useSimplePlayerData` to fetch `/players_v2/{id}/contracts` for each player.

### Option C: Create contractsView.seasons

**Effort**: Medium (Cloud Function + schema update)  
**Tradeoff**: Adds redundant denormalized view

Create the `contractsView.seasons[]` structure that enrichPlayerData already expects.

---

## DIAGNOSTICS ADDED

### FilterDiagnosticsPanel Enhancement

When `?debugFilters=1` is in the URL, a new **Option Coverage** section displays:

- **Raw Option Sources**: Counts for `currentContractView.options[]` and `contractsView.seasons[]`
- **Raw Option Values**: Breakdown of PO/TO values found
- **Enriched optionByYear**: Counts of enriched option data
- **Root Cause**: Automatic diagnosis (NO_RAW_DATA / ENRICHMENT_BUG / YEAR_MISMATCH / FILTER_BUG)
- **Sample Players**: First 5 players with raw options for debugging

---

## FILES CHANGED

| File                                                        | Change Type | Description                                                                 |
| :---------------------------------------------------------- | :---------- | :-------------------------------------------------------------------------- |
| `src/features/table/hooks/useFilterDiagnostics.js`          | MODIFIED    | Added `getOptionCoverageDiagnostics()` function and included in hook return |
| `src/features/table/PlayerTable/FilterDiagnosticsPanel.jsx` | MODIFIED    | Added `OptionCoverageSection` component to display option diagnostics       |

---

## VALIDATION

- ✅ `npm run build` passes
- ✅ No changes to PlayerRow
- ✅ No changes to virtualization/density/itemSize
- ✅ No changes to filter predicates
- ✅ All runtime instrumentation gated behind `?debugFilters=1`
- ✅ Diagnostics clearly shows the data gap

---

## NEXT STEPS

1. **Decision Required**: Choose solution A, B, or C
2. **If Solution A**: Create Cloud Function to populate `currentContractView.optionsByYear`
3. **If Solution A**: Update `enrichPlayerData.js` to read from new field
4. **Regression Test**: Add test with real player shape once data is available

---

## TEMP FILES TO DELETE

After this phase is complete:

- `plans/scouting-phase-2w-option-proof/temp/probe_option_data.js`
- `plans/scouting-phase-2w-option-proof/temp/probe_options_structure.js`
- `plans/scouting-phase-2w-option-proof/temp/trace_raw_data.js`
- `plans/scouting-phase-2w-option-proof/temp/infer_option_year.js`

---

## CONCLUSION

The Option Types filter returns 0 players because **option year→type mapping is not available in the main player document**. The data exists in the contracts subcollection but is not fetched. A schema change (denormalization) is required to enable this filter.

**Recommended path forward**: Implement Solution A — add `optionsByYear` to `currentContractView` via Cloud Function.
