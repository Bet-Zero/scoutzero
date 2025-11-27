// Architect Player Data Hook
// Loads player data from architect_basePlayers collection exclusively

import { useState, useEffect } from 'react';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '@/firebaseConfig';
import { basePlayersCol } from '@/data/firestorePaths';
import { ARCHITECT_BASE_PLAYERS_PATH } from '@/constants/collections';

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
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    // Load from architect_basePlayers collection
    const playersQuery = query(basePlayersCol());

    // Real-time updates - data stays fresh automatically
    const unsubscribe = onSnapshot(
      playersQuery,
      (snapshot) => {
        const playerData = snapshot.docs.map(doc => {
          const data = doc.data();
          
          // Map architect_basePlayers schema to expected format
          return {
            id: data.playerId || doc.id,
            player_id: data.playerId || doc.id,
            name: data.displayName || 'Unknown', // For backward compatibility
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
            // Preserve all other fields from BasePlayerDoc
            ...data,
          };
        });
        
        // Sort by name on client side
        playerData.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        
        setPlayers(playerData);
        setLoading(false);
      },
      (err) => {
        console.error('Architect player data error:', err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  return { players, loading, error };
};

export default useArchitectPlayerData;

