#!/usr/bin/env tsx
/**
 * pst_phase_4_build_profiles.ts
 *
 * Phase 4 Runner Script: Build Pick Rule Profiles
 *
 * This script:
 * 1. Loads Phase 2 output (pst_ledger_with_display_owner.json) - 480 base picks
 * 2. Loads Phase 3 output (pst_phase_3_normalized_rows.json) - feature-enriched rows
 * 3. Builds PickRuleProfiles via deterministic parsing
 * 4. Writes outputs:
 *    - pst_pick_rule_profiles_2026_2033.json
 *    - pst_needs_review_queue.json
 *    - pst_phase_4_report.json
 *
 * Usage:
 *   npx tsx team-scrape/draft-picks/scripts/pst/pst_phase_4_build_profiles.ts
 *   npm run pst:phase-4
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildPickRuleProfiles,
  type NormalizedRow,
  type BaseLedgerItem,
  type PickRuleProfilesOutput,
  type NeedsReviewQueue,
  type Phase4Report,
} from './pst_pick_rule_parser';

// ============================================================================
// CONFIGURATION
// ============================================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..', '..');

const DATA_DIR = path.join(PROJECT_ROOT, 'data', 'pst');

// Input paths
const BASE_LEDGER_PATH = path.join(DATA_DIR, 'pst_ledger_with_display_owner.json');
const NORMALIZED_ROWS_PATH = path.join(DATA_DIR, 'pst_phase_3_normalized_rows.json');

// Output paths
const PROFILES_OUTPUT_PATH = path.join(DATA_DIR, 'pst_pick_rule_profiles_2026_2033.json');
const NEEDS_REVIEW_PATH = path.join(DATA_DIR, 'pst_needs_review_queue.json');
const REPORT_PATH = path.join(DATA_DIR, 'pst_phase_4_report.json');

// ============================================================================
// UTILITIES
// ============================================================================

async function ensureDir(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

function serialize(obj: unknown, pretty = true): string {
  return pretty ? JSON.stringify(obj, null, 2) : JSON.stringify(obj);
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// MAIN
// ============================================================================

async function main(): Promise<void> {
  console.log('\n📊 PST Phase 4: Pick Rule Profile Builder');
  console.log('==========================================\n');

  await ensureDir(DATA_DIR);

  // 1. Check input files exist
  const hasBaseLedger = await fileExists(BASE_LEDGER_PATH);
  const hasNormalizedRows = await fileExists(NORMALIZED_ROWS_PATH);

  if (!hasBaseLedger) {
    console.error(`❌ Missing base ledger: ${BASE_LEDGER_PATH}`);
    console.error('   Run: npm run pst:phase-2 first');
    process.exit(1);
  }

  if (!hasNormalizedRows) {
    console.error(`❌ Missing normalized rows: ${NORMALIZED_ROWS_PATH}`);
    console.error('   Run: npm run pst:phase-3 first');
    process.exit(1);
  }

  // 2. Load inputs
  console.log('Loading inputs...');
  console.log(`  Base ledger: ${BASE_LEDGER_PATH}`);
  console.log(`  Normalized rows: ${NORMALIZED_ROWS_PATH}`);

  const baseLedgerRaw = await fs.readFile(BASE_LEDGER_PATH, 'utf-8');
  const normalizedRowsRaw = await fs.readFile(NORMALIZED_ROWS_PATH, 'utf-8');

  const baseLedger: BaseLedgerItem[] = JSON.parse(baseLedgerRaw);
  const normalizedRows: NormalizedRow[] = JSON.parse(normalizedRowsRaw);

  console.log(`  Loaded ${baseLedger.length} base picks`);
  console.log(`  Loaded ${normalizedRows.length} normalized rows`);

  // 3. Validate input counts
  const EXPECTED_PICKS = 480;
  if (baseLedger.length !== EXPECTED_PICKS) {
    console.warn(`⚠️  Warning: Expected ${EXPECTED_PICKS} picks, got ${baseLedger.length}`);
  }

  // 4. Build profiles
  console.log('\nBuilding pick rule profiles...');
  const { profiles, needsReviewQueue, report } = buildPickRuleProfiles(
    normalizedRows,
    baseLedger
  );

  // 5. Validate outputs
  console.log('\nValidating outputs...');
  const profileCount = Object.keys(profiles.profiles).length;

  if (profileCount !== baseLedger.length) {
    console.error(`❌ Profile count mismatch: ${profileCount} vs ${baseLedger.length} base picks`);
    process.exit(1);
  }

  // Check all pickIds from base ledger are present
  const missingPicks: string[] = [];
  for (const pick of baseLedger) {
    if (!profiles.profiles[pick.pickId]) {
      missingPicks.push(pick.pickId);
    }
  }

  if (missingPicks.length > 0) {
    console.error(`❌ Missing profiles for ${missingPicks.length} picks`);
    console.error(`   First 5: ${missingPicks.slice(0, 5).join(', ')}`);
    process.exit(1);
  }

  console.log(`  ✓ All ${profileCount} picks have profiles`);
  console.log(`  ✓ Needs review count: ${needsReviewQueue.needsReviewCount}`);

  // 6. Write outputs
  console.log('\nWriting outputs...');

  await fs.writeFile(PROFILES_OUTPUT_PATH, serialize(profiles), 'utf-8');
  console.log(`  ✓ Profiles: ${PROFILES_OUTPUT_PATH}`);

  await fs.writeFile(NEEDS_REVIEW_PATH, serialize(needsReviewQueue), 'utf-8');
  console.log(`  ✓ Needs review queue: ${NEEDS_REVIEW_PATH}`);

  await fs.writeFile(REPORT_PATH, serialize(report), 'utf-8');
  console.log(`  ✓ Report: ${REPORT_PATH}`);

  // 7. Print summary
  console.log('\n📊 Phase 4 Summary');
  console.log('==================');
  console.log(`  Total picks: ${report.counts.totalPicks}`);
  console.log(`  Protections extracted: ${report.counts.protectionsExtracted}`);
  console.log(`  Swaps extracted: ${report.counts.swapsExtracted}`);
  console.log(`  Conveyance extracted: ${report.counts.conveyanceExtracted}`);
  console.log(`  Did-not-convey extracted: ${report.counts.didNotConveyExtracted}`);
  console.log(`  Needs review: ${report.counts.needsReviewCount}`);

  if (report.topReviewReasons.length > 0) {
    console.log('\n  Top Review Reasons:');
    for (const { reason, count } of report.topReviewReasons.slice(0, 5)) {
      console.log(`    - ${reason}: ${count}`);
    }
  }

  if (report.topPicksByEncumbrances.length > 0) {
    console.log('\n  Top Picks by Encumbrances:');
    for (const { pickId, count } of report.topPicksByEncumbrances.slice(0, 5)) {
      console.log(`    - ${pickId}: ${count} encumbrances`);
    }
  }

  console.log('\n✅ Phase 4 COMPLETE');
}

// Run
main().catch((err) => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
