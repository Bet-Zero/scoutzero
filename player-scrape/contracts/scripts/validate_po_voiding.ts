// validate_po_voiding.ts — Validates PO voiding logic implementation
//
// DESCRIPTION:
//   Tests the parser's ability to detect and handle player options (PO) voided by extensions.
//   Runs through test cases for Luka Doncic and Austin Reaves to ensure correct behavior.
//
// USAGE:
//   npx tsx player-scrape/contracts/scripts/validate_po_voiding.ts

import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

interface TestCase {
  name: string;
  playerId: string;
  teamCode: string; // Team code for file organization
  outputFile: string;
  expectations: {
    contract: {
      guaranteedValue?: number;
      guaranteedYears?: number;
      yearsRemaining?: number;
      isMaxContract?: boolean;
      maxType?: string;
      estimatedCapPercentage?: number;
      supersededIn?: string;
      supersededByContractRef?: string;
    };
    voidedPOYear?: {
      season: string;
      guaranteed: boolean;
      guaranteedAmount: number;
      voidedByExtension: boolean;
      optionUsed?: boolean | null;
      optionDecisionDate?: string | null;
      voidedOn?: string;
    };
    futureContract?: {
      startSeason?: string;
      isMaxContract?: boolean;
      maxType?: string;
      estimatedCapPercentage?: number;
      poRemains?: {
        season: string;
        guaranteed: boolean;
      };
    };
  };
}

const testCases: TestCase[] = [
  {
    name: 'Luka Dončić - DRSE with voided PO',
    playerId: 'luka_doncic',
    teamCode: 'DAL',
    outputFile: 'luka_doncic.json',
    expectations: {
      contract: {
        guaranteedValue: 166192320,
        guaranteedYears: 4,
        yearsRemaining: 1,
        isMaxContract: true,
        maxType: 'Max-30',
        estimatedCapPercentage: 30,
        supersededIn: '2026-27',
        supersededByContractRef: 'VETERAN EXTENSION'
      },
      voidedPOYear: {
        season: '2026-27',
        guaranteed: false,
        guaranteedAmount: 0,
        voidedByExtension: true,
        optionUsed: false,
        optionDecisionDate: '2025-08-02',
        voidedOn: '2025-08-02'
      },
      futureContract: {
        startSeason: '2026-27',
        isMaxContract: true,
        maxType: 'Max-30',
        estimatedCapPercentage: 30,
        poRemains: {
          season: '2028-29',
          guaranteed: true
        }
      }
    }
  },
  {
    name: 'Austin Reaves - Veteran contract with PO remaining guaranteed',
    playerId: 'austin_reaves',
    teamCode: 'LAL',
    outputFile: 'austin_reaves.json',
    expectations: {
      contract: {
        guaranteedValue: 62142857,
        guaranteedYears: 5,
        yearsRemaining: 3,
        isMaxContract: false,
        estimatedCapPercentage: 8.83
      }
    }
  }
];

async function validateTestCase(testCase: TestCase): Promise<boolean> {
  console.log(`\n📋 Testing: ${testCase.name}`);
  console.log('─'.repeat(60));

  const outputPath = join(__dirname, '../output', testCase.teamCode, testCase.outputFile);
  let data: any;

  try {
    const content = await readFile(outputPath, 'utf-8');
    data = JSON.parse(content);
  } catch (err) {
    console.error(`❌ Failed to read output file: ${outputPath}`);
    console.error(err);
    return false;
  }

  let allPassed = true;

  // Validate contract fields
  if (testCase.expectations.contract) {
    console.log('\n🔍 Validating contract fields:');
    const contract = data.contract;

    for (const [key, expected] of Object.entries(testCase.expectations.contract)) {
      const actual = contract[key];
      const passed = actual === expected;
      allPassed = allPassed && passed;

      const icon = passed ? '✅' : '❌';
      console.log(`  ${icon} ${key}: ${actual} ${passed ? '==' : '!='} ${expected}`);
    }
  }

  // Validate voided PO year
  if (testCase.expectations.voidedPOYear) {
    console.log('\n🔍 Validating voided PO year:');
    const voidedYear = data.contract.salariesByYear.find(
      (y: any) => y.season === testCase.expectations.voidedPOYear!.season
    );

    if (!voidedYear) {
      console.error(`  ❌ Voided PO year ${testCase.expectations.voidedPOYear.season} not found`);
      allPassed = false;
    } else {
      for (const [key, expected] of Object.entries(testCase.expectations.voidedPOYear)) {
        if (key === 'season') continue; // Already used for lookup

        const actual = voidedYear[key];
        const passed = actual === expected;
        allPassed = allPassed && passed;

        const icon = passed ? '✅' : '❌';
        console.log(`  ${icon} ${key}: ${actual} ${passed ? '==' : '!='} ${expected}`);
      }
    }
  }

  // Validate future contract
  if (testCase.expectations.futureContract) {
    console.log('\n🔍 Validating future contract:');
    const futureContract = data.futureContract;

    if (!futureContract) {
      console.error('  ❌ Future contract not found');
      allPassed = false;
    } else {
      for (const [key, expected] of Object.entries(testCase.expectations.futureContract)) {
        if (key === 'poRemains') continue; // Handle separately

        const actual = futureContract[key];
        const passed = actual === expected;
        allPassed = allPassed && passed;

        const icon = passed ? '✅' : '❌';
        console.log(`  ${icon} ${key}: ${actual} ${passed ? '==' : '!='} ${expected}`);
      }

      // Validate future PO remains guaranteed
      if (testCase.expectations.futureContract.poRemains) {
        const poYear = futureContract.salariesByYear.find(
          (y: any) => y.season === testCase.expectations.futureContract!.poRemains!.season
        );

        if (!poYear) {
          console.error(`  ❌ Future PO year ${testCase.expectations.futureContract.poRemains.season} not found`);
          allPassed = false;
        } else {
          const passed = poYear.guaranteed === testCase.expectations.futureContract.poRemains.guaranteed;
          allPassed = allPassed && passed;

          const icon = passed ? '✅' : '❌';
          console.log(`  ${icon} PO ${poYear.season} guaranteed: ${poYear.guaranteed}`);
        }
      }
    }
  }

  console.log('\n' + '─'.repeat(60));
  console.log(allPassed ? '✅ All checks passed' : '❌ Some checks failed');

  return allPassed;
}

async function main() {
  console.log('🧪 PO Voiding Logic Validation');
  console.log('═'.repeat(60));

  let allTestsPassed = true;

  for (const testCase of testCases) {
    const passed = await validateTestCase(testCase);
    allTestsPassed = allTestsPassed && passed;
  }

  console.log('\n' + '═'.repeat(60));
  if (allTestsPassed) {
    console.log('🎉 All tests passed!');
    process.exit(0);
  } else {
    console.log('❌ Some tests failed');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('❌ Validation error:', err);
  process.exit(1);
});
