import { useMemo } from 'react';
import useSimplePlayerData from './useSimplePlayerData';
import { PLAYERS_COLLECTION } from '@/constants/collections';

/**
 * Main hook for player data - V2 schema
 * Returns list of players from main collection (no subcollections)
 */
const usePlayerData = (season = null) => {
  // Use the simple data hook for all cases (real-time updates, reliable)
  const { players, loading, error } = useSimplePlayerData();
  
  // Log warning if season parameter is used (no longer supported in v2 schema)
  if (season !== null) {
    console.warn('🚨 Season parameter is deprecated in usePlayerData. All data now comes from v2 schema.');
  }

  // Provide simplified diagnostics for backward compatibility
  const diagnostics = {
    isEmpty: players.length === 0,
    isUsingFallback: false,
    dataSource: PLAYERS_COLLECTION,
    playerCount: players.length,
    collectionsChecked: [PLAYERS_COLLECTION]
  };

  // Log diagnostic info only if there are issues
  if (players.length === 0 && !loading) {
    console.log('🔍 Player Data Diagnostics:', {
      playersFound: players.length,
      dataSource: diagnostics.dataSource,
      error: error?.message || 'No error'
    });
  }

  return { 
    players, 
    loading, 
    error,
    // Backward compatible diagnostics
    diagnostics
  };
};

export default usePlayerData;
