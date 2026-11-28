/** Firebase callable adapter for trusted Architect world initialization. */
import * as admin from 'firebase-admin';
import {
  HttpsError,
  onCall,
  type CallableRequest,
} from 'firebase-functions/v2/https';
import {
  initializeArchitectWorldService,
  WorldInitializationError,
  type InitializeArchitectWorldRequest,
} from './initializeWorldService';
import { loadTrustedDraftBaseline } from './trustedDraftBaseline';

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

export const initializeArchitectWorld = onCall(
  { enforceAppCheck: false, timeoutSeconds: 120, memory: '1GiB' },
  async (request: CallableRequest<InitializeArchitectWorldRequest>) => {
    try {
      return await initializeArchitectWorldService(db, request, {
        loadFixtureDraft: loadTrustedDraftBaseline,
      });
    } catch (error) {
      if (error instanceof WorldInitializationError) {
        throw new HttpsError(error.code, error.message);
      }
      throw error;
    }
  }
);
