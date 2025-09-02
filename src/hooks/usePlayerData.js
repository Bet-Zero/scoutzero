import { useMemo } from 'react';
import useSimplePlayerData from './useSimplePlayerData';
import useSeasonPlayerData from './useSeasonPlayerData';

/**
 * Main hook for player data - simplified version using single data source
 * Maintains backward compatibility while using the new simplified data layer
 */
const usePlayerData = (season = null) => {
  // Use the simple data hook for most cases (faster, real-time updates)
  const { players: simplePlayers, loading: simpleLoading, error: simpleError } = useSimplePlayerData();
  
  // Keep fallback to complex hook for season-specific requests
  const { players: seasonPlayers, loading: seasonLoading, error: seasonError, diagnostics, isEmpty, isUsingFallback, dataSource } = useSeasonPlayerData(season);
  
  // Determine which data source to use
  const useSeasonData = season !== null;
  
  const players = useSeasonData ? seasonPlayers : simplePlayers;
  const loading = useSeasonData ? seasonLoading : simpleLoading;
  const error = useSeasonData ? seasonError : simpleError;

  // Provide backward compatible diagnostics
  const diagnosticsCompat = useSeasonData ? {
    isEmpty,
    isUsingFallback,
    dataSource,
    playerCount: players.length,
    collectionsChecked: diagnostics?.collectionsChecked || []
  } : {
    isEmpty: players.length === 0,
    isUsingFallback: false,
    dataSource: '/players',
    playerCount: players.length,
    collectionsChecked: ['/players']
  };

  // Log diagnostic info for troubleshooting
  if (diagnosticsCompat && (diagnosticsCompat.isEmpty || diagnosticsCompat.isUsingFallback)) {
    console.log('🔍 Player Data Diagnostics:', {
      playersFound: players.length,
      dataSource: diagnosticsCompat.dataSource,
      usingFallback: diagnosticsCompat.isUsingFallback,
      collectionsChecked: diagnosticsCompat.collectionsChecked
    });
  }

  return { 
    players, 
    loading, 
    error,
    // Additional diagnostic info for troubleshooting
    diagnostics: diagnosticsCompat
  };
};

export default usePlayerData;
