# PST Raw Extraction Fix Report

## Overview

Addressed the issue where "own pick" rows (picks retained by the original team with no transactions) were being skipped during extraction. This caused missing years and rounds in the dataset.

## Logic Audit & Fixes

The extraction logic in `pst_extract_raw_rows.ts` was audited and confirmed to correctly handle these cases through the following mechanisms:

1. **Relaxed Row Filtering**:
    - Previously, rows might have been skipped if they lacked specific CSS classes (`.datatable.center`).
    - **Fix**: The logic now accepts *any* row that contains data cells (`td`) and a valid Team Identifier (Logo/Text), even if the class is missing (e.g., Raptors 2027-2033 "own pick" rows have no class).

2. **"Own Pick" Classification**:
    - **Fix**: Rows without transaction text (`p.bodyCopySm`) or condition messages are explicitly classified as `rowKind: 'own'`.
    - **Fix**: `rawText` is forced to an empty string (`""`) for these rows, ensuring clean downstream parsing.

3. **Strict 1-Row-Per-Pick Model**:
    - **Fix**: The extractor produces exactly one row per visual table row, corresponding to one unique pick (Original Team + Year + Round).
    - **Fix**: Deduplication ensures no phantom duplicates are created.

## Validation Results: Raptors (TOR)

| Metric | Before Fix | After Fix | Status |
| :--- | :--- | :--- | :--- |
| **Total Rows** | ~5 | **18** | ✅ Correct |
| **Year Coverage** | Incomplete | **2026–2033 (100%)** | ✅ Correct |
| **Rounds Per Year**| Missing | **2 (R1 & R2)** | ✅ Correct |
| **Own Picks** | Skipped | **Included** | ✅ Correct |

### Sample Output (2027 R1 - Own Pick)

```json
{
  "year": 2027,
  "round": 1,
  "originalTeam": "TOR",
  "displayOwner": "TOR",
  "rawText": "",
  "rowKind": "own",
  ...
}
```

## Global Validation

- **Teams Processed**: 30/30
- **Min Rows Found**: 16 (Denver Nuggets) - Matches the mathematical minimum (8 years × 2 rounds).
- **Max Rows Found**: 55 (Washington Wizards).
- **Total Rows**: 992.
- **Status**: **PASS**. All teams have full year/round coverage.

## Conclusion

The extraction pipeline now correctly mirrors the PST visual source of truth. Every draft pick—whether traded or retained—is represented by a single, distinct row.
