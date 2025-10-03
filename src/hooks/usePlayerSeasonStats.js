// Hook to fetch season stats from subcollection
import { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy, doc, getDoc } from 'firebase/firestore';
import { db } from '@/firebaseConfig';

/**
 * Get current season ID
 * @returns {string} Season ID like "2024-25"
 */
const getCurrentSeasonId = () => {
  const now = new Date();
  // NBA season starts in October
  const currentYear = now.getMonth() >= 9 ? now.getFullYear() : now.getFullYear() - 1;
  const nextYear = currentYear + 1;
  return `${currentYear}-${String(nextYear).slice(-2)}`;
};

/**
 * Hook to fetch season stats for a specific player
 * @param {string} playerId - The player's document ID
 * @param {string} seasonId - Season ID (e.g., "2024-25"), defaults to current season
 * @returns {Object} { seasonStats, loading, error }
 */
export const usePlayerSeasonStats = (playerId, seasonId = null) => {
  const [seasonStats, setSeasonStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!playerId) {
      setSeasonStats(null);
      setLoading(false);
      return;
    }

    const fetchSeasonStats = async () => {
      setLoading(true);
      setError(null);

      try {
        const targetSeason = seasonId || getCurrentSeasonId();
        const seasonDocRef = doc(db, 'players', playerId, 'seasons', targetSeason);
        const seasonDoc = await getDoc(seasonDocRef);

        if (seasonDoc.exists()) {
          setSeasonStats({
            id: seasonDoc.id,
            ...seasonDoc.data()
          });
        } else {
          setSeasonStats(null);
        }
      } catch (err) {
        console.error(`Error fetching season stats for ${playerId}:`, err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchSeasonStats();
  }, [playerId, seasonId]);

  return { seasonStats, loading, error };
};

/**
 * Hook to fetch all season stats for a player (historical)
 * @param {string} playerId - The player's document ID
 * @returns {Object} { allSeasons, loading, error }
 */
export const usePlayerAllSeasons = (playerId) => {
  const [allSeasons, setAllSeasons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!playerId) {
      setAllSeasons([]);
      setLoading(false);
      return;
    }

    const fetchAllSeasons = async () => {
      setLoading(true);
      setError(null);

      try {
        const seasonsRef = collection(db, 'players', playerId, 'seasons');
        const q = query(seasonsRef, orderBy('season_id', 'desc'));
        const snapshot = await getDocs(q);

        const seasonsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        setAllSeasons(seasonsData);
      } catch (err) {
        console.error(`Error fetching all seasons for ${playerId}:`, err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchAllSeasons();
  }, [playerId]);

  return { allSeasons, loading, error };
};

/**
 * Hook to batch fetch season stats for multiple players
 * @param {Array<string>} playerIds - Array of player document IDs
 * @param {string} seasonId - Season ID (e.g., "2024-25"), defaults to current season
 * @returns {Object} { statsByPlayer, loading, error }
 */
export const useBatchPlayerSeasonStats = (playerIds = [], seasonId = null) => {
  const [statsByPlayer, setStatsByPlayer] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!playerIds || playerIds.length === 0) {
      setStatsByPlayer({});
      setLoading(false);
      return;
    }

    const fetchAllSeasonStats = async () => {
      setLoading(true);
      setError(null);

      try {
        const targetSeason = seasonId || getCurrentSeasonId();
        const results = {};

        // Fetch season stats for each player
        await Promise.all(
          playerIds.map(async (playerId) => {
            try {
              const seasonDocRef = doc(db, 'players', playerId, 'seasons', targetSeason);
              const seasonDoc = await getDoc(seasonDocRef);

              if (seasonDoc.exists()) {
                results[playerId] = {
                  id: seasonDoc.id,
                  ...seasonDoc.data()
                };
              }
            } catch (err) {
              console.warn(`Failed to fetch season stats for ${playerId}:`, err);
            }
          })
        );

        setStatsByPlayer(results);
      } catch (err) {
        console.error('Error fetching batch season stats:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchAllSeasonStats();
  }, [playerIds, seasonId]);

  return { statsByPlayer, loading, error };
};

/**
 * Hook to fetch complete player data with contract and season stats
 * @param {string} playerId - The player's document ID
 * @param {string} seasonId - Season ID (optional), defaults to current season
 * @returns {Object} { player, contract, seasonStats, loading, error }
 */
export const useCompletePlayerData = (playerId, seasonId = null) => {
  const [player, setPlayer] = useState(null);
  const [contract, setContract] = useState(null);
  const [seasonStats, setSeasonStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!playerId) {
      setPlayer(null);
      setContract(null);
      setSeasonStats(null);
      setLoading(false);
      return;
    }

    const fetchCompleteData = async () => {
      setLoading(true);
      setError(null);

      try {
        const targetSeason = seasonId || getCurrentSeasonId();

        // Fetch player document
        const playerDocRef = doc(db, 'players', playerId);
        const playerDoc = await getDoc(playerDocRef);

        if (!playerDoc.exists()) {
          throw new Error(`Player ${playerId} not found`);
        }

        setPlayer({
          id: playerDoc.id,
          ...playerDoc.data()
        });

        // Fetch current contract
        try {
          const contractsRef = collection(db, 'players', playerId, 'contracts');
          const contractQuery = query(contractsRef, orderBy('updated_at', 'desc'));
          const contractSnapshot = await getDocs(contractQuery);

          if (!contractSnapshot.empty) {
            const contractDoc = contractSnapshot.docs[0];
            setContract({
              id: contractDoc.id,
              ...contractDoc.data()
            });
          }
        } catch (err) {
          console.warn(`No contract data for ${playerId}:`, err);
        }

        // Fetch season stats
        try {
          const seasonDocRef = doc(db, 'players', playerId, 'seasons', targetSeason);
          const seasonDoc = await getDoc(seasonDocRef);

          if (seasonDoc.exists()) {
            setSeasonStats({
              id: seasonDoc.id,
              ...seasonDoc.data()
            });
          }
        } catch (err) {
          console.warn(`No season stats for ${playerId}:`, err);
        }
      } catch (err) {
        console.error(`Error fetching complete data for ${playerId}:`, err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchCompleteData();
  }, [playerId, seasonId]);

  return { player, contract, seasonStats, loading, error };
};
