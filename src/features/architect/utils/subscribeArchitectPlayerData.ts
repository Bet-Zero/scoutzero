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

import {
  onSnapshot,
  query,
  QuerySnapshot,
  FirestoreError,
} from 'firebase/firestore';
import { basePlayersCol } from '@/data/firestorePaths';

/**
 * Arguments for subscribeArchitectPlayerData
 */
interface SubscribeArchitectPlayerDataArgs {
  /**
   * Callback invoked when player data is received or updated.
   * Receives the mapped and sorted player array.
   */
  onData: (players: PlayerData[]) => void;

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
interface PlayerData {
  id: string;
  player_id: string;
  name: string;
  displayName: string;
  position: string;
  age: number | null;
  contract: unknown;
  futureContract: unknown;
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
    (snapshot: QuerySnapshot) => {
      // Perform the exact same mapping as useArchitectPlayerData
      const playerData: PlayerData[] = snapshot.docs.map((doc) => {
        const data = doc.data();

        // Map architect_basePlayers schema to expected format
        // Note: ...data spread at end can overwrite earlier keys (preserving behavior)
        return {
          // Spread first, then override with constructed fields
          ...data,
          id: data.playerId || doc.id,
          player_id: data.playerId || doc.id,
          name: data.displayName || 'Unknown',
          displayName: data.displayName || 'Unknown',
          position: data.bio?.position || '',
          age: data.bio?.age || null,
          contract: data.contract || null,
          futureContract: data.futureContract || null,
          bio: {
            ...(data.bio || {}),
            playerId: data.playerId || doc.id,
            displayName: data.displayName || 'Unknown',
          },
          representation: data.representation || null,
        } as PlayerData;
      });

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
