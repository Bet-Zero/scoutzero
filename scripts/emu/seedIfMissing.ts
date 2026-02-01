/**
 * FILE: scripts/emu/seedIfMissing.ts
 * PURPOSE: Seed emulator data only when required base collections are missing.
 * OWNERSHIP: Tooling: local emulator workflow
 *
 * HISTORY:
 *  - 2026-01-28: Created by plan `plans/_archive/emulator-workflow-hardening/plan.md`, chunk_01
 *  - 2026-01-29: Expanded seeding coverage per plan `plans/pst-emulator-seeding/plan.md`
 *
 * LINKS:
 *  - Plan (legacy): plans/_archive/emulator-workflow-hardening/plan.md
 *  - Current Plan: plans/pst-emulator-seeding/plan.md
 *  - Latest Chunk: n/a (single-phase plan)
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { initAdminEmu } from './adminEmu.js';

const REQUIRED_TEAMS = 30;
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

const main = async () => {
  // Initialize admin and log projectId (also validates FIRESTORE_EMULATOR_HOST)
  const { projectId } = initAdminEmu();
  log(`[seed] projectId: ${projectId}`);

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

  log(
    '[seed] base data verified after seeding (entitlements, baseTeams, basePickRules, basePlayers, players_v2).'
  );
};

main().catch((error) => {
  process.stderr.write(`[seed] ${String(error)}\n`);
  process.exit(1);
});
