// spec_compliance_test.ts — Test that output complies with contract normalization spec
// RUN: npx tsx player-scrape/contracts/scripts/spec_compliance_test.ts

import fs from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function testLukaCompliance() {
  console.log('🧪 Testing Luka Dončić Spec Compliance\n');
  
  const outputPath = join(__dirname, '../../output/luka_doncic.json');
  const output = JSON.parse(await fs.readFile(outputPath, 'utf8'));
  
  let passed = 0;
  let failed = 0;
  
  // Test 1: Old contract has voided PO year with correct fields
  console.log('📋 Test 1: Voided PO Year');
  const voidedYear = output.contract.salariesByYear.find(
    (y: any) => y.season === '2026-27'
  );
  
  if (voidedYear) {
    const tests = [
      { name: 'option is PO', actual: voidedYear.option, expected: 'PO' },
      { name: 'optionUsed is false', actual: voidedYear.optionUsed, expected: false },
      { name: 'optionDecisionDate is ISO', actual: /^\d{4}-\d{2}-\d{2}$/.test(voidedYear.optionDecisionDate), expected: true },
      { name: 'optionDecisionDate value', actual: voidedYear.optionDecisionDate, expected: '2025-08-02' },
      { name: 'voidedByExtension is true', actual: voidedYear.voidedByExtension, expected: true },
      { name: 'voidedOn is ISO', actual: /^\d{4}-\d{2}-\d{2}$/.test(voidedYear.voidedOn), expected: true },
      { name: 'voidedOn value', actual: voidedYear.voidedOn, expected: '2025-08-02' },
      { name: 'guaranteed is false', actual: voidedYear.guaranteed, expected: false },
      { name: 'guaranteedAmount is 0', actual: voidedYear.guaranteedAmount, expected: 0 },
      { name: 'no guaranteeSchedule', actual: voidedYear.guaranteeSchedule, expected: undefined },
    ];
    
    for (const test of tests) {
      if (test.actual === test.expected) {
        console.log(`   ✅ ${test.name}`);
        passed++;
      } else {
        console.log(`   ❌ ${test.name}: expected ${test.expected}, got ${test.actual}`);
        failed++;
      }
    }
  } else {
    console.log('   ❌ Voided year 2026-27 not found');
    failed += 10;
  }
  
  // Test 2: Old contract supersession metadata
  console.log('\n📋 Test 2: Old Contract Supersession Metadata');
  const supersessionTests = [
    { name: 'supersededIn', actual: output.contract.supersededIn, expected: '2026-27' },
    { name: 'supersededByContractRef', actual: output.contract.supersededByContractRef, expected: 'VETERAN EXTENSION' },
  ];
  
  for (const test of supersessionTests) {
    if (test.actual === test.expected) {
      console.log(`   ✅ ${test.name}: ${test.actual}`);
      passed++;
    } else {
      console.log(`   ❌ ${test.name}: expected "${test.expected}", got "${test.actual}"`);
      failed++;
    }
  }
  
  // Test 3: Old contract rollups
  console.log('\n📋 Test 3: Old Contract Rollups');
  const rollupTests = [
    { name: 'yearsRemaining', actual: output.contract.yearsRemaining, expected: 1 },
    { name: 'guaranteedValue', actual: output.contract.guaranteedValue, expected: 166192320 },
    { name: 'guaranteedYears', actual: output.contract.guaranteedYears, expected: 4 },
  ];
  
  for (const test of rollupTests) {
    if (test.actual === test.expected) {
      console.log(`   ✅ ${test.name}: ${test.actual}`);
      passed++;
    } else {
      console.log(`   ❌ ${test.name}: expected ${test.expected}, got ${test.actual}`);
      failed++;
    }
  }
  
  // Test 4: Future contract metadata
  console.log('\n📋 Test 4: Future Contract Metadata');
  if (output.futureContract) {
    const futureTests = [
      { name: 'supersedesContractRef', actual: output.futureContract.supersedesContractRef, expected: 'DESIGNATED ROOKIE SCALE EXTENSION' },
      { name: 'yearsRemaining', actual: output.futureContract.yearsRemaining, expected: 3 },
    ];
    
    for (const test of futureTests) {
      if (test.actual === test.expected) {
        console.log(`   ✅ ${test.name}: ${test.actual}`);
        passed++;
      } else {
        console.log(`   ❌ ${test.name}: expected "${test.expected}", got "${test.actual}"`);
        failed++;
      }
    }
  } else {
    console.log('   ❌ futureContract not found');
    failed += 2;
  }
  
  // Test 5: Future contract has live PO (not voided)
  console.log('\n📋 Test 5: Future Contract Live PO');
  if (output.futureContract) {
    const futurePoYear = output.futureContract.salariesByYear.find(
      (y: any) => y.option === 'PO'
    );
    
    if (futurePoYear) {
      const poTests = [
        { name: 'option is PO', actual: futurePoYear.option, expected: 'PO' },
        { name: 'optionUsed is null', actual: futurePoYear.optionUsed, expected: null },
        { name: 'optionDecisionDate is null', actual: futurePoYear.optionDecisionDate, expected: null },
        { name: 'NOT voidedByExtension', actual: futurePoYear.voidedByExtension, expected: undefined },
        { name: 'guaranteed is true (live PO)', actual: futurePoYear.guaranteed, expected: true },
        { name: 'guaranteedAmount equals salary', actual: futurePoYear.guaranteedAmount === futurePoYear.salary, expected: true },
      ];
      
      for (const test of poTests) {
        if (test.actual === test.expected) {
          console.log(`   ✅ ${test.name}`);
          passed++;
        } else {
          console.log(`   ❌ ${test.name}: expected ${test.expected}, got ${test.actual}`);
          failed++;
        }
      }
    } else {
      console.log('   ⚠️  No PO year in future contract (this is OK)');
    }
  }
  
  // Test 6: Trade eligibility
  console.log('\n📋 Test 6: Trade Eligibility');
  const teTests = [
    { name: 'contract.tradeEligibility.canBeTradedNow', actual: output.contract.tradeEligibility.canBeTradedNow, expected: null },
    { name: 'futureContract.tradeEligibility.canBeTradedNow', actual: output.futureContract?.tradeEligibility.canBeTradedNow, expected: null },
  ];
  
  for (const test of teTests) {
    if (test.actual === test.expected) {
      console.log(`   ✅ ${test.name}: ${test.actual}`);
      passed++;
    } else {
      console.log(`   ❌ ${test.name}: expected ${test.expected}, got ${test.actual}`);
      failed++;
    }
  }
  
  // Test 7: All dates are ISO format
  console.log('\n📋 Test 7: ISO Date Format');
  let allDatesISO = true;
  const dateFields = ['optionDecisionDate', 'voidedOn'];
  
  for (const year of output.contract.salariesByYear) {
    for (const field of dateFields) {
      if (year[field] !== null && year[field] !== undefined) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(year[field])) {
          console.log(`   ❌ ${year.season}.${field}: not ISO format: ${year[field]}`);
          allDatesISO = false;
          failed++;
        }
      }
    }
  }
  
  if (allDatesISO) {
    console.log(`   ✅ All dates in ISO format (YYYY-MM-DD)`);
    passed++;
  }
  
  // Test 8: No optionUsed strings
  console.log('\n📋 Test 8: No Option String Values');
  let allOptionsValid = true;
  
  for (const year of output.contract.salariesByYear) {
    if (typeof year.optionUsed === 'string') {
      console.log(`   ❌ ${year.season}.optionUsed is string: "${year.optionUsed}"`);
      allOptionsValid = false;
      failed++;
    }
  }
  
  if (allOptionsValid) {
    console.log(`   ✅ All optionUsed values are boolean or null`);
    passed++;
  }
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  
  return failed === 0;
}

async function main() {
  const success = await testLukaCompliance();
  process.exit(success ? 0 : 1);
}

main().catch((err) => {
  console.error('❌ Test error:', err);
  process.exit(1);
});
