# Issue #299 Fix: Parse Future Contract Metadata from Correct Section

## Problem

When parsing a SalarySwish player page with multiple salary tables (current contract + future extension), the parser was incorrectly copying all signing details from the current contract's metadata block to the future contract. This caused future contracts to misrepresent their signing information.

### Example of the Bug

A player with:
- **Current contract**: "Rookie Max Extension" signed July 1, 2020 with 5% trade kicker
- **Future extension**: "Supermax Extension" signed July 1, 2024 with no trade kicker

Would incorrectly output:
```json
{
  "contract": {
    "signedUsing": "Rookie Max Extension",
    "signingDate": "July 1, 2020",
    "tradeKicker": 5
  },
  "futureContract": {
    "signedUsing": "Rookie Max Extension",  // ❌ WRONG - copied from current
    "signingDate": "July 1, 2020",          // ❌ WRONG - copied from current
    "tradeKicker": 5                        // ❌ WRONG - copied from current
  }
}
```

## Solution

Added a new function `parseContractMetaFromTable()` that parses metadata from the specific section surrounding each table, rather than always using the current contract's metadata block.

### Implementation Details

**New Function:** `parseContractMetaFromTable($, table)`

**Strategy:**
1. Traverse preceding sibling elements of the table
2. Collect text until hitting a heading (h1-h6) or another table
3. Parse signing details from this localized text
4. Fall back to container scope if no preceding elements exist

**Key Parsing Logic:**
```typescript
// For future contracts, parse their own metadata
const futureMeta = parseContractMetaFromTable($, futureTable.table);

futureContract = {
  signedUsing: futureMeta.signedUsing,      // From future section
  signingTeam: futureMeta.signingTeam,      // From future section
  signingDate: futureMeta.signingDate,      // From future section
  tradeKicker: futureMeta.tradeKicker,      // From future section
  // ... other fields
};
```

## Result

After the fix, the same player correctly outputs:
```json
{
  "contract": {
    "signedUsing": "Rookie Max Extension",
    "signingDate": "July 1, 2020",
    "tradeKicker": 5
  },
  "futureContract": {
    "signedUsing": "Supermax Extension",    // ✅ CORRECT - from future section
    "signingDate": "July 1, 2024",          // ✅ CORRECT - from future section
    "tradeKicker": null                     // ✅ CORRECT - not copied
  }
}
```

## Files Changed

- **`player-scrape/scripts/parse_player.ts`**
  - Added `parseContractMetaFromTable()` function (78 lines)
  - Updated future contract parsing to use new function (4 lines modified)

## Testing

### Test Case 1: Player with Extension
Using `examples/page_with_extension.html`:

**Current Contract:**
- Signing Method: "Rookie Max Extension"
- Signing Date: "July 1, 2020"
- Trade Kicker: 5%

**Future Contract:**
- Signing Method: "Supermax Extension" ✅
- Signing Date: "July 1, 2024" ✅
- Trade Kicker: null ✅

### Test Case 2: Regular Player (No Extension)
Using `examples/page.html` (Austin Reaves):

- No `futureContract` field present ✅
- Regular contract parsing unchanged ✅

## Validation

```bash
# Test with extension example
cp player-scrape/examples/page_with_extension.html player-scrape/examples/page.html
PLAYER_ID="test" npm run parse-player

# Verify independent metadata
cat player-scrape/output/player.json | jq '.contract.signingDate, .futureContract.signingDate'
# Output:
# "July 1, 2020"
# "July 1, 2024"
```

## Impact

- **Scope:** Minimal, surgical fix
- **Backward Compatibility:** Fully maintained - regular contracts work exactly as before
- **Future Contracts:** Now accurately report their own signing information

## Related Documentation

- [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md) - Updated with new function details
- [MULTIPLE_CONTRACTS_PLAN.md](./MULTIPLE_CONTRACTS_PLAN.md) - Updated with metadata independence section
- [README.md](./README.md) - Updated with new capability note

## References

- Original Issue: #299
- PR: #[PR_NUMBER]
- Commit: c572bdf
