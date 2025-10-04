// Player Detail Hook - V2 Schema
// Fetches main doc + all subcollections (contracts, seasons, evaluations)

import { useState, useEffect } from 'react';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { db } from '@/firebaseConfig';
import { PLAYERS_COLLECTION } from '@/constants/collections';

/**
 * Hook for fetching complete player data including subcollections
 * Use this for detail views that need contracts, seasons, and evaluations
 * 
 * @param {string} playerId - The player's document ID
 * @returns {Object} { player, loading, error }
 */
const usePlayerDetail = (playerId) => {
  const [player, setPlayer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!playerId) {
      setLoading(false);
      return;
    }

    const fetchPlayerDetail = async () => {
      setLoading(true);
      setError(null);

      try {
        // 1. Fetch main player document
        const playerRef = doc(db, PLAYERS_COLLECTION, playerId);
        const playerSnap = await getDoc(playerRef);

        if (!playerSnap.exists()) {
          throw new Error(`Player ${playerId} not found`);
        }

        const playerData = {
          id: playerSnap.id,
          ...playerSnap.data()
        };

        // 2. Fetch all subcollections in parallel
        const [contractsSnap, seasonsSnap, evaluationsSnap] = await Promise.all([
          getDocs(collection(playerRef, 'contracts')),
          getDocs(collection(playerRef, 'seasons')),
          getDocs(collection(playerRef, 'evaluations'))
        ]);

        // 3. Add subcollection data to player object
        playerData.contracts = contractsSnap.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        playerData.seasons = seasonsSnap.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        playerData.evaluations = evaluationsSnap.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        setPlayer(playerData);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching player detail:', err);
        setError(err.message);
        setLoading(false);
      }
    };

    fetchPlayerDetail();
  }, [playerId]);

  return { player, loading, error };
};

export default usePlayerDetail;
