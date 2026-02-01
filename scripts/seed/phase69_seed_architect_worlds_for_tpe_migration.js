#!/usr/bin/env node
/**
 * FILE: scripts/seed/phase69_seed_architect_worlds_for_tpe_migration.js
 * PURPOSE: Seed emulator with deterministic test data for TPE migration proof.
 *          Creates world + teams with both legacy tradeExceptions and canonical exceptions.tpe
 *          to prove verify-only detects legacy data and write-mode removes it.
 * OWNERSHIP: Tooling: TPE migration proof harness
 *
 * HISTORY:
 *  - 2026-02-01: Phase 69 - Created for seeded emulator proof harness
 *
 * LINKS:
 *  - Master Doc: docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md
 *  - Migration Script: scripts/migrations/phase66_migrate_tradeExceptions.js
 *  - Phase 69 Return Package: docs/architect/return_packages/PHASE_69_SEEDED_VERIFY_ONLY_NONEMPTY_PROOF_EXECUTION_RETURN_PACKAGE.md
 *
 * USAGE:
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8082 node scripts/seed/phase69_seed_architect_worlds_for_tpe_migration.js
 *
 * REQUIREMENTS:
 *   - FIRESTORE_EMULATOR_HOST must be set (refuses to run against production)
 *   - Creates deterministic worldId: phase69_seed_world
 *   - Idempotent: re-running produces same docs / overwrites safely
 */

import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ESM __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// Configuration - Deterministic IDs for reproducibility
// ============================================================================
const DETERMINISTIC_WORLD_ID = 'phase69_seed_world';
const DETERMINISTIC_TIMESTAMP = '2026-02-01T00:00:00.000Z';

// Team codes to seed
const TEAM_WITH_LEGACY = 'BOS'; // Will have legacy tradeExceptions
const TEAM_WITH_CANONICAL = 'LAL'; // Will have canonical exceptions.tpe only
const TEAM_WITH_BOTH = 'MIA'; // Will have BOTH legacy + canonical (merge test)

// ============================================================================
// Minimal Valid Team Doc Shapes
// ============================================================================

/**
 * Create minimal world doc.
 */
function createWorldDoc() {
  return {
    name: 'Phase 69 Seed World',
    season: '2025-26',
    createdAt: DETERMINISTIC_TIMESTAMP,
    updatedAt: DETERMINISTIC_TIMESTAMP,
    // Minimal required fields for a valid world doc
    status: 'active',
  };
}

/**
 * Create a team doc with LEGACY tradeExceptions field.
 * This is what the migration script should detect and migrate.
 */
function createTeamWithLegacyTpe(teamCode) {
  return {
    teamCode,
    name: `${teamCode} - Legacy TPE Team`,
    // LEGACY FIELD - this is what Phase 66 migration should remove
    tradeExceptions: [
      {
        id: `legacy-tpe-${teamCode}-001`,
        totalAmount: 5000000,
        remainingAmount: 5000000,
        createdFrom: 'trade',
        createdOn: DETERMINISTIC_TIMESTAMP,
        expiresOn: '2026-07-15T00:00:00.000Z',
        createdSeason: '2025-26',
        isUsed: false,
      },
      {
        id: `legacy-tpe-${teamCode}-002`,
        totalAmount: 2500000,
        remainingAmount: 2500000,
        createdFrom: 'trade',
        createdOn: DETERMINISTIC_TIMESTAMP,
        expiresOn: '2026-07-15T00:00:00.000Z',
        createdSeason: '2025-26',
        isUsed: false,
      },
    ],
    // No canonical exceptions.tpe
    exceptions: {},
    updatedAt: DETERMINISTIC_TIMESTAMP,
  };
}

/**
 * Create a team doc with CANONICAL exceptions.tpe field only.
 * This is the correct schema that should pass verification.
 */
function createTeamWithCanonicalTpe(teamCode) {
  return {
    teamCode,
    name: `${teamCode} - Canonical TPE Team`,
    // CANONICAL FIELD - correct location
    exceptions: {
      tpe: [
        {
          id: `canonical-tpe-${teamCode}-001`,
          totalAmount: 8000000,
          remainingAmount: 8000000,
          createdFrom: 'trade',
          createdOn: DETERMINISTIC_TIMESTAMP,
          expiresOn: '2026-07-15T00:00:00.000Z',
          createdSeason: '2025-26',
          isUsed: false,
        },
      ],
    },
    // NO tradeExceptions field
    updatedAt: DETERMINISTIC_TIMESTAMP,
  };
}

/**
 * Create a team doc with BOTH legacy and canonical TPE fields.
 * Migration should merge and remove legacy.
 */
function createTeamWithBothTpe(teamCode) {
  return {
    teamCode,
    name: `${teamCode} - Both TPE Schemas Team`,
    // LEGACY FIELD - will be merged into canonical
    tradeExceptions: [
      {
        id: `legacy-tpe-${teamCode}-001`,
        totalAmount: 3000000,
        remainingAmount: 3000000,
        createdFrom: 'trade',
        createdOn: DETERMINISTIC_TIMESTAMP,
        expiresOn: '2026-07-15T00:00:00.000Z',
        createdSeason: '2025-26',
        isUsed: false,
      },
    ],
    // CANONICAL FIELD - already has some TPEs
    exceptions: {
      tpe: [
        {
          id: `canonical-tpe-${teamCode}-001`,
          totalAmount: 4000000,
          remainingAmount: 4000000,
          createdFrom: 'trade',
          createdOn: DETERMINISTIC_TIMESTAMP,
          expiresOn: '2026-07-15T00:00:00.000Z',
          createdSeason: '2025-26',
          isUsed: false,
        },
      ],
    },
    updatedAt: DETERMINISTIC_TIMESTAMP,
  };
}

// ============================================================================
// Firebase Initialization (Emulator Only)
// ============================================================================
function initializeFirebase() {
  // CRITICAL: Refuse to run against production
  if (!process.env.FIRESTORE_EMULATOR_HOST) {
    console.error(
      '[ERROR] FIRESTORE_EMULATOR_HOST is not set. This script only runs against emulator.'
    );
    console.error(
      '        Set FIRESTORE_EMULATOR_HOST=127.0.0.1:8082 and try again.'
    );
    process.exit(1);
  }

  if (admin.apps.length) {
    return admin.firestore();
  }

  console.log(
    `[INFO] Using Firestore emulator at ${process.env.FIRESTORE_EMULATOR_HOST}`
  );
  admin.initializeApp({ projectId: 'demo-scoutzero' });

  return admin.firestore();
}

// ============================================================================
// Seed Functions
// ============================================================================

/**
 * Seed the world doc and team docs.
 * Idempotent: overwrites existing docs with same IDs.
 */
async function seedPhase69World(db) {
  const worldId = DETERMINISTIC_WORLD_ID;
  const worldRef = db.collection('architect_worlds').doc(worldId);
  const teamsRef = worldRef.collection('teams');

  console.log('============================================================');
  console.log(
    'Phase 69 Seed: Creating Architect World for TPE Migration Proof'
  );
  console.log('============================================================');
  console.log(`World ID: ${worldId}`);
  console.log(`Emulator: ${process.env.FIRESTORE_EMULATOR_HOST}`);
  console.log('============================================================\n');

  // 1) Create world doc
  const worldDoc = createWorldDoc();
  await worldRef.set(worldDoc, { merge: false });
  console.log(`[SEEDED] World doc: architect_worlds/${worldId}`);

  // 2) Create team docs
  const teamsToSeed = [
    {
      teamCode: TEAM_WITH_LEGACY,
      doc: createTeamWithLegacyTpe(TEAM_WITH_LEGACY),
      legacy: true,
    },
    {
      teamCode: TEAM_WITH_CANONICAL,
      doc: createTeamWithCanonicalTpe(TEAM_WITH_CANONICAL),
      legacy: false,
    },
    {
      teamCode: TEAM_WITH_BOTH,
      doc: createTeamWithBothTpe(TEAM_WITH_BOTH),
      legacy: true,
    },
  ];

  for (const { teamCode, doc, legacy } of teamsToSeed) {
    const teamRef = teamsRef.doc(teamCode);
    await teamRef.set(doc, { merge: false });
    const legacyLabel = legacy ? '[LEGACY]' : '[CANONICAL]';
    console.log(
      `[SEEDED] Team doc: architect_worlds/${worldId}/teams/${teamCode} ${legacyLabel}`
    );
  }

  // 3) Summary
  const legacyTeams = teamsToSeed
    .filter((t) => t.legacy)
    .map((t) => t.teamCode);
  const canonicalTeams = teamsToSeed
    .filter((t) => !t.legacy)
    .map((t) => t.teamCode);

  console.log('\n============================================================');
  console.log('SEED SUMMARY');
  console.log('============================================================');
  console.log(`World ID: ${worldId}`);
  console.log(`Total teams seeded: ${teamsToSeed.length}`);
  console.log(`Teams with LEGACY tradeExceptions: ${legacyTeams.join(', ')}`);
  console.log(
    `Teams with CANONICAL exceptions.tpe only: ${canonicalTeams.join(', ')}`
  );
  console.log('============================================================\n');

  return {
    worldId,
    teamsSeeded: teamsToSeed.length,
    legacyTeams,
    canonicalTeams,
  };
}

// ============================================================================
// Entry Point
// ============================================================================
async function main() {
  const db = initializeFirebase();

  try {
    const result = await seedPhase69World(db);
    console.log('[SUCCESS] Phase 69 seed complete.');
    console.log(`\nNext steps:`);
    console.log(`  1. Run verify-only (should FAIL with legacy detected):`);
    console.log(
      `     FIRESTORE_EMULATOR_HOST=127.0.0.1:8082 node scripts/migrations/phase66_migrate_tradeExceptions.js --verify-only`
    );
    console.log(`  2. Run write migration:`);
    console.log(
      `     FIRESTORE_EMULATOR_HOST=127.0.0.1:8082 node scripts/migrations/phase66_migrate_tradeExceptions.js --write --worldId=${result.worldId}`
    );
    console.log(`  3. Run verify-only again (should PASS):`);
    console.log(
      `     FIRESTORE_EMULATOR_HOST=127.0.0.1:8082 node scripts/migrations/phase66_migrate_tradeExceptions.js --verify-only`
    );
    process.exit(0);
  } catch (err) {
    console.error('[ERROR] Seed failed:', err);
    process.exit(1);
  }
}

main();
