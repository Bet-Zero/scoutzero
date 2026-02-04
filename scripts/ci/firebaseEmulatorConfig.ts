/**
 * FILE: scripts/ci/firebaseEmulatorConfig.ts
 * PURPOSE: Emulator-compatible Firebase configuration for CI/E2E tests.
 *          Replaces @/firebaseConfig when running with vitest.emulator.config.js
 * OWNERSHIP: Tooling: CI/CD
 *
 * HISTORY:
 *  - 2026-02-04: Phase D4 - Created for true E2E emulator testing
 *
 * LINKS:
 *  - Master Doc: docs/architect/DRAFT_ASSET_TERMS_AND_LIFECYCLE_COMPLETION_AUDIT.md
 *  - vitest.emulator.config.js
 *
 * DESIGN:
 *   This module provides the same exports as @/firebaseConfig (db, auth, functions)
 *   but initializes Firebase Web SDK connected to the emulator instead of production.
 *   It requires FIRESTORE_EMULATOR_HOST to be set for safety.
 */

import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
  getFirestore,
  connectFirestoreEmulator,
  type Firestore,
} from 'firebase/firestore';
import { getAuth, connectAuthEmulator, type Auth } from 'firebase/auth';
import {
  getFunctions,
  connectFunctionsEmulator,
  type Functions,
} from 'firebase/functions';

// ============================================================================
// Safety Check: Refuse to run without emulator
// ============================================================================

const EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST;

if (!EMULATOR_HOST) {
  console.error('============================================================');
  console.error('[SAFETY] FIRESTORE_EMULATOR_HOST is not set.');
  console.error('         This config ONLY works with the emulator.');
  console.error(
    '         Set FIRESTORE_EMULATOR_HOST=127.0.0.1:8082 and try again.'
  );
  console.error('============================================================');
  throw new Error(
    'firebaseEmulatorConfig: FIRESTORE_EMULATOR_HOST is required'
  );
}

// Parse host and port from FIRESTORE_EMULATOR_HOST (format: "host:port")
const [emulatorHost, emulatorPortStr] = EMULATOR_HOST.split(':');
const firestorePort = parseInt(emulatorPortStr, 10) || 8082;
const authPort = 9100; // Matches firebase.json
const functionsPort = 5001;

// ============================================================================
// Firebase Configuration - Minimal for emulator use
// ============================================================================

const firebaseConfig = {
  // projectId MUST match what the emulator was started with
  projectId: process.env.GCLOUD_PROJECT || 'scoutzero-bf1ae',
  // These can be dummy values for emulator
  apiKey: 'fake-api-key-for-emulator',
  authDomain: 'localhost',
};

// ============================================================================
// Initialize Firebase and Connect to Emulators
// ============================================================================

let app: FirebaseApp;
let db: Firestore;
let auth: Auth;
let functions: Functions;

try {
  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  auth = getAuth(app);
  functions = getFunctions(app);

  // Connect to emulators
  connectFirestoreEmulator(db, emulatorHost, firestorePort);
  connectAuthEmulator(auth, `http://${emulatorHost}:${authPort}`, {
    disableWarnings: true,
  });
  connectFunctionsEmulator(functions, emulatorHost, functionsPort);

  console.log('──────────────────────────────────────────────────');
  console.log('🔥 Firebase Emulator Config Initialized (Phase D4)');
  console.log(`   Project: ${firebaseConfig.projectId}`);
  console.log(`   Firestore: ${emulatorHost}:${firestorePort}`);
  console.log(`   Auth: ${emulatorHost}:${authPort}`);
  console.log(`   Functions: ${emulatorHost}:${functionsPort}`);
  console.log('──────────────────────────────────────────────────');
} catch (error) {
  console.error('Failed to initialize Firebase emulator config:', error);
  throw error;
}

// ============================================================================
// Exports - Same interface as @/firebaseConfig
// ============================================================================

export { db, auth, functions };
