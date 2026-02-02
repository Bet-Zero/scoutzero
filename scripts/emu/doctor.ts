/**
 * FILE: scripts/emu/doctor.ts
 * PURPOSE: Diagnostic command to check emulator state and baseTeams integrity.
 * OWNERSHIP: Tooling: local emulator workflow
 *
 * HISTORY:
 *  - 2026-02-01: Created for Phase 16.2 - BaseTeams Integrity Guardrail
 *
 * LINKS:
 *  - Return Package: docs/team-scrape/return_packages/PST_EMULATOR_BASETEAMS_INTEGRITY_GUARDRAIL_EXECUTION_RETURN_PACKAGE.md
 *
 * USAGE:
 *   npm run emu:doctor
 *   (Requires emulator to be running: FIRESTORE_EMULATOR_HOST must be set)
 */

import { initAdminEmu, getEmulatorProjectId } from './adminEmu.js';

/**
 * Sample teams for integrity checks (deterministic).
 * Same as seedIfMissing.ts
 */
const SAMPLE_TEAMS_FOR_INTEGRITY = ['LAL', 'BOS', 'HOU'];

const log = (message: string) => {
  process.stdout.write(`${message}\n`);
};

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

const checkBaseTeamsIntegrity = async (
  db: FirebaseFirestore.Firestore
): Promise<BaseTeamsIntegrityResult> => {
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
  const entitlementOnlyDocs = details.filter((d) => d.isEntitlementIdOnly);
  const corruptDocs = details.filter(
    (d) => d.hasTeamCode && (!d.hasTeamName || !d.hasRoster)
  );

  if (details.some((d) => !d.hasTeamCode && !d.hasTeamName && !d.hasRoster)) {
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

const main = async () => {
  log('');
  log('═══════════════════════════════════════════════════════════════════');
  log('  🩺 EMULATOR DOCTOR — Diagnostic Report');
  log('═══════════════════════════════════════════════════════════════════');
  log('');

  // Environment check
  const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST;
  const projectId = getEmulatorProjectId();

  log(`📍 FIRESTORE_EMULATOR_HOST: ${emulatorHost ?? '(not set)'}`);
  log(`📍 projectId: ${projectId}`);
  log('');

  if (!emulatorHost) {
    log('❌ FIRESTORE_EMULATOR_HOST is not set.');
    log('   Run this command while emulators are running:');
    log('   FIRESTORE_EMULATOR_HOST=127.0.0.1:8082 npm run emu:doctor');
    log('');
    log('═══════════════════════════════════════════════════════════════════');
    log('  RESULT: ❌ CANNOT CONNECT');
    log('═══════════════════════════════════════════════════════════════════');
    process.exit(1);
  }

  const { db } = initAdminEmu();

  // Collection counts
  log('📊 Collection Counts:');
  const [
    baseTeamsSnap,
    baseEntitlementsSnap,
    basePickRulesSnap,
    basePlayersSnap,
    playersV2Snap,
  ] = await Promise.all([
    db.collection('architect_baseTeams').get(),
    db.collection('architect_baseEntitlements').get(),
    db.collection('architect_basePickRules').get(),
    db.collection('architect_basePlayers').limit(1).get(),
    db.collection('players_v2').limit(1).get(),
  ]);

  log(`   architect_baseTeams:        ${baseTeamsSnap.size}`);
  log(`   architect_baseEntitlements: ${baseEntitlementsSnap.size}`);
  log(`   architect_basePickRules:    ${basePickRulesSnap.size}`);
  log(
    `   architect_basePlayers:      ${basePlayersSnap.size > 0 ? '✅ present' : '❌ empty'}`
  );
  log(
    `   players_v2:                 ${playersV2Snap.size > 0 ? '✅ present' : '❌ empty'}`
  );
  log('');

  // BaseTeams integrity check
  log('🔍 BaseTeams Integrity Check (Phase 16.2):');
  const integrity = await checkBaseTeamsIntegrity(db);

  for (const detail of integrity.details) {
    const status = detail.isEntitlementIdOnly
      ? '⚠️  ENTITLEMENT-ONLY'
      : detail.hasRoster
        ? '✅'
        : '❌';
    log(
      `   ${detail.teamCode}: ${status} (roster=${detail.rosterLength}, entitlementIds=${detail.hasEntitlementIds ? 'yes' : 'no'})`
    );
  }
  log('');

  log(`   baseTeamsHealthy: ${integrity.healthy ? '✅ true' : '❌ false'}`);
  log(`   reason: ${integrity.reason}`);
  log('');

  // Final verdict
  log('═══════════════════════════════════════════════════════════════════');
  if (integrity.healthy && baseTeamsSnap.size === 30) {
    log('  RESULT: ✅ OK — Emulator data is healthy');
  } else {
    log(
      '  RESULT: ❌ NEEDS REPAIR — Run `npm run emu:repair:teams` or restart emulator'
    );
    if (!integrity.healthy) {
      log(`  Issue: ${integrity.reason}`);
    }
    if (baseTeamsSnap.size !== 30) {
      log(`  Issue: baseTeams count ${baseTeamsSnap.size} !== 30`);
    }
  }
  log('═══════════════════════════════════════════════════════════════════');
  log('');

  process.exit(integrity.healthy && baseTeamsSnap.size === 30 ? 0 : 1);
};

main().catch((error) => {
  process.stderr.write(`[doctor] ${String(error)}\n`);
  process.exit(1);
});
