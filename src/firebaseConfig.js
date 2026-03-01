// src/firebaseConfig.js
/**
 * Firebase initialization with review mode fallback.
 *
 * REVIEW MODE: When Firebase env vars are missing (e.g., in cloud/CI review environments),
 * the app uses a demo project config suitable for emulator-only operation.
 * This prevents crashes caused by invalid-api-key errors.
 *
 * Review mode is activated automatically when:
 *   - VITE_FIREBASE_PROJECT_ID is missing/empty, OR
 *   - VITE_ARCHITECT_REVIEW_MODE is truthy
 *
 * @see docs/reviews/ARCHITECT_REVIEW_LEDGER.md
 */
import { initializeApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';

// Guard to prevent double-connecting to emulators
let emulatorsConnected = false;

/**
 * Detect if we're in review mode:
 *   - Missing/empty VITE_FIREBASE_PROJECT_ID, OR
 *   - Explicit VITE_ARCHITECT_REVIEW_MODE=true
 */
const isReviewMode =
  !import.meta.env.VITE_FIREBASE_PROJECT_ID ||
  import.meta.env.VITE_ARCHITECT_REVIEW_MODE === 'true';

/**
 * Demo project config for review mode.
 * Safe defaults for emulator-only operation (no real Firebase connection).
 */
const REVIEW_MODE_CONFIG = {
  apiKey: 'demo-api-key-not-real',
  authDomain: 'demo-architect-review.firebaseapp.com',
  projectId: 'demo-architect-review',
  storageBucket: 'demo-architect-review.appspot.com',
  messagingSenderId: '000000000000',
  appId: '1:000000000000:web:demo000000000000',
};

/**
 * Production config from environment variables.
 */
const PRODUCTION_CONFIG = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const firebaseConfig = isReviewMode ? REVIEW_MODE_CONFIG : PRODUCTION_CONFIG;

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const functions = getFunctions(app);

/**
 * Connect to emulators when:
 *   - DEV mode AND (review mode OR explicit emulator flag)
 *   - Always in review mode (emulators are required for demo project)
 */
const shouldConnectEmulators =
  (import.meta.env.DEV || isReviewMode) && !emulatorsConnected;

if (shouldConnectEmulators) {
  emulatorsConnected = true;
  const host = 'localhost'; // Consistent host for all emulators

  try {
    connectFirestoreEmulator(db, host, 8082);
    connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true });
    connectFunctionsEmulator(functions, host, 5001);

    console.log('──────────────────────────────────────────────────');
    if (isReviewMode) {
      console.log('🔍 REVIEW MODE — Using demo project + emulators');
      console.log('   No production credentials required.');
    } else {
      console.log('🔥 Firebase Emulators Connected');
    }
    console.log(`   Project: ${firebaseConfig.projectId}`);
    console.log(`   Firestore: ${host}:8082`);
    console.log(`   Auth: ${host}:9099`);
    console.log(`   Functions: ${host}:5001`);
    console.log('──────────────────────────────────────────────────');
  } catch (error) {
    // Guard against errors if emulators already connected (e.g., HMR)
    if (!String(error).includes('already been started')) {
      console.warn('[firebaseConfig] Emulator connection warning:', error);
    }
  }
}

// Export review mode status for use by other modules
export const ARCHITECT_REVIEW_MODE = isReviewMode;
