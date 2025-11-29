/**
 * FILE: src/shared/hooks/useSimplePlayerData.ts
 * PURPOSE: Primary Firestore list hook for players_v2 main docs (no subcollections) with enrichment and diagnostics-friendly shape.
 * OWNERSHIP: Feature: shared/hooks (player data)
 *
 * HISTORY:
 *  - 2025-11-29: Created by plan `plans/player-data-hooks/plan.md` (no chunks, plan-only)
 *
 * LINKS:
 *  - Plan: plans/player-data-hooks/plan.md
 *  - Latest Chunk: plans/player-data-hooks/plan.md
 */

// Simplified Firebase Data Hook
// This replaces the complex useSeasonPlayerData with fallback strategies

import { useEffect, useState } from 'react';
import { collection, onSnapshot, query } from 'firebase/firestore';
import type { PlayerMainDoc } from '@/schemas/players_v2';
import { PLAYERS_COLLECTION } from '@/constants/collections';
import { db } from '@/firebaseConfig';
import { enrichPlayerData } from '@/features/roster/utils';

export type SimplePlayer = (PlayerMainDoc & { id: string; name: string }) & Record<string, unknown>;

interface UseSimplePlayerDataResult {
  players: SimplePlayer[];
  loading: boolean;
  error: string | null;
}

/**
 * Simple, reliable player data hook with real-time updates
 * Replaces the 4-strategy fallback complexity in useSeasonPlayerData
 *
 * Returns main player documents only (no subcollections)
 * Use usePlayerDetail for full player data with subcollections
 */
const useSimplePlayerData = (): UseSimplePlayerDataResult => {
  const [players, setPlayers] = useState<SimplePlayer[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    // Single data source - no fallbacks, no confusion
    // Note: Cannot orderBy('name') because name is at bio.displayName in v2
    // Client-side sorting will be done after enrichment
    const playersQuery = query(collection(db, PLAYERS_COLLECTION));

    // Real-time updates - data stays fresh automatically
    const unsubscribe = onSnapshot(
      playersQuery,
      (snapshot) => {
        const playerData = snapshot.docs.reduce<SimplePlayer[]>((acc, docSnap) => {
          const data = docSnap.data();
          const enriched = enrichPlayerData({
            id: docSnap.id,
            ...data // Spread v2 schema fields at top level for easier access
          });

          if (!enriched) return acc;

          acc.push({
            ...enriched,
            name: enriched.bio?.displayName || 'Unknown'
          } as SimplePlayer);

          return acc;
        }, []);

        // Sort by name on client side since we can't orderBy bio.displayName
        playerData.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

        setPlayers(playerData);
        setLoading(false);
      },
      (err) => {
        console.error('Player data error:', err);
        setError(err instanceof Error ? err.message : String(err));
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  return { players, loading, error };
};

export default useSimplePlayerData;
