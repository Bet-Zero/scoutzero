# PST Phase 12.3A Push Base Pick Rules — Hotfix Return Package

**Date:** 2026-01-31  
**Status:** ✅ COMPLETE  
**Script:** `npm run pst:push:base-pick-rules`

---

## Summary

Fixed `pst_phase_12_3a_push_base_pick_rules.ts` to handle missing or variant `protectedRange` shapes in the source ledger. The script now completes successfully without crashing.

---

## Root Cause

The crash was caused by:

```
TypeError: Cannot read properties of undefined (reading 'start')
at transformProtection(...)
```

The `LedgerProtection` type declared `protectedRange: { start: number; end: number }` as required, but some protection entries in `pst_pick_ledger_final_2026_2033.json` did not include this field.

**Example problematic entry (MIA_2027_1st):**

```json
{
  "type": "lottery",
  "description": "lottery protected",
  "appliesToYears": [2024, 2027, 2028],
  "evidenceRowRefs": ["r9"]
}
```

This entry has no `protectedRange` field at all.

---

## Protection Shapes Encountered

| Shape                          | Example                | Handling                 |
| ------------------------------ | ---------------------- | ------------------------ |
| Object with `start`/`end`      | `{ start: 1, end: 4 }` | ✅ Convert to `"1-4"`    |
| String range                   | `"9-30"`               | ✅ Normalize to `"9-30"` |
| Description with range         | `"protected #9-30"`    | ✅ Extract `"9-30"`      |
| Description with "Top N"       | `"protected top 4"`    | ✅ Convert to `"1-4"`    |
| Lottery type (no range)        | `type: "lottery"`      | ✅ Default to `"1-14"`   |
| Missing range + no description | —                      | ⚠️ Skip (log first 5)    |

---

## Parsing Statistics

From the successful run:

| Metric                          | Count |
| ------------------------------- | ----- |
| Total protections encountered   | 88    |
| Protections parsed successfully | 88    |
| Protections skipped             | 0     |

All protections were successfully parsed with no skips required.

---

## Command Output (Excerpt)

```
$ FIRESTORE_EMULATOR_HOST=127.0.0.1:8082 npm run pst:push:base-pick-rules

> scoutzero-final2@0.0.1 pst:push:base-pick-rules
> npx tsx team-scrape/draft-picks/scripts/pst/pst_phase_12_3a_push_base_pick_rules.ts

[push] Emulator mode: projectId=scoutzero-bf1ae

=== Push Base Pick Rules ===
Input: /Users/.../data/pst/pst_pick_ledger_final_2026_2033.json
Total picks in ledger: 480
Picks with rules: 125

Sample doc IDs: ATL_2026_1st, CHA_2026_1st, CLE_2026_1st, HOU_2026_1st, IND_2026_1st
✅ Batch 1/1 committed (125 docs)

🎉 Base pick rules push complete. 125 docs written.

=== Protection Parsing Summary ===
Total protections encountered: 88
Protections parsed successfully: 88
Protections skipped: 0
```

---

## Emulator Verification

Confirmed documents in `architect_basePickRules` collection:

### Sample 1: `ATL_2026_2nd` (range protection)

```json
{
  "protections": [
    {
      "type": "range",
      "protectedRange": "43-60",
      "appliesToYears": [2023, 2026],
      "description": "protected #43-60"
    }
  ]
}
```

### Sample 2: `MIA_2027_1st` (lottery protection - previously crashing)

```json
{
  "protections": [
    {
      "type": "lottery",
      "protectedRange": "1-14",
      "appliesToYears": [2024, 2027, 2028],
      "description": "lottery protected"
    }
  ]
}
```

### Sample 3: `CHA_2026_2nd` (top_n protections)

```json
{
  "protections": [
    {
      "type": "top_n",
      "protectedRange": "1-18",
      "appliesToYears": [2021, 2022, 2023, 2024, 2025, 2026, 2027],
      "description": "protected top 18"
    }
  ]
}
```

---

## Files Changed

| File                                                                                                                                                                   | Change                                                                                                                                                                     |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [team-scrape/draft-picks/scripts/pst/pst_phase_12_3a_push_base_pick_rules.ts](../../../../team-scrape/draft-picks/scripts/pst/pst_phase_12_3a_push_base_pick_rules.ts) | Made `protectedRange` optional in type; added `parseProtectedRange()` with priority-based parsing; added `stripUndefined()` utility; added diagnostic counters and logging |

---

## Changes Summary

1. **Type Definition**: Changed `LedgerProtection.protectedRange` from required `{ start: number; end: number }` to optional `any` to handle variant shapes.

2. **Range Parsing**: Added `parseProtectedRange()` function with priority-based parsing:
   - Object with numeric `start`/`end` → `"start-end"`
   - String containing range pattern → normalize
   - Description containing range → extract
   - Lottery type → default `"1-14"`
   - "Top N" in description → `"1-N"`

3. **Undefined Handling**: Added `stripUndefined()` utility to remove undefined properties before Firestore writes (prevents "Cannot use undefined as a Firestore value" errors).

4. **Filtering**: Updated `transformProtection()` to return `null` for unparseable protections; `transformLedgerPick()` filters these out.

5. **Diagnostics**: Added counters (`protectionsTotal`, `protectionsParsed`, `protectionsSkipped`) with limited logging (first 5 skipped examples) and end summary.

---

## Acceptance Criteria

- [x] No crash when `protectedRange` is missing or non-object
- [x] Push completes successfully
- [x] Skipped protections are counted and minimally logged
- [x] Emulator shows `architect_basePickRules` populated with 125 docs
