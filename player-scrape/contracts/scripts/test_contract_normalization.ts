// test_contract_normalization.ts — Test contract normalization against spec requirements
// RUN: npx tsx player-scrape/contracts/scripts/test_contract_normalization.ts

import fs from 'node:fs/promises';
import * as cheerio from 'cheerio';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

interface TestCase {
  name: string;
  playerId: string;
  htmlFile: string;
  expectations: {
    contractType?: string;
    isRookieScale?: boolean;
    hasVoidedPO?: boolean;
    hasPartialGuarantees?: boolean;
    hasGuaranteeSchedule?: boolean;
    hasOptionExercised?: boolean;
    maxType?: string | null;
    signedUsing?: string;
  };
}

const testCases: TestCase[] = [
  {
    name: 'Luka Dončić - Extension voiding PO',
    playerId: 'luka_doncic',
    htmlFile: 'luka_doncic_test.html',
    expectations: {
      contractType: 'DESIGNATED ROOKIE SCALE EXTENSION',
      isRookieScale: true,
      hasVoidedPO: true,
      maxType: 'Max-30',
    },
  },
  {
    name: 'Austin Reaves - Live player option',
    playerId: 'austin_reaves',
    htmlFile: 'austin_reaves_test.html',
    expectations: {
      contractType: 'VETERAN CONTRACT',
      isRookieScale: false,
      signedUsing: 'Early-Bird Exception',
    },
  },
  {
    name: 'Jalen Wilson - Team option with partial guarantees',
    playerId: 'jalen_wilson',
    htmlFile: 'jalen_wilson_test.html',
    expectations: {
      contractType: 'ROOKIE CONTRACT',
      isRookieScale: false,
      hasPartialGuarantees: true,
      hasGuaranteeSchedule: true,
      hasOptionExercised: true,
    },
  },
];

async function runTests() {
  console.log('🧪 Testing Contract Normalization\n');
  
  let passed = 0;
  let failed = 0;
  
  for (const test of testCases) {
    console.log(`\n📋 Test: ${test.name}`);
    console.log(`   File: ${test.htmlFile}`);
    
    try {
      const outputPath = join(__dirname, '../../output', `${test.playerId}.json`);
      const output = JSON.parse(await fs.readFile(outputPath, 'utf8'));
      
      // Run expectations
      let testPassed = true;
      
      if (test.expectations.contractType) {
        const actual = output.contract.contractType;
        const expected = test.expectations.contractType;
        if (actual === expected) {
          console.log(`   ✅ contractType: ${actual}`);
        } else {
          console.log(`   ❌ contractType: expected "${expected}", got "${actual}"`);
          testPassed = false;
        }
      }
      
      if (test.expectations.isRookieScale !== undefined) {
        const actual = output.contract.isRookieScale;
        const expected = test.expectations.isRookieScale;
        if (actual === expected) {
          console.log(`   ✅ isRookieScale: ${actual}`);
        } else {
          console.log(`   ❌ isRookieScale: expected ${expected}, got ${actual}`);
          testPassed = false;
        }
      }
      
      if (test.expectations.hasVoidedPO) {
        const voidedPO = output.contract.salariesByYear.find(
          (y: any) => y.voidedByExtension === true
        );
        if (voidedPO) {
          console.log(`   ✅ Has voided PO: ${voidedPO.season} (optionUsed: ${voidedPO.optionUsed})`);
        } else {
          console.log(`   ❌ No voided PO found`);
          testPassed = false;
        }
      }
      
      if (test.expectations.maxType !== undefined) {
        const actual = output.contract.maxType;
        const expected = test.expectations.maxType;
        if (actual === expected) {
          console.log(`   ✅ maxType: ${actual || 'null'}`);
        } else {
          console.log(`   ❌ maxType: expected "${expected}", got "${actual}"`);
          testPassed = false;
        }
      }
      
      if (test.expectations.signedUsing) {
        const actual = output.contract.signedUsing;
        const expected = test.expectations.signedUsing;
        if (actual === expected) {
          console.log(`   ✅ signedUsing: ${actual}`);
        } else {
          console.log(`   ❌ signedUsing: expected "${expected}", got "${actual}"`);
          testPassed = false;
        }
      }
      
      if (test.expectations.hasPartialGuarantees) {
        const partialGuarantees = output.contract.salariesByYear.filter(
          (y: any) => !y.guaranteed && y.guaranteedAmount > 0
        );
        if (partialGuarantees.length > 0) {
          console.log(`   ✅ Has partial guarantees: ${partialGuarantees.length} year(s)`);
          // Verify the amounts are correct
          const year2025 = output.contract.salariesByYear.find((y: any) => y.season === '2025-26');
          if (year2025) {
            if (year2025.guaranteedAmount === 88075 && year2025.salary === 2221677) {
              console.log(`   ✅ 2025-26: $${year2025.guaranteedAmount.toLocaleString()} guaranteed of $${year2025.salary.toLocaleString()}`);
            } else {
              console.log(`   ❌ 2025-26: Expected guaranteedAmount=88075, salary=2221677, got ${year2025.guaranteedAmount}, ${year2025.salary}`);
              testPassed = false;
            }
          }
        } else {
          console.log(`   ❌ No partial guarantees found`);
          testPassed = false;
        }
      }
      
      if (test.expectations.hasGuaranteeSchedule) {
        const withSchedule = output.contract.salariesByYear.filter(
          (y: any) => y.guaranteeSchedule && y.guaranteeSchedule.length > 0
        );
        if (withSchedule.length > 0) {
          console.log(`   ✅ Has guarantee schedule: ${withSchedule.length} year(s)`);
          // Verify the schedule has both triggers for 2025-26
          const year2025 = output.contract.salariesByYear.find((y: any) => y.season === '2025-26');
          if (year2025?.guaranteeSchedule) {
            if (year2025.guaranteeSchedule.length === 2) {
              console.log(`   ✅ 2025-26 has 2 guarantee triggers`);
              // Check amounts
              const amounts = year2025.guaranteeSchedule.map((g: any) => g.guaranteedAmount);
              if (amounts.includes(381695) && amounts.includes(2221677)) {
                console.log(`   ✅ Trigger amounts: $381,695 and $2,221,677`);
              } else {
                console.log(`   ❌ Expected trigger amounts 381695 and 2221677, got ${amounts.join(', ')}`);
                testPassed = false;
              }
            } else {
              console.log(`   ❌ Expected 2 triggers, got ${year2025.guaranteeSchedule.length}`);
              testPassed = false;
            }
          }
        } else {
          console.log(`   ❌ No guarantee schedules found`);
          testPassed = false;
        }
      }
      
      if (test.expectations.hasOptionExercised) {
        const exercised = output.contract.salariesByYear.filter(
          (y: any) => y.optionUsed && y.optionUsed.startsWith('Yes')
        );
        if (exercised.length > 0) {
          console.log(`   ✅ Has option exercised: ${exercised[0].season} (${exercised[0].optionUsed})`);
          // Verify guaranteed totals
          const expectedGuaranteedValue = 2829932;
          const expectedGuaranteedYears = 3;
          if (output.contract.guaranteedValue === expectedGuaranteedValue) {
            console.log(`   ✅ guaranteedValue: $${output.contract.guaranteedValue.toLocaleString()}`);
          } else {
            console.log(`   ❌ guaranteedValue: expected ${expectedGuaranteedValue}, got ${output.contract.guaranteedValue}`);
            testPassed = false;
          }
          if (output.contract.guaranteedYears === expectedGuaranteedYears) {
            console.log(`   ✅ guaranteedYears: ${output.contract.guaranteedYears}`);
          } else {
            console.log(`   ❌ guaranteedYears: expected ${expectedGuaranteedYears}, got ${output.contract.guaranteedYears}`);
            testPassed = false;
          }
        } else {
          console.log(`   ❌ No option exercised found`);
          testPassed = false;
        }
      }
      
      if (testPassed) {
        console.log(`   ✅ PASSED`);
        passed++;
      } else {
        console.log(`   ❌ FAILED`);
        failed++;
      }
      
    } catch (error: any) {
      console.log(`   ❌ ERROR: ${error.message}`);
      failed++;
    }
  }
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📊 Total: ${testCases.length}`);
  
  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('❌ Test runner error:', err);
  process.exit(1);
});
