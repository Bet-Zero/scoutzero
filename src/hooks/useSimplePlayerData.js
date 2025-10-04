// Simplified Firebase Data Hook
// V2 Schema - fetches main player docs only (no subcollections)

import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '@/firebaseConfig';
import { PLAYERS_COLLECTION } from '@/constants/collections';

/**
 * Simple, reliable player data hook with real-time updates
 * Fetches main player documents from v2 schema (no subcollections)
 * Use usePlayerDetail for full player data with contracts/seasons/evaluations
 */
const useSimplePlayerData = () => {
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    // Single data source - v2 schema main docs only
    const playersQuery = query(
      collection(db, PLAYERS_COLLECTION),
      orderBy('bio.displayName')
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