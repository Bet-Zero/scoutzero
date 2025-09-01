import { useMemo } from 'react';
import useSeasonPlayerData from './useSeasonPlayerData';

/**
 * Main hook for player data - now enhanced with season support and fallback mechanisms
 * Maintains backward compatibility while supporting new season-based structure
 */
const usePlayerData = (season = null) => {
  const { players, loading, error, diagnostics, isEmpty, isUsingFallback, dataSource } = useSeasonPlayerData(season);

  // Log diagnostic info for troubleshooting
  if (diagnostics && (isEmpty || isUsingFallback)) {
    console.log('🔍 Player Data Diagnostics:', {
      playersFound: players.length,
      dataSource,
      usingFallback: isUsingFallback,
      collectionsChecked: diagnostics.collectionsChecked
    });
  }

  return { 
    players, 
    loading, 
    error,
    // Additional diagnostic info for troubleshooting
    diagnostics: {
      isEmpty,
      isUsingFallback,
      dataSource,
      playerCount: players.length,
      collectionsChecked: diagnostics?.collectionsChecked || []
    }
  };
};

export default usePlayerData;
