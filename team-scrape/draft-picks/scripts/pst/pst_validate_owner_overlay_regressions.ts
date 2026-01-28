#!/usr/bin/env tsx
/**
 * pst_validate_owner_overlay_regressions.ts
 *
 * Regression validator for Phase 2.1 overlay fixes.
 * Asserts critical ownership outcomes after overlay application.
 */

import fs from 'node:fs/promises';
import path from 'node:path';

const LEDGER_PATH = path.resolve(
  process.cwd(),
  'data/pst/pst_pick_ledger_final_2026_2033.json'
);

interface LedgerPick {
  pickId: string;
  owner: string;
  ownershipSource: 'BASE' | 'PST_DISPLAY';
}

interface AssertionCase {
  pickId: string;
  expectedOwner: string;
  expectedSource: 'BASE' | 'PST_DISPLAY';
  description: string;
}

interface NegativeAssertion {
  pickId: string;
  notOwner: string;
  description: string;
}

// Core regression assertions
const REGRESSIONS: AssertionCase[] = [
  // CHI_2026_2nd is legitimately owned by HOU (no ranked conveyance flag)
  {
    pickId: 'CHI_2026_2nd',
    expectedOwner: 'HOU',
    expectedSource: 'PST_DISPLAY',
    description:
      'CHI 2026 2nd owned by HOU (legitimate - no ranked conveyance)',
  },
  // Note: DAL_2029_1st and PHX_2029_1st were previously asserted as HOU-owned,
  // but ALL overlay claims for these picks have mentionsLeastMostFavorable=true
  // (they're part of a ranked conveyance mechanism - "most/second favorable"),
  // so they correctly fall back to BASE ownership with owner=originalTeam.
  // This is the expected behavior until standings resolve.
];

// Negative assertions: ensure these picks are NOT owned by HOU
// These were incorrectly assigned to HOU before the ranked conveyance gate fix
const NEGATIVE_ASSERTIONS: NegativeAssertion[] = [
  {
    pickId: 'DAL_2026_2nd',
    notOwner: 'HOU',
    description:
      'DAL 2026 2nd should NOT be owned by HOU (ranked conveyance - second-least favorable of PHI/DAL/OKC)',
  },
  {
    pickId: 'IND_2026_2nd',
    notOwner: 'HOU',
    description:
      'IND 2026 2nd should NOT be owned by HOU (ranked conveyance - more favorable of MIA/IND)',
  },
  {
    pickId: 'LAC_2026_2nd',
    notOwner: 'HOU',
    description:
      'LAC 2026 2nd should NOT be owned by HOU (ranked conveyance - most favorable of BOS/MIA/IND)',
  },
  {
    pickId: 'MIA_2026_2nd',
    notOwner: 'HOU',
    description:
      'MIA 2026 2nd should NOT be owned by HOU (ranked conveyance - most favorable of BOS/MIA/IND)',
  },
  {
    pickId: 'PHI_2026_2nd',
    notOwner: 'HOU',
    description:
      'PHI 2026 2nd should NOT be owned by HOU (ranked conveyance - second-least favorable of PHI/DAL/OKC)',
  },
];

interface LedgerFile {
  meta: { years: number[]; generatedAt: string; totalPicks: number };
  picks: LedgerPick[];
}

async function main() {
  console.log('PST Owner Overlay Regression Validator');
  console.log('======================================\n');

  // Load ledger
  let ledger: LedgerPick[];
  try {
    const raw = await fs.readFile(LEDGER_PATH, 'utf-8');
    const ledgerFile = JSON.parse(raw) as LedgerFile;
    ledger = ledgerFile.picks;
  } catch (err) {
    console.error(`❌ FAIL: Could not load ledger from ${LEDGER_PATH}`);
    console.error(err);
    process.exit(1);
  }

  const pickMap = new Map<string, LedgerPick>();
  for (const pick of ledger) {
    pickMap.set(pick.pickId, pick);
  }

  let passed = 0;
  let failed = 0;

  console.log('Positive Assertions (expected owner):');
  console.log('--------------------------------------');
  for (const assertion of REGRESSIONS) {
    const pick = pickMap.get(assertion.pickId);

    if (!pick) {
      console.error(`❌ FAIL: ${assertion.pickId} not found in ledger!`);
      console.error(`   → ${assertion.description}`);
      failed++;
      continue;
    }

    const ownerMatch = pick.owner === assertion.expectedOwner;
    const sourceMatch = pick.ownershipSource === assertion.expectedSource;

    if (ownerMatch && sourceMatch) {
      console.log(`✅ PASS: ${assertion.pickId}`);
      console.log(`   owner=${pick.owner}, source=${pick.ownershipSource}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${assertion.pickId}`);
      console.error(`   → ${assertion.description}`);
      console.error(
        `   Expected: owner=${assertion.expectedOwner}, source=${assertion.expectedSource}`
      );
      console.error(
        `   Actual:   owner=${pick.owner}, source=${pick.ownershipSource}`
      );
      failed++;
    }
  }

  console.log('\nNegative Assertions (must NOT be this owner):');
  console.log('----------------------------------------------');
  for (const assertion of NEGATIVE_ASSERTIONS) {
    const pick = pickMap.get(assertion.pickId);

    if (!pick) {
      console.error(`❌ FAIL: ${assertion.pickId} not found in ledger!`);
      console.error(`   → ${assertion.description}`);
      failed++;
      continue;
    }

    if (pick.owner !== assertion.notOwner) {
      console.log(`✅ PASS: ${assertion.pickId}`);
      console.log(
        `   owner=${pick.owner} (correctly NOT ${assertion.notOwner})`
      );
      passed++;
    } else {
      console.error(`❌ FAIL: ${assertion.pickId}`);
      console.error(`   → ${assertion.description}`);
      console.error(`   Expected: owner != ${assertion.notOwner}`);
      console.error(`   Actual:   owner=${pick.owner} (WRONG!)`);
      failed++;
    }
  }

  console.log('\n--------------------------------------');
  console.log(`Total: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    console.error('\n❌ REGRESSIONS DETECTED!');
    process.exit(1);
  }

  console.log('\n✅ All regression checks passed!');
  process.exit(0);
}

main();
