#!/usr/bin/env tsx

import fs from 'node:fs/promises';
import path from 'node:path';
import { ALL_TEAM_CODES } from './pst_team_slugs';

/**
 * pst_build_base_ledger.ts
 *
 * GOAL: Produce a complete, internally consistent base pick ledger for 2026–2033.
 *
 * RULES:
 * - Exactly 480 base picks (30 teams * 8 years * 2 rounds)
 * - Default owner = originalTeam
 * - pickId = ${originalTeam}_${year}_${roundSuffix}
 */

const START_YEAR = 2026;
const END_YEAR = 2033;
const ROUNDS = [1, 2] as const;

export type BasePick = {
  pickId: string;
  originalTeam: string;
  year: number;
  round: 1 | 2;
  owner: string;
  source: 'BASE';
};

const OUTPUT_PATH = path.resolve(
  process.cwd(),
  'data/pst/pst_base_ledger_2026_2033.json'
);

async function main() {
  console.log('Building PST Base Ledger...');
  const picks: BasePick[] = [];

  for (let year = START_YEAR; year <= END_YEAR; year++) {
    for (const round of ROUNDS) {
      for (const teamCode of ALL_TEAM_CODES) {
        const roundSuffix = round === 1 ? '1st' : '2nd';
        const pickId = `${teamCode}_${year}_${roundSuffix}`;

        const pick: BasePick = {
          pickId,
          originalTeam: teamCode,
          year,
          round,
          owner: teamCode, // Default owner is original team
          source: 'BASE',
        };

        picks.push(pick);
      }
    }
  }

  // Verification
  const EXPECTED_COUNT = 30 * (END_YEAR - START_YEAR + 1) * 2; // 30 * 8 * 2 = 480
  if (picks.length !== EXPECTED_COUNT) {
    throw new Error(
      `Picks count mismatch. Expected ${EXPECTED_COUNT}, got ${picks.length}`
    );
  }

  // Ensure deterministic sort (Year -> Round -> Team)
  picks.sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    if (a.round !== b.round) return a.round - b.round;
    return a.originalTeam.localeCompare(b.originalTeam);
  });

  await fs.writeFile(OUTPUT_PATH, JSON.stringify(picks, null, 2));
  console.log(`✅ Base ledger written to ${OUTPUT_PATH}`);
  console.log(`   Count: ${picks.length}`);
}

main().catch((err) => {
  console.error('❌ Failed:', err);
  process.exit(1);
});
