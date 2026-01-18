#!/usr/bin/env tsx
/**
 * FILE: team-scrape/draft-picks/scripts/pst/pst_validate_swap_does_not_change_owner.ts
 * PURPOSE: Regression validator for swap-rights ownership model fix (DAL_2030_1st regression)
 * OWNERSHIP: team-scrape/pst
 *
 * HISTORY:
 *  - 2026-01-18: Created for ownership model hotfix validation
 *
 * LINKS:
 *  - Plan: Ownership Model Swap Rights Fix
 */

import fs from 'node:fs/promises';
import path from 'node:path';

const PROJECT_ROOT = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  '..',
  '..',
  '..',
  '..'
);
const DATA_DIR = path.join(PROJECT_ROOT, 'data', 'pst');

const FINAL_LEDGER_PATH = path.join(
  DATA_DIR,
  'pst_pick_ledger_final_2026_2033.json'
);
const FINAL_PROFILES_PATH = path.join(
  DATA_DIR,
  'pst_pick_rule_profiles_final_2026_2033.json'
);
const MANUAL_VIEWS_PATH = path.join(DATA_DIR, 'manual_check_views.txt');

interface FinalLedgerPick {
  pickId: string;
  year: number;
  round: 1 | 2;
  originalTeam: string;
  owner: string;
  encumbrances: {
    swaps: Array<{ controller: string; pool: string[] }>;
  };
}

interface FinalLedger {
  meta: {
    totalPicks: number;
  };
  picks: FinalLedgerPick[];
}

async function main(): Promise<void> {
  console.log('\n🔍 PST Swap Rights Ownership Model Validator');
  console.log('===========================================\n');

  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Load final ledger
  let finalLedger: FinalLedger;
  try {
    const ledgerRaw = await fs.readFile(FINAL_LEDGER_PATH, 'utf-8');
    finalLedger = JSON.parse(ledgerRaw) as FinalLedger;
    console.log(`✓ Loaded final ledger (${finalLedger.meta.totalPicks} picks)`);
  } catch (err) {
    console.error(`❌ Failed to load final ledger: ${err}`);
    process.exit(1);
  }

  // 2. Check DAL_2030_1st owner
  const dal2030 = finalLedger.picks.find((p) => p.pickId === 'DAL_2030_1st');
  if (!dal2030) {
    errors.push('DAL_2030_1st not found in final ledger');
  } else {
    console.log(`\n📋 DAL_2030_1st Details:`);
    console.log(`   Owner: ${dal2030.owner}`);
    console.log(`   Original Team: ${dal2030.originalTeam}`);
    console.log(`   Swaps: ${dal2030.encumbrances.swaps.length}`);

    // Assert owner == DAL
    if (dal2030.owner !== 'DAL') {
      errors.push(
        `DAL_2030_1st.owner == "${dal2030.owner}" (expected "DAL")`
      );
    } else {
      console.log(`   ✓ Owner is DAL (correct)`);
    }

    // Assert swap encumbrance exists with controller SAS
    const sasSwap = dal2030.encumbrances.swaps.find(
      (s) => s.controller === 'SAS'
    );
    if (!sasSwap) {
      errors.push(
        `DAL_2030_1st missing swap encumbrance with controller: SAS`
      );
    } else {
      console.log(`   ✓ Swap encumbrance with controller: SAS exists`);
      console.log(`     Pool: ${sasSwap.pool.join(', ')}`);
    }
  }

  // 3. Check manual views for DAL
  try {
    const manualViewsRaw = await fs.readFile(MANUAL_VIEWS_PATH, 'utf-8');
    const dalSection = manualViewsRaw.match(
      /#\s+DAL\s+—[^#]*?(?=#|$)/s
    );

    if (!dalSection) {
      warnings.push('DAL section not found in manual views');
    } else {
      // Look for 2030 1st line
      const has2030First =
        dalSection[0].includes('2030') &&
        dalSection[0].match(/2030\s*\|\s*1\s*\|/);

      if (!has2030First) {
        errors.push('DAL manual view missing 2030 1st round pick line');
      } else {
        console.log(`\n✓ DAL manual view includes 2030 1st line`);
        // Extract the line for display
        const lines = dalSection[0].split('\n');
        const targetLine = lines.find((l) => l.includes('2030') && l.match(/2030\s*\|\s*1\s*\|/));
        if (targetLine) {
          console.log(`   Line: ${targetLine.trim()}`);
        }
      }
    }
  } catch (err) {
    warnings.push(`Could not validate manual views: ${err}`);
  }

  // 4. Check ledger invariants
  if (finalLedger.meta.totalPicks !== 480) {
    errors.push(
      `Final ledger count == ${finalLedger.meta.totalPicks} (expected 480)`
    );
  } else {
    console.log(`\n✓ Final ledger count: 480`);
  }

  // Summary
  console.log('\n📊 Validation Summary');
  console.log('===================');

  if (errors.length > 0) {
    console.error(`\n❌ BLOCKED: ${errors.length} validation error(s):`);
    errors.forEach((e) => console.error(`   - ${e}`));
    console.error('\n❌ Swap rights ownership model fix validation FAILED');
    process.exit(1);
  }

  if (warnings.length > 0) {
    console.warn(`\n⚠️  ${warnings.length} warning(s):`);
    warnings.forEach((w) => console.warn(`   - ${w}`));
  }

  console.log('\n✅ All validations passed!');
  console.log('✅ Swap rights ownership model fix is CORRECT');
}

main().catch((err) => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
