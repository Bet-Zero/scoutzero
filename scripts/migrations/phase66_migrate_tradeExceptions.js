#!/usr/bin/env node
/**
 * FILE: scripts/migrations/phase66_migrate_tradeExceptions.js
 * PURPOSE: Migrate persisted team docs to remove legacy tradeExceptions field.
 *          Normalizes to canonical exceptions.tpe location using normalizeTeamTpeSchema.
 * OWNERSHIP: Feature: architect/core
 *
 * HISTORY:
 *  - 2026-02-01: Phase 70 - Added production write safety latch (refuses --write unless emulator or ALLOW_PROD_MIGRATION_WRITE=true)
 *  - 2026-02-01: Phase 68 - Added empty-scan fail-safe (CI-trustworthy verify-only), --allow-empty escape hatch, explicit environment output
 *  - 2026-02-01: Phase 67 - Added --dry-run, --verify-only, --output-dir CLI options
 *  - 2026-01-31: Phase 66 - Created for legacy tradeExceptions migration
 *
 * LINKS:
 *  - Master Doc: docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md
 *  - Phase 66 Prompt: Phase 66 execution prompt
 *  - Phase 67 Prompt: Phase 67 execution prompt
 *  - Phase 68 Prompt: Phase 68 execution prompt
 *
 * USAGE:
 *   node scripts/migrations/phase66_migrate_tradeExceptions.js --dry-run
 *   node scripts/migrations/phase66_migrate_tradeExceptions.js --worldId=<WORLD_ID> --dry-run
 *   node scripts/migrations/phase66_migrate_tradeExceptions.js --worldId=<WORLD_ID>
 *   node scripts/migrations/phase66_migrate_tradeExceptions.js --verify-only
 *   node scripts/migrations/phase66_migrate_tradeExceptions.js --verify-only --allow-empty
 *
 * CLI OPTIONS:
 *   --dry-run              Report only, no writes (same as DRY_RUN=true)
 *   --verify-only          Scan and FAIL (exit 1) if ANY legacy occurrences OR if empty scan (0 worlds/teams)
 *   --allow-empty          In verify-only mode, allow empty scans (0 worlds/teams) without failing
 *   --worldId=<WORLD_ID>   Target a specific world
 *   --output-dir=<PATH>    Override output directory for reports
 *   --help, -h             Show help message
 *
 * ENVIRONMENT:
 *   DRY_RUN=true           Report only, no writes (default: true for safety)
 *   DRY_RUN=false          Actually perform writes
 *   FIRESTORE_EMULATOR_HOST - If set, uses emulator
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
let DRY_RUN = process.env.DRY_RUN !== 'false'; // Default to dry run for safety
let VERIFY_ONLY = false;
let ALLOW_EMPTY = false; // Phase 68: By default, empty scans fail in verify-only mode
let OUTPUT_DIR = null;
const BATCH_SIZE = 100;

// ============================================================================
// Firebase Initialization
// ============================================================================
function initializeFirebase() {
  if (admin.apps.length) {
    return admin.firestore();
  }

  // Check for emulator
  if (process.env.FIRESTORE_EMULATOR_HOST) {
    console.log(
      `[INFO] Using Firestore emulator at ${process.env.FIRESTORE_EMULATOR_HOST}`
    );
    admin.initializeApp({ projectId: 'demo-scoutzero' });
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
    // ESM-compatible: use fs.readFileSync instead of require()
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
 * Phase 68: Print explicit environment targeting info at start.
 * Makes it clear which Firestore instance the script is connecting to.
 */
function printEnvironmentInfo() {
  console.log('============================================================');
  console.log('ENVIRONMENT TARGETING (Phase 68)');
  console.log('============================================================');

  // Project ID
  const projectId =
    admin.apps.length > 0
      ? admin.app().options.projectId || 'unknown'
      : 'not-yet-initialized';
  console.log(`Project ID: ${projectId}`);

  // Emulator detection
  const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST;
  if (emulatorHost) {
    console.log(`Emulator Host: ${emulatorHost}`);
    console.log('Firestore Instance: EMULATOR');
  } else {
    console.log('Emulator Host: NOT SET');
    console.log('Firestore Instance: PRODUCTION');
  }

  console.log('============================================================\n');
}

// ============================================================================
// TPE Normalization Logic (Inline copy to avoid ESM/CJS issues)
// ============================================================================

/**
 * Generate a deterministic identity key for a TPE item.
 */
function getTpeIdentityKey(tpe) {
  if (tpe && tpe.id) {
    return `id:${tpe.id}`;
  }
  const stableFields = [
    'totalAmount',
    'amount',
    'createdFrom',
    'createdOn',
    'expiresOn',
    'createdSeason',
  ];
  const signature = stableFields
    .filter((key) => tpe && tpe[key] !== undefined)
    .map((key) => `${key}:${JSON.stringify(tpe[key])}`)
    .join('|');
  return `sig:${signature}`;
}

/**
 * Normalize team TPE schema for persistence.
 * Merges legacy tradeExceptions into canonical exceptions.tpe and removes legacy field.
 */
function normalizeTeamTpeSchema(team) {
  if (!team || typeof team !== 'object') {
    return team;
  }

  const result = { ...team };
  const legacyTPEs = Array.isArray(result.tradeExceptions)
    ? result.tradeExceptions
    : [];
  const canonicalTPEs = Array.isArray(result.exceptions?.tpe)
    ? result.exceptions.tpe
    : [];

  if (
    legacyTPEs.length === 0 &&
    canonicalTPEs.length === 0 &&
    !('tradeExceptions' in result)
  ) {
    return result;
  }

  const mergedMap = new Map();
  for (const tpe of legacyTPEs) {
    mergedMap.set(getTpeIdentityKey(tpe), tpe);
  }
  for (const tpe of canonicalTPEs) {
    mergedMap.set(getTpeIdentityKey(tpe), tpe);
  }

  const mergedTPEs = Array.from(mergedMap.entries())
    .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
    .map(([, tpe]) => tpe);

  result.exceptions = result.exceptions ? { ...result.exceptions } : {};
  result.exceptions.tpe = mergedTPEs;
  delete result.tradeExceptions;

  return result;
}

// ============================================================================
// CLI Argument Parsing
// ============================================================================
function parseArgs() {
  const args = process.argv.slice(2);
  const result = {
    worldId: null,
    dryRun: true,
    verifyOnly: false,
    allowEmpty: false, // Phase 68: escape hatch for empty scans
    outputDir: null,
  };

  for (const arg of args) {
    if (arg.startsWith('--worldId=')) {
      result.worldId = arg.split('=')[1];
    } else if (arg === '--dry-run') {
      result.dryRun = true;
    } else if (arg === '--write') {
      result.dryRun = false;
    } else if (arg === '--verify-only') {
      result.verifyOnly = true;
      result.dryRun = true; // verify-only implies dry-run
    } else if (arg === '--allow-empty') {
      result.allowEmpty = true; // Phase 68: allow 0 worlds/teams without failing
    } else if (arg.startsWith('--output-dir=')) {
      result.outputDir = arg.split('=')[1];
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
Phase 66/67/68 Migration: Remove legacy tradeExceptions from persisted team docs

USAGE:
  node scripts/migrations/phase66_migrate_tradeExceptions.js [options]

OPTIONS:
  --dry-run              Report only, no writes (DEFAULT - for safety)
  --write                Actually perform writes (USE WITH CAUTION)
                         Phase 70 safety latch: --write is REFUSED against production unless
                         ALLOW_PROD_MIGRATION_WRITE=true is set in environment.
                         This does not affect emulator or --verify-only modes.
  --verify-only          Scan for legacy occurrences only (exit code 1 if any found OR if empty scan)
  --allow-empty          Escape hatch: allow empty scans (0 worlds/teams) in verify-only mode
  --worldId=<WORLD_ID>   Target a specific world (otherwise scans all worlds)
  --output-dir=<DIR>     Directory for report files (default: scripts/migrations/reports)
  --help, -h             Show this help message

ENVIRONMENT:
  FIRESTORE_EMULATOR_HOST=host:port    Use Firestore emulator
  ALLOW_PROD_MIGRATION_WRITE=true      Phase 70: Required to use --write against production Firestore

NOTES:
  Phase 68 (CI safety): In --verify-only mode, the script fails (exit 1) if:
  - ANY legacy tradeExceptions fields are found, OR
  - Zero worlds or zero team docs were scanned (empty scan)
  Use --allow-empty to bypass the empty scan check (not recommended for CI).

EXAMPLES:
  # Dry run on all worlds (default safe mode)
  node scripts/migrations/phase66_migrate_tradeExceptions.js --dry-run

  # Verify-only scan (exit 1 if legacy found OR empty scan)
  node scripts/migrations/phase66_migrate_tradeExceptions.js --verify-only

  # Verify-only with empty scan allowed (escape hatch)
  node scripts/migrations/phase66_migrate_tradeExceptions.js --verify-only --allow-empty

  # Live migration on specific world (USE WITH CAUTION)
  node scripts/migrations/phase66_migrate_tradeExceptions.js --write --worldId=abc123

  # Write to custom output directory with deterministic filename
  node scripts/migrations/phase66_migrate_tradeExceptions.js --dry-run --output-dir=./reports
`);
      process.exit(0);
    }
  }

  // CLI options override environment variables
  if (result.dryRun === false) {
    DRY_RUN = false;
  }
  VERIFY_ONLY = result.verifyOnly;
  ALLOW_EMPTY = result.allowEmpty;
  OUTPUT_DIR = result.outputDir;

  // ============================================================================
  // Phase 70: Production Write Safety Latch
  // ============================================================================
  // Refuse --write against production unless explicit ALLOW_PROD_MIGRATION_WRITE=true
  // This does NOT affect emulator or --verify-only modes
  if (result.dryRun === false && !result.verifyOnly) {
    const isEmulator = !!process.env.FIRESTORE_EMULATOR_HOST;
    const allowProdWrite = process.env.ALLOW_PROD_MIGRATION_WRITE === 'true';

    if (!isEmulator && !allowProdWrite) {
      console.error(
        '============================================================'
      );
      console.error('[SAFETY LATCH] Phase 70: Production write REFUSED');
      console.error(
        '============================================================'
      );
      console.error(
        '--write is not allowed against production Firestore unless:'
      );
      console.error(
        '  1. FIRESTORE_EMULATOR_HOST is set (running against emulator), OR'
      );
      console.error(
        '  2. ALLOW_PROD_MIGRATION_WRITE=true is set in environment'
      );
      console.error('');
      console.error(
        'This is a safety measure to prevent accidental production writes.'
      );
      console.error('');
      console.error('To run against production, set the environment variable:');
      console.error(
        '  ALLOW_PROD_MIGRATION_WRITE=true node scripts/migrations/phase66_migrate_tradeExceptions.js --write'
      );
      console.error('');
      console.error(
        'Alternatively, use --verify-only to scan without writing.'
      );
      console.error(
        '============================================================'
      );
      process.exit(1);
    }

    if (!isEmulator && allowProdWrite) {
      console.warn(
        '============================================================'
      );
      console.warn('[SAFETY WARNING] ALLOW_PROD_MIGRATION_WRITE=true is set.');
      console.warn('This script will WRITE to production Firestore.');
      console.warn('Proceeding with write mode...');
      console.warn(
        '============================================================\n'
      );
    }
  }

  return result;
}

// ============================================================================
// Migration Logic
// ============================================================================

/**
 * Scan and migrate team docs in a world.
 * @returns {Object} Report for this world
 */
async function migrateWorld(db, worldId, dryRun) {
  const worldReport = {
    worldId,
    teamsScanned: 0,
    teamsWithLegacy: 0,
    teamsMigrated: 0,
    affectedTeamCodes: [],
    sampleBefore: null,
    sampleAfter: null,
    errors: [],
  };

  const teamsRef = db.collection(`architect_worlds/${worldId}/teams`);
  const snapshot = await teamsRef.get();

  if (snapshot.empty) {
    console.log(`  [${worldId}] No teams found`);
    return worldReport;
  }

  worldReport.teamsScanned = snapshot.size;

  const batch = db.batch();
  let batchCount = 0;

  for (const doc of snapshot.docs) {
    const teamCode = doc.id;
    const teamData = doc.data();

    // Check if doc has legacy field
    if (!('tradeExceptions' in teamData)) {
      continue;
    }

    worldReport.teamsWithLegacy++;
    worldReport.affectedTeamCodes.push(teamCode);

    // Capture sample before (keys only, first occurrence)
    if (!worldReport.sampleBefore) {
      worldReport.sampleBefore = {
        teamCode,
        keys: Object.keys(teamData).sort(),
        hasTradeExceptions: true,
        hasExceptionsTpe: Array.isArray(teamData.exceptions?.tpe),
        tradeExceptionsCount: Array.isArray(teamData.tradeExceptions)
          ? teamData.tradeExceptions.length
          : 0,
        exceptionsTpeCount: Array.isArray(teamData.exceptions?.tpe)
          ? teamData.exceptions.tpe.length
          : 0,
      };
    }

    // Normalize
    const normalized = normalizeTeamTpeSchema(teamData);

    // Capture sample after (first occurrence)
    if (!worldReport.sampleAfter) {
      worldReport.sampleAfter = {
        teamCode,
        keys: Object.keys(normalized).sort(),
        hasTradeExceptions: 'tradeExceptions' in normalized,
        hasExceptionsTpe: Array.isArray(normalized.exceptions?.tpe),
        exceptionsTpeCount: Array.isArray(normalized.exceptions?.tpe)
          ? normalized.exceptions.tpe.length
          : 0,
      };
    }

    if (!dryRun) {
      batch.set(doc.ref, normalized, { merge: false });
      batchCount++;

      // Commit batch if at limit
      if (batchCount >= BATCH_SIZE) {
        try {
          await batch.commit();
          worldReport.teamsMigrated += batchCount;
          batchCount = 0;
        } catch (err) {
          worldReport.errors.push(`Batch commit error: ${err.message}`);
        }
      }
    }
  }

  // Commit remaining
  if (!dryRun && batchCount > 0) {
    try {
      await batch.commit();
      worldReport.teamsMigrated += batchCount;
    } catch (err) {
      worldReport.errors.push(`Final batch commit error: ${err.message}`);
    }
  }

  console.log(
    `  [${worldId}] Scanned: ${worldReport.teamsScanned}, Legacy: ${worldReport.teamsWithLegacy}, Migrated: ${dryRun ? 'DRY RUN' : worldReport.teamsMigrated}`
  );

  return worldReport;
}

/**
 * Get all world IDs from architect_worlds collection.
 */
async function getAllWorldIds(db) {
  const snapshot = await db.collection('architect_worlds').listDocuments();
  return snapshot.map((doc) => doc.id);
}

/**
 * Main migration function.
 */
async function runMigration() {
  const args = parseArgs();
  const db = initializeFirebase();

  // Phase 68: Print explicit environment targeting info
  printEnvironmentInfo();

  console.log('============================================================');
  console.log('Phase 66/67/68 Migration: Remove legacy tradeExceptions');
  console.log('============================================================');
  console.log(
    `Mode: ${DRY_RUN ? 'DRY RUN (no writes)' : 'LIVE (will write changes)'}`
  );
  console.log(`Target: ${args.worldId || 'ALL WORLDS'}`);
  if (VERIFY_ONLY) {
    console.log(
      `Empty scan check: ${ALLOW_EMPTY ? 'DISABLED (--allow-empty)' : 'ENABLED (will fail on 0 worlds/teams)'}`
    );
  }
  console.log('============================================================\n');

  const modeLabel = VERIFY_ONLY ? 'VERIFY_ONLY' : DRY_RUN ? 'DRY_RUN' : 'LIVE';

  const report = {
    timestamp: new Date().toISOString(),
    mode: modeLabel,
    targetWorldId: args.worldId || 'ALL',
    totalWorldsScanned: 0,
    totalTeamsScanned: 0,
    totalTeamsWithLegacy: 0,
    totalTeamsMigrated: 0,
    worlds: [],
  };

  // Get world IDs to process
  let worldIds;
  if (args.worldId) {
    worldIds = [args.worldId];
  } else {
    worldIds = await getAllWorldIds(db);
  }

  report.totalWorldsScanned = worldIds.length;
  console.log(`Found ${worldIds.length} world(s) to scan\n`);

  // Process each world
  for (const worldId of worldIds) {
    const worldReport = await migrateWorld(db, worldId, DRY_RUN);
    report.worlds.push(worldReport);
    report.totalTeamsScanned += worldReport.teamsScanned;
    report.totalTeamsWithLegacy += worldReport.teamsWithLegacy;
    report.totalTeamsMigrated += worldReport.teamsMigrated;
  }

  // Generate reports with deterministic filenames
  const dateStr = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const outputDir = OUTPUT_DIR
    ? path.resolve(OUTPUT_DIR)
    : path.resolve(__dirname, '../../docs/architect/migrations');

  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Deterministic filename pattern: phase67_<mode>_<date>.{json,md}
  const fileBase = `phase67_${modeLabel.toLowerCase()}_${dateStr}`;

  // JSON report
  const jsonPath = path.join(outputDir, `${fileBase}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
  console.log(`\nJSON report written to: ${jsonPath}`);

  // Markdown report
  const mdPath = path.join(outputDir, `${fileBase}.md`);
  const mdContent = generateMarkdownReport(report);
  fs.writeFileSync(mdPath, mdContent);
  console.log(`Markdown report written to: ${mdPath}`);

  // Summary
  console.log('\n============================================================');
  console.log('MIGRATION SUMMARY');
  console.log('============================================================');
  console.log(`Mode: ${modeLabel}`);
  console.log(`Total worlds scanned: ${report.totalWorldsScanned}`);
  console.log(`Total team docs scanned: ${report.totalTeamsScanned}`);
  console.log(`Total docs with legacy field: ${report.totalTeamsWithLegacy}`);
  console.log(
    `Total docs migrated: ${DRY_RUN ? 'N/A (dry run)' : report.totalTeamsMigrated}`
  );
  console.log('============================================================\n');

  if (VERIFY_ONLY) {
    // Phase 68: Empty-scan fail-safe - CI must not get false green from 0 scans
    const worldsScanned = report.totalWorldsScanned;
    const teamDocsScanned = report.totalTeamsScanned;

    if ((worldsScanned === 0 || teamDocsScanned === 0) && !ALLOW_EMPTY) {
      console.log(
        '[VERIFY FAILED] Empty scan (0 worlds or 0 team docs). Check credentials / emulator / project / data.'
      );
      console.log(`  Worlds scanned: ${worldsScanned}`);
      console.log(`  Team docs scanned: ${teamDocsScanned}`);
      console.log(
        '  Use --allow-empty to bypass this check (not recommended for CI).'
      );
      report.verifyPassed = false;
      report.emptyScanned = true;
      return report;
    } else if ((worldsScanned === 0 || teamDocsScanned === 0) && ALLOW_EMPTY) {
      console.log(
        '[VERIFY WARNING] ⚠️  Empty scan detected but --allow-empty is set.'
      );
      console.log(`  Worlds scanned: ${worldsScanned}`);
      console.log(`  Team docs scanned: ${teamDocsScanned}`);
      console.log(
        '  This is NOT recommended for CI pipelines - verify your data source!'
      );
      // Continue with legacy check (which will pass since nothing was scanned)
    }

    if (report.totalTeamsWithLegacy > 0) {
      console.log(
        `[VERIFY FAILED] Found ${report.totalTeamsWithLegacy} team doc(s) with legacy tradeExceptions field.`
      );
      console.log('Run with --write to migrate these documents.');
      // Signal failure for CI/scripts
      report.verifyPassed = false;
    } else {
      console.log(
        '[VERIFY PASSED] Zero legacy tradeExceptions fields found. Migration complete.'
      );
      console.log(
        `  Proof: Scanned ${worldsScanned} world(s), ${teamDocsScanned} team doc(s).`
      );
      report.verifyPassed = true;
    }
  } else if (DRY_RUN && report.totalTeamsWithLegacy > 0) {
    console.log('To perform the actual migration, run with --write');
  }

  return report;
}

/**
 * Generate markdown report content.
 */
function generateMarkdownReport(report) {
  const lines = [
    '# Phase 66/67 Migration Report: Remove Legacy tradeExceptions',
    '',
    `**Timestamp:** ${report.timestamp}`,
    `**Mode:** ${report.mode}`,
    `**Target:** ${report.targetWorldId}`,
    '',
    '## Summary',
    '',
    `| Metric | Value |`,
    `|--------|-------|`,
    `| Total worlds scanned | ${report.totalWorldsScanned} |`,
    `| Total team docs scanned | ${report.totalTeamsScanned} |`,
    `| Docs with legacy field | ${report.totalTeamsWithLegacy} |`,
    `| Docs migrated | ${report.mode === 'DRY_RUN' ? 'N/A (dry run)' : report.totalTeamsMigrated} |`,
    '',
    '## Per-World Breakdown',
    '',
  ];

  for (const world of report.worlds) {
    lines.push(`### World: \`${world.worldId}\``);
    lines.push('');
    lines.push(`- Teams scanned: ${world.teamsScanned}`);
    lines.push(`- Teams with legacy field: ${world.teamsWithLegacy}`);
    lines.push(
      `- Teams migrated: ${report.mode === 'DRY_RUN' ? 'N/A (dry run)' : world.teamsMigrated}`
    );

    if (world.affectedTeamCodes.length > 0) {
      lines.push(
        `- Affected team codes: \`${world.affectedTeamCodes.join('`, `')}\``
      );
    }

    if (world.sampleBefore) {
      lines.push('');
      lines.push('**Sample Before (keys only):**');
      lines.push('```json');
      lines.push(JSON.stringify(world.sampleBefore, null, 2));
      lines.push('```');
    }

    if (world.sampleAfter) {
      lines.push('');
      lines.push('**Sample After (keys only):**');
      lines.push('```json');
      lines.push(JSON.stringify(world.sampleAfter, null, 2));
      lines.push('```');
    }

    if (world.errors.length > 0) {
      lines.push('');
      lines.push('**Errors:**');
      for (const err of world.errors) {
        lines.push(`- ${err}`);
      }
    }

    lines.push('');
  }

  lines.push('---');
  lines.push('');
  if (report.verifyPassed !== undefined) {
    lines.push(
      `**Verify Result:** ${report.verifyPassed ? 'PASSED ✅' : 'FAILED ❌'}`
    );
    lines.push('');
  }
  lines.push('*Generated by Phase 66/67/68 migration script*');

  return lines.join('\n');
}

// ============================================================================
// Entry Point
// ============================================================================
runMigration()
  .then((report) => {
    console.log('Migration complete.');
    // Exit with code 1 if verify-only mode found legacy occurrences
    if (VERIFY_ONLY && report.verifyPassed === false) {
      process.exit(1);
    }
    process.exit(0);
  })
  .catch((err) => {
    console.error('[ERROR] Migration failed:', err);
    process.exit(1);
  });
