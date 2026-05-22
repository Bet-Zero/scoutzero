/**
 * FILE: src/features/architect/GMDashboard/hooks/useArchitectComparisonViewModel.ts
 * PURPOSE: Stage 3C hook — derives the comparison view model from committed world events.
 * OWNERSHIP: Feature: architect/GMDashboard
 *
 * Reads from useWorldTeamEvents (committed-only).
 * Normalizes events with normalizeWorldEventsForTeamHistory.
 * Calls deriveComparisonViewModel to produce an authority-labeled view model.
 * No Firestore writes, no new event source, no mutation authority.
 */

import { useMemo } from 'react';
import { useWorldTeamEvents } from '@/features/architect/history/hooks/useWorldTeamEvents';
import { normalizeWorldEventsForTeamHistory } from '@/features/architect/history/utils/normalizeWorldEventsForTeamHistory';
import { deriveComparisonViewModel } from '@/features/architect/comparison/deriveComparisonViewModel';
import type { Stage3ComparisonViewModel } from '@/features/architect/comparison/types';

const COMPARISON_EVENT_LIMIT = 50;

export type ComparisonViewModelStatus = 'sandbox' | 'loading' | 'error' | 'available';

export interface UseArchitectComparisonViewModelArgs {
  worldId: string | null | undefined;
  teamCode: string | null | undefined;
  worldName: string | null;
  baselineSeason: string | null;
  currentSeason: string | null;
  currentRosterPlayerIds: string[];
  worldModifiedTeams?: string[] | null;
}

export interface UseArchitectComparisonViewModelResult {
  status: ComparisonViewModelStatus;
  viewModel: Stage3ComparisonViewModel | null;
  error: string | null;
}

export function useArchitectComparisonViewModel({
  worldId,
  teamCode,
  worldName,
  baselineSeason,
  currentSeason,
  currentRosterPlayerIds,
  worldModifiedTeams,
}: UseArchitectComparisonViewModelArgs): UseArchitectComparisonViewModelResult {
  const enabled = Boolean(worldId && teamCode);

  const {
    events: rawEvents,
    loading,
    error,
  } = useWorldTeamEvents({
    worldId: worldId ?? null,
    teamCode: teamCode ?? null,
    limit: COMPARISON_EVENT_LIMIT,
    enabled,
  });

  const normalizedEvents = useMemo(
    () =>
      enabled
        ? normalizeWorldEventsForTeamHistory(rawEvents, teamCode ?? null)
        : [],
    [enabled, rawEvents, teamCode]
  );

  const viewModel = useMemo(() => {
    if (!worldId || !teamCode) {
      return null;
    }
    return deriveComparisonViewModel({
      worldId,
      worldName,
      teamCode,
      baselineSeason,
      currentSeason,
      committedEventRows: normalizedEvents,
      currentRosterPlayerIds,
      worldModifiedTeams,
    });
  }, [
    worldId,
    worldName,
    teamCode,
    baselineSeason,
    currentSeason,
    normalizedEvents,
    currentRosterPlayerIds,
    worldModifiedTeams,
  ]);

  if (!worldId) {
    return { status: 'sandbox', viewModel: null, error: null };
  }
  if (loading && normalizedEvents.length === 0) {
    return { status: 'loading', viewModel: null, error: null };
  }
  if (error && normalizedEvents.length === 0) {
    return { status: 'error', viewModel: null, error };
  }
  return { status: 'available', viewModel, error: null };
}
