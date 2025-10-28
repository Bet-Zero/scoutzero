# Player Option (PO) Voiding by Extension

## Overview

When a player signs a new extension that starts in the same season as a player option (PO) in their current contract, the PO is effectively voided. This document explains how the parser detects and handles this scenario.

## Problem Statement

Prior to this feature, the parser would:
- Mark the PO year as guaranteed (incorrect when voided by extension)
- Include the PO salary in the `guaranteedValue` total (incorrect)
- Count the PO year in `yearsRemaining` and `guaranteedYears` (incorrect)
- Not track when/why the option was voided

## Solution

The parser now includes a **post-parse normalizer** (`normalizeContractVoidedOptions`) that:
1. Detects when a future extension starts in the same season as a PO in the current contract
2. Marks the PO year as voided with comprehensive metadata
3. Recomputes contract totals to exclude the voided season

## Implementation Details

### Detection Logic

```typescript
function normalizeContractVoidedOptions(
  currentContract: any,
  futureContract: any | undefined,
  pageText: string
): void {
  // 1. Check if future contract exists
  if (!futureContract) return;
  
  // 2. Find PO year that matches future contract start season
  const futureStartSeason = futureContract.startSeason;
  const poYear = currentContract.salariesByYear.find(
    (y: any) => y.season === futureStartSeason && y.option === 'PO'
  );
  
  // 3. If match found, mark as voided
  if (poYear) {
    poYear.guaranteed = false;
    poYear.guaranteedAmount = 0;
    poYear.voidedByExtension = true;
    // ... additional metadata
  }
}
```

### Fields Added

#### SalaryYear Schema
- `optionUsed?: string` - Tracks when option was used/declined (e.g., "No (2025-08-02)")
- `voidedByExtension?: boolean` - Indicates PO was voided by extension
- `voidedOn?: string` - ISO date when option was voided

#### Contract Schema
- `supersededIn?: string` - Season when contract is superseded (e.g., "2026-27")
- `supersededByContractRef?: string` - Reference to superseding contract
- `isMaxContract?: boolean` - Whether contract is a max contract
- `maxType?: string` - Max contract type: "Max-25", "Max-30", or "Max-35"
- `estimatedCapPercentage?: number` - Cap percentage (read from page when available)

### Recomputation

After marking a PO as voided, the parser recomputes:

```typescript
// Exclude voided years from guaranteed totals
currentContract.guaranteedValue = currentContract.salariesByYear
  .filter((y: any) => !y.voidedByExtension)
  .reduce((sum: number, y: any) => sum + (y.guaranteedAmount || 0), 0);

currentContract.guaranteedYears = currentContract.salariesByYear
  .filter((y: any) => !y.voidedByExtension && y.guaranteed)
  .length;

// Recompute years remaining excluding voided season
const endSeason = currentContract.salariesByYear
  .filter((y: any) => !y.voidedByExtension)
  .slice(-1)[0]?.season;
// ... calculate years remaining from endSeason
```

## Max Contract Normalization

The parser also normalizes max contract detection:

### Old Behavior
- Used generic labels: "Supermax", "Veteran Max", "Rookie Max"
- Estimated cap% from salary amounts (often incorrect)

### New Behavior
- Reads `Cap %` directly from SalarySwish page when available
- Uses consistent taxonomy:
  - `"Max-25"` - 25% of cap (8-9 years of service)
  - `"Max-30"` - 30% of cap (7-9 years, designated rookie extension)
  - `"Max-35"` - 35% of cap (10+ years, supermax)
- Falls back to estimation only when page value not available

```typescript
// Try to extract cap% from the page
const capMatch = containerText.match(/Cap\s*%\s*:\s*(\d+(?:\.\d+)?)/i);
if (capMatch) {
  pageCapPercentage = parseFloat(capMatch[1]);
}

// Determine maxType based on cap percentage
if (pageCapPercentage >= 32.5) {
  maxType = 'Max-35';
} else if (pageCapPercentage >= 27.5) {
  maxType = 'Max-30';
} else if (pageCapPercentage >= 22.5) {
  maxType = 'Max-25';
}
```

## Example: Luka Dončić

### Scenario
- **Current contract**: DRSE (2022-23 → 2026-27) with PO in 2026-27
- **Future contract**: Veteran Extension (2026-27 → 2028-29)
- **Result**: 2026-27 PO is voided by extension

### Before Implementation
```json
{
  "contract": {
    "guaranteedValue": 215159700,  // ❌ Includes voided PO
    "guaranteedYears": 5,           // ❌ Counts voided PO
    "yearsRemaining": 2,            // ❌ Counts voided PO
    "salariesByYear": [
      // ...
      {
        "season": "2026-27",
        "guaranteed": true,         // ❌ Should be false
        "guaranteedAmount": 48967380, // ❌ Should be 0
        "option": "PO"
      }
    ]
  }
}
```

### After Implementation
```json
{
  "contract": {
    "guaranteedValue": 166192320,  // ✅ Excludes voided PO
    "guaranteedYears": 4,          // ✅ Excludes voided PO
    "yearsRemaining": 1,           // ✅ Excludes voided PO
    "isMaxContract": true,
    "maxType": "Max-30",           // ✅ New taxonomy
    "estimatedCapPercentage": 30,  // ✅ Read from page
    "supersededIn": "2026-27",     // ✅ Tracks supersession
    "supersededByContractRef": "VETERAN EXTENSION",
    "salariesByYear": [
      // ...
      {
        "season": "2026-27",
        "guaranteed": false,       // ✅ Voided
        "guaranteedAmount": 0,     // ✅ No guarantee
        "option": "PO",
        "optionUsed": "No (2025-08-02)", // ✅ Tracks decline
        "voidedByExtension": true, // ✅ Marked as voided
        "voidedOn": "2025-08-02"  // ✅ Date tracked
      }
    ]
  },
  "futureContract": {
    "contractType": "VETERAN EXTENSION",
    "startSeason": "2026-27",      // ✅ Same as voided PO
    "isMaxContract": true,
    "maxType": "Max-30",
    "estimatedCapPercentage": 30,
    "salariesByYear": [
      // ...
      {
        "season": "2028-29",
        "guaranteed": true,        // ✅ Future PO remains guaranteed
        "option": "PO"
      }
    ]
  }
}
```

## House Rules

### PO Remains Guaranteed by Default
Unless voided by an extension, player options are marked as guaranteed:
- This reflects the expectation that most POs are exercised
- Business logic should check `voidedByExtension` flag when computing cap holds

### Future Contract POs
POs in future contracts (extensions) remain guaranteed per house rule:
- Extension POs are typically exercised
- Not voided unless another extension supersedes them

## Testing

### Unit Tests
Run validation tests:
```bash
npm run validate-po-voiding
```

### Test Cases
1. **Luka Dončić**: DRSE with voided PO + veteran extension
   - ✅ PO marked as voided
   - ✅ Guaranteed totals recomputed
   - ✅ Max contract labels normalized

2. **Austin Reaves**: Veteran contract with PO (no voiding)
   - ✅ All years guaranteed including PO
   - ✅ No supersession tracking
   - ✅ Cap% read from page

### Manual Testing
```bash
# Test Luka (with voiding)
cp player-scrape/examples/luka_doncic_test.html player-scrape/examples/page.html
PLAYER_ID="luka_doncic" TEAM_CODE="DAL" npm run parse-player

# Test Austin (no voiding)
cp player-scrape/examples/austin_reaves_test.html player-scrape/examples/page.html
PLAYER_ID="austin_reaves" TEAM_CODE="LAL" npm run parse-player
```

## Integration

### With Firestore Upload
When uploading to `players_v2/{playerId}/contracts/{contractId}`:
- Filter out voided years or include with `voided: true` flag
- Use `guaranteedValue` for cap calculations (already excludes voided PO)
- Check `supersededIn` to determine if contract is still active

### With UI/Business Logic
```typescript
// Calculate active salary cap hit
const activeYears = contract.salariesByYear.filter(
  (year) => !year.voidedByExtension
);
const totalCapHit = activeYears.reduce(
  (sum, year) => sum + year.capHit, 0
);

// Check if contract has been superseded
if (contract.supersededIn) {
  console.log(`Contract superseded in ${contract.supersededIn}`);
  console.log(`Superseded by: ${contract.supersededByContractRef}`);
}
```

## Future Enhancements

Potential improvements:
1. Parse "Option Used: Yes" scenarios (option exercised)
2. Track multiple supersessions (if player signs multiple extensions)
3. Add contract reference IDs for more precise linking
4. Support team options (TO) and early termination options (ETO) voiding
5. Calculate cap holds for voided options

## References

- Schema: `player-scrape/schema/player_scrape_schema.ts`
- Parser: `player-scrape/contracts/scripts/parse_player.ts`
- Tests: `player-scrape/contracts/scripts/validate_po_voiding.ts`
- Changelog: `player-scrape/CHANGELOG.md`
