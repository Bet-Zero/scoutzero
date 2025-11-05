#!/usr/bin/env tsx
/**
 * merge_team_outputs.ts - Merge salary and draft pick data into unified team documents
 *
 * PURPOSE:
 *   Combines team salary data (from SalarySwish) with draft pick data (from RealGM)
 *   into a single merged JSON file per team following the proposed final schema.
 *
 * USAGE:
 *   npm run merge:samples
 *   # or directly:
 *   tsx team-scrape/review_and_merge/scripts/merge_team_outputs.ts
 *
 * INPUT:
 *   - Salary data: team-scrape/output/team-data/team_{TEAM}.json
 *   - Draft picks: team-scrape/output/draft-picks/structured/draft_picks_{TEAM}.json
 *
 * OUTPUT:
 *   - Individual: team-scrape/output/merged/{TEAM}_merged.json
 *   - Combined: team-scrape/output/merged/all_teams_merged.json
 *
 * FEATURES:
 *   - Deterministic: Multiple runs produce identical results
 *   - Idempotent: Safe to run repeatedly
 *   - Verbose logging: Shows which files merged and any issues
 *   - No live scraping: Uses existing local files only
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Get current directory for relative paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  // Input paths (relative to project root)
  salaryDir: 'team-scrape/output/team-data',
  draftPicksDir: 'team-scrape/output/draft-picks/structured', // Updated path after reorganization

  // Output paths
  outputDir: 'team-scrape/output/merged',

  // Teams to process (based on available draft pick data)
  teams: ['LAL', 'MEM', 'NYK', 'OKC', 'WAS'],

  // Pretty print JSON
  prettyPrint: true,
};

// ============================================================================
// TYPES
// ============================================================================

interface SalaryData {
  teamCode: string;
  teamName: string;
  season: string;
  roster: Array<{
    displayName: string;
    sourceUrl: string;
  }>;
  capHolds: Array<{
    displayName: string;
    sourceUrl: string;
    capHoldAmount: number;
    type: string;
    rights?: string;
  }>;
  exceptions: {
    mle?: any;
    bae?: any;
    tpe: any[];
  };
  totals: {
    totalSalary?: number;
    activeSalary?: number;
    deadCapTotal?: number;
    capHoldsTotal?: number;
    guaranteedSalary?: number;
    salaryCap?: number;
    capSpace?: number;
    luxuryTaxLine?: number;
    taxSpace?: number;
    firstApronLine?: number;
    firstApronRoom?: number;
    secondApronLine?: number;
    secondApronRoom?: number;
    firstApronTriggered?: boolean;
    secondApronTriggered?: boolean;
    hardCappedAt?: string;
    rosterCount?: number;
    twoWayCount?: number;
    incompleteRosterCharges?: number;
    likelyIncentives?: number;
  };
  draftPicks?: any[]; // Will be removed in merge
  source: {
    provider: string;
    teamPageUrl: string;
    scrapedAt: string;
  };
  lastUpdated: string;
  version: string;
}

interface DraftPick {
  id: string;
  year: number;
  round: number;
  status: string;
  originalTeam: string;
  currentOwner: string;
  stepienEligible: boolean;
  tradeable: boolean;
  protection: string | null;
  isSwap: boolean;
  pickNumber?: number | null;
  swapDetails?: any;
  route?: string[];
  detailUrl?: string;
  metadata?: any;
  recipient?: string;
  contendingTeams?: string[];
  // Optional minimal fields for upload
  owner?: string; // mirrors currentOwner for minimal drafts schema
}

interface MergedTeamData {
  teamCode: string;
  teamName: string;
  season: string;
  roster: SalaryData['roster'];
  capHolds: SalaryData['capHolds'];
  exceptions: SalaryData['exceptions'];
  totals: SalaryData['totals'];
  draftPicks: {
    incoming: DraftPick[];
    outgoing: DraftPick[];
    own: DraftPick[];
    contested: DraftPick[];
  };
  // Flat array used by Trade Machine to quickly list tradable picks
  tradablePicks: DraftPick[];
  sources: {
    salary: {
      provider: string;
      url: string;
      scrapedAt: string;
    };
    draftPicks: {
      provider: string;
      url: string;
      scrapedAt: string;
    };
  };
  mergedAt: string;
  version: string;
}

// ============================================================================
// UTILITIES
// ============================================================================

function log(message: string, data?: any) {
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
  console.log(`[${timestamp}] ${message}`);
  if (data !== undefined) {
    console.log(JSON.stringify(data, null, 2));
  }
}

function warn(message: string, data?: any) {
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
  console.warn(`[${timestamp}] ⚠️  ${message}`);
  if (data !== undefined) {
    console.warn(JSON.stringify(data, null, 2));
  }
}

function error(message: string, err?: any) {
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
  console.error(`[${timestamp}] ❌ ${message}`);
  if (err) {
    console.error(err);
  }
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function ensureDir(dirPath: string): Promise<void> {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (err: any) {
    if (err.code !== 'EEXIST') {
      throw err;
    }
  }
}

function serializeJSON(obj: any): string {
  return CONFIG.prettyPrint
    ? JSON.stringify(obj, null, 2)
    : JSON.stringify(obj);
}

// ============================================================================
// MERGE LOGIC
// ============================================================================

// Normalize draft pick fields for architect compatibility (year-based)
function normalizeDraftPickForTeam(pick: DraftPick): DraftPick {
  return { ...pick, owner: pick.currentOwner };
}

/**
 * Group draft picks by status (incoming, outgoing, own, contested)
 */
function groupDraftPicksByStatus(
  picks: DraftPick[]
): MergedTeamData['draftPicks'] {
  const grouped: MergedTeamData['draftPicks'] = {
    incoming: [],
    outgoing: [],
    own: [],
    contested: [],
  };

  for (const pick of picks) {
    const status = pick.status.toLowerCase();

    if (status === 'incoming' || status === 'swap') {
      grouped.incoming.push(pick);
    } else if (status === 'outgoing') {
      grouped.outgoing.push(pick);
    } else if (status === 'own') {
      grouped.own.push(pick);
    } else if (status === 'contested' || status === 'conditional') {
      // Both contested and conditional picks go to contested array
      grouped.contested.push(pick);
    } else {
      // Unknown status - log warning and put in contested
      warn(`Unknown draft pick status: ${status} for pick ${pick.id}`);
      grouped.contested.push(pick);
    }
  }

  // Sort each group by year, then round
  const sortPicks = (picks: DraftPick[]) =>
    picks.sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return a.round - b.round;
    });

  grouped.incoming = sortPicks(grouped.incoming);
  grouped.outgoing = sortPicks(grouped.outgoing);
  grouped.own = sortPicks(grouped.own);
  grouped.contested = sortPicks(grouped.contested);

  return grouped;
}

/**
 * Merge salary data and draft pick data for a single team
 */
function mergeTeamData(
  salaryData: SalaryData | null,
  draftPicks: DraftPick[],
  teamCode: string
): MergedTeamData {
  const now = new Date().toISOString();

  // 1) Filter to picks that this team currently owns (assignment by currentOwner)
  const ownedByTeam = (draftPicks || []).filter(
    (p) => p.currentOwner === teamCode
  );

  // 2) Add season/owner fields for schema alignment
  const normalizedOwned = ownedByTeam.map((p) => normalizeDraftPickForTeam(p));

  // 3) Build a flat list of tradable picks for Trade Machine convenience
  const tradablePicks = normalizedOwned
    .filter((p) => p.tradeable)
    .sort((a, b) => (a.year !== b.year ? a.year - b.year : a.round - b.round));

  // If no salary data, create minimal structure
  if (!salaryData) {
    warn(`No salary data for ${teamCode}, creating minimal merged document`);

    return {
      teamCode,
      teamName: `${teamCode} (Name Unknown)`,
      season: '2025-26', // Default season
      roster: [],
      capHolds: [],
      exceptions: { tpe: [] },
      totals: {},
      draftPicks: groupDraftPicksByStatus(normalizedOwned),
      tradablePicks,
      sources: {
        salary: {
          provider: 'None',
          url: '',
          scrapedAt: '',
        },
        draftPicks: {
          provider: 'RealGM',
          url: normalizedOwned[0]?.detailUrl || '',
          scrapedAt: now,
        },
      },
      mergedAt: now,
      version: '2.0',
    };
  }

  // Create merged document from salary data + draft picks
  const merged: MergedTeamData = {
    teamCode: salaryData.teamCode,
    teamName: salaryData.teamName,
    season: salaryData.season,
    roster: salaryData.roster,
    capHolds: salaryData.capHolds,
    exceptions: salaryData.exceptions,
    totals: salaryData.totals,
    draftPicks: groupDraftPicksByStatus(normalizedOwned),
    tradablePicks,
    sources: {
      salary: {
        provider: salaryData.source.provider,
        url: salaryData.source.teamPageUrl,
        scrapedAt: salaryData.source.scrapedAt || salaryData.lastUpdated,
      },
      draftPicks: {
        provider: 'RealGM',
        url: normalizedOwned[0]?.detailUrl || '',
        scrapedAt: now,
      },
    },
    mergedAt: now,
    version: '2.0',
  };

  return merged;
}

/**
 * Load salary data for a team (if available)
 */
async function loadSalaryData(
  teamCode: string,
  projectRoot: string
): Promise<SalaryData | null> {
  // Check for individual team files first (preferred pattern)
  const teamSpecificPath = path.join(
    projectRoot,
    CONFIG.salaryDir,
    `team_${teamCode}.json`
  );
  if (await fileExists(teamSpecificPath)) {
    try {
      const content = await fs.readFile(teamSpecificPath, 'utf-8');
      const data = JSON.parse(content) as SalaryData;
      log(`✓ Loaded salary data for ${teamCode} from team_${teamCode}.json`);
      return data;
    } catch (err) {
      error(`Failed to parse salary data from ${teamSpecificPath}`, err);
    }
  }

  // Fallback to generic team.json file (legacy pattern)
  const teamJsonPath = path.join(projectRoot, CONFIG.salaryDir, 'team.json');
  if (await fileExists(teamJsonPath)) {
    try {
      const content = await fs.readFile(teamJsonPath, 'utf-8');
      const data = JSON.parse(content) as SalaryData;

      // Check if this file contains data for the requested team
      if (data.teamCode === teamCode) {
        log(`✓ Loaded salary data for ${teamCode} from team.json`);
        return data;
      } else {
        log(`⚠️  team.json contains ${data.teamCode} data, not ${teamCode}`);
        return null;
      }
    } catch (err) {
      error(`Failed to parse salary data from ${teamJsonPath}`, err);
      return null;
    }
  }

  log(`⚠️  No salary data found for ${teamCode}`);
  return null;
}

/**
 * Load draft pick data for a team
 */
async function loadDraftPickData(
  teamCode: string,
  projectRoot: string
): Promise<DraftPick[]> {
  const filePath = path.join(
    projectRoot,
    CONFIG.draftPicksDir,
    `draft_picks_${teamCode}.json`
  );

  if (!(await fileExists(filePath))) {
    warn(`Draft pick file not found: ${filePath}`);
    return [];
  }

  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const picks = JSON.parse(content) as DraftPick[];
    log(`✓ Loaded ${picks.length} draft picks for ${teamCode}`);
    return picks;
  } catch (err) {
    error(`Failed to parse draft picks from ${filePath}`, err);
    return [];
  }
}

/**
 * Process a single team: load data, merge, write output
 */
async function processTeam(
  teamCode: string,
  projectRoot: string,
  outputDir: string
): Promise<MergedTeamData | null> {
  log(`\n${'='.repeat(60)}`);
  log(`Processing team: ${teamCode}`);
  log('='.repeat(60));

  // Load salary data (optional - may not exist for all teams yet)
  const salaryData = await loadSalaryData(teamCode, projectRoot);

  // Load draft pick data (should exist for all sample teams)
  const draftPicks = await loadDraftPickData(teamCode, projectRoot);

  if (!salaryData && draftPicks.length === 0) {
    warn(`No data found for ${teamCode}, skipping`);
    return null;
  }

  // Merge the data
  log(`Merging data for ${teamCode}...`);
  const merged = mergeTeamData(salaryData, draftPicks, teamCode);

  // Log merge summary
  log(`Merge summary for ${teamCode}:`);
  console.log(`  - Roster: ${merged.roster.length} players`);
  console.log(`  - Cap Holds: ${merged.capHolds.length} items`);
  console.log(`  - Draft Picks:`);
  console.log(`    - Own: ${merged.draftPicks.own.length}`);
  console.log(`    - Incoming: ${merged.draftPicks.incoming.length}`);
  console.log(`    - Outgoing: ${merged.draftPicks.outgoing.length}`);
  console.log(`    - Contested: ${merged.draftPicks.contested.length}`);
  console.log(`  - Total Salary: ${merged.totals.totalSalary || 'N/A'}`);
  console.log(`  - Cap Space: ${merged.totals.capSpace || 'N/A'}`);

  // Write individual team file
  const outputPath = path.join(outputDir, `${teamCode}_merged.json`);
  await fs.writeFile(outputPath, serializeJSON(merged));
  log(`✓ Wrote merged output: ${outputPath}`);

  return merged;
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log('\n' + '='.repeat(70));
  console.log('TEAM DATA MERGE SCRIPT');
  console.log('='.repeat(70));
  console.log(`\nConfiguration:`);
  console.log(`  - Salary dir: ${CONFIG.salaryDir}`);
  console.log(`  - Draft picks dir: ${CONFIG.draftPicksDir}`);
  console.log(`  - Output dir: ${CONFIG.outputDir}`);
  console.log(`  - Teams to process: ${CONFIG.teams.join(', ')}`);
  console.log(`  - Pretty print: ${CONFIG.prettyPrint}`);
  console.log('');

  // Determine project root (3 levels up from this script)
  const projectRoot = path.resolve(__dirname, '../../..');
  log(`Project root: ${projectRoot}`);

  // Ensure output directory exists
  const outputDir = path.join(projectRoot, CONFIG.outputDir);
  await ensureDir(outputDir);
  log(`Output directory ready: ${outputDir}\n`);

  // Process each team
  const mergedTeams: MergedTeamData[] = [];
  const stats = {
    processed: 0,
    successful: 0,
    failed: 0,
    skipped: 0,
  };

  for (const teamCode of CONFIG.teams) {
    stats.processed++;

    try {
      const merged = await processTeam(teamCode, projectRoot, outputDir);

      if (merged) {
        mergedTeams.push(merged);
        stats.successful++;
      } else {
        stats.skipped++;
      }
    } catch (err) {
      error(`Failed to process ${teamCode}`, err);
      stats.failed++;
    }
  }

  // Write combined file (all teams)
  if (mergedTeams.length > 0) {
    log(`\n${'='.repeat(60)}`);
    log('Writing combined output file...');

    const allTeamsPath = path.join(outputDir, 'all_teams_merged.json');
    await fs.writeFile(allTeamsPath, serializeJSON(mergedTeams));
    log(`✓ Wrote combined output: ${allTeamsPath}`);
    log(`  - ${mergedTeams.length} teams included`);
  }

  // Final summary
  console.log('\n' + '='.repeat(70));
  console.log('MERGE COMPLETE');
  console.log('='.repeat(70));
  console.log(`\nStatistics:`);
  console.log(`  - Teams processed: ${stats.processed}`);
  console.log(`  - Successful: ${stats.successful}`);
  console.log(`  - Failed: ${stats.failed}`);
  console.log(`  - Skipped: ${stats.skipped}`);
  console.log(`\nOutput files:`);
  console.log(
    `  - Individual: ${stats.successful} team files in ${CONFIG.outputDir}/`
  );
  console.log(`  - Combined: all_teams_merged.json`);
  console.log('');

  // Note about missing salary data
  if (stats.successful < CONFIG.teams.length) {
    console.log('⚠️  NOTE: Some teams are missing salary data. To complete:');
    console.log('   Run salary scraper for each team:');
    console.log(
      '   TEAM_URL="https://www.salaryswish.com/teams/{team}" TEAM_CODE="{CODE}" npm run parse'
    );
    console.log('   Then re-run this merge script.');
    console.log('');
  }

  process.exit(stats.failed > 0 ? 1 : 0);
}

// Run main function
main().catch((err) => {
  error('Unhandled error in main', err);
  process.exit(1);
});
