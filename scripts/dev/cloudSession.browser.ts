/** Vite-only recovery of an existing local emulator identity after import. */
import { signInWithCustomToken } from 'firebase/auth';
import {
  auth, db, FIREBASE_TARGET_MODE, FIREBASE_EMULATOR_ENDPOINTS,
} from '../../src/firebaseConfig';

export async function resumeCloudSession(token: string, expectedUid: string) {
  const endpoints = FIREBASE_EMULATOR_ENDPOINTS;
  if (!import.meta.env.DEV || FIREBASE_TARGET_MODE !== 'EMULATOR' ||
      db.app.options.projectId !== 'demo-architect-review' ||
      auth.emulatorConfig?.host !== '127.0.0.1' || auth.emulatorConfig.port !== 9099 ||
      endpoints.auth?.host !== '127.0.0.1' || endpoints.auth.port !== 9099 ||
      endpoints.firestore?.host !== '127.0.0.1' || endpoints.firestore.port !== 8082) {
    throw new Error('Session recovery is restricted to the local demo emulators');
  }
  await auth.authStateReady();
  const result = await signInWithCustomToken(auth, token);
  if (result.user.uid !== expectedUid) throw new Error('Recovered emulator identity mismatch');
}
