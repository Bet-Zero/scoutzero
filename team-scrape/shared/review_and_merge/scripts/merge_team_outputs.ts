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
 *   tsx team-scrape/shared/review_and_merge/scripts/merge_team_outputs.ts
 *
 * INPUT:
 *   - Salary data: team-scrape/team-data/output/team_{TEAM}.json
 *   - Draft picks: team-scrape/draft-picks/output/structured/draft_picks_{TEAM}.json
 *
 * OUTPUT:
 *   - Individual: team-scrape/shared/firestore_staging/output/merged/{TEAM}_merged.json
 *   - Combined: team-scrape/shared/firestore_staging/output/merged/all_teams_merged.json
 *
 * FEATURES:
 *   - Deterministic: Multiple runs produce identical results
 *   - Idempotent: Safe to run repeatedly
 *   - Verbose logging: Shows which files merged and any issues
 *   - No live scraping: Uses existing local files only
 */

import fs from 'node:fs/promises';
import { createWriteStream, type WriteStream } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Get current directory for relative paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// CONFIGURATION
// ============================================================================

const DEFAULT_CONFIG = {
  // Input paths (relative to project root)
  salaryDir: 'team-scrape/team-data/output',
  draftPicksDir: 'team-scrape/draft-picks/output/structured',

  // Output paths
  outputDir: 'team-scrape/shared/firestore_staging/output/merged',

  // Teams to process (based on available draft pick data)
  teams: ['LAL', 'MEM', 'NYK', 'OKC', 'WAS'],

  // Pretty print JSON
  prettyPrint: true,
};

type RuntimeConfig = typeof DEFAULT_CONFIG & {
  teams: string[];
  logFile?: string;
  prettyPrint: boolean;
};

function parseArg(name: string): string | undefined {
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === `--${name}`) {
      const next = args[i + 1];
      if (!next || next.startsWith('--')) return 'true';
      return next;
    }
    if (arg.startsWith(`--${name}=`)) {
      const [, val] = arg.split('=');
      return val ?? 'true';
    }
  }
  return undefined;
}

function parseListArg(name: string): string[] | undefined {
  const raw = parseArg(name);
  if (!raw) return undefined;
  return raw
    .split(',')
    .map((code) => code.trim().toUpperCase())
    .filter(Boolean);
}

function parseBoolArg(name: string, def: boolean): boolean {
  const raw = parseArg(name);
  if (raw == null) return def;
  if (raw === 'true' || raw === '1' || raw === '') return true;
  if (raw === 'false' || raw === '0') return false;
  return def;
}

let logWriter: WriteStream | null = null;

async function initLogWriter(filePath?: string) {
  if (!filePath) return;
  await ensureDir(path.dirname(filePath));
  logWriter = createWriteStream(filePath, { flags: 'a' });
  logWriter.write(`\n=== Merge run started ${new Date().toISOString()} ===\n`);
}

async function closeLogWriter() {
  if (!logWriter) return;
  await new Promise<void>((resolve) => {
    logWriter!.end(() => resolve());
  });
  logWriter = null;
}

function writeLogLine(message: string) {
  if (logWriter) {
    logWriter.write(`${message}\n`);
  }
}

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
  deadCap?: Array<{
    displayName: string;
    sourceUrl?: string;
    playerId?: string;
    reason?: string;
    amountByYear: Array<{
      season: string;
      amount: number;
      isStretched?: boolean;
    }>;
  }>;
  exceptions: {
    mle?: any;
    bae?: any;
    tpe: any[];
  };
  totals: {
    totalSalary?: number;
    capHit?: number;
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
    hardCapLevel?: 'none' | 'firstApron' | 'secondApron';
    hardCapDetail?: string;
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
  owner: string; // Canonical owner field
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
}

interface MergedTeamData {
  teamCode: string;
  teamName: string;
  season: string;
  roster: SalaryData['roster'];
  capHolds: SalaryData['capHolds'];
  deadCap: SalaryData['deadCap'];
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
  const line = `[${timestamp}] ${message}`;
  console.log(line);
  writeLogLine(line);
  if (data !== undefined) {
    console.log(JSON.stringify(data, null, 2));
    writeLogLine(JSON.stringify(data, null, 2));
  }
}

function warn(message: string, data?: any) {
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
  const line = `[${timestamp}] ⚠️  ${message}`;
  console.warn(line);
  writeLogLine(line);
  if (data !== undefined) {
    console.warn(JSON.stringify(data, null, 2));
    writeLogLine(JSON.stringify(data, null, 2));
  }
}

function error(message: string, err?: any) {
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
  const line = `[${timestamp}] ❌ ${message}`;
  console.error(line);
  writeLogLine(line);
  if (err) {
    console.error(err);
    writeLogLine(String(err));
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

function serializeJSON(obj: any, pretty: boolean): string {
  return pretty ? JSON.stringify(obj, null, 2) : JSON.stringify(obj);
}

// ============================================================================
// MERGE LOGIC
// ============================================================================

// Normalize draft pick fields for architect compatibility (no changes needed with canonical owner field)
function normalizeDraftPickForTeam(pick: DraftPick): DraftPick {
  return { ...pick };
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

  // 1) Filter to picks that this team currently owns (using canonical owner field)
  const ownedByTeam = (draftPicks || []).filter(
    (p) => p.owner === teamCode
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
      deadCap: [],
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
    deadCap: salaryData.deadCap ?? [],
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
  projectRoot: string,
  config: RuntimeConfig
): Promise<SalaryData | null> {
  // Check for individual team files first (preferred pattern)
  const teamSpecificPath = path.join(
    projectRoot,
    config.salaryDir,
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
  const teamJsonPath = path.join(projectRoot, config.salaryDir, 'team.json');
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
  projectRoot: string,
  config: RuntimeConfig
): Promise<DraftPick[]> {
  const filePath = path.join(
    projectRoot,
    config.draftPicksDir,
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
  outputDir: string,
  config: RuntimeConfig
): Promise<MergedTeamData | null> {
  log(`\n${'='.repeat(60)}`);
  log(`Processing team: ${teamCode}`);
  log('='.repeat(60));

  // Load salary data (optional - may not exist for all teams yet)
  const salaryData = await loadSalaryData(teamCode, projectRoot, config);

  // Load draft pick data (should exist for all sample teams)
  const draftPicks = await loadDraftPickData(teamCode, projectRoot, config);

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
  console.log(`  - Dead Cap: ${merged.deadCap?.length ?? 0} items`);
  console.log(`  - Draft Picks:`);
  console.log(`    - Own: ${merged.draftPicks.own.length}`);
  console.log(`    - Incoming: ${merged.draftPicks.incoming.length}`);
  console.log(`    - Outgoing: ${merged.draftPicks.outgoing.length}`);
  console.log(`    - Contested: ${merged.draftPicks.contested.length}`);
  console.log(`  - Total Salary: ${merged.totals.totalSalary || 'N/A'}`);
  console.log(`  - Cap Space: ${merged.totals.capSpace || 'N/A'}`);

  // Write individual team file
  const outputPath = path.join(outputDir, `${teamCode}_merged.json`);
  await fs.writeFile(outputPath, serializeJSON(merged, config.prettyPrint));
  log(`✓ Wrote merged output: ${outputPath}`);

  return merged;
}

async function discoverTeams(
  projectRoot: string,
  salaryDir: string,
  draftDir: string
): Promise<string[]> {
  const teams = new Set<string>();

  const salaryPath = path.join(projectRoot, salaryDir);
  try {
    const salaryEntries = await fs.readdir(salaryPath);
    for (const entry of salaryEntries) {
      const match = entry.match(/^team_([A-Z]{3})\.json$/);
      if (match) teams.add(match[1]);
    }
  } catch {
    warn(`Salary directory not found or unreadable: ${salaryPath}`);
  }

  const draftPath = path.join(projectRoot, draftDir);
  try {
    const draftEntries = await fs.readdir(draftPath);
    for (const entry of draftEntries) {
      const match = entry.match(/^draft_picks_([A-Z]{3})\.json$/);
      if (match) teams.add(match[1]);
    }
  } catch {
    warn(`Draft picks directory not found or unreadable: ${draftPath}`);
  }

  return Array.from(teams).sort();
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log('\n' + '='.repeat(70));
  console.log('TEAM DATA MERGE SCRIPT');
  console.log('='.repeat(70));

  // Determine project root (3 levels up from this script)
  const projectRoot = path.resolve(__dirname, '../../../..');
  log(`Project root: ${projectRoot}`);

  const runtimeConfig: RuntimeConfig = {
    ...DEFAULT_CONFIG,
    salaryDir: parseArg('salaryDir') ?? DEFAULT_CONFIG.salaryDir,
    draftPicksDir: parseArg('draftDir') ?? DEFAULT_CONFIG.draftPicksDir,
    outputDir: parseArg('outputDir') ?? DEFAULT_CONFIG.outputDir,
    prettyPrint: parseBoolArg('pretty', DEFAULT_CONFIG.prettyPrint),
    teams: [],
    logFile: undefined,
  };

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const logDirArg = parseArg('logDir');
  const logFileArg = parseArg('logFile');
  const resolvedLogDir = path.resolve(
    projectRoot,
    logDirArg ?? 'team-scrape/logs'
  );
  const logFilePath = logFileArg
    ? path.resolve(projectRoot, logFileArg)
    : path.join(resolvedLogDir, `merge-${timestamp}.log`);
  runtimeConfig.logFile = logFilePath;
  await initLogWriter(runtimeConfig.logFile);

  const teamOverride = parseListArg('teams');
  if (teamOverride && teamOverride.length > 0) {
    runtimeConfig.teams = teamOverride;
  } else {
    runtimeConfig.teams = await discoverTeams(
      projectRoot,
      runtimeConfig.salaryDir,
      runtimeConfig.draftPicksDir
    );
  }

  if (!runtimeConfig.teams.length) {
    error(
      'No teams detected. Provide scraped salary/draft outputs or pass --teams.'
    );
    await closeLogWriter();
    process.exit(1);
  }

  console.log(`\nConfiguration:`);
  console.log(`  - Salary dir: ${runtimeConfig.salaryDir}`);
  console.log(`  - Draft picks dir: ${runtimeConfig.draftPicksDir}`);
  console.log(`  - Output dir: ${runtimeConfig.outputDir}`);
  console.log(`  - Log file: ${runtimeConfig.logFile}`);
  console.log(`  - Teams to process: ${runtimeConfig.teams.join(', ')}`);
  console.log(`  - Pretty print: ${runtimeConfig.prettyPrint}`);
  console.log('');

  // Ensure output directory exists
  const outputDir = path.join(projectRoot, runtimeConfig.outputDir);
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

  for (const teamCode of runtimeConfig.teams) {
    stats.processed++;

    try {
      const merged = await processTeam(
        teamCode,
        projectRoot,
        outputDir,
        runtimeConfig
      );

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
    await fs.writeFile(
      allTeamsPath,
      serializeJSON(mergedTeams, runtimeConfig.prettyPrint)
    );
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
    `  - Individual: ${stats.successful} team files in ${runtimeConfig.outputDir}/`
  );
  console.log(`  - Combined: all_teams_merged.json`);
  console.log('');

  // Note about missing salary data
  if (stats.successful < runtimeConfig.teams.length) {
    console.log('⚠️  NOTE: Some teams are missing salary data. To complete:');
    console.log('   Run salary scraper for each team:');
    console.log(
      '   TEAM_URL="https://www.salaryswish.com/teams/{team}" TEAM_CODE="{CODE}" npm run parse'
    );
    console.log('   Then re-run this merge script.');
    console.log('');
  }

  await closeLogWriter();

  process.exit(stats.failed > 0 ? 1 : 0);
}

// Run main function
main().catch(async (err) => {
  error('Unhandled error in main', err);
  await closeLogWriter();
  process.exit(1);
});
