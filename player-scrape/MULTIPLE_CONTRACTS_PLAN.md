# Multiple Contracts - Implementation Plan

## Issue

The current parser does not handle players with **multiple contracts**:
- Current contract (active now)
- Future extension (signed but starts in a future season)

### Examples
- **Jayson Tatum**: Currently on rookie extension, signed supermax extension starting 2025-26
- **Luka Doncic**: On rookie extension, signed designated extension starting 2026-27
- **Tyrese Maxey**: On rookie scale, signed extension starting 2025-26

## Current Behavior

The parser only extracts the **first salary table** it finds on the page. If a player has:
1. Current contract table (2024-25 to 2025-26)
2. Future extension table (2026-27 to 2030-31)

Only contract #1 is parsed.

## Proposed Solutions

### Option 1: Parse Active Contract Only (Current Approach)
**Pros:**
- Simple, works for most players
- Matches architect's need for "current season" data
- Less complexity

**Cons:**
- Misses future extensions
- Can't plan for contract transitions
- Incomplete data for multi-season planning

### Option 2: Parse All Contracts, Flag Active One
**Schema Change:**
```typescript
{
  contract: {
    // Current active contract
    isActive: true,
    contractType: "ROOKIE SCALE",
    salariesByYear: [...],
    ...
  },
  futureContract: {
    // Future extension (if exists)
    isActive: false,
    startsOn: "2026-27",
    contractType: "DESIGNATED EXTENSION",
    salariesByYear: [...],
    ...
  }
}
```

**Pros:**
- Complete data
- Supports multi-season planning
- Shows full contract picture

**Cons:**
- Schema complexity
- Requires detecting multiple tables
- Merging logic when contracts overlap

### Option 3: Merge All Years Into One Contract
**Schema:**
```typescript
{
  contract: {
    salariesByYear: [
      { season: "2024-25", salary: 10M, contractId: "current" },
      { season: "2025-26", salary: 12M, contractId: "current" },
      { season: "2026-27", salary: 45M, contractId: "extension" },
      { season: "2027-28", salary: 48M, contractId: "extension" },
      ...
    ],
    contracts: [
      { id: "current", type: "ROOKIE SCALE", years: 2024-2026 },
      { id: "extension", type: "SUPERMAX", years: 2026-2031 }
    ]
  }
}
```

**Pros:**
- Single unified view
- Easy to query by season
- Natural for multi-season planning

**Cons:**
- Contract metadata split across fields
- Harder to validate individual contracts

## Recommended Approach: Option 2

Extend schema with optional `futureContract` field:

```typescript
export const basePlayerSchema = z.object({
  // ... existing fields ...
  contract: ContractSchema,
  futureContract: ContractSchema.optional(), // ← NEW
});
```

### Detection Logic

```typescript
// Find all salary tables
const salaryTables = $('table').filter((i, el) => {
  return $(el).text().includes('Season') && $(el).text().includes('Salary');
});

if (salaryTables.length > 1) {
  // Multiple contracts exist
  const currentContract = parseSalaryTable(salaryTables.eq(0), $);
  const futureContract = parseSalaryTable(salaryTables.eq(1), $);
  
  // Determine which is active based on seasons
  const currentYear = 2025;
  if (parseInt(futureContract.startSeason) > currentYear) {
    return { contract: currentContract, futureContract };
  }
}
```

### Parser Updates Needed

1. **Detect multiple salary tables** in `parse_player.ts`
2. **Parse each table separately** with same logic
3. **Determine active vs future** based on season years
4. **Update schema** to include optional `futureContract`
5. **Update validation** in `validate_player.ts`
6. **Test with players** who have extensions:
   - Jayson Tatum
   - Tyrese Maxey
   - Scottie Barnes

## Implementation Steps

1. [ ] Update `player_scrape_schema.ts` - add optional `futureContract` field
2. [ ] Modify `parse_player.ts` - detect and parse multiple tables
3. [ ] Update `validate_player.ts` - handle optional future contract
4. [ ] Create test HTML with multiple contracts
5. [ ] Test with real SalarySwish pages (Tatum, Maxey, Barnes)
6. [ ] Update README with multiple contract examples
7. [ ] Document in COMPLETION_SUMMARY

## Example Output (After Implementation)

```json
{
  "playerId": "jayson_tatum",
  "displayName": "Jayson Tatum",
  "contract": {
    "contractType": "DESIGNATED ROOKIE EXTENSION",
    "startSeason": "2020-21",
    "endSeason": "2024-25",
    "salariesByYear": [
      { "season": "2024-25", "salary": 34848340, ... }
    ],
    ...
  },
  "futureContract": {
    "contractType": "DESIGNATED SUPERMAX EXTENSION",
    "startSeason": "2025-26",
    "endSeason": "2029-30",
    "salariesByYear": [
      { "season": "2025-26", "salary": 54126480, ... },
      { "season": "2026-27", "salary": 58456560, ... },
      ...
    ],
    ...
  }
}
```

## Testing Strategy

### Test Cases
1. **No extension**: LeBron James (current contract only)
2. **With extension**: Jayson Tatum (current + future)
3. **Extension starting same year**: Some players signed mid-season
4. **Overlapping years**: Edge case validation

### Validation
- Ensure `futureContract.startSeason` > `contract.endSeason` (or equal for same-year)
- Validate both contracts have complete salary data
- Check poison pill rules apply to correct contract
- Verify trade eligibility uses active contract
