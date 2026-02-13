#!/usr/bin/env node
/**
 * Test Performance Analyzer
 * Runs vitest and extracts per-file timing information from summary output
 */

import { spawn } from 'child_process';
import { writeFileSync } from 'fs';

console.log('Running test suite with performance tracking...\n');
console.log('This will take several minutes. Please wait...\n');

const testFiles = [];
let fullOutput = '';

// Run vitest with default reporter which includes timing
const vitest = spawn('npx', ['vitest', 'run', '--reporter=verbose'], {
  stdio: ['inherit', 'pipe', 'pipe'],
  shell: true,
});

vitest.stdout.on('data', (data) => {
  const chunk = data.toString();
  fullOutput += chunk;
  process.stdout.write(chunk);
});

vitest.stderr.on('data', (data) => {
  const chunk = data.toString();
  fullOutput += chunk;
  process.stderr.write(chunk);
});

vitest.on('close', (code) => {
  console.log('\n\nAnalyzing test performance...\n');

  const lines = fullOutput.split('\n');

  // Parse individual test file completions
  // Match: " ✓ path/to/file.test.js (N) DURATIONms" or " ✓ path/to/file.test.js (N)"
  const filePattern =
    /^\s*✓\s+(.+\.(?:test|spec)\.[jt]sx?)\s+\((\d+)\)(?:\s+(\d+)ms)?/;

  for (const line of lines) {
    const match = line.match(filePattern);
    if (match) {
      const [, filePath, testCount, duration] = match;
      testFiles.push({
        file: filePath,
        testCount: parseInt(testCount),
        duration: duration ? parseInt(duration) : 0,
      });
    }
  }

  if (testFiles.length === 0) {
    console.error('❌ Could not parse test timing data');
    console.error('Full output length:', fullOutput.length);
    process.exit(1);
  }

  // Sort by duration descending
  testFiles.sort((a, b) => b.duration - a.duration);

  // Generate statistics
  const totalTests = testFiles.reduce((sum, f) => sum + f.testCount, 0);
  const totalDuration = testFiles.reduce((sum, f) => sum + f.duration, 0);
  const avgDuration =
    testFiles.length > 0 ? totalDuration / testFiles.length : 0;
  const median = testFiles[Math.floor(testFiles.length / 2)]?.duration || 0;

  // Output results
  console.log('=== TEST PERFORMANCE ANALYSIS ===\n');
  console.log(`Total test files: ${testFiles.length}`);
  console.log(`Total tests: ${totalTests}`);
  console.log(`Total duration: ${(totalDuration / 1000).toFixed(2)}s`);
  console.log(`Average per file: ${avgDuration.toFixed(0)}ms`);
  console.log(`Median per file: ${median}ms`);

  console.log('\n=== TOP 30 SLOWEST TEST FILES ===\n');
  const topFiles = testFiles.filter((f) => f.duration > 0).slice(0, 30);

  topFiles.forEach((file, idx) => {
    const percent =
      totalDuration > 0
        ? ((file.duration / totalDuration) * 100).toFixed(1)
        : '0.0';
    const durationSec = (file.duration / 1000).toFixed(2);
    console.log(
      `${(idx + 1).toString().padStart(2)}. ${durationSec.padStart(6)}s (${percent.padStart(5)}%) - ${file.file} (${file.testCount} tests)`
    );
  });

  // Save detailed results
  const report = {
    summary: {
      totalFiles: testFiles.length,
      totalTests,
      totalDurationMs: totalDuration,
      totalDurationSec: (totalDuration / 1000).toFixed(2),
      avgDurationMs: Math.round(avgDuration),
      medianDurationMs: median,
    },
    topSlowFiles: topFiles,
    allFiles: testFiles,
  };

  writeFileSync(
    'test-performance-results.json',
    JSON.stringify(report, null, 2)
  );
  console.log('\n✓ Detailed results saved to: test-performance-results.json\n');

  process.exit(code);
});
