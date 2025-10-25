# Contract Scraper Normalization Updates

## Overview

This document details the updates made to the player contract scraper to comply with the comprehensive specification for trade machine and cap manager readiness.

## Changes Made

### 1. Contract Type Classification (Section 1 of Spec)

#### Problem
The scraper was incorrectly classifying all rookie contracts as "ROOKIE SCALE CONTRACT" even when they were signed using non-scale mechanisms (Second Round Exception, MLE, etc.).

#### Solution
Updated `detectContractType()` and `detectContractTypeFromHeading()` functions to:
- Check the `signedUsing` field to determine if it's truly a 1st-round rookie scale deal
- Only set `isRookieScale = true` if the contract has "SCALE" in the title AND is not signed using Second Round, MLE, BAE, or minimum exceptions
- Distinguish between:
  - `"ROOKIE SCALE CONTRACT"` (1st round picks)
  - `"ROOKIE CONTRACT"` (other rookie deals like 2nd rounders)
  - `"DESIGNATED ROOKIE SCALE EXTENSION"` (must include "SCALE" in title)

**Example:**
- Bronny James: `signedUsing: "Second Round Rookie Exception"` → `"ROOKIE CONTRACT"`, `isRookieScale: false`
- Jalen Wilson: `Signing Method: MLE` → `"ROOKIE CONTRACT"`, `isRookieScale: false`

### 2. Per-Year Salary Row Enhancements (Section 2 of Spec)

#### Added Fields

**`optionUsed`**: String field capturing option exercise status from the table
- Format: `"Yes (Jun 28, 2025)"` for exercised options
- Format: `"No (Aug 2, 2025)"` for declined/voided options
- Extracted from "Option Used: Yes/No (date)" text in the salary table

**`guaranteeSchedule`**: Array of guarantee trigger dates
- Added `parseGuaranteeDetails()` function to extract guarantee triggers from page
- Added `enrichGuaranteeSchedules()` to attach schedules to partially guaranteed years
- Format:
```typescript
guaranteeSchedule: [
  {
    effectiveDate: "first regular season game 2025-26",
    guaranteedAmount: 381695,
    status: "Decision Pending",
    note: "Guarantees if not waived before first regular season game"
  },
  {
    effectiveDate: "2026-01-10",
    guaranteedAmount: 2221677,
    status: "Decision Pending",
    note: "Guarantees if not waived before Jan 10, 2026"
  }
]
```

#### Guarantee Amount Logic

Updated `parseSalaryTable()` to properly track partial guarantees:
- `guaranteed` = boolean, true only if `guaranteedAmount === salary`
- `guaranteedAmount` = the amount guaranteed RIGHT NOW (baseline, not future triggers)
- For team options exercised early but still partial: `guaranteed = false`, `guaranteedAmount = <current locked value>`

**Example - Jalen Wilson 2025-26:**
- Team option exercised (`optionUsed: "Yes (Jun 28, 2025)"`)
- Only $88,075 locked now → `guaranteedAmount: 88075`, `guaranteed: false`
- Future triggers in `guaranteeSchedule`

### 3. Player Option Policy (Section 2D of Spec)

#### Added `applyPlayerOptionPolicy()`
This function implements the house rule that live player options should be treated as guaranteed:
- Applied to years where `option === "PO"` AND `optionUsed` does not start with "No"
- Sets `guaranteed = true` and `guaranteedAmount = salary`

**Example - Austin Reaves 2027-28:**
- Has `option: "PO"` with no `optionUsed` value (still live)
- After policy: `guaranteed: true`, `guaranteedAmount: 14142857`

### 4. Extension Voiding Player Options (Section 3 - The Luka Rule)

#### Enhanced `normalizeContractVoidedOptions()`
When a new extension starts in the same season as an old PO:
- Marks the old PO year with `optionUsed: "No (date)"`
- Sets `guaranteed: false`, `guaranteedAmount: 0`
- Adds flags: `voidedByExtension: true`, `voidedOn: <date>`
- Recomputes `guaranteedValue`, `guaranteedYears`, `yearsRemaining` (excluding voided year)
- **Does NOT change** `totalValue` or `averageAnnualValue` (preserves headline numbers)

**Example - Luka Dončić:**
- Old contract 2026-27 PO gets voided by new extension starting same season
- PO year marked: `optionUsed: "No (2025-08-02)"`, `guaranteed: false`, `guaranteedAmount: 0`
- Old contract `guaranteedValue` recalculated to exclude that year
- Old contract `totalValue` stays at original $215,159,700

### 5. Signing Method Normalization (Section 8 of Spec)

#### Updated `parseCurrentContractMeta()` and `parseContractMetaFromTable()`
Added proper hyphenation restoration for exception names:
- `"Early Bird"` → `"Early-Bird Exception"`
- `"Mid Level"` → `"Mid-Level Exception"`
- `"Bi Annual"` → `"Bi-Annual Exception"`
- `"Non Bird"` → `"Non-Bird Exception"`

### 6. Max Contract Detection (Section 5 of Spec)

#### Updated `detectMaxContractInfo()`
- Prioritizes Cap % from the page when available
- Normalizes cap percentage to standard values (25, 30, 35)
- Eliminates "Supermax" label in favor of `"Max-35"` when cap % is actually 35%
- Format: `maxType: "Max-25" | "Max-30" | "Max-35"`

**Example - Luka Dončić:**
- Page shows `Cap %: 30.00`
- Result: `isMaxContract: true`, `maxType: "Max-30"`, `estimatedCapPercentage: 30`

## Testing

### Test Suite
Created `test_contract_normalization.ts` to validate key scenarios:

**✅ Luka Dončić Test:**
- Verifies DESIGNATED ROOKIE SCALE EXTENSION classification
- Validates extension voiding PO with correct `optionUsed` date
- Confirms max contract detection (Max-30)

**✅ Austin Reaves Test:**
- Validates VETERAN CONTRACT classification
- Confirms Early-Bird Exception hyphenation
- Verifies live player option treated as guaranteed

### Running Tests
```bash
# Parse all test cases
bash player-scrape/scripts/parse_all_tests.sh

# Run test suite
npx tsx player-scrape/scripts/test_contract_normalization.ts
```

## Remaining Work

To complete the full specification:

1. **Add test cases for:**
   - Bronny James (ROOKIE CONTRACT with partial guarantees)
   - Dean Wade (VETERAN EXTENSION with partial guarantee)
   - Jalen Wilson (TO exercised early with guarantee schedule)

2. **Agent Details Enhancement (Section 7):**
   - Support multiple agents in array format
   - Ensure proper name-to-agency matching

3. **Additional Validation:**
   - Verify `yearsRemaining` calculations with various edge cases
   - Test guarantee schedule parsing with more complex scenarios
   - Validate QO and cap hold calculations for RFAs

## Files Modified

- `player-scrape/scripts/parse_player.ts` - Main parser with all normalization logic
- `player-scrape/scripts/test_contract_normalization.ts` - Test suite (new)
- `player-scrape/scripts/parse_all_tests.sh` - Test helper script (new)

## Key Functions Added/Modified

- `detectContractType()` - Added `signedUsing` parameter for rookie scale detection
- `detectContractTypeFromHeading()` - Same as above for future contracts
- `parseGuaranteeDetails()` - NEW: Extracts guarantee schedules from page
- `enrichGuaranteeSchedules()` - NEW: Attaches schedules to salary years
- `applyPlayerOptionPolicy()` - NEW: Treats live PO as guaranteed
- `parseSalaryTable()` - Enhanced to capture `optionUsed` field
- `normalizeContractVoidedOptions()` - Enhanced for proper PO voiding
- `parseCurrentContractMeta()` - Enhanced signing method normalization
- `parseContractMetaFromTable()` - Same as above for future contracts
- `detectMaxContractInfo()` - Enhanced max type normalization

## Acceptance Criteria Status

| Requirement | Status | Notes |
|------------|--------|-------|
| DESIGNATED ROOKIE SCALE vs ROOKIE distinction | ✅ | Checks signing method |
| optionUsed field capture | ✅ | From salary table |
| guaranteeSchedule support | ✅ | Parses from Guaranteed Details |
| Current guaranteed amount (not future) | ✅ | Sets baseline only |
| Live PO treated as guaranteed | ✅ | House policy applied |
| Extension voiding PO (Luka rule) | ✅ | Fully implemented |
| totalValue preserved | ✅ | Never recalculated |
| guaranteedValue accurate | ✅ | Excludes voided years |
| Max contract normalization | ✅ | Cap % based, no "Supermax" |
| Signing method hyphenation | ✅ | Early-Bird, Mid-Level, etc. |
