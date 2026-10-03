import * as admin from 'firebase-admin';
import { HttpsError, onCall } from 'firebase-functions/v2/https';

if (!admin.apps.length) admin.initializeApp();
// The normal functions build bundles the typechecked shared Season Advance
// core here. No client SDK, browser configuration or alternate rule engine.
const core: {
  publishCertifiedSeasonTransition(
    db: admin.firestore.Firestore,
    userId: string,
    input: unknown
  ): Promise<unknown>;
} = require('./certifiedSeasonCore.cjs');

export const advanceCertifiedArchitectSeason = onCall(async (request) => {
  if (!request.auth)
    throw new HttpsError('unauthenticated', 'Authentication is required.');
  try {
    return await core.publishCertifiedSeasonTransition(
      admin.firestore(),
      request.auth.uid,
      request.data
    );
  } catch (error) {
    throw new HttpsError(
      'failed-precondition',
      error instanceof Error
        ? error.message
        : 'Certified Season Advance unavailable.'
    );
  }
});
