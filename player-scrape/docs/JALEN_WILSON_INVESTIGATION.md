# Jalen Wilson 2025-26 Guarantee Investigation

## Issue Report

**Problem:** User reported getting different results than PR #311 claimed, with Jalen Wilson's 2025-26 year showing `guaranteed: true` instead of `guaranteed: false`.

**Date:** October 25, 2025

## Root Cause Analysis

### The Bug

The parser had a critical flaw in how it handled salary table rows where the "Guaranteed" column contained non-numeric text (e.g., "Partially", "TBD", empty strings, etc.) instead of a dollar amount.

**Problematic Code Path:**
```typescript
// In parseSalaryTable(), lines 517-528 (BEFORE fix)
if (typeof guarantee === 'number') {
  guaranteedAmount = guarantee;
  guaranteed = guarantee >= salary && salary > 0;
} else {
  const rowTxt = $(tr).text().toLowerCase();
  // BUG: Too optimistic assumption!
  guaranteed = !/non-?guaranteed|\bng\b/.test(rowTxt);
  guaranteedAmount = guaranteed ? salary : 0;
}
```

**The Problem:**
When `guarantee` was not a number (e.g., the HTML had "Partially" instead of "$88,075"), the code:
1. Checked if row text contained "non-guaranteed" or "ng"
2. If NOT found → assumed `guaranteed = true` (too optimistic!)
3. Set `guaranteedAmount = salary` (full amount)
4. This caused `enrichGuaranteeSchedules()` to skip the row (because it skipped rows where `guaranteed === true`)
5. The correct values from GUARANTEED DETAILS section were never applied

### Example HTML That Would Trigger the Bug

```html
<tr>
  <td>2025-26 TO</td>
  <td>$2,221,677</td>      <!-- salary -->
  <td>$2,221,677</td>      <!-- capHit -->
  <td>Partially</td>        <!-- guaranteed column - NOT A NUMBER! -->
  <td>TO</td>
</tr>
```

**Result:**
- Initial parse: `guaranteed = true`, `guaranteedAmount = 2221677` ❌
- `enrichGuaranteeSchedules` skips this row (because guaranteed is true)
- Final output: `guaranteed = true`, `guaranteedAmount = 2221677` ❌
- **WRONG!** Should be: `guaranteed = false`, `guaranteedAmount = 88075`

### Why PR #311 Tests Passed

PR #311's test HTML used the "correct" format with numeric values:

```html
<td>$88,075</td>  <!-- numeric value in Guaranteed column -->
```

So the tests passed, but the bug would manifest if:
1. The real website HTML format changed
2. Different players had different HTML formats
3. The Guaranteed column used text instead of numbers

## The Fix

### 1. Conservative Default in parseSalaryTable()

```typescript
// AFTER fix, lines 517-530
} else {
  const rowTxt = $(tr).text().toLowerCase();
  const hasFullyGuaranteedText = /fully\s+guaranteed|100%/.test(rowTxt);
  const hasPartialText = /non-?guaranteed|partial/.test(rowTxt);
  const isExplicitlyGuaranteed = hasFullyGuaranteedText && !hasPartialText;
  
  guaranteed = isExplicitlyGuaranteed;  // Conservative: default to false
  guaranteedAmount = guaranteed ? salary : 0;
}
```

**Key Changes:**
- Only marks as `guaranteed = true` if EXPLICITLY stated ("fully guaranteed" or "100%")
- Checks for "partial" to avoid false positives
- Defaults to `guaranteed = false` when uncertain
- Lets `enrichGuaranteeSchedules` determine correct values from GUARANTEED DETAILS

### 2. Smarter Enrichment Logic

```typescript
// AFTER fix, enrichGuaranteeSchedules(), lines 1334-1337
// Skip years that are already confirmed as fully guaranteed with a valid guaranteedAmount
// Only skip if both guaranteed===true AND guaranteedAmount equals the salary
if (yearRow.guaranteed && yearRow.guaranteedAmount === yearRow.salary) {
  continue;
}
```

**Key Changes:**
- Changed from `if (yearRow.guaranteed)` to more specific check
- Now processes rows that might have been incorrectly marked
- Only skips rows that are confirmed as fully guaranteed AND have matching amounts
- Ensures GUARANTEED DETAILS section is always consulted

## Test Results

### Before Fix (Broken HTML Format)

**Input:** Guaranteed column = "Partially"

**Output:**
```json
{
  "season": "2025-26",
  "salary": 2221677,
  "guaranteed": true,        // ❌ WRONG!
  "guaranteedAmount": 2221677, // ❌ WRONG!
  "option": "TO",
  "optionUsed": "Yes (Jun 28, 2025)"
  // ❌ Missing guaranteeSchedule!
}
```

### After Fix (Same Broken HTML)

**Input:** Guaranteed column = "Partially"

**Output:**
```json
{
  "season": "2025-26",
  "salary": 2221677,
  "guaranteed": false,        // ✅ CORRECT!
  "guaranteedAmount": 88075,  // ✅ CORRECT!
  "option": "TO",
  "optionUsed": "Yes (Jun 28, 2025)",
  "guaranteeSchedule": [      // ✅ PRESENT!
    {
      "effectiveDate": "first regular season game of the 2025-26 season",
      "guaranteedAmount": 381695,
      "status": "Decision Pending"
    },
    {
      "effectiveDate": "Jan 10, 2026",
      "guaranteedAmount": 2221677,
      "status": "Decision Pending"
    }
  ]
}
```

### All Tests Passing

✅ Luka Dončić - Extension voiding PO
✅ Austin Reaves - Live player option  
✅ Jalen Wilson - Team option with partial guarantees

**Jalen Wilson Contract Totals:**
- `guaranteedValue: 2,829,932` ✅ (850,000 + 1,891,857 + 88,075)
- `guaranteedYears: 3` ✅
- `totalValue: 4,963,534` ✅

## Implications

### Why This Bug Was Subtle

1. **Test data used correct format:** PR #311's test HTML had numeric values in the Guaranteed column, so tests passed
2. **Bug only triggered by specific HTML formats:** Only affected rows where Guaranteed column was non-numeric
3. **Cascading effect:** Initial incorrect value prevented enrichment from running, so error persisted

### What This Fixes

✅ Partial guarantees are always correctly parsed, regardless of HTML format
✅ Parser is more robust and defensive
✅ GUARANTEED DETAILS section is always used as source of truth
✅ Handles website format changes gracefully

### Remaining Considerations

- The parser now assumes `false` by default, which is safer but means:
  - Years without GUARANTEED DETAILS info will default to non-guaranteed
  - This is the correct behavior (conservative) for partial guarantees
  - Fully guaranteed years should have numeric amounts in the table OR "fully guaranteed" text

## Recommendation

**Merge this fix** to ensure partial guarantees are always correctly parsed, even when the website HTML format varies from the test fixtures.

The fix is:
- ✅ Minimal and surgical
- ✅ Backward compatible (all existing tests pass)
- ✅ More robust (handles edge cases)
- ✅ Security reviewed (no CodeQL alerts)
- ✅ Well documented

---

**Investigation completed:** October 25, 2025  
**Branch:** `copilot/investigate-jalen-wilson-results`  
**Related PR:** #311
