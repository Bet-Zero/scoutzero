// test_trade_eligibility_changes.ts — Test tradeEligibility and supersedesContractRef changes
// RUN: npx tsx player-scrape/contracts/scripts/test_trade_eligibility_changes.ts

import fs from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

interface TradeEligibility {
  canBeTradedNow: null | boolean;
  restrictedUntil: null | string;
  reason: null | string;
  rules: {
    baseYearCompensation: boolean;
    poisonPill: boolean;
    aggregation: boolean;
  };
}

async function runTests() {
  console.log('🧪 Testing Trade Eligibility and supersedesContractRef Changes\n');

  let passed = 0;
  let failed = 0;

  // Test 1: Luka Dončić - Has futureContract
  console.log('\n📋 Test 1: Luka Dončić - Player with futureContract');
  try {
    const outputPath = join(__dirname, '../../output', 'luka_doncic.json');
    const output = JSON.parse(await fs.readFile(outputPath, 'utf8'));

    let testPassed = true;

    // Check contract.tradeEligibility
    const contractTE = output.contract.tradeEligibility as TradeEligibility;
    if (contractTE.canBeTradedNow === null) {
      console.log('   ✅ contract.tradeEligibility.canBeTradedNow: null');
    } else {
      console.log(
        `   ❌ contract.tradeEligibility.canBeTradedNow: expected null, got ${contractTE.canBeTradedNow}`
      );
      testPassed = false;
    }

    if (contractTE.restrictedUntil === null) {
      console.log('   ✅ contract.tradeEligibility.restrictedUntil: null');
    } else {
      console.log(
        `   ❌ contract.tradeEligibility.restrictedUntil: expected null, got "${contractTE.restrictedUntil}"`
      );
      testPassed = false;
    }

    if (contractTE.reason === null) {
      console.log('   ✅ contract.tradeEligibility.reason: null');
    } else {
      console.log(
        `   ❌ contract.tradeEligibility.reason: expected null, got "${contractTE.reason}"`
      );
      testPassed = false;
    }

    if (
      typeof contractTE.rules.baseYearCompensation === 'boolean' &&
      typeof contractTE.rules.poisonPill === 'boolean' &&
      typeof contractTE.rules.aggregation === 'boolean'
    ) {
      console.log('   ✅ contract.tradeEligibility.rules: all booleans present');
    } else {
      console.log('   ❌ contract.tradeEligibility.rules: not all booleans');
      testPassed = false;
    }

    // Check futureContract.tradeEligibility
    if (output.futureContract) {
      const futureTE = output.futureContract.tradeEligibility as TradeEligibility;
      if (futureTE.canBeTradedNow === null) {
        console.log('   ✅ futureContract.tradeEligibility.canBeTradedNow: null');
      } else {
        console.log(
          `   ❌ futureContract.tradeEligibility.canBeTradedNow: expected null, got ${futureTE.canBeTradedNow}`
        );
        testPassed = false;
      }

      if (futureTE.restrictedUntil === null) {
        console.log('   ✅ futureContract.tradeEligibility.restrictedUntil: null');
      } else {
        console.log(
          `   ❌ futureContract.tradeEligibility.restrictedUntil: expected null, got "${futureTE.restrictedUntil}"`
        );
        testPassed = false;
      }

      if (futureTE.reason === null) {
        console.log('   ✅ futureContract.tradeEligibility.reason: null');
      } else {
        console.log(
          `   ❌ futureContract.tradeEligibility.reason: expected null, got "${futureTE.reason}"`
        );
        testPassed = false;
      }

      // Check futureContract.supersedesContractRef
      if (output.futureContract.supersedesContractRef) {
        const expectedRef = output.contract.contractType;
        if (output.futureContract.supersedesContractRef === expectedRef) {
          console.log(
            `   ✅ futureContract.supersedesContractRef: "${output.futureContract.supersedesContractRef}"`
          );
        } else {
          console.log(
            `   ❌ futureContract.supersedesContractRef: expected "${expectedRef}", got "${output.futureContract.supersedesContractRef}"`
          );
          testPassed = false;
        }
      } else {
        console.log('   ❌ futureContract.supersedesContractRef: missing');
        testPassed = false;
      }

      // Verify contract.supersededByContractRef still exists
      if (output.contract.supersededByContractRef) {
        const expectedRef = output.futureContract.contractType;
        if (output.contract.supersededByContractRef === expectedRef) {
          console.log(
            `   ✅ contract.supersededByContractRef: "${output.contract.supersededByContractRef}" (preserved)`
          );
        } else {
          console.log(
            `   ❌ contract.supersededByContractRef: expected "${expectedRef}", got "${output.contract.supersededByContractRef}"`
          );
          testPassed = false;
        }
      } else {
        console.log('   ❌ contract.supersededByContractRef: missing');
        testPassed = false;
      }
    } else {
      console.log('   ❌ futureContract: not found');
      testPassed = false;
    }

    if (testPassed) {
      console.log('   ✅ PASSED');
      passed++;
    } else {
      console.log('   ❌ FAILED');
      failed++;
    }
  } catch (error: any) {
    console.log(`   ❌ ERROR: ${error.message}`);
    failed++;
  }

  // Test 2: Austin Reaves - No futureContract
  console.log('\n📋 Test 2: Austin Reaves - Player without futureContract');
  try {
    const outputPath = join(__dirname, '../../output', 'austin_reaves.json');
    const output = JSON.parse(await fs.readFile(outputPath, 'utf8'));

    let testPassed = true;

    // Check contract.tradeEligibility
    const contractTE = output.contract.tradeEligibility as TradeEligibility;
    if (contractTE.canBeTradedNow === null) {
      console.log('   ✅ contract.tradeEligibility.canBeTradedNow: null');
    } else {
      console.log(
        `   ❌ contract.tradeEligibility.canBeTradedNow: expected null, got ${contractTE.canBeTradedNow}`
      );
      testPassed = false;
    }

    if (contractTE.restrictedUntil === null) {
      console.log('   ✅ contract.tradeEligibility.restrictedUntil: null');
    } else {
      console.log(
        `   ❌ contract.tradeEligibility.restrictedUntil: expected null, got "${contractTE.restrictedUntil}"`
      );
      testPassed = false;
    }

    if (contractTE.reason === null) {
      console.log('   ✅ contract.tradeEligibility.reason: null');
    } else {
      console.log(
        `   ❌ contract.tradeEligibility.reason: expected null, got "${contractTE.reason}"`
      );
      testPassed = false;
    }

    // Verify no futureContract
    if (!output.futureContract) {
      console.log('   ✅ futureContract: correctly absent');
    } else {
      console.log('   ❌ futureContract: should not exist for this player');
      testPassed = false;
    }

    if (testPassed) {
      console.log('   ✅ PASSED');
      passed++;
    } else {
      console.log('   ❌ FAILED');
      failed++;
    }
  } catch (error: any) {
    console.log(`   ❌ ERROR: ${error.message}`);
    failed++;
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📊 Total: ${passed + failed}`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('❌ Test runner error:', err);
  process.exit(1);
});
