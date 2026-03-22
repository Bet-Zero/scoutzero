/**
 * FILE: src/features/architect/GMDashboard/hooks/useArchitectState.ts
 * PURPOSE: Centralized state management hook for GMDashboard - manages all dashboard state, data loading, and persistence.
 * OWNERSHIP: Feature: architect/GMDashboard
 *
 * HISTORY:
 *  - 2025-12-12: Created - extracted all state from GMDashboard.tsx (Phase 2 refactor)
 *  - 2025-12-12: Converted to TypeScript with proper type annotations
 *  - 2025-12-20: Phase 2B - wired world-aware data loading via loadWorldTeamData
 *
 * LINKS:
 *  - Plan: plans/gmdashboard_state_hook_fea52793.plan.md
 *  - Gap Analysis: docs/ARCHITECT_GAP_ANALYSIS.md
 */
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { loadWorldTeamData } from '@/features/architect/utils/worldTeamData';
import { getWorldMetadata } from '@/features/architect/utils/worldManager';
import { getLeague } from '@/features/architect/utils/teamLoader';
import useArchitectPlayerData from '@/features/architect/hooks/useArchitectPlayerData';
import type {
  CapHoldItem,
  DeadCapItem,
  DraftPick,
  Exceptions,
  PlayerRulesProfileInput,
  PlayerRulesProfileTeamCapSheet,
  TeamTotals,
} from '@/features/architect/types';
import type { OfferSheetLike } from '../offerSheetTypes';
import capProjections from '@/features/architect/utils/capProjections';
import { toEndYear } from '@/features/architect/utils/seasonFormat';
import { resolvePlayerDisplayName } from '@/features/architect/constants/playerNameCorrections';

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

// ==== Type Definitions ====

type CapProjectionRow = (typeof capProjections)[string];
type CapProjectionMap = Record<string, CapProjectionRow | undefined>;

/** Salary entry by year in a contract */
interface SalaryByYear {
  season?: string | number | null;
  salary?: number | null;
  option?: string | null;
  optionType?: string | null;
  capHit?: number | null;
  guaranteed?: boolean | null;
}

/** Player contract structure */
interface ArchitectContract {
  salariesByYear?: SalaryByYear[];
  birdRights?: {
    status?: string;
    yearsOfService?: number;
    yearsWithTeam?: number;
    eligibleFor?: string[];
  };
  // NOTE: catch-all retained — ArchitectContract participates in PlayerLike-compatible
  // intersections; removing it breaks index signature compatibility with ContractLike
  // throughout GMDashboard.tsx and the pipeline cast in useArchitectActions.ts.
  [key: string]: unknown;
}

/** Player data from useArchitectPlayerData */
type ArchitectPlayer = PlayerRulesProfileInput & {
  id?: string | number | null;
  player_id?: string | number | null;
  name?: string | null;
  displayName?: string | null;
  age?: number | null;
  yearsOfService?: number | null;
  yearsPro?: number | null;
  teamCode?: string | null;
  teamName?: string | null;
  contract?: ArchitectContract | null;
  futureContract?: ArchitectContract | null;
};

type WorldRosterPlayerLike = ArchitectPlayer & {
  bio?: ArchitectPlayer['bio'] & {
    playerId?: string | number | null;
  };
};

type WorldLeagueTeamLike = {
  // NOTE: kept as unknown[] — getLeague() returns TeamLike[] with roster: unknown[];
  // narrowing here would conflict with the external return type.
  roster?: unknown[];
  players?: WorldRosterPlayerLike[];
};

export const mergeWorldPlayerOverride = (
  basePlayer: ArchitectPlayer | null,
  overridePlayer: ArchitectPlayer
): ArchitectPlayer => ({
  ...(basePlayer || {}),
  ...overridePlayer,
  contract: overridePlayer.contract
    ? { ...(basePlayer?.contract || {}), ...overridePlayer.contract }
    : basePlayer?.contract,
  bio: overridePlayer.bio
    ? { ...(basePlayer?.bio || {}), ...overridePlayer.bio }
    : basePlayer?.bio,
});

/** Free agent with additional derived fields */
interface FreeAgent extends ArchitectPlayer {
  previousSalary: number;
  birdRights: string;
  freeAgentType: 'UFA' | 'RFA' | 'PO' | 'TO';
}

type OffseasonSummaryTradeException = {
  amount?: number;
  source?: string | null;
  expiresOn?: string | null;
  expiryISO?: string | null;
  expiryDate?: string | null;
  teamCode?: string | null;
};

type OffseasonSummaryWaivedDeadCap = {
  name?: string | null;
  amount?: number;
  year?: string | number | null;
};

type ExercisedOptionSummary = {
  playerId?: string | number | null;
  playerName?: string | null;
  optionType?: string | null;
  salary?: number | null;
};

type StepienUpdateSummary = {
  pickId?: string | null;
  year?: number | null;
  status?: string | null;
  reason?: string | null;
};

export type DashboardOffseasonSummary = {
  declinedOptions?: string[];
  expiredContracts?: string[];
  expiredTPEs?: OffseasonSummaryTradeException[];
  waivedDeadCap?: OffseasonSummaryWaivedDeadCap[];
  resetMLE?: boolean;
  exercisedOptions?: ExercisedOptionSummary[];
  stepienUpdates?: StepienUpdateSummary[];
};

type CapHoldLike = Omit<CapHoldItem, 'playerId'> & {
  playerId?: string | number | null;
  active?: boolean | null;
  reason?: string | null;
};

type DeadCapLike = Partial<DeadCapItem> & {
  id?: string | null;
  playerId?: string | number | null;
  label?: string | null;
  amountByYear?: DeadCapItem['amountByYear'] | null;
  stretched?: boolean | null;
};

type ArchitectExceptionEntryLike = {
  type?: string | null;
  enabled?: boolean;
  available?: boolean;
  totalAmount?: number | null;
  usedAmount?: number | null;
  remainingAmount?: number | null;
  createdFrom?: string | null;
  createdOn?: string | null;
  expiresOn?: string | null;
  notes?: string | null;
  seasonKey?: string | null;
};

type ArchitectExceptionsLike = Exceptions & {
  mle?: ArchitectExceptionEntryLike;
  taxpayerMle?: ArchitectExceptionEntryLike;
  room?: ArchitectExceptionEntryLike;
  bae?: ArchitectExceptionEntryLike;
  dpe?: ArchitectExceptionEntryLike;
  [key: string]: unknown;
};

/** Cap sheet structure */
interface CapSheet extends PlayerRulesProfileTeamCapSheet {
  teamName?: string;
  players?: ArchitectPlayer[];
  deadCap?: DeadCapLike[] | null;
  capHolds?: CapHoldLike[] | null;
  exceptions?: ArchitectExceptionsLike | null;
  draftPicks?: DraftPick[] | null;
  totals?: TeamTotals | null;
  offerSheets?: OfferSheetLike[] | null;
  incomingOfferSheets?: OfferSheetLike[] | null;
  [key: string]: unknown;
}

/** Hook input parameters */
interface UseArchitectStateParams {
  teamId: string;
  userId: string | null;
  authLoading: boolean;
}

/** Active tab in the dashboard */
type ActiveTab =
  | 'roster'
  | 'cap'
  | 'capfull'
  | 'trade'
  | 'fa'
  | 'offseason'
  | 'history';

/** Map of players by various keys for fast lookup */
type PlayersMap = Record<string, ArchitectPlayer>;

/** Return type of the hook */
export interface UseArchitectStateReturn {
  // Values (all state + derived)
  baselineCapSheet: CapSheet | null;
  teamCapSheet: CapSheet | null;
  currentYear: number;
  selectedRulesYear: number;
  activeTab: ActiveTab;
  selectedPlayer: ArchitectPlayer | null;
  freeAgents: FreeAgent[];
  isLoading: boolean;
  isSaving: boolean;
  error: string;
  lastCapSheet: CapSheet | null;
  offseasonRun: boolean;
  offseasonSummary: DashboardOffseasonSummary | null;
  playersMap: PlayersMap;
  capTableYears: number[];
  players: ArchitectPlayer[];
  worldId: string | null;
  worldAsOfDate: string | null;

  // Setters (all needed by GMDashboard)
  setBaselineCapSheet: React.Dispatch<React.SetStateAction<CapSheet | null>>;
  setTeamCapSheet: React.Dispatch<React.SetStateAction<CapSheet | null>>;
  setCurrentYear: React.Dispatch<React.SetStateAction<number>>;
  setSelectedRulesYear: React.Dispatch<React.SetStateAction<number>>;
  setActiveTab: React.Dispatch<React.SetStateAction<ActiveTab>>;
  setSelectedPlayer: React.Dispatch<
    React.SetStateAction<ArchitectPlayer | null>
  >;
  setFreeAgents: React.Dispatch<React.SetStateAction<FreeAgent[]>>;
  setLastCapSheet: React.Dispatch<React.SetStateAction<CapSheet | null>>;
  setOffseasonRun: React.Dispatch<React.SetStateAction<boolean>>;
  setOffseasonSummary: React.Dispatch<
    React.SetStateAction<DashboardOffseasonSummary | null>
  >;
  setWorldId: React.Dispatch<React.SetStateAction<string | null>>;
  setWorldAsOfDate: React.Dispatch<React.SetStateAction<string | null>>;

  // Higher-level state actions (use these instead of raw setters)
  startLoad: () => void;
  finishLoad: (errorMsg?: string) => void;
  startSave: () => void;
  finishSave: (errorMsg?: string) => void;
  setErrorSafe: (msg: string) => void;
  clearError: () => void;
  refreshWorldRosterIndex: () => Promise<Set<string>>;
}

// ==== Season helpers ====
const LOCAL_SEASON_KEY = 'hz.currentSeasonEndYear';

const getDefaultSeasonEndYear = (date: Date = new Date()): number => {
  // NBA season flips July 1 → 2024-25 ends in 2025, 2025-26 ends in 2026
  const y = date.getFullYear();
  const month = date.getMonth();

  // General case for future years
  return month >= 6 ? y + 1 : y;
};

const seasonEndYearsFromCaps = (
  caps: CapProjectionMap | null | undefined
): number[] => {
  const keys = Object.keys(caps || {});
  const years = keys
    .map((k) => {
      if (/^\d{4}-\d{2}$/.test(k)) {
        const tail = parseInt(k.split('-')[1], 10);
        return 2000 + tail; // "2024-25" -> 2025
      }
      const num = parseInt(k, 10);
      return Number.isFinite(num) ? num : null; // allow "2025"
    })
    .filter((y): y is number => y !== null);
  // De-dup and sort
  return Array.from(new Set(years)).sort((a, b) => a - b);
};

/**
 * Find the closest year in availableYears to the target year.
 * Returns the target if availableYears is empty, or the closest match by absolute difference.
 */
const findClosestYear = (target: number, availableYears: number[]): number => {
  if (!availableYears || availableYears.length === 0) return target;
  if (availableYears.includes(target)) return target;

  // Find the year with the smallest absolute difference
  let closest = availableYears[0];
  let minDiff = Math.abs(target - closest);

  for (const year of availableYears) {
    const diff = Math.abs(target - year);
    if (diff < minDiff) {
      minDiff = diff;
      closest = year;
    }
  }
  return closest;
};

const normalizeLookupKey = (name: string | null | undefined): string => {
  if (!name) return '';
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase();
};

/**
 * Centralized state management hook for GMDashboard
 *
 * @param params - Hook parameters containing teamId, userId, and authLoading state
 * @returns All dashboard state values and setters
 */
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
  const dataLoadRequestIdRef = useRef(0);

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

  const refreshWorldRosterIndex = useCallback(async (): Promise<
    Set<string>
  > => {
    if (!worldId) {
      setWorldRosterIndex(null);
      setWorldPlayerOverrides({});
      return new Set<string>();
    }

    setWorldRosterIndex(null);
    setFreeAgents([]);

    try {
      const league = await getLeague(worldId);
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

      setWorldRosterIndex(nextIndex);
      setWorldPlayerOverrides(nextOverrides);
      return nextIndex;
    } catch (error) {
      console.warn('Failed to load world roster index:', error);
      setWorldRosterIndex(null);
      setWorldPlayerOverrides({});
      setFreeAgents([]);
      return new Set<string>();
    }
  }, [worldId]);

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

  // === Effect 3: Fetch team data on mount and when worldId changes ===
  // Uses world-aware loading via loadWorldTeamData (Phase 2B)
  // Fallback chain: world snapshot → parent world → base team
  useEffect(() => {
    let isCancelled = false;

    const fetchData = async () => {
      const requestId = dataLoadRequestIdRef.current + 1;
      dataLoadRequestIdRef.current = requestId;

      setIsLoading(true);
      setError('');
      try {
        // World-aware data loading via teamLoader fallback chain
        // When worldId is null, falls back to base team (same as before)
        const base = await loadWorldTeamData(worldId, teamId);
        await refreshWorldRosterIndex();

        if (isCancelled || dataLoadRequestIdRef.current !== requestId) {
          return;
        }

        if (base) {
          setBaselineCapSheet(base as CapSheet);
          // Always use baseline (or world-aware) data as team cap sheet
          setTeamCapSheet(deepClone(base) as CapSheet);
        } else {
          console.warn('No saved team found, using blank slate.');
        }

        // Phase 21: Load world metadata for timing context
        if (worldId) {
          try {
            const meta = await getWorldMetadata(worldId);

            if (isCancelled || dataLoadRequestIdRef.current !== requestId) {
              return;
            }

            setWorldAsOfDate(meta?.asOfDate || null);
          } catch (e) {
            console.warn('Failed to load world metadata:', e);
          }
        } else {
          setWorldAsOfDate(null);
        }
      } catch (err) {
        if (isCancelled || dataLoadRequestIdRef.current !== requestId) {
          return;
        }

        console.error(err);
        const message =
          err instanceof Error ? err.message : String(err || 'Unknown error');
        setError(`Error loading team data: ${message}`);
      } finally {
        if (!isCancelled && dataLoadRequestIdRef.current === requestId) {
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
  }, [teamId, authLoading, worldId, refreshWorldRosterIndex]);

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
    setWorldId,
    setWorldAsOfDate,

    // Higher-level state actions (use these instead of raw setters)
    startLoad,
    finishLoad,
    startSave,
    finishSave,
    setErrorSafe,
    clearError,
    refreshWorldRosterIndex,
  };
}
