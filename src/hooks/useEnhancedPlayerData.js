// Enhanced player data hook with subcollection support
import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '@/firebaseConfig';
import { useBatchPlayerContracts } from './usePlayerContract';
import { useBatchPlayerSeasonStats } from './usePlayerSeasonStats';

/**
 * Enhanced player data hook that merges root documents with subcollection data
 * Provides backward compatibility while supporting new subcollection structure
 */
const useEnhancedPlayerData = () => {
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    // Fetch root player documents
    const playersQuery = query(
      collection(db, 'players'),
      orderBy('name')
    );

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

  // Get player IDs for batch fetching
  const playerIds = players.map(p => p.id);

  // Batch fetch contracts and season stats
  const { contractsByPlayer, loading: contractsLoading } = useBatchPlayerContracts(playerIds);
  const { statsByPlayer, loading: statsLoading } = useBatchPlayerSeasonStats(playerIds);

  // Merge all data together
  const enhancedPlayers = players.map(player => {
    const contract = contractsByPlayer[player.id];
    const seasonStats = statsByPlayer[player.id];

    return {
      ...player,
      // Add contract data if available
      ...(contract && {
        Contract: contract.Contract,
        'Free Agent': contract['Free Agent'],
        bird_rights: contract.bird_rights,
        contract_summary: contract.contract_summary,
        // Include all other contract fields
        ...Object.fromEntries(
          Object.entries(contract).filter(([key]) => 
            !['id', 'updated_at'].includes(key)
          )
        )
      }),
      // Add season stats if available
      ...(seasonStats && {
        MIN: seasonStats.MIN,
        PPG: seasonStats.PPG,
        RPG: seasonStats.RPG,
        APG: seasonStats.APG,
        'FG%': seasonStats['FG%'],
        '3PT%': seasonStats['3PT%'],
        'FT%': seasonStats['FT%'],
        'EFG%': seasonStats['EFG%'],
        'Games Played': seasonStats['Games Played'],
        // Include all other stat fields
        ...Object.fromEntries(
          Object.entries(seasonStats).filter(([key]) => 
            !['id', 'season_id', 'updated_at'].includes(key)
          )
        )
      })
    };
  });

  return { 
    players: enhancedPlayers, 
    loading: loading || contractsLoading || statsLoading, 
    error 
  };
};

export default useEnhancedPlayerData;
