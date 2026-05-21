/**
 * FILE: src/features/architect/GMDashboard/hooks/useScenarioActivityRail.ts
 * PURPOSE: Read-only Stage 1D activity rail derivation and hook for ScenarioMoveRail.
 * OWNERSHIP: Feature: architect/GMDashboard
 *
 * deriveActivityRailState: pure, testable. Converts normalized world events and
 * loading/error state into a discriminated rail state.
 *
 * useScenarioActivityRail: hook wrapping useWorldTeamEvents and normalization.
 * Returns rail state ready for ScenarioMoveRail to render.
 *
 * Truth authority: committed world events from useWorldTeamEvents.
 * Local/pending activity: explicitly deferred in Stage 1D (localPendingDeferred: true).
 */

import { useMemo } from 'react';
import { useWorldTeamEvents } from '@/features/architect/history/hooks/useWorldTeamEvents';
import {
  normalizeWorldEventsForTeamHistory,
  type TeamHistoryWorldEventRow,
} from '@/features/architect/history/utils/normalizeWorldEventsForTeamHistory';

const RAIL_EVENT_LIMIT = 5;

export type ArchitectActivityRailEntry = {
  id: string;
  typeLabel: string;
  summary: string;
  occurredAt: string | null;
  authority: 'committed-world';
};

export type ArchitectActivityRailState =
  | { status: 'sandbox' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'empty' }
  | {
      status: 'available';
      entries: ArchitectActivityRailEntry[];
      hasMore: boolean;
    };

export interface DeriveActivityRailStateInput {
  worldId: string | null | undefined;
  normalizedEvents: TeamHistoryWorldEventRow[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
}

export function deriveActivityRailState({
  worldId,
  normalizedEvents,
  loading,
  error,
  hasMore,
}: DeriveActivityRailStateInput): ArchitectActivityRailState {
  if (!worldId) {
    return { status: 'sandbox' };
  }

  if (loading && normalizedEvents.length === 0) {
    return { status: 'loading' };
  }

  if (error && normalizedEvents.length === 0) {
    return { status: 'error', message: error };
  }

  if (normalizedEvents.length === 0) {
    return { status: 'empty' };
  }

  return {
    status: 'available',
    entries: normalizedEvents.slice(0, RAIL_EVENT_LIMIT).map((row) => ({
      id: row.id,
      typeLabel: row.category || row.type || 'World Event',
      summary: row.summary || '—',
      occurredAt: row.occurredAt || row.timestamp || null,
      authority: 'committed-world',
    })),
    hasMore,
  };
}

export interface UseScenarioActivityRailArgs {
  worldId: string | null | undefined;
  teamCode: string | null | undefined;
  /**
   * Stage 2B refresh seam. When this value changes, the underlying
   * committed-events fetch re-runs. Sandbox/no-world mode is a no-op.
   * Truth source is unchanged — local/pending entries are never synthesized.
   */
  refreshKey?: number;
}

export interface UseScenarioActivityRailResult {
  railState: ArchitectActivityRailState;
  localPendingDeferred: true;
  refetch: () => Promise<void>;
}

export function useScenarioActivityRail({
  worldId,
  teamCode,
  refreshKey = 0,
}: UseScenarioActivityRailArgs): UseScenarioActivityRailResult {
  const enabled = Boolean(worldId && teamCode);

  const { events: rawEvents, loading, error, hasMore, refetch } = useWorldTeamEvents({
    worldId: worldId ?? null,
    teamCode: teamCode ?? null,
    limit: RAIL_EVENT_LIMIT,
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

  const railState = useMemo(
    () =>
      deriveActivityRailState({
        worldId,
        normalizedEvents,
        loading,
        error,
        hasMore,
      }),
    [worldId, normalizedEvents, loading, error, hasMore]
  );

  return {
    railState,
    localPendingDeferred: true,
    refetch,
  };
}
