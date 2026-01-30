/**
 * FILE: scripts/emu/adminEmu.ts
 * PURPOSE: Shared Admin SDK initialization for all emulator scripts with consistent projectId.
 * OWNERSHIP: Tooling: local emulator workflow
 *
 * HISTORY:
 *  - 2026-01-30: Created to fix projectId mismatch between runEmu and seed scripts
 *
 * LINKS:
 *  - Return package: docs/team-scrape/return_packages/PST_EMULATOR_BASETEAMS_PROJECTID_FIX_RETURN_PACKAGE.md
 */

import admin from 'firebase-admin';

/**
 * Canonical projectId for local emulator development.
 * This MUST match the projectId used by `npm run emu` (runEmu.ts).
 */
const FALLBACK_PROJECT_ID = 'scoutzero-bf1ae';

/**
 * Determine the projectId to use for Admin SDK initialization.
 * Priority order:
 *  1) GCLOUD_PROJECT (set by runEmu.ts when spawning child processes)
 *  2) FIREBASE_PROJECT (alternative)
 *  3) PROJECT_ID (generic fallback)
 *  4) hardcoded fallback: 'scoutzero-bf1ae'
 */
const resolveProjectId = (): string => {
  return (
    process.env.GCLOUD_PROJECT ??
    process.env.FIREBASE_PROJECT ??
    process.env.PROJECT_ID ??
    FALLBACK_PROJECT_ID
  );
};

/**
 * Require FIRESTORE_EMULATOR_HOST to be set.
 * This ensures scripts only run against the emulator, never production.
 */
const requireEmulatorHost = (): string => {
  const host = process.env.FIRESTORE_EMULATOR_HOST;
  if (!host) {
    throw new Error(
      '[emu-admin] FIRESTORE_EMULATOR_HOST is not set. ' +
        'This script is emulator-only. Ensure emulators are running via `npm run emu`.'
    );
  }
  return host;
};

let initialized = false;
let cachedDb: FirebaseFirestore.Firestore | null = null;
let cachedProjectId: string | null = null;

/**
 * Initialize Admin SDK for emulator use. Safe to call multiple times; will only init once.
 * Returns { db, projectId } for use in scripts.
 */
export const initAdminEmu = (): {
  db: FirebaseFirestore.Firestore;
  projectId: string;
} => {
  const emulatorHost = requireEmulatorHost();
  const projectId = resolveProjectId();

  if (!initialized) {
    // Guard against double initialization
    if (admin.apps.length === 0) {
      admin.initializeApp({ projectId });
    }
    cachedDb = admin.firestore();
    cachedProjectId = projectId;
    initialized = true;

    // Log once on first init
    process.stdout.write(
      `[emu-admin] Using projectId=${projectId} FIRESTORE_EMULATOR_HOST=${emulatorHost}\n`
    );
  }

  return {
    db: cachedDb!,
    projectId: cachedProjectId!,
  };
};

/**
 * Get the resolved projectId without initializing the SDK.
 * Useful for logging before SDK init.
 */
export const getEmulatorProjectId = (): string => {
  return resolveProjectId();
};

/**
 * Re-export admin for scripts that need access to FieldValue, etc.
 */
export { admin };
