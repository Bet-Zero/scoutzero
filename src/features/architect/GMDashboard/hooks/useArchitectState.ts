/**
 * FILE: src/features/architect/GMDashboard/hooks/useArchitectState.ts
 * PURPOSE: Centralized state management hook for GMDashboard - manages all dashboard state, data loading, and persistence.
 * OWNERSHIP: Feature: architect/GMDashboard
 *
 * HISTORY:
 *  - 2025-12-12: Created - extracted all state from GMDashboard.jsx (Phase 2 refactor)
 *  - 2025-12-12: Converted to TypeScript with proper type annotations
 *
 * LINKS:
 *  - Plan: plans/gmdashboard_state_hook_fea52793.plan.md
 */
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  loadTeamCapSheet,
  saveUserTeamPlan,
  loadUserTeamPlan,
  listUserTeamPlans,
  saveNamedTeamPlan,
  loadNamedTeamPlan,
  loadFreeAgents,
} from '@/features/architect/utils/firebaseTeamPlanHelpers';
import useArchitectPlayerData from '@/features/architect/hooks/useArchitectPlayerData';
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

/** Cap projections object keyed by season string */
type CapProjections = Record<
  string,
  {
    cap: number;
    floor: number;
    tax: number;
    firstApron: number;
    secondApron: number;
    bae: number;
    roomMLE: number;
    fullMLE: number;
    taxpayerMLE: number;
    growthRate: number;
    confirmed?: boolean;
  }
>;

/** Salary entry by year in a contract */
interface SalaryByYear {
  season: string;
  salary?: number;
  option?: string;
  optionType?: string;
}

/** Player contract structure */
interface PlayerContract {
  salariesByYear?: SalaryByYear[];
  birdRights?: {
    status?: string;
    yearsOfService?: number;
    yearsWithTeam?: number;
    eligibleFor?: string[];
  };
  [key: string]: unknown;
}

/** Player data from useArchitectPlayerData */
interface ArchitectPlayer {
  id?: string;
  player_id?: string;
  name?: string;
  displayName?: string;
  position?: string;
  age?: number | null;
  teamCode?: string;
  teamName?: string;
  contract?: PlayerContract | null;
  futureContract?: PlayerContract | null;
  bio?: {
    playerId?: string;
    displayName?: string;
    position?: string;
    age?: number;
    [key: string]: unknown;
  };
  representation?: unknown;
  [key: string]: unknown;
}

/** Free agent with additional derived fields */
interface FreeAgent extends ArchitectPlayer {
  previousSalary: number;
  birdRights: string;
  freeAgentType: 'UFA' | 'RFA' | 'PO' | 'TO';
}

/** Player entry in a cap sheet */
interface CapSheetPlayer {
  id?: string;
  player_id?: string;
  name?: string;
  displayName?: string;
  contract?: PlayerContract | null;
  [key: string]: unknown;
}

/** Cap sheet structure */
interface CapSheet {
  teamCode?: string;
  teamName?: string;
  players?: CapSheetPlayer[];
  deadCap?: unknown[];
  capHolds?: unknown[];
  exceptions?: unknown;
  draftPicks?: unknown[];
  totals?: unknown;
  [key: string]: unknown;
}

/** Plan reference from Firestore */
interface PlanRef {
  id: string;
  name?: string;
  [key: string]: unknown;
}

/** Hook input parameters */
interface UseArchitectStateParams {
  teamId: string;
  userId: string | null;
  authLoading: boolean;
}

/** View mode for the dashboard */
type ViewMode = 'plan' | 'baseline';

/** Active tab in the dashboard */
type ActiveTab =
  | 'roster'
  | 'capTable'
  | 'trade'
  | 'freeAgency'
  | 'offseason'
  | 'history';

/** Action context for contract modal */
type ActionContext = 'option' | 'freeAgent' | null;

/** Map of players by various keys for fast lookup */
type PlayersMap = Record<string, ArchitectPlayer>;

/** Return type of the hook */
interface UseArchitectStateReturn {
  // Values (all state + derived)
  baselineCapSheet: CapSheet | null;
  teamCapSheet: CapSheet | null;
  currentYear: number;
  selectedRulesYear: number;
  activeTab: ActiveTab;
  viewMode: ViewMode;
  selectedPlayer: ArchitectPlayer | null;
  selectedPlan: string;
  freeAgents: FreeAgent[];
  plans: PlanRef[];
  isLoading: boolean;
  isSaving: boolean;
  error: string;
  showModal: boolean;
  showSaveModal: boolean;
  showContractModal: boolean;
  newPlanName: string;
  initialAction: string | null;
  targetYear: number | null;
  actionContext: ActionContext;
  lastCapSheet: CapSheet | null;
  offseasonRun: boolean;
  offseasonSummary: unknown | null;
  playersMap: PlayersMap;
  capTableYears: number[];
  players: ArchitectPlayer[];

  // Setters (all needed by GMDashboard)
  setBaselineCapSheet: React.Dispatch<React.SetStateAction<CapSheet | null>>;
  setTeamCapSheet: React.Dispatch<React.SetStateAction<CapSheet | null>>;
  setCurrentYear: React.Dispatch<React.SetStateAction<number>>;
  setSelectedRulesYear: React.Dispatch<React.SetStateAction<number>>;
  setActiveTab: React.Dispatch<React.SetStateAction<ActiveTab>>;
  setViewMode: React.Dispatch<React.SetStateAction<ViewMode>>;
  setSelectedPlayer: React.Dispatch<
    React.SetStateAction<ArchitectPlayer | null>
  >;
  setSelectedPlan: React.Dispatch<React.SetStateAction<string>>;
  setFreeAgents: React.Dispatch<React.SetStateAction<FreeAgent[]>>;
  setPlans: React.Dispatch<React.SetStateAction<PlanRef[]>>;
  setShowModal: React.Dispatch<React.SetStateAction<boolean>>;
  setShowSaveModal: React.Dispatch<React.SetStateAction<boolean>>;
  setShowContractModal: React.Dispatch<React.SetStateAction<boolean>>;
  setNewPlanName: React.Dispatch<React.SetStateAction<string>>;
  setInitialAction: React.Dispatch<React.SetStateAction<string | null>>;
  setTargetYear: React.Dispatch<React.SetStateAction<number | null>>;
  setActionContext: React.Dispatch<React.SetStateAction<ActionContext>>;
  setLastCapSheet: React.Dispatch<React.SetStateAction<CapSheet | null>>;
  setOffseasonRun: React.Dispatch<React.SetStateAction<boolean>>;
  setOffseasonSummary: React.Dispatch<React.SetStateAction<unknown | null>>;

  // Higher-level state actions (use these instead of raw setters)
  startLoad: () => void;
  finishLoad: (errorMsg?: string) => void;
  startSave: () => void;
  finishSave: (errorMsg?: string) => void;
  setErrorSafe: (msg: string) => void;
  clearError: () => void;
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
  caps: CapProjections | null | undefined
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
  const [plans, setPlans] = useState<PlanRef[]>([]);

  // === Selection state ===
  const [currentYear, setCurrentYear] = useState<number>(() => {
    // Get available years from cap projections
    const availableYears = seasonEndYearsFromCaps(
      capProjections as CapProjections
    );

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
  const [selectedPlan, setSelectedPlan] = useState<string>('');
  const [activeTab, setActiveTab] = useState<ActiveTab>('roster');
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const stored = localStorage.getItem('architect.viewMode');
    // Only accept valid ViewMode values; fall back to 'baseline' for invalid/missing
    return stored === 'plan' || stored === 'baseline' ? stored : 'baseline';
  });

  // === UI state ===
  const [showModal, setShowModal] = useState<boolean>(false);
  const [showSaveModal, setShowSaveModal] = useState<boolean>(false);
  const [showContractModal, setShowContractModal] = useState<boolean>(false);
  const [newPlanName, setNewPlanName] = useState<string>('');

  // === Modal context ===
  const [initialAction, setInitialAction] = useState<string | null>(null);
  const [targetYear, setTargetYear] = useState<number | null>(null);
  const [actionContext, setActionContext] = useState<ActionContext>(null);

  // === Offseason state ===
  const [lastCapSheet, setLastCapSheet] = useState<CapSheet | null>(null);
  const [offseasonRun, setOffseasonRun] = useState<boolean>(false);
  const [offseasonSummary, setOffseasonSummary] = useState<unknown | null>(
    null
  );

  // === Loading/error state ===
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  // === Ref to prevent Effect 8 from racing with Effect 5 during initial load ===
  const initialLoadCompleteRef = useRef<boolean>(false);

  // === Internal hook call ===
  const { players } = useArchitectPlayerData() as {
    players: ArchitectPlayer[];
  };

  // === Memoized derivations ===
  const playersMap = useMemo<PlayersMap>(() => {
    const map: PlayersMap = {};
    players.forEach((p) => {
      if (p.name) {
        map[p.name] = p;
        map[normalizeLookupKey(p.name)] = p;
      }
      if (p.id) map[p.id] = p;
      if (p.player_id) map[p.player_id] = p;
      if (p.bio?.playerId) map[p.bio.playerId] = p;
    });
    return map;
  }, [players]);

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

  // === Effect 2: Persist viewMode to localStorage ===
  useEffect(() => {
    localStorage.setItem('architect.viewMode', viewMode);
  }, [viewMode]);

  // === Effect 3: Force baseline mode when userId is missing ===
  useEffect(() => {
    if (!authLoading && !userId && viewMode === 'plan') {
      setViewMode('baseline');
    }
  }, [userId, authLoading, viewMode]);

  // === Effect 4: Sync selectedRulesYear with currentYear ===
  useEffect(() => {
    setSelectedRulesYear(currentYear);
  }, [currentYear]);

  // === Effect 5: Fetch team data on mount ===
  useEffect(() => {
    // Reset the initial load flag when teamId/userId changes so Effect 8 waits again
    initialLoadCompleteRef.current = false;

    const fetchData = async () => {
      setIsLoading(true);
      setError('');
      try {
        const base = await loadTeamCapSheet(teamId);

        // Only load user plans if userId is available
        let planLoaded = false;
        if (userId) {
          const planList = await listUserTeamPlans(userId, teamId);
          setPlans(planList as PlanRef[]);
          const first = (planList as PlanRef[])[0]?.id || '';
          let plan: CapSheet | null = null;
          if (first) {
            const data = await loadNamedTeamPlan(userId, teamId, first);
            plan =
              (data as { capSheet?: CapSheet })?.capSheet || (data as CapSheet);
            setSelectedPlan(first);
          } else {
            plan = (await loadUserTeamPlan(userId, teamId)) as CapSheet | null;
          }
          if (plan) {
            setTeamCapSheet(plan);
            planLoaded = true;
          }
        }

        await loadFreeAgents();
        if (base) setBaselineCapSheet(base as CapSheet);
        if (!userId || !planLoaded) {
          // If no userId or no plan loaded, use baseline
          if (base) setTeamCapSheet(JSON.parse(JSON.stringify(base)));
          else console.warn('No saved team found, using blank slate.');
        }
      } catch (err) {
        console.error(err);
        setError('Error loading team data');
      } finally {
        setIsLoading(false);
        // Mark initial load as complete so Effect 8 can run on subsequent changes
        initialLoadCompleteRef.current = true;
      }
    };

    // Wait for auth to finish loading before fetching data
    if (!authLoading) {
      fetchData();
    }
  }, [teamId, userId, authLoading]);

  // === Effect 6: Auto-save plan when teamCapSheet changes ===
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!teamCapSheet) return;
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    const savePlan = async () => {
      try {
        if (viewMode === 'plan') {
          if (selectedPlan) {
            await saveNamedTeamPlan(
              userId as string,
              teamId,
              selectedPlan,
              teamCapSheet,
              capProjections,
              currentYear
            );
          } else {
            await saveUserTeamPlan(
              userId as string,
              teamId,
              teamCapSheet,
              capProjections,
              currentYear
            );
          }
        }
      } catch (err) {
        console.error('Failed to save plan', err);
      }
    };
    saveTimeoutRef.current = setTimeout(savePlan, 1000); // Debounce 1 second
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [
    teamCapSheet,
    teamId,
    userId,
    selectedPlan,
    viewMode,
    currentYear,
    // capProjections is a constant import, not a dependency
  ]);

  // === Effect 7: Derive free agents dynamically from the player pool ===
  useEffect(() => {
    if (!players || players.length === 0) return;

    const upcomingFreeAgents = players
      .filter((p) => {
        // 0. Filter out invalid players (only if no ID is present)
        if ((!p.name || p.name === 'Unknown') && !p.id && !p.player_id)
          return false;

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
  }, [players, currentYear]);

  // === Effect 8: Load plan based on viewMode/selectedPlan changes ===
  // This effect is guarded by initialLoadCompleteRef to prevent racing with Effect 5.
  // Effect 5 handles the initial auth/baseline load; this effect only handles
  // subsequent changes to viewMode or selectedPlan after the initial load completes.
  useEffect(() => {
    // Skip during initial load - Effect 5 handles setting teamCapSheet initially
    if (!initialLoadCompleteRef.current) {
      return;
    }

    const loadPlan = async () => {
      setIsLoading(true);
      setError('');
      try {
        if (viewMode === 'baseline') {
          if (baselineCapSheet) setTeamCapSheet(deepClone(baselineCapSheet));
          return;
        }
        // Only load named plans if userId is available
        if (userId && selectedPlan) {
          const data = await loadNamedTeamPlan(userId, teamId, selectedPlan);
          if ((data as { capSheet?: CapSheet })?.capSheet) {
            setTeamCapSheet((data as { capSheet: CapSheet }).capSheet);
          }
        } else if (baselineCapSheet) {
          setTeamCapSheet(deepClone(baselineCapSheet));
        }
      } catch (err) {
        console.error(err);
        setError('Error loading plan');
      } finally {
        setIsLoading(false);
      }
    };
    // Wait for auth to finish loading before loading plan
    if (!authLoading) {
      loadPlan();
    }
  }, [viewMode, selectedPlan, baselineCapSheet, teamId, userId, authLoading]);

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
    viewMode,
    selectedPlayer,
    selectedPlan,
    freeAgents,
    plans,
    isLoading,
    isSaving,
    error,
    showModal,
    showSaveModal,
    showContractModal,
    newPlanName,
    initialAction,
    targetYear,
    actionContext,
    lastCapSheet,
    offseasonRun,
    offseasonSummary,
    playersMap,
    capTableYears,
    players,

    // Setters (all needed by GMDashboard)
    setBaselineCapSheet,
    setTeamCapSheet,
    setCurrentYear,
    setSelectedRulesYear,
    setActiveTab,
    setViewMode,
    setSelectedPlayer,
    setSelectedPlan,
    setFreeAgents,
    setPlans,
    setShowModal,
    setShowSaveModal,
    setShowContractModal,
    setNewPlanName,
    setInitialAction,
    setTargetYear,
    setActionContext,
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
  };
}
