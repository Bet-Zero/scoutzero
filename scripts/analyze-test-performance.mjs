#!/usr/bin/env node
/**
 * Test Performance Analyzer
 * Runs vitest with JSON reporter and extracts per-file timing data reliably.
 *
 * Uses `vitest run --reporter=json` to produce machine-readable output,
 * then parses per-file startTime/endTime to compute durations.
 */

import { spawn } from 'child_process';
import { writeFileSync } from 'fs';
import { resolve, relative } from 'path';

const OUTPUT_FILE = 'test-performance-results.json';
const TOP_N = 20;

console.log('Running test suite with JSON reporter for performance tracking...\n');
console.log('This will take several minutes. Please wait...\n');

const projectRoot = process.cwd();
let jsonBuffer = '';

// Run vitest with JSON reporter — stdout is machine-readable JSON,
// stderr carries progress/diagnostics which we echo for the user.
const vitest = spawn('npx', ['vitest', 'run', '--reporter=json'], {
  stdio: ['inherit', 'pipe', 'pipe'],
  shell: true,
});

vitest.stdout.on('data', (data) => {
  jsonBuffer += data.toString();
});

vitest.stderr.on('data', (data) => {
  process.stderr.write(data);
});

vitest.on('close', (exitCode) => {
  console.log('\nAnalyzing test performance from JSON output...\n');

  let data;
  try {
    data = JSON.parse(jsonBuffer);
  } catch {
    console.error('❌ Could not parse Vitest JSON output');
    console.error(`   Raw output length: ${jsonBuffer.length} chars`);
    process.exit(1);
  }

  const testResults = data.testResults || [];
  if (testResults.length === 0) {
    console.error('❌ No test results found in JSON output');
    process.exit(1);
  }

  // Build per-file timing entries
  const testFiles = testResults.map((tr) => {
    const durationMs = (tr.endTime || 0) - (tr.startTime || 0);
    const testCount = (tr.assertionResults || []).length;
    const filePath = relative(projectRoot, tr.name) || tr.name;
    return {
      file: filePath,
      testCount,
      durationMs: Math.max(0, durationMs),
    };
  });

  // Sort by duration descending
  testFiles.sort((a, b) => b.durationMs - a.durationMs);

  // Statistics
  const totalFiles = testFiles.length;
  const totalTests = testFiles.reduce((sum, f) => sum + f.testCount, 0);
  const totalDurationMs = testFiles.reduce((sum, f) => sum + f.durationMs, 0);
  const avgDurationMs = totalFiles > 0 ? totalDurationMs / totalFiles : 0;
  const medianDurationMs =
    testFiles[Math.floor(totalFiles / 2)]?.durationMs || 0;

  // Console summary
  console.log('=== TEST PERFORMANCE ANALYSIS ===\n');
  console.log(`Total test files: ${totalFiles}`);
  console.log(`Total tests: ${totalTests}`);
  console.log(`Total duration: ${(totalDurationMs / 1000).toFixed(2)}s`);
  console.log(`Average per file: ${avgDurationMs.toFixed(0)}ms`);
  console.log(`Median per file: ${medianDurationMs}ms`);

  // Top N slowest
  const topFiles = testFiles.filter((f) => f.durationMs > 0).slice(0, TOP_N);

  console.log(`\n=== TOP ${TOP_N} SLOWEST TEST FILES ===\n`);
  topFiles.forEach((file, idx) => {
    const percent =
      totalDurationMs > 0
        ? ((file.durationMs / totalDurationMs) * 100).toFixed(1)
        : '0.0';
    const durationSec = (file.durationMs / 1000).toFixed(2);
    console.log(
      `${(idx + 1).toString().padStart(2)}. ${durationSec.padStart(6)}s (${percent.padStart(5)}%) - ${file.file} (${file.testCount} tests)`
    );
  });

  // Build and write report
  const report = {
    summary: {
      totalFiles,
      totalTests,
      totalDurationMs,
      totalDurationSec: (totalDurationMs / 1000).toFixed(2),
      avgDurationMs: Math.round(avgDurationMs),
      medianDurationMs,
    },
    top20: topFiles,
    allFiles: testFiles,
  };

  writeFileSync(resolve(projectRoot, OUTPUT_FILE), JSON.stringify(report, null, 2));
  console.log(`\n✓ Detailed results saved to: ${OUTPUT_FILE}\n`);

  process.exit(exitCode);
});
