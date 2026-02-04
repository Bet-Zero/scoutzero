#!/usr/bin/env tsx
/**
 * FILE: scripts/emu/verifyArtifactsBaseTeams.ts
 * PURPOSE: Verify staged baseTeams artifacts have entitlementIds.
 *          Phase 2AE - Upstream Emulator-Only Data Into Pipeline Artifacts
 * OWNERSHIP: Tooling: artifact verification
 *
 * USAGE:
 *   npx tsx scripts/emu/verifyArtifactsBaseTeams.ts
 *
 * EXIT CODES:
 *   0 - All verifications passed (all 30 teams have entitlementIds)
 *   1 - Verification failed
 *
 * HISTORY:
 *  - 2026-02-04: Created for Phase 2AE
 */

import fs from 'node:fs/promises';
import path from 'node:path';

const BASE_TEAMS_DIR = path.resolve(
  'team-scrape/shared/firestore_staging/_artifacts/output/baseTeams'
);
const ENTITLEMENTS_SOURCE = path.resolve(
  'data/pst/pst_entitlements_by_team_2026_2033.json'
);

const REQUIRED_TEAMS = 30;
const SAMPLE_TEAMS = ['ATL', 'BOS', 'HOU', 'LAL', 'GSW'];

interface BaseTeamArtifact {
  teamCode?: string;
  teamName?: string;
  entitlementIds?: string[];
  [key: string]: unknown;
}

interface EntitlementAsset {
  id: string;
  holderTeam: string;
  [key: string]: unknown;
}

type EntitlementsByTeam = Record<string, EntitlementAsset[]>;

interface VerificationResult {
  totalArtifacts: number;
  artifactsWithEntitlementIds: number;
  missingEntitlementIds: string[];
  emptyEntitlementIds: string[];
  sampleChecks: {
    teamCode: string;
    count: number;
    expectedCount: number;
    match: boolean;
  }[];
}

async function verify(): Promise<VerificationResult> {
  let files: string[];
  try {
    files = (await fs.readdir(BASE_TEAMS_DIR)).filter((f) =>
      f.endsWith('.json')
    );
  } catch (err) {
    console.error(`\n  ERROR: Cannot read directory ${BASE_TEAMS_DIR}`);
    console.error(`  ${err}`);
    process.exit(1);
  }

  let entitlementsByTeam: EntitlementsByTeam = {};
  try {
    entitlementsByTeam = JSON.parse(
      await fs.readFile(ENTITLEMENTS_SOURCE, 'utf8')
    );
  } catch (err) {
    console.error(`\n  ERROR: Cannot read entitlements source ${ENTITLEMENTS_SOURCE}`);
    console.error(`  ${err}`);
    process.exit(1);
  }

  const result: VerificationResult = {
    totalArtifacts: files.length,
    artifactsWithEntitlementIds: 0,
    missingEntitlementIds: [],
    emptyEntitlementIds: [],
    sampleChecks: [],
  };

  for (const file of files) {
    const teamCode = file.replace('.json', '');
    const filePath = path.join(BASE_TEAMS_DIR, file);

    let content: BaseTeamArtifact;
    try {
      content = JSON.parse(await fs.readFile(filePath, 'utf8'));
    } catch (err) {
      console.warn(`  Warning: Could not parse ${file}: ${err}`);
      continue;
    }

    const entitlementIds = content.entitlementIds;
    const expectedAssets = entitlementsByTeam[teamCode] || [];
    const expectedCount = expectedAssets.length;

    if (!entitlementIds) {
      result.missingEntitlementIds.push(teamCode);
    } else if (entitlementIds.length === 0 && expectedCount > 0) {
      result.emptyEntitlementIds.push(teamCode);
    } else {
      result.artifactsWithEntitlementIds++;
    }

    // Sample checks
    if (SAMPLE_TEAMS.includes(teamCode)) {
      result.sampleChecks.push({
        teamCode,
        count: entitlementIds?.length ?? 0,
        expectedCount,
        match: (entitlementIds?.length ?? 0) === expectedCount,
      });
    }
  }

  return result;
}

async function main() {
  console.log('\n='.repeat(60));
  console.log(' Phase 2AE: Verify baseTeams artifacts for entitlementIds');
  console.log('='.repeat(60));
  console.log(`\n  Source:      ${BASE_TEAMS_DIR}`);
  console.log(`  Entitlements: ${ENTITLEMENTS_SOURCE}\n`);

  const result = await verify();

  console.log('  RESULTS:');
  console.log(`    Total team artifacts:         ${result.totalArtifacts}`);
  console.log(`    With entitlementIds:          ${result.artifactsWithEntitlementIds}`);
  console.log(`    Missing entitlementIds field: ${result.missingEntitlementIds.length}`);
  console.log(`    Empty entitlementIds:         ${result.emptyEntitlementIds.length}`);

  if (result.missingEntitlementIds.length > 0) {
    console.log(`\n    Missing field: ${result.missingEntitlementIds.join(', ')}`);
  }
  if (result.emptyEntitlementIds.length > 0) {
    console.log(`    Empty arrays:  ${result.emptyEntitlementIds.join(', ')}`);
  }

  console.log('\n  SAMPLE CHECKS:');
  for (const check of result.sampleChecks) {
    const status = check.match ? ' PASS' : ' FAIL';
    console.log(
      `    ${status} ${check.teamCode}: ${check.count} ids (expected ${check.expectedCount})`
    );
  }

  // Determine pass/fail
  const success =
    result.totalArtifacts >= REQUIRED_TEAMS &&
    result.artifactsWithEntitlementIds >= REQUIRED_TEAMS;

  console.log('\n' + '='.repeat(60));
  if (success) {
    console.log(
      ` PASS: entitlementIds coverage (${result.artifactsWithEntitlementIds}/${REQUIRED_TEAMS} teams)`
    );
  } else {
    console.log(
      ` FAIL: entitlementIds coverage (${result.artifactsWithEntitlementIds}/${REQUIRED_TEAMS} teams)`
    );
    if (result.missingEntitlementIds.length > 0) {
      console.log(
        `       ${result.missingEntitlementIds.length} teams missing entitlementIds field`
      );
    }
  }
  console.log('='.repeat(60) + '\n');

  process.exit(success ? 0 : 1);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
