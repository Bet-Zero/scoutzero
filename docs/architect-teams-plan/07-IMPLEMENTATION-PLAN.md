# Implementation Plan - Step-by-Step Guide

## Overview
This document provides both a high-level roadmap and detailed, semi-executable steps for implementing the Architect Teams Plan.

---

## Phase 1: Foundation & Planning ✅ COMPLETE

**Duration:** 2-3 days (DONE)

### Deliverables ✅
- [x] Goals documented (`01-GOALS.md`)
- [x] Current status analyzed (`02-CURRENT-STATUS.md`)
- [x] Target schema defined (`03-TARGET-SCHEMA.md`)
- [x] Architecture explained (`04-HOW-IT-WORKS.md`)
- [x] Save/load logic designed (`05-SAVE-LOAD-LOGIC.md`)
- [x] Comprehensive summary created (`06-COMPREHENSIVE-SUMMARY.md`)
- [x] Implementation plan drafted (`07-IMPLEMENTATION-PLAN.md`)

### Next Action
➡️ **Stakeholder approval** before proceeding to Phase 2

---

## Phase 2: Data Migration

**Duration:** 3-4 days
**Goal:** Populate `/architect/baseTeams` and `/architect/basePlayers` with current NBA data

### High-Level Overview

```
Day 1: Scraper Development
├─ Morning: Team page scraper
├─ Afternoon: Player page scraper
└─ Evening: Data validation scripts

Day 2: Data Collection
├─ Morning: Scrape all 30 teams
├─ Afternoon: Scrape all ~530 players
└─ Evening: Merge and validate data

Day 3: Firestore Upload
├─ Morning: Upload baseTeams collection
├─ Afternoon: Upload basePlayers collection
└─ Evening: Verification and testing

Day 4 (if needed): Cleanup & Fixes
├─ Fix any data quality issues
├─ Add missing fields
└─ Final validation
```

### Detailed Steps

#### Step 2.1: Set Up Scraping Environment

**Prerequisites:**
- Node.js 18+ installed
- Firebase Admin SDK configured
- `serviceAccountKey.json` in project root

**Create scraper directory:**
```bash
mkdir -p data_pipeline/architect_scraper
cd data_pipeline/architect_scraper
```

**Install dependencies:**
```bash
npm init -y
npm install axios cheerio firebase-admin dotenv
```

**Create `.env` file:**
```env
SOURCE_URL=https://salaryswish.com
FIREBASE_PROJECT_ID=your-project-id
```

#### Step 2.2: Build Team Scraper

**File:** `data_pipeline/architect_scraper/scrapeTeams.js`

```javascript
import axios from 'axios';
import * as cheerio from 'cheerio';
import admin from 'firebase-admin';
import fs from 'fs';

// Initialize Firebase
const serviceAccount = JSON.parse(
  fs.readFileSync('../../serviceAccountKey.json', 'utf8')
);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

const TEAM_CODES = [
  "ATL", "BOS", "BKN", "CHA", "CHI", "CLE", "DAL", "DEN", "DET", "GSW",
  "HOU", "IND", "LAC", "LAL", "MEM", "MIA", "MIL", "MIN", "NOP", "NYK",
  "OKC", "ORL", "PHI", "PHX", "POR", "SAC", "SAS", "TOR", "UTA", "WAS"
];

async function scrapeTeamPage(teamCode) {
  // Fetch team page HTML
  const url = `https://salaryswish.com/teams/${teamCode.toLowerCase()}`;
  const response = await axios.get(url);
  const $ = cheerio.load(response.data);
  
  // Extract data from page
  const teamData = {
    teamCode,
    teamName: $('h1.team-name').text().trim(),
    season: "2025-26",
    
    // Parse roster table
    roster: [],
    
    // Parse cap data
    totals: {
      totalSalary: parseFloat($('.total-salary').text().replace(/[$,]/g, '')),
      capSpace: parseFloat($('.cap-space').text().replace(/[$,]/g, '')),
      // ... more fields
    },
    
    // Parse exceptions
    exceptions: {
      mle: parseMLE($),
      bae: parseBAE($),
      tradeExceptions: parseTPEs($)
    },
    
    // Parse draft picks
    draftPicks: parseDraftPicks($),
    
    // Parse cap holds
    capHolds: parseCapHolds($),
    
    // Parse dead cap
    deadCap: parseDeadCap($),
    
    // Metadata
    source: {
      provider: "SalarySwish",
      teamPageUrl: url,
      scrapedAt: new Date().toISOString()
    },
    lastUpdated: new Date().toISOString(),
    version: "1.0"
  };
  
  // Extract roster player IDs
  $('.roster-table tbody tr').each((i, row) => {
    const playerName = $(row).find('.player-name').text().trim();
    const playerId = playerName.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    teamData.roster.push(playerId);
  });
  
  return teamData;
}

async function scrapeAllTeams() {
  console.log('🏀 Scraping all 30 NBA teams...\n');
  
  const teams = [];
  for (const teamCode of TEAM_CODES) {
    console.log(`  Scraping ${teamCode}...`);
    try {
      const teamData = await scrapeTeamPage(teamCode);
      teams.push(teamData);
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`  ❌ Error scraping ${teamCode}:`, error.message);
    }
  }
  
  // Save to JSON for review
  fs.writeFileSync(
    './scraped_teams.json',
    JSON.stringify(teams, null, 2)
  );
  
  console.log(`\n✅ Scraped ${teams.length}/30 teams`);
  return teams;
}

// Run
scrapeAllTeams().then(() => process.exit(0));
```

**Run scraper:**
```bash
node scrapeTeams.js
```

**Expected output:** `scraped_teams.json` with 30 team objects

#### Step 2.3: Build Player Scraper

**File:** `data_pipeline/architect_scraper/scrapePlayers.js`

```javascript
import axios from 'axios';
import * as cheerio from 'cheerio';
import fs from 'fs';

async function scrapePlayerPage(playerId, playerUrl) {
  const response = await axios.get(playerUrl);
  const $ = cheerio.load(response.data);
  
  const playerData = {
    playerId,
    displayName: $('h1.player-name').text().trim(),
    teamCode: parseTeamCode($),
    teamName: parseTeamName($),
    
    bio: {
      position: $('.position').text().trim(),
      height: $('.height').text().trim(),
      weight: $('.weight').text().trim(),
      age: parseInt($('.age').text()),
      birthdate: $('.birthdate').text().trim(),
      experience: parseInt($('.experience').text()),
      draft: parseDraftInfo($)
    },
    
    contract: {
      contractType: $('.contract-type').text().trim(),
      isExtension: parseIsExtension($),
      isRookieScale: parseIsRookieScale($),
      
      signedUsing: parseSigningMethod($),
      signingTeam: parseSigningTeam($),
      signingDate: parseSigningDate($),
      signedByCurrentTeam: true,
      
      startSeason: parseStartSeason($),
      endSeason: parseEndSeason($),
      contractLength: parseContractLength($),
      yearsRemaining: parseYearsRemaining($),
      
      totalValue: parseTotalValue($),
      averageAnnualValue: parseAAV($),
      guaranteedValue: parseGuaranteedValue($),
      guaranteedYears: parseGuaranteedYears($),
      
      salariesByYear: parseSalaryTable($),  // ← Most important!
      
      noTradeClause: parseNTC($),
      tradeKicker: parseTradeKicker($),
      tradeRestrictions: parseTradeRestrictions($),
      
      birdRights: {
        status: parseBirdRights($),
        yearsOfService: parseYearsOfService($),  // ← NEW FIELD
        yearsWithTeam: parseYearsWithTeam($)
      },
      
      freeAgency: {
        type: parseFAType($),
        year: parseFAYear($),
        capHold: parseCapHold($),
        qualifyingOffer: parseQO($),
        earlyTerminationOption: parseETO($)
      },
      
      tradeEligibility: {
        canBeTradedNow: parseCanTrade($),
        restrictedUntil: parseTradeRestrictedDate($),
        reason: parseTradeRestrictionReason($),
        rules: {
          baseYearCompensation: parseBYC($),
          poisonPill: parsePoisonPill($),
          aggregation: parseAggregation($)
        }
      }
    },
    
    source: {
      provider: "SalarySwish",
      playerPageUrl: playerUrl,
      scrapedAt: new Date().toISOString()
    },
    lastUpdated: new Date().toISOString(),
    version: "1.0"
  };
  
  return playerData;
}

// Helper function: Parse salary table (CRITICAL)
function parseSalaryTable($) {
  const salaries = [];
  
  $('.salary-table tbody tr').each((i, row) => {
    const yearText = $(row).find('.year').text().trim();
    const salaryText = $(row).find('.salary').text().trim();
    const guaranteedText = $(row).find('.guaranteed').text().trim();
    const optionText = $(row).find('.option').text().trim();
    
    // Convert year to season format
    const year = parseInt(yearText);
    const season = `${year}-${String(year + 1).slice(2)}`;  // 2025 → "2025-26"
    
    const salaryData = {
      season,  // ← Changed from "year"
      salary: parseFloat(salaryText.replace(/[$,]/g, '')),
      capHit: parseFloat(salaryText.replace(/[$,]/g, '')),  // ← NEW FIELD
      guaranteed: guaranteedText.toLowerCase().includes('yes'),
      guaranteedAmount: parseGuaranteedAmount(guaranteedText),
      option: parseOption(optionText),  // "PO", "TO", "ETO", or null
      tradeBonus: parseTradeBonus($, season),  // ← NEW FIELD (per-year)
      incentives: {
        likely: parseLikelyIncentives($, season),
        unlikely: parseUnlikelyIncentives($, season)
      }
    };
    
    salaries.push(salaryData);
  });
  
  return salaries;
}

async function scrapeAllPlayers(teamData) {
  console.log('👤 Scraping all players...\n');
  
  const players = [];
  const allPlayerIds = new Set();
  
  // Collect all unique player IDs from teams
  teamData.forEach(team => {
    team.roster.forEach(playerId => allPlayerIds.add(playerId));
  });
  
  console.log(`  Found ${allPlayerIds.size} unique players\n`);
  
  let count = 0;
  for (const playerId of allPlayerIds) {
    count++;
    console.log(`  [${count}/${allPlayerIds.size}] Scraping ${playerId}...`);
    
    try {
      const playerUrl = `https://salaryswish.com/players/${playerId.replace(/_/g, '-')}`;
      const playerData = await scrapePlayerPage(playerId, playerUrl);
      players.push(playerData);
      
      // Rate limiting (important!)
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Progress update every 50 players
      if (count % 50 === 0) {
        console.log(`\n  ✅ Progress: ${count}/${allPlayerIds.size} complete\n`);
      }
    } catch (error) {
      console.error(`  ❌ Error scraping ${playerId}:`, error.message);
    }
  }
  
  // Save to JSON
  fs.writeFileSync(
    './scraped_players.json',
    JSON.stringify(players, null, 2)
  );
  
  console.log(`\n✅ Scraped ${players.length}/${allPlayerIds.size} players`);
  return players;
}

// Run
const teamData = JSON.parse(fs.readFileSync('./scraped_teams.json', 'utf8'));
scrapeAllPlayers(teamData).then(() => process.exit(0));
```

**Run scraper:**
```bash
node scrapePlayers.js
```

**Expected output:** `scraped_players.json` with ~530 player objects

**Duration:** 10-15 minutes (with rate limiting)

#### Step 2.4: Validate Scraped Data

**File:** `data_pipeline/architect_scraper/validateData.js`

```javascript
import fs from 'fs';

function validateTeams(teams) {
  console.log('🔍 Validating team data...\n');
  
  const errors = [];
  
  teams.forEach(team => {
    // Required fields
    if (!team.teamCode) errors.push(`Team missing teamCode`);
    if (!team.roster || team.roster.length === 0) errors.push(`${team.teamCode}: Empty roster`);
    if (!team.totals) errors.push(`${team.teamCode}: Missing totals`);
    
    // Roster size check
    if (team.roster.length < 10 || team.roster.length > 20) {
      errors.push(`${team.teamCode}: Unusual roster size (${team.roster.length})`);
    }
    
    // Salary sanity check
    if (team.totals.totalSalary < 50000000 || team.totals.totalSalary > 250000000) {
      errors.push(`${team.teamCode}: Unusual total salary ($${team.totals.totalSalary.toLocaleString()})`);
    }
  });
  
  if (errors.length > 0) {
    console.log('❌ Validation errors found:\n');
    errors.forEach(err => console.log(`  - ${err}`));
    return false;
  }
  
  console.log('✅ All teams valid!\n');
  return true;
}

function validatePlayers(players) {
  console.log('🔍 Validating player data...\n');
  
  const errors = [];
  
  players.forEach(player => {
    // Required fields
    if (!player.playerId) errors.push(`Player missing playerId`);
    if (!player.contract) errors.push(`${player.playerId}: Missing contract`);
    if (!player.contract.salariesByYear || player.contract.salariesByYear.length === 0) {
      errors.push(`${player.playerId}: Missing salariesByYear`);
    }
    
    // Check season format
    player.contract.salariesByYear?.forEach((salary, idx) => {
      if (!salary.season || !salary.season.match(/^\d{4}-\d{2}$/)) {
        errors.push(`${player.playerId}: Invalid season format at index ${idx} (expected "YYYY-YY", got "${salary.season}")`);
      }
    });
    
    // Check for NEW required fields
    if (!player.contract.birdRights?.yearsOfService) {
      errors.push(`${player.playerId}: Missing yearsOfService`);
    }
    if (player.contract.isRookieScale === undefined) {
      errors.push(`${player.playerId}: Missing isRookieScale`);
    }
  });
  
  if (errors.length > 0) {
    console.log('❌ Validation errors found:\n');
    errors.forEach(err => console.log(`  - ${err}`));
    return false;
  }
  
  console.log('✅ All players valid!\n');
  return true;
}

// Run
const teams = JSON.parse(fs.readFileSync('./scraped_teams.json', 'utf8'));
const players = JSON.parse(fs.readFileSync('./scraped_players.json', 'utf8'));

const teamsValid = validateTeams(teams);
const playersValid = validatePlayers(players);

if (teamsValid && playersValid) {
  console.log('🎉 All data validated successfully!');
  process.exit(0);
} else {
  console.log('\n⚠️  Fix validation errors before uploading to Firestore');
  process.exit(1);
}
```

**Run validation:**
```bash
node validateData.js
```

#### Step 2.5: Upload to Firestore

**File:** `data_pipeline/architect_scraper/uploadToFirestore.js`

```javascript
import admin from 'firebase-admin';
import fs from 'fs';

// Initialize Firebase
const serviceAccount = JSON.parse(
  fs.readFileSync('../../serviceAccountKey.json', 'utf8')
);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

async function uploadTeams(teams) {
  console.log('📤 Uploading teams to Firestore...\n');
  
  const batch = db.batch();
  let count = 0;
  
  teams.forEach(team => {
    const docRef = db.collection('architect').doc('baseTeams').collection('teams').doc(team.teamCode);
    batch.set(docRef, team);
    count++;
  });
  
  await batch.commit();
  console.log(`✅ Uploaded ${count} teams\n`);
}

async function uploadPlayers(players) {
  console.log('📤 Uploading players to Firestore...\n');
  
  // Firestore batch limit is 500 operations
  const BATCH_SIZE = 450;
  let batch = db.batch();
  let batchCount = 0;
  let totalCount = 0;
  
  for (const player of players) {
    const docRef = db.collection('architect').doc('basePlayers').collection('players').doc(player.playerId);
    batch.set(docRef, player);
    batchCount++;
    totalCount++;
    
    if (batchCount >= BATCH_SIZE) {
      await batch.commit();
      console.log(`  Committed batch: ${totalCount}/${players.length} players`);
      batch = db.batch();
      batchCount = 0;
    }
  }
  
  // Commit remaining
  if (batchCount > 0) {
    await batch.commit();
  }
  
  console.log(`✅ Uploaded ${totalCount} players\n`);
}

async function main() {
  const teams = JSON.parse(fs.readFileSync('./scraped_teams.json', 'utf8'));
  const players = JSON.parse(fs.readFileSync('./scraped_players.json', 'utf8'));
  
  await uploadTeams(teams);
  await uploadPlayers(players);
  
  console.log('🎉 All data uploaded to Firestore!');
}

main().then(() => process.exit(0)).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
```

**Run upload:**
```bash
node uploadToFirestore.js
```

**Verify in Firebase Console:**
```
/architect/
  ├─ baseTeams/ (30 docs)
  └─ basePlayers/ (530 docs)
```

### Phase 2 Checklist

- [ ] Scraping environment set up
- [ ] Team scraper built and tested
- [ ] Player scraper built and tested
- [ ] All 30 teams scraped successfully
- [ ] All ~530 players scraped successfully
- [ ] Data validated (no errors)
- [ ] Uploaded to Firestore
- [ ] Verified in Firebase Console
- [ ] Backup created (JSON files saved)

---

## Phase 3: Core Implementation

**Duration:** 3-4 days
**Goal:** Build world management and team operations

### High-Level Overview

```
Day 1: World CRUD
├─ Create world
├─ Load world
├─ Delete world
└─ Update world metadata

Day 2: Team Operations
├─ Execute trade
├─ Sign free agent
├─ Waive player
└─ Renounce rights

Day 3: Season & Branching
├─ Advance season
├─ Process contracts
├─ Fork/branch world
└─ World navigation

Day 4: Testing & Polish
├─ Integration tests
├─ CBA validation
├─ Error handling
└─ Performance optimization
```

### Detailed Steps

#### Step 3.1: Create World Management Module

**File:** `/src/utils/architect/worldManager.js`

```javascript
import { db } from '@/firebase/config';
import { 
  doc, getDoc, setDoc, updateDoc, deleteDoc, 
  collection, getDocs, serverTimestamp, 
  writeBatch, FieldValue 
} from 'firebase/firestore';

/**
 * Generate unique world ID
 */
function generateWorldId() {
  return `world_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create new world
 */
export async function createWorld({ name, description, parentWorldId = null }) {
  const worldId = generateWorldId();
  const userId = getCurrentUserId();  // Implement based on your auth
  
  const metadata = {
    worldId,
    worldName: name,
    description: description || "",
    createdBy: userId,
    createdAt: serverTimestamp(),
    lastModifiedAt: serverTimestamp(),
    currentSeason: "2025-26",
    baselineSeason: "2025-26",
    parentWorldId,
    branchedFrom: parentWorldId ? serverTimestamp() : null,
    childWorlds: [],
    modifiedTeams: [],
    actionCount: 0,
    tags: [],
    isArchived: false,
    isFavorite: false,
    stats: {
      totalTrades: 0,
      totalSignings: 0,
      totalWaives: 0,
      teamsInvolved: 0
    }
  };
  
  const batch = writeBatch(db);
  
  // Create metadata doc
  const metadataRef = doc(db, `architect/worlds/${worldId}/metadata`);
  batch.set(metadataRef, metadata);
  
  // Update parent's childWorlds
  if (parentWorldId) {
    const parentRef = doc(db, `architect/worlds/${parentWorldId}/metadata`);
    batch.update(parentRef, {
      childWorlds: FieldValue.arrayUnion(worldId)
    });
  }
  
  await batch.commit();
  
  return { worldId, metadata };
}

/**
 * Load world metadata
 */
export async function getWorldMetadata(worldId) {
  const docRef = doc(db, `architect/worlds/${worldId}/metadata`);
  const docSnap = await getDoc(docRef);
  
  if (!docSnap.exists()) {
    throw new Error(`World ${worldId} not found`);
  }
  
  return docSnap.data();
}

/**
 * Delete world
 */
export async function deleteWorld(worldId) {
  // TODO: Recursively delete all subcollections (teams, players, etc.)
  // For now, just delete metadata
  const metadataRef = doc(db, `architect/worlds/${worldId}/metadata`);
  await deleteDoc(metadataRef);
}

/**
 * List user's worlds
 */
export async function listUserWorlds(userId) {
  const worldsRef = collection(db, 'architect/worlds');
  const snapshot = await getDocs(worldsRef);
  
  const worlds = [];
  snapshot.forEach(doc => {
    const metadata = doc.data().metadata;
    if (metadata && metadata.createdBy === userId) {
      worlds.push(metadata);
    }
  });
  
  return worlds;
}
```

#### Step 3.2: Create Team Data Loader

**File:** `/src/utils/architect/teamLoader.js`

```javascript
import { db } from '@/firebase/config';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';

/**
 * Get team with fallback chain (world → parent → base)
 */
export async function getTeam(worldId, teamCode) {
  // Base mode
  if (!worldId) {
    return await getBaseTeam(teamCode);
  }
  
  // Try world snapshot
  const worldTeamRef = doc(db, `architect/worlds/${worldId}/snapshot/teams/${teamCode}`);
  const worldTeamSnap = await getDoc(worldTeamRef);
  
  if (worldTeamSnap.exists()) {
    return worldTeamSnap.data();
  }
  
  // Try parent world
  const worldMetaRef = doc(db, `architect/worlds/${worldId}/metadata`);
  const worldMetaSnap = await getDoc(worldMetaRef);
  
  if (worldMetaSnap.exists()) {
    const parentWorldId = worldMetaSnap.data().parentWorldId;
    if (parentWorldId) {
      return await getTeam(parentWorldId, teamCode);
    }
  }
  
  // Fall back to base
  return await getBaseTeam(teamCode);
}

/**
 * Get base team
 */
async function getBaseTeam(teamCode) {
  const baseTeamRef = doc(db, `architect/baseTeams/${teamCode}`);
  const baseTeamSnap = await getDoc(baseTeamRef);
  
  if (!baseTeamSnap.exists()) {
    throw new Error(`Team ${teamCode} not found in base`);
  }
  
  return baseTeamSnap.data();
}

/**
 * Get all teams for league view
 */
export async function getLeague(worldId) {
  const TEAM_CODES = [
    "ATL", "BOS", "BKN", "CHA", "CHI", "CLE", "DAL", "DEN", "DET", "GSW",
    "HOU", "IND", "LAC", "LAL", "MEM", "MIA", "MIL", "MIN", "NOP", "NYK",
    "OKC", "ORL", "PHI", "PHX", "POR", "SAC", "SAS", "TOR", "UTA", "WAS"
  ];
  
  // Parallel load all teams
  const teams = await Promise.all(
    TEAM_CODES.map(code => getTeam(worldId, code))
  );
  
  return teams;
}

/**
 * Get player with overrides
 */
export async function getPlayer(worldId, teamCode, playerId) {
  // Base mode
  if (!worldId) {
    return await getBasePlayer(playerId);
  }
  
  // Try world override
  const overrideRef = doc(db, `architect/worlds/${worldId}/snapshot/teams/${teamCode}/players/${playerId}`);
  const overrideSnap = await getDoc(overrideRef);
  
  // Get base player
  const basePlayer = await getBasePlayer(playerId);
  
  // Merge if override exists
  if (overrideSnap.exists()) {
    return mergePlayerOverride(basePlayer, overrideSnap.data());
  }
  
  return basePlayer;
}

/**
 * Get base player
 */
async function getBasePlayer(playerId) {
  const basePlayerRef = doc(db, `architect/basePlayers/${playerId}`);
  const basePlayerSnap = await getDoc(basePlayerRef);
  
  if (!basePlayerSnap.exists()) {
    throw new Error(`Player ${playerId} not found in base`);
  }
  
  return basePlayerSnap.data();
}

/**
 * Merge player override with base
 */
function mergePlayerOverride(basePlayer, override) {
  // Deep merge contract fields
  return {
    ...basePlayer,
    contract: {
      ...basePlayer.contract,
      ...(override.overrides?.contract || {}),
      salariesByYear: mergeSalariesByYear(
        basePlayer.contract.salariesByYear,
        override.overrides?.contract?.salariesByYear
      )
    }
  };
}

function mergeSalariesByYear(baseSalaries, overrideSalaries) {
  if (!overrideSalaries) return baseSalaries;
  
  const merged = [...baseSalaries];
  overrideSalaries.forEach(override => {
    const idx = merged.findIndex(s => s.season === override.season);
    if (idx >= 0) {
      merged[idx] = { ...merged[idx], ...override };
    }
  });
  return merged;
}
```

#### Step 3.3: Implement Trade Execution

**File:** `/src/utils/architect/tradeManager.js`

```javascript
import { db } from '@/firebase/config';
import { doc, writeBatch, serverTimestamp, FieldValue } from 'firebase/firestore';
import { getTeam } from './teamLoader';
import { calculateCapTotals } from './capCalculations';
import { validateTrade } from './tradeValidation';

/**
 * Execute trade between two teams
 */
export async function executeTrade(worldId, tradeData) {
  const { teamA, teamB, playersAtoB, playersBtoA } = tradeData;
  
  // 1. Load current team states
  const teamAData = await getTeam(worldId, teamA);
  const teamBData = await getTeam(worldId, teamB);
  
  // 2. Validate trade
  const validation = await validateTrade({
    teamA: teamAData,
    teamB: teamBData,
    playersAtoB,
    playersBtoA,
    worldId
  });
  
  if (!validation.isValid) {
    throw new Error(`Trade invalid: ${validation.reason}`);
  }
  
  // 3. Update rosters
  const newTeamA = {
    ...teamAData,
    roster: [
      ...teamAData.roster.filter(p => !playersAtoB.includes(p)),
      ...playersBtoA
    ],
    lastUpdated: new Date().toISOString()
  };
  
  const newTeamB = {
    ...teamBData,
    roster: [
      ...teamBData.roster.filter(p => !playersBtoA.includes(p)),
      ...playersAtoB
    ],
    lastUpdated: new Date().toISOString()
  };
  
  // 4. Recalculate cap totals
  newTeamA.totals = await calculateCapTotals(newTeamA, worldId);
  newTeamB.totals = await calculateCapTotals(newTeamB, worldId);
  
  // 5. Update source metadata
  newTeamA.source = {
    type: "world-snapshot",
    worldId,
    generatedAt: new Date().toISOString(),
    baseTeamVersion: teamAData.source?.scrapedAt || new Date().toISOString()
  };
  newTeamB.source = {
    type: "world-snapshot",
    worldId,
    generatedAt: new Date().toISOString(),
    baseTeamVersion: teamBData.source?.scrapedAt || new Date().toISOString()
  };
  
  // 6. Atomic write
  const batch = writeBatch(db);
  
  const teamARef = doc(db, `architect/worlds/${worldId}/snapshot/teams/${teamA}`);
  batch.set(teamARef, newTeamA);
  
  const teamBRef = doc(db, `architect/worlds/${worldId}/snapshot/teams/${teamB}`);
  batch.set(teamBRef, newTeamB);
  
  const metadataRef = doc(db, `architect/worlds/${worldId}/metadata`);
  batch.update(metadataRef, {
    lastModifiedAt: serverTimestamp(),
    actionCount: FieldValue.increment(1),
    modifiedTeams: FieldValue.arrayUnion(teamA, teamB),
    lastAction: {
      type: "trade",
      timestamp: new Date().toISOString(),
      description: `Traded ${playersAtoB.join(", ")} to ${teamB} for ${playersBtoA.join(", ")}`
    },
    "stats.totalTrades": FieldValue.increment(1),
    "stats.teamsInvolved": FieldValue.increment(2)
  });
  
  await batch.commit();
  
  return { success: true, newTeamA, newTeamB };
}
```

**Continue with remaining operations (signing, waiving, season advance, branching)...**

### Phase 3 Checklist

- [ ] World CRUD operations implemented
- [ ] Team data loading with fallback chain
- [ ] Trade execution
- [ ] Free agent signing
- [ ] Player waiving
- [ ] Season advancement
- [ ] Branch/fork functionality
- [ ] Cap calculations (recalculate totals)
- [ ] Trade validation (CBA rules)
- [ ] Unit tests written
- [ ] Integration tests passing

---

## Phase 4: UI & Polish

**Duration:** 2-3 days
**Goal:** Build user interface and test end-to-end

### High-Level Overview

```
Day 1: Core UI Components
├─ World selector dropdown
├─ Create world modal
├─ Season navigator
└─ Branch button

Day 2: Enhanced Features
├─ World management panel (list, rename, delete)
├─ Decision tree visualizer
├─ World comparison view
└─ Action history display

Day 3: Testing & Launch
├─ End-to-end testing
├─ Performance optimization
├─ Bug fixes
└─ Production deployment
```

### Detailed Steps

#### Step 4.1: Create World Selector Component

**File:** `/src/components/Architect/WorldSelector.jsx`

```javascript
import { useState, useEffect } from 'react';
import { listUserWorlds, createWorld } from '@/utils/architect/worldManager';
import { useAuth } from '@/contexts/AuthContext';

export function WorldSelector({ selectedWorldId, onWorldChange }) {
  const { user } = useAuth();
  const [worlds, setWorlds] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  
  useEffect(() => {
    loadWorlds();
  }, [user]);
  
  async function loadWorlds() {
    if (!user) return;
    const userWorlds = await listUserWorlds(user.uid);
    setWorlds(userWorlds);
  }
  
  async function handleCreateWorld(name, description) {
    const { worldId } = await createWorld({ name, description });
    await loadWorlds();
    onWorldChange(worldId);
    setShowCreateModal(false);
  }
  
  return (
    <div className="world-selector">
      <select 
        value={selectedWorldId || ""}
        onChange={(e) => onWorldChange(e.target.value || null)}
      >
        <option value="">Base Reality (Current NBA)</option>
        {worlds.map(world => (
          <option key={world.worldId} value={world.worldId}>
            {world.worldName} ({world.currentSeason})
          </option>
        ))}
      </select>
      
      <button onClick={() => setShowCreateModal(true)}>
        + New World
      </button>
      
      {showCreateModal && (
        <CreateWorldModal 
          onSubmit={handleCreateWorld}
          onCancel={() => setShowCreateModal(false)}
        />
      )}
    </div>
  );
}
```

#### Step 4.2: Update GMDashboard to Use Worlds

**File:** `/src/pages/GMDashboard.jsx` (modify existing)

```javascript
import { useState, useEffect } from 'react';
import { WorldSelector } from '@/components/Architect/WorldSelector';
import { getLeague } from '@/utils/architect/teamLoader';

export function GMDashboard() {
  const [selectedWorldId, setSelectedWorldId] = useState(null);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    loadLeagueData();
  }, [selectedWorldId]);
  
  async function loadLeagueData() {
    setLoading(true);
    const leagueData = await getLeague(selectedWorldId);
    setTeams(leagueData);
    setLoading(false);
  }
  
  return (
    <div className="gm-dashboard">
      <header>
        <h1>GM Tools - Architect</h1>
        <WorldSelector 
          selectedWorldId={selectedWorldId}
          onWorldChange={setSelectedWorldId}
        />
      </header>
      
      {loading ? (
        <div>Loading...</div>
      ) : (
        <div className="teams-grid">
          {teams.map(team => (
            <TeamCard 
              key={team.teamCode} 
              team={team}
              worldId={selectedWorldId}
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

### Phase 4 Checklist

- [ ] World selector component built
- [ ] Create world modal
- [ ] Season navigator
- [ ] Branch button
- [ ] GMDashboard updated to use worlds
- [ ] CapSheet updated to use worlds
- [ ] TradeMachine updated to use worlds
- [ ] World management panel
- [ ] Action history display
- [ ] End-to-end tests passing
- [ ] Performance acceptable (<200ms)
- [ ] Production deployment

---

## Final Checklist: Ready to Launch

### Data
- [ ] Base teams populated (30 docs)
- [ ] Base players populated (530 docs)
- [ ] Data validated and accurate
- [ ] Season format correct ("2025-26")
- [ ] All required fields present

### Code
- [ ] World management module complete
- [ ] Team/player loading with fallback chain
- [ ] Trade execution working
- [ ] Signing/waiving implemented
- [ ] Season advancement working
- [ ] Branching/forking functional
- [ ] Cap calculations accurate
- [ ] CBA validation implemented

### UI
- [ ] World selector integrated
- [ ] Create world workflow
- [ ] Branch world functionality
- [ ] Season navigation
- [ ] Clear visual feedback

### Testing
- [ ] Unit tests passing
- [ ] Integration tests passing
- [ ] Manual end-to-end testing complete
- [ ] Performance benchmarks met
- [ ] Error handling robust

### Documentation
- [ ] User guide written
- [ ] Developer docs updated
- [ ] API reference created
- [ ] Migration guide (if needed)

### Production
- [ ] Firebase security rules updated
- [ ] Environment variables set
- [ ] Monitoring configured
- [ ] Backup strategy in place
- [ ] Rollback plan documented

---

## Success Metrics

After launch, monitor:

**Performance:**
- League view load time: Target <200ms (30 queries)
- Trade execution time: Target <500ms
- World creation time: Target <300ms

**Usage:**
- Worlds created per user: Baseline
- Branches created: Baseline
- Trades executed: Baseline
- Season advancements: Baseline

**Data Quality:**
- Data accuracy vs source: 99%+
- Calculation errors: <0.1%
- System uptime: 99.9%+

---

## Troubleshooting

### Common Issues

**Issue:** Slow league view loading
- **Cause:** Too many Firestore queries
- **Fix:** Implement query batching, add indexes

**Issue:** Stale cap calculations
- **Cause:** Totals not recalculated after roster change
- **Fix:** Always call `calculateCapTotals()` after modifications

**Issue:** Trade validation failing incorrectly
- **Cause:** CBA rules not correctly implemented
- **Fix:** Review CBA validation logic, add tests

**Issue:** Player not found in world
- **Cause:** Fallback chain broken
- **Fix:** Check `getPlayer()` logic, ensure parent lookup works

---

## Next Phase: Future Enhancements

After successful launch, consider:

1. **Action History UI** - Visual timeline of decisions
2. **World Comparison** - Side-by-side diff view
3. **Undo/Redo** - Revert individual actions
4. **Export/Share** - Share worlds with other users
5. **AI Suggestions** - ML-powered trade recommendations
6. **Multiplayer** - Collaborate on worlds
7. **Mobile App** - Native iOS/Android clients

---

**Ready to begin Phase 2? Let's scrape some data! 🚀**
