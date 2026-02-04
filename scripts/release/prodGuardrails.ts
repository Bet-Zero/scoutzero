#!/usr/bin/env tsx
/**
 * FILE: scripts/release/prodGuardrails.ts
 * PURPOSE: Shared guardrails for production push scripts. Prevents writes to wrong project,
 *          blocks production writes when emulator env is set, requires explicit confirmation.
 * OWNERSHIP: Scouting data pipeline
 *
 * HISTORY:
 *  - 2026-02-04: Created for Phase 2AF - Scouting Prod Sync Wiring
 *
 * LINKS:
 *  - Runbook: docs/scouting/PROD_SYNC_RUNBOOK.md
 *
 * USAGE:
 *   import { requireProdConfirmation, blockIfEmulatorMode, resolveAndValidateProject } from './prodGuardrails.js';
 *
 *   // In your push script:
 *   requireProdConfirmation('scoutzero-bf1ae');
 *   blockIfEmulatorMode();
 *   const projectId = resolveAndValidateProject('scoutzero-bf1ae');
 */

/**
 * The canonical production project ID for ScoutZero.
 * All production push scripts MUST target this project.
 */
export const PROD_PROJECT_ID = 'scoutzero-bf1ae';

/**
 * List of known demo/test project IDs that should NEVER be written to by pipeline scripts.
 */
const BLOCKED_PROJECT_IDS = [
  'demo-project',
  'demo-scoutzero',
  'test-project',
  'firebase-demo-project',
  'emulator-project',
];

/**
 * Check if emulator environment variables are set.
 */
export function isEmulatorModeSet(): boolean {
  return !!(
    process.env.FIRESTORE_EMULATOR_HOST ||
    process.env.FIREBASE_EMULATOR_HOST ||
    process.env.FIREBASE_AUTH_EMULATOR_HOST
  );
}

/**
 * Get the current emulator host value (if set).
 */
export function getEmulatorHost(): string | undefined {
  return process.env.FIRESTORE_EMULATOR_HOST;
}

/**
 * Block execution if emulator mode is set.
 * Production push scripts must NOT run with emulator env vars set.
 */
export function blockIfEmulatorMode(): void {
  if (isEmulatorModeSet()) {
    const host = getEmulatorHost();
    console.error('');
    console.error(
      '═══════════════════════════════════════════════════════════════════════════════'
    );
    console.error('  🚫 BLOCKED: EMULATOR MODE IS SET');
    console.error(
      '═══════════════════════════════════════════════════════════════════════════════'
    );
    console.error('');
    console.error(`  FIRESTORE_EMULATOR_HOST=${host}`);
    console.error('');
    console.error(
      '  Production push scripts CANNOT run when emulator env vars are set.'
    );
    console.error('  This prevents accidental writes to the wrong target.');
    console.error('');
    console.error('  TO FIX:');
    console.error('    unset FIRESTORE_EMULATOR_HOST');
    console.error('    unset FIREBASE_EMULATOR_HOST');
    console.error('    unset FIREBASE_AUTH_EMULATOR_HOST');
    console.error('');
    console.error('  Then re-run the command.');
    console.error('');
    process.exit(1);
  }
}

/**
 * Parse --confirmProject=<value> from command line args.
 */
export function parseConfirmProjectArg(): string | undefined {
  const args = process.argv.slice(2);
  for (const arg of args) {
    if (arg.startsWith('--confirmProject=')) {
      return arg.split('=')[1];
    }
  }
  return undefined;
}

/**
 * Require explicit --confirmProject=<projectId> flag for production writes.
 * @param expectedProjectId - The expected project ID (default: scoutzero-bf1ae)
 */
export function requireProdConfirmation(
  expectedProjectId: string = PROD_PROJECT_ID
): void {
  const confirmed = parseConfirmProjectArg();

  if (!confirmed) {
    console.error('');
    console.error(
      '═══════════════════════════════════════════════════════════════════════════════'
    );
    console.error('  🚫 BLOCKED: MISSING --confirmProject FLAG');
    console.error(
      '═══════════════════════════════════════════════════════════════════════════════'
    );
    console.error('');
    console.error(
      '  Production push scripts require explicit project confirmation.'
    );
    console.error('');
    console.error('  REQUIRED:');
    console.error(`    --confirmProject=${expectedProjectId}`);
    console.error('');
    console.error('  EXAMPLE:');
    console.error(
      `    npx tsx <script>.ts --confirmProject=${expectedProjectId}`
    );
    console.error('');
    process.exit(1);
  }

  if (confirmed !== expectedProjectId) {
    console.error('');
    console.error(
      '═══════════════════════════════════════════════════════════════════════════════'
    );
    console.error('  🚫 BLOCKED: PROJECT ID MISMATCH');
    console.error(
      '═══════════════════════════════════════════════════════════════════════════════'
    );
    console.error('');
    console.error(`  Expected: ${expectedProjectId}`);
    console.error(`  Provided: ${confirmed}`);
    console.error('');
    console.error(
      '  The --confirmProject value must exactly match the expected project ID.'
    );
    console.error('');
    process.exit(1);
  }

  // Check against blocked project IDs
  if (BLOCKED_PROJECT_IDS.includes(confirmed)) {
    console.error('');
    console.error(
      '═══════════════════════════════════════════════════════════════════════════════'
    );
    console.error('  🚫 BLOCKED: INVALID PROJECT ID');
    console.error(
      '═══════════════════════════════════════════════════════════════════════════════'
    );
    console.error('');
    console.error(`  Project ID "${confirmed}" is in the blocked list.`);
    console.error('  This is likely a demo or test project.');
    console.error('');
    console.error('  Blocked project IDs:');
    for (const blocked of BLOCKED_PROJECT_IDS) {
      console.error(`    - ${blocked}`);
    }
    console.error('');
    process.exit(1);
  }

  console.log(`✅ Project confirmation: ${confirmed}`);
}

/**
 * Resolve and validate the project ID from service account or env vars.
 * @param expectedProjectId - The expected project ID
 * @returns The validated project ID
 */
export async function resolveAndValidateProject(
  serviceAccountPath: string,
  expectedProjectId: string = PROD_PROJECT_ID
): Promise<string> {
  const fs = await import('node:fs/promises');

  // Read service account
  let serviceAccount: { project_id?: string };
  try {
    const raw = await fs.readFile(serviceAccountPath, 'utf8');
    serviceAccount = JSON.parse(raw);
  } catch (error) {
    console.error(
      `❌ Failed to read service account at: ${serviceAccountPath}`
    );
    throw error;
  }

  const projectId = serviceAccount.project_id;
  if (!projectId) {
    throw new Error('Service account missing project_id field');
  }

  // Validate
  if (projectId !== expectedProjectId) {
    console.error('');
    console.error(
      '═══════════════════════════════════════════════════════════════════════════════'
    );
    console.error('  🚫 BLOCKED: SERVICE ACCOUNT PROJECT MISMATCH');
    console.error(
      '═══════════════════════════════════════════════════════════════════════════════'
    );
    console.error('');
    console.error(`  Expected project_id: ${expectedProjectId}`);
    console.error(`  Service account project_id: ${projectId}`);
    console.error(`  Service account path: ${serviceAccountPath}`);
    console.error('');
    console.error(
      '  Ensure you are using the correct service account for production.'
    );
    console.error('');
    process.exit(1);
  }

  // Check against blocked
  if (BLOCKED_PROJECT_IDS.includes(projectId)) {
    console.error('');
    console.error(
      '═══════════════════════════════════════════════════════════════════════════════'
    );
    console.error('  🚫 BLOCKED: SERVICE ACCOUNT POINTS TO INVALID PROJECT');
    console.error(
      '═══════════════════════════════════════════════════════════════════════════════'
    );
    console.error('');
    console.error(`  Project ID "${projectId}" is in the blocked list.`);
    console.error('');
    process.exit(1);
  }

  console.log(`✅ Service account project: ${projectId}`);
  return projectId;
}

/**
 * Combined guardrail check for production push scripts.
 * Runs all checks in sequence.
 */
export async function runProdGuardrails(
  serviceAccountPath: string,
  expectedProjectId: string = PROD_PROJECT_ID
): Promise<void> {
  console.log('');
  console.log(
    '┌──────────────────────────────────────────────────────────────────────────────┐'
  );
  console.log(
    '│  PRODUCTION GUARDRAILS CHECK                                                 │'
  );
  console.log(
    '└──────────────────────────────────────────────────────────────────────────────┘'
  );
  console.log('');

  // 1. Block if emulator mode
  blockIfEmulatorMode();

  // 2. Require explicit confirmation
  requireProdConfirmation(expectedProjectId);

  // 3. Validate service account
  await resolveAndValidateProject(serviceAccountPath, expectedProjectId);

  console.log('');
  console.log('✅ All guardrails passed. Proceeding with production write...');
  console.log('');
}
