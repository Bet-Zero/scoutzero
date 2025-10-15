# Fanspo Enrichment Integration Guide

## How Fanspo Enrichment Fits Into ScoutZero

The Fanspo draft pick enrichment is part of the team scraping pipeline in the `team-scrape/` folder. It enhances the draft pick data with critical information needed for trade validation and GM tools.

## Data Flow

```
┌─────────────────┐
│  SalarySwish    │
│  Team Page      │
└────────┬────────┘
         │ 1. Fetch HTML
         ↓
┌─────────────────┐
│  parse_team.ts  │
│  Basic Parsing  │
└────────┬────────┘
         │ 2. Extract picks
         ↓
┌─────────────────┐
│  Draft Picks    │
│  (Basic Data)   │
└────────┬────────┘
         │
         ↓
    ┌────────────┐
    │ FANSPO_    │
    │ ENRICH=1?  │
    └─────┬──────┘
          │ Yes
          ↓
┌─────────────────┐      ┌──────────────┐
│  Fanspo.com     │      │  Mock Data   │
│  (Live)         │  OR  │  (Testing)   │
└────────┬────────┘      └──────┬───────┘
         │ 3a. Fetch           │ 3b. Load
         ↓                     ↓
┌─────────────────────────────────┐
│  fetchFanspoTeamPicks()         │
│  Parse incoming/outgoing picks  │
└────────────────┬────────────────┘
                 │ 4. Parse HTML
                 ↓
┌─────────────────────────────────┐
│  EnrichedMap                    │
│  {year-round → enrichment data} │
└────────────────┬────────────────┘
                 │
                 ↓
┌─────────────────────────────────┐
│  mergeFanspoIntoPicks()         │
│  Add fromTeams/toTeams/protections│
└────────────────┬────────────────┘
                 │ 5. Merge
                 ↓
┌─────────────────────────────────┐
│  Draft Picks (Enriched)         │
│  • fromTeams: ["UTA"]           │
│  • toTeams: ["NOP"]             │
│  • protections: "Top 10..."     │
└────────────────┬────────────────┘
                 │
                 ↓
┌─────────────────────────────────┐
│  team.json                      │
│  Complete team data             │
└─────────────────────────────────┘
```

## Integration Points

### 1. Trade Machine Validation

The enriched pick data is used by the trade machine to:

**Validate Pick Ownership:**
```typescript
// Example usage in trade validation
function validatePickOwnership(pick: DraftPick, teamId: string): boolean {
  // Check if team actually owns this pick
  if (pick.toTeams && pick.toTeams.length > 0) {
    // Pick is outgoing - team doesn't own it
    return false;
  }
  
  if (pick.fromTeams && !pick.fromTeams.includes(teamId)) {
    // Pick is incoming but from another team
    return true; // Team will own it
  }
  
  return pick.status === 'own';
}
```

**Validate Pick Protections:**
```typescript
// Example: Check if pick can be traded
function canTradeProtectedPick(pick: DraftPick): boolean {
  // Stepien Rule: Can't trade consecutive unprotected firsts
  if (pick.protections && /protected/i.test(pick.protections)) {
    return true; // Protected picks are OK
  }
  return false; // Unprotected might violate Stepien
}
```

### 2. GM Tools Integration

The enriched data feeds into GM tools for:

**Draft Pick Inventory:**
```typescript
// Build complete pick inventory
function buildPickInventory(team: BaseTeamDoc) {
  return team.draftPicks.map(pick => ({
    year: pick.year,
    round: pick.round,
    source: pick.fromTeams ? pick.fromTeams.join(' or ') : 'Own',
    destination: pick.toTeams ? pick.toTeams.join(' or ') : null,
    protection: pick.protections || 'Unprotected',
    tradeable: !pick.toTeams // Can't trade if already traded away
  }));
}
```

**Trade Scenario Planning:**
```typescript
// Check available picks for trade
function getTradeableFirsts(team: BaseTeamDoc, year: number): DraftPick[] {
  return team.draftPicks.filter(pick => 
    pick.round === 1 &&
    pick.year === year &&
    !pick.toTeams && // Not already traded away
    pick.status === 'own' // Team owns it
  );
}
```

### 3. Cap Sheet Display

The enriched picks are displayed in the cap sheet interface:

**Pick Display Component:**
```jsx
function DraftPickRow({ pick }) {
  return (
    <tr>
      <td>{pick.year} Round {pick.round}</td>
      <td>
        {pick.fromTeams ? (
          <span>from {pick.fromTeams.join(' or ')}</span>
        ) : pick.toTeams ? (
          <span>to {pick.toTeams.join(' or ')}</span>
        ) : (
          <span>Own</span>
        )}
      </td>
      <td>{pick.protections || 'Unprotected'}</td>
      <td>
        {pick.tradeable ? (
          <button>Trade</button>
        ) : (
          <span className="text-gray-400">Already traded</span>
        )}
      </td>
    </tr>
  );
}
```

## Schema Alignment

The enriched fields align with the existing schema:

**In `team_scrape_schema.ts`:**
```typescript
export const DraftPick = z.object({
  year: z.number(),
  round: z.union([z.literal(1), z.literal(2)]),
  status: z.enum(['own', 'incoming', 'outgoing', 'contested', 'swap', 'unknown']),
  
  // Fanspo enrichment fields
  fromTeams: z.array(z.string()).optional(),  // ✅ Added
  toTeams: z.array(z.string()).optional(),    // ✅ Added  
  protections: z.string().optional(),         // ✅ Added
  
  // ... other fields
});
```

**In Trade Machine Types:**
```typescript
// src/utils/architect/tradeMachine/types.ts
interface DraftPick {
  year: number;
  round: 1 | 2;
  
  // Fanspo data integrates seamlessly
  fromTeams?: string[];  // Used for validation
  toTeams?: string[];    // Used for validation
  protection?: string;   // Used for Stepien Rule
}
```

## Usage Examples

### Example 1: Loading Team Data with Enrichment

```typescript
// In your data loading logic
async function loadTeamWithEnrichedPicks(teamCode: string) {
  // This assumes team.json was generated with FANSPO_ENRICH=1
  const teamData = await fetchTeamData(teamCode);
  
  // Enriched picks are ready to use
  const tradeable = teamData.draftPicks.filter(p => !p.toTeams);
  const incoming = teamData.draftPicks.filter(p => p.fromTeams);
  const outgoing = teamData.draftPicks.filter(p => p.toTeams);
  
  return { teamData, tradeable, incoming, outgoing };
}
```

### Example 2: Trade Validation

```typescript
// Validate a proposed trade
function validateDraftPickTrade(
  pick: DraftPick, 
  tradingTeam: string,
  receivingTeam: string
) {
  const errors: string[] = [];
  
  // Check ownership
  if (pick.toTeams?.includes(tradingTeam)) {
    errors.push(`${tradingTeam} doesn't own this pick (already traded to ${pick.toTeams.join(', ')})`);
  }
  
  // Check protections
  if (pick.protections && /top.*protected/i.test(pick.protections)) {
    errors.push(`Pick has protections: ${pick.protections}`);
  }
  
  // Check Stepien Rule (simplified)
  if (pick.round === 1 && !pick.protections) {
    // Check for consecutive unprotected firsts
    errors.push('Warning: Unprotected first round pick - verify Stepien Rule compliance');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}
```

### Example 3: UI Display

```typescript
// Format pick for display
function formatPickForDisplay(pick: DraftPick): string {
  const year = pick.year;
  const round = pick.round === 1 ? '1st' : '2nd';
  
  let ownership = 'Own';
  if (pick.fromTeams) {
    ownership = `from ${pick.fromTeams.join(' or ')}`;
  } else if (pick.toTeams) {
    ownership = `to ${pick.toTeams.join(' or ')}`;
  }
  
  let protection = '';
  if (pick.protections) {
    protection = ` (${pick.protections})`;
  }
  
  return `${year} ${round} Round ${ownership}${protection}`;
}

// Example output:
// "2027 1st Round from UTA (Top 10 protected, conveys 2028-2030 if not conveyed)"
// "2029 1st Round to NOP (Lottery protected)"
```

## Testing Integration

### Unit Tests
```bash
# Test Fanspo enrichment logic
npx tsx team-scrape/test_fanspo_enrichment.ts
```

### Integration Tests
```bash
# Test with mock data
FANSPO_ENRICH=1 FANSPO_MOCK=1 npm run parse-mock

# Verify output
cat team.json | jq '.draftPicks[] | select(.fromTeams or .toTeams)'
```

### Trade Machine Tests
```typescript
// In your trade machine tests
describe('Trade validation with Fanspo data', () => {
  it('rejects trading picks the team doesnt own', () => {
    const pick = {
      year: 2029,
      round: 1,
      toTeams: ['NOP'], // Already traded to NOP
      status: 'outgoing'
    };
    
    const result = validatePickTrade(pick, 'LAL', 'BOS');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('LAL doesn\'t own this pick');
  });
});
```

## Migration Path

If you have existing code that uses draft picks:

### Before (without Fanspo enrichment):
```typescript
// Limited information
const pick = {
  year: 2027,
  round: 1,
  status: 'contested'
};

// Had to guess ownership
const canTrade = pick.status === 'own'; // ❌ Might be wrong
```

### After (with Fanspo enrichment):
```typescript
// Complete information
const pick = {
  year: 2027,
  round: 1,
  status: 'contested',
  fromTeams: ['UTA'],
  protections: 'Top 10 protected, conveys 2028-2030 if not conveyed'
};

// Accurate validation
const canTrade = !pick.toTeams && pick.status === 'own'; // ✅ Accurate
```

## Best Practices

1. **Always use Fanspo enrichment** for production team data
2. **Use mock mode** for development and testing
3. **Validate enriched data** before using in trade logic
4. **Handle missing fields** gracefully (not all picks may have enrichment)
5. **Keep mock data updated** when Fanspo format changes

## Troubleshooting

### Issue: Picks not enriching

**Check:**
1. Is `FANSPO_ENRICH=1` set?
2. Is TEAM_SLUG and TEAM_ID correct?
3. In mock mode, does mock data exist for this team?
4. Check console for enrichment success/failure messages

### Issue: Wrong enrichment data

**Check:**
1. Verify team slug/ID match between config and mock data
2. Update mock data if Fanspo format has changed
3. Check for typos in team codes

### Issue: Integration errors

**Check:**
1. Schema version matches between scraper and consumer
2. Optional field handling in consuming code
3. Type definitions are up to date

## Resources

- **Documentation**: `FANSPO_ENRICHMENT.md` - Complete feature docs
- **Demo**: `FANSPO_DEMO.md` - Before/after examples
- **Tests**: `test_fanspo_enrichment.ts` - Unit tests
- **Mock Data**: `mock_fanspo_data.ts` - Sample responses
- **Schema**: `team_scrape_schema.ts` - Data structure

## Summary

The Fanspo enrichment seamlessly integrates with existing ScoutZero infrastructure:

✅ **Compatible** with existing schema
✅ **Optional** - can be enabled/disabled
✅ **Testable** with mock data
✅ **Documented** with examples
✅ **Validated** with unit tests

It provides the missing piece for accurate draft pick tracking and trade validation in the GM tools and trade machine.
