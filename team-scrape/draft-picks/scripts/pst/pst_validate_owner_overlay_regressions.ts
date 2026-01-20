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

// Core regression assertions
const REGRESSIONS: AssertionCase[] = [
  {
    pickId: 'DAL_2029_1st',
    expectedOwner: 'HOU',
    expectedSource: 'PST_DISPLAY',
    description: 'Phase 2.1 fix: DAL 2029 1st should be owned by HOU (Kyrie trade + most/second favorable mechanism)',
  },
  {
    pickId: 'PHX_2029_1st',
    expectedOwner: 'HOU',
    expectedSource: 'PST_DISPLAY',
    description: 'PHX 2029 1st should be owned by HOU (same mechanism)',
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
      console.error(`   Expected: owner=${assertion.expectedOwner}, source=${assertion.expectedSource}`);
      console.error(`   Actual:   owner=${pick.owner}, source=${pick.ownershipSource}`);
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
