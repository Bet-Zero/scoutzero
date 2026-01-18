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
  // Rule A: Origin tag is determined ONLY by originalTeam vs ownerTeam
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

// ============================================================================
// V6.5 FORMATTING LOGIC
// ============================================================================

function getOriginOrSwapV6_5(pick: FinalLedgerPick): string {
  // Check for swaps
  const swaps = pick.encumbrances.swaps || [];
  if (swaps.length > 0) {
    // Check for explicit controller
    // Prefer the one most describing the swap. 
    // We sort by controller code to be deterministic if multiple controllers exist.
    const explicitSwaps = swaps.filter(s => s.controller && s.controller.length > 0);
    
    if (explicitSwaps.length > 0) {
      // detailed sort: just alpha by controller for stability
      explicitSwaps.sort((a, b) => (a.controller || '').localeCompare(b.controller || ''));
      return `swap ${explicitSwaps[0].controller}`;
    } else {
      return 'swap attached';
    }
  }

  // No swaps - use origin/via rule
  if (pick.originalTeam === pick.owner) {
    return 'own';
  }
  return `via ${pick.originalTeam}`;
}

function getFavorableV6_5(pick: FinalLedgerPick): string {
  let mode = '';
  const pool = new Set<string>();

  // Check selection specs (preferred for processed favorable info)
  const specs = pick.encumbrances.selectionSpecs || [];
  for (const spec of specs) {
    if (spec.order === 'most' || spec.order === 'least') {
      mode = spec.order === 'most' ? 'most favorable' : 'least favorable';
      if (spec.pool) spec.pool.forEach(t => pool.add(t));
    }
  }

  // Check swaps if no specs found
  if (!mode) {
    const swaps = pick.encumbrances.swaps || [];
    for (const swap of swaps) {
      if (swap.mostLeast) {
        mode = swap.mostLeast === 'most_favorable' ? 'most favorable' : 'least favorable';
        if (swap.pool) swap.pool.forEach(t => pool.add(t));
      }
    }
  }

  // Fallback inference: if we have a swap with a controller but no explicit most/least data
  if (!mode) {
    const swaps = pick.encumbrances.swaps || [];
    const explicitSwaps = swaps.filter(s => s.controller);
    
    if (explicitSwaps.length > 0) {
      // Determine direction based on controller vs owner
      // If Owner == Controller => most favorable
      // If Owner != Controller => least favorable
      const isController = explicitSwaps.every(s => s.controller === pick.owner);
      const isVictim = explicitSwaps.every(s => s.controller !== pick.owner);

      if (isController) {
        mode = 'most favorable';
      } else if (isVictim) {
        mode = 'least favorable';
      }

      // Build pool from all involved swaps
      if (mode) {
        explicitSwaps.forEach(s => {
          if (s.controller) pool.add(s.controller);
          if (s.pool) s.pool.forEach(t => pool.add(t));
        });
        // Ensure owner is in pool (usually is, but for completeness)
        pool.add(pick.owner); 
      }
    }
  }

  if (!mode) return '';

  const sortedPool = Array.from(pool).sort();
  if (sortedPool.length >= 2) {
    return `${mode} (${sortedPool.join(',')})`;
  }
  
  return mode;
}

function getConditionsV6_5(pick: FinalLedgerPick, evidenceTexts: string[]): string {
  const parts: string[] = [];
  const pickYear = pick.year;

  // 1) Protections
  const applicableProtections = (pick.encumbrances.protections || []).filter(p => {
    if (!p.appliesToYears || p.appliesToYears.length === 0) return true;
    return p.appliesToYears.includes(pickYear);
  });

  const topN = applicableProtections.filter(p => p.protectedRange?.start === 1).map(p => p.protectedRange!.end);
  const ranges = applicableProtections.filter(p => p.protectedRange && p.protectedRange.start !== 1);
  const lottery = applicableProtections.some(p => p.type === 'lottery');

  if (topN.length > 0) {
    // Choose broadest
    const maxTop = Math.max(...topN);
    parts.push(`Top ${maxTop}`);
  }
  
  // Ranges
  const seenRanges = new Set<string>();
  for (const r of ranges) {
      const label = `${r.protectedRange!.start}-${r.protectedRange!.end}`;
      if (!seenRanges.has(label)) {
          seenRanges.add(label);
          parts.push(`protected #${label}`);
      }
  }

  if (lottery) parts.push('lottery');


  // 2) Fallback
  // Check conveyance
  const conveyance = pick.encumbrances.conveyance || [];
  for (const c of conveyance) {
     if (c && typeof c === 'object') {
        const conv = c as { fallbackPickId?: string; fallbackDescription?: string };
        if (conv.fallbackPickId) {
            // format pick id roughly: TEAM YEAR ROUND
            // PickID usually "TEAM-YEAR-ROUND-ORIG"
            const tokens = conv.fallbackPickId.split('-');
            if (tokens.length >= 3) {
                const [fTeam, fYear, fRound] = tokens;
                const roundSuffix = fRound === '1' ? '1st' : '2nd';
                parts.push(`fallback ${fTeam} ${fYear} ${roundSuffix}`);
            } else {
                 parts.push(`fallback ${conv.fallbackPickId}`);
            }
        } else if (conv.fallbackDescription) {
             // Try to extract useful bits if it's long, or just use it
             // Example "2026 2nd round pick protected ..."
             // For now, simple textual fallback
             let desc = conv.fallbackDescription;
             // Naive shortener if specific known patterns exist, else raw
             parts.push(`fallback ${desc}`);
        }
     }
  }

  // 3) Conditional
  const hasConditionNotMet = (pick.encumbrances.didNotConvey?.length || 0) > 0; 
  // We use the same 'isExplicitNonTransfer' logic? 
  // Prompt says: "If the pick has condition_not_met rows OR didNotConvey entries but no explicit past-tense non-transfer: include 'conditional'"
  
  if (hasConditionNotMet) {
     if (!isExplicitNonTransfer(evidenceTexts)) {
        parts.push('conditional');
     }
  }
  
  return parts.join('; ');
}

function formatPickLineV6_5(pick: FinalLedgerPick, evidenceTexts: string[] = []): string {
    const year = pick.year;
    const round = pick.round;
    const col3 = getOriginOrSwapV6_5(pick);
    const col4 = getFavorableV6_5(pick);
    const col5 = getConditionsV6_5(pick, evidenceTexts);
    
    // Collapse empty columns (no double pipes)
    // "Remove the blank space logic for picks that the 4th and 5th columns don't apply to."
    const parts = [year, round, col3, col4, col5].filter(p => p !== '' && p !== undefined && p !== null);
    
    return parts.join(' | ');
}

function formatTeamBlockV6_5(
  teamCode: string, 
  picks: FinalLedgerPick[], 
  evidenceLookup: Map<string, string[]> = new Map()
): string {
  const fullName = CODE_TO_FULL_NAME[teamCode];
  if (!fullName) throw new Error(`Cannot resolve team name for code: ${teamCode}`);

  const lines: string[] = [];
  lines.push(DOUBLE_LINE);
  lines.push(`# ${teamCode} — ${fullName.toUpperCase()} (${picks.length} picks)`);
  lines.push(SINGLE_LINE);

  // Sort picks: year ASC, round ASC, originalTeam ASC
  const sortedPicks = [...picks].sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    if (a.round !== b.round) return a.round - b.round;
    return a.originalTeam.localeCompare(b.originalTeam);
  });

  for (const pick of sortedPicks) {
    const evidenceTexts = evidenceLookup.get(pick.pickId) || [];
    lines.push(formatPickLineV6_5(pick, evidenceTexts));
  }

  return lines.join('\n');
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

  // Check for v6.5 mode flag
  const args = process.argv.slice(2);
  const isV65Mode = args.includes('--v6-5');

  // Prepare common variables
  const sortedTeamCodes = ALL_TEAM_CODES.slice().sort();
  const atlPicks = holdingsByTeam['ATL'] || [];
  const bosPicks = holdingsByTeam['BOS'] || [];

  // 6. Build combined report (LEGACY v6.3/6.4)
  // ONLY run if NOT in v6.5 specific mode
  if (!isV65Mode) {
    console.log('\nGenerating combined report (Legacy v6.4)...');
    const teamBlocks: string[] = [];

    // Sort by team code for consistent ordering
    for (const teamCode of sortedTeamCodes) {
      const picks = holdingsByTeam[teamCode] || [];
      if (picks.length > 0) {
        teamBlocks.push(formatTeamBlock(teamCode, picks, evidenceLookup));
      }
    }

    const combinedReport = teamBlocks.join('\n\n') + '\n';
    await fs.writeFile(COMBINED_VIEWS_PATH, combinedReport, 'utf-8');
    console.log(`  ✓ ${COMBINED_VIEWS_PATH}`);

    // 7. Generate per-team files (LEGACY)
    console.log('\nGenerating per-team files (Legacy v6.4)...');
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

    // 8. Generate summary JSON (LEGACY)
    console.log('\nGenerating summary JSON (Legacy)...');
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
  }

  // 9. Print summary
  console.log('\n📊 Phase 6 Summary');
  console.log('==================');
  console.log(`  Total picks: ${ledger.meta.totalPicks}`);
  console.log(`  Teams with picks: ${teamsWithPicks.length}`);
  if (!isV65Mode) {
    console.log(`  Combined report: ${COMBINED_VIEWS_PATH}`);
    console.log(`  Per-team files: ${PER_TEAM_DIR}/*.txt`);
    console.log(`  Summary JSON: ${SUMMARY_PATH}`); 
  }

  // 10. Print sample (first 2 team blocks for verification)
  if (!isV65Mode) {
    console.log('\n📋 Sample Output (ATL, BOS):');
    console.log('─'.repeat(40));
    
    if (atlPicks.length > 0) {
      console.log(formatTeamBlock('ATL', atlPicks, evidenceLookup));
    }
    console.log('');
    if (bosPicks.length > 0) {
      console.log(formatTeamBlock('BOS', bosPicks, evidenceLookup));
    }
    console.log('\n✅ Phase 6 COMPLETE - Manual check views generated!');
  }

  // 11. Generate v6.5 Combined Report (primary)
  // Run if isV65Mode OR just always run it? 
  // Prompt says "Add v6.5 output mode while preserving existing...". 
  // It doesn't strictly say v6.5 output shouldn't happen in default mode, but for cleanliness let's only run it in v6.5 mode
  // The command `pst:manual-views:v6-5` implies specific v6.5 generation.
  // Actually, usually we want "all" outputs. But the prompt emphasized "preserving existing".
  // Let's assume default run = old files. --v6-5 run = new files.
  
  if (isV65Mode) {
    console.log('\nGenerating v6.5 combined report...');
    const v6_5_Path = path.join(DATA_DIR, 'manual_check_views_v6_5.txt');
    const teamBlocksV6_5: string[] = [];

    for (const teamCode of sortedTeamCodes) {
      const picks = holdingsByTeam[teamCode] || [];
      if (picks.length > 0) {
        teamBlocksV6_5.push(formatTeamBlockV6_5(teamCode, picks, evidenceLookup));
      }
    }

    const combinedReportV6_5 = teamBlocksV6_5.join('\n\n') + '\n';
    await fs.writeFile(v6_5_Path, combinedReportV6_5, 'utf-8');
    console.log(`  ✓ ${v6_5_Path}`);

    // 12. Generate v6.5 Per-Team Files
    console.log('\nGenerating v6.5 per-team files...');
    const perTeamDirV6_5 = path.join(DATA_DIR, 'manual_check_views_v6_5');
    await ensureDir(perTeamDirV6_5);

    for (const teamCode of sortedTeamCodes) {
      const picks = holdingsByTeam[teamCode] || [];
      if (picks.length > 0) {
        const teamBlock = formatTeamBlockV6_5(teamCode, picks, evidenceLookup);
        const teamFilePath = path.join(perTeamDirV6_5, `${teamCode}.txt`);
        await fs.writeFile(teamFilePath, teamBlock + '\n', 'utf-8');
      }
    }
    // const perTeamCount = teamsWithPicks.length; // Already defined earlier
    console.log(`  ✓ Created ${teamsWithPicks.length} per-team files in ${perTeamDirV6_5}/`);

    // 13. Update Summary JSON for v6.5
    console.log('\nUpdating summary JSON for v6.5...');
    
    // Recalculate summary if needed? No, counts are same.
    // Just need to construct the object again if we skipped the default block
    // Or just reuse calculation. Counts depend on holdingsByTeam which is same.
    
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

    const summaryV6_5Path = path.join(DATA_DIR, 'manual_check_views_v6_5_summary.json');
    await fs.writeFile(summaryV6_5Path, serialize(summary), 'utf-8');
    console.log(`  ✓ ${summaryV6_5Path}`);
    
    // 14. Print v6.5 Sample
    console.log('\n📋 Sample Output v6.5 (ATL, BOS):');
    console.log('─'.repeat(40));
    
    if (atlPicks.length > 0) {
      console.log(formatTeamBlockV6_5('ATL', atlPicks, evidenceLookup));
    }
    console.log('');
    if (bosPicks.length > 0) {
      console.log(formatTeamBlockV6_5('BOS', bosPicks, evidenceLookup));
    }

    console.log('\n✅ Phase 6.5 COMPLETE - Manual check views generated!');
  }
}

// Run
main().catch((err) => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
