#!/usr/bin/env node
/**
 * FILE: scripts/migrations/phase2y_backfill_optionsByYear.js
 * PURPOSE: Backfill players_v2.currentContractView.optionsByYear from contracts subcollection.
 *          This enables the Option Type filter to return real players.
 * OWNERSHIP: Feature: scouting/player-table
 *
 * HISTORY:
 *  - 2026-02-02: Phase 2Y - Created for option types backfill migration
 *
 * LINKS:
 *  - Master Doc: docs/scouting/SCOUTING_PLAYER_TABLE_MASTER_AUDIT.md
 *  - Execution Prompt: Phase 2Y execution prompt
 *
 * USAGE:
 *   node scripts/migrations/phase2y_backfill_optionsByYear.js                    # Dry run (default)
 *   node scripts/migrations/phase2y_backfill_optionsByYear.js --write            # Write to Firestore
 *   node scripts/migrations/phase2y_backfill_optionsByYear.js --player=<id>      # Single player dry run
 *   node scripts/migrations/phase2y_backfill_optionsByYear.js --player=<id> --write  # Single player write
 *
 * CLI OPTIONS:
 *   --write               Actually perform writes to Firestore (default: dry run)
 *   --player=<id>         Target a specific player by ID
 *   --help, -h            Show help message
 *
 * ENVIRONMENT:
 *   FIRESTORE_EMULATOR_HOST - If set, uses emulator
 *
 * SAFETY:
 *   - Idempotent: Safe to re-run (only updates if data differs)
 *   - Dry run default: No writes unless --write is specified
 *   - Production safety: Refuses --write to prod unless emulator or explicit env var
 */

import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ESM __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// Configuration
// ============================================================================
const PLAYERS_COLLECTION = 'players_v2';
const CONTRACTS_SUBCOLLECTION = 'contracts';
const BATCH_SIZE = 100;

// ============================================================================
// CLI Argument Parsing
// ============================================================================
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    write: false,
    playerId: null,
    help: false,
  };

  for (const arg of args) {
    if (arg === '--write') {
      options.write = true;
    } else if (arg.startsWith('--player=')) {
      options.playerId = arg.split('=')[1];
    } else if (arg === '--help' || arg === '-h') {
      options.help = true;
    }
  }

  return options;
}

function showHelp() {
  console.log(`
Phase 2Y: Backfill optionsByYear Migration Script

USAGE:
  node scripts/migrations/phase2y_backfill_optionsByYear.js [options]

OPTIONS:
  --write            Actually perform writes (default: dry run)
  --player=<id>      Target a specific player by ID
  --help, -h         Show this help message

EXAMPLES:
  # Dry run (scan all players, report what would change)
  node scripts/migrations/phase2y_backfill_optionsByYear.js

  # Write mode (actually update Firestore)
  node scripts/migrations/phase2y_backfill_optionsByYear.js --write

  # Single player dry run
  node scripts/migrations/phase2y_backfill_optionsByYear.js --player=aaron_gordon

  # Single player write
  node scripts/migrations/phase2y_backfill_optionsByYear.js --player=aaron_gordon --write
`);
}

// ============================================================================
// Firebase Initialization
// ============================================================================
function initializeFirebase() {
  if (admin.apps.length) {
    return admin.firestore();
  }

  const isEmulator = !!process.env.FIRESTORE_EMULATOR_HOST;

  if (isEmulator) {
    const projectId =
      process.env.GCLOUD_PROJECT ||
      process.env.FIREBASE_PROJECT_ID ||
      'scoutzero-bf1ae';
    console.log(
      `[INFO] Using Firestore emulator at ${process.env.FIRESTORE_EMULATOR_HOST} (project: ${projectId})`
    );
    admin.initializeApp({ projectId });
  } else {
    // Production mode - use service account
    const serviceAccountPath = path.resolve(
      __dirname,
      '../../serviceAccountKey.json'
    );
    if (!fs.existsSync(serviceAccountPath)) {
      console.error(
        '[ERROR] serviceAccountKey.json not found. Required for production Firestore access.'
      );
      process.exit(1);
    }
    const serviceAccount = JSON.parse(
      fs.readFileSync(serviceAccountPath, 'utf-8')
    );
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log('[INFO] Using production Firestore with service account');
  }

  return admin.firestore();
}

/**
 * Check if production write is allowed
 */
function checkProductionWriteSafety(writeMode) {
  const isEmulator = !!process.env.FIRESTORE_EMULATOR_HOST;
  const allowProdWrite = process.env.ALLOW_PROD_MIGRATION_WRITE === 'true';

  if (writeMode && !isEmulator && !allowProdWrite) {
    console.error(`
[ERROR] Production write refused!

You are attempting to write to PRODUCTION Firestore without explicit permission.
To proceed, either:
  1. Use the emulator: FIRESTORE_EMULATOR_HOST=localhost:8080
  2. Set explicit permission: ALLOW_PROD_MIGRATION_WRITE=true

This safety latch prevents accidental production data modifications.
`);
    process.exit(1);
  }

  if (writeMode && !isEmulator && allowProdWrite) {
    console.warn(
      '[WARN] Production write ENABLED via ALLOW_PROD_MIGRATION_WRITE=true'
    );
  }
}

// ============================================================================
// Core Migration Logic
// ============================================================================

/**
 * Extract seasonStartYear from season string
 * "2025-26" → 2025
 * "2025" → 2025
 * 2025 → 2025
 *
 * @param {string|number} season
 * @returns {string|null} seasonStartYear as string (e.g., "2025") or null if invalid
 */
function extractSeasonStartYear(season) {
  if (typeof season === 'number') {
    return String(season);
  }
  if (typeof season === 'string') {
    // Handle "2025-26" format
    if (season.includes('-')) {
      const startYear = season.split('-')[0];
      const parsed = parseInt(startYear, 10);
      return Number.isFinite(parsed) ? String(parsed) : null;
    }
    // Handle "2025" format
    const parsed = parseInt(season, 10);
    return Number.isFinite(parsed) ? String(parsed) : null;
  }
  return null;
}

/**
 * Build optionsByYear map from contracts subcollection
 *
 * @param {Array} contracts - Array of contract docs from subcollection
 * @returns {Object} optionsByYear map { "2025": "PO", "2026": "TO", ... }
 */
function buildOptionsByYear(contracts) {
  const optionsByYear = {};

  for (const contract of contracts) {
    const salariesByYear = contract.salariesByYear || [];
    const isCurrent =
      contract.metadata?.isCurrent ?? contract.isCurrent ?? true;

    // Prioritize current contract
    for (const salaryRow of salariesByYear) {
      const option = salaryRow.option;
      if (!option) continue;

      const season = salaryRow.season || salaryRow.year;
      const yearKey = extractSeasonStartYear(season);
      if (!yearKey) continue;

      // Normalize option value
      const normalizedOption = normalizeOptionType(option);
      if (!normalizedOption) continue;

      // Only overwrite if this is the current contract or key doesn't exist
      if (isCurrent || !optionsByYear[yearKey]) {
        optionsByYear[yearKey] = normalizedOption;
      }
    }
  }

  return optionsByYear;
}

/**
 * Normalize option type string to canonical format
 * "Player Option" → "PO", "Team Option" → "TO", "Early Termination" → "ETO"
 *
 * @param {string} option
 * @returns {string|null}
 */
function normalizeOptionType(option) {
  if (!option || typeof option !== 'string') return null;

  const normalized = option.toUpperCase().trim();

  // Already in canonical format
  if (['PO', 'TO', 'ETO'].includes(normalized)) {
    return normalized;
  }

  // Long form conversions
  if (normalized.includes('PLAYER')) return 'PO';
  if (normalized.includes('TEAM')) return 'TO';
  if (normalized.includes('EARLY') || normalized.includes('TERMINATION')) {
    return 'ETO';
  }

  // Unknown format - log and skip
  console.warn(`[WARN] Unknown option type format: "${option}"`);
  return null;
}

/**
 * Check if two optionsByYear maps are equal
 */
function areOptionsByYearEqual(existing, computed) {
  if (!existing && !computed) return true;
  if (!existing || !computed) return false;

  const existingKeys = Object.keys(existing).sort();
  const computedKeys = Object.keys(computed).sort();

  if (existingKeys.length !== computedKeys.length) return false;

  for (const key of existingKeys) {
    if (existing[key] !== computed[key]) return false;
  }

  return true;
}

/**
 * Process a single player
 *
 * @param {FirebaseFirestore.Firestore} db
 * @param {string} playerId
 * @param {boolean} writeMode
 * @returns {Object} Result object
 */
async function processPlayer(db, playerId, writeMode) {
  const playerRef = db.collection(PLAYERS_COLLECTION).doc(playerId);
  const playerDoc = await playerRef.get();

  if (!playerDoc.exists) {
    return {
      status: 'not_found',
      playerId,
      message: 'Player document not found',
    };
  }

  const playerData = playerDoc.data();
  const playerName = playerData.bio?.displayName || playerId;

  // Get contracts subcollection
  const contractsSnapshot = await playerRef
    .collection(CONTRACTS_SUBCOLLECTION)
    .get();

  if (contractsSnapshot.empty) {
    return {
      status: 'no_contracts',
      playerId,
      playerName,
      message: 'No contracts subcollection',
    };
  }

  // Build optionsByYear from contracts
  const contracts = contractsSnapshot.docs.map((doc) => doc.data());
  const computedOptionsByYear = buildOptionsByYear(contracts);

  // Check existing optionsByYear
  const existingOptionsByYear = playerData.currentContractView?.optionsByYear;

  // Skip if no options found
  if (Object.keys(computedOptionsByYear).length === 0) {
    return {
      status: 'no_options',
      playerId,
      playerName,
      message: 'No option data in contracts',
    };
  }

  // Skip if already equal
  if (areOptionsByYearEqual(existingOptionsByYear, computedOptionsByYear)) {
    return {
      status: 'already_current',
      playerId,
      playerName,
      optionsByYear: computedOptionsByYear,
      message: 'Already has correct optionsByYear',
    };
  }

  // Prepare update
  const updateData = {
    'currentContractView.optionsByYear': computedOptionsByYear,
  };

  if (writeMode) {
    await playerRef.update(updateData);
    return {
      status: 'updated',
      playerId,
      playerName,
      optionsByYear: computedOptionsByYear,
      previousOptionsByYear: existingOptionsByYear || null,
      message: 'Successfully updated optionsByYear',
    };
  } else {
    return {
      status: 'would_update',
      playerId,
      playerName,
      optionsByYear: computedOptionsByYear,
      previousOptionsByYear: existingOptionsByYear || null,
      message: 'Would update optionsByYear (dry run)',
    };
  }
}

/**
 * Run migration for all players
 */
async function runMigration(options) {
  const db = initializeFirebase();

  console.log('');
  console.log('='.repeat(60));
  console.log('Phase 2Y: Backfill optionsByYear Migration');
  console.log('='.repeat(60));
  console.log(`Mode: ${options.write ? 'WRITE' : 'DRY RUN'}`);
  console.log(
    `Target: ${options.playerId ? `Single player (${options.playerId})` : 'All players'}`
  );
  console.log(
    `Firestore: ${process.env.FIRESTORE_EMULATOR_HOST ? 'Emulator' : 'Production'}`
  );
  console.log('='.repeat(60));
  console.log('');

  // Summary counters
  const summary = {
    total: 0,
    notFound: 0,
    noContracts: 0,
    noOptions: 0,
    alreadyCurrent: 0,
    updated: 0,
    wouldUpdate: 0,
    errors: 0,
    optionBreakdown: {
      PO: 0,
      TO: 0,
      ETO: 0,
    },
  };

  const results = [];

  try {
    if (options.playerId) {
      // Single player mode
      summary.total = 1;
      const result = await processPlayer(db, options.playerId, options.write);
      results.push(result);
    } else {
      // All players mode
      const playersSnapshot = await db.collection(PLAYERS_COLLECTION).get();
      summary.total = playersSnapshot.size;

      console.log(`[INFO] Found ${summary.total} players to process...`);
      console.log('');

      let processed = 0;
      for (const playerDoc of playersSnapshot.docs) {
        try {
          const result = await processPlayer(db, playerDoc.id, options.write);
          results.push(result);
        } catch (err) {
          summary.errors++;
          results.push({
            status: 'error',
            playerId: playerDoc.id,
            message: err.message,
          });
        }

        processed++;
        if (processed % 50 === 0) {
          console.log(`[INFO] Processed ${processed}/${summary.total}...`);
        }
      }
    }

    // Tabulate results
    for (const result of results) {
      switch (result.status) {
        case 'not_found':
          summary.notFound++;
          break;
        case 'no_contracts':
          summary.noContracts++;
          break;
        case 'no_options':
          summary.noOptions++;
          break;
        case 'already_current':
          summary.alreadyCurrent++;
          // Count option types
          if (result.optionsByYear) {
            for (const opt of Object.values(result.optionsByYear)) {
              if (summary.optionBreakdown[opt] !== undefined) {
                summary.optionBreakdown[opt]++;
              }
            }
          }
          break;
        case 'updated':
          summary.updated++;
          if (result.optionsByYear) {
            for (const opt of Object.values(result.optionsByYear)) {
              if (summary.optionBreakdown[opt] !== undefined) {
                summary.optionBreakdown[opt]++;
              }
            }
          }
          break;
        case 'would_update':
          summary.wouldUpdate++;
          if (result.optionsByYear) {
            for (const opt of Object.values(result.optionsByYear)) {
              if (summary.optionBreakdown[opt] !== undefined) {
                summary.optionBreakdown[opt]++;
              }
            }
          }
          break;
        case 'error':
          summary.errors++;
          break;
      }
    }

    // Print detailed results for single player or updates
    if (options.playerId || summary.updated > 0 || summary.wouldUpdate > 0) {
      console.log('');
      console.log('DETAILED RESULTS:');
      console.log('-'.repeat(60));
      for (const result of results) {
        if (
          result.status === 'updated' ||
          result.status === 'would_update' ||
          options.playerId
        ) {
          console.log(`  ${result.playerName || result.playerId}:`);
          console.log(`    Status: ${result.status}`);
          if (result.optionsByYear) {
            console.log(
              `    optionsByYear: ${JSON.stringify(result.optionsByYear)}`
            );
          }
          if (result.previousOptionsByYear) {
            console.log(
              `    Previous: ${JSON.stringify(result.previousOptionsByYear)}`
            );
          }
          console.log(`    Message: ${result.message}`);
          console.log('');
        }
      }
    }

    // Print summary
    console.log('');
    console.log('='.repeat(60));
    console.log('SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total players scanned:  ${summary.total}`);
    console.log(`  - Not found:          ${summary.notFound}`);
    console.log(`  - No contracts:       ${summary.noContracts}`);
    console.log(`  - No option data:     ${summary.noOptions}`);
    console.log(`  - Already current:    ${summary.alreadyCurrent}`);
    if (options.write) {
      console.log(`  - Updated:            ${summary.updated}`);
    } else {
      console.log(`  - Would update:       ${summary.wouldUpdate}`);
    }
    console.log(`  - Errors:             ${summary.errors}`);
    console.log('');
    console.log('Option Types Breakdown (across all options):');
    console.log(`  - PO (Player Option): ${summary.optionBreakdown.PO}`);
    console.log(`  - TO (Team Option):   ${summary.optionBreakdown.TO}`);
    console.log(`  - ETO (Early Term.):  ${summary.optionBreakdown.ETO}`);
    console.log('='.repeat(60));

    // Exit code
    if (summary.errors > 0) {
      console.log('[WARN] Migration completed with errors');
      process.exit(1);
    } else {
      console.log('[INFO] Migration completed successfully');
      process.exit(0);
    }
  } catch (err) {
    console.error('[ERROR] Migration failed:', err.message);
    process.exit(1);
  }
}

// ============================================================================
// Main
// ============================================================================
const options = parseArgs();

if (options.help) {
  showHelp();
  process.exit(0);
}

checkProductionWriteSafety(options.write);
runMigration(options);
