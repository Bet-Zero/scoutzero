// Hook for fetching player list data (main documents only)
// For detail views with subcollections, use usePlayerDetail instead

import { useState, useEffect } from 'react';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '@/firebaseConfig';
import { PLAYERS_COLLECTION } from '@/constants/collections';

/**
 * Simple player list data hook - fetches ONLY main player documents
 * No subcollection data is fetched here (contracts, seasons, evaluations)
 * 
 * For player detail views that need subcollection data, use usePlayerDetail hook
 * 
 * Returns player data in v2 schema format:
 * {
 *   id: string,
 *   bio: { displayName, age, position, ... },
 *   contractView: { ... } // optional denormalized view data
 * }
 */
const useSimplePlayerData = () => {
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    // Fetch only main documents from players collection
    // No subcollections are fetched here for performance
    const playersQuery = query(
      collection(db, PLAYERS_COLLECTION)
    );

    // Real-time updates - data stays fresh automatically
    const unsubscribe = onSnapshot(
      playersQuery,
      (snapshot) => {
        const playerData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        // Sort by display name (client-side)
        playerData.sort((a, b) => {
          const nameA = (a.bio?.displayName || '').toLowerCase();
          const nameB = (b.bio?.displayName || '').toLowerCase();
          return nameA.localeCompare(nameB);
        });
        
        console.log(`✅ Loaded ${playerData.length} players from ${PLAYERS_COLLECTION}`);
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