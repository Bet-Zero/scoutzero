# Contract Normalization Rules

**Version:** 1.0  
**Last Updated:** 2025-10-29  
**Status:** LOCKED SPECIFICATION

This document defines the canonical normalization rules for player contract data in ScoutZero. These rules apply universally to all players without exception or special-casing.

## Overview

Contract normalization ensures consistent representation of NBA player contracts across the platform. The rules cover option handling, date formatting, guarantee calculations, and contract relationships.

## Core Principles

1. **Universal Application**: Rules apply to all players equally
2. **No Special Cases**: No player-specific logic or exceptions
3. **Data Integrity**: Maintain scraped values where appropriate
4. **Consistency**: Enforce strict field pairing and format requirements

---

## Rule 1: optionUsed / optionDecisionDate Pairing

### Requirement

The `optionUsed` and `optionDecisionDate` fields MUST always be paired correctly:

- **Both null together**: For pending/undecided options
- **Both set together**: For exercised or declined options

### Valid States

```javascript
// Pending option (decision not yet made)
{
  option: "PO",
  optionUsed: null,
  optionDecisionDate: null
}

// Exercised team option
{
  option: "TO",
  optionUsed: true,
  optionDecisionDate: "2025-06-28"
}

// Declined player option (voided by extension)
{
  option: "PO",
  optionUsed: false,
  optionDecisionDate: "2025-08-02",
  voidedByExtension: true,
  voidedOn: "2025-08-02"
}
```

### Invalid States

```javascript
// ❌ INVALID: optionUsed set but optionDecisionDate null
{
  optionUsed: true,
  optionDecisionDate: null
}

// ❌ INVALID: optionUsed null but optionDecisionDate set
{
  optionUsed: null,
  optionDecisionDate: "2025-06-28"
}
```

### Implementation

- **Enforced by**: `validateOptionFieldPairing()` in `parse_player.ts`
- **When**: After all contract transformations
- **Action**: Throws error if pairing is invalid

---

## Rule 2: ISO Date Format Requirement

### Requirement

All date fields representing calendar decisions MUST use ISO 8601 format: `YYYY-MM-DD`

### Affected Fields

- `optionDecisionDate`
- `voidedOn`
- `signingDate`
- Any other date field representing a contract event

### Conversion

Human-readable dates from source data are converted to ISO format:

```javascript
// Input from scraper
"Aug 2, 2025"  →  "2025-08-02"
"Jun 28, 2025" →  "2025-06-28"
```

### Implementation

- **Enforced by**: `toISODate()` function in `parse_player.ts`
- **Used by**: `parseOptionUsedDate()` for option dates
- **Pattern**: `/^\d{4}-\d{2}-\d{2}$/`

---

## Rule 3: yearsRemaining Calculation Logic

### Requirement

`yearsRemaining` counts ONLY seasons that meet ALL criteria:
1. Still live (after current season start)
2. NOT marked `voidedByExtension: true`

### Example

```javascript
// Luka Dončić's old contract (current season: 2025)
const contract = {
  salariesByYear: [
    { season: "2024-25", salary: 43031940 },              // Current season
    { season: "2025-26", salary: 46063880 },              // Live, not voided
    { season: "2026-27", salary: 48967200, voidedByExtension: true }  // Voided, excluded
  ]
};

// Calculation
const activeYears = salariesByYear.filter(y => !y.voidedByExtension);
// activeYears = ["2024-25", "2025-26"]
// yearsRemaining = 1  (only 2025-26 is in the future)
```

### Implementation

- **Initial calculation**: Based on all years
- **Recalculated by**: `normalizeContractVoidedOptions()` using `activeYears`
- **Formula**: `Math.max(0, endYearNum - CURRENT_SEASON_START + 1)`

---

## Rule 4: Player Option Guarantee Policy

### Requirement

Player options are treated differently based on their status:

#### Live Player Option (Pending Decision)
```javascript
{
  option: "PO",
  optionUsed: null,
  optionDecisionDate: null,
  guaranteed: true,           // Treated as guaranteed for planning
  guaranteedAmount: salary    // Full salary amount
}
```

#### Declined/Voided Player Option
```javascript
{
  option: "PO",
  optionUsed: false,
  optionDecisionDate: "2025-08-02",
  guaranteed: false,          // NOT guaranteed
  guaranteedAmount: 0,        // Zero guaranteed
  voidedByExtension: true,
  voidedOn: "2025-08-02"
}
```

### Rationale

- **Live PO**: Assume player will exercise for team planning purposes
- **Voided PO**: No longer counts as guaranteed (voided by extension)

### Implementation

- **Enforced by**: `applyPlayerOptionPolicy()` in `parse_player.ts`
- **When**: After parsing salary table, before final validation
- **Applies to**: All active contracts (current and future)

---

## Rule 5: Contract Linkage Metadata

### Requirement

When a future contract supersedes a current contract, maintain bidirectional references:

#### Old Contract (Superseded)
```javascript
{
  contractType: "DESIGNATED ROOKIE SCALE EXTENSION",
  supersededIn: "2026-27",                    // Season where supersession starts
  supersededByContractRef: "VETERAN EXTENSION"  // Type of superseding contract
}
```

#### New Contract (Superseding)
```javascript
{
  contractType: "VETERAN EXTENSION",
  supersedesContractRef: "DESIGNATED ROOKIE SCALE EXTENSION"  // Type of old contract
}
```

### Field Definitions

- `supersededIn`: Season string (e.g., "2026-27") where the old contract is superseded
- `supersededByContractRef`: Contract type string of the new contract
- `supersedesContractRef`: Contract type string of the old contract

### Implementation

- **Set by**: `normalizeContractVoidedOptions()` when detecting voided PO
- **Required**: Both references must be set when contracts are linked
- **Validation**: Cross-references should match between contracts

---

## Rule 6: signedByCurrentTeam Semantics

### Requirement

`signedByCurrentTeam` answers: "Was this contract signed by the player's CURRENT team?"

Uses the `teamCode` from the current scrape, not historical team data.

### Example

```javascript
// Player traded from DAL to LAL
const currentTeam = "LAL";

// Old contract (signed with Dallas)
const oldContract = {
  signingTeam: "DAL",
  signedByCurrentTeam: false  // Not signed by current team (LAL)
};

// New extension (signed with Lakers)
const newContract = {
  signingTeam: "LAL",
  signedByCurrentTeam: true   // Signed by current team (LAL)
};
```

### Implementation

- **Calculation**: `(signingTeam || teamCode) === teamCode`
- **When**: During contract object construction
- **Note**: Reflects current team at scrape time, not historical accuracy

---

## Rule 7: Money Headlines Preservation

### Requirement

Contract money values are handled differently based on their nature:

#### DO NOT CHANGE (Preserve Original)
- `totalValue`: Total contract value as originally signed
- `averageAnnualValue`: Original AAV calculation
- `contractLength`: Original number of years

#### DO RECOMPUTE (Based on Active Years)
- `guaranteedValue`: Sum of guaranteedAmount from active years only
- `guaranteedYears`: Count of years with guaranteedAmount > 0 from active years only

### Example

```javascript
// Original 5-year contract, year 5 voided by extension
const contract = {
  // PRESERVED - original contract values
  contractLength: 5,
  totalValue: 215159700,        // Sum of all 5 years
  averageAnnualValue: 43031940, // 215159700 / 5
  
  // RECOMPUTED - based on 4 active years
  guaranteedValue: 166256540,   // Sum of years 1-4 only
  guaranteedYears: 4,           // Count years 1-4 only
  yearsRemaining: 1,            // Based on active years
  
  salariesByYear: [
    { season: "2022-23", salary: 37096500, guaranteedAmount: 37096500 },
    { season: "2023-24", salary: 40064220, guaranteedAmount: 40064220 },
    { season: "2024-25", salary: 43031940, guaranteedAmount: 43031940 },
    { season: "2025-26", salary: 46063880, guaranteedAmount: 46063880 },
    { season: "2026-27", salary: 48967200, guaranteedAmount: 0, voidedByExtension: true }
  ]
};
```

### Rationale

- Original contract values reflect the deal as signed
- Guarantee calculations reflect current reality (excluding voided years)
- This distinction is important for historical accuracy vs current planning

### Implementation

- **Preserved**: Set once during initial parsing
- **Recomputed**: Updated by `normalizeContractVoidedOptions()` for active years
- **Formula for guaranteedValue**: `sum(activeYears.guaranteedAmount)`
- **Formula for guaranteedYears**: `count(activeYears where guaranteedAmount > 0)`

---

## Complete Example: Luka Dončić

### Scenario
- **Current Team**: LAL (Los Angeles Lakers)
- **Old Contract**: DESIGNATED ROOKIE SCALE EXTENSION (signed with DAL)
- **Future Contract**: VETERAN EXTENSION (signed with LAL)
- **Voided Year**: 2026-27 PO declined/voided by extension

### Old Contract (DESIGNATED ROOKIE SCALE EXTENSION)

```javascript
{
  contractType: "DESIGNATED ROOKIE SCALE EXTENSION",
  startSeason: "2022-23",
  endSeason: "2026-27",
  contractLength: 5,                    // ✓ Preserved
  totalValue: 215159700,                // ✓ Preserved
  averageAnnualValue: 43031940,         // ✓ Preserved
  guaranteedValue: 166256540,           // ✓ Recomputed (4 years)
  guaranteedYears: 4,                   // ✓ Recomputed
  yearsRemaining: 1,                    // ✓ Only 2025-26 remains
  signingTeam: "DAL",
  signedByCurrentTeam: false,           // ✓ Signed by DAL, not LAL
  supersededIn: "2026-27",              // ✓ Linkage metadata
  supersededByContractRef: "VETERAN EXTENSION",
  salariesByYear: [
    {
      season: "2022-23",
      salary: 37096500,
      guaranteed: true,
      guaranteedAmount: 37096500
    },
    {
      season: "2023-24",
      salary: 40064220,
      guaranteed: true,
      guaranteedAmount: 40064220
    },
    {
      season: "2024-25",
      salary: 43031940,
      guaranteed: true,
      guaranteedAmount: 43031940
    },
    {
      season: "2025-26",
      salary: 46063880,
      guaranteed: true,
      guaranteedAmount: 46063880
    },
    {
      season: "2026-27",
      salary: 48967200,
      option: "PO",
      optionUsed: false,                // ✓ Paired with date
      optionDecisionDate: "2025-08-02", // ✓ ISO format
      guaranteed: false,                // ✓ Not guaranteed
      guaranteedAmount: 0,              // ✓ Zero guaranteed
      voidedByExtension: true,
      voidedOn: "2025-08-02"            // ✓ ISO format
    }
  ]
}
```

### Future Contract (VETERAN EXTENSION)

```javascript
{
  contractType: "VETERAN EXTENSION",
  startSeason: "2026-27",
  endSeason: "2028-29",
  contractLength: 3,
  signingTeam: "LAL",
  signedByCurrentTeam: true,            // ✓ Signed by current team
  supersedesContractRef: "DESIGNATED ROOKIE SCALE EXTENSION",  // ✓ Linkage
  salariesByYear: [
    {
      season: "2026-27",
      salary: 51975000,
      guaranteed: true,
      guaranteedAmount: 51975000
    },
    {
      season: "2027-28",
      salary: 55854600,
      guaranteed: true,
      guaranteedAmount: 55854600
    },
    {
      season: "2028-29",
      salary: 59198976,
      option: "PO",
      optionUsed: null,                 // ✓ Paired with date
      optionDecisionDate: null,         // ✓ Both null
      guaranteed: true,                 // ✓ Live PO treated as guaranteed
      guaranteedAmount: 59198976        // ✓ Full salary
    }
  ]
}
```

---

## Validation

### Test Coverage

Normalization rules are validated by:
- `tests/contractNormalizationValidation.test.js` (16 tests)
- `tests/contractNormalizationRulesValidation.test.js` (24 tests)

Total: **40 passing tests** covering all rule combinations

### Implementation Location

Primary implementation: `player-scrape/contracts/scripts/parse_player.ts`

Key functions:
- `parseOptionUsedDate()`: Parses option dates with ISO conversion
- `toISODate()`: Converts human dates to ISO format
- `applyPlayerOptionPolicy()`: Applies guarantee policy to PO years
- `validateOptionFieldPairing()`: Enforces option field pairing
- `normalizeContractVoidedOptions()`: Handles voided PO scenarios
- `main()`: Orchestrates normalization flow

---

## Error Handling

### Invalid Option Pairing

```javascript
// Throws error if optionUsed and optionDecisionDate are inconsistently set
throw new Error(
  `Invalid option field pairing in ${yearRow.season}: ` +
  `optionUsed=${yearRow.optionUsed}, optionDecisionDate=${yearRow.optionDecisionDate}. ` +
  `Both must be null or both must be set.`
);
```

### Invalid Date Format

```javascript
// Returns null if date cannot be parsed to ISO format
function toISODate(dateStr: string): string | null {
  // ... conversion logic ...
  return null; // If unparseable
}
```

---

## Maintenance

### Updating Rules

1. **Documentation**: Update this file first
2. **Tests**: Add/update tests in `contractNormalizationRulesValidation.test.js`
3. **Implementation**: Update `parse_player.ts`
4. **Validation**: Run all tests: `npm run test tests/contractNormalization*.test.js`

### Adding New Fields

When adding new date or option-related fields:
1. Apply ISO date format requirement (Rule 2)
2. Consider if pairing rules apply (Rule 1)
3. Update validation functions
4. Add test coverage

---

## References

- **Problem Statement**: Original normalization specification
- **Implementation**: `player-scrape/contracts/scripts/parse_player.ts`
- **Tests**: `tests/contractNormalization*.test.js`
- **Example Data**: Luka Dončić contract scenarios

---

**Document Status**: LOCKED - Changes require approval and test updates
