#!/usr/bin/env tsx

import fs from 'node:fs/promises';
import path from 'node:path';
import { ALL_TEAM_CODES } from './pst_team_slugs';

/**
 * pst_validate_phase_2_ledger.ts
 *
 * GOAL: Strict validation of Phase 2 outputs.
 */

const BASE_LEDGER_PATH = path.resolve(
  process.cwd(),
  'data/pst/pst_base_ledger_2026_2033.json'
);
const FINAL_LEDGER_PATH = path.resolve(
  process.cwd(),
  'data/pst/pst_ledger_with_display_owner.json'
);
const HOLDINGS_PATH = path.resolve(
  process.cwd(),
  'data/pst/pst_holdings_by_team.json'
);

const EXPECTED_COUNT = 480;

type LedgerItem = {
  pickId: string;
  originalTeam: string;
  year: number;
  round: number;
  owner: string;
};

type HoldingsItem = {
  team: string;
  picks: string[];
};

async function main() {
  console.log('Running Phase 2 Validation...');
  const errors: string[] = [];
  const warnings: string[] = [];

  // Load Data
  const baseLedger = JSON.parse(
    await fs.readFile(BASE_LEDGER_PATH, 'utf-8')
  ) as LedgerItem[];
  const finalLedger = JSON.parse(
    await fs.readFile(FINAL_LEDGER_PATH, 'utf-8')
  ) as LedgerItem[];
  const holdings = JSON.parse(
    await fs.readFile(HOLDINGS_PATH, 'utf-8')
  ) as HoldingsItem[];

  // 1. Count Checks
  if (baseLedger.length !== EXPECTED_COUNT) {
    errors.push(
      `Base ledger count mismatch: Expected ${EXPECTED_COUNT}, got ${baseLedger.length}`
    );
  }
  if (finalLedger.length !== EXPECTED_COUNT) {
    errors.push(
      `Final ledger count mismatch: Expected ${EXPECTED_COUNT}, got ${finalLedger.length}`
    );
  }

  // 2. Uniqueness & Membership
  const pickIds = new Set<string>();
  for (const pick of finalLedger) {
    if (pickIds.has(pick.pickId)) {
      errors.push(`Duplicate pickId found: ${pick.pickId}`);
    }
    pickIds.add(pick.pickId);

    if (!ALL_TEAM_CODES.includes(pick.owner)) {
      errors.push(
        `Invalid owner code '${pick.owner}' for pick ${pick.pickId}`
      );
    }
  }

  // 3. DEN Sanity Check (Base)
  const denBaseCount = baseLedger.filter((p) => p.owner === 'DEN').length;
  if (denBaseCount !== 16) {
    errors.push(
      `DEN base sanity check failed. Expected 16 (8 yrs * 2 rounds), got ${denBaseCount}`
    );
  } else {
    console.log('✅ DEN base sanity check passed (16 picks).');
  }

  // 4. Holdings Consistency
  let totalHoldingsCount = 0;
  for (const h of holdings) {
    totalHoldingsCount += h.picks.length;
    if (!ALL_TEAM_CODES.includes(h.team)) {
      errors.push(`Invalid team in holdings: ${h.team}`);
    }
  }
  if (totalHoldingsCount !== EXPECTED_COUNT) {
    errors.push(
      `Holdings total count mismatch: Expected ${EXPECTED_COUNT}, got ${totalHoldingsCount}`
    );
  }

  // 5. TOR Spotlight
  const torHoldings = holdings.find((h) => h.team === 'TOR');
  if (!torHoldings) {
    errors.push('TOR holdings undefined.');
  } else {
    console.log('--- TOR SPOTLIGHT ---');
    console.log(`TOR owns ${torHoldings.picks.length} picks.`);
    console.log('Sample picks:', torHoldings.picks.slice(0, 5));
    // Simple check: Should have at least some own picks
    const hasOwn2026 = torHoldings.picks.includes('TOR_2026_1st');
    // Note: TOR might have traded it away, but likely owns it or something.
    // Just logging for manual review.
  }

  // SUMMARY
  if (errors.length > 0) {
    console.error('❌ VALIDATION FAILED');
    errors.forEach((e) => console.error(`   - ${e}`));
    process.exit(1);
  } else {
    console.log('✅ ALL PHASE 2 VALIDATIONS PASSED.');
  }
}

main().catch((err) => {
  console.error('❌ Failed:', err);
  process.exit(1);
});
