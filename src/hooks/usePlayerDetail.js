import { useState, useEffect } from 'react';
import { doc, getDoc, getDocs } from 'firebase/firestore';
import { db } from '@/firebaseConfig';
import { playerRef, contractsCol, seasonsCol, evalsCol } from '@/data/firestorePaths';

/**
 * Hook for fetching full player details including subcollections
 * 
 * Fetches:
 * 1. Main player document (bio, etc.)
 * 2. All contract documents (in parallel)
 * 3. All season documents (in parallel)
 * 4. All evaluation documents (in parallel)
 * 
 * Returns v2 schema structure directly - no legacy flattening
 * 
 * @param {string} playerId - Player document ID
 * @returns {Object} { player, loading, error }
 */
const usePlayerDetail = (playerId) => {
  const [player, setPlayer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!playerId) {
      setPlayer(null);
      setLoading(false);
      return;
    }

    let isMounted = true;

    const fetchPlayerDetail = async () => {
      setLoading(true);
      setError(null);

      try {
        // Step 1: Fetch main document
        const mainDocRef = playerRef(db, playerId);
        const mainDocSnap = await getDoc(mainDocRef);

        if (!mainDocSnap.exists()) {
          throw new Error(`Player ${playerId} not found`);
        }

        const mainDoc = mainDocSnap.data();

        // Step 2: Fetch all subcollections in parallel
        const [contractsSnap, seasonsSnap, evalsSnap] = await Promise.all([
          getDocs(contractsCol(db, playerId)),
          getDocs(seasonsCol(db, playerId)),
          getDocs(evalsCol(db, playerId))
        ]);

        // Step 3: Convert subcollections to records
        const contracts = {};
        contractsSnap.forEach(doc => {
          // Filter out metadata fields like last_updated
          if (!doc.id.startsWith('last_')) {
            contracts[doc.id] = doc.data();
          }
        });

        const seasons = {};
        seasonsSnap.forEach(doc => {
          seasons[doc.id] = doc.data();
        });

        const evaluations = {};
        evalsSnap.forEach(doc => {
          evaluations[doc.id] = doc.data();
        });

        // Step 4: Build v2 player structure
        const playerV2 = {
          id: playerId,
          doc: mainDoc,
          contracts: Object.keys(contracts).length > 0 ? contracts : undefined,
          seasons: Object.keys(seasons).length > 0 ? seasons : undefined,
          evaluations: Object.keys(evaluations).length > 0 ? evaluations : undefined
        };

        if (isMounted) {
          setPlayer(playerV2);
          setLoading(false);
        }
      } catch (err) {
        console.error('Error fetching player detail:', err);
        if (isMounted) {
          setError(err.message);
          setLoading(false);
        }
      }
    };

    fetchPlayerDetail();

    return () => {
      isMounted = false;
    };
  }, [playerId]);

  return { player, loading, error };
};

export default usePlayerDetail;
