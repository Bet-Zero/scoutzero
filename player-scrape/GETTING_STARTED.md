# Getting Player-Scrape to 100% Production Ready

## Overview

This guide provides **step-by-step instructions** to take the player-scrape system from its current state (85% ready) to **100% production-ready**. Follow these steps in order to ensure all critical gaps are addressed.

**Current Status:** 85% Ready (ALMOST READY)  
**Time to Complete:** 1-2 days of focused work  
**Target:** 100% Production Ready for updating `players_v2` contracts

---

## Prerequisites

Before starting, ensure you have:

- Node.js 18+ installed
- npm installed
- Access to the scoutzero repository
- Basic understanding of TypeScript
- Firebase Admin SDK configured (for uploading to Firestore)

---

## Step-by-Step Guide to 100%

### Phase 1: Critical Setup (Required)

#### Step 1.1: Install Playwright Browser

**Status:** ⚠️ **CRITICAL - Must complete first**

The scraper requires Playwright's Chromium browser to render JavaScript-based salary tables from SalarySwish.

```bash
# Navigate to project root
cd /path/to/scoutzero

# Install Playwright browsers
npx playwright install chromium

# Verify installation
npx playwright --version
```

**Verification:**
```bash
# Test that browser launches successfully
node -e "const { chromium } = require('playwright'); (async () => { const browser = await chromium.launch(); await browser.close(); console.log('✅ Browser installed successfully'); })()"
```

**Expected output:** `✅ Browser installed successfully`

**Why this matters:** Without Playwright, the scraper cannot fetch player pages and will fail immediately.

---

#### Step 1.2: Test Real Data Scraping

**Status:** ⚠️ **CRITICAL - Validates parser accuracy**

The current sample data is placeholder test data. You must validate with real SalarySwish pages.

```bash
# Test 1: Fetch a real player page
PLAYER_URL="https://salaryswish.com/players/austin-reaves" npm run fetch-player

# Verify page.html was created and contains salary data
ls -lh player-scrape/examples/page.html
grep -i "Season" player-scrape/examples/page.html
grep -i "Salary" player-scrape/examples/page.html

# Test 2: Parse the fetched page
PLAYER_ID="austin_reaves" TEAM_CODE="LAL" npm run parse-player

# Test 3: Validate the output
npm run validate-player
```

**Expected results:**
- `examples/page.html` should be 50KB+ with salary table HTML
- `output/player.json` should have populated `salariesByYear` array
- Validation should pass with ✅ success message

**Test with multiple contract types:**

```bash
# Veteran contract (Austin Reaves)
PLAYER_URL="https://salaryswish.com/players/austin-reaves" npm run fetch-player
PLAYER_ID="austin_reaves" TEAM_CODE="LAL" npm run parse-player

# Rookie scale contract
PLAYER_URL="https://salaryswish.com/players/paolo-banchero" npm run fetch-player
PLAYER_ID="paolo_banchero" TEAM_CODE="ORL" npm run parse-player

# Extension (Jayson Tatum - has futureContract)
PLAYER_URL="https://salaryswish.com/players/jayson-tatum" npm run fetch-player
PLAYER_ID="jayson_tatum" TEAM_CODE="BOS" npm run parse-player

# Validate each
npm run validate-player
```

**Success criteria:**
- All 3 player types parse successfully
- Contract types correctly identified
- Salary arrays properly populated
- Extensions detected in futureContract field

---

#### Step 1.3: Add Missing Fields for players_v2 Compatibility

**Status:** ⚠️ **HIGH PRIORITY - Required for Firestore upload**

The scraper outputs data in a format that needs transformation for `players_v2` compatibility.

**Current state:** Parser outputs season as "2025-26"  
**Needed for players_v2:** Also need `year` field as integer (2025)

**Edit:** `player-scrape/scripts/parse_player.ts`

Find the section where `salariesByYear` is constructed (around line 280-320) and add the `year` field:

```typescript
// BEFORE:
salariesByYear: salaries.map(s => ({
  season: s.season,
  salary: s.salary,
  capHit: s.capHit,
  guaranteed: s.guaranteed,
  guaranteedAmount: s.guaranteedAmount,
  option: s.option,
  tradeBonus: s.tradeBonus,
  incentives: s.incentives
}))

// AFTER:
salariesByYear: salaries.map(s => ({
  season: s.season,
  year: parseInt(s.season.split('-')[0]), // Add year field for players_v2
  salary: s.salary,
  capHit: s.capHit,
  guaranteed: s.guaranteed,
  guaranteedAmount: s.guaranteedAmount,
  option: s.option,
  tradeBonus: s.tradeBonus,
  incentives: s.incentives
}))
```

**Test the change:**
```bash
PLAYER_ID="austin_reaves" TEAM_CODE="LAL" npm run parse-player
cat player-scrape/output/player.json | grep -A 3 "salariesByYear"
```

**Expected:** Each salary entry should now have both `season: "2025-26"` and `year: 2025`

---

### Phase 2: Transform Layer (High Priority)

#### Step 2.1: Create players_v2 Transform Function

**Status:** 🔨 **HIGH PRIORITY - Enables Firestore upload**

Create a new file to transform scraped data to players_v2 contract format.

**Create:** `player-scrape/scripts/transform_to_v2.ts`

```typescript
import type { BasePlayerDoc } from '../schema/player_scrape_schema';

/**
 * Transform scraped player data to players_v2 contract format
 * 
 * Key transformations:
 * - Flatten Bird rights object to string
 * - Extract options into separate array
 * - Rename totalValue to contractValue
 * - Calculate cap percentage
 * - Add year field to salariesByYear
 */
export function transformToPlayersV2(scraped: BasePlayerDoc) {
  const CAP_2025_26 = 140588000;
  
  // Extract options into separate array
  const options = scraped.contract.salariesByYear
    .filter(s => s.option)
    .map(s => ({
      year: s.year || parseInt(s.season.split('-')[0]),
      type: s.option
    }));

  // Calculate cap percentage
  const capPercentage = Math.round(
    (scraped.contract.averageAnnualValue / CAP_2025_26) * 100
  );

  return {
    // Keep YYYY-YY format for seasons
    startSeason: scraped.contract.startSeason,
    endSeason: scraped.contract.endSeason,
    
    // Basic contract info
    contractType: scraped.contract.contractType,
    signingDate: scraped.contract.signingDate,
    signedUsing: scraped.contract.signedUsing,
    source: scraped.source.provider,
    signingTeam: scraped.contract.signingTeam || null,
    
    // Rename fields
    contractValue: scraped.contract.totalValue,
    aav: scraped.contract.averageAnnualValue,
    averageAnnualValue: scraped.contract.averageAnnualValue,
    
    // Financial details
    guaranteedValue: scraped.contract.guaranteedValue,
    guaranteedYears: scraped.contract.guaranteedYears,
    contractLength: scraped.contract.contractLength,
    capPercentage,
    
    // Trade-related
    noTradeClause: scraped.contract.noTradeClause,
    tradeKicker: scraped.contract.tradeKicker,
    isExtension: scraped.contract.isExtension || null,
    
    // NEW FIELD #3: Add isRookieScale
    isRookieScale: scraped.contract.isRookieScale,
    
    // NEW FIELD #4: Add yearsOfService
    yearsOfService: scraped.contract.birdRights.yearsOfService || null,
    
    // Transform salaries array with NEW FIELDS #1 and #2
    salariesByYear: scraped.contract.salariesByYear.map(s => ({
      year: s.year || parseInt(s.season.split('-')[0]),
      salary: s.salary,
      capHit: s.capHit,                    // NEW FIELD #1
      tradeBonus: s.tradeBonus,            // NEW FIELD #2
      guaranteed: s.guaranteed,
      option: s.option
    })),
    
    // Extract options to separate array
    options,
    
    // Top-level incentives (aggregate from per-year)
    incentives: {
      likely: scraped.contract.salariesByYear.reduce((sum, s) => 
        sum + (s.incentives?.likely || 0), 0),
      unlikely: scraped.contract.salariesByYear.reduce((sum, s) => 
        sum + (s.incentives?.unlikely || 0), 0)
    },
    
    // Flatten free agency
    freeAgency: {
      freeAgentType: scraped.contract.freeAgency.type,
      freeAgentYear: scraped.contract.freeAgency.year,
      birdRights: scraped.contract.birdRights.status,  // Flatten to string
      capHold: scraped.contract.freeAgency.capHold,
      qualifyingOffer: scraped.contract.freeAgency.qualifyingOffer
    }
  };
}
```

**Test the transform:**
```bash
# Create test script
cat > player-scrape/scripts/test_transform.ts << 'EOF'
import fs from 'fs/promises';
import { transformToPlayersV2 } from './transform_to_v2';

async function test() {
  const data = JSON.parse(
    await fs.readFile('player-scrape/output/player.json', 'utf-8')
  );
  const transformed = transformToPlayersV2(data);
  console.log(JSON.stringify(transformed, null, 2));
}

test().catch(console.error);
EOF

# Run test
npx tsx player-scrape/scripts/test_transform.ts | jq .
```

**Verify output has:**
- ✅ `isRookieScale` field at root
- ✅ `yearsOfService` field at root
- ✅ `capHit` in each salariesByYear entry
- ✅ `tradeBonus` in each salariesByYear entry
- ✅ `freeAgency.birdRights` is string (not object)
- ✅ `options` is separate array

---

#### Step 2.2: Create Firestore Upload Script

**Status:** 🔨 **HIGH PRIORITY - Final deployment step**

Create a script to upload transformed data to `players_v2/{playerId}/contracts`.

**Create:** `player-scrape/scripts/upload_to_players_v2.ts`

```typescript
import admin from 'firebase-admin';
import fs from 'fs/promises';
import path from 'path';
import { transformToPlayersV2 } from './transform_to_v2';

// Initialize Firebase Admin (assumes serviceAccountKey.json exists)
const serviceAccount = require('../../src/serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

interface UploadOptions {
  playerFile?: string;
  playersDir?: string;
  dryRun?: boolean;
}

/**
 * Upload a single player's contract to players_v2
 */
async function uploadPlayer(playerFile: string, dryRun = false) {
  const data = JSON.parse(await fs.readFile(playerFile, 'utf-8'));
  const transformed = transformToPlayersV2(data);
  
  // Use standard contract naming: std_202425 for 2024-25 season
  const contractId = `std_${data.contract.startSeason.replace('-', '')}`;
  
  const docPath = `players_v2/${data.playerId}/contracts/${contractId}`;
  
  console.log(`📝 ${dryRun ? '[DRY RUN] ' : ''}Uploading ${data.displayName}...`);
  console.log(`   Path: ${docPath}`);
  console.log(`   Contract: ${data.contract.startSeason} - ${data.contract.endSeason}`);
  console.log(`   Value: $${(transformed.contractValue / 1000000).toFixed(1)}M`);
  
  if (!dryRun) {
    await db
      .collection('players_v2')
      .doc(data.playerId)
      .collection('contracts')
      .doc(contractId)
      .set(transformed);
    console.log('   ✅ Upload complete\n');
  } else {
    console.log('   ⏭️  Skipped (dry run)\n');
  }
}

/**
 * Upload multiple players from directory
 */
async function uploadBatch(playersDir: string, dryRun = false) {
  const files = await fs.readdir(playersDir);
  const jsonFiles = files.filter(f => f.endsWith('.json'));
  
  console.log(`\n📦 Batch upload: ${jsonFiles.length} players from ${playersDir}\n`);
  
  let successCount = 0;
  let errorCount = 0;
  
  for (const file of jsonFiles) {
    try {
      await uploadPlayer(path.join(playersDir, file), dryRun);
      successCount++;
    } catch (error) {
      console.error(`❌ Error uploading ${file}:`, error.message);
      errorCount++;
    }
  }
  
  console.log(`\n✅ Complete: ${successCount} successful, ${errorCount} errors`);
}

// CLI interface
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const playerFile = process.env.PLAYER_FILE;
const playersDir = process.env.PLAYERS_DIR;

if (playerFile) {
  uploadPlayer(playerFile, dryRun).catch(console.error);
} else if (playersDir) {
  uploadBatch(playersDir, dryRun).catch(console.error);
} else {
  console.error('Usage:');
  console.error('  Single: PLAYER_FILE=output/player.json npx tsx upload_to_players_v2.ts');
  console.error('  Batch:  PLAYERS_DIR=output/players npx tsx upload_to_players_v2.ts');
  console.error('  Dry run: Add --dry-run flag');
  process.exit(1);
}
```

**Test upload (dry run):**
```bash
# Single player dry run
PLAYER_FILE="player-scrape/output/player.json" npx tsx player-scrape/scripts/upload_to_players_v2.ts --dry-run

# Batch dry run
PLAYERS_DIR="player-scrape/output/players" npx tsx player-scrape/scripts/upload_to_players_v2.ts --dry-run
```

**Real upload:**
```bash
# Upload single player
PLAYER_FILE="player-scrape/output/player.json" npx tsx player-scrape/scripts/upload_to_players_v2.ts

# Upload batch
PLAYERS_DIR="player-scrape/output/players" npx tsx player-scrape/scripts/upload_to_players_v2.ts
```

---

### Phase 3: Integration Testing (Recommended)

#### Step 3.1: Create Integration Tests

**Status:** 📊 **RECOMMENDED - Validates end-to-end flow**

While not strictly required for 100% readiness, integration tests provide confidence.

**Create:** `player-scrape/tests/integration.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';

const execAsync = promisify(exec);

describe('Player Scraper Integration', () => {
  it('should scrape and validate Austin Reaves', async () => {
    // Fetch
    await execAsync(
      'PLAYER_URL="https://salaryswish.com/players/austin-reaves" npm run fetch-player'
    );
    
    // Parse
    await execAsync(
      'PLAYER_ID="austin_reaves" TEAM_CODE="LAL" npm run parse-player'
    );
    
    // Validate
    const { stdout } = await execAsync('npm run validate-player');
    expect(stdout).toContain('Validation successful');
    
    // Check output
    const data = JSON.parse(
      await fs.readFile('player-scrape/output/player.json', 'utf-8')
    );
    expect(data.playerId).toBe('austin_reaves');
    expect(data.contract.salariesByYear).toHaveLength(3);
    expect(data.contract.isRookieScale).toBe(false);
  }, 60000); // 60 second timeout
  
  it('should handle rookie scale contract', async () => {
    await execAsync(
      'PLAYER_URL="https://salaryswish.com/players/paolo-banchero" npm run fetch-player'
    );
    await execAsync(
      'PLAYER_ID="paolo_banchero" TEAM_CODE="ORL" npm run parse-player'
    );
    
    const data = JSON.parse(
      await fs.readFile('player-scrape/output/player.json', 'utf-8')
    );
    expect(data.contract.isRookieScale).toBe(true);
    expect(data.contract.contractType).toContain('ROOKIE');
  }, 60000);
  
  it('should detect future extensions', async () => {
    await execAsync(
      'PLAYER_URL="https://salaryswish.com/players/jayson-tatum" npm run fetch-player'
    );
    await execAsync(
      'PLAYER_ID="jayson_tatum" TEAM_CODE="BOS" npm run parse-player'
    );
    
    const data = JSON.parse(
      await fs.readFile('player-scrape/output/player.json', 'utf-8')
    );
    expect(data.futureContract).toBeDefined();
    expect(data.futureContract.isExtension).toBe(true);
  }, 60000);
});
```

**Run tests:**
```bash
# Add to package.json scripts:
"test:player-scrape": "vitest run player-scrape/tests/integration.test.ts"

# Run
npm run test:player-scrape
```

---

### Phase 4: Validation & Sign-off

#### Step 4.1: Final Validation Checklist

Complete this checklist to verify 100% readiness:

- [ ] **Playwright browser installed and working**
  ```bash
  npx playwright --version
  node -e "const { chromium } = require('playwright'); ..."
  ```

- [ ] **Real data scraping validated with 3+ player types**
  - [ ] Veteran contract (Austin Reaves)
  - [ ] Rookie scale (Paolo Banchero)
  - [ ] Extension (Jayson Tatum)

- [ ] **Parser outputs all required fields**
  - [ ] `season` in YYYY-YY format ✅
  - [ ] `year` as integer ✅
  - [ ] `isRookieScale` ✅
  - [ ] `yearsOfService` ✅
  - [ ] `capHit` per year ✅
  - [ ] `tradeBonus` per year ✅

- [ ] **Transform function created and tested**
  - [ ] Converts to players_v2 format
  - [ ] Flattens Bird rights to string
  - [ ] Extracts options array
  - [ ] Calculates cap percentage

- [ ] **Upload script created and tested**
  - [ ] Dry run works
  - [ ] Single upload works
  - [ ] Batch upload works
  - [ ] Firebase permissions verified

- [ ] **Integration tests pass (optional but recommended)**
  - [ ] End-to-end scraping works
  - [ ] Multiple contract types handled
  - [ ] Validation passes

#### Step 4.2: Production Deployment

Once all checks pass, deploy to production:

```bash
# 1. Create players list for your team/league
cat > players_list.json << 'EOF'
[
  { "playerId": "lebron_james", "slug": "lebron-james", "teamCode": "LAL" },
  { "playerId": "anthony_davis", "slug": "anthony-davis", "teamCode": "LAL" }
  // ... add all players
]
EOF

# 2. Batch scrape all players
PLAYERS_FILE="players_list.json" OUTPUT_DIR="output/players" npm run batch-scrape-players

# 3. Upload to Firestore (dry run first!)
PLAYERS_DIR="output/players" npx tsx player-scrape/scripts/upload_to_players_v2.ts --dry-run

# 4. Upload for real
PLAYERS_DIR="output/players" npx tsx player-scrape/scripts/upload_to_players_v2.ts

# 5. Verify in Firebase Console
# Check players_v2/{playerId}/contracts/{contractId} documents
```

---

## Troubleshooting

### Playwright Installation Issues

**Problem:** Browser executable doesn't exist

**Solution:**
```bash
npx playwright install chromium
# If still fails, try:
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install
npx playwright install chromium
```

### Empty Salary Data

**Problem:** Parser outputs empty salariesByYear array

**Causes:**
1. Using old HTTP fetcher instead of Playwright
2. SalarySwish HTML structure changed
3. Network timeout during fetch

**Solution:**
```bash
# 1. Verify Playwright is being used
grep "playwright" player-scrape/scripts/fetch_player_page.ts

# 2. Check page.html has salary table
grep -i "<table" player-scrape/examples/page.html

# 3. Re-fetch with longer timeout
PLAYER_URL="https://salaryswish.com/players/austin-reaves" npm run fetch-player
```

### Transform Errors

**Problem:** Transform script fails with missing fields

**Solution:** Ensure parser includes all fields before transforming:
```bash
# Check parser output has required fields
cat player-scrape/output/player.json | jq '.contract | keys'
```

### Upload Failures

**Problem:** Firebase permission denied

**Solution:**
```bash
# Verify serviceAccountKey.json exists
ls -la src/serviceAccountKey.json

# Check Firebase project ID matches
cat src/serviceAccountKey.json | jq .project_id
```

---

## Summary

By completing all steps in this guide, you will have:

✅ **Phase 1 Complete (Critical):**
- Playwright browser installed
- Real data scraping validated
- Missing fields added to parser

✅ **Phase 2 Complete (High Priority):**
- Transform layer created for players_v2
- Upload script created and tested

✅ **Phase 3 Complete (Recommended):**
- Integration tests added
- End-to-end flow validated

✅ **Phase 4 Complete (Sign-off):**
- All validation checks passed
- Production deployment successful

**Status:** 🎉 **100% PRODUCTION READY**

---

## Next Steps

After reaching 100% readiness:

1. **Schedule regular updates** - Scrape and update contracts monthly
2. **Monitor for changes** - Watch for SalarySwish HTML structure changes
3. **Expand coverage** - Add more players and teams
4. **Automate** - Set up scheduled batch processing
5. **Validate** - Compare against other contract sources for accuracy

---

## Additional Resources

- [READINESS_ASSESSMENT.md](./READINESS_ASSESSMENT.md) - Detailed 85% assessment
- [SETUP_GUIDE.md](./docs/SETUP_GUIDE.md) - Playwright installation guide
- [README.md](./docs/README.md) - Full player-scrape documentation
- [Schema Documentation](./schema/player_scrape_schema.ts) - Type definitions

---

**Questions?** Review the troubleshooting section or check existing documentation files.
