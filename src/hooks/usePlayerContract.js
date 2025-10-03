// Hook to fetch contract data from subcollection
import { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from '@/firebaseConfig';

/**
 * Hook to fetch contract data for a specific player
 * @param {string} playerId - The player's document ID
 * @returns {Object} { contract, loading, error }
 */
export const usePlayerContract = (playerId) => {
  const [contract, setContract] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!playerId) {
      setContract(null);
      setLoading(false);
      return;
    }

    const fetchContract = async () => {
      setLoading(true);
      setError(null);

      try {
        // Get the most recent contract (ordered by updated_at, limit 1)
        const contractsRef = collection(db, 'players', playerId, 'contracts');
        const q = query(contractsRef, orderBy('updated_at', 'desc'), limit(1));
        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
          const contractDoc = snapshot.docs[0];
          setContract({
            id: contractDoc.id,
            ...contractDoc.data()
          });
        } else {
          setContract(null);
        }
      } catch (err) {
        console.error(`Error fetching contract for ${playerId}:`, err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchContract();
  }, [playerId]);

  return { contract, loading, error };
};

/**
 * Hook to fetch all contracts for a specific player (historical)
 * @param {string} playerId - The player's document ID
 * @returns {Object} { contracts, loading, error }
 */
export const usePlayerContracts = (playerId) => {
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!playerId) {
      setContracts([]);
      setLoading(false);
      return;
    }

    const fetchContracts = async () => {
      setLoading(true);
      setError(null);

      try {
        const contractsRef = collection(db, 'players', playerId, 'contracts');
        const q = query(contractsRef, orderBy('updated_at', 'desc'));
        const snapshot = await getDocs(q);

        const contractData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        setContracts(contractData);
      } catch (err) {
        console.error(`Error fetching contracts for ${playerId}:`, err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchContracts();
  }, [playerId]);

  return { contracts, loading, error };
};

/**
 * Hook to batch fetch contracts for multiple players
 * @param {Array<string>} playerIds - Array of player document IDs
 * @returns {Object} { contractsByPlayer, loading, error }
 */
export const useBatchPlayerContracts = (playerIds = []) => {
  const [contractsByPlayer, setContractsByPlayer] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!playerIds || playerIds.length === 0) {
      setContractsByPlayer({});
      setLoading(false);
      return;
    }

    const fetchAllContracts = async () => {
      setLoading(true);
      setError(null);

      try {
        const results = {};

        // Fetch contracts for each player
        await Promise.all(
          playerIds.map(async (playerId) => {
            try {
              const contractsRef = collection(db, 'players', playerId, 'contracts');
              const q = query(contractsRef, orderBy('updated_at', 'desc'), limit(1));
              const snapshot = await getDocs(q);

              if (!snapshot.empty) {
                const contractDoc = snapshot.docs[0];
                results[playerId] = {
                  id: contractDoc.id,
                  ...contractDoc.data()
                };
              }
            } catch (err) {
              console.warn(`Failed to fetch contract for ${playerId}:`, err);
            }
          })
        );

        setContractsByPlayer(results);
      } catch (err) {
        console.error('Error fetching batch contracts:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchAllContracts();
  }, [playerIds]);

  return { contractsByPlayer, loading, error };
};
