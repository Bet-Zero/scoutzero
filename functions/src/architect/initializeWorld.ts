/** Firebase callable adapter. World policy lives in the portable service. */
import * as admin from 'firebase-admin';
import {
  onCall,
  HttpsError,
  type CallableRequest,
} from 'firebase-functions/v2/https';
import {
  initializeArchitectWorldService,
  WorldInitializationError,
  type InitializeArchitectWorldRequest,
} from './initializeWorldService';
import { loadTrustedDraftBaseline } from './trustedDraftBaseline';

export const initializeArchitectWorld = onCall(
  { enforceAppCheck: false, timeoutSeconds: 120, memory: '1GiB' },
  async (request: CallableRequest<InitializeArchitectWorldRequest>) => {
    if (!admin.apps.length) admin.initializeApp();
    try {
      return await initializeArchitectWorldService(admin.firestore(), request, {
        loadTrustedDraft: loadTrustedDraftBaseline,
      });
    } catch (error) {
      if (error instanceof WorldInitializationError)
        throw new HttpsError(error.code, error.message);
      throw error;
    }
  }
);
