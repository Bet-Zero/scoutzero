// regression_test.ts — Regression test for contract normalization
// RUN: npx tsx player-scrape/contracts/scripts/regression_test.ts

import fs from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

interface TestCase {
  name: string;
  playerId: string;
  fixtureFile: string;
}

const testCases: TestCase[] = [
  {
    name: 'Luka Dončić - Extension voiding PO',
    playerId: 'luka_doncic',
    fixtureFile: 'luka_doncic.expected.json',
  },
  // Jalen Wilson test disabled until we have HTML snapshot
  // {
  //   name: 'Jalen Wilson - Team option with partial guarantees',
  //   playerId: 'jalen_wilson',
  //   fixtureFile: 'jalen_wilson.expected.json',
  // },
];

/**
 * Deep compare two objects, ignoring specified keys
 */
function deepCompare(
  actual: any,
  expected: any,
  path: string = '',
  ignoreKeys: string[] = []
): { matches: boolean; diffs: string[] } {
  const diffs: string[] = [];

  // Check type match
  if (typeof actual !== typeof expected) {
    diffs.push(`${path}: type mismatch (${typeof actual} vs ${typeof expected})`);
    return { matches: false, diffs };
  }

  // Handle null
  if (actual === null || expected === null) {
    if (actual !== expected) {
      diffs.push(`${path}: ${actual} vs ${expected}`);
      return { matches: false, diffs };
    }
    return { matches: true, diffs };
  }

  // Handle arrays
  if (Array.isArray(actual) && Array.isArray(expected)) {
    if (actual.length !== expected.length) {
      diffs.push(`${path}: array length mismatch (${actual.length} vs ${expected.length})`);
      return { matches: false, diffs };
    }

    for (let i = 0; i < actual.length; i++) {
      const result = deepCompare(actual[i], expected[i], `${path}[${i}]`, ignoreKeys);
      if (!result.matches) {
        diffs.push(...result.diffs);
      }
    }

    return { matches: diffs.length === 0, diffs };
  }

  // Handle objects
  if (typeof actual === 'object' && typeof expected === 'object') {
    const actualKeys = Object.keys(actual).filter(k => !ignoreKeys.includes(k));
    const expectedKeys = Object.keys(expected).filter(k => !ignoreKeys.includes(k));

    // Check for missing keys in actual
    for (const key of expectedKeys) {
      if (!(key in actual)) {
        diffs.push(`${path}.${key}: missing in actual`);
      }
    }

    // Check for extra keys in actual
    for (const key of actualKeys) {
      if (!(key in expected)) {
        diffs.push(`${path}.${key}: extra in actual (not in expected)`);
      }
    }

    // Compare common keys
    for (const key of expectedKeys) {
      if (key in actual) {
        const result = deepCompare(
          actual[key],
          expected[key],
          path ? `${path}.${key}` : key,
          ignoreKeys
        );
        if (!result.matches) {
          diffs.push(...result.diffs);
        }
      }
    }

    return { matches: diffs.length === 0, diffs };
  }

  // Handle primitives
  if (actual !== expected) {
    diffs.push(`${path}: ${JSON.stringify(actual)} vs ${JSON.stringify(expected)}`);
    return { matches: false, diffs };
  }

  return { matches: true, diffs };
}

async function runTests() {
  console.log('🧪 Running Contract Normalization Regression Tests\n');

  let passed = 0;
  let failed = 0;

  for (const test of testCases) {
    console.log(`\n📋 Test: ${test.name}`);
    console.log(`   Player: ${test.playerId}`);
    console.log(`   Fixture: ${test.fixtureFile}`);

    try {
      // Load actual output
      const actualPath = join(__dirname, '../../output', `${test.playerId}.json`);
      const actual = JSON.parse(await fs.readFile(actualPath, 'utf8'));

      // Load expected fixture
      const fixturePath = join(__dirname, '../fixtures', test.fixtureFile);
      const expected = JSON.parse(await fs.readFile(fixturePath, 'utf8'));

      // Compare (ignoring timestamps)
      const ignoreKeys = ['scrapedAt', 'lastUpdated'];
      const result = deepCompare(actual, expected, '', ignoreKeys);

      if (result.matches) {
        console.log(`   ✅ PASSED - Output matches fixture`);
        passed++;
      } else {
        console.log(`   ❌ FAILED - Found ${result.diffs.length} difference(s):`);
        result.diffs.slice(0, 10).forEach(diff => console.log(`      • ${diff}`));
        if (result.diffs.length > 10) {
          console.log(`      ... and ${result.diffs.length - 10} more`);
        }
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
