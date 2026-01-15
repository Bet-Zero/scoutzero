#!/usr/bin/env tsx
/**
 * audit_draft_assets_invariant.ts
 *
 * Validates the draft assets output against required invariants:
 * 1. UTA must have LAL_2027_1st as conditional_right with protection/conditionsText
 * 2. DAL must have LAL_2029_1st as outright_pick
 * 3. Every team's conditional/protected picks in ledger must have corresponding draftAssets entry
 * 4. All 30 teams must have a draftAssets file
 *
 * Usage:
 *   npx tsx team-scrape/draft-picks/scripts/audit_draft_assets_invariant.ts
 *   npx tsx team-scrape/draft-picks/scripts/audit_draft_assets_invariant.ts --assetsDir=<path> --ledgerDir=<path>
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from "url";

// ============================================================================
// TYPES
// ============================================================================

type DraftAsset = {
  assetId: string;
  pickId: string;
  year: number;
  round: number;
  team: string;
  originalTeam: string;
  assetType: 'outright_pick' | 'conditional_right' | 'swap_right';
  certainty: 'certain' | 'conditional';
  protection?: string | null;
  conditionsText?: string;
  isSwap?: boolean;
  swapDetails?: unknown;
  source: {
    srcTeamPage?: string;
    rawText?: string;
    obligationId?: string;
  };
  tradeableNow: boolean;
};

type TeamDraftAssets = {
  teamCode: string;
  generatedAt: string;
  picks: DraftAsset[];
};

type LedgerPick = {
  id: string;
  year: number;
  round: number;
  status: string;
  owner: string;
  originalTeam: string;
  protection?: string | null;
  isSwap?: boolean;
  swapDetails?: unknown;
  recipient?: string;
  relation?: string;
};

type LedgerTeamViews = {
  teamCode: string;
  inventory: LedgerPick[];
  obligations: LedgerPick[];
  contested: LedgerPick[];
};

type Failure = {
  type: 'SANITY_CHECK' | 'MISSING_ASSET' | 'MISSING_FILE' | 'INVARIANT';
  team: string;
  pickId?: string;
  expected?: string;
  actual?: string;
  details?: string;
};

// ============================================================================
// CONFIGURATION
// ============================================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..');

const DEFAULT_ASSETS_DIR = path.join(
  PROJECT_ROOT,
  'team-scrape',
  'shared',
  'firestore_staging',
  '_artifacts',
  'output',
  'draft_assets'
);

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

const AUDIT_OUT_DIR = path.join(
  PROJECT_ROOT,
  'team-scrape',
  'draft-picks',
  '_artifacts',
  'audits'
);

const OUT_FILE = path.join(AUDIT_OUT_DIR, 'draft_assets_invariant_report.json');

const ALL_TEAM_CODES = [
  'ATL', 'BOS', 'BKN', 'CHA', 'CHI', 'CLE', 'DAL', 'DEN', 'DET', 'GSW',
  'HOU', 'IND', 'LAC', 'LAL', 'MEM', 'MIA', 'MIL', 'MIN', 'NOP', 'NYK',
  'OKC', 'ORL', 'PHI', 'PHX', 'POR', 'SAC', 'SAS', 'TOR', 'UTA', 'WAS',
];

// ============================================================================
// HELPERS
// ============================================================================

function getArg(label: string, def?: string): string | undefined {
  const argv = process.argv.slice(2);
  const prefix = `--${label}=`;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === `--${label}`) {
      const next = argv[i + 1];
      if (!next || next.startsWith('--')) return 'true';
      return next;
    }
    if (arg.startsWith(prefix)) {
      return arg.slice(prefix.length);
    }
  }

  return def;
}

function readJson<T>(filePath: string): T | null {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

// ============================================================================
// SANITY CHECKS
// ============================================================================

/**
 * Check 1: UTA must have LAL_2027_1st as conditional_right with protection/conditionsText
 */
function checkUTA_LAL2027(assets: TeamDraftAssets | null): Failure | null {
  if (!assets) {
    return {
      type: 'SANITY_CHECK',
      team: 'UTA',
      pickId: 'LAL_2027_1st',
      expected: 'conditional_right with protection',
      actual: 'missing assets file',
      details: 'UTA assets file not found',
    };
  }

  // Look for LAL_2027_1st in various possible ID formats
  const lalPick = assets.picks.find(
    (p) =>
      p.pickId === 'LAL_2027_1st' ||
      p.pickId === '2027_1_LAL' ||
      (p.year === 2027 && p.round === 1 && p.originalTeam === 'LAL')
  );

  if (!lalPick) {
    return {
      type: 'SANITY_CHECK',
      team: 'UTA',
      pickId: 'LAL_2027_1st',
      expected: 'conditional_right with protection',
      actual: 'pick not found in UTA draftAssets',
      details: `UTA has ${assets.picks.length} assets but none match LAL_2027_1st`,
    };
  }

  if (lalPick.assetType !== 'conditional_right') {
    return {
      type: 'SANITY_CHECK',
      team: 'UTA',
      pickId: 'LAL_2027_1st',
      expected: 'conditional_right',
      actual: lalPick.assetType,
      details: 'Asset type mismatch',
    };
  }

  // Must have protection or conditionsText
  if (!lalPick.protection && !lalPick.conditionsText) {
    return {
      type: 'SANITY_CHECK',
      team: 'UTA',
      pickId: 'LAL_2027_1st',
      expected: 'protection or conditionsText populated',
      actual: 'both are empty',
      details: 'LAL_2027_1st should have top-4 protection info',
    };
  }

  return null; // PASS
}

/**
 * Check 2: DAL must have LAL_2029_1st as outright_pick
 */
function checkDAL_LAL2029(assets: TeamDraftAssets | null): Failure | null {
  if (!assets) {
    return {
      type: 'SANITY_CHECK',
      team: 'DAL',
      pickId: 'LAL_2029_1st',
      expected: 'outright_pick',
      actual: 'missing assets file',
      details: 'DAL assets file not found',
    };
  }

  // Look for LAL_2029_1st in various possible ID formats
  const lalPick = assets.picks.find(
    (p) =>
      p.pickId === 'LAL_2029_1st' ||
      p.pickId === '2029_1_LAL' ||
      (p.year === 2029 && p.round === 1 && p.originalTeam === 'LAL')
  );

  if (!lalPick) {
    return {
      type: 'SANITY_CHECK',
      team: 'DAL',
      pickId: 'LAL_2029_1st',
      expected: 'outright_pick',
      actual: 'pick not found in DAL draftAssets',
      details: `DAL has ${assets.picks.length} assets but none match LAL_2029_1st`,
    };
  }

  if (lalPick.assetType !== 'outright_pick') {
    return {
      type: 'SANITY_CHECK',
      team: 'DAL',
      pickId: 'LAL_2029_1st',
      expected: 'outright_pick',
      actual: lalPick.assetType,
      details: 'Asset type mismatch - should be unconditional',
    };
  }

  return null; // PASS
}

// ============================================================================
// INVARIANT CHECKS
// ============================================================================

/**
 * Check that all conditional/protected picks in ledger have corresponding draftAssets entries
 */
function checkConditionalPicksCoverage(
  teamCode: string,
  ledgerViews: LedgerTeamViews | null,
  assets: TeamDraftAssets | null
): Failure[] {
  const failures: Failure[] = [];

  if (!ledgerViews) {
    return failures; // Can't check without ledger
  }

  if (!assets) {
    // All conditional picks are missing
    const conditionalPicks = [
      ...ledgerViews.inventory.filter(
        (p) => p.protection || p.status === 'conditional'
      ),
      ...ledgerViews.contested.filter((p) => p.owner === teamCode),
    ];

    for (const pick of conditionalPicks) {
      failures.push({
        type: 'MISSING_ASSET',
        team: teamCode,
        pickId: pick.id,
        expected: 'asset entry',
        actual: 'missing (no assets file)',
        details: `Conditional pick ${pick.id} has no corresponding draftAssets entry`,
      });
    }
    return failures;
  }

  const assetPickIds = new Set(assets.picks.map((a) => a.pickId));

  // Check inventory conditional picks
  for (const pick of ledgerViews.inventory) {
    if (pick.protection || pick.status === 'conditional') {
      if (!assetPickIds.has(pick.id)) {
        failures.push({
          type: 'MISSING_ASSET',
          team: teamCode,
          pickId: pick.id,
          expected: 'conditional_right asset',
          actual: 'not found in draftAssets',
          details: `Protected/conditional inventory pick missing from assets`,
        });
      }
    }
  }

  // Check contested picks where team is involved
  for (const pick of ledgerViews.contested) {
    const isInvolved =
      pick.owner === teamCode ||
      pick.originalTeam === teamCode ||
      (pick.swapDetails as any)?.swapWith?.includes(teamCode);

    if (isInvolved && !assetPickIds.has(pick.id)) {
      // This is acceptable for some contested picks - only flag if team owns it
      if (pick.owner === teamCode) {
        failures.push({
          type: 'MISSING_ASSET',
          team: teamCode,
          pickId: pick.id,
          expected: 'swap_right or conditional_right asset',
          actual: 'not found in draftAssets',
          details: `Owned contested pick missing from assets`,
        });
      }
    }
  }

  return failures;
}

// ============================================================================
// MAIN
// ============================================================================

function main() {
  const assetsDir = getArg('assetsDir', DEFAULT_ASSETS_DIR)!;
  const ledgerDir = getArg('ledgerDir', DEFAULT_LEDGER_DIR)!;

  console.log('\n=== DRAFT ASSETS INVARIANT AUDIT ===');
  console.log(`   Assets dir: ${assetsDir}`);
  console.log(`   Ledger dir: ${ledgerDir}`);

  const failures: Failure[] = [];
  const teamStats: Record<string, { assets: number; missing: boolean }> = {};
  let teamsWithAssets = 0;

  // Load all team assets
  const assetsByTeam = new Map<string, TeamDraftAssets | null>();
  const ledgerByTeam = new Map<string, LedgerTeamViews | null>();

  for (const teamCode of ALL_TEAM_CODES) {
    const assetsPath = path.join(assetsDir, `${teamCode}.json`);
    const ledgerPath = path.join(ledgerDir, `${teamCode}.json`);

    const assets = readJson<TeamDraftAssets>(assetsPath);
    const ledger = readJson<LedgerTeamViews>(ledgerPath);

    assetsByTeam.set(teamCode, assets);
    ledgerByTeam.set(teamCode, ledger);

    if (assets) {
      teamsWithAssets++;
      teamStats[teamCode] = { assets: assets.picks.length, missing: false };
    } else {
      teamStats[teamCode] = { assets: 0, missing: true };
      failures.push({
        type: 'MISSING_FILE',
        team: teamCode,
        details: `Draft assets file not found: ${assetsPath}`,
      });
    }
  }

  console.log(`\n📊 Teams with assets files: ${teamsWithAssets}/${ALL_TEAM_CODES.length}`);

  // Run sanity checks
  console.log('\n🔍 Running sanity checks...');

  // Check 1: UTA LAL_2027_1st
  const utaCheck = checkUTA_LAL2027(assetsByTeam.get('UTA') ?? null);
  if (utaCheck) {
    failures.push(utaCheck);
    console.log(`   ❌ UTA LAL_2027_1st: ${utaCheck.actual}`);
  } else {
    console.log('   ✅ UTA has LAL_2027_1st as conditional_right with protection');
  }

  // Check 2: DAL LAL_2029_1st
  const dalCheck = checkDAL_LAL2029(assetsByTeam.get('DAL') ?? null);
  if (dalCheck) {
    failures.push(dalCheck);
    console.log(`   ❌ DAL LAL_2029_1st: ${dalCheck.actual}`);
  } else {
    console.log('   ✅ DAL has LAL_2029_1st as outright_pick');
  }

  // Run coverage checks
  console.log('\n🔍 Running conditional picks coverage checks...');
  let coverageIssues = 0;

  for (const teamCode of ALL_TEAM_CODES) {
    const teamFailures = checkConditionalPicksCoverage(
      teamCode,
      ledgerByTeam.get(teamCode) ?? null,
      assetsByTeam.get(teamCode) ?? null
    );
    
    if (teamFailures.length > 0) {
      coverageIssues += teamFailures.length;
      failures.push(...teamFailures);
    }
  }

  console.log(`   Coverage issues found: ${coverageIssues}`);

  // Summary
  const summary = {
    assetsDir,
    ledgerDir,
    teamsChecked: ALL_TEAM_CODES.length,
    teamsWithAssets,
    sanityChecksPassed: !utaCheck && !dalCheck,
    utaLAL2027Check: utaCheck ? 'FAIL' : 'PASS',
    dalLAL2029Check: dalCheck ? 'FAIL' : 'PASS',
    coverageIssues,
    totalFailures: failures.length,
    teamStats,
  };

  // Write report
  fs.mkdirSync(AUDIT_OUT_DIR, { recursive: true });
  fs.writeFileSync(
    OUT_FILE,
    JSON.stringify({ summary, failures }, null, 2),
    'utf8'
  );

  console.log('\n📊 Summary:');
  console.log(JSON.stringify(summary, null, 2));
  console.log(`\nWrote report: ${OUT_FILE}`);

  // Exit status
  const criticalFailures = failures.filter(
    (f) => f.type === 'SANITY_CHECK' || f.type === 'MISSING_FILE'
  );

  if (criticalFailures.length > 0) {
    console.error(`\n❌ AUDIT FAILED: ${criticalFailures.length} critical failures`);
    for (const f of criticalFailures.slice(0, 10)) {
      console.error(`   - [${f.type}] ${f.team}: ${f.details || f.actual}`);
    }
    if (criticalFailures.length > 10) {
      console.error(`   ... and ${criticalFailures.length - 10} more`);
    }
    process.exit(1);
  }

  if (failures.length > 0) {
    console.warn(`\n⚠️  AUDIT PASSED WITH WARNINGS: ${failures.length} non-critical issues`);
    process.exit(0);
  }

  console.log('\n✅ AUDIT PASSED: All invariants satisfied');
  process.exit(0);
}

main();
