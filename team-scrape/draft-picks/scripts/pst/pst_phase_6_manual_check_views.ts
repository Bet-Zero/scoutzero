#!/usr/bin/env tsx
/**
 * pst_phase_6_manual_check_views.ts
 *
 * Phase 6 Runner Script: Generate Manual Check Views
 *
 * This script generates human-readable "manual check" views from the final PST
 * pick ledger, formatted for verification against Fanspo and Spotrac.
 *
 * Inputs (read-only):
 * - data/pst/pst_pick_ledger_final_2026_2033.json
 *
 * Outputs:
 * - data/pst/manual_check_views.txt (combined report, all 30 teams)
 * - data/pst/manual_check_views/*.txt (per-team reports)
 * - data/pst/manual_check_views_summary.json (index summary)
 *
 * Usage:
 *   npx tsx team-scrape/draft-picks/scripts/pst/pst_phase_6_manual_check_views.ts
 *   npm run pst:manual-views
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CODE_TO_FULL_NAME, ALL_TEAM_CODES } from './pst_team_slugs';

// ============================================================================
// CONFIGURATION
// ============================================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..', '..');

const DATA_DIR = path.join(PROJECT_ROOT, 'data', 'pst');

// Input paths
const FINAL_LEDGER_PATH = path.join(DATA_DIR, 'pst_pick_ledger_final_2026_2033.json');
const FINAL_PROFILES_PATH = path.join(DATA_DIR, 'pst_pick_rule_profiles_final_2026_2033.json');

// Output paths
const COMBINED_VIEWS_PATH = path.join(DATA_DIR, 'manual_check_views.txt');
const PER_TEAM_DIR = path.join(DATA_DIR, 'manual_check_views');
const SUMMARY_PATH = path.join(DATA_DIR, 'manual_check_views_summary.json');

// ============================================================================
// TYPES
// ============================================================================

interface ProtectionRange {
  start: number;
  end: number;
}

interface Protection {
  type?: string;
  protectedRange?: ProtectionRange;
  description?: string;
  appliesToYears?: number[];
}

interface Swap {
  controller?: string;
  pool?: string[];
  mostLeast?: 'most_favorable' | 'least_favorable' | null;
  description?: string;
}

interface SelectionSpec {
  kind: 'swap' | 'conveys';
  controller?: string;
  order: 'most' | 'least';
  rank: number;
  pool: string[];
  year: number;
  round: 1 | 2;
  evidenceRowRefs: string[];
  description: string;
}

interface Evidence {
  rowRef: string;
  sourceTeamPage: string;
  sourceUrl: string;
  normalizedTextSnippet: string;
  rowKind: string;
}

interface ProfileEntry {
  pickId: string;
  evidence: Evidence[];
}

interface ProfilesFile {
  meta: {
    years: number[];
    generatedAt: string;
    totalPicks: number;
    needsReviewCount: number;
  };
  profiles: Record<string, ProfileEntry>;
}

interface Encumbrances {
  protections: Protection[];
  swaps: Swap[];
  conveyance: unknown[];
  didNotConvey: unknown[];
  selectionSpecs: SelectionSpec[];
}

interface FinalLedgerPick {
  pickId: string;
  year: number;
  round: 1 | 2;
  originalTeam: string;
  owner: string;
  ownershipSource: 'BASE' | 'PST_DISPLAY';
  encumbrances: Encumbrances;
  evidenceRowRefs: string[];
}

interface FinalLedger {
  meta: {
    years: number[];
    generatedAt: string;
    totalPicks: number;
  };
  picks: FinalLedgerPick[];
}

interface SummaryCountsByYearRound {
  [key: string]: number; // e.g., "2026_1": 1
}

interface Summary {
  generatedAt: string;
  totalPicks: number;
  picksPerTeam: Record<string, number>;
  countsByYearRound: Record<string, SummaryCountsByYearRound>;
}

// ============================================================================
// TAG GENERATION (Phase 6.3 - Conditional Tag + Swap Display Rule)
// ============================================================================

/**
 * Patterns that indicate an explicit past-tense non-transfer outcome.
 * Used to distinguish "did not convey" from "conditional".
 */
const PAST_TENSE_PATTERNS = [
  /did not convey/i,
  /not conveyed/i,
  /will not convey/i,
  /would not transfer/i,
  /protection exercised/i,
];

/**
 * Check if evidence texts indicate an explicit non-transfer outcome (past-tense).
 * 
 * @param evidenceTexts - Array of normalized text snippets from evidence
 * @returns true if any text contains past-tense non-transfer language
 */
function isExplicitNonTransfer(evidenceTexts: string[]): boolean {
  return evidenceTexts.some(text =>
    PAST_TENSE_PATTERNS.some(pattern => pattern.test(text))
  );
}

/**
 * Generate human-readable tags from encumbrances for a specific pick year.
 * 
 * This is the presentation-layer tag generator with conservative, Fanspo-like output.
 * 
 * Tag Order (v6.3):
 *   1. Protection tag (Top N / lottery / protected #A-B)
 *   2. Favorable pool tag (least of / most of)
 *   3. Swap tag (swap {controller} OR swap attached)
 *   4. Conditional OR Did not convey (based on evidence text)
 *   5. Fallback
 *   6. PROT_CONFLICT (if multiple conflicting protections)
 * 
 * v6.3 Changes:
 *   - "conditional" emitted instead of "did not convey" when evidence is not past-tense
 *   - Swap tags now displayed alongside favorable pools (removed suppression)
 * 
 * @param encumbrances - The pick's encumbrances data
 * @param pickYear - The year of this pick line (for filtering protections)
 * @param evidenceTexts - Array of normalized text snippets for conditional/did-not-convey detection
 * @returns Comma-separated tag string
 */
function generateTags(encumbrances: Encumbrances, pickYear: number, evidenceTexts: string[] = []): string {
  const tags: string[] = [];
  let hasProtConflict = false;

  // =========================================================================
  // 1. PROTECTION TAGS
  // =========================================================================
  
  // Filter protections to only those that apply to this pick year
  const applicableProtections = encumbrances.protections.filter(p => {
    // If appliesToYears is empty/undefined, assume it applies to all years
    if (!p.appliesToYears || p.appliesToYears.length === 0) {
      return true;
    }
    return p.appliesToYears.includes(pickYear);
  });

  // Categorize protections
  const topNProtections: Protection[] = [];
  const rangeProtections: Protection[] = [];
  let hasLottery = false;

  for (const p of applicableProtections) {
    if (p.type === 'lottery') {
      hasLottery = true;
    } else if (p.protectedRange) {
      if (p.protectedRange.start === 1) {
        topNProtections.push(p);
      } else {
        rangeProtections.push(p);
      }
    }
  }

  // Resolve Top N protections: keep only the broadest (highest end value)
  // If multiple distinct Top N exist, add PROT_CONFLICT
  if (topNProtections.length > 0) {
    // Get unique end values
    const uniqueEnds = [...new Set(topNProtections.map(p => p.protectedRange!.end))];
    
    if (uniqueEnds.length > 1) {
      // Multiple conflicting Top N protections
      hasProtConflict = true;
    }
    
    // Use the broadest (highest end value)
    const broadestEnd = Math.max(...uniqueEnds);
    tags.push(`Top ${broadestEnd}`);
  }

  // Add lottery tag
  if (hasLottery) {
    tags.push('lottery');
  }

  // Add range protections (dedupe by start-end)
  const seenRanges = new Set<string>();
  for (const p of rangeProtections) {
    const rangeKey = `${p.protectedRange!.start}-${p.protectedRange!.end}`;
    if (!seenRanges.has(rangeKey)) {
      seenRanges.add(rangeKey);
      tags.push(`protected #${rangeKey}`);
    }
  }

  // =========================================================================
  // 2. FAVORABLE POOL TAGS (least of / most of)
  // =========================================================================
  
  const seenPools = new Set<string>();
  
  // Extract favorable pools from selectionSpecs (preferred)
  const selectionSpecs = encumbrances.selectionSpecs || [];
  for (const spec of selectionSpecs) {
    if (spec.pool && spec.pool.length > 0) {
      const poolKey = `${spec.order}-${spec.rank}-${[...spec.pool].sort().join(',')}`;
      if (!seenPools.has(poolKey)) {
        seenPools.add(poolKey);
        
        // Format rank
        let rankPrefix = '';
        if (spec.rank > 1) {
          const ordinal = spec.rank === 2 ? '2nd' : spec.rank === 3 ? '3rd' : `${spec.rank}th`;
          rankPrefix = `${ordinal} `;
        }
        
        const poolStr = [...spec.pool].sort().join(',');
        tags.push(`${rankPrefix}${spec.order} of (${poolStr})`);
      }
    }
  }

  // Fallback: extract from raw swaps if no selectionSpecs provided pools
  if (selectionSpecs.length === 0) {
    for (const s of encumbrances.swaps) {
      if (s.mostLeast && s.pool && s.pool.length > 0) {
        const order = s.mostLeast === 'most_favorable' ? 'most' : 'least';
        // Include controller in pool if present
        const fullPool = s.controller 
          ? [...new Set([s.controller, ...s.pool])].sort()
          : [...s.pool].sort();
        
        const poolKey = `${order}-1-${fullPool.join(',')}`;
        if (!seenPools.has(poolKey)) {
          seenPools.add(poolKey);
          tags.push(`${order} of (${fullPool.join(',')})`);
        }
      }
    }
  }

  // =========================================================================
  // 3. SWAP TAGS (v6.3: emit swap alongside favorable pools)
  // =========================================================================
  
  const swapsWithController: Swap[] = [];
  const swapsWithoutController: Swap[] = [];
  
  for (const s of encumbrances.swaps) {
    if (s.controller && ALL_TEAM_CODES.includes(s.controller)) {
      swapsWithController.push(s);
    } else if (s.pool && s.pool.length > 0) {
      swapsWithoutController.push(s);
    }
  }

  // v6.3: Always emit "swap {controller}" when controller is explicit
  // This allows both favorable pool tag AND swap tag to appear
  const seenSwapControllers = new Set<string>();
  for (const s of swapsWithController) {
    if (!seenSwapControllers.has(s.controller!)) {
      seenSwapControllers.add(s.controller!);
      tags.push(`swap ${s.controller}`);
    }
  }

  // Emit "swap attached" only if no controller was emitted AND no pool tags exist
  if (swapsWithoutController.length > 0 && seenSwapControllers.size === 0) {
    const hasPoolTags = tags.some(t => t.includes(' of ('));
    if (!hasPoolTags) {
      tags.push('swap attached');
    }
  }

  // =========================================================================
  // 4. CONDITIONAL / DID NOT CONVEY (v6.3: distinguish based on evidence text)
  // =========================================================================
  
  if (encumbrances.didNotConvey && encumbrances.didNotConvey.length > 0) {
    // v6.3: Check evidence text to determine if this is a confirmed non-transfer
    // or just conditional language about future possibilities
    if (isExplicitNonTransfer(evidenceTexts)) {
      tags.push('did not convey');
    } else {
      // Default to "conditional" for condition_not_met rows without explicit outcome
      tags.push('conditional');
    }
  }

  // =========================================================================
  // 5. FALLBACK
  // =========================================================================
  
  // Check conveyance for fallback indicators
  if (encumbrances.conveyance && Array.isArray(encumbrances.conveyance)) {
    for (const c of encumbrances.conveyance) {
      if (c && typeof c === 'object') {
        const conv = c as { fallbackPickId?: string; fallbackDescription?: string };
        if (conv.fallbackPickId || conv.fallbackDescription) {
          tags.push('fallback');
          break;
        }
      }
    }
  }

  // =========================================================================
  // 6. PROT_CONFLICT (last, if needed)
  // =========================================================================
  
  if (hasProtConflict) {
    tags.push('PROT_CONFLICT');
  }

  // =========================================================================
  // LIMIT TO 4 TAGS (drop lowest priority if needed)
  // =========================================================================
  
  // Priority order (high to low): protection, pool, swap, did not convey, fallback, PROT_CONFLICT
  // If more than 4, drop from the end (lowest priority first)
  if (tags.length > 4) {
    // Keep first 4, but always keep PROT_CONFLICT if present
    const hasConflict = tags.includes('PROT_CONFLICT');
    let result = tags.slice(0, 4);
    if (hasConflict && !result.includes('PROT_CONFLICT')) {
      result[3] = 'PROT_CONFLICT';
    }
    return result.join(', ');
  }

  return tags.join(', ');
}

/**
 * Generate origin tag based on ownership vs original team.
 */
function getOriginTag(pick: FinalLedgerPick): string {
  if (pick.originalTeam === pick.owner) {
    return 'own';
  }
  return `via ${pick.originalTeam}`;
}

// ============================================================================
// FORMATTING
// ============================================================================

const DOUBLE_LINE = '════════════════════════════════════════════════════════════════════════════════';
const SINGLE_LINE = '────────────────────────────────────────────────────────────────────────────────';

/**
 * Format a single pick line.
 * Format: {YEAR} | {ROUND} | {ORIGIN_TAG} | {TAGS}
 * 
 * @param pick - The pick to format
 * @param evidenceTexts - Array of evidence text snippets for conditional/did-not-convey detection
 */
function formatPickLine(pick: FinalLedgerPick, evidenceTexts: string[] = []): string {
  const year = pick.year;
  const round = pick.round;
  const origin = getOriginTag(pick);
  const tags = generateTags(pick.encumbrances, year, evidenceTexts);

  return `${year} | ${round} | ${origin} | ${tags}`;
}

/**
 * Format a team block for the combined report.
 * 
 * @param teamCode - The team code
 * @param picks - Array of picks owned by this team
 * @param evidenceLookup - Map of pickId -> evidence text snippets (for conditional detection)
 */
function formatTeamBlock(
  teamCode: string, 
  picks: FinalLedgerPick[], 
  evidenceLookup: Map<string, string[]> = new Map()
): string {
  const fullName = CODE_TO_FULL_NAME[teamCode];
  if (!fullName) {
    throw new Error(`Cannot resolve team name for code: ${teamCode}`);
  }

  const lines: string[] = [];
  lines.push(DOUBLE_LINE);
  lines.push(`# ${teamCode} — ${fullName.toUpperCase()} (${picks.length} picks)`);
  lines.push('');
  lines.push(SINGLE_LINE);

  // Sort picks: year ASC, round ASC, originalTeam ASC
  const sortedPicks = [...picks].sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    if (a.round !== b.round) return a.round - b.round;
    return a.originalTeam.localeCompare(b.originalTeam);
  });

  for (const pick of sortedPicks) {
    const evidenceTexts = evidenceLookup.get(pick.pickId) || [];
    lines.push(formatPickLine(pick, evidenceTexts));
  }

  return lines.join('\n');
}

// ============================================================================
// UTILITIES
// ============================================================================

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
  } catch {
    // Directory may already exist
  }
}

function serialize(obj: unknown, pretty = true): string {
  return pretty ? JSON.stringify(obj, null, 2) : JSON.stringify(obj);
}

// ============================================================================
// MAIN
// ============================================================================

async function main(): Promise<void> {
  console.log('\n📊 PST Phase 6: Generate Manual Check Views');
  console.log('============================================\n');

  const generatedAt = new Date().toISOString();

  // 1. Check input files exist
  const hasLedger = await fileExists(FINAL_LEDGER_PATH);
  const hasProfiles = await fileExists(FINAL_PROFILES_PATH);
  if (!hasLedger) {
    console.error('❌ Missing final ledger. Run: npm run pst:phase-5 first');
    console.error(`   Missing: ${FINAL_LEDGER_PATH}`);
    process.exit(1);
  }
  if (!hasProfiles) {
    console.error('❌ Missing final profiles. Run: npm run pst:phase-5 first');
    console.error(`   Missing: ${FINAL_PROFILES_PATH}`);
    process.exit(1);
  }

  // 2. Load final ledger and profiles
  console.log('Loading final ledger and profiles...');
  const ledgerRaw = await fs.readFile(FINAL_LEDGER_PATH, 'utf-8');
  const ledger: FinalLedger = JSON.parse(ledgerRaw);
  console.log(`  Total picks: ${ledger.meta.totalPicks}`);

  const profilesRaw = await fs.readFile(FINAL_PROFILES_PATH, 'utf-8');
  const profilesFile: ProfilesFile = JSON.parse(profilesRaw);
  console.log(`  Profiles loaded: ${Object.keys(profilesFile.profiles).length}`);

  // 2.1. Build evidence lookup (pickId -> array of normalized text snippets)
  // Used for v6.3 conditional vs did-not-convey detection
  const evidenceLookup = new Map<string, string[]>();
  for (const [pickId, profile] of Object.entries(profilesFile.profiles)) {
    const texts = (profile.evidence || [])
      .map(e => e.normalizedTextSnippet || '')
      .filter(t => t.length > 0);
    evidenceLookup.set(pickId, texts);
  }
  console.log(`  Evidence lookup built for ${evidenceLookup.size} picks`);

  // 3. Validate 480 picks (STOP CONDITION)
  if (ledger.meta.totalPicks !== 480) {
    console.error(`\n❌ BLOCKED: Final ledger does not contain 480 picks (found: ${ledger.meta.totalPicks})`);
    process.exit(1);
  }
  console.log('  ✓ Validated 480 picks');

  // 4. Group picks by owner (team holdings view)
  console.log('\nGrouping picks by owner...');
  const holdingsByTeam: Record<string, FinalLedgerPick[]> = {};

  for (const pick of ledger.picks) {
    // Validate owner is a valid team code (STOP CONDITION)
    if (!ALL_TEAM_CODES.includes(pick.owner)) {
      console.error(`\n❌ BLOCKED: Invalid owner team code: ${pick.owner} (pick: ${pick.pickId})`);
      process.exit(1);
    }

    if (!holdingsByTeam[pick.owner]) {
      holdingsByTeam[pick.owner] = [];
    }
    holdingsByTeam[pick.owner].push(pick);
  }

  // Validate all team codes have entries (even if empty) - actually we only show teams with picks
  const teamsWithPicks = Object.keys(holdingsByTeam).sort();
  console.log(`  Teams with picks: ${teamsWithPicks.length}`);

  // 5. Validate team names can be resolved (STOP CONDITION)
  for (const teamCode of teamsWithPicks) {
    if (!CODE_TO_FULL_NAME[teamCode]) {
      console.error(`\n❌ BLOCKED: Cannot resolve team name for code: ${teamCode}`);
      process.exit(1);
    }
  }
  console.log('  ✓ All team names resolved');

  // 6. Build combined report
  console.log('\nGenerating combined report...');
  const teamBlocks: string[] = [];

  // Sort by team code for consistent ordering
  const sortedTeamCodes = ALL_TEAM_CODES.slice().sort();
  for (const teamCode of sortedTeamCodes) {
    const picks = holdingsByTeam[teamCode] || [];
    if (picks.length > 0) {
      teamBlocks.push(formatTeamBlock(teamCode, picks, evidenceLookup));
    }
  }

  const combinedReport = teamBlocks.join('\n\n') + '\n';
  await fs.writeFile(COMBINED_VIEWS_PATH, combinedReport, 'utf-8');
  console.log(`  ✓ ${COMBINED_VIEWS_PATH}`);

  // 7. Generate per-team files
  console.log('\nGenerating per-team files...');
  await ensureDir(PER_TEAM_DIR);

  for (const teamCode of sortedTeamCodes) {
    const picks = holdingsByTeam[teamCode] || [];
    if (picks.length > 0) {
      const teamBlock = formatTeamBlock(teamCode, picks, evidenceLookup);
      const teamFilePath = path.join(PER_TEAM_DIR, `${teamCode}.txt`);
      await fs.writeFile(teamFilePath, teamBlock + '\n', 'utf-8');
    }
  }

  const perTeamCount = teamsWithPicks.length;
  console.log(`  ✓ Created ${perTeamCount} per-team files in ${PER_TEAM_DIR}/`);

  // 8. Generate summary JSON
  console.log('\nGenerating summary JSON...');
  const picksPerTeam: Record<string, number> = {};
  const countsByYearRound: Record<string, SummaryCountsByYearRound> = {};

  for (const teamCode of sortedTeamCodes) {
    const picks = holdingsByTeam[teamCode] || [];
    picksPerTeam[teamCode] = picks.length;

    if (picks.length > 0) {
      countsByYearRound[teamCode] = {};
      for (const pick of picks) {
        const key = `${pick.year}_${pick.round}`;
        countsByYearRound[teamCode][key] = (countsByYearRound[teamCode][key] || 0) + 1;
      }
    }
  }

  const summary: Summary = {
    generatedAt,
    totalPicks: ledger.meta.totalPicks,
    picksPerTeam,
    countsByYearRound,
  };

  await fs.writeFile(SUMMARY_PATH, serialize(summary), 'utf-8');
  console.log(`  ✓ ${SUMMARY_PATH}`);

  // 9. Print summary
  console.log('\n📊 Phase 6 Summary');
  console.log('==================');
  console.log(`  Total picks: ${ledger.meta.totalPicks}`);
  console.log(`  Teams with picks: ${teamsWithPicks.length}`);
  console.log(`  Combined report: ${COMBINED_VIEWS_PATH}`);
  console.log(`  Per-team files: ${PER_TEAM_DIR}/*.txt`);
  console.log(`  Summary JSON: ${SUMMARY_PATH}`);

  // 10. Print sample (first 2 team blocks for verification)
  console.log('\n📋 Sample Output (ATL, BOS):');
  console.log('─'.repeat(40));
  
  const atlPicks = holdingsByTeam['ATL'] || [];
  const bosPicks = holdingsByTeam['BOS'] || [];
  
  if (atlPicks.length > 0) {
    console.log(formatTeamBlock('ATL', atlPicks, evidenceLookup));
  }
  console.log('');
  if (bosPicks.length > 0) {
    console.log(formatTeamBlock('BOS', bosPicks, evidenceLookup));
  }

  console.log('\n✅ Phase 6 COMPLETE - Manual check views generated!');
}

// Run
main().catch((err) => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
