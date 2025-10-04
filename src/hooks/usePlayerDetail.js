// Hook for fetching detailed player data with subcollections
// Use this for player detail/profile views

import { useState, useEffect } from 'react';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { db } from '@/firebaseConfig';
import { 
  PLAYERS_COLLECTION, 
  CONTRACTS_SUBCOLLECTION, 
  SEASONS_SUBCOLLECTION, 
  EVALUATIONS_SUBCOLLECTION 
} from '@/constants/collections';

/**
 * Fetch detailed player data including all subcollections
 * 
 * Returns v2 schema format with subcollections:
 * {
 *   id: string,
 *   bio: { displayName, age, position, ... },
 *   contracts: { [contractId]: { averageAnnualValue, ... } },
 *   seasons: { [seasonId]: { stats, team, ... } },
 *   evaluations: { [evalId]: { traits, overallGrade, ... } }
 * }
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

    const fetchPlayerDetail = async () => {
      setLoading(true);
      setError(null);

      try {
        // Fetch main player document
        const playerDocRef = doc(db, PLAYERS_COLLECTION, playerId);
        const playerDoc = await getDoc(playerDocRef);

        if (!playerDoc.exists()) {
          throw new Error(`Player ${playerId} not found`);
        }

        const playerData = {
          id: playerDoc.id,
          ...playerDoc.data()
        };

        // Fetch all subcollections in parallel
        const [contractsSnapshot, seasonsSnapshot, evaluationsSnapshot] = await Promise.all([
          getDocs(collection(db, PLAYERS_COLLECTION, playerId, CONTRACTS_SUBCOLLECTION)),
          getDocs(collection(db, PLAYERS_COLLECTION, playerId, SEASONS_SUBCOLLECTION)),
          getDocs(collection(db, PLAYERS_COLLECTION, playerId, EVALUATIONS_SUBCOLLECTION))
        ]);

        // Process contracts - keep ALL contracts (current + extension)
        const contracts = {};
        contractsSnapshot.docs.forEach(contractDoc => {
          contracts[contractDoc.id] = {
            id: contractDoc.id,
            ...contractDoc.data()
          };
        });

        // Process seasons - keyed by seasonId
        const seasons = {};
        seasonsSnapshot.docs.forEach(seasonDoc => {
          seasons[seasonDoc.id] = {
            id: seasonDoc.id,
            ...seasonDoc.data()
          };
        });

        // Process evaluations - since evals are a subcollection by design
        const evaluations = {};
        evaluationsSnapshot.docs.forEach(evalDoc => {
          evaluations[evalDoc.id] = {
            id: evalDoc.id,
            ...evalDoc.data()
          };
        });

        // Combine everything in v2 schema format
        const detailedPlayer = {
          ...playerData,
          contracts,
          seasons,
          evaluations
        };

        setPlayer(detailedPlayer);
        setLoading(false);
      } catch (err) {
        console.error(`Error fetching player detail for ${playerId}:`, err);
        setError(err.message);
        setLoading(false);
      }
    };

    fetchPlayerDetail();
  }, [playerId]);

  return { player, loading, error };
};

export default usePlayerDetail;
