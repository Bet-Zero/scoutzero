/**
 * FILE: scripts/emu/repairTeams.ts
 * PURPOSE: Repair architect_baseTeams in emulator by reseeding and verifying full data.
 * OWNERSHIP: Tooling: local emulator workflow
 *
 * HISTORY:
 *  - 2026-01-30: Created to fix projectId mismatch and add verification
 *
 * LINKS:
 *  - Return package: docs/team-scrape/return_packages/PST_EMULATOR_BASETEAMS_PROJECTID_FIX_RETURN_PACKAGE.md
 */

import { spawn } from 'node:child_process';
import { initAdminEmu } from './adminEmu.js';

const log = (message: string) => {
  process.stdout.write(`${message}\n`);
};

const runScript = async (script: string): Promise<void> =>
  new Promise<void>((resolve, reject) => {
    log(`[repair] Running: npm run ${script}`);
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

interface TeamDoc {
  teamCode?: string;
  teamName?: string;
  roster?: string[];
  entitlementIds?: string[];
  [key: string]: unknown;
}

const verifyBaseTeams = async (
  db: FirebaseFirestore.Firestore
): Promise<{ valid: boolean; issues: string[] }> => {
  const issues: string[] = [];

  // Read LAL as a canary document
  const lalRef = db.collection('architect_baseTeams').doc('LAL');
  const lalSnap = await lalRef.get();

  if (!lalSnap.exists) {
    issues.push('LAL document does not exist');
    return { valid: false, issues };
  }

  const lalData = lalSnap.data() as TeamDoc;

  // Check for required fields
  const requiredFields = ['teamCode', 'teamName'];
  const missingFields: string[] = [];

  for (const field of requiredFields) {
    if (!lalData[field]) {
      missingFields.push(field);
    }
  }

  // Check for roster field (might be 'roster' or 'players' depending on schema)
  const hasRosterField = 'roster' in lalData || 'players' in lalData;
  if (!hasRosterField) {
    missingFields.push('roster/players');
  }

  if (missingFields.length > 0) {
    issues.push(`LAL missing fields: ${missingFields.join(', ')}`);
  }

  // Additional check: ensure it's not just entitlementIds
  const keys = Object.keys(lalData);
  if (keys.length <= 1 && keys[0] === 'entitlementIds') {
    issues.push(
      'LAL only contains entitlementIds - full data was not restored'
    );
  }

  return { valid: issues.length === 0, issues };
};

const main = async () => {
  log('[repair] === REPAIR ARCHITECT_BASETEAMS ===');

  // Initialize admin and validate emulator env
  const { db, projectId } = initAdminEmu();
  log(`[repair] projectId: ${projectId}`);

  // Step 1: Reseed baseTeams from staged JSON
  log('[repair] Step 1: Reseeding baseTeams from staged JSON...');
  await runScript('emu:reseed:baseTeams');

  // Step 2: Patch entitlementIds onto baseTeams
  log('[repair] Step 2: Patching entitlementIds onto baseTeams...');
  await runScript('pst:patch:base-teams-entitlements');

  // Step 3: Verify final state
  log('[repair] Step 3: Verifying final state...');
  const verification = await verifyBaseTeams(db);

  if (!verification.valid) {
    log('[repair] ❌ Verification FAILED:');
    for (const issue of verification.issues) {
      log(`  - ${issue}`);
    }
    process.exit(1);
  }

  log('[repair] ✅ Verified LAL has teamName + roster fields');
  log('');
  log('=== REPAIR COMPLETE ===');
  log('[repair] ✅ architect_baseTeams restored with full data');
};

main().catch((error) => {
  process.stderr.write(`[repair] ${String(error)}\n`);
  process.exit(1);
});
