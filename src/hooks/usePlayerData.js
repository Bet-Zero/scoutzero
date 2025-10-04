import { useMemo } from 'react';
import useSimplePlayerData from './useSimplePlayerData';

/**
 * Main hook for player data - returns v2 schema format
 * Uses PLAYERS_COLLECTION constant for easy switching
 * 
 * For list views: Returns main player documents only (no subcollections)
 * For detail views: Use usePlayerDetail hook instead
 */
const usePlayerData = (season = null) => {
  // Use the simple data hook (main documents only)
  const { players, loading, error } = useSimplePlayerData();
  
  // Log warning if season parameter is used (no longer supported)
  if (season !== null) {
    console.warn('🚨 Season parameter is deprecated in usePlayerData. Use players_v2 collection with v2 schema.');
  }

  // Provide diagnostics for troubleshooting
  const diagnostics = {
    isEmpty: players.length === 0,
    dataSource: 'players_v2 (v2 schema)',
    playerCount: players.length,
    collectionsChecked: ['players_v2']
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
    diagnostics
  };
};

export default usePlayerData;
