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

import { useCallback, useMemo } from 'react';
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
  refreshKey?: number;
  /** Optional player id → display name resolver (e.g. playersMap-backed). */
  resolvePlayerDisplayName?: ((playerId: string) => string | null) | null;
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
  refreshKey = 0,
  resolvePlayerDisplayName = null,
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
    refreshKey,
  });

  const normalizedEvents = useMemo(
    () =>
      enabled
        ? normalizeWorldEventsForTeamHistory(rawEvents, teamCode ?? null)
        : [],
    [enabled, rawEvents, teamCode]
  );

  // Names recorded on the committed events themselves (mutation metadata).
  // These cover players who are no longer in any roster map (BZE-218).
  const eventPlayerNames = useMemo(() => {
    const names: Record<string, string> = {};
    for (const rawEvent of Array.isArray(rawEvents) ? rawEvents : []) {
      const event = rawEvent as {
        mutationMetadata?: { playerId?: unknown; playerName?: unknown } | null;
        metadata?: { playerId?: unknown; playerName?: unknown } | null;
      };
      for (const source of [event.mutationMetadata, event.metadata]) {
        const playerId =
          typeof source?.playerId === 'string' ? source.playerId.trim() : '';
        const playerName =
          typeof source?.playerName === 'string' ? source.playerName.trim() : '';
        if (playerId && playerName && playerName !== playerId) {
          names[playerId] = playerName;
        }
      }
    }
    return names;
  }, [rawEvents]);

  const resolveDisplayName = useCallback(
    (playerId: string): string | null =>
      eventPlayerNames[playerId] ??
      resolvePlayerDisplayName?.(playerId) ??
      null,
    [eventPlayerNames, resolvePlayerDisplayName]
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
      resolvePlayerDisplayName: resolveDisplayName,
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
    resolveDisplayName,
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
