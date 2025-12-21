/**
 * Firebase Cloud Functions for Architect World Management
 *
 * These functions handle server-side operations that require Admin SDK
 * privileges, particularly recursive deletion of worlds with subcollections.
 *
 * @module functions/architect
 */

import * as admin from 'firebase-admin';
import { onCall, HttpsError, CallableRequest } from 'firebase-functions/v2/https';

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
  timedOut: boolean;
}> {
  const worldRef = db.collection('architect_worlds').doc(worldId);
  let teamsDeleted = 0;
  let playersDeleted = 0;
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
    const playersResult = await deleteCollection(playersCollectionRef, startTime);
    playersDeleted += playersResult.deleted;

    if (playersResult.timedOut) {
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
  async (request: CallableRequest<{ worldId: string }>) => {
    const startTime = Date.now();

    // 1) Validate authentication
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated to delete worlds');
    }

    const userId = request.auth.uid;
    const { worldId } = request.data;

    // 2) Validate input
    if (!worldId || typeof worldId !== 'string') {
      throw new HttpsError('invalid-argument', 'worldId is required');
    }

    // 3) Load world document and verify ownership
    const worldRef = db.collection('architect_worlds').doc(worldId);
    const worldDoc = await worldRef.get();

    if (!worldDoc.exists) {
      throw new HttpsError('not-found', `World ${worldId} not found`);
    }

    const worldData = worldDoc.data();
    const ownerId = worldData?.createdBy;

    if (ownerId !== userId) {
      throw new HttpsError(
        'permission-denied',
        'You do not have permission to delete this world'
      );
    }

    // 4) Check if world has child worlds - prevent deletion if so
    const childWorlds = worldData?.childWorlds || [];
    if (childWorlds.length > 0) {
      throw new HttpsError(
        'failed-precondition',
        `Cannot delete world with ${childWorlds.length} child branch(es). Delete children first.`
      );
    }

    // 5) Remove from parent's childWorlds array if this is a child world
    const parentWorldId = worldData?.parentWorldId;
    if (parentWorldId) {
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
          worldDeleted: result.worldDeleted,
        },
      };
    }

    return {
      ok: true,
      queued: false,
      message: `World "${worldData?.worldName || worldId}" permanently deleted`,
      details: {
        teamsDeleted: result.teamsDeleted,
        playersDeleted: result.playersDeleted,
        worldDeleted: result.worldDeleted,
      },
    };
  }
);
