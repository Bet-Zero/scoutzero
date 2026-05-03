# PST Phase 1.3 Normalization Return Package

**Date**: 2026-01-17
**Phase**: 1.3 (Raw Row Normalization)
**Status**: COMPLETE

## 1. Summary

This phase enforced strict normalization on the PST raw row extraction process. The goal was to ensure that the "raw rows" produced by Phase 2 are fully representative of the visual state of PST team pages, specifically ensuring:

- **1 Row = 1 Pick**: Every visual row is extracted as a distinct object.
- **Team-Scoped**: Rows are extracted exactly as they appear on the team page (original team vs display owner).
- **Own Picks Included**: Rows representing a team's own pick (with no transaction text) are explicitly captured with `rowKind: "own"` and `rawText: ""`.
- **Minimum Coverage**: Enforced that every team has at least one Round 1 and one Round 2 row for every year from 2026 to 2033.

**What this phase explicitly does NOT do:**

- It does NOT parse the transaction text (no swap logic, no protection parsing).
- It does NOT resolve the final owner (only the "display owner" column).
- It does NOT build the ledger.

## 2. Files Changed / Created

- `/Users/brenthibbitts/Desktop/ScoutZero/team-scrape/draft-picks/scripts/pst/pst_extract_raw_rows.ts` (Audited & Verified)
- `/Users/brenthibbitts/Desktop/ScoutZero/team-scrape/draft-picks/scripts/pst/pst_validate_normalization.ts` (Created)

## 3. Extraction Guarantees

The system now guarantees:

1. **Completeness**: Use of `pst_validate_normalization.ts` proves that all 30 teams have rows for years 2026-2033.
2. **Density**: Every year for every team has at least 2 rows (Round 1 & Round 2), preventing "missing year" bugs.
3. **Own Picks**: Verified that "own picks" (empty rawText) are present when no trade occurred.
4. **Structure**: All rows conform to the normalized `PstRawRow` shape including `rowKind`.

## 4. Validation Results

Validation run against `data/pst/pst_raw_rows.json`:

- **Total Rows**: 992
- **Teams Processed**: 30/30
- **Years Covered**: 2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033
- **Row Density**:
  - Min: 16 rows (Denver Nuggets) - *Perfect minimum (8 years * 2 rounds)*
  - Max: 55 rows (Washington Wizards)
- **Constraint Check**: PASSED (All teams met the 2026-2033 coverage rule).

### Concrete Example: Toronto Raptors (TOR)

- **Total Rows**: 18
- **Coverage**: 2026-2033 fully present.
- **Breakdown**:
  - 2026: 4 rows (Multiple transactions)
  - 2027: 2 rows (Own picks found)
  - 2028-2033: 2 rows per year (mostly owns, some transactions)

## 5. Known Limitations

- **Text Parsing**: The `rawText` is still unstructured strings. Phase 3/4 is required to extract meaning.
- **Visual Accuracy**: Extraction relies on DOM classes (`.bodyCopySm`, `.textrightoflogo`). If PST changes their layout, extraction will break (standard scraping risk).
- **Conditionals**: "Condition not met" rows are captured but not yet logically handled; they are just marked as `rowKind: "condition_not_met"`.

## 6. Phase Status

**Phase 1.3 is COMPLETE.**
The raw data is now "ledger-ready" in terms of existence and scope. Next phases can proceed with parsing text without worrying about missing rows.
