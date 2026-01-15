#!/usr/bin/env tsx
/**
 * buildDraftAssets.ts
 *
 * Derives canonical draftAssets from ledger views (inventory/obligations/contested).
 * This creates the Trade Machine-ready format that represents tradeable draft assets.
 *
 * Asset Types:
 * - outright_pick: Team owns the pick unconditionally
 * - conditional_right: Team has rights to receive pick depending on conditions/protections
 * - swap_right: Team can exercise swap rights
 *
 * Usage:
 *   npx tsx team-scrape/shared/ledger/buildDraftAssets.ts
 *   npx tsx team-scrape/shared/ledger/buildDraftAssets.ts --ledgerDir=<path> --outDir=<path>
 */

import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Input pick from ledger views
 */
type LedgerPick = {
  id: string;
  year: number;
  round: 1 | 2;
  status: 'own' | 'outgoing' | 'incoming' | 'contested' | 'conditional';
  originalTeam: string;
  owner: string;
  stepienEligible?: boolean;
  tradeable?: boolean;
  protection?: string | null;
  isSwap?: boolean;
  via?: string;
  recipient?: string;
  pickNumber?: number | null;
  notes?: string;
  contendingTeams?: string[];
  route?: string[];
  swapDetails?: {
    swapType?: 'bilateral' | 'multiway' | 'favorable' | 'unknown';
    swapWith?: string[];
    favorable?: 'most' | 'least' | null;
    controller?: string;
    poolTeams?: string[];
    allocation?: {
      topN?: number;
      topNTo?: string;
      remainderTo?: string;
    };
  };
  conveyanceObligation?: unknown;
  metadata?: {
    realgmRawText?: string;
    realgmTeamPage?: string;
  };
  relation?: 'inventory' | 'obligation' | 'contested';
};

/**
 * Ledger team views structure
 */
type LedgerTeamViews = {
  teamCode: string;
  inventory: LedgerPick[];
  obligations: LedgerPick[];
  contested: LedgerPick[];
};

/**
 * Draft asset type
 */
type AssetType = 'outright_pick' | 'conditional_right' | 'swap_right';

/**
 * Certainty level
 */
type Certainty = 'certain' | 'conditional';

/**
 * Canonical draft asset for Trade Machine
 */
export type DraftAsset = {
  assetId: string;
  pickId: string;
  year: number;
  round: number;
  team: string;
  originalTeam: string;
  assetType: AssetType;
  certainty: Certainty;
  protection?: string | null;
  conditionsText?: string;
  isSwap?: boolean;
  swapDetails?: LedgerPick['swapDetails'];
  source: {
    srcTeamPage?: string;
    rawText?: string;
    obligationId?: string;
  };
  tradeableNow: boolean;
  // Preserve useful fields from ledger pick
  via?: string;
  notes?: string;
};

/**
 * Per-team draft assets output
 */
export type TeamDraftAssets = {
  teamCode: string;
  generatedAt: string;
  picks: DraftAsset[];
};

// ============================================================================
// CONFIGURATION
// ============================================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.join(__dirname, '..', '..', '..');

const DEFAULT_LEDGER_DIR = path.join(
  PROJECT_ROOT,
  'team-scrape',
  'shared',
  'firestore_staging',
  '_artifacts',
  'output',
  'ledger',
  'by_team'
);

const DEFAULT_OUTPUT_DIR = path.join(
  PROJECT_ROOT,
  'team-scrape',
  'shared',
  'firestore_staging',
  '_artifacts',
  'output',
  'draft_assets'
);

// All 30 NBA team codes
const ALL_TEAM_CODES = [
  'ATL', 'BOS', 'BKN', 'CHA', 'CHI', 'CLE', 'DAL', 'DEN', 'DET', 'GSW',
  'HOU', 'IND', 'LAC', 'LAL', 'MEM', 'MIA', 'MIL', 'MIN', 'NOP', 'NYK',
  'OKC', 'ORL', 'PHI', 'PHX', 'POR', 'SAC', 'SAS', 'TOR', 'UTA', 'WAS',
];

// Team code normalization map (legacy/alternate -> canonical)
const TEAM_CODE_NORMALIZATION: Record<string, string> = {
  'UTH': 'UTA',
  'PHO': 'PHX',
  'BRK': 'BKN',
  'SAN': 'SAS',
  'GOS': 'GSW',
};

/**
 * Normalizes a team code to canonical form
 */
function normalizeTeamCode(code: string): string {
  return TEAM_CODE_NORMALIZATION[code] ?? code;
}

/**
 * Extracts the beneficiary team from a conditional/protected pick.
 * This is the team that will RECEIVE the pick if conditions are met.
 *
 * Priority order:
 * 1. Explicit recipient field (if it's a valid team code)
 * 2. obligationId suffix (e.g., LAL_2027_1st_obligation_UTA -> UTA)
 * 3. conveyanceObligation.conditions.ifConveys text (e.g., "picks 5-30 to Utah" -> UTA)
 *
 * Returns null if beneficiary cannot be determined.
 */
function extractBeneficiaryTeam(pick: LedgerPick): string | null {
  // 1. Check explicit recipient field
  if (pick.recipient) {
    const normalized = normalizeTeamCode(pick.recipient.toUpperCase());
    if (ALL_TEAM_CODES.includes(normalized)) {
      return normalized;
    }
  }

  // 2. Check obligationId suffix pattern: *_obligation_XXX or *_XXX
  const obligationId = (pick as any).obligationId as string | undefined;
  if (obligationId) {
    // Pattern: PICK_obligation_TEAM (e.g., LAL_2027_1st_obligation_UTA)
    const obligationMatch = obligationId.match(/_obligation_([A-Z]{3})$/i);
    if (obligationMatch) {
      const normalized = normalizeTeamCode(obligationMatch[1].toUpperCase());
      if (ALL_TEAM_CODES.includes(normalized)) {
        return normalized;
      }
    }
  }

  // 3. Check conveyanceObligation.conditions.ifConveys text
  const conveyance = pick.conveyanceObligation as any;
  if (conveyance?.conditions?.ifConveys) {
    const ifConveysText = conveyance.conditions.ifConveys as string;
    // Pattern: "to TEAM" or "picks X-Y to TEAM"
    const toTeamMatch = ifConveysText.match(/to\s+([A-Z]{3})\b/i);
    if (toTeamMatch) {
      const normalized = normalizeTeamCode(toTeamMatch[1].toUpperCase());
      if (ALL_TEAM_CODES.includes(normalized)) {
        return normalized;
      }
    }

    // Also check for full team names like "Utah" -> UTA
    const teamNamePatterns: [RegExp, string][] = [
      [/\bUtah\b/i, 'UTA'],
      [/\bPhoenix\b/i, 'PHX'],
      [/\bBrooklyn\b/i, 'BKN'],
      [/\bDallas\b/i, 'DAL'],
      [/\bLakers?\b/i, 'LAL'],
      [/\bClippers?\b/i, 'LAC'],
    ];

    for (const [pattern, teamCode] of teamNamePatterns) {
      if (pattern.test(ifConveysText)) {
        return teamCode;
      }
    }
  }

  // 4. Check conveyanceObligation.description for beneficiary
  if (conveyance?.description) {
    const desc = conveyance.description as string;
    // Pattern: "protected to TEAM" or "to TEAM"
    const toTeamMatch = desc.match(/(?:protected\s+)?to\s+([A-Za-z]+)/i);
    if (toTeamMatch) {
      const teamNamePatterns: [RegExp, string][] = [
        [/^Utah$/i, 'UTA'],
        [/^Phoenix$/i, 'PHX'],
        [/^Brooklyn$/i, 'BKN'],
        [/^Dallas$/i, 'DAL'],
        [/^LAL$/i, 'LAL'],
        [/^UTA$/i, 'UTA'],
        [/^UTH$/i, 'UTA'],
        [/^DAL$/i, 'DAL'],
      ];

      const match = toTeamMatch[1];
      for (const [pattern, teamCode] of teamNamePatterns) {
        if (pattern.test(match)) {
          return teamCode;
        }
      }

      // If it's a 3-letter code, try normalizing
      if (match.length === 3) {
        const normalized = normalizeTeamCode(match.toUpperCase());
        if (ALL_TEAM_CODES.includes(normalized)) {
          return normalized;
        }
      }
    }
  }

  return null;
}

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
// ASSET CLASSIFICATION LOGIC
// ============================================================================

/**
 * Determines asset type for a pick based on its properties
 */
function classifyAssetType(pick: LedgerPick, teamCode: string): AssetType | null {
  // Swap rights
  if (pick.isSwap || pick.swapDetails) {
    // Team must be involved in the swap
    if (
      pick.owner === teamCode ||
      pick.originalTeam === teamCode ||
      pick.swapDetails?.swapWith?.includes(teamCode) ||
      pick.swapDetails?.controller === teamCode
    ) {
      return 'swap_right';
    }
    return null;
  }

  // Conditional rights (protected picks, conditional status)
  if (
    pick.status === 'conditional' ||
    (pick.protection && pick.protection.trim() !== '')
  ) {
    // For conditional picks, the beneficiary (recipient team) gets the conditional_right
    // NOT the owner (who retains it if protection triggers)
    const beneficiary = extractBeneficiaryTeam(pick);
    
    if (beneficiary) {
      // If this team is the beneficiary, they get the conditional_right asset
      if (beneficiary === teamCode) {
        return 'conditional_right';
      }
      // If this team is the owner but NOT the beneficiary, skip - they retain conditionally
      // but it's not a tradeable asset for them
      return null;
    }
    
    // Fallback: if no explicit beneficiary found but team is recipient, assign conditional_right
    if (pick.recipient === teamCode) {
      return 'conditional_right';
    }
    
    return null;
  }

  // Outright picks (unconditional ownership)
  if (
    (pick.status === 'own' || pick.status === 'incoming') &&
    pick.owner === teamCode &&
    !pick.protection &&
    !pick.isSwap
  ) {
    return 'outright_pick';
  }

  // Fallback: if team owns it and it's in inventory, treat as outright
  if (pick.owner === teamCode && pick.relation === 'inventory') {
    return 'outright_pick';
  }

  return null;
}

/**
 * Determines certainty level based on asset type and properties
 */
function determineCertainty(assetType: AssetType, pick: LedgerPick): Certainty {
  if (assetType === 'outright_pick') {
    return 'certain';
  }
  return 'conditional';
}

/**
 * Builds human-readable conditions text from pick data
 */
function buildConditionsText(pick: LedgerPick): string | undefined {
  const parts: string[] = [];

  // Add protection info
  if (pick.protection) {
    parts.push(`Protected: ${pick.protection}`);
  }

  // Add swap details
  if (pick.swapDetails) {
    if (pick.swapDetails.swapWith?.length) {
      const swapPartners = pick.swapDetails.swapWith.join(', ');
      const swapType = pick.swapDetails.favorable 
        ? `${pick.swapDetails.favorable} favorable`
        : pick.swapDetails.swapType || 'swap';
      parts.push(`Swap (${swapType}) with ${swapPartners}`);
    }
    if (pick.swapDetails.controller) {
      parts.push(`Controller: ${pick.swapDetails.controller}`);
    }
    if (pick.swapDetails.poolTeams?.length) {
      parts.push(`Pool teams: ${pick.swapDetails.poolTeams.join(', ')}`);
    }
    if (pick.swapDetails.allocation) {
      const alloc = pick.swapDetails.allocation;
      if (alloc.topN && alloc.topNTo) {
        parts.push(`Top ${alloc.topN} to ${alloc.topNTo}`);
      }
      if (alloc.remainderTo) {
        parts.push(`Remainder to ${alloc.remainderTo}`);
      }
    }
  }

  // Add notes if present
  if (pick.notes) {
    parts.push(pick.notes);
  }

  return parts.length > 0 ? parts.join(' | ') : undefined;
}

/**
 * Generates stable asset ID
 */
function generateAssetId(pick: LedgerPick, assetType: AssetType, teamCode: string): string {
  return `${pick.id}_${assetType}_${teamCode}`;
}

/**
 * Determines if a pick is tradeable now (Trade Machine semantics).
 * 
 * Trade Machine Definition:
 * - tradeableNow answers: "Can this asset be selected and included in a trade package UI today?"
 * - ALL valid asset types (outright_pick, conditional_right, swap_right) are tradeableNow: true
 * - Stepien rule and other constraints do NOT affect tradeableNow
 *   (those are tracked via stepienEligible, tradeable, and other fields)
 * 
 * The only case where tradeableNow would be false is if the asset is literally
 * non-transferable by rule (extremely rare, not implemented here).
 */
function isTradeable(_pick: LedgerPick): boolean {
  // Trade Machine semantics: all valid draft assets are selectable for trade packages
  // Stepien blocking, contested status, etc. are informational constraints that
  // do NOT prevent inclusion in the Trade Machine UI.
  // Those constraints are preserved in separate fields: stepienEligible, tradeable, etc.
  return true;
}

/**
 * Converts a ledger pick to a draft asset for a specific team
 */
function pickToDraftAsset(
  pick: LedgerPick,
  teamCode: string,
  assetType: AssetType
): DraftAsset {
  return {
    assetId: generateAssetId(pick, assetType, teamCode),
    pickId: pick.id,
    year: pick.year,
    round: pick.round,
    team: teamCode,
    originalTeam: pick.originalTeam,
    assetType,
    certainty: determineCertainty(assetType, pick),
    protection: pick.protection || null,
    conditionsText: buildConditionsText(pick),
    isSwap: pick.isSwap || false,
    swapDetails: pick.swapDetails,
    source: {
      srcTeamPage: pick.metadata?.realgmTeamPage,
      rawText: pick.metadata?.realgmRawText,
      obligationId: pick.id,
    },
    tradeableNow: isTradeable(pick),
    via: pick.via,
    notes: pick.notes,
  };
}

// ============================================================================
// MAIN PROCESSING
// ============================================================================

/**
 * Processes ledger views for a team and derives draft assets
 */
function deriveTeamDraftAssets(
  teamCode: string,
  ledgerViews: LedgerTeamViews
): TeamDraftAssets {
  const assets: DraftAsset[] = [];
  const seenAssetIds = new Set<string>();

  // Process inventory picks first (highest priority - team owns these)
  for (const pick of ledgerViews.inventory) {
    const assetType = classifyAssetType(pick, teamCode);
    if (assetType) {
      const asset = pickToDraftAsset(pick, teamCode, assetType);
      if (!seenAssetIds.has(asset.assetId)) {
        seenAssetIds.add(asset.assetId);
        assets.push(asset);
      }
    }
  }

  // Process contested picks (swap rights and conditional)
  for (const pick of ledgerViews.contested) {
    const assetType = classifyAssetType(pick, teamCode);
    if (assetType) {
      const asset = pickToDraftAsset(pick, teamCode, assetType);
      if (!seenAssetIds.has(asset.assetId)) {
        seenAssetIds.add(asset.assetId);
        assets.push(asset);
      }
    }
  }

  // Also check obligations for conditional rights the team may receive
  for (const pick of ledgerViews.obligations) {
    // Check if this team is the beneficiary of a conditional/protected pick
    if (pick.protection || pick.status === 'conditional') {
      const beneficiary = extractBeneficiaryTeam(pick);
      if (beneficiary === teamCode) {
        const asset = pickToDraftAsset(pick, teamCode, 'conditional_right');
        if (!seenAssetIds.has(asset.assetId)) {
          seenAssetIds.add(asset.assetId);
          assets.push(asset);
        }
      }
    }
  }

  // Sort by year, then round
  assets.sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    return a.round - b.round;
  });

  return {
    teamCode,
    generatedAt: new Date().toISOString(),
    picks: assets,
  };
}

/**
 * Loads ledger views for a team
 */
async function loadLedgerViews(
  teamCode: string,
  ledgerDir: string
): Promise<LedgerTeamViews | null> {
  const filePath = path.join(ledgerDir, `${teamCode}.json`);
  return loadJson<LedgerTeamViews>(filePath);
}

/**
 * Main builder function
 */
export async function buildDraftAssets(options?: {
  ledgerDir?: string;
  outDir?: string;
}): Promise<Map<string, TeamDraftAssets>> {
  const ledgerDir = options?.ledgerDir ?? DEFAULT_LEDGER_DIR;
  const outDir = options?.outDir ?? DEFAULT_OUTPUT_DIR;

  console.log('\n🏀 Building draft assets from ledger views...');
  console.log(`   Ledger dir: ${ledgerDir}`);
  console.log(`   Output dir: ${outDir}`);

  await ensureDir(outDir);

  const results = new Map<string, TeamDraftAssets>();
  let totalAssets = 0;
  let teamsProcessed = 0;
  let teamsMissing = 0;

  const assetTypeStats = {
    outright_pick: 0,
    conditional_right: 0,
    swap_right: 0,
  };

  // PHASE 1: Load all ledger views into memory for cross-team scanning
  const allLedgerViews = new Map<string, LedgerTeamViews>();
  for (const teamCode of ALL_TEAM_CODES) {
    const ledgerViews = await loadLedgerViews(teamCode, ledgerDir);
    if (ledgerViews) {
      allLedgerViews.set(teamCode, ledgerViews);
    }
  }

  // PHASE 2: Build a map of conditional picks where beneficiary differs from owner
  // Key: beneficiary team, Value: list of picks they should receive as conditional_right
  const crossTeamConditionalPicks = new Map<string, LedgerPick[]>();
  
  for (const [sourceTeam, ledgerViews] of allLedgerViews) {
    // Check inventory and obligations for conditional picks going to other teams
    const allPicks = [...ledgerViews.inventory, ...ledgerViews.obligations];
    
    for (const pick of allPicks) {
      if (pick.protection || pick.status === 'conditional') {
        const beneficiary = extractBeneficiaryTeam(pick);
        
        // If beneficiary is different from owner/source and is a valid team
        if (beneficiary && beneficiary !== sourceTeam && beneficiary !== pick.owner) {
          if (!crossTeamConditionalPicks.has(beneficiary)) {
            crossTeamConditionalPicks.set(beneficiary, []);
          }
          // Avoid duplicates based on pick ID
          const existingPicks = crossTeamConditionalPicks.get(beneficiary)!;
          if (!existingPicks.some(p => p.id === pick.id)) {
            crossTeamConditionalPicks.get(beneficiary)!.push(pick);
          }
        }
      }
    }
  }

  // PHASE 3: Process each team's assets
  for (const teamCode of ALL_TEAM_CODES) {
    const ledgerViews = allLedgerViews.get(teamCode);
    
    if (!ledgerViews) {
      console.warn(`  ⚠️  Missing ledger views for ${teamCode}`);
      teamsMissing++;
      // Create empty assets file
      const emptyAssets: TeamDraftAssets = {
        teamCode,
        generatedAt: new Date().toISOString(),
        picks: [],
      };
      results.set(teamCode, emptyAssets);
      await writeFile(
        path.join(outDir, `${teamCode}.json`),
        serialize(emptyAssets),
        'utf8'
      );
      continue;
    }

    // First pass: derive from team's own ledger
    const teamAssets = deriveTeamDraftAssets(teamCode, ledgerViews);
    const seenPickIds = new Set(teamAssets.picks.map(a => a.pickId));
    
    // Second pass: add cross-team conditional picks (from other teams' ledgers)
    const xTeamPicks = crossTeamConditionalPicks.get(teamCode) ?? [];
    for (const pick of xTeamPicks) {
      if (!seenPickIds.has(pick.id)) {
        const asset = pickToDraftAsset(pick, teamCode, 'conditional_right');
        teamAssets.picks.push(asset);
        seenPickIds.add(pick.id);
      }
    }
    
    // Re-sort after adding cross-team picks
    teamAssets.picks.sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return a.round - b.round;
    });
    
    results.set(teamCode, teamAssets);
    teamsProcessed++;
    totalAssets += teamAssets.picks.length;

    // Count asset types
    for (const asset of teamAssets.picks) {
      assetTypeStats[asset.assetType]++;
    }

    // Write team assets file
    await writeFile(
      path.join(outDir, `${teamCode}.json`),
      serialize(teamAssets),
      'utf8'
    );

    console.log(
      `  ✓ ${teamCode}: ${teamAssets.picks.length} assets (${
        teamAssets.picks.filter(a => a.assetType === 'outright_pick').length
      } outright, ${
        teamAssets.picks.filter(a => a.assetType === 'conditional_right').length
      } conditional, ${
        teamAssets.picks.filter(a => a.assetType === 'swap_right').length
      } swap)`
    );
  }

  console.log('\n📊 Draft Assets Summary:');
  console.log(`   Teams processed: ${teamsProcessed}`);
  console.log(`   Teams missing ledger: ${teamsMissing}`);
  console.log(`   Total assets: ${totalAssets}`);
  console.log(`   By type:`);
  console.log(`     - Outright picks: ${assetTypeStats.outright_pick}`);
  console.log(`     - Conditional rights: ${assetTypeStats.conditional_right}`);
  console.log(`     - Swap rights: ${assetTypeStats.swap_right}`);
  console.log(`\n✅ Draft assets written to: ${outDir}`);

  return results;
}

// ============================================================================
// CLI ENTRY POINT
// ============================================================================

if (import.meta.url === `file://${process.argv[1]}`) {
  const ledgerDir = parseArg('ledgerDir', DEFAULT_LEDGER_DIR);
  const outDir = parseArg('outDir', DEFAULT_OUTPUT_DIR);

  buildDraftAssets({ ledgerDir, outDir })
    .then((results) => {
      // Print sample team summaries
      const sampleTeams = ['UTA', 'DAL', 'LAL', 'OKC'];
      console.log('\n📋 Sample team summaries:');
      for (const code of sampleTeams) {
        const assets = results.get(code);
        if (assets) {
          console.log(`   ${code}: ${assets.picks.length} tradeable assets`);
          // Show first few picks
          for (const pick of assets.picks.slice(0, 3)) {
            console.log(
              `     - ${pick.pickId} (${pick.assetType}, ${pick.certainty})`
            );
          }
          if (assets.picks.length > 3) {
            console.log(`     ... and ${assets.picks.length - 3} more`);
          }
        }
      }
    })
    .catch((err) => {
      console.error('❌ Draft assets build failed:', err);
      process.exit(1);
    });
}
