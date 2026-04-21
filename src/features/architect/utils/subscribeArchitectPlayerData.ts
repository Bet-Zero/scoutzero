/**
 * FILE: src/features/architect/utils/subscribeArchitectPlayerData.ts
 * PURPOSE: Data-layer subscription utility for architect_basePlayers collection
 * OWNERSHIP: Architect feature
 * HISTORY:
 *   - Created: 2025-12-13 - Extracted Firestore subscription from useArchitectPlayerData hook
 * LINKS:
 *   - Related: src/features/architect/hooks/useArchitectPlayerData.js
 *   - Related: src/data/firestorePaths.js
 *
 * Real-time subscription utility for architect_basePlayers collection.
 * This is the ONLY place that directly imports firebase/firestore for this
 * feature's player-data subscription.
 */

import { onSnapshot, query, FirestoreError } from 'firebase/firestore';
import { basePlayersCol } from '@/data/firestorePaths';
import {
  readArchitectContract,
  readArchitectNumber,
  readArchitectPlayer,
  readArchitectRecord,
  readArchitectString,
  type ArchitectBoundaryContract,
} from '@/features/architect/utils/architectFirestoreBoundary';

/**
 * Arguments for subscribeArchitectPlayerData
 */
interface SubscribeArchitectPlayerDataArgs {
  /**
   * Callback invoked when player data is received or updated.
   * Receives the mapped and sorted player array.
   */
  onData: (players: ArchitectPlayerData[]) => void;

  /**
   * Callback invoked when a snapshot error occurs.
   */
  onError: (error: FirestoreError) => void;
}

/**
 * Mapped player data shape (matches what useArchitectPlayerData returns)
 * Note: Uses Record<string, unknown> to accommodate the ...data spread
 * which can include any additional fields from BasePlayerDoc.
 */
export interface ArchitectPlayerData {
  id: string;
  player_id: string;
  name: string;
  displayName: string;
  position: string;
  age: number | null;
  contract: ArchitectBoundaryContract | null;
  futureContract: ArchitectBoundaryContract | null;
  bio: {
    playerId: string;
    displayName: string;
    [key: string]: unknown;
  };
  representation: unknown;
  [key: string]: unknown; // Accommodates ...data spread
}

/**
 * Subscribe to real-time updates from architect_basePlayers collection.
 *
 * Builds the same query as useArchitectPlayerData (no filters/orderBy/limits),
 * performs the same mapping and client-side sorting, and invokes callbacks
 * for data updates and errors.
 *
 * @param args - Subscription arguments with onData and onError callbacks
 * @returns Unsubscribe function to stop listening
 */
export function subscribeArchitectPlayerData(
  args: SubscribeArchitectPlayerDataArgs
): () => void {
  // Build the same query as useArchitectPlayerData (no modifiers)
  const playersQuery = query(basePlayersCol());

  // Real-time updates - matches exact behavior from useArchitectPlayerData
  const unsubscribe = onSnapshot(
    playersQuery,
    (snapshot) => {
      // Perform the exact same mapping as useArchitectPlayerData
      const playerData: ArchitectPlayerData[] = snapshot.docs.map((docSnap) =>
        mapArchitectPlayerDoc(docSnap.id, docSnap.data())
      );

      // Sort by name on client side (same as useArchitectPlayerData)
      playerData.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

      // Invoke callback with mapped and sorted data
      args.onData(playerData);
    },
    (err: FirestoreError) => {
      // Invoke error callback (hook will handle console.error and state updates)
      args.onError(err);
    }
  );

  return unsubscribe;
}

function mapArchitectPlayerDoc(
  docId: string,
  value: unknown
): ArchitectPlayerData {
  const data = readArchitectPlayer(
    value,
    `architect_basePlayers/${docId}`,
    docId
  );
  const playerId = data.playerId ?? docId;
  const displayName = data.displayName ?? 'Unknown';
  const bio = readArchitectRecord(data.bio) ?? {};

  // Map architect_basePlayers schema to expected format.
  return {
    ...data,
    id: playerId,
    player_id: playerId,
    name: displayName,
    displayName,
    position: readArchitectString(bio.position) ?? '',
    age: readArchitectNumber(bio.age),
    contract: readArchitectContract(data.contract, `${docId}.contract`),
    futureContract: readArchitectContract(
      data.futureContract,
      `${docId}.futureContract`
    ),
    bio: {
      ...bio,
      playerId,
      displayName,
    },
    representation: data.representation ?? null,
  };
}
