// Simplified Firebase Data Hook
// This replaces the complex useSeasonPlayerData with fallback strategies

import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '@/firebaseConfig';

/**
 * Simple, reliable player data hook with real-time updates
 * Replaces the 4-strategy fallback complexity in useSeasonPlayerData
 */
const useSimplePlayerData = () => {
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    // Single data source - no fallbacks, no confusion
    const playersQuery = query(
      collection(db, 'players'),
      orderBy('name')
    );

    // Real-time updates - data stays fresh automatically
    const unsubscribe = onSnapshot(
      playersQuery,
      (snapshot) => {
        const playerData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
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