/**
 * Wave 21 Step 3: World data loading and management sub-hook extracted from
 * useArchitectState.ts (lines 243–741).
 *
 * Owns world metadata/roster apply callbacks, all async loading logic, bundle
 * application, and active-world management actions. Receives state setters and
 * tracker functions from the parent hook as params.
 */

import { useCallback } from 'react';
import { loadWorldTeamData } from '@/features/architect/utils/worldTeamData';
import {
  getWorldMetadata,
  updateWorldAsOfDate,
} from '@/features/architect/utils/worldManager';
import { getLeague } from '@/features/architect/utils/teamLoader';
import { addDaysToIsoDate } from './useArchitectState.helpers';
import type {
  ArchitectPlayer,
  CapSheet,
  CoordinatedWorldLoadBundle,
  CoordinatedWorldRosterBundle,
  FreeAgent,
  ReloadActiveWorldTeamDataOptions,
  ReloadActiveWorldTeamDataResult,
  ReloadActiveWorldTeamDataSource,
  WorldLeagueTeamLike,
  WorldMetadataLike,
  WorldRosterPlayerLike,
} from './useArchitectState.types';
import type { WorldLoadTrackerResult } from './useArchitectState.worldTracker';

export type UseWorldLoaderParams = {
  worldId: string | null;
  worldAsOfDate: string | null;
  teamId: string;
  setWorldId: (v: string | null) => void;
  setBaselineCapSheet: (v: CapSheet | null) => void;
  setTeamCapSheet: (v: CapSheet | null) => void;
  setWorldAsOfDate: (v: string | null) => void;
  setWorldCurrentSeason: (v: string | null) => void;
  setWorldMetadataLoading: (v: boolean) => void;
  setIsUpdatingWorldAsOfDate: (v: boolean) => void;
  setWorldRosterIndex: (v: Set<string> | null) => void;
  setWorldPlayerOverrides: (v: Record<string, ArchitectPlayer>) => void;
  setFreeAgents: (v: FreeAgent[]) => void;
  setIsLoading: (v: boolean) => void;
  setError: (v: string) => void;
  deepClone: <T>(obj: T) => T;
} & Pick<
  WorldLoadTrackerResult,
  | 'isCurrentActiveWorldIdentity'
  | 'startWorldLoadRequest'
  | 'isFreshWorldLoadRequest'
  | 'resolveWorldLoadStaleDrop'
  | 'startWorldAsOfDateMutationRequest'
  | 'isCurrentWorldAsOfDateMutationRequest'
  | 'invalidateActiveWorldAsyncWork'
>;

export type UseWorldLoaderResult = {
  applyWorldMetadata: (metadata: WorldMetadataLike | null | undefined) => void;
  applyWorldMetadataPatch: (metadataPatch: WorldMetadataLike | null | undefined) => void;
  applyWorldRosterBundle: (rosterBundle: CoordinatedWorldRosterBundle | null | undefined) => void;
  resetActiveWorldDerivedState: () => void;
  clearActiveWorldState: () => void;
  setActiveWorld: (nextWorldId: string | null) => void;
  updateAsOfDate: (nextAsOfDate: string) => Promise<string>;
  advanceByOneDay: () => Promise<string>;
  resolveWorldRosterBundle: (activeWorldId: string) => Promise<CoordinatedWorldRosterBundle>;
  prepareCoordinatedWorldLoad: (activeWorldId: string | null, options?: { refreshRosterBundle?: boolean }) => void;
  loadCoordinatedWorldBundle: (activeWorldId: string | null, options?: {
    committedTeamSnapshot?: CapSheet | null;
    committedWorldMetadata?: WorldMetadataLike | null;
    refreshRosterBundle?: boolean;
    throwOnMetadataLoadError?: boolean;
  }) => Promise<CoordinatedWorldLoadBundle>;
  applyCoordinatedWorldBundle: (coordinatedBundle: CoordinatedWorldLoadBundle) => void;
  refreshWorldRosterIndex: () => Promise<Set<string>>;
  reloadActiveWorldTeamData: (options?: ReloadActiveWorldTeamDataOptions) => Promise<ReloadActiveWorldTeamDataResult | null>;
};

export function useWorldLoader(params: UseWorldLoaderParams): UseWorldLoaderResult {
  const {
    worldId,
    worldAsOfDate,
    teamId,
    setWorldId,
    setBaselineCapSheet,
    setTeamCapSheet,
    setWorldAsOfDate,
    setWorldCurrentSeason,
    setWorldMetadataLoading,
    setIsUpdatingWorldAsOfDate,
    setWorldRosterIndex,
    setWorldPlayerOverrides,
    setFreeAgents,
    setIsLoading,
    setError,
    deepClone,
    isCurrentActiveWorldIdentity,
    startWorldLoadRequest,
    isFreshWorldLoadRequest,
    resolveWorldLoadStaleDrop,
    startWorldAsOfDateMutationRequest,
    isCurrentWorldAsOfDateMutationRequest,
    invalidateActiveWorldAsyncWork,
  } = params;

  const applyWorldMetadata = useCallback(
    (metadata: WorldMetadataLike | null | undefined) => {
      setWorldAsOfDate(metadata?.asOfDate || null);
      setWorldCurrentSeason(metadata?.currentSeason || null);
    },
    [setWorldAsOfDate, setWorldCurrentSeason]
  );

  const applyWorldMetadataPatch = useCallback(
    (metadataPatch: WorldMetadataLike | null | undefined) => {
      if (!metadataPatch) return;
      if (metadataPatch.asOfDate !== undefined) {
        setWorldAsOfDate(metadataPatch.asOfDate || null);
      }
      if (metadataPatch.currentSeason !== undefined) {
        setWorldCurrentSeason(metadataPatch.currentSeason || null);
      }
    },
    [setWorldAsOfDate, setWorldCurrentSeason]
  );

  const applyWorldRosterBundle = useCallback(
    (rosterBundle: CoordinatedWorldRosterBundle | null | undefined) => {
      setWorldRosterIndex(rosterBundle?.rosterIndex ?? null);
      setWorldPlayerOverrides(rosterBundle?.playerOverrides ?? {});
    },
    [setWorldRosterIndex, setWorldPlayerOverrides]
  );

  const mergeWorldMetadataSnapshots = useCallback(
    (
      committedMetadata?: WorldMetadataLike | null,
      loadedMetadata?: WorldMetadataLike | null
    ): WorldMetadataLike | null => {
      if (!committedMetadata && !loadedMetadata) return null;
      return { ...(committedMetadata || {}), ...(loadedMetadata || {}) };
    },
    []
  );

  const resetActiveWorldDerivedState = useCallback(() => {
    applyWorldMetadata(null);
    setWorldMetadataLoading(false);
    setIsUpdatingWorldAsOfDate(false);
    applyWorldRosterBundle(null);
    setFreeAgents([]);
  }, [applyWorldMetadata, applyWorldRosterBundle, setFreeAgents, setIsUpdatingWorldAsOfDate, setWorldMetadataLoading]);

  const clearActiveWorldState = useCallback(() => {
    invalidateActiveWorldAsyncWork(null);
    resetActiveWorldDerivedState();
    setWorldId(null);
  }, [invalidateActiveWorldAsyncWork, resetActiveWorldDerivedState, setWorldId]);

  const setActiveWorld = useCallback(
    (nextWorldId: string | null) => {
      if (worldId === nextWorldId) return;
      invalidateActiveWorldAsyncWork(nextWorldId);
      resetActiveWorldDerivedState();
      setWorldId(nextWorldId);
    },
    [invalidateActiveWorldAsyncWork, resetActiveWorldDerivedState, setWorldId, worldId]
  );

  const updateAsOfDate = useCallback(
    async (nextAsOfDate: string): Promise<string> => {
      if (!worldId) throw new Error('worldId is required to update world time');
      if (!nextAsOfDate) throw new Error('asOfDate is required');

      const requestWorldId = worldId;
      const request = startWorldAsOfDateMutationRequest(requestWorldId);
      setIsUpdatingWorldAsOfDate(true);

      try {
        await updateWorldAsOfDate(worldId, nextAsOfDate);
        if (!isCurrentWorldAsOfDateMutationRequest(request)) {
          return nextAsOfDate;
        }
        setWorldAsOfDate(nextAsOfDate);
        return nextAsOfDate;
      } finally {
        if (isCurrentWorldAsOfDateMutationRequest(request)) {
          setIsUpdatingWorldAsOfDate(false);
        }
      }
    },
    [isCurrentWorldAsOfDateMutationRequest, setIsUpdatingWorldAsOfDate, setWorldAsOfDate, startWorldAsOfDateMutationRequest, worldId]
  );

  const advanceByOneDay = useCallback(async (): Promise<string> => {
    if (!worldAsOfDate) {
      throw new Error('Set a world date before advancing time');
    }
    return updateAsOfDate(addDaysToIsoDate(worldAsOfDate, 1));
  }, [updateAsOfDate, worldAsOfDate]);

  const resolveWorldMetadataSnapshot = useCallback(
    async (
      activeWorldId: string,
      options: { throwOnError?: boolean } = {}
    ): Promise<WorldMetadataLike | null> => {
      try {
        return (await getWorldMetadata(activeWorldId)) as WorldMetadataLike | null;
      } catch (error) {
        if (options.throwOnError) throw error;
        console.warn('Failed to load world metadata:', error);
        return null;
      }
    },
    []
  );

  const resolveWorldRosterBundle = useCallback(
    async (activeWorldId: string): Promise<CoordinatedWorldRosterBundle> => {
      try {
        const league = await getLeague(activeWorldId);
        const nextIndex = new Set<string>();
        const nextOverrides: Record<string, ArchitectPlayer> = {};

        league.forEach((team: WorldLeagueTeamLike) => {
          (team?.roster || []).forEach((rawId: unknown) => {
            if (typeof rawId === 'string' && rawId.trim()) {
              nextIndex.add(rawId.trim());
            }
          });

          (team?.players || []).forEach((player: WorldRosterPlayerLike) => {
            const playerId =
              player?.id || player?.player_id || player?.bio?.playerId || null;
            if (typeof playerId === 'string' && playerId.trim()) {
              const normalizedPlayerId = playerId.trim();
              nextIndex.add(normalizedPlayerId);
              nextOverrides[normalizedPlayerId] = {
                ...player,
                id: normalizedPlayerId,
                player_id: normalizedPlayerId,
              };
            }
          });
        });

        return { rosterIndex: nextIndex, playerOverrides: nextOverrides };
      } catch (error) {
        console.warn('Failed to load world roster index:', error);
        return { rosterIndex: null, playerOverrides: {} };
      }
    },
    []
  );

  const prepareCoordinatedWorldLoad = useCallback(
    (
      activeWorldId: string | null,
      options: { refreshRosterBundle?: boolean } = {}
    ) => {
      if (!activeWorldId) {
        setWorldMetadataLoading(false);
        return;
      }
      setWorldMetadataLoading(true);
      if (options.refreshRosterBundle === false) return;
      applyWorldRosterBundle(null);
      setFreeAgents([]);
    },
    [applyWorldRosterBundle, setFreeAgents, setWorldMetadataLoading]
  );

  const loadCoordinatedWorldBundle = useCallback(
    async (
      activeWorldId: string | null,
      options: {
        committedTeamSnapshot?: CapSheet | null;
        committedWorldMetadata?: WorldMetadataLike | null;
        refreshRosterBundle?: boolean;
        throwOnMetadataLoadError?: boolean;
      } = {}
    ): Promise<CoordinatedWorldLoadBundle> => {
      const refreshRosterBundle = options.refreshRosterBundle !== false;
      const teamSnapshot =
        options.committedTeamSnapshot !== undefined
          ? options.committedTeamSnapshot
          : ((await loadWorldTeamData(activeWorldId, teamId)) as CapSheet | null);

      if (!activeWorldId) {
        return { kind: 'sandbox', teamSnapshot };
      }

      const [roster, loadedMetadata] = await Promise.all([
        refreshRosterBundle
          ? resolveWorldRosterBundle(activeWorldId)
          : Promise.resolve<CoordinatedWorldRosterBundle | null>(null),
        resolveWorldMetadataSnapshot(activeWorldId, {
          throwOnError: options.throwOnMetadataLoadError,
        }),
      ]);

      return {
        kind: 'world',
        refreshRosterBundle,
        teamSnapshot,
        metadata: mergeWorldMetadataSnapshots(
          options.committedWorldMetadata,
          loadedMetadata
        ),
        roster,
      };
    },
    [mergeWorldMetadataSnapshots, resolveWorldMetadataSnapshot, resolveWorldRosterBundle, teamId]
  );

  const applyCoordinatedWorldBundle = useCallback(
    (coordinatedBundle: CoordinatedWorldLoadBundle) => {
      if (coordinatedBundle.teamSnapshot) {
        setBaselineCapSheet(coordinatedBundle.teamSnapshot);
        setTeamCapSheet(deepClone(coordinatedBundle.teamSnapshot) as CapSheet);
      }

      if (coordinatedBundle.kind === 'world') {
        if (coordinatedBundle.refreshRosterBundle) {
          applyWorldRosterBundle(coordinatedBundle.roster);
        }
        applyWorldMetadata(coordinatedBundle.metadata);
        setWorldMetadataLoading(false);
        return;
      }

      applyWorldRosterBundle(null);
      applyWorldMetadata(null);
      setWorldMetadataLoading(false);
    },
    [applyWorldMetadata, applyWorldRosterBundle, deepClone, setBaselineCapSheet, setTeamCapSheet, setWorldMetadataLoading]
  );

  const refreshWorldRosterIndex = useCallback(async (): Promise<Set<string>> => {
    if (!worldId) {
      applyWorldRosterBundle(null);
      return new Set<string>();
    }

    const requestWorldId = worldId;
    if (!isCurrentActiveWorldIdentity(requestWorldId)) {
      return new Set<string>();
    }

    applyWorldRosterBundle(null);
    setFreeAgents([]);

    const rosterBundle = await resolveWorldRosterBundle(requestWorldId);
    if (!isCurrentActiveWorldIdentity(requestWorldId)) {
      return new Set<string>();
    }

    applyWorldRosterBundle(rosterBundle);
    return rosterBundle.rosterIndex || new Set<string>();
  }, [applyWorldRosterBundle, isCurrentActiveWorldIdentity, resolveWorldRosterBundle, setFreeAgents, worldId]);

  const reloadActiveWorldTeamData = useCallback(
    async (
      options: ReloadActiveWorldTeamDataOptions = {}
    ): Promise<ReloadActiveWorldTeamDataResult | null> => {
      if (!worldId) return null;

      const requestWorldId = worldId;
      if (!isCurrentActiveWorldIdentity(requestWorldId)) {
        return { outcome: 'stale-drop', reason: 'active-world-changed' };
      }

      const worldLoadRequest = startWorldLoadRequest(requestWorldId);
      const refreshRosterBundle = options.refreshRosterBundle !== false;

      setIsLoading(true);
      setError('');
      prepareCoordinatedWorldLoad(worldId, { refreshRosterBundle });
      applyWorldMetadataPatch(options.committedWorldMetadata);

      const committedTeamSource: ReloadActiveWorldTeamDataSource =
        options.committedTeamSnapshot
          ? options.committedTeamSource || 'changedTeams'
          : 'reload';

      try {
        const coordinatedBundle = await loadCoordinatedWorldBundle(worldId, {
          committedTeamSnapshot: options.committedTeamSnapshot,
          committedWorldMetadata: options.committedWorldMetadata,
          refreshRosterBundle,
          throwOnMetadataLoadError: true,
        });

        const staleDrop = resolveWorldLoadStaleDrop(worldLoadRequest);
        if (staleDrop) return staleDrop;

        if (!coordinatedBundle.teamSnapshot) {
          throw new Error('Committed world team snapshot could not be reloaded.');
        }

        applyCoordinatedWorldBundle(coordinatedBundle);

        return {
          outcome: 'applied',
          committedWorldTeam: {
            committedTeam: coordinatedBundle.teamSnapshot,
            committedTeamSource,
          },
        };
      } catch (err) {
        const staleDrop = resolveWorldLoadStaleDrop(worldLoadRequest);
        if (staleDrop) return staleDrop;

        console.error(err);
        const message =
          err instanceof Error ? err.message : String(err || 'Unknown error');
        setError(`Error loading team data: ${message}`);
        throw err;
      } finally {
        if (isFreshWorldLoadRequest(worldLoadRequest)) {
          setWorldMetadataLoading(false);
          setIsLoading(false);
        }
      }
    },
    [
      applyCoordinatedWorldBundle,
      applyWorldMetadataPatch,
      isCurrentActiveWorldIdentity,
      isFreshWorldLoadRequest,
      loadCoordinatedWorldBundle,
      prepareCoordinatedWorldLoad,
      resolveWorldLoadStaleDrop,
      setError,
      setIsLoading,
      setWorldMetadataLoading,
      startWorldLoadRequest,
      worldId,
    ]
  );

  return {
    applyWorldMetadata,
    applyWorldMetadataPatch,
    applyWorldRosterBundle,
    resetActiveWorldDerivedState,
    clearActiveWorldState,
    setActiveWorld,
    updateAsOfDate,
    advanceByOneDay,
    resolveWorldRosterBundle,
    prepareCoordinatedWorldLoad,
    loadCoordinatedWorldBundle,
    applyCoordinatedWorldBundle,
    refreshWorldRosterIndex,
    reloadActiveWorldTeamData,
  };
}
