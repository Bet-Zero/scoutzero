/**
 * FILE: src/features/architect/GMDashboard/hooks/useArchitectState.ts
 * PURPOSE: Centralized state management hook for GMDashboard - manages all dashboard state, data loading, and persistence.
 * OWNERSHIP: Feature: architect/GMDashboard
 *
 * ARCHITECT OWNERSHIP:
 * - Dashboard-state adapter.
 * - Consumes the explicit read stack through worldTeamData.ts and worldManager.ts.
 * - Owns committed-world resync, metadata patching, and stale-drop once handed a committed team snapshot.
 * - Coordinates dashboard-visible state, world metadata, and roster context.
 * - Does not own world/base fallback resolution or committed writes.
 *
 * HISTORY:
 *  - 2025-12-12: Created - extracted all state from GMDashboard.tsx (Phase 2 refactor)
 *  - 2025-12-12: Converted to TypeScript with proper type annotations
 *  - 2025-12-20: Phase 2B - wired world-aware data loading via loadWorldTeamData
 *
 * LINKS:
 *  - Plan: plans/gmdashboard_state_hook_fea52793.plan.md
 *  - Gap Analysis: docs/architect/ARCHITECT_GAP_ANALYSIS.md
 */
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { loadWorldTeamData } from '@/features/architect/utils/worldTeamData';
import type { LoadedWorldTeamCapSheet } from '@/features/architect/utils/worldTeamData';
import {
  getWorldMetadata,
  updateWorldAsOfDate,
} from '@/features/architect/utils/worldManager';
import { getLeague } from '@/features/architect/utils/teamLoader';
import { useArchitectPlayerData } from '@/features/architect/hooks/useArchitectPlayerData';
import type {
  BasePlayerContract,
  CapHoldItem,
  DeadCapItem,
  DraftPick,
  Exceptions,
  PlayerRulesProfileInput,
  PlayerRulesProfileTeamCapSheet,
} from '@/features/architect/types';
import type { TeamHistoryCapSheetLike } from '@/features/architect/history/TeamHistoryTab/types';
import type { ArchitectMutationTeamTotals } from '@/features/architect/utils/mutationPipeline';
import type { OfferSheetLike } from '../offerSheetTypes';
import { capProjections } from '@/features/architect/utils/capProjections';
import { toEndYear } from '@/features/architect/utils/seasonFormat';
import { resolvePlayerDisplayName } from '@/features/architect/constants/playerNameCorrections';
import type { OffseasonAppliedChangesSummary } from '@/features/architect/utils/offseason/resolveOffseasonTransition';

// ==== Utility: Deep Clone ====
/**
 * Deep clones an object using structuredClone when available,
 * falling back to JSON parse/stringify for older environments.
 * structuredClone preserves Dates, Maps, Sets, and undefined values.
 */
function deepClone<T>(obj: T): T {
  if (typeof structuredClone === 'function') {
    return structuredClone(obj);
  }
  // Fallback for environments without structuredClone (e.g., older browsers)
  return JSON.parse(JSON.stringify(obj));
}


// Wave 11 Step 2: type definitions extracted to submodule
export * from './useArchitectState.types';
import type {
  ActiveTab,
  ActiveWorldDateMutationRequest,
  ActiveWorldLoadFreshness,
  ActiveWorldLoadRequest,
  ArchitectActiveWorldOwner,
  ArchitectDashboardCapSheet,
  ArchitectDashboardPlayer,
  ArchitectPlayer,
  ArchitectWorldModeBoundary,
  ArchitectWorldTimeOwner,
  CapProjectionMap,
  CapSheet,
  CoordinatedWorldLoadBundle,
  CoordinatedWorldRosterBundle,
  DashboardOffseasonSummary,
  FreeAgent,
  PlayersMap,
  ReloadActiveWorldMetadataPatch,
  ReloadActiveWorldTeam,
  ReloadActiveWorldTeamDataAppliedResult,
  ReloadActiveWorldTeamDataOptions,
  ReloadActiveWorldTeamDataResult,
  ReloadActiveWorldTeamDataSource,
  ReloadActiveWorldTeamDataStaleDropReason,
  ReloadActiveWorldTeamDataStaleDropResult,
  UseArchitectStateParams,
  UseArchitectStateReturn,
  WorldLeagueTeamLike,
  WorldMetadataLike,
  WorldRosterPlayerLike,
} from './useArchitectState.types';
import { mergeWorldPlayerOverride } from './useArchitectState.types';



// Wave 11 Step 3: season helpers extracted to submodule
export * from './useArchitectState.helpers';
import {
  LOCAL_SEASON_KEY,
  addDaysToIsoDate,
  findClosestYear,
  getActiveWorldStorageKey,
  getDefaultSeasonEndYear,
  getIsoDateString,
  normalizeLookupKey,
  readPersistedActiveWorldId,
  resolveUsableActiveWorldId,
  seasonEndYearsFromCaps,
  writePersistedActiveWorldId,
} from './useArchitectState.helpers';

export function useArchitectState({
  teamId,
  userId,
  authLoading,
}: UseArchitectStateParams): UseArchitectStateReturn {
  // === Core data state ===
  const [baselineCapSheet, setBaselineCapSheet] = useState<CapSheet | null>(
    null
  );
  const [teamCapSheet, setTeamCapSheet] = useState<CapSheet | null>(null);
  const [freeAgents, setFreeAgents] = useState<FreeAgent[]>([]);

  // === World state (for Architect worlds system) ===
  const [worldId, setWorldId] = useState<string | null>(null);
  const [worldAsOfDate, setWorldAsOfDate] = useState<string | null>(null);
  const [worldCurrentSeason, setWorldCurrentSeason] = useState<string | null>(
    null
  );
  const [worldMetadataLoading, setWorldMetadataLoading] =
    useState<boolean>(false);
  const [hasRestoredActiveWorld, setHasRestoredActiveWorld] =
    useState<boolean>(false);
  const [isUpdatingWorldAsOfDate, setIsUpdatingWorldAsOfDate] =
    useState<boolean>(false);
  const [worldRosterIndex, setWorldRosterIndex] = useState<Set<string> | null>(
    null
  );
  const [worldPlayerOverrides, setWorldPlayerOverrides] = useState<
    Record<string, ArchitectPlayer>
  >({});

  // === Selection state ===
  const [currentYear, setCurrentYear] = useState<number>(() => {
    // Get available years from cap projections
    const availableYears = seasonEndYearsFromCaps(capProjections);

    // Check URL query parameter first
    const qp = new URLSearchParams(window.location.search).get('season');
    if (qp && Number.isFinite(parseInt(qp, 10))) {
      const year = parseInt(qp, 10);
      // Validate against available cap projections
      if (availableYears.includes(year)) return year;
    }

    // Check localStorage
    const saved = localStorage.getItem(LOCAL_SEASON_KEY);
    if (saved && Number.isFinite(parseInt(saved, 10))) {
      const year = parseInt(saved, 10);
      // Validate against available cap projections
      if (availableYears.includes(year)) return year;
    }

    // Default to current season, but ensure it exists in capProjections
    // If capProjections is empty/missing, fall back to getDefaultSeasonEndYear()
    const defaultYear = getDefaultSeasonEndYear();
    return findClosestYear(defaultYear, availableYears);
  });

  const [selectedRulesYear, setSelectedRulesYear] =
    useState<number>(currentYear);
  const [selectedPlayer, setSelectedPlayer] = useState<ArchitectPlayer | null>(
    null
  );
  const [activeTab, setActiveTab] = useState<ActiveTab>('roster');

  // === Offseason state ===
  const [lastCapSheet, setLastCapSheet] = useState<CapSheet | null>(null);
  const [offseasonRun, setOffseasonRun] = useState<boolean>(false);
  const [offseasonSummary, setOffseasonSummary] =
    useState<DashboardOffseasonSummary | null>(null);

  // === Loading/error state ===
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  // State-owned freshness counters. Changing world identity or starting a newer
  // request invalidates older async work before it can publish visible truth.
  const dataLoadRequestIdRef = useRef(0);
  const activeWorldIdentityRef = useRef<string | null>(null);
  const activeWorldIdentityTokenRef = useRef(0);
  const worldAsOfDateMutationIdRef = useRef(0);
  const restoredActiveWorldUserIdRef = useRef<string | null>(null);

  // === Internal hook call ===
  const { players } = useArchitectPlayerData() as {
    players: ArchitectPlayer[];
  };

  // === Memoized derivations ===
  const worldAwarePlayers = useMemo<ArchitectPlayer[]>(() => {
    if (!worldId) return players;

    const merged = new Map<string, ArchitectPlayer>();
    players.forEach((player) => {
      const playerId = player.id || player.player_id || player.bio?.playerId;
      if (!playerId) return;
      merged.set(playerId, player);
    });

    Object.entries(worldPlayerOverrides).forEach(([playerId, override]) => {
      const basePlayer = merged.get(playerId) || null;
      merged.set(playerId, mergeWorldPlayerOverride(basePlayer, override));
    });

    return Array.from(merged.values());
  }, [players, worldId, worldPlayerOverrides]);

  const playersMap = useMemo<PlayersMap>(() => {
    const map: PlayersMap = {};
    worldAwarePlayers.forEach((p) => {
      if (p.name) {
        map[p.name] = p;
        map[normalizeLookupKey(p.name)] = p;
      }
      if (p.id) map[p.id] = p;
      if (p.player_id) map[p.player_id] = p;
      if (p.bio?.playerId) map[p.bio.playerId] = p;
    });
    return map;
  }, [worldAwarePlayers]);

  const capTableYears = useMemo<number[]>(
    () => Array.from({ length: 7 }, (_, i) => currentYear + i),
    [currentYear]
  );

  const applyWorldMetadata = useCallback(
    (metadata: WorldMetadataLike | null | undefined) => {
      setWorldAsOfDate(metadata?.asOfDate || null);
      setWorldCurrentSeason(metadata?.currentSeason || null);
    },
    []
  );

  const applyWorldMetadataPatch = useCallback(
    (metadataPatch: WorldMetadataLike | null | undefined) => {
      if (!metadataPatch) {
        return;
      }

      if (metadataPatch.asOfDate !== undefined) {
        setWorldAsOfDate(metadataPatch.asOfDate || null);
      }

      if (metadataPatch.currentSeason !== undefined) {
        setWorldCurrentSeason(metadataPatch.currentSeason || null);
      }
    },
    []
  );

  const applyWorldRosterBundle = useCallback(
    (rosterBundle: CoordinatedWorldRosterBundle | null | undefined) => {
      setWorldRosterIndex(rosterBundle?.rosterIndex ?? null);
      setWorldPlayerOverrides(rosterBundle?.playerOverrides ?? {});
    },
    []
  );

  const mergeWorldMetadataSnapshots = useCallback(
    (
      committedMetadata?: WorldMetadataLike | null,
      loadedMetadata?: WorldMetadataLike | null
    ): WorldMetadataLike | null => {
      if (!committedMetadata && !loadedMetadata) {
        return null;
      }

      return {
        ...(committedMetadata || {}),
        ...(loadedMetadata || {}),
      };
    },
    []
  );

  const startWorldLoadRequest = useCallback(
    (requestWorldId: string | null): ActiveWorldLoadRequest => {
      const requestId = dataLoadRequestIdRef.current + 1;
      dataLoadRequestIdRef.current = requestId;
      return {
        requestWorldId,
        requestId,
      };
    },
    []
  );

  const resolveWorldLoadFreshness = useCallback(
    (request: ActiveWorldLoadRequest): ActiveWorldLoadFreshness => {
      if (activeWorldIdentityRef.current !== request.requestWorldId) {
        return {
          status: 'stale',
          reason: 'active-world-changed',
        };
      }

      if (dataLoadRequestIdRef.current !== request.requestId) {
        return {
          status: 'stale',
          reason: 'superseded-by-newer-request',
        };
      }

      return { status: 'fresh' };
    },
    []
  );

  const isFreshWorldLoadRequest = useCallback(
    (request: ActiveWorldLoadRequest) =>
      resolveWorldLoadFreshness(request).status === 'fresh',
    [resolveWorldLoadFreshness]
  );

  const resolveWorldLoadStaleDrop = useCallback(
    (
      request: ActiveWorldLoadRequest
    ): ReloadActiveWorldTeamDataStaleDropResult | null => {
      const freshness = resolveWorldLoadFreshness(request);
      if (freshness.status === 'fresh') {
        return null;
      }

      return {
        outcome: 'stale-drop',
        reason: freshness.reason,
      };
    },
    [resolveWorldLoadFreshness]
  );

  const invalidateActiveWorldAsyncWork = useCallback(
    (nextWorldId: string | null) => {
      const identityChanged = activeWorldIdentityRef.current !== nextWorldId;
      activeWorldIdentityRef.current = nextWorldId;

      if (!identityChanged) {
        return;
      }

      activeWorldIdentityTokenRef.current += 1;
      dataLoadRequestIdRef.current += 1;
      worldAsOfDateMutationIdRef.current += 1;
    },
    []
  );

  const isCurrentActiveWorldIdentity = useCallback(
    (candidateWorldId: string | null) =>
      activeWorldIdentityRef.current === candidateWorldId,
    []
  );

  const startWorldAsOfDateMutationRequest = useCallback(
    (requestWorldId: string): ActiveWorldDateMutationRequest => {
      const requestId = worldAsOfDateMutationIdRef.current + 1;
      worldAsOfDateMutationIdRef.current = requestId;
      return {
        requestWorldId,
        requestId,
      };
    },
    []
  );

  const isCurrentWorldAsOfDateMutationRequest = useCallback(
    (request: ActiveWorldDateMutationRequest) =>
      worldAsOfDateMutationIdRef.current === request.requestId &&
      activeWorldIdentityRef.current === request.requestWorldId,
    []
  );

  // Keep active-world restore/switch/clear flows in one state-owner seam.
  const resetActiveWorldDerivedState = useCallback(() => {
    applyWorldMetadata(null);
    setWorldMetadataLoading(false);
    setIsUpdatingWorldAsOfDate(false);
    applyWorldRosterBundle(null);
    setFreeAgents([]);
  }, [applyWorldMetadata, applyWorldRosterBundle]);

  const clearActiveWorldState = useCallback(() => {
    invalidateActiveWorldAsyncWork(null);
    resetActiveWorldDerivedState();
    setWorldId(null);
  }, [invalidateActiveWorldAsyncWork, resetActiveWorldDerivedState]);

  const setActiveWorld = useCallback(
    (nextWorldId: string | null) => {
      if (worldId === nextWorldId) {
        return;
      }

      invalidateActiveWorldAsyncWork(nextWorldId);
      resetActiveWorldDerivedState();
      setWorldId(nextWorldId);
    },
    [invalidateActiveWorldAsyncWork, resetActiveWorldDerivedState, worldId]
  );

  const updateAsOfDate = useCallback(
    async (nextAsOfDate: string): Promise<string> => {
      if (!worldId) {
        throw new Error('worldId is required to update world time');
      }
      if (!nextAsOfDate) {
        throw new Error('asOfDate is required');
      }

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
    [isCurrentWorldAsOfDateMutationRequest, startWorldAsOfDateMutationRequest, worldId]
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
        return (await getWorldMetadata(activeWorldId)) as
          | WorldMetadataLike
          | null;
      } catch (error) {
        if (options.throwOnError) {
          throw error;
        }

        console.warn('Failed to load world metadata:', error);
        return null;
      }
    },
    []
  );

  const resolveWorldRosterBundle = useCallback(async (
    activeWorldId: string
  ): Promise<CoordinatedWorldRosterBundle> => {
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

      return {
        rosterIndex: nextIndex,
        playerOverrides: nextOverrides,
      };
    } catch (error) {
      console.warn('Failed to load world roster index:', error);
      return {
        rosterIndex: null,
        playerOverrides: {},
      };
    }
  }, []);

  const prepareCoordinatedWorldLoad = useCallback(
    (
      activeWorldId: string | null,
      options: {
        refreshRosterBundle?: boolean;
      } = {}
    ) => {
      if (!activeWorldId) {
        setWorldMetadataLoading(false);
        return;
      }

      setWorldMetadataLoading(true);

      if (options.refreshRosterBundle === false) {
        return;
      }

      applyWorldRosterBundle(null);
      setFreeAgents([]);
    },
    [applyWorldRosterBundle]
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
      // Read-stack contract: dashboard state enters through layer 3
      // (worldTeamData.ts), which adapts layer 2 (teamLoader.ts) over
      // layer 1 (firebaseTeamPlanHelpers.ts). This hook should not
      // reconstruct the fallback chain locally.
      const teamSnapshot =
        options.committedTeamSnapshot !== undefined
          ? options.committedTeamSnapshot
          : ((await loadWorldTeamData(activeWorldId, teamId)) as CapSheet | null);

      if (!activeWorldId) {
        return {
          kind: 'sandbox',
          teamSnapshot,
        };
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
    [
      mergeWorldMetadataSnapshots,
      resolveWorldMetadataSnapshot,
      resolveWorldRosterBundle,
      teamId,
    ]
  );

  // Final guarded bundle-application seam. Callers must re-check freshness
  // after async work and before applying the coordinated bundle.
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
    [applyWorldMetadata, applyWorldRosterBundle]
  );

  const refreshWorldRosterIndex = useCallback(async (): Promise<
    Set<string>
  > => {
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
  }, [
    applyWorldRosterBundle,
    isCurrentActiveWorldIdentity,
    resolveWorldRosterBundle,
    worldId,
  ]);

  const reloadActiveWorldTeamData = useCallback(
    async (
      options: ReloadActiveWorldTeamDataOptions = {}
    ): Promise<ReloadActiveWorldTeamDataResult | null> => {
      if (!worldId) {
        return null;
      }

      const requestWorldId = worldId;
      if (!isCurrentActiveWorldIdentity(requestWorldId)) {
        return {
          outcome: 'stale-drop',
          reason: 'active-world-changed',
        };
      }

      const worldLoadRequest = startWorldLoadRequest(requestWorldId);
      const refreshRosterBundle = options.refreshRosterBundle !== false;

      setIsLoading(true);
      setError('');
      prepareCoordinatedWorldLoad(worldId, {
        refreshRosterBundle,
      });
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
        if (staleDrop) {
          return staleDrop;
        }

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
        if (staleDrop) {
          return staleDrop;
        }

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
      applyWorldMetadataPatch,
      applyCoordinatedWorldBundle,
      isCurrentActiveWorldIdentity,
      isFreshWorldLoadRequest,
      loadCoordinatedWorldBundle,
      prepareCoordinatedWorldLoad,
      resolveWorldLoadStaleDrop,
      startWorldLoadRequest,
      worldId,
    ]
  );

  // === Effect 1: Persist currentYear to localStorage + URL query param ===
  useEffect(() => {
    localStorage.setItem(LOCAL_SEASON_KEY, String(currentYear));
    const url = new URL(window.location.href);
    url.searchParams.set('season', String(currentYear));
    window.history.replaceState({}, '', url);
  }, [currentYear]);

  // === Effect 2: Sync selectedRulesYear with currentYear ===
  useEffect(() => {
    setSelectedRulesYear(currentYear);
  }, [currentYear]);

  // === Effect 3: Restore persisted active world once per signed-in user ===
  useEffect(() => {
    if (!userId) {
      restoredActiveWorldUserIdRef.current = null;
      setHasRestoredActiveWorld(false);
      clearActiveWorldState();
      return;
    }

    if (restoredActiveWorldUserIdRef.current === userId) {
      return;
    }

    restoredActiveWorldUserIdRef.current = userId;
    setHasRestoredActiveWorld(false);
    clearActiveWorldState();

    let isCancelled = false;

    const restoreActiveWorld = async () => {
      const storedWorldId = readPersistedActiveWorldId(userId);

      if (!storedWorldId) {
        return;
      }

      const restoredWorldId = await resolveUsableActiveWorldId(
        storedWorldId,
        userId
      );

      if (!restoredWorldId) {
        writePersistedActiveWorldId(userId, null);
        if (!isCancelled) {
          clearActiveWorldState();
        }
        return;
      }

      if (!isCancelled) {
        setActiveWorld(restoredWorldId);
      }
    };

    void restoreActiveWorld()
      .catch(() => {
        writePersistedActiveWorldId(userId, null);
        if (!isCancelled) {
          clearActiveWorldState();
        }
      })
      .finally(() => {
        if (!isCancelled) {
          setHasRestoredActiveWorld(true);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [clearActiveWorldState, setActiveWorld, userId]);

  // === Effect 4: Persist active world selection after restore ===
  useEffect(() => {
    if (!userId || !hasRestoredActiveWorld) {
      return;
    }

    writePersistedActiveWorldId(userId, worldId);
  }, [hasRestoredActiveWorld, userId, worldId]);

  // === Effect 5: Validate active world ownership/archival in the state layer ===
  useEffect(() => {
    if (!userId || !worldId || !hasRestoredActiveWorld) {
      return;
    }

    let isCancelled = false;

    const validateActiveWorld = async () => {
      const validatedWorldId = await resolveUsableActiveWorldId(
        worldId,
        userId
      );

      if (!isCancelled && validatedWorldId !== worldId) {
        setActiveWorld(null);
      }
    };

    void validateActiveWorld();

    return () => {
      isCancelled = true;
    };
  }, [hasRestoredActiveWorld, setActiveWorld, userId, worldId]);

  // === Effect 6: Fetch team data on mount and when worldId changes ===
  // Uses world-aware loading via loadWorldTeamData (Phase 2B)
  // Fallback chain: world snapshot → parent world → base team
  useEffect(() => {
    let isCancelled = false;

    const fetchData = async () => {
      const requestWorldId = worldId;
      const worldLoadRequest = startWorldLoadRequest(requestWorldId);

      setIsLoading(true);
      setError('');
      prepareCoordinatedWorldLoad(worldId);
      try {
        // World-aware data loading uses one coordinated bundle so snapshot,
        // metadata, and roster override truth stay aligned across modes.
        const coordinatedBundle = await loadCoordinatedWorldBundle(worldId);

        if (isCancelled || !isFreshWorldLoadRequest(worldLoadRequest)) {
          return;
        }

        applyCoordinatedWorldBundle(coordinatedBundle);

        if (!coordinatedBundle.teamSnapshot) {
          console.warn('No saved team found, using blank slate.');
        }
      } catch (err) {
        if (isCancelled || !isFreshWorldLoadRequest(worldLoadRequest)) {
          return;
        }

        console.error(err);
        const message =
          err instanceof Error ? err.message : String(err || 'Unknown error');
        setError(`Error loading team data: ${message}`);
      } finally {
        if (!isCancelled && isFreshWorldLoadRequest(worldLoadRequest)) {
          setWorldMetadataLoading(false);
          setIsLoading(false);
        }
      }
    };

    // Wait for auth to finish loading before fetching data
    if (!authLoading) {
      fetchData();
    }

    return () => {
      isCancelled = true;
    };
  }, [
    applyCoordinatedWorldBundle,
    authLoading,
    isFreshWorldLoadRequest,
    loadCoordinatedWorldBundle,
    prepareCoordinatedWorldLoad,
    startWorldLoadRequest,
    worldId,
  ]);

  // === Effect 7: Derive free agents dynamically from the player pool ===
  useEffect(() => {
    if (!worldAwarePlayers || worldAwarePlayers.length === 0) return;
    if (worldId && worldRosterIndex === null) return;

    const upcomingFreeAgents = worldAwarePlayers
      .filter((p) => {
        // 0. Filter out invalid players (only if no ID is present)
        if ((!p.name || p.name === 'Unknown') && !p.id && !p.player_id)
          return false;

        const playerId = p.id || p.player_id || p.bio?.playerId || null;
        if (worldId) {
          if (!playerId) return false;
          return !worldRosterIndex?.has(playerId);
        }

        // 1. Check if player has NO contract or empty salaries
        if (
          !p.contract ||
          !p.contract.salariesByYear ||
          p.contract.salariesByYear.length === 0
        ) {
          return true; // Current Free Agent
        }

        // 2. Find the last year of the contract
        const sortedYears = [...p.contract.salariesByYear].sort((a, b) => {
          const ya = toEndYear(a.season);
          const yb = toEndYear(b.season);
          return (ya || 0) - (yb || 0);
        });

        const lastYearEntry = sortedYears[sortedYears.length - 1];
        if (!lastYearEntry) return true; // Should have been caught above, but safe fallback

        // Parse the end year
        const endYear = toEndYear(lastYearEntry.season);
        if (!endYear) return true; // Invalid year data, treat as FA

        // 3. Check if it expires in the current view year OR has an option for the next year
        // (If currentYear is 2026, we want players whose contracts end in 2026)
        // (OR players whose contracts end in 2027 but have an option for that 2027 season)

        // Also include players whose contracts expired BEFORE the current year
        const isExpired = endYear < currentYear;
        const isExpiring = endYear === currentYear;

        // Check for option in the last year entry
        // Some data sources might use 'option' or 'optionType'
        const optionVal = lastYearEntry.option || lastYearEntry.optionType;
        const isPlayerOption =
          optionVal === 'Player Option' ||
          optionVal === 'Player' ||
          optionVal === 'PO';
        const isTeamOption =
          optionVal === 'Team Option' ||
          optionVal === 'Team' ||
          optionVal === 'TO';

        const hasOptionNextYear =
          endYear === currentYear + 1 && (isPlayerOption || isTeamOption);

        if (!isExpired && !isExpiring && !hasOptionNextYear) return false;

        return true;
      })
      .map((p): FreeAgent => {
        // Determine FA Type
        let faType: FreeAgent['freeAgentType'] = 'UFA';
        let previousSalary = 0;
        let birdRights = 'None';

        if (
          p.contract &&
          p.contract.salariesByYear &&
          p.contract.salariesByYear.length > 0
        ) {
          const sortedYears = [...p.contract.salariesByYear].sort((a, b) => {
            const ya = toEndYear(a.season);
            const yb = toEndYear(b.season);
            return (ya || 0) - (yb || 0);
          });
          const lastYearEntry = sortedYears[sortedYears.length - 1];
          previousSalary = lastYearEntry.salary || 0;
          birdRights = p.contract.birdRights?.status || 'None';

          const optionVal = lastYearEntry.option || lastYearEntry.optionType;
          if (
            optionVal === 'Player Option' ||
            optionVal === 'Player' ||
            optionVal === 'PO'
          )
            faType = 'PO';
          else if (
            optionVal === 'Team Option' ||
            optionVal === 'Team' ||
            optionVal === 'TO'
          )
            faType = 'TO';
          else if (p.contract.birdRights?.status === 'Restricted')
            faType = 'RFA';
        }

        // Fix "Player Not Found" names using centralized name resolution
        const fixedName = resolvePlayerDisplayName(p.name, p.id || p.player_id);

        return {
          ...p,
          name: fixedName,
          previousSalary,
          birdRights,
          freeAgentType: faType,
          // Ensure team info is preserved
          teamCode: p.teamCode,
          teamName: p.teamName,
        };
      });

    setFreeAgents(upcomingFreeAgents);
  }, [worldAwarePlayers, currentYear, worldId, worldRosterIndex]);

  // === Higher-level action functions ===
  // These encapsulate proper state transitions and should be used instead of raw setters

  /**
   * Begin a loading operation - sets isLoading=true and clears any existing error
   */
  const startLoad = useCallback(() => {
    setIsLoading(true);
    setError('');
  }, []);

  /**
   * Complete a loading operation - sets isLoading=false and optionally sets an error
   * @param errorMsg - Optional error message; if omitted, error is cleared
   */
  const finishLoad = useCallback((errorMsg?: string) => {
    setIsLoading(false);
    if (errorMsg !== undefined) {
      setError(errorMsg);
    }
  }, []);

  /**
   * Begin a save operation - sets isSaving=true and clears any existing error
   */
  const startSave = useCallback(() => {
    setIsSaving(true);
    setError('');
  }, []);

  /**
   * Complete a save operation - sets isSaving=false and optionally sets an error
   * @param errorMsg - Optional error message; if omitted, error is cleared
   */
  const finishSave = useCallback((errorMsg?: string) => {
    setIsSaving(false);
    if (errorMsg !== undefined) {
      setError(errorMsg);
    }
  }, []);

  /**
   * Set an error message safely
   * @param msg - The error message to display
   */
  const setErrorSafe = useCallback((msg: string) => {
    setError(msg);
  }, []);

  /**
   * Clear any existing error
   */
  const clearError = useCallback(() => {
    setError('');
  }, []);

  const activeWorldOwner = useMemo<ArchitectActiveWorldOwner>(
    () => ({
      worldId,
      identityToken: activeWorldIdentityTokenRef.current,
      setActiveWorld,
    }),
    [setActiveWorld, worldId]
  );

  const worldTimeOwner = useMemo<ArchitectWorldTimeOwner>(
    () => ({
      worldId,
      asOfDate: worldAsOfDate,
      isUpdatingAsOfDate: isUpdatingWorldAsOfDate,
      updateAsOfDate,
      advanceByOneDay,
    }),
    [
      advanceByOneDay,
      isUpdatingWorldAsOfDate,
      updateAsOfDate,
      worldAsOfDate,
      worldId,
    ]
  );

  const worldModeBoundary = useMemo<ArchitectWorldModeBoundary>(() => {
    if (!worldId) {
      return {
        kind: 'sandbox',
        worldId: null,
        onReloadWorldData: null,
      };
    }

    return {
      kind: 'world',
      worldId,
      onReloadWorldData: reloadActiveWorldTeamData,
    };
  }, [reloadActiveWorldTeamData, worldId]);

  return {
    // Values (all state + derived)
    baselineCapSheet,
    teamCapSheet,
    currentYear,
    selectedRulesYear,
    activeTab,
    selectedPlayer,
    freeAgents,
    isLoading,
    isSaving,
    error,
    lastCapSheet,
    offseasonRun,
    offseasonSummary,
    playersMap,
    capTableYears,
    players: worldAwarePlayers,
    worldId,
    worldAsOfDate,
    worldCurrentSeason,
    worldMetadataLoading,
    activeWorldOwner,
    worldTimeOwner,
    worldModeBoundary,

    // Setters (all needed by GMDashboard)
    setBaselineCapSheet,
    setTeamCapSheet,
    setCurrentYear,
    setSelectedRulesYear,
    setActiveTab,
    setSelectedPlayer,
    setFreeAgents,
    setLastCapSheet,
    setOffseasonRun,
    setOffseasonSummary,

    // Higher-level state actions (use these instead of raw setters)
    startLoad,
    finishLoad,
    startSave,
    finishSave,
    setErrorSafe,
    clearError,
    refreshWorldRosterIndex,
    reloadActiveWorldTeamData,
  };
}
