#!/usr/bin/env tsx

import fs from 'node:fs/promises';
import path from 'node:path';
import { normalizePstLabel, ALL_TEAM_CODES } from './pst_team_slugs';

/**
 * pst_build_owner_overlay.ts
 *
 * GOAL: Produce an overlay of "visual ownership" from PST raw rows.
 *
 * RULES:
 * - Read pst_raw_rows.json
 * - Create one overlay entry per row where displayOwner != originalTeam
 * - No interpretation of text (swaps, etc.), just trust displayOwner
 * - Validate displayOwner is a valid TeamCode
 */

const RAW_ROWS_PATH = path.resolve(
  process.cwd(),
  'data/pst/pst_raw_rows.json'
);
const OUTPUT_PATH = path.resolve(
  process.cwd(),
  'data/pst/pst_owner_overlay.json'
);

// Minimal RawRow interface based on what we need
type RawRow = {
  year: number;
  round: number;
  originalTeam: string; // Should be code
  displayOwner: string; // Should be code or label
  rowKind: 'own' | 'transaction' | 'condition_not_met';
  sourceTeamPage: string;
  sourceUrl: string;
  snapshotPath: string;
  rowRef: string;
};

export type OwnerOverlayItem = {
  pickId: string;
  originalTeam: string;
  year: number;
  round: 1 | 2;
  displayOwner: string; // Valid Team Code
  rowKind: 'own' | 'transaction' | 'condition_not_met';
  sourceTeamPage: string;
  sourceUrl: string;
  snapshotPath: string;
  rowRef: string;
};

// Start years for filtering (just in case raw rows go beyond)
// Master doc implies 2026-2033 coverage is guaranteed, but we should handle whatever is there?
// Prompt says "Produce a complete... draft pick ledger for 2026-2033".
// But for overlay, we iterate raw rows. If raw rows have 2024, do we include them?
// The prompt says "Goal (Phase 2): Produce a complete... draft pick ledger for years 2026-2033".
// I will filter overlay to 2026-2033 to match the base ledger scope.

const START_YEAR = 2026;
const END_YEAR = 2033;

async function main() {
  console.log('Building PST Owner Overlay...');

  const rawData = await fs.readFile(RAW_ROWS_PATH, 'utf-8');
  const { rows } = JSON.parse(rawData) as { rows: RawRow[] };

  console.log(`Loaded ${rows.length} raw rows.`);

  const overlayItems: OwnerOverlayItem[] = [];
  const errors: string[] = [];

  for (const row of rows) {
    // 1. Filter checks
    if (row.year < START_YEAR || row.year > END_YEAR) {
      continue;
    }
    if (row.round !== 1 && row.round !== 2) {
      continue; // Skip invalid rounds if any
    }

    // 2. Validate Original Team
    const originalTeam = normalizePstLabel(row.originalTeam);
    if (!originalTeam) {
      errors.push(
        `Invalid originalTeam: "${row.originalTeam}" in row ${row.rowRef}`
      );
      continue;
    }

    // 3. Validate/Normalize Display Owner
    const displayOwner = normalizePstLabel(row.displayOwner);
    if (!displayOwner) {
      errors.push(
        `Invalid displayOwner: "${row.displayOwner}" in row ${row.rowRef} (text: ${row.displayOwner})`
      );
      continue;
    }

    // 4. Check for ownership difference
    if (displayOwner === originalTeam) {
      continue; // No overlay needed if they own it
    }

    // 5. Build Item
    const roundSuffix = row.round === 1 ? '1st' : '2nd';
    const pickId = `${originalTeam}_${row.year}_${roundSuffix}`;

    overlayItems.push({
      pickId,
      originalTeam,
      year: row.year,
      round: row.round as 1 | 2,
      displayOwner,
      rowKind: row.rowKind,
      sourceTeamPage: row.sourceTeamPage,
      sourceUrl: row.sourceUrl,
      snapshotPath: row.snapshotPath,
      rowRef: row.rowRef,
    });
  }

  // Report errors
  if (errors.length > 0) {
    console.error('❌ Errors encountered during overlay build:');
    errors.forEach((e) => console.error(`   - ${e}`));
    // We strictly fail if owners are invalid per validation rules
    process.exit(1);
  }

  // Write output
  // Sort for deterministic file
  overlayItems.sort((a, b) => {
    return a.pickId.localeCompare(b.pickId) || a.rowRef.localeCompare(b.rowRef);
  });

  await fs.writeFile(OUTPUT_PATH, JSON.stringify(overlayItems, null, 2));
  console.log(`✅ Owner Overlay written to ${OUTPUT_PATH}`);
  console.log(`   Count: ${overlayItems.length}`);
}

main().catch((err) => {
  console.error('❌ Failed:', err);
  process.exit(1);
});
