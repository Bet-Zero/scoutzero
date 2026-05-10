/**
 * FILE: src/shared/hooks/usePlayerData.ts
 * PURPOSE: Diagnostics-friendly wrapper around useSimplePlayerData; emits warnings for deprecated season usage and provides a diagnostics block.
 * OWNERSHIP: Feature: shared/hooks (player data)
 *
 * HISTORY:
 *  - 2025-11-29: Created by plan `plans/player-data-hooks/plan.md` (no chunks, plan-only)
 *
 * LINKS:
 *  - Plan: plans/player-data-hooks/plan.md
 *  - Latest Chunk: plans/player-data-hooks/plan.md
 */

import type { SimplePlayer } from './useSimplePlayerData';
import { useSimplePlayerData } from './useSimplePlayerData';
import { PLAYERS_COLLECTION } from '@/constants/collections';

type UsePlayerDataDiagnostics = {
  isEmpty: boolean;
  isUsingFallback: boolean;
  dataSource: string;
  playerCount: number;
  collectionsChecked: string[];
};

interface UsePlayerDataResult {
  players: SimplePlayer[];
  loading: boolean;
  error: string | null;
  diagnostics: UsePlayerDataDiagnostics;
}

/**
 * Main hook for player data - now fully simplified to single data source
 * All components should use this unified interface
 */
export const usePlayerData = (season?: string | number | null): UsePlayerDataResult => {
  // Use the simple data hook for all cases (real-time updates, reliable)
  const { players, loading, error } = useSimplePlayerData();

  // Log warning if season parameter is used (no longer supported in simplified architecture)
  if (season !== null && season !== undefined) {
    console.warn(
      `🚨 Season parameter is deprecated in usePlayerData. All data now comes from ${PLAYERS_COLLECTION} collection for consistency.`
    );
  }

  // Provide simplified diagnostics for backward compatibility
  const diagnostics: UsePlayerDataDiagnostics = {
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
      error: error || 'No error'
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

