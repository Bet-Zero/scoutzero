// Simplified Firebase Data Hook
// This replaces the complex useSeasonPlayerData with fallback strategies

import { useState, useEffect } from 'react';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '@/firebaseConfig';
import { PLAYERS_COLLECTION } from '@/constants/collections';
import { enrichPlayerData } from '@/features/roster/utils';

/**
 * Simple, reliable player data hook with real-time updates
 * Replaces the 4-strategy fallback complexity in useSeasonPlayerData
 * 
 * Returns main player documents only (no subcollections)
 * Use usePlayerDetail for full player data with subcollections
 */
const useSimplePlayerData = () => {
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    // Single data source - no fallbacks, no confusion
    // Note: Cannot orderBy('name') because name is at bio.displayName in v2
    // Client-side sorting will be done after enrichment
    const playersQuery = query(
      collection(db, PLAYERS_COLLECTION)
    );

    // Real-time updates - data stays fresh automatically
    const unsubscribe = onSnapshot(
      playersQuery,
      (snapshot) => {
        const playerData = snapshot.docs.map(doc => {
          const data = doc.data();
          const enriched = enrichPlayerData({
            id: doc.id,
            ...data  // Spread v2 schema fields at top level for easier access
          });
          
          // Add name field for backward compatibility and sorting
          return {
            ...enriched,
            name: enriched.bio?.displayName || 'Unknown'
          };
        });
        
        // Sort by name on client side since we can't orderBy bio.displayName
        playerData.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        
        setPlayers(playerData);
        setLoading(false);
      },
      (err) => {
        console.error('Player data error:', err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  return { players, loading, error };
};

export default useSimplePlayerData;