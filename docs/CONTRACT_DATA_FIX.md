# Contract Data Year Format Fix

## Issue Summary

Players in the trade machine were showing incorrect contract salaries:
- LeBron James: $0 instead of actual salary
- Luka Dončić: $14.3M instead of ~$46M

## Root Cause

**Year Format Inconsistency**: The contract data pipeline and lookup functions were using different year formats:

1. **Contract Parser**: Stored data using START YEAR format
   - "2025-26" season → stored as year `2025`
   
2. **Contract Lookup Functions**: Expected END YEAR format  
   - "2025-26" season → expected year `2026`

3. **Data Structure Mismatch**: Parser output wasn't transformed to expected format
   - Generated: `contract.annual_salaries` array
   - Expected: `contract_clean.salaries_by_year` object

## Solution

### 1. Contract Parser (`parse_contract_data_enhanced.py`)

**Before:**
```python
year = int(year_match.group(1))  # 2025 for "2025-26"
salaries.append({"year": year, "salary": salary})
```

**After:**
```python
start_year = int(year_match.group(1))
end_year = start_year + 1  # Convert to end year format
salaries.append({"year": end_year, "salary": salary})  # 2026 for "2025-26"
```

### 2. Upload Script (`populate-firestore-data.js`)

Added contract data transformation:

```javascript
const transformContractData = (player) => {
  if (!player.contract?.annual_salaries) return player;

  // Convert array to object with end year keys
  const salaries_by_year = {};
  player.contract.annual_salaries.forEach(salary => {
    salaries_by_year[salary.year] = {
      salary: salary.salary,
      guaranteed: salary.guaranteed,
      likely_bonus: 0,
    };
  });

  return {
    ...player,
    contract_clean: { salaries_by_year, /* ... */ }
  };
};
```

### 3. Year Format Standardization

**Consistent Usage:**
- GMDashboard: Uses `getDefaultSeasonEndYear()` → returns `2026` ✅
- Contract Lookups: Expect end year format → `2026` ✅  
- Trade Machine: Passes `currentYear` consistently → `2026` ✅

## Data Flow

```
[Scraped "2025-26 Contract] 
        ↓
[Parser: Extract 2025 → Convert to 2026]
        ↓  
[Upload: Transform to contract_clean.salaries_by_year[2026]]
        ↓
[App: GMDashboard currentYear = 2026]
        ↓
[Trade Machine: getSalaryForYear(player, 2026)]
        ↓
[✅ Returns correct current season salary]
```

## Testing

All tests pass with the fix:
- `contractSalaryUtils.test.js`: 10/10 ✅
- `tradeHelpers.test.js`: 6/6 ✅  
- `contractFixValidation.test.js`: 3/3 ✅
- `yearLogicIntegration.test.js`: 2/2 ✅

## Next Steps

1. **Re-run Data Pipeline**: Update Firestore with correctly formatted contract data
2. **Verify Extension Data**: Ensure extension data is restored with the fixed parser
3. **Monitor Trade Machine**: Confirm all players show correct salaries

## Files Modified

- `data_pipeline/helpers/contracts/parse_contract_data_enhanced.py`
- `scripts/populate-firestore-data.js`
- Added comprehensive test files for validation

## Key Insight

The NBA season "2025-26" spans from July 2025 to June 2026. The **end year (2026)** is the canonical identifier for contract storage and lookups, ensuring consistency across the entire application.