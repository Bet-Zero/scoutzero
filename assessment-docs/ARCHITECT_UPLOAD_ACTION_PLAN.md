# Architect Upload - Quick Action Plan
## 11 Files to Create for Production Ready Pipeline

**Goal:** Connect existing scrapers to Firestore `/architect` collections

**Estimated Time:** 2-3 days (20-28 hours)

---

## File 1: `scripts/architect-upload/upload_players.js`

**Purpose:** Upload scraped player data to `/architect/basePlayers/{playerId}`

**Template:**
```javascript
#!/usr/bin/env node
import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { transformPlayer } from './transform_player.js';

// Initialize Firebase
const serviceAccount = JSON.parse(
  fs.readFileSync('./serviceAccountKey.json', 'utf8')
);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

async function uploadPlayers(inputDir = 'player-scrape/output') {
  console.log('📤 Uploading players to /architect/basePlayers...');
  
  const files = fs.readdirSync(inputDir).filter(f => f.endsWith('.json'));
  console.log(`Found ${files.length} player files`);
  
  const batch = db.batch();
  let count = 0;
  
  for (const file of files) {
    const playerData = JSON.parse(
      fs.readFileSync(path.join(inputDir, file), 'utf8')
    );
    
    // Transform to target schema
    const transformed = transformPlayer(playerData);
    
    // Upload to /architect/basePlayers/{playerId}
    const docRef = db.collection('architect').doc('basePlayers')
      .collection(transformed.playerId).doc('data');
    
    batch.set(docRef, transformed);
    count++;
    
    if (count % 500 === 0) {
      await batch.commit();
      console.log(`  Uploaded ${count}/${files.length} players...`);
    }
  }
  
  await batch.commit();
  console.log(`✅ Uploaded ${count} players successfully`);
}

uploadPlayers().catch(console.error);
```

**Effort:** 2-3 hours

---

## File 2: `scripts/architect-upload/upload_teams.js`

**Purpose:** Upload scraped team data to `/architect/baseTeams/{teamCode}`

**Template:**
```javascript
#!/usr/bin/env node
import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { transformTeam } from './transform_team.js';
import { resolvePlayerId } from './resolve_player_id.js';

// Initialize Firebase (same as above)

async function uploadTeams(inputDir = 'team-scrape/output') {
  console.log('📤 Uploading teams to /architect/baseTeams...');
  
  const files = fs.readdirSync(inputDir).filter(f => f.endsWith('.json'));
  console.log(`Found ${files.length} team files`);
  
  const batch = db.batch();
  let count = 0;
  
  for (const file of files) {
    const teamData = JSON.parse(
      fs.readFileSync(path.join(inputDir, file), 'utf8')
    );
    
    // Resolve player IDs in roster
    teamData.roster = await Promise.all(
      teamData.roster.map(async (player) => {
        const playerId = await resolvePlayerId(player.url);
        return playerId;
      })
    );
    
    // Transform to target schema
    const transformed = transformTeam(teamData);
    
    // Upload to /architect/baseTeams/{teamCode}
    const docRef = db.collection('architect').doc('baseTeams')
      .doc(transformed.teamCode);
    
    batch.set(docRef, transformed);
    count++;
  }
  
  await batch.commit();
  console.log(`✅ Uploaded ${count} teams successfully`);
}

uploadTeams().catch(console.error);
```

**Effort:** 2-3 hours

---

## File 3: `scripts/architect-upload/transform_player.js`

**Purpose:** Transform player scraper output to architect target schema

**Template:**
```javascript
export function transformPlayer(scrapedData) {
  return {
    // Identity (same)
    playerId: scrapedData.playerId,
    displayName: scrapedData.displayName,
    teamCode: scrapedData.teamCode,
    teamName: scrapedData.teamName,
    
    // Bio
    bio: {
      position: scrapedData.bio?.position,
      height: scrapedData.bio?.height,
      weight: scrapedData.bio?.weight,
      age: scrapedData.bio?.age,
      birthdate: scrapedData.bio?.birthdate,
      experience: scrapedData.bio?.experience
    },
    
    // Contract (transform structure)
    contract: {
      type: scrapedData.contract?.contractType?.toLowerCase().replace(' ', '_'),
      is_extension: scrapedData.contract?.isExtension || false,
      is_rookie_scale: scrapedData.contract?.isRookieScale || false,
      
      // Signing details
      signed_using: scrapedData.contract?.signedUsing,
      signing_team: scrapedData.contract?.signingTeam,
      signing_date: scrapedData.contract?.signingDate,
      signed_by_current_team: scrapedData.contract?.signedByCurrentTeam,
      
      // Duration
      start_season: scrapedData.contract?.startSeason,
      end_season: scrapedData.contract?.endSeason,
      contract_length: scrapedData.contract?.contractLength,
      years_remaining: scrapedData.contract?.yearsRemaining,
      
      // Financial
      total_value: scrapedData.contract?.totalValue,
      average_annual_value: scrapedData.contract?.averageAnnualValue,
      guaranteed_value: scrapedData.contract?.guaranteedValue,
      guaranteed_years: scrapedData.contract?.guaranteedYears,
      
      // Per-year breakdown
      salaries_by_year: scrapedData.contract?.salariesByYear?.map(s => ({
        season: s.season,
        salary: s.salary,
        cap_hit: s.capHit,
        guaranteed: s.guaranteed,
        option: s.option,
        trade_bonus: s.tradeBonus,
        incentives: s.incentives
      })) || [],
      
      // Trade clauses
      no_trade_clause: scrapedData.contract?.noTradeClause || false,
      trade_kicker: scrapedData.contract?.tradeKicker,
      trade_restrictions: scrapedData.contract?.tradeRestrictions,
      
      // Bird rights
      bird_rights: scrapedData.contract?.birdRights?.status,
      years_of_service: scrapedData.contract?.birdRights?.yearsOfService,
      eligible_for: scrapedData.contract?.birdRights?.eligibleFor,
      
      // Free agency
      free_agency_type: scrapedData.contract?.freeAgency?.type,
      free_agency_year: scrapedData.contract?.freeAgency?.year,
      cap_hold: scrapedData.contract?.freeAgency?.capHold,
      qualifying_offer: scrapedData.contract?.freeAgency?.qualifyingOffer,
      
      // Trade eligibility
      trade_eligible: scrapedData.contract?.tradeEligibility?.canBeTradedNow,
      trade_restricted_until: scrapedData.contract?.tradeEligibility?.restrictedUntil,
      trade_restriction_reason: scrapedData.contract?.tradeEligibility?.reason,
      base_year_compensation: scrapedData.contract?.tradeEligibility?.rules?.baseYearCompensation,
      poison_pill: scrapedData.contract?.tradeEligibility?.rules?.poisonPill,
      aggregation: scrapedData.contract?.tradeEligibility?.rules?.aggregation
    },
    
    // Metadata
    source: {
      provider: scrapedData.source?.provider,
      player_page_url: scrapedData.source?.playerPageUrl,
      scraped_at: scrapedData.source?.scrapedAt
    }
  };
}
```

**Effort:** 1-2 hours

---

## File 4: `scripts/architect-upload/transform_team.js`

**Purpose:** Transform team scraper output to architect target schema

**Template:**
```javascript
export function transformTeam(scrapedData) {
  return {
    // Team identity
    teamCode: scrapedData.teamCode,
    teamName: scrapedData.teamName,
    season: scrapedData.season,
    abbreviation: scrapedData.teamCode,
    
    // Roster (already player IDs at this point)
    roster: scrapedData.roster || [],
    
    // Dead cap (empty if not available)
    deadCap: scrapedData.deadCap || [],
    
    // Cap holds
    capHolds: scrapedData.capHolds?.map(h => ({
      playerId: h.playerId || null,
      playerName: h.playerName,
      amount: h.amount,
      type: h.type,
      isSigned: false
    })) || [],
    
    // Exceptions
    exceptions: {
      // MLE
      mle: scrapedData.exceptions?.mle ? {
        type: scrapedData.exceptions.mle.type,
        available: scrapedData.exceptions.mle.remaining > 0,
        totalAmount: scrapedData.exceptions.mle.total,
        usedAmount: scrapedData.exceptions.mle.used,
        remainingAmount: scrapedData.exceptions.mle.remaining
      } : null,
      
      // BAE
      bae: scrapedData.exceptions?.bae ? {
        available: scrapedData.exceptions.bae.remaining > 0,
        totalAmount: scrapedData.exceptions.bae.total,
        remainingAmount: scrapedData.exceptions.bae.remaining
      } : null,
      
      // TPEs
      tradeExceptions: scrapedData.exceptions?.tradeExceptions?.map(tpe => ({
        amount: tpe.amount,
        expires: tpe.expiresOn,
        tradedPlayer: tpe.tradedPlayer,
        acquiredDate: tpe.acquiredDate
      })) || []
    },
    
    // Draft picks
    draftPicks: scrapedData.draftPicks?.map(pick => ({
      year: pick.year,
      round: pick.round,
      status: pick.status,
      originalTeam: pick.originalTeam,
      protections: pick.protections,
      tradedTo: pick.tradedTo,
      tradedOn: pick.tradedOn
    })) || [],
    
    // Totals (convert to snake_case)
    totals: {
      total_salary: scrapedData.totals?.totalSalary,
      active_salary: scrapedData.totals?.activeSalary,
      dead_cap_total: scrapedData.totals?.deadCapTotal || 0,
      cap_holds_total: scrapedData.totals?.capHoldsTotal,
      guaranteed_salary: scrapedData.totals?.guaranteedSalary,
      
      roster_count: scrapedData.totals?.rosterCount,
      two_way_count: scrapedData.totals?.twoWayCount,
      
      salary_cap: scrapedData.totals?.salaryCap,
      cap_space: scrapedData.totals?.capSpace,
      
      luxury_tax_line: scrapedData.totals?.luxuryTaxLine,
      tax_space: scrapedData.totals?.taxSpace,
      
      first_apron_line: scrapedData.totals?.firstApronLine,
      first_apron_room: scrapedData.totals?.firstApronRoom,
      first_apron_triggered: scrapedData.totals?.firstApronTriggered,
      
      second_apron_line: scrapedData.totals?.secondApronLine,
      second_apron_room: scrapedData.totals?.secondApronRoom,
      second_apron_triggered: scrapedData.totals?.secondApronTriggered,
      
      hard_capped_at: scrapedData.totals?.hardCappedAt
    },
    
    // Metadata
    source: {
      provider: scrapedData.source?.provider,
      team_page_url: scrapedData.source?.teamPageUrl,
      scraped_at: scrapedData.source?.scrapedAt
    }
  };
}
```

**Effort:** 1-2 hours

---

## File 5: `scripts/architect-upload/resolve_player_id.js`

**Purpose:** Convert SalarySwish URLs to ScoutZero player IDs

**Template:**
```javascript
import admin from 'firebase-admin';

let playerIdCache = null;

export async function resolvePlayerId(salarySwishUrl) {
  // Extract slug from URL (e.g., "/players/lebron-james" → "lebron-james")
  const slug = salarySwishUrl.split('/').pop();
  
  // Convert slug to snake_case (e.g., "lebron-james" → "lebron_james")
  const playerId = slug.replace(/-/g, '_');
  
  // Load cache on first call
  if (!playerIdCache) {
    playerIdCache = await loadPlayerIdMapping();
  }
  
  // Check if exists in cache
  if (playerIdCache[slug]) {
    return playerIdCache[slug];
  }
  
  // Manual overrides for edge cases
  const overrides = {
    'vit-krejci': 'vit_krejci',
    'ron-holland-ii': 'ronald_holland_ii',
    'aj-green': 'aj_green',
    'oj-mayo': 'oj_mayo'
  };
  
  if (overrides[slug]) {
    return overrides[slug];
  }
  
  // Default: return converted slug
  return playerId;
}

async function loadPlayerIdMapping() {
  const db = admin.firestore();
  const snapshot = await db.collection('players').get();
  
  const mapping = {};
  snapshot.forEach(doc => {
    const data = doc.data();
    const name = data.Name || data.bio?.name;
    if (name) {
      // Create slug from name
      const slug = name.toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '');
      mapping[slug] = doc.id;
    }
  });
  
  return mapping;
}
```

**Effort:** 1-2 hours

---

## File 6: `scripts/architect-upload/orchestrate.js`

**Purpose:** Master script to run entire pipeline

**Template:**
```javascript
#!/usr/bin/env node
import { exec } from 'child_process';
import util from 'util';

const execPromise = util.promisify(exec);

async function runCommand(command, description) {
  console.log(`\n📋 ${description}`);
  console.log(`   Running: ${command}`);
  
  try {
    const { stdout, stderr } = await execPromise(command);
    if (stdout) console.log(stdout);
    if (stderr) console.error(stderr);
    console.log(`   ✅ ${description} complete`);
  } catch (error) {
    console.error(`   ❌ ${description} failed:`, error.message);
    throw error;
  }
}

async function orchestrate() {
  console.log('🚀 Starting Architect Upload Pipeline');
  console.log('=====================================\n');
  
  try {
    // Step 1: Scrape players
    await runCommand(
      'PLAYERS_FILE="player-scrape/all_nba_players.json" OUTPUT_DIR="player-scrape/output" npm run batch-scrape-players',
      'Step 1: Scrape all players'
    );
    
    // Step 2: Scrape teams
    await runCommand(
      'TEAMS_FILE="team-scrape/all_nba_teams.json" OUTPUT_DIR="team-scrape/output" npm run batch-scrape-teams',
      'Step 2: Scrape all teams'
    );
    
    // Step 3: Upload players
    await runCommand(
      'node scripts/architect-upload/upload_players.js',
      'Step 3: Upload players to Firestore'
    );
    
    // Step 4: Upload teams
    await runCommand(
      'node scripts/architect-upload/upload_teams.js',
      'Step 4: Upload teams to Firestore'
    );
    
    // Step 5: Validate
    await runCommand(
      'node scripts/architect-upload/validate.js',
      'Step 5: Validate uploaded data'
    );
    
    console.log('\n✅ Pipeline complete!');
    console.log('=====================================\n');
    
  } catch (error) {
    console.error('\n❌ Pipeline failed:', error.message);
    process.exit(1);
  }
}

orchestrate();
```

**Effort:** 1-2 hours

---

## File 7: `scripts/architect-upload/validate.js`

**Purpose:** Validate uploaded data quality

**Template:**
```javascript
#!/usr/bin/env node
import admin from 'firebase-admin';

// Initialize Firebase (same as above)

async function validate() {
  console.log('🔍 Validating uploaded data...\n');
  
  const db = admin.firestore();
  
  // Check teams collection
  const teamsSnap = await db.collection('architect/baseTeams').get();
  console.log(`✅ Teams: ${teamsSnap.size} teams found`);
  if (teamsSnap.size !== 30) {
    console.warn(`⚠️  Expected 30 teams, found ${teamsSnap.size}`);
  }
  
  // Check players collection
  const playersSnap = await db.collection('architect/basePlayers').get();
  console.log(`✅ Players: ${playersSnap.size} players found`);
  if (playersSnap.size < 450) {
    console.warn(`⚠️  Expected ~530 players, found ${playersSnap.size}`);
  }
  
  // Validate sample team (Lakers)
  const lakersDoc = await db.collection('architect/baseTeams').doc('LAL').get();
  if (lakersDoc.exists) {
    const lakers = lakersDoc.data();
    console.log(`\n✅ Lakers validation:`);
    console.log(`   Roster: ${lakers.roster?.length || 0} players`);
    console.log(`   Cap holds: ${lakers.capHolds?.length || 0} items`);
    console.log(`   Total salary: $${(lakers.totals?.total_salary || 0).toLocaleString()}`);
    
    // Check required fields
    const requiredFields = ['teamCode', 'teamName', 'season', 'roster', 'totals'];
    const missing = requiredFields.filter(f => !lakers[f]);
    if (missing.length > 0) {
      console.warn(`   ⚠️  Missing fields: ${missing.join(', ')}`);
    } else {
      console.log(`   ✅ All required fields present`);
    }
  } else {
    console.error(`❌ Lakers not found in baseTeams`);
  }
  
  // Validate sample player (LeBron)
  const lebronDoc = await db.collection('architect').doc('basePlayers').collection('lebron_james').doc('data').get();
  if (lebronDoc.exists) {
    const lebron = lebronDoc.data();
    console.log(`\n✅ LeBron James validation:`);
    console.log(`   Team: ${lebron.teamName}`);
    console.log(`   Contract type: ${lebron.contract?.type}`);
    console.log(`   Bird rights: ${lebron.contract?.bird_rights}`);
    console.log(`   Trade eligible: ${lebron.contract?.trade_eligible}`);
    
    const requiredFields = ['playerId', 'displayName', 'teamCode', 'contract'];
    const missing = requiredFields.filter(f => !lebron[f]);
    if (missing.length > 0) {
      console.warn(`   ⚠️  Missing fields: ${missing.join(', ')}`);
    } else {
      console.log(`   ✅ All required fields present`);
    }
  } else {
    console.error(`❌ LeBron James not found in basePlayers`);
  }
  
  console.log('\n✅ Validation complete');
}

validate().catch(console.error);
```

**Effort:** 1-2 hours

---

## File 8: `team-scrape/batch_scrape_teams.ts`

**Purpose:** Batch scrape all 30 NBA teams

**Template:**
```typescript
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

interface Team {
  teamCode: string;
  slug: string;
  teamName: string;
}

const TEAMS_FILE = process.env.TEAMS_FILE || 'team-scrape/all_nba_teams.json';
const OUTPUT_DIR = process.env.OUTPUT_DIR || 'team-scrape/output';
const RATE_LIMIT_MS = parseInt(process.env.RATE_LIMIT_MS || '2000');

async function batchScrapeTeams() {
  // Load teams list
  const teams: Team[] = JSON.parse(fs.readFileSync(TEAMS_FILE, 'utf-8'));
  console.log(`📊 Scraping ${teams.length} teams...`);
  
  // Create output directory
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  
  // Launch browser
  const browser = await chromium.launch();
  
  let count = 0;
  for (const team of teams) {
    count++;
    console.log(`[${count}/${teams.length}] Scraping ${team.teamName}...`);
    
    try {
      // Fetch page
      const page = await browser.newPage();
      const url = `https://www.salaryswish.com/teams/${team.slug}`;
      await page.goto(url, { waitUntil: 'networkidle' });
      
      // Save HTML
      const html = await page.content();
      const htmlFile = path.join(OUTPUT_DIR, `${team.teamCode}_page.html`);
      fs.writeFileSync(htmlFile, html);
      
      // Parse (call parse_team.ts logic here)
      // For now, just save the HTML
      
      await page.close();
      
      console.log(`  ✅ Saved ${team.teamCode}`);
      
      // Rate limiting
      if (count < teams.length) {
        await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_MS));
      }
    } catch (error) {
      console.error(`  ❌ Failed to scrape ${team.teamName}:`, error.message);
    }
  }
  
  await browser.close();
  console.log(`\n✅ Scraping complete: ${count} teams`);
}

batchScrapeTeams();
```

**Effort:** 1-2 hours

---

## File 9: `player-scrape/all_nba_players.json`

**Purpose:** List of all NBA players to scrape

**Template:**
```json
[
  {
    "playerId": "lebron_james",
    "slug": "lebron-james",
    "teamCode": "LAL"
  },
  {
    "playerId": "anthony_davis",
    "slug": "anthony-davis",
    "teamCode": "LAL"
  },
  {
    "playerId": "stephen_curry",
    "slug": "stephen-curry",
    "teamCode": "GSW"
  }
  // ... ~530 total players
]
```

**Generation Script:**
```javascript
// Generate from /players collection
const snapshot = await db.collection('players').get();
const playersList = [];

snapshot.forEach(doc => {
  const data = doc.data();
  const name = data.Name || data.bio?.name;
  const team = data.Team || data.bio?.Team;
  
  if (name) {
    playersList.push({
      playerId: doc.id,
      slug: name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
      teamCode: team || 'UNK'
    });
  }
});

fs.writeFileSync('player-scrape/all_nba_players.json', JSON.stringify(playersList, null, 2));
```

**Effort:** 1-2 hours

---

## File 10: `team-scrape/all_nba_teams.json`

**Purpose:** List of all 30 NBA teams to scrape

**Template:**
```json
[
  {
    "teamCode": "ATL",
    "slug": "hawks",
    "teamName": "Atlanta Hawks"
  },
  {
    "teamCode": "BOS",
    "slug": "celtics",
    "teamName": "Boston Celtics"
  },
  {
    "teamCode": "BKN",
    "slug": "nets",
    "teamName": "Brooklyn Nets"
  },
  {
    "teamCode": "CHA",
    "slug": "hornets",
    "teamName": "Charlotte Hornets"
  },
  {
    "teamCode": "CHI",
    "slug": "bulls",
    "teamName": "Chicago Bulls"
  },
  {
    "teamCode": "CLE",
    "slug": "cavaliers",
    "teamName": "Cleveland Cavaliers"
  },
  {
    "teamCode": "DAL",
    "slug": "mavericks",
    "teamName": "Dallas Mavericks"
  },
  {
    "teamCode": "DEN",
    "slug": "nuggets",
    "teamName": "Denver Nuggets"
  },
  {
    "teamCode": "DET",
    "slug": "pistons",
    "teamName": "Detroit Pistons"
  },
  {
    "teamCode": "GSW",
    "slug": "warriors",
    "teamName": "Golden State Warriors"
  },
  {
    "teamCode": "HOU",
    "slug": "rockets",
    "teamName": "Houston Rockets"
  },
  {
    "teamCode": "IND",
    "slug": "pacers",
    "teamName": "Indiana Pacers"
  },
  {
    "teamCode": "LAC",
    "slug": "clippers",
    "teamName": "LA Clippers"
  },
  {
    "teamCode": "LAL",
    "slug": "lakers",
    "teamName": "Los Angeles Lakers"
  },
  {
    "teamCode": "MEM",
    "slug": "grizzlies",
    "teamName": "Memphis Grizzlies"
  },
  {
    "teamCode": "MIA",
    "slug": "heat",
    "teamName": "Miami Heat"
  },
  {
    "teamCode": "MIL",
    "slug": "bucks",
    "teamName": "Milwaukee Bucks"
  },
  {
    "teamCode": "MIN",
    "slug": "timberwolves",
    "teamName": "Minnesota Timberwolves"
  },
  {
    "teamCode": "NOP",
    "slug": "pelicans",
    "teamName": "New Orleans Pelicans"
  },
  {
    "teamCode": "NYK",
    "slug": "knicks",
    "teamName": "New York Knicks"
  },
  {
    "teamCode": "OKC",
    "slug": "thunder",
    "teamName": "Oklahoma City Thunder"
  },
  {
    "teamCode": "ORL",
    "slug": "magic",
    "teamName": "Orlando Magic"
  },
  {
    "teamCode": "PHI",
    "slug": "76ers",
    "teamName": "Philadelphia 76ers"
  },
  {
    "teamCode": "PHX",
    "slug": "suns",
    "teamName": "Phoenix Suns"
  },
  {
    "teamCode": "POR",
    "slug": "trail-blazers",
    "teamName": "Portland Trail Blazers"
  },
  {
    "teamCode": "SAC",
    "slug": "kings",
    "teamName": "Sacramento Kings"
  },
  {
    "teamCode": "SAS",
    "slug": "spurs",
    "teamName": "San Antonio Spurs"
  },
  {
    "teamCode": "TOR",
    "slug": "raptors",
    "teamName": "Toronto Raptors"
  },
  {
    "teamCode": "UTA",
    "slug": "jazz",
    "teamName": "Utah Jazz"
  },
  {
    "teamCode": "WAS",
    "slug": "wizards",
    "teamName": "Washington Wizards"
  }
]
```

**Effort:** 0.5 hours (manual entry)

---

## File 11: `package.json` (Update)

**Purpose:** Add npm scripts for architect pipeline

**Add these scripts:**
```json
{
  "scripts": {
    "architect:scrape-players": "PLAYERS_FILE=player-scrape/all_nba_players.json OUTPUT_DIR=player-scrape/output npx tsx player-scrape/batch_scrape_players.ts",
    "architect:scrape-teams": "TEAMS_FILE=team-scrape/all_nba_teams.json OUTPUT_DIR=team-scrape/output npx tsx team-scrape/batch_scrape_teams.ts",
    "architect:upload-players": "node scripts/architect-upload/upload_players.js",
    "architect:upload-teams": "node scripts/architect-upload/upload_teams.js",
    "architect:validate": "node scripts/architect-upload/validate.js",
    "architect:pipeline": "node scripts/architect-upload/orchestrate.js"
  }
}
```

**Effort:** 0.5 hours

---

## Quick Start Commands

Once all files are created:

```bash
# Step 1: Generate player/team lists
node scripts/architect-upload/generate_player_list.js
# (Creates player-scrape/all_nba_players.json)

# Step 2: Run complete pipeline
npm run architect:pipeline

# Or run steps individually:
npm run architect:scrape-players
npm run architect:scrape-teams  
npm run architect:upload-players
npm run architect:upload-teams
npm run architect:validate
```

---

## Summary

**11 Files to Create:**
1. ✅ `upload_players.js` (2-3 hours)
2. ✅ `upload_teams.js` (2-3 hours)
3. ✅ `transform_player.js` (1-2 hours)
4. ✅ `transform_team.js` (1-2 hours)
5. ✅ `resolve_player_id.js` (1-2 hours)
6. ✅ `orchestrate.js` (1-2 hours)
7. ✅ `validate.js` (1-2 hours)
8. ✅ `batch_scrape_teams.ts` (1-2 hours)
9. ✅ `all_nba_players.json` (1-2 hours)
10. ✅ `all_nba_teams.json` (0.5 hours)
11. ✅ `package.json` updates (0.5 hours)

**Total Effort:** 14-21 hours (2-3 working days)

**Result:** Complete pipeline from scraping to Firestore upload, ready for Architect integration.
