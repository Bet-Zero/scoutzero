/**
 * FILE: scripts/emu/seedIfMissing.ts
 * PURPOSE: Seed emulator data only when required base collections are missing.
 *          Includes BaseTeams Integrity Guardrail (Phase 16.2) to auto-detect and
 *          repair entitlementIds-only team docs.
 * OWNERSHIP: Tooling: local emulator workflow
 *
 * HISTORY:
 *  - 2026-01-28: Created by plan `plans/_archive/emulator-workflow-hardening/plan.md`, chunk_01
 *  - 2026-01-29: Expanded seeding coverage per plan `plans/pst-emulator-seeding/plan.md`
 *  - 2026-02-01: Added BaseTeams Integrity Guardrail (Phase 16.2)
 *
 * LINKS:
 *  - Plan (legacy): plans/_archive/emulator-workflow-hardening/plan.md
 *  - Current Plan: plans/pst-emulator-seeding/plan.md
 *  - Return Package: docs/team-scrape/return_packages/PST_EMULATOR_BASETEAMS_INTEGRITY_GUARDRAIL_EXECUTION_RETURN_PACKAGE.md
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { initAdminEmu } from './adminEmu.js';

const REQUIRED_TEAMS = 30;

/**
 * Sample teams for integrity checks (deterministic).
 * We check LAL, BOS, HOU as canaries across conferences.
 */
const SAMPLE_TEAMS_FOR_INTEGRITY = ['LAL', 'BOS', 'HOU'];
const ENTITLEMENTS_JSON_PATH = path.resolve(
  'data/pst/pst_entitlement_assets_2026_2033.json'
);
const PICK_LEDGER_JSON_PATH = path.resolve(
  'data/pst/pst_pick_ledger_final_2026_2033.json'
);

/**
 * Minimum threshold for base pick rules.
 * If the collection has fewer docs than this, we consider it empty/incomplete.
 * Derived from the ledger: only picks with encumbrances (protections/swaps/conditions) are pushed.
 * We use a conservative minimum of 100 to catch missing/incomplete seeding.
 */
const MIN_PICK_RULES_THRESHOLD = 100;

const getExpectedEntitlementCount = (): number => {
  if (!fs.existsSync(ENTITLEMENTS_JSON_PATH)) {
    throw new Error(
      `[seed] entitlements JSON not found at ${ENTITLEMENTS_JSON_PATH}`
    );
  }
  const raw = fs.readFileSync(ENTITLEMENTS_JSON_PATH, 'utf8');
  const data = JSON.parse(raw) as unknown;
  // Handle both shapes: { assets: [...] } or [...]
  if (Array.isArray(data)) {
    return data.length;
  }
  if (typeof data === 'object' && data !== null && 'assets' in data) {
    const assets = (data as { assets: unknown[] }).assets;
    if (Array.isArray(assets)) {
      return assets.length;
    }
  }
  throw new Error(
    `[seed] invalid shape in ${ENTITLEMENTS_JSON_PATH}: expected { assets: [...] } or [...]`
  );
};

/**
 * Count picks with encumbrances from the ledger file.
 * Only picks that have protections, swaps, conveyance, didNotConvey, or selectionSpecs are pushed.
 */
const getExpectedPickRulesCount = (): number => {
  if (!fs.existsSync(PICK_LEDGER_JSON_PATH)) {
    throw new Error(
      `[seed] pick ledger JSON not found at ${PICK_LEDGER_JSON_PATH}`
    );
  }
  const raw = fs.readFileSync(PICK_LEDGER_JSON_PATH, 'utf8');
  const data = JSON.parse(raw) as { picks?: unknown[] };
  const picks = data.picks;
  if (!Array.isArray(picks)) {
    throw new Error(
      `[seed] invalid shape in ${PICK_LEDGER_JSON_PATH}: expected { picks: [...] }`
    );
  }
  // Count picks that have encumbrances (same logic as pst_phase_12_3a_push_base_pick_rules.ts)
  let count = 0;
  for (const pick of picks) {
    const enc = (pick as { encumbrances?: Record<string, unknown[]> })
      .encumbrances;
    if (!enc) continue;
    const hasContent =
      (Array.isArray(enc.protections) && enc.protections.length > 0) ||
      (Array.isArray(enc.swaps) && enc.swaps.length > 0) ||
      (Array.isArray(enc.conveyance) && enc.conveyance.length > 0) ||
      (Array.isArray(enc.didNotConvey) && enc.didNotConvey.length > 0) ||
      (Array.isArray(enc.selectionSpecs) && enc.selectionSpecs.length > 0);
    if (hasContent) count++;
  }
  return count;
};

const log = (message: string) => {
  process.stdout.write(`${message}\n`);
};

let cachedDb: FirebaseFirestore.Firestore | null = null;
let cachedProjectId: string | null = null;

const getDb = () => {
  if (!cachedDb) {
    const { db, projectId } = initAdminEmu();
    cachedDb = db;
    cachedProjectId = projectId;
  }
  return cachedDb;
};

/**
 * BaseTeams Integrity Check result.
 * Phase 16.2: Ensure baseTeams docs contain full data, not just entitlementIds.
 */
interface BaseTeamsIntegrityResult {
  healthy: boolean;
  reason: string;
  details: {
    teamCode: string;
    hasTeamCode: boolean;
    hasTeamName: boolean;
    hasRoster: boolean;
    rosterLength: number;
    hasEntitlementIds: boolean;
    isEntitlementIdOnly: boolean;
  }[];
}

/**
 * Check baseTeams integrity by sampling deterministic teams.
 * Verifies that sampled docs have required fields (teamCode, teamName, roster)
 * and are not "entitlementIds-only" docs (a broken state).
 */
const checkBaseTeamsIntegrity = async (): Promise<BaseTeamsIntegrityResult> => {
  const db = getDb();
  const details: BaseTeamsIntegrityResult['details'] = [];

  for (const teamCode of SAMPLE_TEAMS_FOR_INTEGRITY) {
    const docRef = db.collection('architect_baseTeams').doc(teamCode);
    const snap = await docRef.get();

    if (!snap.exists) {
      details.push({
        teamCode,
        hasTeamCode: false,
        hasTeamName: false,
        hasRoster: false,
        rosterLength: 0,
        hasEntitlementIds: false,
        isEntitlementIdOnly: false,
      });
      continue;
    }

    const data = snap.data() as Record<string, unknown>;
    const keys = Object.keys(data);

    const hasTeamCode =
      typeof data.teamCode === 'string' && data.teamCode.length === 3;
    const hasTeamName =
      typeof data.teamName === 'string' && data.teamName.length > 0;
    const hasRoster = Array.isArray(data.roster) && data.roster.length > 0;
    const rosterLength = Array.isArray(data.roster) ? data.roster.length : 0;
    const hasEntitlementIds =
      Array.isArray(data.entitlementIds) && data.entitlementIds.length > 0;

    // "entitlementIds-only" = doc has entitlementIds but is missing core fields
    const isEntitlementIdOnly =
      hasEntitlementIds && (!hasTeamCode || !hasTeamName || !hasRoster);

    details.push({
      teamCode,
      hasTeamCode,
      hasTeamName,
      hasRoster,
      rosterLength,
      hasEntitlementIds,
      isEntitlementIdOnly,
    });
  }

  // Determine overall health
  const missingDocs = details.filter((d) => !d.hasTeamCode && !d.hasTeamName);
  const entitlementOnlyDocs = details.filter((d) => d.isEntitlementIdOnly);
  const corruptDocs = details.filter(
    (d) => d.hasTeamCode && (!d.hasTeamName || !d.hasRoster)
  );

  if (details.some((d) => !d.hasTeamCode && !d.hasTeamName && !d.hasRoster)) {
    // Doc doesn't exist at all
    const missing = details
      .filter((d) => !d.hasTeamCode && !d.hasTeamName && !d.hasRoster)
      .map((d) => d.teamCode);
    return {
      healthy: false,
      reason: `doc missing: ${missing.join(', ')}`,
      details,
    };
  }

  if (entitlementOnlyDocs.length > 0) {
    const codes = entitlementOnlyDocs.map((d) => d.teamCode);
    return {
      healthy: false,
      reason: `entitlementIds-only (missing roster/teamName): ${codes.join(', ')}`,
      details,
    };
  }

  if (corruptDocs.length > 0) {
    const reasons = corruptDocs.map((d) => {
      const issues: string[] = [];
      if (!d.hasTeamName) issues.push('missing teamName');
      if (!d.hasRoster) issues.push('missing roster');
      return `${d.teamCode}: ${issues.join(', ')}`;
    });
    return {
      healthy: false,
      reason: reasons.join('; '),
      details,
    };
  }

  return {
    healthy: true,
    reason: 'all sampled teams have teamCode, teamName, and roster',
    details,
  };
};

/**
 * Auto-repair baseTeams by reseeding from staged JSON and then patching entitlementIds.
 * Called when integrity check fails during emulator startup.
 */
const repairBaseTeams = async (): Promise<void> => {
  log('[seed:repair] baseTeams integrity failed — starting auto-repair...');

  // Step 1: Reseed from staged JSON (full replace)
  log('[seed:repair] Step 1/3: Reseeding baseTeams from staged JSON...');
  await runScript('emu:reseed:baseTeams');

  // Step 2: Patch entitlementIds (merge)
  log('[seed:repair] Step 2/3: Patching entitlementIds onto baseTeams...');
  await runScript('pst:patch:base-teams-entitlements');

  // Step 3: Re-check integrity
  log('[seed:repair] Step 3/3: Verifying repair...');
  const postRepair = await checkBaseTeamsIntegrity();

  if (!postRepair.healthy) {
    throw new Error(
      `[seed:repair] REPAIR FAILED — baseTeams still unhealthy after repair: ${postRepair.reason}\n` +
        `Details: ${JSON.stringify(postRepair.details, null, 2)}`
    );
  }

  log('[seed:repair] ✅ baseTeams repair complete — integrity verified');
};

const checkSeedState = async () => {
  const db = getDb();
  const [
    entitlementsSnap,
    teamsSnap,
    basePlayersSnap,
    playersV2Snap,
    basePickRulesSnap,
  ] = await Promise.all([
    db.collection('architect_baseEntitlements').get(),
    db.collection('architect_baseTeams').get(),
    db.collection('architect_basePlayers').limit(1).get(),
    db.collection('players_v2').limit(1).get(),
    db.collection('architect_basePickRules').get(),
  ]);

  const entitlementsCount = entitlementsSnap.size;

  let teamsWithEntitlements = 0;
  teamsSnap.forEach((doc) => {
    const data = doc.data();
    if (Array.isArray(data.entitlementIds) && data.entitlementIds.length > 0) {
      teamsWithEntitlements += 1;
    }
  });

  return {
    entitlementsCount,
    teamsCount: teamsSnap.size,
    teamsWithEntitlements,
    basePlayersCount: basePlayersSnap.size,
    playersV2Count: playersV2Snap.size,
    basePickRulesCount: basePickRulesSnap.size,
  };
};

const runScript = async (script: string) =>
  new Promise<void>((resolve, reject) => {
    const child = spawn('npm', ['run', script], {
      stdio: 'inherit',
      env: process.env,
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${script} exited with code ${code ?? 'unknown'}`));
      }
    });
  });

/**
 * Phase 2AA: Run optionsByYear backfill if players need it.
 * This ensures emulator has optionsByYear even with stale staged data.
 */
const runOptionsByYearBackfillIfNeeded = async (): Promise<void> => {
  log('[seed] Phase 2AA: checking optionsByYear backfill state...');

  const MIGRATION_SCRIPT = 'scripts/migrations/phase2y_backfill_optionsByYear.js';
  const EMULATOR_ENV = {
    ...process.env,
    FIRESTORE_EMULATOR_HOST: '127.0.0.1:8082',
    GCLOUD_PROJECT: 'scoutzero-bf1ae',
    FIREBASE_PROJECT_ID: 'scoutzero-bf1ae',
  };

  // Run dry-run first
  const dryRunResult = await new Promise<{ wouldUpdate: number; exitCode: number }>(
    (resolve, reject) => {
      let stdout = '';
      const child = spawn('node', [MIGRATION_SCRIPT], {
        stdio: ['inherit', 'pipe', 'inherit'],
        env: EMULATOR_ENV,
      });
      child.stdout?.on('data', (data: Buffer) => {
        stdout += data.toString();
        process.stdout.write(data);
      });
      child.on('error', reject);
      child.on('close', (code) => {
        // Parse "Would update: N" from output
        const match = stdout.match(/Would update:\s+(\d+)/);
        const wouldUpdate = match ? parseInt(match[1], 10) : 0;
        resolve({ wouldUpdate, exitCode: code ?? 0 });
      });
    }
  );

  if (dryRunResult.exitCode !== 0) {
    throw new Error(
      `[seed] optionsByYear dry-run failed with exit code ${dryRunResult.exitCode}`
    );
  }

  if (dryRunResult.wouldUpdate > 0) {
    log(
      `[seed] optionsByYear: ${dryRunResult.wouldUpdate} players need backfill, running write mode...`
    );

    const writeResult = await new Promise<number>((resolve, reject) => {
      const child = spawn('node', [MIGRATION_SCRIPT, '--write'], {
        stdio: 'inherit',
        env: EMULATOR_ENV,
      });
      child.on('error', reject);
      child.on('close', (code) => resolve(code ?? 0));
    });

    if (writeResult !== 0) {
      throw new Error(
        `[seed] optionsByYear write failed with exit code ${writeResult}`
      );
    }

    log('[seed] optionsByYear: backfill complete');
  } else {
    log('[seed] optionsByYear: all players current, skipping backfill');
  }
};


const main = async () => {
  // Initialize admin and log projectId (also validates FIRESTORE_EMULATOR_HOST)
  const { projectId } = initAdminEmu();
  log(`[seed] projectId: ${projectId}`);

  // ============================================================
  // Phase 16.2: BaseTeams Integrity Guardrail
  // Check FIRST before any other seed logic — detect entitlementIds-only corruption
  // ============================================================
  log('[seed] checking baseTeams integrity (Phase 16.2 guardrail)...');
  const integrityCheck = await checkBaseTeamsIntegrity();

  if (integrityCheck.healthy) {
    log(`[seed] baseTeams integrity OK — ${integrityCheck.reason}`);
  } else {
    log(`[seed] ⚠️  baseTeams integrity FAILED: ${integrityCheck.reason}`);
    // Auto-repair: reseed full baseTeams + patch entitlementIds
    await repairBaseTeams();
  }
  // ============================================================

  const expectedEntitlements = getExpectedEntitlementCount();
  log(
    `[seed] expected entitlement count: ${expectedEntitlements} (from ${ENTITLEMENTS_JSON_PATH})`
  );

  const expectedPickRules = getExpectedPickRulesCount();
  log(
    `[seed] expected base pick rules count: ${expectedPickRules} (from ${PICK_LEDGER_JSON_PATH})`
  );

  const initial = await checkSeedState();
  const entitlementsReady = initial.entitlementsCount === expectedEntitlements;
  const teamsReady =
    initial.teamsCount === REQUIRED_TEAMS &&
    initial.teamsWithEntitlements === REQUIRED_TEAMS;
  const basePlayersReady = initial.basePlayersCount > 0;
  const playersV2Ready = initial.playersV2Count > 0;
  // Use threshold-based check: if we have at least MIN_PICK_RULES_THRESHOLD, consider it ready
  // This handles edge cases where exact count might vary slightly
  const basePickRulesReady =
    initial.basePickRulesCount >= MIN_PICK_RULES_THRESHOLD;

  if (entitlementsReady) {
    log(
      `[seed] base entitlements present (${expectedEntitlements}) — skipping`
    );
  } else {
    log('[seed] base entitlements missing — seeding required');
  }

  if (teamsReady) {
    log(
      `[seed] base teams entitlementIds present (${REQUIRED_TEAMS}/${REQUIRED_TEAMS}) — skipping`
    );
  } else {
    log('[seed] base team entitlementIds missing — seeding required');
  }

  if (basePlayersReady) {
    log('[seed] architect_basePlayers present — skipping seed');
  } else {
    log('[seed] architect_basePlayers missing — seeding required');
  }

  if (playersV2Ready) {
    log('[seed] players_v2 present — skipping seed');
  } else {
    log('[seed] players_v2 missing — seeding required');
  }

  if (basePickRulesReady) {
    log(
      `[seed] base pick rules present (${initial.basePickRulesCount}) — skipping`
    );
  } else {
    log(
      `[seed] base pick rules missing or incomplete (${initial.basePickRulesCount}/${expectedPickRules}) — seeding required`
    );
  }

  const needsEntitlements = !entitlementsReady || !teamsReady;
  const needsBasePlayers = !basePlayersReady;
  const needsPlayersV2 = !playersV2Ready;
  const needsBasePickRules = !basePickRulesReady;

  if (
    !needsEntitlements &&
    !needsBasePlayers &&
    !needsPlayersV2 &&
    !needsBasePickRules
  ) {
    return;
  }

  if (needsEntitlements) {
    log(
      '[seed] base entitlements or teams missing — running PST seeding scripts...'
    );
    await runScript('pst:push:base-entitlements');
    await runScript('pst:patch:base-teams-entitlements');
  }

  if (needsBasePickRules) {
    log('[seed] base pick rules missing — running pst:push:base-pick-rules...');
    await runScript('pst:push:base-pick-rules');
  }

  if (needsBasePlayers) {
    log('[seed] seeding architect_basePlayers from staged data...');
    await runScript('emu:seed:base-players');
  }

  if (needsPlayersV2) {
    log('[seed] seeding players_v2 from staged data...');
    await runScript('emu:seed:players-v2');
  }

  // Phase 2AA: Run optionsByYear backfill safety net
  // This ensures optionsByYear is present even with stale staged data
  await runOptionsByYearBackfillIfNeeded();

  const finalState = await checkSeedState();
  if (
    needsEntitlements &&
    finalState.entitlementsCount !== expectedEntitlements
  ) {
    throw new Error(
      `[seed] base entitlements count mismatch: expected ${expectedEntitlements}, got ${finalState.entitlementsCount}\n` +
        `  Source: ${ENTITLEMENTS_JSON_PATH}`
    );
  }

  if (
    needsEntitlements &&
    (finalState.teamsCount !== REQUIRED_TEAMS ||
      finalState.teamsWithEntitlements !== REQUIRED_TEAMS)
  ) {
    throw new Error(
      `[seed] base team entitlementIds mismatch: expected ${REQUIRED_TEAMS}/${REQUIRED_TEAMS}, got ${finalState.teamsWithEntitlements}/${finalState.teamsCount}`
    );
  }

  if (needsBasePlayers && finalState.basePlayersCount === 0) {
    throw new Error(
      '[seed] architect_basePlayers still empty after seeding — check staged data and rerun'
    );
  }

  if (needsPlayersV2 && finalState.playersV2Count === 0) {
    throw new Error(
      '[seed] players_v2 still empty after seeding — check staged data and rerun'
    );
  }

  if (
    needsBasePickRules &&
    finalState.basePickRulesCount < MIN_PICK_RULES_THRESHOLD
  ) {
    throw new Error(
      `[seed] base pick rules still missing/incomplete after seeding: expected >=${MIN_PICK_RULES_THRESHOLD}, got ${finalState.basePickRulesCount}\n` +
        `  Source: ${PICK_LEDGER_JSON_PATH}`
    );
  }

  // Final integrity verification (Phase 16.2)
  const finalIntegrity = await checkBaseTeamsIntegrity();
  if (!finalIntegrity.healthy) {
    throw new Error(
      `[seed] baseTeams integrity check failed after seeding: ${finalIntegrity.reason}`
    );
  }

  log(
    '[seed] ✅ base data verified after seeding (entitlements, baseTeams, basePickRules, basePlayers, players_v2).'
  );
};

main().catch((error) => {
  process.stderr.write(`[seed] ${String(error)}\n`);
  process.exit(1);
});
