// src/firebaseConfig.ts
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
import type { FirebaseOptions } from 'firebase/app';
import { initializeApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';
import { getStorage, connectStorageEmulator } from 'firebase/storage';
import firebaseProjectConfig from '../firebase.json';

// Guard to prevent double-connecting to emulators
let emulatorsConnected = false;

const FIREBASE_TARGET_MODES = {
  EMULATOR: 'EMULATOR',
  PROD: 'PROD',
} as const;

export type FirebaseTargetMode =
  (typeof FIREBASE_TARGET_MODES)[keyof typeof FIREBASE_TARGET_MODES];

export type FirebaseEmulatorEndpoint = {
  host: string;
  port: number;
};

type FirebaseJsonEmulatorConfig = {
  host?: unknown;
  port?: unknown;
};

type FirebaseJsonEmulators = {
  firestore?: FirebaseJsonEmulatorConfig;
  auth?: FirebaseJsonEmulatorConfig;
  functions?: FirebaseJsonEmulatorConfig;
  storage?: FirebaseJsonEmulatorConfig;
};

export type FirebaseEmulatorEndpoints = {
  firestore: FirebaseEmulatorEndpoint | null;
  auth: FirebaseEmulatorEndpoint | null;
  functions: FirebaseEmulatorEndpoint | null;
  storage: FirebaseEmulatorEndpoint | null;
};

const readEnv = (name: string): string | null => {
  const value = import.meta.env[name];
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const toIntOrNull = (rawValue: string | null): number | null => {
  if (!rawValue) return null;
  const parsed = Number(rawValue);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
};

const parseBooleanEnv = (rawValue: string | null): boolean | null => {
  if (rawValue == null) return null;
  if (rawValue === 'true') return true;
  if (rawValue === 'false') return false;
  return null;
};

const getFirebaseJsonEmulators = (): FirebaseJsonEmulators =>
  (firebaseProjectConfig as { emulators?: FirebaseJsonEmulators }).emulators ||
  {};

const resolveHostPort = (
  hostEnvName: string,
  portEnvName: string,
  fallbackConfig?: FirebaseJsonEmulatorConfig
): FirebaseEmulatorEndpoint | null => {
  const envHost = readEnv(hostEnvName);
  const envPort = toIntOrNull(readEnv(portEnvName));
  if (envHost && envPort) {
    return { host: envHost, port: envPort };
  }

  const host = fallbackConfig?.host;
  const port = fallbackConfig?.port;
  if (
    typeof host === 'string' &&
    typeof port === 'number' &&
    Number.isInteger(port) &&
    port > 0
  ) {
    return { host, port };
  }

  return null;
};

export function getFirebaseTargetMode(): FirebaseTargetMode {
  const requestedEmulatorMode = parseBooleanEnv(
    readEnv('VITE_USE_FIREBASE_EMULATORS')
  );

  if (import.meta.env.DEV || requestedEmulatorMode === true) {
    return FIREBASE_TARGET_MODES.EMULATOR;
  }

  if (requestedEmulatorMode === false && import.meta.env.DEV) {
    return FIREBASE_TARGET_MODES.EMULATOR;
  }

  return FIREBASE_TARGET_MODES.PROD;
}

export function resolveFirebaseEmulatorEndpoints(): FirebaseEmulatorEndpoints {
  const emulators = getFirebaseJsonEmulators();

  return {
    firestore: resolveHostPort(
      'VITE_FIRESTORE_EMULATOR_HOST',
      'VITE_FIRESTORE_EMULATOR_PORT',
      emulators.firestore
    ),
    auth: resolveHostPort(
      'VITE_AUTH_EMULATOR_HOST',
      'VITE_AUTH_EMULATOR_PORT',
      emulators.auth
    ),
    functions: resolveHostPort(
      'VITE_FUNCTIONS_EMULATOR_HOST',
      'VITE_FUNCTIONS_EMULATOR_PORT',
      emulators.functions
    ),
    storage: resolveHostPort(
      'VITE_STORAGE_EMULATOR_HOST',
      'VITE_STORAGE_EMULATOR_PORT',
      emulators.storage
    ),
  };
}

const formatHostPort = (
  endpoint: FirebaseEmulatorEndpoint | null | undefined
): string =>
  endpoint ? `${endpoint.host}:${endpoint.port}` : 'not-configured';

const getErrorText = (errorLike: unknown): string => {
  if (errorLike && typeof errorLike === 'object') {
    const maybeError = errorLike as { message?: unknown; code?: unknown };
    return String(maybeError.message || maybeError.code || errorLike);
  }

  return String(errorLike || '');
};

export function isLikelyEmulatorConnectionError(errorLike: unknown): boolean {
  const text = getErrorText(errorLike).toLowerCase();

  return (
    text.includes('econnrefused') ||
    text.includes('failed to fetch') ||
    text.includes('network request failed') ||
    text.includes('client is offline') ||
    text.includes('unavailable') ||
    text.includes('transport errored') ||
    text.includes('connect')
  );
}

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
const REVIEW_MODE_CONFIG: FirebaseOptions = {
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
const PRODUCTION_CONFIG: FirebaseOptions = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const firebaseConfig: FirebaseOptions = isReviewMode
  ? REVIEW_MODE_CONFIG
  : PRODUCTION_CONFIG;
export const FIREBASE_TARGET_MODE = getFirebaseTargetMode();
export const FIREBASE_EMULATOR_ENDPOINTS = resolveFirebaseEmulatorEndpoints();

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const functions = getFunctions(app);
export const storage = getStorage(app);

/**
 * Connect to emulators when:
 *   - DEV mode AND (review mode OR explicit emulator flag)
 *   - Always in review mode (emulators are required for demo project)
 */
const shouldConnectEmulators =
  FIREBASE_TARGET_MODE === FIREBASE_TARGET_MODES.EMULATOR &&
  !emulatorsConnected;

if (shouldConnectEmulators) {
  const firestoreEndpoint = FIREBASE_EMULATOR_ENDPOINTS.firestore;
  const authEndpoint = FIREBASE_EMULATOR_ENDPOINTS.auth;
  const functionsEndpoint = FIREBASE_EMULATOR_ENDPOINTS.functions;

  if (!firestoreEndpoint || !authEndpoint || !functionsEndpoint) {
    throw new Error(
      'Firebase emulator mode is enabled, but emulator host/port is missing. Configure env vars or firebase.json emulators for firestore/auth/functions.'
    );
  }

  try {
    emulatorsConnected = true;
    connectFirestoreEmulator(
      db,
      firestoreEndpoint.host,
      firestoreEndpoint.port
    );
    connectAuthEmulator(
      auth,
      `http://${authEndpoint.host}:${authEndpoint.port}`,
      { disableWarnings: true }
    );
    connectFunctionsEmulator(
      functions,
      functionsEndpoint.host,
      functionsEndpoint.port
    );

    if (FIREBASE_EMULATOR_ENDPOINTS.storage) {
      connectStorageEmulator(
        storage,
        FIREBASE_EMULATOR_ENDPOINTS.storage.host,
        FIREBASE_EMULATOR_ENDPOINTS.storage.port
      );
    }

    console.log('──────────────────────────────────────────────────');
    console.log(`🚦 Firebase Target Mode: ${FIREBASE_TARGET_MODE}`);
    if (isReviewMode) {
      console.log('🔍 REVIEW MODE — Using demo project + emulators');
      console.log('   No production credentials required.');
    }
    console.log('🔥 Firebase Emulators Connected');
    console.log(`   Project: ${firebaseConfig.projectId}`);
    console.log(`   Firestore: ${formatHostPort(firestoreEndpoint)}`);
    console.log(`   Auth: ${formatHostPort(authEndpoint)}`);
    console.log(`   Functions: ${formatHostPort(functionsEndpoint)}`);
    console.log(
      `   Storage: ${formatHostPort(FIREBASE_EMULATOR_ENDPOINTS.storage)}`
    );
    console.log('──────────────────────────────────────────────────');
  } catch (error) {
    // Guard against errors if emulators already connected (e.g., HMR)
    if (!String(error).includes('already been started')) {
      throw error;
    }
  }
}

// Export review mode status for use by other modules
export const ARCHITECT_REVIEW_MODE = isReviewMode;
