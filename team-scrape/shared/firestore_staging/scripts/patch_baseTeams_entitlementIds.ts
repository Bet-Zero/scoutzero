#!/usr/bin/env tsx
/**
 * FILE: team-scrape/shared/firestore_staging/scripts/patch_baseTeams_entitlementIds.ts
 * PURPOSE: Patch staged baseTeams JSON artifacts with entitlementIds from PST entitlements data.
 *          This makes entitlementIds available at seeding time without runtime patching.
 *          Phase 2AE - Upstream Emulator-Only Data Into Pipeline Artifacts
 * OWNERSHIP: Tooling: staging pipeline
 *
 * USAGE:
 *   DRY RUN:  npx tsx team-scrape/shared/firestore_staging/scripts/patch_baseTeams_entitlementIds.ts
 *   WRITE:    npx tsx team-scrape/shared/firestore_staging/scripts/patch_baseTeams_entitlementIds.ts --write
 *
 * IDEMPOTENT: Safe to re-run. Will overwrite existing entitlementIds with current data.
 *
 * HISTORY:
 *  - 2026-02-04: Created for Phase 2AE - Upstream Emulator-Only Data Into Pipeline Artifacts
 */

import { readFile, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const PROJECT_ROOT = path.resolve(import.meta.dirname, '../../../..');
const ENTITLEMENTS_BY_TEAM_PATH = path.join(
  PROJECT_ROOT,
  'data/pst/pst_entitlements_by_team_2026_2033.json'
);
const BASE_TEAMS_ARTIFACT_DIR = path.join(
  PROJECT_ROOT,
  'team-scrape/shared/firestore_staging/_artifacts/output/baseTeams'
);

type EntitlementAsset = {
  id: string;
  holderTeam: string;
  [key: string]: unknown;
};

type EntitlementsByTeam = Record<string, EntitlementAsset[]>;

interface BaseTeamArtifact {
  teamCode?: string;
  teamName?: string;
  entitlementIds?: string[];
  [key: string]: unknown;
}

interface PatchStats {
  totalTeamsInSource: number;
  teamsPatched: number;
  teamsUnchanged: number;
  teamsNotFound: string[];
  entitlementCounts: Record<string, number>;
}

function buildEntitlementIds(assets: EntitlementAsset[]): string[] {
  const ids = assets.map((asset) => asset.id).filter(Boolean);
  return Array.from(new Set(ids)).sort();
}

async function loadJson<T>(filePath: string): Promise<T> {
  const raw = await readFile(filePath, 'utf8');
  return JSON.parse(raw) as T;
}

async function patchArtifacts(options: { write: boolean }): Promise<PatchStats> {
  const { write } = options;

  console.log('\n' + '='.repeat(60));
  console.log(' Phase 2AE: Patch baseTeams artifacts with entitlementIds');
  console.log('='.repeat(60));
  console.log(`\n  Mode:   ${write ? 'WRITE' : 'DRY RUN'}`);
  console.log(`  Source: ${ENTITLEMENTS_BY_TEAM_PATH}`);
  console.log(`  Target: ${BASE_TEAMS_ARTIFACT_DIR}\n`);

  // Load entitlements source
  let entitlementsByTeam: EntitlementsByTeam;
  try {
    entitlementsByTeam = await loadJson<EntitlementsByTeam>(
      ENTITLEMENTS_BY_TEAM_PATH
    );
  } catch (err) {
    console.error(`  ERROR: Cannot load entitlements source`);
    console.error(`  ${err}`);
    process.exit(1);
  }

  const teamCodes = Object.keys(entitlementsByTeam).sort();

  const stats: PatchStats = {
    totalTeamsInSource: teamCodes.length,
    teamsPatched: 0,
    teamsUnchanged: 0,
    teamsNotFound: [],
    entitlementCounts: {},
  };

  // List existing artifact files
  let existingFiles: string[];
  try {
    existingFiles = (await readdir(BASE_TEAMS_ARTIFACT_DIR))
      .filter((f) => f.endsWith('.json'))
      .map((f) => f.replace('.json', ''));
  } catch (err) {
    console.error(`  ERROR: Cannot read artifact directory`);
    console.error(`  ${err}`);
    process.exit(1);
  }

  console.log(`  Processing ${teamCodes.length} teams...\n`);

  for (const teamCode of teamCodes) {
    const artifactPath = path.join(BASE_TEAMS_ARTIFACT_DIR, `${teamCode}.json`);

    // Check if artifact exists
    if (!existingFiles.includes(teamCode)) {
      stats.teamsNotFound.push(teamCode);
      console.log(`    SKIP ${teamCode}: artifact not found`);
      continue;
    }

    // Load existing artifact
    let artifact: BaseTeamArtifact;
    try {
      artifact = await loadJson<BaseTeamArtifact>(artifactPath);
    } catch (err) {
      console.warn(`    WARN ${teamCode}: could not parse artifact - ${err}`);
      stats.teamsNotFound.push(teamCode);
      continue;
    }

    // Build entitlementIds
    const entitlements = entitlementsByTeam[teamCode] || [];
    const entitlementIds = buildEntitlementIds(entitlements);
    stats.entitlementCounts[teamCode] = entitlementIds.length;

    // Check if already has same entitlementIds (idempotency check)
    const existingIds = artifact.entitlementIds;
    const existingIdsStr = JSON.stringify(existingIds?.slice().sort() ?? []);
    const newIdsStr = JSON.stringify(entitlementIds);

    if (existingIdsStr === newIdsStr) {
      stats.teamsUnchanged++;
      continue;
    }

    // Patch artifact
    artifact.entitlementIds = entitlementIds;

    if (write) {
      await writeFile(artifactPath, JSON.stringify(artifact, null, 2), 'utf8');
      console.log(`    WRITE ${teamCode}: ${entitlementIds.length} entitlementIds`);
    } else {
      console.log(
        `    WOULD ${teamCode}: ${entitlementIds.length} entitlementIds`
      );
    }

    stats.teamsPatched++;
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log(' PATCH SUMMARY');
  console.log('='.repeat(60));
  console.log(`  Total teams in source:  ${stats.totalTeamsInSource}`);
  console.log(`  Teams patched:          ${stats.teamsPatched}`);
  console.log(`  Teams unchanged:        ${stats.teamsUnchanged}`);
  console.log(`  Teams not found:        ${stats.teamsNotFound.length}`);

  if (stats.teamsNotFound.length > 0) {
    console.log(`    Missing: ${stats.teamsNotFound.join(', ')}`);
  }

  console.log('='.repeat(60));

  if (!write) {
    console.log('\n  DRY RUN - No changes written');
    console.log('  Run with --write to apply changes\n');
  } else {
    console.log(`\n  Successfully patched ${stats.teamsPatched} team artifact(s)\n`);
  }

  return stats;
}

// CLI
async function main() {
  const args = process.argv.slice(2);
  const write = args.includes('--write');

  try {
    const stats = await patchArtifacts({ write });

    // Exit with error if no teams were patched and some were expected
    if (stats.teamsPatched === 0 && stats.teamsUnchanged === 0) {
      process.exit(1);
    }

    process.exit(0);
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

main();
