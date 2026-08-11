/**
 * Firebase Cloud Functions for Architect World Management
 *
 * These functions handle server-side operations that require Admin SDK
 * privileges, particularly recursive deletion of worlds with subcollections.
 *
 * @module functions/architect
 */

import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import {
  onCall,
  HttpsError,
  CallableRequest,
} from 'firebase-functions/v2/https';
import {
  evaluatePartialBranchCleanupEligibility,
  PARTIAL_BRANCH_CLEANUP_CLAIM_FIELD,
  type PartialBranchCleanupRefusalReason,
} from './partialBranchCleanup';

// Initialize Firebase Admin SDK (uses default credentials in Cloud Functions)
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

/**
 * World subcollections structure:
 * - architect_worlds/{worldId}/teams/{teamCode} - Team snapshots
 * - architect_worlds/{worldId}/teams/{teamCode}/players/{playerId} - Player overrides
 */

/**
 * Maximum documents to delete in a single batch
 * Firestore limit is 500 operations per batch, using 400 as a conservative buffer
 * to account for any additional operations that might be needed during processing
 */
const BATCH_SIZE = 400;

/**
 * Maximum execution time before returning "queued" status
 * Cloud Functions v2 can run up to 60 minutes, but we'll be conservative
 */
const MAX_EXECUTION_MS = 30_000; // 30 seconds

type PartialBranchCleanupClaimResult =
  | { state: 'already-absent' }
  | {
      state: 'refused';
      reason: PartialBranchCleanupRefusalReason;
    }
  | {
      state: 'claimed';
      worldData: admin.firestore.DocumentData;
    };

const emptyDeletionDetails = () => ({
  teamsDeleted: 0,
  playersDeleted: 0,
  freeAgentPoolsDeleted: 0,
  eventsDeleted: 0,
  entitlementsDeleted: 0,
  contractBaselinesDeleted: 0,
  worldDeleted: false,
});

/**
 * Atomically verifies and claims a hidden unfinished branch. A concurrent
 * client finalization changes the same child document, forcing this
 * transaction to retry and refuse the now-visible/attached world. Once the
 * claim lands, Firestore rules block browser writes to the child.
 */
async function claimPartialBranchCleanup(args: {
  worldId: string;
  expectedParentWorldId: string;
  userId: string;
}): Promise<PartialBranchCleanupClaimResult> {
  const { worldId, expectedParentWorldId, userId } = args;
  const worldRef = db.collection('architect_worlds').doc(worldId);
  const parentRef = db
    .collection('architect_worlds')
    .doc(expectedParentWorldId);

  return db.runTransaction(async (transaction) => {
    const worldDoc = await transaction.get(worldRef);
    if (!worldDoc.exists) {
      return { state: 'already-absent' };
    }

    const worldData = worldDoc.data() ?? {};
    if (worldData.createdBy !== userId) {
      throw new HttpsError(
        'permission-denied',
        'You do not have permission to delete this world'
      );
    }

    const parentDoc = await transaction.get(parentRef);
    const eligibility = evaluatePartialBranchCleanupEligibility({
      childWorldId: worldId,
      expectedParentWorldId,
      ownerId: userId,
      child: worldData,
      parent: parentDoc.exists ? (parentDoc.data() ?? {}) : null,
    });
    if (!eligibility.eligible) {
      return {
        state: 'refused',
        reason: eligibility.reason,
      };
    }

    if (
      !Object.prototype.hasOwnProperty.call(
        worldData,
        PARTIAL_BRANCH_CLEANUP_CLAIM_FIELD
      )
    ) {
      transaction.set(
        worldRef,
        {
          [PARTIAL_BRANCH_CLEANUP_CLAIM_FIELD]: {
            state: 'claimed',
            childWorldId: worldId,
            parentWorldId: expectedParentWorldId,
            ownerId: userId,
            claimedAt: FieldValue.serverTimestamp(),
          },
        },
        { merge: true }
      );
    }

    return { state: 'claimed', worldData };
  });
}

/**
 * Recursively delete all documents in a collection
 *
 * @param collectionRef - Reference to the collection to delete
 * @param startTime - Start time for timeout checking
 * @returns Promise<{ deleted: number; timedOut: boolean }>
 */
async function deleteCollection(
  collectionRef: admin.firestore.CollectionReference,
  startTime: number
): Promise<{ deleted: number; timedOut: boolean }> {
  let deleted = 0;
  let timedOut = false;
  let hasMoreDocuments = true;

  // Query documents in batches
  let query = collectionRef.orderBy('__name__').limit(BATCH_SIZE);

  while (hasMoreDocuments) {
    // Check timeout
    if (Date.now() - startTime > MAX_EXECUTION_MS) {
      timedOut = true;
      break;
    }

    const snapshot = await query.get();

    if (snapshot.empty) {
      hasMoreDocuments = false;
      break;
    }

    // Delete documents in batch
    const batch = db.batch();

    for (const doc of snapshot.docs) {
      batch.delete(doc.ref);
      deleted++;
    }

    await batch.commit();

    // Check if there are more documents to delete
    if (snapshot.docs.length < BATCH_SIZE) {
      hasMoreDocuments = false;
    } else {
      // Prepare for next batch (using the last document as cursor)
      query = collectionRef
        .orderBy('__name__')
        .startAfter(snapshot.docs[snapshot.docs.length - 1])
        .limit(BATCH_SIZE);
    }
  }

  return { deleted, timedOut };
}

/**
 * Recursively delete a world and all its subcollections
 *
 * @param worldId - ID of the world to delete
 * @param startTime - Start time for timeout checking
 * @returns Promise with deletion summary
 */
async function deleteWorldRecursive(
  worldId: string,
  startTime: number
): Promise<{
  worldDeleted: boolean;
  teamsDeleted: number;
  playersDeleted: number;
  freeAgentPoolsDeleted: number;
  eventsDeleted: number;
  entitlementsDeleted: number;
  contractBaselinesDeleted: number;
  timedOut: boolean;
}> {
  const worldRef = db.collection('architect_worlds').doc(worldId);
  let teamsDeleted = 0;
  let playersDeleted = 0;
  let freeAgentPoolsDeleted = 0;
  let eventsDeleted = 0;
  let entitlementsDeleted = 0;
  let contractBaselinesDeleted = 0;
  let timedOut = false;

  // Get all teams to delete their player subcollections first
  const teamsCollectionRef = worldRef.collection('teams');
  const teamsSnapshot = await teamsCollectionRef.get();

  for (const teamDoc of teamsSnapshot.docs) {
    if (Date.now() - startTime > MAX_EXECUTION_MS) {
      timedOut = true;
      break;
    }

    // Delete players subcollection for this team
    const playersCollectionRef = teamDoc.ref.collection('players');
    const playersResult = await deleteCollection(
      playersCollectionRef,
      startTime
    );
    playersDeleted += playersResult.deleted;

    if (playersResult.timedOut) {
      timedOut = true;
      break;
    }

    const freeAgentPoolsResult = await deleteCollection(
      teamDoc.ref.collection('freeAgentPools'),
      startTime
    );
    freeAgentPoolsDeleted += freeAgentPoolsResult.deleted;
    if (freeAgentPoolsResult.timedOut) {
      timedOut = true;
      break;
    }
  }

  // Now delete the teams collection
  if (!timedOut) {
    const teamsResult = await deleteCollection(teamsCollectionRef, startTime);
    teamsDeleted = teamsResult.deleted;
    timedOut = teamsResult.timedOut;
  }

  if (!timedOut) {
    const eventsResult = await deleteCollection(
      worldRef.collection('events'),
      startTime
    );
    eventsDeleted = eventsResult.deleted;
    timedOut = eventsResult.timedOut;
  }

  if (!timedOut) {
    const entitlementsResult = await deleteCollection(
      worldRef.collection('entitlements'),
      startTime
    );
    entitlementsDeleted = entitlementsResult.deleted;
    timedOut = entitlementsResult.timedOut;
  }

  if (!timedOut) {
    const baselinesResult = await deleteCollection(
      worldRef.collection('contractBaselines'),
      startTime
    );
    contractBaselinesDeleted = baselinesResult.deleted;
    timedOut = baselinesResult.timedOut;
  }

  // Finally delete the world document itself
  let worldDeleted = false;
  if (!timedOut) {
    await worldRef.delete();
    worldDeleted = true;
  }

  return {
    worldDeleted,
    teamsDeleted,
    playersDeleted,
    freeAgentPoolsDeleted,
    eventsDeleted,
    entitlementsDeleted,
    contractBaselinesDeleted,
    timedOut,
  };
}

/**
 * Callable function: purgeArchitectWorld
 *
 * Permanently deletes an architect world and all its subcollections.
 * Only the owner can delete their own worlds.
 *
 * Request Data:
 * - worldId: string - The ID of the world to delete
 *
 * Response:
 * - ok: boolean - Whether deletion completed successfully
 * - queued: boolean - If true, deletion is in progress (timed out)
 * - message: string - Status message
 * - details: { teamsDeleted, playersDeleted } - Deletion counts
 *
 * Errors:
 * - unauthenticated: User must be logged in
 * - invalid-argument: worldId is required
 * - not-found: World does not exist
 * - permission-denied: User is not the owner of this world
 */
export const purgeArchitectWorld = onCall(
  {
    // Require authentication
    enforceAppCheck: false, // Can enable later for additional security
    timeoutSeconds: 60,
    memory: '256MiB',
  },
  async (
    request: CallableRequest<{
      worldId: string;
      cleanupPartialBranch?: boolean;
      expectedParentWorldId?: string;
    }>
  ) => {
    const startTime = Date.now();

    // 1) Validate authentication
    if (!request.auth) {
      throw new HttpsError(
        'unauthenticated',
        'User must be authenticated to delete worlds'
      );
    }

    const userId = request.auth.uid;
    const {
      worldId,
      cleanupPartialBranch = false,
      expectedParentWorldId,
    } = request.data;

    // 2) Validate input
    if (!worldId || typeof worldId !== 'string') {
      throw new HttpsError('invalid-argument', 'worldId is required');
    }
    if (typeof cleanupPartialBranch !== 'boolean') {
      throw new HttpsError(
        'invalid-argument',
        'cleanupPartialBranch must be a boolean'
      );
    }
    if (
      cleanupPartialBranch &&
      (!expectedParentWorldId || typeof expectedParentWorldId !== 'string')
    ) {
      throw new HttpsError(
        'invalid-argument',
        'expectedParentWorldId is required for partial branch cleanup'
      );
    }
    if (cleanupPartialBranch && expectedParentWorldId === worldId) {
      throw new HttpsError(
        'invalid-argument',
        'A partial branch cannot be its own parent'
      );
    }

    // 3) Claim partial cleanup atomically, or use the ordinary purge path.
    const worldRef = db.collection('architect_worlds').doc(worldId);
    let worldData: admin.firestore.DocumentData;
    if (cleanupPartialBranch) {
      const claim = await claimPartialBranchCleanup({
        worldId,
        expectedParentWorldId: expectedParentWorldId as string,
        userId,
      });
      if (claim.state === 'already-absent') {
        return {
          ok: true,
          queued: false,
          message: `Partial branch ${worldId} is already absent`,
          details: {
            ...emptyDeletionDetails(),
            alreadyAbsent: true,
          },
        };
      }
      if (claim.state === 'refused') {
        return {
          ok: false,
          queued: false,
          cleanupRefused: true,
          message: `Partial branch cleanup refused (${claim.reason}); no world or lineage data was changed.`,
          details: {
            ...emptyDeletionDetails(),
            cleanupState: 'refused',
            cleanupRefusalReason: claim.reason,
          },
        };
      }
      worldData = claim.worldData;
    } else {
      const worldDoc = await worldRef.get();
      if (!worldDoc.exists) {
        throw new HttpsError('not-found', `World ${worldId} not found`);
      }
      worldData = worldDoc.data() ?? {};
      if (worldData.createdBy !== userId) {
        throw new HttpsError(
          'permission-denied',
          'You do not have permission to delete this world'
        );
      }
    }

    // 4) Check if world has child worlds - prevent deletion if so
    const childWorlds = worldData.childWorlds || [];
    if (childWorlds.length > 0) {
      throw new HttpsError(
        'failed-precondition',
        `Cannot delete world with ${childWorlds.length} child branch(es). Delete children first.`
      );
    }

    // 5) Remove from parent's childWorlds array if this is a child world
    const parentWorldId = worldData.parentWorldId;
    if (!cleanupPartialBranch && parentWorldId) {
      try {
        const parentRef = db.collection('architect_worlds').doc(parentWorldId);
        const parentDoc = await parentRef.get();
        if (parentDoc.exists) {
          await parentRef.update({
            childWorlds: admin.firestore.FieldValue.arrayRemove(worldId),
          });
        }
        // If parent doesn't exist, that's okay - nothing to update
      } catch (parentUpdateError) {
        // Log but don't fail - the child world deletion should still proceed
        console.warn(
          `Failed to update parent world ${parentWorldId} childWorlds array:`,
          parentUpdateError
        );
      }
    }

    // 6) Perform recursive deletion
    const result = await deleteWorldRecursive(worldId, startTime);

    // 7) Return result
    if (result.timedOut) {
      // World deletion is incomplete - return queued status
      // Note: In a production system, you'd queue a background task to complete deletion
      return {
        ok: false,
        queued: true,
        message: `World deletion started but timed out. ${result.teamsDeleted} teams and ${result.playersDeleted} players deleted so far. Please try again to complete deletion.`,
        details: {
          teamsDeleted: result.teamsDeleted,
          playersDeleted: result.playersDeleted,
          freeAgentPoolsDeleted: result.freeAgentPoolsDeleted,
          eventsDeleted: result.eventsDeleted,
          entitlementsDeleted: result.entitlementsDeleted,
          contractBaselinesDeleted: result.contractBaselinesDeleted,
          worldDeleted: result.worldDeleted,
        },
      };
    }

    return {
      ok: true,
      queued: false,
      message: `World "${worldData.worldName || worldId}" permanently deleted`,
      details: {
        teamsDeleted: result.teamsDeleted,
        playersDeleted: result.playersDeleted,
        freeAgentPoolsDeleted: result.freeAgentPoolsDeleted,
        eventsDeleted: result.eventsDeleted,
        entitlementsDeleted: result.entitlementsDeleted,
        contractBaselinesDeleted: result.contractBaselinesDeleted,
        worldDeleted: result.worldDeleted,
      },
    };
  }
);
