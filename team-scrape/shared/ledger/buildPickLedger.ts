#!/usr/bin/env tsx
/**
 * buildPickLedger.ts
 *
 * League-wide pick ledger that:
 * 1) Aggregates all 30-team RealGM outputs
 * 2) Deduplicates picks into a canonical ledger
 * 3) Derives per-team views (inventory / obligations / contested)
 * 4) Outputs artifacts for staging
 *
 * Ledger Key Strategy:
 * - Normal picks: `${year}_${round}_${originalTeam}`
 * - Swaps/contested: `${year}_${round}_${originalTeam}_${swapType || 'swap'}_${swapWith || recipient}`
 *
 * Usage:
 *   npx tsx team-scrape/shared/ledger/buildPickLedger.ts
 */

import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Matches the CanonicalPick type from realgm_draft_picks.ts
 * Canonical owner field: `owner` (not `currentOwner`)
 */
export type CanonicalPick = {
  id: string;
  year: number;
  round: 1 | 2;
  status: 'own' | 'outgoing' | 'incoming' | 'contested' | 'conditional';
  originalTeam: string;
  owner: string; // Canonical owner field
  stepienEligible: boolean;
  tradeable: boolean;
  protection?: string | null;
  isSwap: boolean;
  via?: string;
  recipient?: string;
  pickNumber?: number | null;
  detailUrl?: string;
  title?: string;
  notes?: string;
  contendingTeams?: string[];
  tradedOn?: string;
  route?: string[];
  conveyanceObligation?: unknown;
  swapDetails?: {
    swapType?: 'bilateral' | 'multiway' | 'favorable' | 'unknown';
    swapWith?: string[];
    favorable?: 'most' | 'least' | null;
  };
  dependsOn?: string[];
  swapId?: string; // For swap rights: ${baseId}_swap_${counterparty}
  obligationId?: string; // For outgoing/conditional: ${baseId}_obligation_${recipient}
  // Relation tag for by_team views (derived at view generation time)
  relation?: 'inventory' | 'obligation' | 'contested';
};

/**
 * Extended pick with ledger metadata
 */
export type LedgerRecord = CanonicalPick & {
  ledgerId: string;
  sourceTeamFiles: string[];
  confidence: 'high' | 'medium' | 'low';
};

/**
 * Per-team derived views
 */
export type TeamPickViews = {
  teamCode: string;
  inventory: CanonicalPick[];
  obligations: CanonicalPick[];
  contested: CanonicalPick[];
};

// ============================================================================
// CONFIGURATION
// ============================================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.join(__dirname, '..', '..', '..');

// Input directory types: 'mentions' (default, all picks from each team page) or 'structured' (owned-only)
type InputType = 'mentions' | 'structured';

const DRAFT_PICKS_BASE_DIR = path.join(
  PROJECT_ROOT,
  'team-scrape',
  'draft-picks',
  '_artifacts',
  'output'
);

// Default to 'mentions' to include all picks (including outgoing)
const DEFAULT_INPUT_TYPE: InputType = 'mentions';

function getInputDir(inputType: InputType): string {
  return path.join(DRAFT_PICKS_BASE_DIR, inputType);
}

const DEFAULT_OUTPUT_DIR = path.join(
  PROJECT_ROOT,
  'team-scrape',
  'shared',
  'firestore_staging',
  '_artifacts',
  'output',
  'ledger'
);

// All 30 NBA team codes
const ALL_TEAM_CODES = [
  'ATL', 'BOS', 'BKN', 'CHA', 'CHI', 'CLE', 'DAL', 'DEN', 'DET', 'GSW',
  'HOU', 'IND', 'LAC', 'LAL', 'MEM', 'MIA', 'MIL', 'MIN', 'NOP', 'NYK',
  'OKC', 'ORL', 'PHI', 'PHX', 'POR', 'SAC', 'SAS', 'TOR', 'UTA', 'WAS',
];

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function parseArg(label: string, def?: string): string | undefined {
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === `--${label}`) {
      const next = argv[i + 1];
      if (!next || next.startsWith('--')) return 'true';
      return next;
    }
    if (arg.startsWith(`--${label}=`)) {
      const [, val] = arg.split('=');
      return val ?? 'true';
    }
  }
  return def;
}

async function ensureDir(dirPath: string): Promise<void> {
  await mkdir(dirPath, { recursive: true });
}

async function loadJson<T>(filePath: string): Promise<T | null> {
  try {
    const content = await readFile(filePath, 'utf8');
    return JSON.parse(content) as T;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    throw err;
  }
}

function serialize(obj: unknown, pretty = true): string {
  return pretty ? JSON.stringify(obj, null, 2) : JSON.stringify(obj);
}

// ============================================================================
// LEDGER KEY GENERATION
// ============================================================================

/**
 * Generates a stable, unique ledger key for a pick.
 *
 * Strategy:
 * - Normal picks: `${year}_${round}_${originalTeam}`
 * - Swaps: `${year}_${round}_${originalTeam}_swap_${swapWith || 'unknown'}`
 * - Contested: `${year}_${round}_${originalTeam}_contested_${recipient || 'unknown'}`
 */
export function generateLedgerId(pick: CanonicalPick): string {
  const base = `${pick.year}_${pick.round}_${pick.originalTeam}`;

  // Handle swaps
  if (pick.isSwap) {
    const swapPartner = pick.swapDetails?.swapWith?.[0] || pick.recipient || 'unknown';
    const swapType = pick.swapDetails?.swapType || 'swap';
    return `${base}_${swapType}_${swapPartner}`;
  }

  // Handle contested picks
  if (pick.status === 'contested') {
    const contestedWith = pick.recipient || pick.contendingTeams?.[0] || 'unknown';
    return `${base}_contested_${contestedWith}`;
  }

  // Handle conditional picks
  if (pick.status === 'conditional') {
    const conditionalTo = pick.recipient || 'unknown';
    return `${base}_conditional_${conditionalTo}`;
  }

  // Normal picks
  return base;
}

// ============================================================================
// PICK LOADING & NORMALIZATION
// ============================================================================

/**
 * Raw pick shape from mentions JSON (may have currentOwner instead of owner)
 */
type RawPick = Omit<CanonicalPick, 'owner'> & {
  owner?: string;
  currentOwner?: string;
};

/**
 * Normalizes incoming picks from mentions JSON to canonical format.
 * - Maps `currentOwner` → `owner` if owner is missing
 * - Removes non-canonical `currentOwner` field from output
 */
function normalizeIncomingPick(raw: RawPick): CanonicalPick {
  // Use owner if present, else fall back to currentOwner
  const owner = raw.owner ?? raw.currentOwner ?? '';
  
  // Destructure to remove currentOwner from output
  const { currentOwner: _drop, ...rest } = raw;
  
  return { ...rest, owner } as CanonicalPick;
}

/**
 * Loads all per-team draft pick files from the output directory.
 * Supports both 'mentions' (all picks) and 'structured' (owned-only) file patterns.
 * Normalizes currentOwner → owner at load time.
 *
 * File patterns:
 * - mentions: draft_picks_mentions_{TEAM}.json
 * - structured: draft_picks_{TEAM}.json
 */
export async function loadAllTeamPicks(
  inputDir: string,
  inputType: InputType = 'mentions'
): Promise<Map<string, CanonicalPick[]>> {
  const picksByTeam = new Map<string, CanonicalPick[]>();

  // Try to read directory
  let files: string[] = [];
  try {
    files = await readdir(inputDir);
  } catch (err) {
    console.error(`❌ Input directory not found: ${inputDir}`);
    console.error(`   Please run the draft picks scraper first:`);
    console.error(`   npm run team:draft-picks -- --teams LAL,DAL,ATL,NOP`);
    throw new Error(`Input directory not found: ${inputDir}`);
  }

  // File pattern depends on input type
  const filePrefix = inputType === 'mentions' ? 'draft_picks_mentions_' : 'draft_picks_';
  const pickFiles = files.filter(
    (f) => f.startsWith(filePrefix) && f.endsWith('.json')
  );

  if (pickFiles.length === 0) {
    console.error(`❌ No ${inputType} files found in: ${inputDir}`);
    console.error(`   Expected files matching pattern: ${filePrefix}*.json`);
    throw new Error(`No ${inputType} files found in ${inputDir}`);
  }

  for (const file of pickFiles) {
    const teamCode = file.replace(filePrefix, '').replace('.json', '');
    const filePath = path.join(inputDir, file);
    const rawPicks = await loadJson<RawPick[]>(filePath);

    if (rawPicks && Array.isArray(rawPicks)) {
      // Normalize each pick (currentOwner → owner)
      const normalizedPicks = rawPicks.map(normalizeIncomingPick);
      picksByTeam.set(teamCode, normalizedPicks);
      console.log(`  ✓ Loaded ${normalizedPicks.length} picks from ${teamCode}`);
    }
  }

  return picksByTeam;
}

// ============================================================================
// LEDGER BUILDING
// ============================================================================

/**
 * Determines which pick record has richer metadata for deduplication.
 */
function hasRicherMetadata(a: CanonicalPick, b: CanonicalPick): boolean {
  let aScore = 0;
  let bScore = 0;

  // Score based on presence of optional fields
  if (a.protection) aScore += 1;
  if (b.protection) bScore += 1;
  if (a.via) aScore += 1;
  if (b.via) bScore += 1;
  if (a.recipient) aScore += 1;
  if (b.recipient) bScore += 1;
  if (a.route?.length) aScore += a.route.length;
  if (b.route?.length) bScore += b.route.length;
  if (a.conveyanceObligation) aScore += 2;
  if (b.conveyanceObligation) bScore += 2;
  if (a.swapDetails) aScore += 2;
  if (b.swapDetails) bScore += 2;
  if (a.contendingTeams?.length) aScore += a.contendingTeams.length;
  if (b.contendingTeams?.length) bScore += b.contendingTeams.length;
  if (a.notes) aScore += 1;
  if (b.notes) bScore += 1;

  return aScore >= bScore;
}

/**
 * Merges two pick records, preferring the one with richer metadata.
 */
function mergePicks(
  existing: LedgerRecord,
  incoming: CanonicalPick,
  sourceTeam: string
): LedgerRecord {
  // Add source team to tracking
  if (!existing.sourceTeamFiles.includes(sourceTeam)) {
    existing.sourceTeamFiles.push(sourceTeam);
  }

  // If incoming has richer metadata, update the record
  if (!hasRicherMetadata(existing, incoming)) {
    return {
      ...incoming,
      ledgerId: existing.ledgerId,
      sourceTeamFiles: existing.sourceTeamFiles,
      confidence: existing.sourceTeamFiles.length > 1 ? 'high' : 'medium',
    };
  }

  // Update confidence based on number of sources
  existing.confidence = existing.sourceTeamFiles.length > 1 ? 'high' : 'medium';
  return existing;
}

/**
 * Builds a league-wide pick ledger from all team outputs.
 */
export function buildPickLedger(
  picksByTeam: Map<string, CanonicalPick[]>
): LedgerRecord[] {
  const ledger = new Map<string, LedgerRecord>();
  const collisions: Array<{ ledgerId: string; teams: string[] }> = [];

  for (const [teamCode, picks] of picksByTeam) {
    for (const pick of picks) {
      const ledgerId = generateLedgerId(pick);

      if (ledger.has(ledgerId)) {
        // Deduplicate - merge with existing record
        const existing = ledger.get(ledgerId)!;
        ledger.set(ledgerId, mergePicks(existing, pick, teamCode));

        // Track potential collisions for review
        const collision = collisions.find((c) => c.ledgerId === ledgerId);
        if (collision) {
          if (!collision.teams.includes(teamCode)) {
            collision.teams.push(teamCode);
          }
        } else {
          collisions.push({
            ledgerId,
            teams: [...existing.sourceTeamFiles, teamCode],
          });
        }
      } else {
        // New record
        ledger.set(ledgerId, {
          ...pick,
          ledgerId,
          sourceTeamFiles: [teamCode],
          confidence: 'medium',
        });
      }
    }
  }

  // Log collision summary
  if (collisions.length > 0) {
    console.log(`\n📊 Deduplicated ${collisions.length} picks across multiple team files:`);
    for (const c of collisions.slice(0, 5)) {
      console.log(`   - ${c.ledgerId} (seen in: ${c.teams.join(', ')})`);
    }
    if (collisions.length > 5) {
      console.log(`   ... and ${collisions.length - 5} more`);
    }
  }

  return Array.from(ledger.values());
}

// ============================================================================
// PER-TEAM VIEW DERIVATION
// ============================================================================

/**
 * Converts a LedgerRecord back to a CanonicalPick (removes ledger metadata).
 */
function toCanonicalPick(record: LedgerRecord): CanonicalPick {
  const { ledgerId: _ledgerId, sourceTeamFiles: _sourceTeamFiles, confidence: _confidence, ...pick } = record;
  return pick;
}

/**
 * Checks if a pick should be in a team's inventory.
 * Inventory = picks where owner === TEAM
 */
function isInventory(pick: CanonicalPick, teamCode: string): boolean {
  return pick.owner === teamCode;
}

/**
 * Checks if a pick should be in a team's obligations.
 * Obligations = picks where originalTeam === TEAM AND
 *   (status in {outgoing, conditional} OR owner !== TEAM)
 */
function isObligation(pick: CanonicalPick, teamCode: string): boolean {
  if (pick.originalTeam !== teamCode) return false;

  return (
    pick.status === 'outgoing' ||
    pick.status === 'conditional' ||
    pick.owner !== teamCode
  );
}

/**
 * Checks if a pick should be in a team's contested list.
 * Contested = picks where:
 *   - isSwap === true, OR
 *   - status === 'contested', OR
 *   - swapDetails exists, OR
 *   - contendingTeams includes TEAM, OR
 *   - recipient === TEAM, OR
 *   - route contains TEAM
 */
function isContested(pick: CanonicalPick, teamCode: string): boolean {
  // Direct contested status
  if (pick.status === 'contested') return true;

  // Swap involving this team
  if (pick.isSwap) {
    if (pick.originalTeam === teamCode) return true;
    if (pick.owner === teamCode) return true;
    if (pick.swapDetails?.swapWith?.includes(teamCode)) return true;
  }

  // Has swap details
  if (pick.swapDetails) {
    if (pick.originalTeam === teamCode) return true;
    if (pick.swapDetails.swapWith?.includes(teamCode)) return true;
  }

  // Listed in contending teams
  if (pick.contendingTeams?.includes(teamCode)) return true;

  // Is recipient of the pick
  if (pick.recipient === teamCode) return true;

  // Is in the trade route
  if (pick.route?.includes(teamCode)) return true;

  return false;
}

/**
 * Derives per-team views from the master ledger.
 * Each pick is tagged with its `relation` for that team's view.
 */
export function deriveTeamPickViews(
  ledgerRecords: LedgerRecord[]
): Map<string, TeamPickViews> {
  const viewsByTeam = new Map<string, TeamPickViews>();

  // Initialize views for all 30 teams
  for (const teamCode of ALL_TEAM_CODES) {
    viewsByTeam.set(teamCode, {
      teamCode,
      inventory: [],
      obligations: [],
      contested: [],
    });
  }

  // Process each ledger record
  for (const record of ledgerRecords) {
    const pick = toCanonicalPick(record);

    // Check each team
    for (const teamCode of ALL_TEAM_CODES) {
      const views = viewsByTeam.get(teamCode)!;

      // Add to inventory if team owns the pick
      if (isInventory(pick, teamCode)) {
        views.inventory.push({ ...pick, relation: 'inventory' });
      }

      // Add to obligations if team owes the pick
      if (isObligation(pick, teamCode)) {
        views.obligations.push({ ...pick, relation: 'obligation' });
      }

      // Add to contested if team is involved in swap/conditional
      if (isContested(pick, teamCode)) {
        views.contested.push({ ...pick, relation: 'contested' });
      }
    }
  }

  // Sort picks in each view by year, then round
  const sortPicks = (picks: CanonicalPick[]) =>
    picks.sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return a.round - b.round;
    });

  for (const views of viewsByTeam.values()) {
    views.inventory = sortPicks(views.inventory);
    views.obligations = sortPicks(views.obligations);
    views.contested = sortPicks(views.contested);
  }

  return viewsByTeam;
}

// ============================================================================
// OUTPUT WRITING
// ============================================================================

/**
 * Writes the master ledger and per-team views to output directory.
 */
export async function writeLedgerOutputs(
  ledger: LedgerRecord[],
  viewsByTeam: Map<string, TeamPickViews>,
  outputDir: string = DEFAULT_OUTPUT_DIR
): Promise<void> {
  await ensureDir(outputDir);
  await ensureDir(path.join(outputDir, 'by_team'));

  // Write master ledger
  const ledgerPath = path.join(outputDir, 'pick_ledger.json');
  await writeFile(ledgerPath, serialize(ledger), 'utf8');
  console.log(`\n✅ Wrote master ledger: ${ledgerPath}`);
  console.log(`   Total picks in ledger: ${ledger.length}`);

  // Write per-team views
  let totalInventory = 0;
  let totalObligations = 0;
  let totalContested = 0;

  for (const [teamCode, views] of viewsByTeam) {
    const teamPath = path.join(outputDir, 'by_team', `${teamCode}.json`);
    await writeFile(teamPath, serialize(views), 'utf8');

    totalInventory += views.inventory.length;
    totalObligations += views.obligations.length;
    totalContested += views.contested.length;
  }

  console.log(`\n✅ Wrote ${viewsByTeam.size} team view files to ${path.join(outputDir, 'by_team')}`);
  console.log(`   Total inventory picks: ${totalInventory}`);
  console.log(`   Total obligations: ${totalObligations}`);
  console.log(`   Total contested: ${totalContested}`);
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

export async function runLedgerBuilder(options?: {
  inputDir?: string;
  inputType?: InputType;
  outputDir?: string;
}): Promise<{
  ledger: LedgerRecord[];
  viewsByTeam: Map<string, TeamPickViews>;
}> {
  const inputType = options?.inputType ?? DEFAULT_INPUT_TYPE;
  const inputDir = options?.inputDir ?? getInputDir(inputType);
  const outputDir = options?.outputDir ?? DEFAULT_OUTPUT_DIR;

  console.log('\n🔨 Building league-wide draft picks ledger...');
  console.log(`   Input type: ${inputType}`);
  console.log(`   Input: ${inputDir}`);
  console.log(`   Output: ${outputDir}`);

  // Load all team picks
  console.log('\n📂 Loading per-team draft pick files...');
  const picksByTeam = await loadAllTeamPicks(inputDir, inputType);

  if (picksByTeam.size === 0) {
    console.warn('\n⚠️  No team pick files found. Run RealGM scrape first.');
    return { ledger: [], viewsByTeam: new Map() };
  }

  console.log(`   Loaded ${picksByTeam.size} team files`);

  // Build ledger
  console.log('\n🔗 Building canonical ledger...');
  const ledger = buildPickLedger(picksByTeam);
  console.log(`   Created ${ledger.length} unique ledger entries`);

  // Derive per-team views
  console.log('\n📊 Deriving per-team views...');
  const viewsByTeam = deriveTeamPickViews(ledger);

  // Write outputs
  await writeLedgerOutputs(ledger, viewsByTeam, outputDir);

  return { ledger, viewsByTeam };
}

// CLI entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  // Parse --input=mentions|structured flag (default: mentions)
  const inputArg = parseArg('input', 'mentions');
  const inputType: InputType = inputArg === 'structured' ? 'structured' : 'mentions';

  // Allow inputDir override (optional)
  const inputDirOverride = parseArg('inputDir');
  const outputDir = parseArg('outputDir', DEFAULT_OUTPUT_DIR);

  runLedgerBuilder({
    inputDir: inputDirOverride,
    inputType,
    outputDir,
  })
    .then(({ ledger, viewsByTeam }) => {
      console.log('\n✅ Ledger build complete.');

      // Print summary for a few teams
      const sampleTeams = ['ATL', 'LAL', 'DAL', 'OKC'];
      console.log('\n📋 Sample team summaries:');
      for (const code of sampleTeams) {
        const views = viewsByTeam.get(code);
        if (views) {
          console.log(
            `   ${code}: inventory=${views.inventory.length}, obligations=${views.obligations.length}, contested=${views.contested.length}`
          );
        }
      }
    })
    .catch((err) => {
      console.error('❌ Ledger build failed:', err);
      process.exit(1);
    });
}
