// test_contract_normalization.ts — Test contract normalization against spec requirements
// RUN: npx tsx player-scrape/scripts/test_contract_normalization.ts

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
];

async function runTests() {
  console.log('🧪 Testing Contract Normalization\n');
  
  let passed = 0;
  let failed = 0;
  
  for (const test of testCases) {
    console.log(`\n📋 Test: ${test.name}`);
    console.log(`   File: ${test.htmlFile}`);
    
    try {
      const outputPath = join(__dirname, '../output', `${test.playerId}.json`);
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
