/**
 * FILE: scripts/dev/maintenanceConsumer.browser.ts
 * PURPOSE: Shared NBA maintenance mechanics with governed source and publication decisions.
 * OWNERSHIP: Operations tooling.
 * HISTORY: 2026-10-18 — BZE-324 Gate A implementation.
 * LINKS: docs/operations/NBA_MAINTENANCE.md; docs/operations/DRAFT_UPDATE_PROCESS.md
 */
/** Vite-only consumer probe, using the application's exact SDK instance. */
import { doc, getDoc } from 'firebase/firestore';
import { auth, db, FIREBASE_TARGET_MODE, FIREBASE_EMULATOR_ENDPOINTS } from '../../src/firebaseConfig';
import { PLAYERS_COLLECTION } from '../../src/constants/collections';

export async function readPublishedPlayer(playerId: string) {
  if (!import.meta.env.DEV || FIREBASE_TARGET_MODE !== 'EMULATOR' || db.app.options.projectId !== 'demo-architect-review' ||
      FIREBASE_EMULATOR_ENDPOINTS.firestore?.host !== '127.0.0.1' || FIREBASE_EMULATOR_ENDPOINTS.firestore.port !== 8082 ||
      !/^[\p{L}\p{M}\p{N}_]+$/u.test(playerId)) throw new Error('Consumer probe is emulator-only');
  await auth.authStateReady();
  if (!auth.currentUser) throw new Error('Consumer probe requires the restored local test identity');
  return (await getDoc(doc(db, PLAYERS_COLLECTION, playerId))).data();
}
