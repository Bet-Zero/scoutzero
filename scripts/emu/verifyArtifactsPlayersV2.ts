#!/usr/bin/env tsx
/**
 * FILE: scripts/emu/verifyArtifactsPlayersV2.ts
 * PURPOSE: Verify staged players_v2 artifacts have optionsByYear where applicable.
 *          Phase 2AE - Upstream Emulator-Only Data Into Pipeline Artifacts
 * OWNERSHIP: Tooling: artifact verification
 *
 * USAGE:
 *   npx tsx scripts/emu/verifyArtifactsPlayersV2.ts
 *
 * EXIT CODES:
 *   0 - All verifications passed
 *   1 - Verification failed (missing optionsByYear on players with options)
 *
 * HISTORY:
 *  - 2026-02-04: Created for Phase 2AE
 */

import fs from 'node:fs/promises';
import path from 'node:path';

const PLAYERS_V2_DIR = path.resolve(
  'player-scrape/firestore_staging/_artifacts/output/players_v2'
);

// Sample players known to have contract options (from prior analysis)
const SAMPLE_PLAYERS_WITH_OPTIONS = [
  'aaron_gordon', // PO in contract
  'lebron_james', // Known option holder
  'stephen_curry', // Known option holder
  'nikola_jokic', // Known option holder
  'luka_doncic', // Known option holder
];

interface PlayersV2Artifact {
  doc?: {
    currentContractView?: {
      salaryByYear?: Record<string, number>;
      optionsByYear?: Record<string, string>;
      options?: string[];
    };
  };
  contracts?: Record<
    string,
    {
      salariesByYear?: Array<{
        season?: string;
        option?: string;
      }>;
    }
  >;
}

interface VerificationResult {
  totalFiles: number;
  filesWithOptionsInContract: number;
  filesWithOptionsByYear: number;
  missingOptionsByYear: string[];
  sampleChecks: {
    playerId: string;
    hasOptionsByYear: boolean;
    optionsByYear?: Record<string, string>;
    contractOptions?: string[];
  }[];
}

function hasContractOptions(artifact: PlayersV2Artifact): boolean {
  // Check contracts subcollection for option types
  if (artifact.contracts) {
    for (const contract of Object.values(artifact.contracts)) {
      if (contract.salariesByYear) {
        for (const salary of contract.salariesByYear) {
          if (
            salary.option &&
            ['PO', 'TO', 'ETO'].includes(salary.option)
          ) {
            return true;
          }
        }
      }
    }
  }
  // Also check main doc options array
  const options = artifact.doc?.currentContractView?.options;
  if (options && options.length > 0) {
    return options.some((o) => ['PO', 'TO', 'ETO'].includes(o));
  }
  return false;
}

async function verify(): Promise<VerificationResult> {
  let files: string[];
  try {
    files = (await fs.readdir(PLAYERS_V2_DIR)).filter((f) =>
      f.endsWith('.json')
    );
  } catch (err) {
    console.error(`\n  ERROR: Cannot read directory ${PLAYERS_V2_DIR}`);
    console.error(`  ${err}`);
    process.exit(1);
  }

  const result: VerificationResult = {
    totalFiles: files.length,
    filesWithOptionsInContract: 0,
    filesWithOptionsByYear: 0,
    missingOptionsByYear: [],
    sampleChecks: [],
  };

  for (const file of files) {
    const playerId = file.replace('.json', '');
    const filePath = path.join(PLAYERS_V2_DIR, file);

    let content: PlayersV2Artifact;
    try {
      content = JSON.parse(await fs.readFile(filePath, 'utf8'));
    } catch (err) {
      console.warn(`  Warning: Could not parse ${file}: ${err}`);
      continue;
    }

    const hasOptions = hasContractOptions(content);

    if (hasOptions) {
      result.filesWithOptionsInContract++;

      const optionsByYear = content.doc?.currentContractView?.optionsByYear;
      if (optionsByYear && Object.keys(optionsByYear).length > 0) {
        result.filesWithOptionsByYear++;
      } else {
        result.missingOptionsByYear.push(playerId);
      }
    }

    // Sample checks for known option holders
    if (SAMPLE_PLAYERS_WITH_OPTIONS.includes(playerId)) {
      result.sampleChecks.push({
        playerId,
        hasOptionsByYear: !!(
          content.doc?.currentContractView?.optionsByYear &&
          Object.keys(content.doc.currentContractView.optionsByYear).length > 0
        ),
        optionsByYear: content.doc?.currentContractView?.optionsByYear,
        contractOptions: content.doc?.currentContractView?.options,
      });
    }
  }

  return result;
}

async function main() {
  console.log('\n='.repeat(60));
  console.log(' Phase 2AE: Verify players_v2 artifacts for optionsByYear');
  console.log('='.repeat(60));
  console.log(`\n  Source: ${PLAYERS_V2_DIR}\n`);

  const result = await verify();

  console.log('  RESULTS:');
  console.log(`    Total player files:         ${result.totalFiles}`);
  console.log(
    `    Players with options:       ${result.filesWithOptionsInContract}`
  );
  console.log(
    `    Players with optionsByYear: ${result.filesWithOptionsByYear}`
  );
  console.log(
    `    Missing optionsByYear:      ${result.missingOptionsByYear.length}`
  );

  if (
    result.missingOptionsByYear.length > 0 &&
    result.missingOptionsByYear.length <= 20
  ) {
    console.log(
      `\n    Missing: ${result.missingOptionsByYear.slice(0, 20).join(', ')}`
    );
    if (result.missingOptionsByYear.length > 20) {
      console.log(
        `    ... and ${result.missingOptionsByYear.length - 20} more`
      );
    }
  }

  console.log('\n  SAMPLE CHECKS:');
  for (const check of result.sampleChecks) {
    const status = check.hasOptionsByYear ? ' PASS' : ' FAIL';
    const optionsStr = check.optionsByYear
      ? JSON.stringify(check.optionsByYear)
      : '(none)';
    console.log(`    ${status} ${check.playerId}: optionsByYear=${optionsStr}`);
    if (check.contractOptions) {
      console.log(`          contractOptions: ${check.contractOptions.join(', ')}`);
    }
  }

  // Determine pass/fail
  // We pass if ALL players with options have optionsByYear populated
  const coverage =
    result.filesWithOptionsInContract === 0
      ? 100
      : (result.filesWithOptionsByYear / result.filesWithOptionsInContract) * 100;

  const success =
    result.filesWithOptionsInContract === result.filesWithOptionsByYear;

  console.log('\n' + '='.repeat(60));
  if (success) {
    console.log(
      ` PASS: optionsByYear coverage ${coverage.toFixed(1)}% (${result.filesWithOptionsByYear}/${result.filesWithOptionsInContract})`
    );
  } else {
    console.log(
      ` FAIL: optionsByYear coverage ${coverage.toFixed(1)}% (${result.filesWithOptionsByYear}/${result.filesWithOptionsInContract})`
    );
    console.log(
      `       ${result.missingOptionsByYear.length} players with options are missing optionsByYear`
    );
  }
  console.log('='.repeat(60) + '\n');

  process.exit(success ? 0 : 1);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
