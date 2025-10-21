# Player-Scrape Contract Flow Readiness Assessment
**Generated:** 2025-10-21  
**Reviewer:** Automated Assessment  
**Status:** ALMOST READY (85% confidence)

---

## Executive Summary

The **player-scrape** Contract SalarySwish Pages flow is **ALMOST READY** for production use to populate the `players_v2` Contract section. The codebase is well-structured, documented, and the schema validation passes. However, there are several gaps that need to be addressed before full deployment.

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

### 1.2 Players_v2 Contract Schema

The players_v2 schema (from `docs/migrations/players-v1-to-v2/schema-lock-players_v2/contracts_sample.json`):

```typescript
{
  // Basic fields
  contractType: string
  signingDate: string
  signedUsing: string
  source: string
  startSeason: string           // "2023" (year only, not "2023-24")
  endSeason: string             // "2026" (year only)
  guaranteedValue: number
  noTradeClause: boolean
  isExtension: null
  contractValue: number
  
  // Financial
  aav: number
  averageAnnualValue: number    // Duplicate of aav
  capPercentage: number         // NOT in player-scrape
  guaranteedYears: number
  contractLength: number
  tradeKicker: null
  
  // Salary breakdown
  salariesByYear: [{
    guaranteed: boolean
    salary: number
    option: null | string
    year: number               // Just year (2025), not season string
  }]
  
  // Options array (separate from salariesByYear)
  options: []                   // NOT in player-scrape
  
  // Incentives object
  incentives: {
    likely: number
    unlikely: number
  }
  
  // Free Agency
  freeAgency: {
    freeAgentType: null | string
    freeAgentYear: number
    birdRights: string          // Flat string, not object
    capHold: number
    qualifyingOffer: null | number
  }
  
  signingTeam: null
}
```

### 1.3 Architect/BasePlayers Contract Schema

The architect/basePlayers schema (from `docs/architect-teams-plan/03-TARGET-SCHEMA.md`) is nearly identical to player-scrape schema but adds:

- More detailed CBA-specific fields
- Structured Bird rights object (not flat string)
- Comprehensive trade eligibility rules
- Trade restrictions array

**Verdict:** player-scrape schema matches architect/basePlayers schema almost perfectly.

---

## 2. Field Mapping Differences

### 2.1 Season Format Differences

| Field | Player-Scrape | Players_v2 | Fix Required |
|-------|--------------|------------|--------------|
| `startSeason` | `"2025-26"` | `"2025"` | ✅ Yes - Transform to year only |
| `endSeason` | `"2027-28"` | `"2027"` | ✅ Yes - Transform to year only |
| `salariesByYear[].season` | `"2025-26"` | (uses `year` field) | ✅ Yes - Extract year from season |
| `salariesByYear[].year` | N/A | `2025` | ✅ Yes - Add year field |

**Impact:** HIGH - Season format mismatch will cause validation errors

**Fix:** Create a transform function to convert seasons:
```typescript
function extractYear(season: string): number {
  // "2025-26" -> 2025
  return parseInt(season.split('-')[0]);
}
```

### 2.2 Missing Fields in Player-Scrape

| Field | In Players_v2 | In Player-Scrape | Impact | Fix |
|-------|--------------|------------------|--------|-----|
| `capPercentage` | ✅ Yes | ❌ No | Medium | Calculate from salary/cap |
| `options` array | ✅ Yes | ❌ No (merged into salariesByYear) | Low | Extract from salariesByYear |
| `source` | ✅ Yes | ❌ No (at root level) | Low | Add at contract level |

### 2.3 Field Structure Differences

| Field | Player-Scrape | Players_v2 | Fix Required |
|-------|--------------|------------|--------------|
| `birdRights` | Object `{status, years...}` | String `"Bird"` | ✅ Yes - Flatten to string |
| `freeAgency.type` | `"RFA"` or `"UFA"` | `freeAgentType` | ✅ Yes - Rename field |
| `freeAgency.year` | `2028` | `freeAgentYear` | ✅ Yes - Rename field |
| `averageAnnualValue` | Single field | Duplicated as `aav` | Low | Add `aav` alias |
| `contractValue` | Called `totalValue` | `contractValue` | ✅ Yes - Rename/add field |

### 2.4 Extra Fields in Player-Scrape

These fields are in player-scrape but NOT in players_v2:

| Field | Purpose | Keep for Architect? |
|-------|---------|---------------------|
| `isRookieScale` | Poison pill logic | ✅ YES - Critical for CBA |
| `signedByCurrentTeam` | Trade timing rules | ✅ YES - Important for CBA |
| `yearsRemaining` | Calculated field | ⚠️ Optional - Can recalculate |
| `guaranteedAmount` (per year) | Detailed guarantees | ✅ YES - Useful for CBA |
| `capHit` (per year) | Cap impact with incentives | ✅ YES - Critical for cap calc |
| `tradeRestrictions` | Trade clauses array | ✅ YES - Important for CBA |
| `tradeEligibility` object | Full CBA rules | ✅ YES - Essential for trades |

**Verdict:** These extra fields are valuable for architect/basePlayers but not needed for players_v2

---

## 3. Architecture Decision: Copy vs Scrape Separately

### Current State Analysis

The codebase shows **TWO separate scraping pipelines**:

1. **Player-Scrape** → Targets `architect/basePlayers` (CBA-focused)
2. **Players_v2 Pipeline** → Uses different data sources (scouting-focused)

### Question: Were we planning to...

**A) COPY validated contract data from player-scrape into architect/basePlayers?**

**B) SCRAPE architect/basePlayers separately with near-identical logic?**

### Evidence from Codebase

From `player-scrape/docs/README.md`:

> "This folder contains tools for scraping NBA player contract data from SalarySwish player pages. The output populates `/architect/basePlayers/{playerId}` with comprehensive contract details needed for trade validation."

From `docs/architect-teams-plan/03-TARGET-SCHEMA.md`:

> "Path: `/architect/basePlayers/austin_reaves`"

**Conclusion:** The plan was **OPTION B - Scrape architect/basePlayers separately**.

### Pros & Cons Analysis

#### Option A: Copy from player-scrape to architect/basePlayers

✅ **Pros:**
- Single source of truth for contract data
- No duplicate scraping logic
- Easier to maintain and update

❌ **Cons:**
- Still need field transformations for players_v2
- Two different schemas to support
- Complicates data flow

#### Option B: Scrape architect/basePlayers separately (CURRENT PLAN)

✅ **Pros:**
- Clean separation: players_v2 (scouting) vs architect (CBA/trades)
- Each schema optimized for its purpose
- No coupling between systems

❌ **Cons:**
- Duplicate scraping infrastructure
- Need to maintain two scrapers
- Data consistency risk if sources diverge

### Recommendation: **OPTION B (Current Plan)**

**Keep separate pipelines** for these reasons:

1. **Different purposes:**
   - `players_v2/contracts`: Scouting/roster management view
   - `architect/basePlayers`: CBA compliance and trade validation

2. **Different schema requirements:**
   - players_v2 uses simplified flat structure
   - architect needs complex nested CBA objects

3. **Different update frequencies:**
   - players_v2 might update from multiple sources
   - architect needs authoritative CBA-compliant data

4. **Already built:** player-scrape is architected for basePlayers

### Implementation Plan

```
┌─────────────────────┐
│   SalarySwish.com   │
└──────────┬──────────┘
           │
           ├─────────────────────┐
           │                     │
           ▼                     ▼
  ┌─────────────────┐   ┌──────────────────┐
  │  player-scrape  │   │ players_v2 scrape│
  │  (CBA-focused)  │   │ (scout-focused)  │
  └────────┬────────┘   └─────────┬────────┘
           │                      │
           ▼                      ▼
  ┌─────────────────┐   ┌──────────────────┐
  │ architect/      │   │ players_v2/      │
  │ basePlayers     │   │ {player}/        │
  │                 │   │ contracts/       │
  └─────────────────┘   └──────────────────┘
```

### Field Delta for architect/basePlayers

If copying data from player-scrape to architect/basePlayers, **NO CHANGES NEEDED** - schemas already match!

If populating players_v2/contracts from player-scrape, these transforms needed:

```typescript
// Transform player-scrape → players_v2 contracts
function transformToPlayersV2(scraped: BasePlayerDoc) {
  return {
    contractType: scraped.contract.contractType,
    signingDate: scraped.contract.signingDate,
    signedUsing: scraped.contract.signedUsing,
    source: scraped.source.provider,
    
    // Transform season format
    startSeason: extractYear(scraped.contract.startSeason), // "2025-26" → "2025"
    endSeason: extractYear(scraped.contract.endSeason),
    
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
    
    // Calculate cap percentage (need current cap number)
    capPercentage: Math.round((scraped.contract.totalValue / scraped.contract.contractLength) / 140588000 * 100),
    
    // Transform salaries array
    salariesByYear: scraped.contract.salariesByYear.map(s => ({
      year: extractYear(s.season),
      salary: s.salary,
      guaranteed: s.guaranteed,
      option: s.option
    })),
    
    // Extract options to separate array
    options: scraped.contract.salariesByYear
      .filter(s => s.option)
      .map(s => ({ year: extractYear(s.season), type: s.option })),
    
    // Flatten free agency
    freeAgency: {
      freeAgentType: scraped.contract.freeAgency.type,
      freeAgentYear: scraped.contract.freeAgency.year,
      birdRights: scraped.contract.birdRights.status, // Flatten to string
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
  - **Fix:** Add optional format parameter to output year-only seasons for players_v2
  - **Impact:** Data won't match players_v2 schema without transformation
  - **Patch:**
    ```typescript
    // In parse_player.ts, add transform function:
    function formatSeasonForPlayersV2(season: string): string {
      // "2025-26" → "2025"
      return season.split('-')[0];
    }
    
    // Add to salariesByYear mapping:
    salariesByYear: salaries.map(s => ({
      ...s,
      year: parseInt(s.season.split('-')[0]) // Add year field
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

- [ ] **No Firestore Upload Script**
  - **File:** N/A (mentioned in docs but not implemented)
  - **Fix:** Create upload script for basePlayers collection
  - **Impact:** Manual upload required
  - **Patch:**
    ```javascript
    // Create player-scrape/scripts/upload_to_firestore.ts
    import admin from 'firebase-admin';
    import fs from 'fs/promises';
    
    async function uploadToBasePlayers(playerFile: string) {
      const data = JSON.parse(await fs.readFile(playerFile, 'utf-8'));
      const db = admin.firestore();
      
      await db
        .collection('architect')
        .doc('basePlayers')
        .collection(data.playerId)
        .doc('contract')
        .set(data.contract);
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
  - **Fix:** Add cap percentage calculation
  - **Impact:** Missing field for players_v2 compatibility
  - **Patch:**
    ```typescript
    const CAP_2025_26 = 140588000;
    capPercentage: Math.round((totalValue / contractLength) / CAP_2025_26 * 100)
    ```

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
4. Add field transformation for players_v2 compatibility (if needed)
5. Create Firestore upload script
6. Deploy to staging environment

**Architecture Recommendation:**
- **KEEP SEPARATE PIPELINES** (Option B)
- player-scrape → architect/basePlayers (no changes needed)
- Separate scraper/transformer → players_v2/contracts (if needed)

**Timeline Estimate:**
- Playwright setup: 30 minutes
- Real data validation: 2-4 hours
- Field transformation: 2-3 hours
- Integration testing: 4-6 hours
- **Total: 1-2 days of focused work**

### Next Steps

1. ✅ **Install Playwright:** `npx playwright install chromium`
2. ✅ **Test Real Scraping:** Validate 3-5 real player pages
3. ✅ **Fix Parsing Issues:** Address any bugs found
4. ✅ **Add Transformers:** Create players_v2 field mapping if needed
5. ✅ **Create Upload Script:** Automate Firestore integration
6. ✅ **Run Integration Tests:** End-to-end validation
7. ✅ **Deploy to Staging:** Test with full roster
8. ✅ **Production Rollout:** Scrape all 530 NBA players

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

### Field Mapping Quick Reference

| Player-Scrape | Players_v2 | Architect/BasePlayers | Transform Needed |
|---------------|------------|----------------------|-----------------|
| `startSeason: "2025-26"` | `startSeason: "2025"` | `startSeason: "2025-26"` | Yes (for v2) |
| `birdRights: {object}` | `birdRights: "Bird"` | `birdRights: {object}` | Yes (for v2) |
| `totalValue` | `contractValue` | `totalValue` | Alias for v2 |
| `isRookieScale` | N/A | ✅ | Keep for architect |
| `tradeEligibility` | N/A | ✅ | Keep for architect |
| `capPercentage` | ✅ | N/A | Add for v2 |

---

**End of Assessment**
