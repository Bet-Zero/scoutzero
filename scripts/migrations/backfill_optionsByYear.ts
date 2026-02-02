/**
 * FILE: scripts/migrations/backfill_optionsByYear.ts
 * PURPOSE: Backfill optionsByYear into currentContractView for all players_v2 documents.
 *          Phase 2X: Option Types SSOT migration.
 *
 * OWNERSHIP: Migration scripts
 *
 * USAGE:
 *   DRY RUN (default):
 *     npx tsx scripts/migrations/backfill_optionsByYear.ts
 *
 *   WRITE MODE:
 *     npx tsx scripts/migrations/backfill_optionsByYear.ts --write
 *
 *   SINGLE PLAYER:
 *     npx tsx scripts/migrations/backfill_optionsByYear.ts --write --player=aaron_gordon
 *
 * IDEMPOTENT: Safe to re-run. Will not overwrite existing optionsByYear if present.
 *
 * HISTORY:
 *  - 2026-02-01: Created for Phase 2X Option Types SSOT fix
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import * as path from 'path';
import * as fs from 'fs';

// Initialize Firebase Admin
const serviceAccountPath = path.resolve('serviceAccountKey.json');
if (!fs.existsSync(serviceAccountPath)) {
  console.error('❌ Missing serviceAccountKey.json in project root');
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

if (getApps().length === 0) {
  initializeApp({
    credential: cert(serviceAccount),
  });
}

const db = getFirestore();

// =====================
// Types
// =====================
interface OptionsByYear {
  [year: string]: 'PO' | 'TO' | 'ETO';
}

interface SalaryYearEntry {
  year?: number;
  season?: string;
  salary?: number;
  option?: string;
}

interface ContractDoc {
  salariesByYear?: SalaryYearEntry[];
}

interface BackfillStats {
  totalPlayers: number;
  playersWithContracts: number;
  playersWithOptions: number;
  playersUpdated: number;
  playersSkipped: number;
  optionBreakdown: { PO: number; TO: number; ETO: number };
}

// =====================
// Helpers
// =====================

/**
 * Extract seasonStartYear from season string or year number.
 * "2025-26" → 2025, 2025 → 2025
 */
function extractStartYear(key: string | number): number | null {
  if (typeof key === 'number') return key;
  if (typeof key === 'string') {
    if (key.includes('-')) {
      const parsed = parseInt(key.split('-')[0], 10);
      return isNaN(parsed) ? null : parsed;
    }
    const parsed = parseInt(key, 10);
    return isNaN(parsed) ? null : parsed;
  }
  return null;
}

/**
 * Build optionsByYear from a player's contracts subcollection.
 */
async function buildOptionsByYear(
  playerId: string
): Promise<OptionsByYear | null> {
  const contractsRef = db.collection(`players_v2/${playerId}/contracts`);
  const contractsSnapshot = await contractsRef.get();

  if (contractsSnapshot.empty) {
    return null;
  }

  const optionsByYear: OptionsByYear = {};

  for (const contractDoc of contractsSnapshot.docs) {
    const contract = contractDoc.data() as ContractDoc;
    const salaries = contract.salariesByYear || [];

    for (const entry of salaries) {
      const yearKey = entry.year ?? entry.season;
      const option = entry.option;

      if (!yearKey || !option) continue;
      if (!['PO', 'TO', 'ETO'].includes(option)) continue;

      const startYear = extractStartYear(yearKey);
      if (!startYear) continue;

      // Store as string key for Firestore map
      optionsByYear[String(startYear)] = option as 'PO' | 'TO' | 'ETO';
    }
  }

  return Object.keys(optionsByYear).length > 0 ? optionsByYear : null;
}

// =====================
// Main Backfill Logic
// =====================

async function backfillOptionsByYear(options: {
  write: boolean;
  playerId?: string;
}) {
  const { write, playerId } = options;

  console.log('\n🚀 Phase 2X: Backfill optionsByYear');
  console.log(`   Mode: ${write ? '✍️  WRITE' : '👁️  DRY RUN'}`);
  if (playerId) {
    console.log(`   Target: Single player - ${playerId}`);
  }
  console.log('');

  const stats: BackfillStats = {
    totalPlayers: 0,
    playersWithContracts: 0,
    playersWithOptions: 0,
    playersUpdated: 0,
    playersSkipped: 0,
    optionBreakdown: { PO: 0, TO: 0, ETO: 0 },
  };

  // Get players to process
  let playersQuery;
  if (playerId) {
    playersQuery = await db.collection('players_v2').doc(playerId).get();
    if (!playersQuery.exists) {
      console.error(`❌ Player not found: ${playerId}`);
      process.exit(1);
    }
  } else {
    playersQuery = await db.collection('players_v2').get();
  }

  const playerDocs = playerId
    ? [playersQuery as FirebaseFirestore.DocumentSnapshot]
    : (playersQuery as FirebaseFirestore.QuerySnapshot).docs;

  stats.totalPlayers = playerDocs.length;
  console.log(`📊 Processing ${stats.totalPlayers} player(s)...\n`);

  // Process in batches for write mode
  const BATCH_SIZE = 500;
  let batch = db.batch();
  let batchCount = 0;

  for (const playerDoc of playerDocs) {
    const id = playerDoc.id;
    const data = playerDoc.data();

    // Check if optionsByYear already exists
    const existingOptionsByYear = data?.currentContractView?.optionsByYear;
    if (
      existingOptionsByYear &&
      Object.keys(existingOptionsByYear).length > 0
    ) {
      stats.playersSkipped++;
      continue;
    }

    // Build optionsByYear from contracts subcollection
    const optionsByYear = await buildOptionsByYear(id);

    if (!optionsByYear) {
      // No contracts or no options found
      continue;
    }

    stats.playersWithContracts++;
    stats.playersWithOptions++;

    // Count option types
    Object.values(optionsByYear).forEach((opt) => {
      stats.optionBreakdown[opt]++;
    });

    // Log sample
    if (stats.playersUpdated < 5) {
      console.log(
        `   ✅ ${id}: optionsByYear = ${JSON.stringify(optionsByYear)}`
      );
    }

    if (write) {
      const playerRef = db.collection('players_v2').doc(id);
      batch.update(playerRef, {
        'currentContractView.optionsByYear': optionsByYear,
        updatedAt: FieldValue.serverTimestamp(),
      });
      batchCount++;

      if (batchCount >= BATCH_SIZE) {
        await batch.commit();
        console.log(`   📦 Committed batch of ${batchCount} updates`);
        batch = db.batch();
        batchCount = 0;
      }
    }

    stats.playersUpdated++;
  }

  // Commit any remaining updates
  if (write && batchCount > 0) {
    await batch.commit();
    console.log(`   📦 Committed final batch of ${batchCount} updates`);
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 BACKFILL SUMMARY');
  console.log('='.repeat(60));
  console.log(`   Total players:       ${stats.totalPlayers}`);
  console.log(`   With contracts:      ${stats.playersWithContracts}`);
  console.log(`   With options:        ${stats.playersWithOptions}`);
  console.log(`   Already had data:    ${stats.playersSkipped} (skipped)`);
  console.log(`   Would update:        ${stats.playersUpdated}`);
  console.log('');
  console.log('   Option Type Breakdown:');
  console.log(`     PO (Player):       ${stats.optionBreakdown.PO}`);
  console.log(`     TO (Team):         ${stats.optionBreakdown.TO}`);
  console.log(`     ETO (Early Term):  ${stats.optionBreakdown.ETO}`);
  console.log('='.repeat(60));

  if (!write) {
    console.log('\n⚠️  DRY RUN - No changes written');
    console.log('   Run with --write to apply changes\n');
  } else {
    console.log(
      `\n✅ Successfully updated ${stats.playersUpdated} player documents\n`
    );
  }

  return stats;
}

// =====================
// CLI Entry Point
// =====================

async function main() {
  const args = process.argv.slice(2);
  const write = args.includes('--write');
  const playerArg = args.find((a) => a.startsWith('--player='));
  const playerId = playerArg ? playerArg.split('=')[1] : undefined;

  try {
    await backfillOptionsByYear({ write, playerId });
    process.exit(0);
  } catch (error) {
    console.error('❌ Backfill failed:', error);
    process.exit(1);
  }
}

main();
