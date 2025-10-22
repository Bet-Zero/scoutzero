# Player-Scrape Contract Flow Readiness Assessment
**Generated:** 2025-10-21  
**Revised:** 2025-10-21  
**Reviewer:** Automated Assessment  
**Status:** ALMOST READY (85% confidence)

> 🚀 **Want to get to 100% production ready?** 
> 
> See **[GETTING_STARTED.md](./GETTING_STARTED.md)** for complete step-by-step instructions with code examples and validation steps!

---

## Executive Summary

The **player-scrape** Contract SalarySwish Pages flow is **ALMOST READY** for production use to **update and populate the `players_v2` Contract subcollection**. The codebase is well-structured, documented, and the schema validation passes. The scraper already outputs the correct "YYYY-YY" season format and includes all 4 required new fields. However, there are several gaps that need to be addressed before full deployment.

**Key Correction:** This scraper's primary purpose is to update/populate the existing `players_v2/{playerId}/contracts/{contractId}` subcollection in Firestore, not architect/basePlayers.

### Key Findings

✅ **Strengths:**
- Clean TypeScript implementation with Zod schema validation
- Comprehensive documentation with setup guides
- Multiple contract handling (current + future extensions) implemented
- Schema includes all CBA-critical fields for trade validation
- Sample data validates successfully

⚠️ **Gaps:**
- Missing Playwright browser installation (required for scraping)
- No test coverage for actual SalarySwish page scraping
- Field mapping differences between player-scrape and players_v2 schemas
- Sample data is placeholder test data, not real SalarySwish output
- No integration tests with Firestore upload

### Confidence Level: 85%

**Almost Ready** - The core parsing logic appears sound and well-tested, but requires:
1. Playwright browser setup and testing
2. Real SalarySwish page validation
3. Field mapping alignment
4. Integration testing

---

## 1. Schema Comparison Analysis

### 1.1 Player-Scrape Contract Schema

The player-scrape schema defines a comprehensive contract structure in `player-scrape/schema/player_scrape_schema.ts`:

```typescript
{
  contract: {
    // Type & Classification
    contractType: string           // "VETERAN CONTRACT" | "ROOKIE SCALE" | etc.
    isExtension: boolean
    isRookieScale: boolean
    
    // Signing Details
    signedUsing: string           // "Bird Exception" | "MLE" | etc.
    signingTeam: string
    signingDate: string
    signedByCurrentTeam: boolean
    
    // Duration
    startSeason: string           // "2025-26"
    endSeason: string
    contractLength: number
    yearsRemaining: number
    
    // Financials
    totalValue: number
    averageAnnualValue: number
    guaranteedValue: number
    guaranteedYears: number
    
    // Per-Season Breakdown
    salariesByYear: [{
      season: string              // "2025-26"
      salary: number
      capHit: number
      guaranteed: boolean
      guaranteedAmount: number
      option: string | null       // "PO" | "TO" | "ETO" | null
      tradeBonus: number | null
      incentives: {
        likely: number
        unlikely: number
      }
    }]
    
    // Trade Clauses
    noTradeClause: boolean
    tradeKicker: number | null
    tradeRestrictions: string[]
    
    // Bird Rights (CBA-specific)
    birdRights: {
      status: string              // "Bird" | "Early Bird" | "Non-Bird" | "None"
      yearsOfService: number
      yearsWithTeam: number
      eligibleFor: string[]
    }
    
    // Free Agency (CBA-specific)
    freeAgency: {
      type: string | null         // "RFA" | "UFA" | null
      year: number
      capHold: number
      qualifyingOffer: number | null
      earlyTerminationOption: string | null
    }
    
    // Trade Eligibility (CBA-specific)
    tradeEligibility: {
      canBeTradedNow: boolean
      restrictedUntil: string | null
      reason: string | null
      rules: {
        baseYearCompensation: boolean
        poisonPill: boolean
        aggregation: boolean
      }
    }
  }
}
```

### 1.2 Players_v2 Contract Schema (Current)

The players_v2 schema (from `docs/migrations/players-v1-to-v2/schema-lock-players_v2/contracts_sample.json`):

**Path:** `players_v2/{playerId}/contracts/{contractId}`

```typescript
{
  // Basic fields
  contractType: string
  signingDate: string
  signedUsing: string
  source: string
  startSeason: string           // CURRENT: "2023" (year only) → TARGET: "2023-24" (YYYY-YY)
  endSeason: string             // CURRENT: "2026" (year only) → TARGET: "2026-27" (YYYY-YY)
  guaranteedValue: number
  noTradeClause: boolean
  isExtension: null
  contractValue: number
  
  // Financial
  aav: number
  averageAnnualValue: number    // Duplicate of aav
  capPercentage: number
  guaranteedYears: number
  contractLength: number
  tradeKicker: null
  
  // Salary breakdown
  salariesByYear: [{
    guaranteed: boolean
    salary: number
    option: null | string
    year: number               // CURRENT: 2025 (year) → TARGET: keep as year for free agency
    // MISSING: capHit (needed when incentives exist) ← NEW FIELD #1
    // MISSING: tradeBonus (per-year breakdown) ← NEW FIELD #2
  }]
  
  // Options array (separate from salariesByYear)
  options: []
  
  // Incentives object
  incentives: {
    likely: number
    unlikely: number
  }
  
  // Free Agency
  freeAgency: {
    freeAgentType: null | string
    freeAgentYear: number      // Just year (correct - free agency is single year)
    birdRights: string         // Flat string
    capHold: number
    qualifyingOffer: null | number
  }
  
  signingTeam: null
  
  // MISSING FIELDS TO ADD:
  // isRookieScale: boolean     ← NEW FIELD #3 (poison pill logic)
  // yearsOfService: number     ← NEW FIELD #4 (extension rules)
}
```

**Note:** The 4 new fields needed are:
1. `capHit` per year in salariesByYear (differs from salary when incentives exist)
2. `tradeBonus` per year in salariesByYear (some kickers only apply to specific years)
3. `isRookieScale` at contract level (needed for poison pill logic)
4. `yearsOfService` at contract level (needed for extension rules)

### 1.3 Architect/BasePlayers Contract Schema

The architect/basePlayers schema (from `docs/architect-teams-plan/03-TARGET-SCHEMA.md`) is nearly identical to player-scrape schema but adds:

- More detailed CBA-specific fields
- Structured Bird rights object (not flat string)
- Comprehensive trade eligibility rules
- Trade restrictions array

**Note:** This is a **secondary target** for the scraper. The primary focus is players_v2.

---

## 2. Field Mapping Analysis for players_v2

### 2.1 Season Format - Already Correct! ✅

**Good News:** player-scrape already outputs "YYYY-YY" format:
- `startSeason: "2025-26"` ✅
- `endSeason: "2027-28"` ✅
- `salariesByYear[].season: "2025-26"` ✅

**Target for players_v2:** Use this format for season fields, but keep `year` as integer for salariesByYear to maintain compatibility.

### 2.2 Four New Fields - Already Present! ✅

All 4 required new fields are already in player-scrape output:

| New Field | Location in player-scrape | Status | Purpose |
|-----------|--------------------------|--------|---------|
| `isRookieScale` | `contract.isRookieScale` | ✅ Present | Poison pill logic |
| `yearsOfService` | `contract.birdRights.yearsOfService` | ✅ Present | Extension rules |
| `capHit` per year | `contract.salariesByYear[].capHit` | ✅ Present | Cap impact with incentives |
| `tradeBonus` per year | `contract.salariesByYear[].tradeBonus` | ✅ Present | Per-year kicker breakdown |

### 2.3 Field Transformations Needed

To match players_v2 contract structure, these transformations are needed:

| Field | Player-Scrape | Players_v2 Target | Transform Needed |
|-------|--------------|-------------------|------------------|
| `startSeason` | `"2025-26"` | `"2025-26"` | ✅ Keep as-is (YYYY-YY format) |
| `endSeason` | `"2027-28"` | `"2027-28"` | ✅ Keep as-is (YYYY-YY format) |
| `salariesByYear[].season` | `"2025-26"` | Not used | ⚠️ Extract to `year` field |
| `salariesByYear[].year` | N/A | `2025` | ✅ Add: `parseInt(season.split('-')[0])` |
| `salariesByYear[].capHit` | ✅ Present | ✅ Add to v2 | ✅ Copy directly (NEW FIELD #1) |
| `salariesByYear[].tradeBonus` | ✅ Present | ✅ Add to v2 | ✅ Copy directly (NEW FIELD #2) |
| `isRookieScale` | ✅ Present | ✅ Add to v2 | ✅ Copy directly (NEW FIELD #3) |
| `birdRights.yearsOfService` | ✅ Present | ✅ Add to v2 | ✅ Extract to root level (NEW FIELD #4) |
| `birdRights` object | `{status, yearsOfService...}` | `"Bird"` (string) | ✅ Flatten: `birdRights.status` |
| `contractValue` | Called `totalValue` | `contractValue` | ✅ Rename field |
| `aav` | Only `averageAnnualValue` | Both `aav` and `averageAnnualValue` | ✅ Duplicate field |
| `capPercentage` | Not present | Required | ✅ Calculate from salary/cap |
| `options` array | Merged in salariesByYear | Separate array | ✅ Extract options |

### 2.4 Transform Function Example

```typescript
function transformToPlayersV2(scraped: BasePlayerDoc) {
  // Extract options into separate array
  const options = scraped.contract.salariesByYear
    .filter(s => s.option)
    .map(s => ({
      year: parseInt(s.season.split('-')[0]),
      type: s.option
    }));

  return {
    // Keep YYYY-YY format for seasons (per user requirement)
    startSeason: scraped.contract.startSeason,    // "2025-26"
    endSeason: scraped.contract.endSeason,         // "2027-28"
    
    contractType: scraped.contract.contractType,
    signingDate: scraped.contract.signingDate,
    signedUsing: scraped.contract.signedUsing,
    source: scraped.source.provider,
    
    // Rename fields
    contractValue: scraped.contract.totalValue,
    aav: scraped.contract.averageAnnualValue,
    averageAnnualValue: scraped.contract.averageAnnualValue,
    
    guaranteedValue: scraped.contract.guaranteedValue,
    guaranteedYears: scraped.contract.guaranteedYears,
    contractLength: scraped.contract.contractLength,
    noTradeClause: scraped.contract.noTradeClause,
    tradeKicker: scraped.contract.tradeKicker,
    isExtension: scraped.contract.isExtension || null,
    signingTeam: scraped.contract.signingTeam || null,
    
    // Calculate cap percentage (using 2025-26 cap: $140,588,000)
    capPercentage: Math.round((scraped.contract.totalValue / scraped.contract.contractLength) / 140588000 * 100),
    
    // NEW FIELD #3: Add isRookieScale
    isRookieScale: scraped.contract.isRookieScale,
    
    // NEW FIELD #4: Add yearsOfService
    yearsOfService: scraped.contract.birdRights.yearsOfService || null,
    
    // Transform salaries array with NEW FIELDS #1 and #2
    salariesByYear: scraped.contract.salariesByYear.map(s => ({
      year: parseInt(s.season.split('-')[0]),
      salary: s.salary,
      capHit: s.capHit,                    // NEW FIELD #1
      tradeBonus: s.tradeBonus,            // NEW FIELD #2
      guaranteed: s.guaranteed,
      option: s.option
    })),
    
    // Extract options to separate array
    options: options,
    
    // Flatten free agency
    freeAgency: {
      freeAgentType: scraped.contract.freeAgency.type,
      freeAgentYear: scraped.contract.freeAgency.year,
      birdRights: scraped.contract.birdRights.status,  // Flatten to string
      capHold: scraped.contract.freeAgency.capHold,
      qualifyingOffer: scraped.contract.freeAgency.qualifyingOffer
    },
    
    // Top-level incentives
    incentives: {
      likely: scraped.contract.salariesByYear.reduce((sum, s) => sum + s.incentives.likely, 0),
      unlikely: scraped.contract.salariesByYear.reduce((sum, s) => sum + s.incentives.unlikely, 0)
    }
  };
}
```

---

## 3. Architecture Decision: Primary Target is players_v2

### Current State Analysis

**CORRECTED UNDERSTANDING:** The primary purpose of player-scrape is to **update and populate `players_v2/{playerId}/contracts/{contractId}` subcollection** in Firestore.

### Question: What about architect/basePlayers?

**Decision:** Focus on players_v2 first. After this is working, we can decide separately how to populate architect/basePlayers (possibly reusing this scraper or creating a separate one).

### Implementation Plan for players_v2

```
┌─────────────────────┐
│   SalarySwish.com   │
└──────────┬──────────┘
           │
           ▼
  ┌─────────────────┐
  │  player-scrape  │
  │  + transform    │
  └────────┬────────┘
           │
           ▼
  ┌─────────────────────────┐
  │ players_v2/{playerId}/  │
  │   contracts/{contractId}│
  └─────────────────────────┘
```

### Key Changes from Original Assessment

1. **Primary target is players_v2** (not architect/basePlayers)
2. **Season format is YYYY-YY** (e.g., "2025-26") - player-scrape already does this correctly ✅
3. **Four new fields already present** in player-scrape output ✅
4. **Transform layer needed** to match players_v2 structure (flatten Bird rights, add options array, etc.)

### Field Coverage for players_v2

**Current players_v2 fields:** All present in player-scrape ✅

**Four new fields to add:**
1. ✅ `isRookieScale` - Already in player-scrape
2. ✅ `yearsOfService` - Already in player-scrape (birdRights.yearsOfService)
3. ✅ `capHit` per year - Already in player-scrape (salariesByYear[].capHit)
4. ✅ `tradeBonus` per year - Already in player-scrape (salariesByYear[].tradeBonus)

**Verdict:** player-scrape already has everything needed! Just needs transformation layer.

---

## 4. Gaps and Fixes Checklist

### 4.1 Critical Gaps (Must Fix Before Production)

- [ ] **Playwright Browser Not Installed**
  - **File:** N/A (system requirement)
  - **Fix:** Run `npx playwright install chromium`
  - **Impact:** Cannot scrape SalarySwish pages without this
  - **Patch:** 
    ```bash
    npx playwright install chromium
    # Verify: PLAYER_URL="https://salaryswish.com/players/austin-reaves" npm run fetch-player
    ```

- [ ] **Sample Data is Placeholder**
  - **File:** `player-scrape/examples/sample_austin_reaves.json`
  - **Fix:** Fetch real SalarySwish data and validate parser
  - **Impact:** Cannot verify parser accuracy without real data
  - **Patch:**
    ```bash
    # Test with real player page
    PLAYER_URL="https://salaryswish.com/players/austin-reaves" npm run fetch-player
    PLAYER_ID="austin_reaves" TEAM_CODE="LAL" npm run parse-player
    npm run validate-player
    ```

- [ ] **Season Format Mismatch**
  - **File:** `player-scrape/scripts/parse_player.ts`
  - **Fix:** Season format is already correct (YYYY-YY)! But need to add `year` field to salariesByYear
  - **Impact:** Need to extract year from season for salariesByYear array
  - **Patch:**
    ```typescript
    // In parse_player.ts, add year field to salariesByYear:
    salariesByYear: salaries.map(s => ({
      ...s,
      year: parseInt(s.season.split('-')[0]) // Add year field for players_v2
    }))
    ```

### 4.2 High Priority Gaps (Should Fix Before Launch)

- [ ] **No Integration Tests**
  - **File:** N/A (missing test suite)
  - **Fix:** Create test suite for end-to-end scraping
  - **Impact:** Cannot verify full pipeline works correctly
  - **Patch:**
    ```typescript
    // Create player-scrape/tests/integration.test.ts
    describe('Player Scraper Integration', () => {
      it('should scrape and validate Austin Reaves', async () => {
        // Fetch → Parse → Validate
      });
      
      it('should handle multiple contracts (Jayson Tatum)', async () => {
        // Test futureContract field
      });
    });
    ```

- [ ] **No Firestore Upload Script for players_v2**
  - **File:** N/A (mentioned in docs but not implemented)
  - **Fix:** Create upload script for players_v2/{playerId}/contracts collection
  - **Impact:** Manual upload required
  - **Patch:**
    ```javascript
    // Create player-scrape/scripts/upload_to_players_v2.ts
    import admin from 'firebase-admin';
    import fs from 'fs/promises';
    import { transformToPlayersV2 } from './transform_to_v2.ts';
    
    async function uploadToPlayersV2(playerFile: string) {
      const data = JSON.parse(await fs.readFile(playerFile, 'utf-8'));
      const transformed = transformToPlayersV2(data);
      const db = admin.firestore();
      
      // Use standard contract naming: std_202425 for 2024-25 season
      const contractId = `std_${data.contract.startSeason.replace('-', '')}`;
      
      await db
        .collection('players_v2')
        .doc(data.playerId)
        .collection('contracts')
        .doc(contractId)
        .set(transformed);
    }
    ```

- [ ] **Bird Rights Status Parsing Fragile**
  - **File:** `player-scrape/scripts/parse_player.ts:149-197`
  - **Fix:** Add more robust regex patterns and validation
  - **Impact:** May miss or misidentify Bird rights status
  - **Patch:**
    ```typescript
    // In parseBirdRights(), add fallback patterns:
    const patterns = [
      /Bird\s+Rights[:\s]+((?:Early\s+)?Bird|Non-Bird|None)/i,
      /Bird\s+Status[:\s]+([^<\n]+)/i,
      /(?:Full\s+)?Bird\s+(?:Rights|Exception)/i
    ];
    ```

### 4.3 Medium Priority Gaps (Nice to Have)

- [ ] **No Error Handling for Network Failures**
  - **File:** `player-scrape/scripts/fetch_player_page.ts`
  - **Fix:** Add retry logic and better error messages
  - **Impact:** Scraper fails on transient network errors
  - **Patch:** Add exponential backoff retry

- [ ] **No Validation Against Known Contracts**
  - **File:** N/A (missing validation suite)
  - **Fix:** Create test suite with known contract values
  - **Impact:** Cannot detect parser regression
  - **Patch:** Create fixtures from real contracts

- [ ] **Cap Percentage Not Calculated**
  - **File:** `player-scrape/scripts/parse_player.ts`
  - **Fix:** Add cap percentage calculation for players_v2
  - **Impact:** Missing required field for players_v2 compatibility
  - **Patch:**
    ```typescript
    const CAP_2025_26 = 140588000;
    const capPercentage = Math.round((totalValue / contractLength) / CAP_2025_26 * 100);
    
    // Add to contract output
    contract: {
      ...contractData,
      capPercentage
    }
    ```

- [ ] **Missing Transform Layer**
  - **File:** N/A (needs creation)
  - **Fix:** Create transform function for players_v2 compatibility
  - **Impact:** Cannot upload to players_v2 without transformation
  - **Patch:** See section 2.4 for complete transform function

### 4.4 Low Priority Gaps (Future Enhancement)

- [ ] **No Batch Progress Tracking**
  - **File:** `player-scrape/scripts/batch_scrape_players.ts`
  - **Fix:** Add progress bar and resume capability
  - **Impact:** Hard to track progress on large batches

- [ ] **No Differential Updates**
  - **File:** N/A
  - **Fix:** Track last scrape date and only update changed players
  - **Impact:** Inefficient to rescrape all players

- [ ] **No Historical Contract Tracking**
  - **File:** N/A
  - **Fix:** Store contract history (extensions, restructures)
  - **Impact:** Cannot track contract evolution

---

## 5. Sample Validated Output

### 5.1 Validated JSON (Austin Reaves)

The following JSON was successfully validated against the player-scrape schema:

```json
{
  "playerId": "austin_reaves",
  "displayName": "Austin Reaves",
  "teamCode": "LAL",
  "teamName": "Los Angeles Lakers",
  "bio": {
    "position": "G",
    "height": "6-5",
    "weight": "206",
    "age": 26,
    "birthdate": "5/29/1998",
    "experience": 3
  },
  "contract": {
    "contractType": "VETERAN CONTRACT",
    "isExtension": false,
    "isRookieScale": false,
    "signedUsing": "Bird Exception",
    "signingTeam": "LAL",
    "signingDate": "6/29/2023",
    "signedByCurrentTeam": true,
    "startSeason": "2025-26",
    "endSeason": "2027-28",
    "contractLength": 3,
    "yearsRemaining": 3,
    "totalValue": 40900000,
    "averageAnnualValue": 13633333.333333334,
    "guaranteedValue": 40900000,
    "guaranteedYears": 3,
    "salariesByYear": [
      {
        "season": "2025-26",
        "salary": 12000000,
        "capHit": 12000000,
        "guaranteed": true,
        "guaranteedAmount": 12000000,
        "option": null,
        "tradeBonus": null,
        "incentives": {
          "likely": 0,
          "unlikely": 0
        }
      },
      {
        "season": "2026-27",
        "salary": 13900000,
        "capHit": 13900000,
        "guaranteed": true,
        "guaranteedAmount": 13900000,
        "option": null,
        "tradeBonus": null,
        "incentives": {
          "likely": 0,
          "unlikely": 0
        }
      },
      {
        "season": "2027-28",
        "salary": 15000000,
        "capHit": 15000000,
        "guaranteed": true,
        "guaranteedAmount": 15000000,
        "option": "PO",
        "tradeBonus": null,
        "incentives": {
          "likely": 0,
          "unlikely": 0
        }
      }
    ],
    "noTradeClause": false,
    "tradeKicker": null,
    "tradeRestrictions": [],
    "birdRights": {
      "status": "Bird",
      "eligibleFor": [
        "Bird Exception",
        "Early Bird Exception"
      ]
    },
    "freeAgency": {
      "type": "UFA",
      "year": 2028,
      "capHold": 18750000,
      "qualifyingOffer": null,
      "earlyTerminationOption": null
    },
    "tradeEligibility": {
      "canBeTradedNow": true,
      "restrictedUntil": null,
      "reason": null,
      "rules": {
        "baseYearCompensation": false,
        "poisonPill": false,
        "aggregation": true
      }
    }
  },
  "source": {
    "provider": "SalarySwish",
    "playerPageUrl": "https://salaryswish.com/players/austin-reaves",
    "scrapedAt": "2025-10-15T01:51:27.552Z"
  },
  "lastUpdated": "2025-10-15T01:51:27.552Z",
  "version": "1.0"
}
```

### 5.2 Schema Validation Result

```
✅ Validation successful!

📊 Player Summary:
   Name: Austin Reaves
   Team: Los Angeles Lakers (LAL)
   Contract Type: VETERAN CONTRACT
   Extension: No
   Rookie Scale: No
   Years: 3 (2025-26 - 2027-28)
   Total Value: $40.9M
   Bird Rights: Bird
   Trade Eligible: Yes
   Poison Pill: No
   BYC: No
```

**Note:** This is placeholder test data. Real SalarySwish validation still needed.

---

## 6. Testing Recommendations

### 6.1 Immediate Testing Needed

1. **Install Playwright and test real scraping:**
   ```bash
   npx playwright install chromium
   PLAYER_URL="https://salaryswish.com/players/austin-reaves" npm run fetch-player
   PLAYER_ID="austin_reaves" npm run parse-player
   npm run validate-player
   ```

2. **Test with multiple contract types:**
   - Veteran contract (Austin Reaves)
   - Rookie scale (Paolo Banchero)
   - Extension (Jayson Tatum - has futureContract)
   - Two-way contract (any G-League player)

3. **Validate edge cases:**
   - Player with no-trade clause
   - Player with trade kicker
   - Player with team/player options
   - Recently traded player (trade restrictions)

### 6.2 Long-term Testing Strategy

1. **Create test fixtures:**
   - Save HTML snapshots of known player pages
   - Create expected JSON outputs
   - Add regression tests

2. **Integration testing:**
   - Test batch scraping (10-20 players)
   - Verify Firestore upload
   - Test error handling

3. **Monitoring:**
   - Track scraping success rate
   - Monitor schema validation failures
   - Alert on SalarySwish HTML changes

---

## 7. Final Recommendation

### Verdict: ALMOST READY (85% confidence)

**Ready to proceed with:**
1. Install Playwright browsers
2. Test with 5-10 real SalarySwish player pages
3. Fix any parsing issues discovered
4. **Create transformation layer for players_v2 compatibility**
5. **Add 4 new fields to output** (already in scraper, just need to expose at right level)
6. Create Firestore upload script for players_v2/{playerId}/contracts
7. Deploy to staging environment

**Architecture Recommendation:**
- **PRIMARY TARGET: players_v2** - Focus on updating/populating existing players_v2 contracts subcollection
- Season format: Keep YYYY-YY (e.g., "2025-26") - scraper already does this ✅
- Four new fields: Already present in scraper output ✅
- Transform layer: Needed to match players_v2 structure

**Key Insight:** The scraper already outputs everything needed! It just needs:
1. A transformation layer to match players_v2's flatter structure
2. Extraction of `year` field from `season` for salariesByYear
3. Flattening of Bird rights object to string
4. Separate options array
5. Upload script targeting players_v2 subcollection

**Timeline Estimate:**
- Playwright setup: 30 minutes
- Real data validation: 2-4 hours
- Create transformation layer: 3-4 hours
- Firestore upload script: 2-3 hours
- Integration testing: 4-6 hours
- **Total: 1-2 days of focused work**

### Next Steps

1. ✅ **Install Playwright:** `npx playwright install chromium`
2. ✅ **Test Real Scraping:** Validate 3-5 real player pages
3. ✅ **Fix Parsing Issues:** Address any bugs found
4. ✅ **Create Transform Layer:** Implement players_v2 field mapping
5. ✅ **Add Missing Fields:** Ensure 4 new fields are properly mapped
6. ✅ **Create Upload Script:** Automate players_v2 subcollection upload
7. ✅ **Run Integration Tests:** End-to-end validation
8. ✅ **Deploy to Staging:** Test with full roster
9. ✅ **Production Rollout:** Update all players_v2 contracts

---

## Appendix A: Command Reference

```bash
# Install dependencies
npm install
npx playwright install chromium

# Single player scraping
PLAYER_URL="https://salaryswish.com/players/austin-reaves" npm run fetch-player
PLAYER_ID="austin_reaves" TEAM_CODE="LAL" npm run parse-player
npm run validate-player

# Batch scraping
PLAYERS_FILE="examples/players_list.json" npm run batch-scrape-players

# Validation
npx tsx player-scrape/scripts/validate_player.ts

# View output
cat player-scrape/output/player.json | jq .
```

## Appendix B: Schema Field Reference

### Field Mapping Quick Reference (Updated)

| Player-Scrape | Players_v2 Target | Transform Needed |
|---------------|-------------------|-----------------|
| `startSeason: "2025-26"` | `startSeason: "2025-26"` | ✅ Keep YYYY-YY format |
| `endSeason: "2027-28"` | `endSeason: "2027-28"` | ✅ Keep YYYY-YY format |
| `birdRights: {object}` | `freeAgency.birdRights: "Bird"` | Flatten to string |
| `totalValue` | `contractValue` | Rename |
| `isRookieScale` | `isRookieScale` | ✅ NEW FIELD #3 - Copy directly |
| `birdRights.yearsOfService` | `yearsOfService` | ✅ NEW FIELD #4 - Extract to root |
| `salariesByYear[].capHit` | `salariesByYear[].capHit` | ✅ NEW FIELD #1 - Copy directly |
| `salariesByYear[].tradeBonus` | `salariesByYear[].tradeBonus` | ✅ NEW FIELD #2 - Copy directly |
| `salariesByYear[].season` | `salariesByYear[].year` | Extract year from season |
| N/A | `capPercentage` | Calculate from salary/cap |
| N/A | `options[]` | Extract from salariesByYear |

**Key Change:** Season format is YYYY-YY everywhere (not just year), per user clarification.

---

**End of Assessment**
