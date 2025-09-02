import { useMemo } from 'react';
import useSimplePlayerData from './useSimplePlayerData';

/**
 * Main hook for player data - now fully simplified to single data source
 * All components should use this unified interface
 */
const usePlayerData = (season = null) => {
  // Use the simple data hook for all cases (real-time updates, reliable)
  const { players, loading, error } = useSimplePlayerData();
  
  // Log warning if season parameter is used (no longer supported in simplified architecture)
  if (season !== null) {
    console.warn('🚨 Season parameter is deprecated in usePlayerData. All data now comes from /players collection for consistency.');
  }

  // Provide simplified diagnostics for backward compatibility
  const diagnostics = {
    isEmpty: players.length === 0,
    isUsingFallback: false,
    dataSource: '/players',
    playerCount: players.length,
    collectionsChecked: ['/players']
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
