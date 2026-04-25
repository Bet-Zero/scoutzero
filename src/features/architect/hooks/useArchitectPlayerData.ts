// Architect Player Data Hook
// Loads player data from architect_basePlayers collection exclusively

import { useState, useEffect } from 'react';
import {
  subscribeArchitectPlayerData,
  type ArchitectPlayerData,
} from '@/features/architect/utils/subscribeArchitectPlayerData';

/**
 * Hook for loading player data from architect_basePlayers collection
 *
 * Returns player data in format expected by Architect features:
 * - Uses contract.salariesByYear[] format (Architect schema)
 * - Maps displayName to name field for backward compatibility
 * - Real-time updates via Firestore onSnapshot
 *
 * @returns {Object} { players, loading, error }
 */
const useArchitectPlayerData = () => {
  const [players, setPlayers] = useState<ArchitectPlayerData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    // Subscribe to real-time updates via data-layer util
    const unsubscribe = subscribeArchitectPlayerData({
      onData: (playerData) => {
        setPlayers(playerData);
        setLoading(false);
      },
      onError: (err) => {
        console.error('Architect player data error:', err);
        setError(err?.message ?? String(err));
        setLoading(false);
      },
    });

    return () => unsubscribe();
  }, []);

  return { players, loading, error };
};

export default useArchitectPlayerData;
