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
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useArchitectPlayerData } from '@/features/architect/hooks/useArchitectPlayerData';
import { capProjections } from '@/features/architect/utils/capProjections';
import { useWorldLoadTracker } from './useArchitectState.worldTracker';
import { useWorldLoader } from './useArchitectState.worldLoader';
import { computeFreeAgents } from './useArchitectState.freeAgents';

// Wave 11 Step 2: type definitions extracted to submodule
export * from './useArchitectState.types';
import type {
  ActiveTab,
  ArchitectActiveWorldOwner,
  ArchitectDashboardCapSheet,
  ArchitectDashboardPlayer,
  ArchitectPlayer,
  ArchitectWorldModeBoundary,
  ArchitectWorldTimeOwner,
  CapProjectionMap,
  CapSheet,
  DashboardOffseasonSummary,
  FreeAgent,
  PlayersMap,
  UseArchitectStateParams,
  UseArchitectStateReturn,
} from './useArchitectState.types';
import { mergeWorldPlayerOverride } from './useArchitectState.types';

// Wave 11 Step 3: season helpers extracted to submodule
export * from './useArchitectState.helpers';
import {
  LOCAL_SEASON_KEY,
  findClosestYear,
  getDefaultSeasonEndYear,
  normalizeLookupKey,
  readPersistedActiveWorldId,
  resolveUsableActiveWorldId,
  seasonEndYearsFromCaps,
  writePersistedActiveWorldId,
} from './useArchitectState.helpers';
import { readRoomFromUrl } from './useArchitectDeskNavigation';
import { resolveWorldLineageIds } from '@/features/architect/utils/worldManager';

function deepClone<T>(obj: T): T {
  if (typeof structuredClone === 'function') {
    return structuredClone(obj);
  }
  return JSON.parse(JSON.stringify(obj));
}

export function useArchitectState({
  teamId,
  userId,
  authLoading,
}: UseArchitectStateParams): UseArchitectStateReturn {
  // === Core data state ===
  const [baselineCapSheet, setBaselineCapSheet] = useState<CapSheet | null>(null);
  const [teamCapSheet, setTeamCapSheet] = useState<CapSheet | null>(null);
  const [freeAgents, setFreeAgents] = useState<FreeAgent[]>([]);

  // === World state ===
  const [worldId, setWorldId] = useState<string | null>(null);
  const [worldLineage, setWorldLineage] = useState<readonly string[]>([]);
  const [activeWorldLabel, setActiveWorldLabel] = useState<string | null>(null);
  const [worldAsOfDate, setWorldAsOfDate] = useState<string | null>(null);
  const [worldCurrentSeason, setWorldCurrentSeason] = useState<string | null>(null);
  const [rightsLedgerWorldVersion, setRightsLedgerWorldVersion] = useState<
    number | null
  >(null);
  const [worldMetadataLoading, setWorldMetadataLoading] = useState<boolean>(false);
  const [hasRestoredActiveWorld, setHasRestoredActiveWorld] = useState<boolean>(false);
  const [isUpdatingWorldAsOfDate, setIsUpdatingWorldAsOfDate] = useState<boolean>(false);
  const [worldRosterIndex, setWorldRosterIndex] = useState<Set<string> | null>(null);
  const [worldPlayerOverrides, setWorldPlayerOverrides] = useState<Record<string, ArchitectPlayer>>({});

  useEffect(() => {
    let active = true;
    setWorldLineage([]);
    if (!worldId) return () => {
      active = false;
    };
    void resolveWorldLineageIds(worldId)
      .then((lineage) => {
        if (active && lineage[0] === worldId) {
          setWorldLineage(Object.freeze([...lineage]));
        }
      })
      .catch(() => {
        if (active) setWorldLineage([]);
      });
    return () => {
      active = false;
    };
  }, [worldId]);

  // === Selection state ===
  const [currentYear, setCurrentYear] = useState<number>(() => {
    const availableYears = seasonEndYearsFromCaps(capProjections);

    const qp = new URLSearchParams(window.location.search).get('season');
    if (qp && Number.isFinite(parseInt(qp, 10))) {
      const year = parseInt(qp, 10);
      if (availableYears.includes(year)) return year;
    }

    const saved = localStorage.getItem(LOCAL_SEASON_KEY);
    if (saved && Number.isFinite(parseInt(saved, 10))) {
      const year = parseInt(saved, 10);
      if (availableYears.includes(year)) return year;
    }

    const defaultYear = getDefaultSeasonEndYear();
    return findClosestYear(defaultYear, availableYears);
  });

  const [selectedRulesYear, setSelectedRulesYear] = useState<number>(currentYear);
  const [selectedPlayer, setSelectedPlayer] = useState<ArchitectPlayer | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>(
    // Full Cap Table is the home base / default landing surface. A URL ?room=
    // slug still wins (deep links, League handoff to ?room=roster are unaffected).
    () => readRoomFromUrl() ?? 'capfull'
  );

  // === Offseason state ===
  const [lastCapSheet, setLastCapSheet] = useState<CapSheet | null>(null);
  const [offseasonRun, setOffseasonRun] = useState<boolean>(false);
  const [offseasonSummary, setOffseasonSummary] = useState<DashboardOffseasonSummary | null>(null);

  // === Loading/error state ===
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [lastSaveError, setLastSaveError] = useState<string | null>(null);

  // === Internal hook calls ===
  const { players } = useArchitectPlayerData() as { players: ArchitectPlayer[] };

  const {
    activeWorldIdentityTokenRef,
    startWorldLoadRequest,
    isFreshWorldLoadRequest,
    resolveWorldLoadStaleDrop,
    invalidateActiveWorldAsyncWork,
    isCurrentActiveWorldIdentity,
    startWorldAsOfDateMutationRequest,
    isCurrentWorldAsOfDateMutationRequest,
  } = useWorldLoadTracker();

  const {
    applyWorldMetadata,
    applyWorldMetadataPatch,
    applyWorldRosterBundle,
    resetActiveWorldDerivedState,
    clearActiveWorldState,
    setActiveWorld,
    updateAsOfDate,
    advanceByOneDay,
    prepareCoordinatedWorldLoad,
    loadCoordinatedWorldBundle,
    applyCoordinatedWorldBundle,
    refreshWorldRosterIndex,
    reloadActiveWorldTeamData,
  } = useWorldLoader({
    worldId,
    worldAsOfDate,
    teamId,
    setWorldId,
    setBaselineCapSheet,
    setTeamCapSheet,
    setActiveWorldLabel,
    setWorldAsOfDate,
    setWorldCurrentSeason,
    setRightsLedgerWorldVersion,
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
  });

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
  const restoredActiveWorldUserIdRef = useRef<string | null>(null);
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
      const validatedWorldId = await resolveUsableActiveWorldId(worldId, userId);
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
  useEffect(() => {
    let isCancelled = false;

    const fetchData = async () => {
      const requestWorldId = worldId;
      const worldLoadRequest = startWorldLoadRequest(requestWorldId);

      setIsLoading(true);
      setError('');
      setLastSavedAt(null);
      setLastSaveError(null);
      prepareCoordinatedWorldLoad(worldId);
      try {
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

    if (authLoading) {
      return () => {
        isCancelled = true;
      };
    }

    if (!userId) {
      setIsLoading(false);
      setError('Sign in to load Architect data.');
      return () => {
        isCancelled = true;
      };
    }

    if (!hasRestoredActiveWorld) {
      setIsLoading(true);
      return () => {
        isCancelled = true;
      };
    }

    fetchData();

    return () => {
      isCancelled = true;
    };
  }, [
    applyCoordinatedWorldBundle,
    authLoading,
    hasRestoredActiveWorld,
    isFreshWorldLoadRequest,
    loadCoordinatedWorldBundle,
    prepareCoordinatedWorldLoad,
    startWorldLoadRequest,
    userId,
    worldId,
  ]);

  // === Effect 7: Derive free agents from the player pool ===
  useEffect(() => {
    if (!worldAwarePlayers || worldAwarePlayers.length === 0) return;
    if (worldId && worldRosterIndex === null) return;
    setFreeAgents(computeFreeAgents(worldAwarePlayers, currentYear, worldId, worldRosterIndex));
  }, [worldAwarePlayers, currentYear, worldId, worldRosterIndex]);

  // === Higher-level action functions ===
  const startLoad = useCallback(() => {
    setIsLoading(true);
    setError('');
  }, []);

  const finishLoad = useCallback((errorMsg?: string) => {
    setIsLoading(false);
    if (errorMsg !== undefined) {
      setError(errorMsg);
    }
  }, []);

  const startSave = useCallback(() => {
    setIsSaving(true);
    setError('');
    setLastSaveError(null);
  }, []);

  const finishSave = useCallback((errorMsg?: string) => {
    setIsSaving(false);
    if (errorMsg !== undefined) {
      setError(errorMsg);
      setLastSaveError(errorMsg || 'Save failed');
      return;
    }

    setLastSavedAt(new Date().toISOString());
    setLastSaveError(null);
  }, []);

  const setErrorSafe = useCallback((msg: string) => {
    setError(msg);
  }, []);

  const clearError = useCallback(() => {
    setError('');
    setLastSaveError(null);
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
    [advanceByOneDay, isUpdatingWorldAsOfDate, updateAsOfDate, worldAsOfDate, worldId]
  );

  const worldModeBoundary = useMemo<ArchitectWorldModeBoundary>(() => {
    if (!worldId) {
      return { kind: 'sandbox', worldId: null, onReloadWorldData: null };
    }
    return { kind: 'world', worldId, onReloadWorldData: reloadActiveWorldTeamData };
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
    lastSavedAt,
    lastSaveError,
    lastCapSheet,
    offseasonRun,
    offseasonSummary,
    playersMap,
    capTableYears,
    players: worldAwarePlayers,
    worldId,
    worldLineage,
    activeWorldLabel,
    worldAsOfDate,
    worldCurrentSeason,
    rightsLedgerWorldVersion,
    worldMetadataLoading,
    activeWorldOwner,
    worldTimeOwner,
    worldModeBoundary,

    // Setters
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

    // Higher-level state actions
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
