#!/usr/bin/env tsx
/**
 * FILE: scripts/release/scouting_prod_sync_plan.ts
 * PURPOSE: Single entrypoint for scouting data production sync. Runs staging verification
 *          and outputs exact commands for prod push with guardrails.
 * OWNERSHIP: Scouting data pipeline
 *
 * HISTORY:
 *  - 2026-02-04: Created for Phase 2AF - Scouting Prod Sync Wiring
 *
 * LINKS:
 *  - Runbook: docs/scouting/PROD_SYNC_RUNBOOK.md
 *  - Master Doc: docs/scouting/SCOUTING_PLAYER_TABLE_MASTER_AUDIT.md
 *
 * USAGE:
 *   npx tsx scripts/release/scouting_prod_sync_plan.ts
 *   npx tsx scripts/release/scouting_prod_sync_plan.ts --verify-only
 *   npx tsx scripts/release/scouting_prod_sync_plan.ts --print-commands
 */

import fs from 'node:fs';
import path from 'node:path';

// =============================================================================
// CONFIGURATION
// =============================================================================

const EXPECTED_PROJECT_ID = 'scoutzero-bf1ae';

const ARTIFACT_PATHS = {
  players_v2: path.resolve('firestore_staging/_artifacts/output/players_v2'),
  basePlayers: path.resolve('firestore_staging/_artifacts/output/basePlayers'),
  baseTeams: path.resolve(
    'team-scrape/shared/firestore_staging/_artifacts/output/baseTeams'
  ),
  entitlements: path.resolve('data/pst/pst_entitlement_assets_2026_2033.json'),
  pickRules: path.resolve('data/pst/pst_pick_ledger_final_2026_2033.json'),
  entitlementsByTeam: path.resolve(
    'data/pst/pst_entitlements_by_team_2026_2033.json'
  ),
};

const STAGING_COMMANDS = {
  players:
    'npx tsx player-scrape/firestore_staging/scripts/stage_all_players.ts',
  baseTeamsPatch: 'npm run stage:patch:baseTeams:entitlementIds:write',
};

const PUSH_SCRIPTS = {
  players: 'player-scrape/firestore_staging/scripts/push_staged_players.ts',
  teams: 'team-scrape/shared/firestore_staging/scripts/push_staged_teams.ts',
  entitlements:
    'team-scrape/draft-picks/scripts/pst/pst_phase_10_push_base_entitlements.ts',
  entitlementsPatch:
    'team-scrape/draft-picks/scripts/pst/pst_phase_10_patch_base_teams_entitlements.ts',
  pickRules:
    'team-scrape/draft-picks/scripts/pst/pst_phase_12_3a_push_base_pick_rules.ts',
};

const VERIFY_COMMANDS = {
  players: 'npm run verify:artifacts:players',
  teams: 'npm run verify:artifacts:baseTeams',
};

// =============================================================================
// TYPES
// =============================================================================

type CheckResult = {
  name: string;
  passed: boolean;
  message: string;
  count?: number;
};

type ArtifactSummary = {
  players_v2: {
    count: number;
    hasOptionsbyYear: boolean;
    sampleChecked: string;
  };
  basePlayers: { count: number };
  baseTeams: { count: number; hasEntitlementIds: boolean };
  entitlements: { count: number };
  pickRules: { count: number };
};

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

const log = (msg: string) => process.stdout.write(`${msg}\n`);
const logHeader = (title: string) => {
  log('');
  log('═'.repeat(80));
  log(`  ${title}`);
  log('═'.repeat(80));
  log('');
};

const checkEmulatorEnvNotSet = (): boolean => {
  return !process.env.FIRESTORE_EMULATOR_HOST;
};

const countJsonFiles = (dir: string): number => {
  if (!fs.existsSync(dir)) return 0;
  return fs.readdirSync(dir).filter((f) => f.endsWith('.json')).length;
};

const parseJsonFile = <T>(filepath: string): T | null => {
  if (!fs.existsSync(filepath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filepath, 'utf8')) as T;
  } catch {
    return null;
  }
};

const samplePlayerHasOptionsbyYear = (
  dir: string
): { has: boolean; checked: string } => {
  if (!fs.existsSync(dir)) return { has: false, checked: '(dir missing)' };
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
  if (files.length === 0) return { has: false, checked: '(no files)' };

  // Check a few known players with options
  const knownWithOptions = [
    'aaron_gordon.json',
    'luka_doncic.json',
    'lebron_james.json',
  ];
  const toCheck = knownWithOptions.find((f) => files.includes(f)) || files[0];

  const data = parseJsonFile<{
    doc?: { currentContractView?: { optionsByYear?: Record<string, string> } };
  }>(path.join(dir, toCheck));

  const optionsByYear = data?.doc?.currentContractView?.optionsByYear;
  const has =
    optionsByYear !== undefined && Object.keys(optionsByYear).length > 0;
  return { has, checked: toCheck };
};

const sampleTeamHasEntitlementIds = (dir: string): boolean => {
  if (!fs.existsSync(dir)) return false;
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
  if (files.length === 0) return false;

  // Check ATL as reference
  const sample = 'ATL.json';
  if (!files.includes(sample)) return false;

  const data = parseJsonFile<{ entitlementIds?: string[] }>(
    path.join(dir, sample)
  );
  return Array.isArray(data?.entitlementIds) && data.entitlementIds.length > 0;
};

// =============================================================================
// ARTIFACT VERIFICATION
// =============================================================================

const verifyArtifacts = (): {
  results: CheckResult[];
  summary: ArtifactSummary;
} => {
  const results: CheckResult[] = [];

  // Players V2
  const playersCount = countJsonFiles(ARTIFACT_PATHS.players_v2);
  const optionsCheck = samplePlayerHasOptionsbyYear(ARTIFACT_PATHS.players_v2);
  results.push({
    name: 'players_v2 artifacts',
    passed: playersCount > 500 && optionsCheck.has,
    message: `${playersCount} files, optionsByYear=${optionsCheck.has ? 'YES' : 'NO'} (checked: ${optionsCheck.checked})`,
    count: playersCount,
  });

  // Base Players
  const basePlayersCount = countJsonFiles(ARTIFACT_PATHS.basePlayers);
  results.push({
    name: 'basePlayers artifacts',
    passed: basePlayersCount > 500,
    message: `${basePlayersCount} files`,
    count: basePlayersCount,
  });

  // Base Teams
  const teamsCount = countJsonFiles(ARTIFACT_PATHS.baseTeams);
  const teamsHaveEntitlementIds = sampleTeamHasEntitlementIds(
    ARTIFACT_PATHS.baseTeams
  );
  results.push({
    name: 'baseTeams artifacts',
    passed: teamsCount === 30 && teamsHaveEntitlementIds,
    message: `${teamsCount} teams, entitlementIds=${teamsHaveEntitlementIds ? 'YES' : 'NO'}`,
    count: teamsCount,
  });

  // Entitlements
  const entitlementsData = parseJsonFile<{ assets?: unknown[] } | unknown[]>(
    ARTIFACT_PATHS.entitlements
  );
  const entitlementsCount = Array.isArray(entitlementsData)
    ? entitlementsData.length
    : ((entitlementsData as { assets?: unknown[] })?.assets?.length ?? 0);
  results.push({
    name: 'entitlements source',
    passed: entitlementsCount > 400,
    message: `${entitlementsCount} entitlement assets`,
    count: entitlementsCount,
  });

  // Pick Rules
  const pickRulesData = parseJsonFile<{ picks?: unknown[] } | unknown[]>(
    ARTIFACT_PATHS.pickRules
  );
  const pickRulesCount = Array.isArray(pickRulesData)
    ? pickRulesData.length
    : ((pickRulesData as { picks?: unknown[] })?.picks?.length ?? 0);
  results.push({
    name: 'pickRules source',
    passed: pickRulesCount > 200,
    message: `${pickRulesCount} pick rules`,
    count: pickRulesCount,
  });

  const summary: ArtifactSummary = {
    players_v2: {
      count: playersCount,
      hasOptionsbyYear: optionsCheck.has,
      sampleChecked: optionsCheck.checked,
    },
    basePlayers: { count: basePlayersCount },
    baseTeams: {
      count: teamsCount,
      hasEntitlementIds: teamsHaveEntitlementIds,
    },
    entitlements: { count: entitlementsCount },
    pickRules: { count: pickRulesCount },
  };

  return { results, summary };
};

// =============================================================================
// PREFLIGHT CHECKLIST
// =============================================================================

const printPreflightChecklist = () => {
  logHeader('PREFLIGHT CHECKLIST (Before Prod Push)');

  log('✅ REQUIRED BEFORE RUNNING PROD COMMANDS:\n');

  log('1️⃣  CONFIRM PROJECT ID:');
  log(`   Expected: ${EXPECTED_PROJECT_ID}`);
  log('   Verify: cat serviceAccountKey.json | grep project_id');
  log('');

  log('2️⃣  UNSET EMULATOR ENV VARS:');
  log('   unset FIRESTORE_EMULATOR_HOST');
  log('   unset GCLOUD_PROJECT');
  log('   unset FIREBASE_PROJECT');
  log('   unset PROJECT_ID');
  log('');

  log('3️⃣  VERIFY SERVICE ACCOUNT:');
  log('   ls -la serviceAccountKey.json');
  log('   Ensure this is the PRODUCTION service account for scoutzero-bf1ae');
  log('');

  log('4️⃣  STOP EMULATORS:');
  log('   pkill -f "firebase.*emulators" || true');
  log('');

  log('5️⃣  VERIFY ARTIFACTS ARE FRESH:');
  log('   npm run verify:artifacts:players');
  log('   npm run verify:artifacts:baseTeams');
  log('');

  log('⚠️  DANGER ZONE:');
  log('   - These commands WILL WRITE TO PRODUCTION');
  log('   - There is no undo - only restore from backup');
  log('   - Double-check project_id in serviceAccountKey.json');
  log('');
};

// =============================================================================
// PROD PUSH COMMANDS
// =============================================================================

const printProdPushCommands = () => {
  logHeader('PRODUCTION PUSH COMMANDS');

  log('📌 All commands require --confirmProject flag for safety\n');

  log(
    '───────────────────────────────────────────────────────────────────────────────'
  );
  log('STEP 1: PLAYERS + BASE_PLAYERS (requires service account)');
  log(
    '───────────────────────────────────────────────────────────────────────────────'
  );
  log(
    `npx tsx ${PUSH_SCRIPTS.players} --confirmProject=${EXPECTED_PROJECT_ID}`
  );
  log('');
  log(
    '   Writes to: players_v2 (660+ docs), architect_basePlayers (660+ docs)'
  );
  log('   Source: firestore_staging/_artifacts/output/players_v2/*.json');
  log('   Source: firestore_staging/_artifacts/output/basePlayers/*.json');
  log('');

  log(
    '───────────────────────────────────────────────────────────────────────────────'
  );
  log('STEP 2: BASE_TEAMS (requires service account)');
  log(
    '───────────────────────────────────────────────────────────────────────────────'
  );
  log(`npx tsx ${PUSH_SCRIPTS.teams} --confirmProject=${EXPECTED_PROJECT_ID}`);
  log('');
  log('   Writes to: architect_baseTeams (30 docs)');
  log(
    '   Source: team-scrape/shared/firestore_staging/_artifacts/output/baseTeams/*.json'
  );
  log('');

  log(
    '───────────────────────────────────────────────────────────────────────────────'
  );
  log('STEP 3: ENTITLEMENTS (emulator mode OFF required)');
  log(
    '───────────────────────────────────────────────────────────────────────────────'
  );
  log(`npx tsx ${PUSH_SCRIPTS.entitlements}`);
  log('');
  log('   Writes to: architect_baseEntitlements (450+ docs)');
  log('   Source: data/pst/pst_entitlement_assets_2026_2033.json');
  log('');

  log(
    '───────────────────────────────────────────────────────────────────────────────'
  );
  log(
    'STEP 4: PATCH BASE_TEAMS WITH ENTITLEMENT IDS (emulator mode OFF required)'
  );
  log(
    '───────────────────────────────────────────────────────────────────────────────'
  );
  log(`npx tsx ${PUSH_SCRIPTS.entitlementsPatch}`);
  log('');
  log('   Updates: architect_baseTeams.entitlementIds (30 docs)');
  log('   Source: data/pst/pst_entitlements_by_team_2026_2033.json');
  log('');

  log(
    '───────────────────────────────────────────────────────────────────────────────'
  );
  log('STEP 5: PICK RULES (emulator mode OFF required)');
  log(
    '───────────────────────────────────────────────────────────────────────────────'
  );
  log(`npx tsx ${PUSH_SCRIPTS.pickRules}`);
  log('');
  log('   Writes to: architect_basePickRules (240+ docs)');
  log('   Source: data/pst/pst_pick_ledger_final_2026_2033.json');
  log('');
};

// =============================================================================
// STAGING COMMANDS
// =============================================================================

const printStagingCommands = () => {
  logHeader('STAGING COMMANDS (Regenerate Artifacts)');

  log('📌 Run these BEFORE pushing to prod if artifacts are stale\n');

  log(
    '───────────────────────────────────────────────────────────────────────────────'
  );
  log('STEP 1: REGENERATE ALL PLAYER ARTIFACTS');
  log(
    '───────────────────────────────────────────────────────────────────────────────'
  );
  log(STAGING_COMMANDS.players);
  log('');
  log('   Output: firestore_staging/_artifacts/output/players_v2/*.json');
  log('   Output: firestore_staging/_artifacts/output/basePlayers/*.json');
  log('   Time: ~10-20 minutes for 660 players');
  log('');

  log(
    '───────────────────────────────────────────────────────────────────────────────'
  );
  log('STEP 2: PATCH BASE_TEAMS ARTIFACTS WITH ENTITLEMENT IDS');
  log(
    '───────────────────────────────────────────────────────────────────────────────'
  );
  log(STAGING_COMMANDS.baseTeamsPatch);
  log('');
  log(
    '   Patches: team-scrape/shared/firestore_staging/_artifacts/output/baseTeams/*.json'
  );
  log('   Source: data/pst/pst_entitlements_by_team_2026_2033.json');
  log('   Note: Idempotent - safe to run multiple times');
  log('');

  log(
    '───────────────────────────────────────────────────────────────────────────────'
  );
  log('STEP 3: VERIFY ARTIFACTS');
  log(
    '───────────────────────────────────────────────────────────────────────────────'
  );
  log(VERIFY_COMMANDS.players);
  log(VERIFY_COMMANDS.teams);
  log('');
};

// =============================================================================
// MAIN
// =============================================================================

const main = () => {
  const args = process.argv.slice(2);
  const verifyOnly = args.includes('--verify-only');
  const printCommands = args.includes('--print-commands');

  logHeader('SCOUTING PROD SYNC PLAN');
  log(`Date: ${new Date().toISOString()}`);
  log(`Project: ${EXPECTED_PROJECT_ID}`);
  log('');

  // Check emulator env
  if (!checkEmulatorEnvNotSet()) {
    log('⚠️  WARNING: FIRESTORE_EMULATOR_HOST is set!');
    log('   Current value: ' + process.env.FIRESTORE_EMULATOR_HOST);
    log('   Prod push commands will fail. Run: unset FIRESTORE_EMULATOR_HOST');
    log('');
  }

  // Verify artifacts
  logHeader('ARTIFACT VERIFICATION');
  const { results, summary } = verifyArtifacts();

  let allPassed = true;
  for (const r of results) {
    const icon = r.passed ? '✅' : '❌';
    log(`${icon} ${r.name}: ${r.message}`);
    if (!r.passed) allPassed = false;
  }
  log('');

  if (!allPassed) {
    log('⚠️  Some artifacts are missing or incomplete.');
    log('   Run staging commands to regenerate before prod push.');
    log('');
    printStagingCommands();
  }

  if (verifyOnly) {
    log(
      '──────────────────────────────────────────────────────────────────────────'
    );
    log('Verify-only mode. Exiting.');
    return;
  }

  // Print full report
  printStagingCommands();
  printPreflightChecklist();
  printProdPushCommands();

  logHeader('SUMMARY');
  log('Artifact Status:');
  log(
    `  players_v2:       ${summary.players_v2.count} docs, optionsByYear=${summary.players_v2.hasOptionsbyYear}`
  );
  log(`  basePlayers:      ${summary.basePlayers.count} docs`);
  log(
    `  baseTeams:        ${summary.baseTeams.count} docs, entitlementIds=${summary.baseTeams.hasEntitlementIds}`
  );
  log(`  entitlements:     ${summary.entitlements.count} docs`);
  log(`  pickRules:        ${summary.pickRules.count} docs`);
  log('');
  log('Next Steps:');
  log('  1. If artifacts are stale, run staging commands');
  log('  2. Complete preflight checklist');
  log('  3. Run prod push commands one at a time');
  log('  4. Verify in Firebase Console');
  log('');
  log('📖 See: docs/scouting/PROD_SYNC_RUNBOOK.md');
};

main();
