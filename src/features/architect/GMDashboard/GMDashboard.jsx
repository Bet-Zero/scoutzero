/**
 * FILE: src/features/architect/GMDashboard/GMDashboard.jsx
 * PURPOSE: Primary Architect dashboard for managing cap sheets, contracts, trades, and free agency flows.
 * OWNERSHIP: Feature: architect/core dashboard
 *
 * HISTORY:
 *  - 2025-12-10: Updated to surface player rules profile integration (chunk_01).
 *  - 2025-12-10: Wired multi-year rules context into cap table + contract modal flows (chunk_02).
 *  - 2025-01-XX: Refactored to extract tab sections into separate components.
 *  - 2025-12-12: Refactored to use authenticated userId instead of hardcoded demoUser
 *
 * LINKS:
 *  - Plan: plans/gm-dashboard-userid/plan.md
 *  - Latest Chunk: plans/gm-dashboard-userid/chunks/chunk_01.md
 */
import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import {
  loadTeamCapSheet,
  saveUserTeamPlan,
  loadUserTeamPlan,
  listUserTeamPlans,
  saveNamedTeamPlan,
  loadNamedTeamPlan,
  saveFreeAgents,
  loadFreeAgents,
} from '@/features/architect/utils/firebaseTeamPlanHelpers';
import EditContractModal from '@/shared/components/EditContractModal';
import SavePlanModal from '@/features/architect/SavePlanModal';
import RosterSection from './sections/RosterSection';
import CapSheetSection from './sections/CapSheetSection';
import CapTableSection from './sections/CapTableSection';
import TradeSection from './sections/TradeSection';
import FreeAgencySection from './sections/FreeAgencySection';
import OffseasonSection from './sections/OffseasonSection';
import HistorySection from './sections/HistorySection';
import useArchitectPlayerData from '@/features/architect/hooks/useArchitectPlayerData';
import { useCapSheetState } from '@/features/architect/hooks/useCapSheetState';
import { usePlayerRulesProfiles } from '@/features/architect/hooks/usePlayerRulesProfiles';
import useAuth from '@/shared/hooks/useAuth';
import { enrichPlayerData } from '@/features/roster/utils';
import { basePlayerRef } from '@/data/firestorePaths';
import { getDoc } from 'firebase/firestore';
import { getPlayerPositionLabel } from '@/shared/utils/roles';
import capProjections from '@/features/architect/utils/capProjections';
import { toEndYear } from '@/features/architect/utils/seasonFormat';

// ==== Season helpers (inline for now; you can extract later) ====
const LOCAL_SEASON_KEY = 'hz.currentSeasonEndYear';

const getDefaultSeasonEndYear = (date = new Date()) => {
  // NBA season flips July 1 → 2024-25 ends in 2025, 2025-26 ends in 2026
  const y = date.getFullYear();
  const month = date.getMonth();

  // General case for future years
  return month >= 6 ? y + 1 : y;
};

const toSeasonKey = (endYear) => `${endYear - 1}-${String(endYear).slice(-2)}`;

const seasonEndYearsFromCaps = (caps) => {
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
    .filter(Boolean);
  // De-dup and sort
  return Array.from(new Set(years)).sort((a, b) => a - b);
};

const normalizeSalaryValue = (val) => {
  let num =
    typeof val === 'string' ? Number(val.replace(/[^0-9.-]/g, '')) : val || 0;
  if (Number.isNaN(num)) num = 0;
  // If the value looks like it's in millions (e.g. 3.1), convert to full dollars
  if (num > 0 && num < 1000) num *= 1_000_000;
  return Math.round(num);
};

// Helper to ensure contract has proper structure
const ensureContractStructure = (contract, overrides = {}) => {
  if (!contract) return null;

  // If contract already has salariesByYear array, use it directly
  if (contract.salariesByYear && Array.isArray(contract.salariesByYear)) {
    return {
      ...contract,
      ...overrides,
    };
  }

  // If no contract data, return null
  return null;
};

const normalizeLookupKey = (name) => {
  if (!name) return '';
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase();
};

const GMDashboard = () => {
  const { teamId } = useParams();
  const { userId, loading: authLoading } = useAuth();
  const [baselineCapSheet, setBaselineCapSheet] = useState(null);
  const [teamCapSheet, setTeamCapSheet] = useState(null);
  // AFTER:
  const [currentYear, setCurrentYear] = useState(() => {
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

    // Default to current season
    return getDefaultSeasonEndYear();
  });

  // Persist selection + keep URL shareable (?season=YYYY)
  useEffect(() => {
    localStorage.setItem(LOCAL_SEASON_KEY, String(currentYear));
    const url = new URL(window.location.href);
    url.searchParams.set('season', String(currentYear));
    window.history.replaceState({}, '', url);
  }, [currentYear]);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [freeAgents, setFreeAgents] = useState([]);
  const [activeTab, setActiveTab] = useState('roster');
  const [lastCapSheet, setLastCapSheet] = useState(null);
  const [offseasonRun, setOffseasonRun] = useState(false);
  const [offseasonSummary, setOffseasonSummary] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [plans, setPlans] = useState([]);
  const [selectedRulesYear, setSelectedRulesYear] = useState(currentYear);
  const [selectedPlan, setSelectedPlan] = useState('');
  const [viewMode, setViewMode] = useState(
    () => localStorage.getItem('architect.viewMode') || 'baseline'
  ); // 'plan' or 'baseline'

  // Persist viewMode to localStorage
  useEffect(() => {
    localStorage.setItem('architect.viewMode', viewMode);
  }, [viewMode]);

  // Force baseline mode when userId is missing (fallback behavior)
  useEffect(() => {
    if (!authLoading && !userId && viewMode === 'plan') {
      setViewMode('baseline');
    }
  }, [userId, authLoading, viewMode]);
  const capTableYears = useMemo(
    () => Array.from({ length: 7 }, (_, i) => currentYear + i),
    [currentYear]
  );
  useEffect(() => {
    setSelectedRulesYear(currentYear);
  }, [currentYear]);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [newPlanName, setNewPlanName] = useState('');
  const [showContractModal, setShowContractModal] = useState(false);
  const [initialAction, setInitialAction] = useState(null); // Pre-select action in modal
  const [targetYear, setTargetYear] = useState(null); // Year the action applies to (for options/FA)
  const [actionContext, setActionContext] = useState(null); // 'option' | 'freeAgent' | null - what was clicked
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const { players } = useArchitectPlayerData();

  const playersMap = useMemo(() => {
    const map = {};
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

  // === Cap Sheet State Management Hook ===
  // Provides undo capability and action history tracking
  const capSheetState = useCapSheetState({
    initialCapSheet: teamCapSheet,
    currentYear,
  });

  const simulatedRulesDate = useMemo(
    () => new Date(currentYear - 1, 6, 15),
    [currentYear]
  );

  const {
    leagueContext: rulesLeagueContext,
    leagueContextByYear,
    getProfile: getRulesProfile,
    getProfileForYear,
  } = usePlayerRulesProfiles({
    players: capSheetState.modifiedCapSheet?.players || [],
    teamCapSheet: capSheetState.modifiedCapSheet,
    currentYear,
    teamCode: teamId,
    simulationDate: simulatedRulesDate,
    evaluationYears: capTableYears,
  });

  const selectedPlayerRulesProfile = selectedPlayer
    ? getRulesProfile(selectedPlayer, selectedRulesYear)
    : null;
  const selectedRulesLeagueContext =
    (selectedRulesYear && leagueContextByYear?.get(selectedRulesYear)) ||
    rulesLeagueContext;

  // Sync hook state when teamCapSheet changes (e.g., from loading plans)
  useEffect(() => {
    if (teamCapSheet) {
      capSheetState.refreshFromSource(teamCapSheet);
    }
  }, [teamCapSheet]);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setError('');
      try {
        const base = await loadTeamCapSheet(teamId);

        // Only load user plans if userId is available
        if (userId) {
          const planList = await listUserTeamPlans(userId, teamId);
          setPlans(planList);
          const first = planList[0]?.id || '';
          let plan = null;
          if (first) {
            const data = await loadNamedTeamPlan(userId, teamId, first);
            plan = data?.capSheet || data;
            setSelectedPlan(first);
          } else {
            plan = await loadUserTeamPlan(userId, teamId);
          }
          if (plan) setTeamCapSheet(plan);
        }

        const loadedFA = await loadFreeAgents();
        if (base) setBaselineCapSheet(base);
        if (!userId || !teamCapSheet) {
          // If no userId or no plan loaded, use baseline
          if (base) setTeamCapSheet(JSON.parse(JSON.stringify(base)));
          else console.warn('No saved team found, using blank slate.');
        }
      } catch (err) {
        console.error(err);
        setError('Error loading team data');
      } finally {
        setIsLoading(false);
      }
    };

    // Wait for auth to finish loading before fetching data
    if (!authLoading) {
      fetchData();
    }
  }, [teamId, userId, authLoading]);

  useEffect(() => {
    if (!teamCapSheet) return;
    const savePlan = async () => {
      try {
        if (viewMode === 'plan') {
          if (selectedPlan) {
            await saveNamedTeamPlan(
              userId,
              teamId,
              selectedPlan,
              teamCapSheet,
              capProjections,
              currentYear
            );
          } else {
            await saveUserTeamPlan(
              userId,
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
    savePlan();
  }, [
    teamCapSheet,
    teamId,
    userId,
    selectedPlan,
    viewMode,
    capProjections,
    currentYear,
  ]);

  // Derive free agents dynamically from the player pool
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
      .map((p) => {
        // Determine FA Type
        let faType = 'UFA';
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

        // Fix "Player Not Found" names
        let fixedName = p.name;
        if (
          (!fixedName ||
            fixedName === 'Player Not Found' ||
            fixedName === 'Unknown') &&
          (p.id || p.player_id)
        ) {
          const id = p.id || p.player_id;

          // Known hyphenated names map
          const hyphenatedNames = {
            dorian_finney_smith: 'Dorian Finney-Smith',
            shai_gilgeous_alexander: 'Shai Gilgeous-Alexander',
            kentavious_caldwell_pope: 'Kentavious Caldwell-Pope',
            talen_horton_tucker: 'Talen Horton-Tucker',
            keita_bates_diop: 'Keita Bates-Diop',
            nickeil_alexander_walker: 'Nickeil Alexander-Walker',
            michael_carter_williams: 'Michael Carter-Williams',
            karl_anthony_towns: 'Karl-Anthony Towns',
            willie_cauley_stein: 'Willie Cauley-Stein',
            rondae_hollis_jefferson: 'Rondae Hollis-Jefferson',
          };

          if (hyphenatedNames[id]) {
            fixedName = hyphenatedNames[id];
          } else {
            // Convert snake_case to Title Case (e.g. dorian_finney_smith -> Dorian Finney Smith)
            fixedName = id
              .split('_')
              .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
              .join(' ');
          }
        }

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

  useEffect(() => {
    const loadPlan = async () => {
      setIsLoading(true);
      setError('');
      try {
        if (viewMode === 'baseline') {
          if (baselineCapSheet)
            setTeamCapSheet(JSON.parse(JSON.stringify(baselineCapSheet)));
          return;
        }
        // Only load named plans if userId is available
        if (userId && selectedPlan) {
          const data = await loadNamedTeamPlan(userId, teamId, selectedPlan);
          if (data?.capSheet) setTeamCapSheet(data.capSheet);
        } else if (baselineCapSheet) {
          setTeamCapSheet(JSON.parse(JSON.stringify(baselineCapSheet)));
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

  const applyTradeToCapSheet = async (tradeData) => {
    if (!tradeData || !Array.isArray(tradeData)) return;

    const updated = {
      ...teamCapSheet,
      activeContracts: teamCapSheet.activeContracts || [],
      players: teamCapSheet.players || [],
    };

    const targetTrade = tradeData.find((t) => t.teamId === teamId);
    if (!targetTrade) return;

    const incoming = targetTrade.incoming || [];
    const outgoing = targetTrade.outgoing || [];

    const normalize = (str = '') => str.toLowerCase().replace(/[^a-z0-9]/g, '');
    const isSamePlayer = (a, b) => {
      const aId = a.player_id || a.id;
      const bId = b.id || b.player_id;
      if (aId && bId) return aId === bId;
      return normalize(a.name) === normalize(b.name);
    };

    // Remove outgoing players from main roster
    updated.players = updated.players.filter((player) => {
      const traded = outgoing.some((out) => isSamePlayer(player, out));
      if (traded) {
        console.log(`🗑️ Removing ${player.name} from roster (traded away)`);
      }
      return !traded;
    });

    // Filter out players you just traded away from active contracts
    updated.activeContracts = (updated.activeContracts || []).filter(
      (contract) => {
        const traded = outgoing.some((out) => isSamePlayer(contract, out));
        if (traded) {
          console.log(`🗑️ Removing ${contract.name} (traded away)`);
        }
        return !traded;
      }
    );

    // Add the incoming traded players
    const newContracts = incoming.map((p) => {
      // Use contract directly if it has salariesByYear array, otherwise use player's contract
      const architectContract = ensureContractStructure(p.contract || p, {
        contractType: p.contractType || 'Trade',
        isExtension: !!p.isExtension,
        isRookieScale: !!p.isRookieScale,
        signingTeam: teamId,
      });

      return {
        name: p.name,
        player_id: p.id || p.player_id,
        years: architectContract?.salariesByYear?.length || 1,
        options: p.options || {},
        type: 'Trade',
        signAndTrade: !!p.signAndTrade,
        guaranteed: p.guaranteed ?? true,
        isMinimum: p.isMinimum ?? false,
        yearsOfService: p.yearsOfService ?? 0,
        contract: architectContract || undefined,
      };
    });

    const newPlayers = await Promise.all(
      incoming.map(async (p) => {
        const base = playersMap[p.name] || playersMap[p.player_id] || null;
        let playerData = base;
        if (!playerData && (p.id || p.player_id)) {
          // Load from architect_basePlayers collection
          const playerSnap = await getDoc(basePlayerRef(p.id || p.player_id));
          if (playerSnap.exists()) {
            const loaded = playerSnap.data();
            playerData = {
              id: loaded.playerId || p.id || p.player_id,
              player_id: loaded.playerId || p.id || p.player_id,
              name: loaded.displayName || p.name,
              displayName: loaded.displayName || p.name,
              position: loaded.bio?.position || '',
              age: loaded.bio?.age || null,
              contract: loaded.contract || null,
              bio: loaded.bio || {},
              ...loaded,
            };
          }
        }

        // Use contract from trade data or player data, ensuring it has proper structure
        const architectContract = ensureContractStructure(
          p.contract || playerData?.contract,
          {
            contractType: p.contractType || 'Trade',
            isExtension: !!p.isExtension,
            isRookieScale: !!p.isRookieScale,
            signingTeam: teamId,
          }
        );

        const position =
          playerData?.position ||
          playerData?.formattedPosition ||
          getPlayerPositionLabel(playerData?.bio?.position || p.position || '');
        return {
          ...(playerData || {}),
          name: playerData?.name || p.name,
          player_id: p.id || p.player_id || playerData?.player_id,
          displayName:
            playerData?.bio?.displayName || p.bio?.displayName || p.name,
          position,
          contract: architectContract || playerData?.contract,
        };
      })
    );

    updated.activeContracts.push(...newContracts);
    updated.players.push(...newPlayers);

    console.log(
      '✅ Applied trade — activeContracts now:',
      updated.activeContracts
    );

    setTeamCapSheet(updated);
  };

  const handleSign = (playerObj, contract) => {
    // Contract should already have salariesByYear array format
    const architectContract = ensureContractStructure(contract, {
      contractType: contract.contractType || 'Signed FA',
      isExtension: !!contract.isExtension,
      isRookieScale: !!contract.isRookieScale,
      signingTeam: teamId,
    });

    const newContract = {
      name: playerObj.name,
      player_id: playerObj.id || playerObj.player_id,
      years: architectContract?.salariesByYear?.length || 1,
      options: contract.options || {},
      type: contract.signAndTrade ? 'Sign & Trade' : 'Signed FA',
      signAndTrade: contract.signAndTrade || false,
      guaranteed: contract.guaranteed,
      isMinimum: contract.isMinimum,
      yearsOfService: contract.yearsOfService,
      contract: architectContract,
    };

    setTeamCapSheet((prev) => {
      const active = prev?.activeContracts || [];
      const players = prev?.players || [];

      const base =
        playersMap[playerObj.name] ||
        playersMap[playerObj.player_id] ||
        playersMap[playerObj.id] ||
        {};

      const position =
        base.position ||
        base.formattedPosition ||
        getPlayerPositionLabel(base.bio?.position || playerObj.position || '');

      const newPlayer = {
        ...(base || {}),
        name: base.name || playerObj.name,
        player_id: playerObj.id || playerObj.player_id || base.player_id,
        displayName:
          base.bio?.displayName || playerObj.bio?.displayName || playerObj.name,
        position,
        contract:
          ensureContractStructure(contract, {
            contractType: contract.contractType || 'Signed FA',
            isExtension: !!contract.isExtension,
            isRookieScale: !!contract.isRookieScale,
            signingTeam: teamId,
          }) || base.contract,
      };

      return {
        ...prev,
        activeContracts: [...active, newContract],
        players: [...players, newPlayer],
      };
    });

    setFreeAgents((prev) =>
      prev.filter(
        (p) =>
          p.name !== playerObj.name &&
          p.id !== playerObj.id &&
          p.player_id !== playerObj.player_id
      )
    );
  };

  const handleEditContract = (player) => {
    setSelectedPlayer(player);
    setInitialAction(null); // No pre-selection when just clicking player name
    setTargetYear(null); // No specific year context
    setActionContext(null); // No specific action context - show based on player state
    setSelectedRulesYear(currentYear);
    setShowContractModal(true);
  };

  // Handler for clicking action cells (PO/TO/UFA/RFA) in CapSheetFull or Renounce
  const handleCapSheetAction = (player, actionType, year) => {
    if (actionType === 'renounce') {
      handleRenounceRights(player);
      return;
    }

    setSelectedPlayer(player);
    setTargetYear(year); // Store which year was clicked
    setSelectedRulesYear(year || currentYear);

    // Determine action context based on what was clicked
    const contextMap = {
      po: 'option',
      to: 'option',
      ufa: 'freeAgent',
      rfa: 'freeAgent',
    };

    setInitialAction(null); // No pre-selection - user picks
    setActionContext(contextMap[actionType] || null);
    setShowContractModal(true);
  };

  const handleSaveContract = (player, contractData) => {
    capSheetState.signPlayer(player, contractData, 'signNew');
    setShowContractModal(false);
  };

  const handleExtendContract = (player, extensionContract) => {
    capSheetState.extendContract(player, extensionContract);
    setShowContractModal(false);
  };

  const handleWaiveContract = (player, { stretch, buyout }) => {
    const confirmMsg = stretch
      ? 'Waive and stretch this player?'
      : 'Waive this player?';
    if (!window.confirm(confirmMsg)) return;

    capSheetState.waivePlayer(player, { stretch, buyout });
    setShowContractModal(false);
  };

  const handleOptionDecision = (player, accepted) => {
    capSheetState.exerciseOption(player, accepted);
    setShowContractModal(false);
  };

  const handleRenounceRights = (player) => {
    if (
      window.confirm(
        `Are you sure you want to renounce rights to ${player.displayName || player.name}? This will clear their cap hold.`
      )
    ) {
      capSheetState.renounceRights(player);
    }
  };

  const handleUpdateRoster = (updatedCapSheet) => {
    setTeamCapSheet(updatedCapSheet);
  };

  const handleResetCapSheet = () => {
    const confirmReset = window.confirm(
      'Are you sure you want to clear all contracts and reset the cap sheet?'
    );
    if (!confirmReset) return;

    const resetSheet = {
      ...teamCapSheet,
      activeContracts: [],
      waivedContracts: [],
      tradeExceptions: [],
      exceptionHistory: [],
      mleHistory: [],
      pickLog: [],
      currentPicks: {},
      amount: capProjections[toSeasonKey(currentYear)]?.fullMLE || 0,
    };

    setTeamCapSheet(resetSheet);
    setOffseasonRun(false);
    setOffseasonSummary(null);
  };

  if (authLoading || isLoading) return <p>Loading GM Dashboard...</p>;
  if (!teamCapSheet) return <p>No team data</p>;

  return (
    <div className="gm-dashboard px-6 py-4 text-white min-h-screen bg-[#0d0d0d]">
      <div className="flex items-center justify-between mb-6 border-b border-white/10 pb-2">
        <h1 className="text-3xl font-bold">
          HoopZero Architect – GM Dashboard
        </h1>
        <div className="flex items-center gap-2">
          {/* Season Selector */}
          <label className="flex items-center gap-2 text-sm font-medium">
            Season
            <select
              value={currentYear}
              onChange={(e) => setCurrentYear(parseInt(e.target.value, 10))}
              className="bg-[#1a1a1a] text-white text-sm px-2 py-1 rounded border border-white/10"
            >
              {seasonEndYearsFromCaps(capProjections).map((y) => (
                <option key={y} value={y}>
                  {toSeasonKey(y)}
                </option>
              ))}
            </select>
          </label>

          {/* View mode - only show plan option if userId is available */}
          {userId && (
            <select
              value={viewMode}
              onChange={(e) => setViewMode(e.target.value)}
              className="bg-[#1a1a1a] text-white text-sm px-2 py-1 rounded border border-white/10"
            >
              <option value="plan">Plan</option>
              <option value="baseline">Baseline</option>
            </select>
          )}

          {/* Plan picker - only show if userId is available and in plan mode */}
          {userId && viewMode === 'plan' && (
            <select
              value={selectedPlan}
              onChange={(e) => setSelectedPlan(e.target.value)}
              className="bg-[#1a1a1a] text-white text-sm px-2 py-1 rounded border border-white/10"
            >
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name || p.id}
                </option>
              ))}
            </select>
          )}

          {/* Undo Button & Changes Counter */}
          {capSheetState.hasChanges && (
            <div className="flex items-center gap-2 ml-2 pl-2 border-l border-white/10">
              <span className="text-xs text-white/50">
                {capSheetState.actionHistory.length} change
                {capSheetState.actionHistory.length !== 1 ? 's' : ''}
              </span>
              <button
                type="button"
                onClick={capSheetState.undo}
                disabled={!capSheetState.canUndo}
                className="px-2 py-1 text-xs font-medium rounded bg-orange-600/20 text-orange-400 hover:bg-orange-600/30 border border-orange-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                title="Undo last action"
              >
                ↩ Undo
              </button>
              <button
                type="button"
                onClick={capSheetState.reset}
                className="px-2 py-1 text-xs font-medium rounded bg-red-600/20 text-red-400 hover:bg-red-600/30 border border-red-500/30 transition-all"
                title="Reset all changes"
              >
                Reset
              </button>
            </div>
          )}
        </div>
      </div>
      {error && <p className="text-red-500 mb-2">{error}</p>}
      {isSaving && <p className="text-sm mb-2">Saving...</p>}

      <div className="tab-bar flex flex-wrap gap-3 mb-6">
        <button
          onClick={() => setActiveTab('roster')}
          className={`px-4 py-2 rounded-md text-sm font-semibold ${
            activeTab === 'roster'
              ? 'bg-lakers/90 text-black'
              : 'bg-white/10 hover:bg-white/20'
          }`}
        >
          Roster
        </button>
        <button
          onClick={() => setActiveTab('cap')}
          className={`px-4 py-2 rounded-md text-sm font-semibold ${
            activeTab === 'cap'
              ? 'bg-lakers/90 text-black'
              : 'bg-white/10 hover:bg-white/20'
          }`}
        >
          Cap Sheet
        </button>
        <button
          onClick={() => setActiveTab('capfull')}
          className={`px-4 py-2 rounded-md text-sm font-semibold ${
            activeTab === 'capfull'
              ? 'bg-lakers/90 text-black'
              : 'bg-white/10 hover:bg-white/20'
          }`}
        >
          Full Cap Table
        </button>
        <button
          onClick={() => setActiveTab('trade')}
          className={`px-4 py-2 rounded-md text-sm font-semibold ${
            activeTab === 'trade'
              ? 'bg-lakers/90 text-black'
              : 'bg-white/10 hover:bg-white/20'
          }`}
        >
          Trade Machine
        </button>
        <button
          onClick={() => setActiveTab('fa')}
          className={`px-4 py-2 rounded-md text-sm font-semibold ${
            activeTab === 'fa'
              ? 'bg-lakers/90 text-black'
              : 'bg-white/10 hover:bg-white/20'
          }`}
        >
          Free Agency
        </button>
        <button
          onClick={() => setActiveTab('offseason')}
          className={`px-4 py-2 rounded-md text-sm font-semibold ${
            activeTab === 'offseason'
              ? 'bg-lakers/90 text-black'
              : 'bg-white/10 hover:bg-white/20'
          }`}
        >
          Offseason
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2 rounded-md text-sm font-semibold ${
            activeTab === 'history'
              ? 'bg-lakers/90 text-black'
              : 'bg-white/10 hover:bg-white/20'
          }`}
        >
          Team History
        </button>
      </div>

      <div className="tab-content space-y-6">
        {activeTab === 'roster' && (
          <RosterSection
            teamCapSheet={capSheetState.modifiedCapSheet}
            playersMap={playersMap}
            teamId={teamId}
          />
        )}

        {activeTab === 'cap' && (
          <CapSheetSection
            teamCapSheet={capSheetState.modifiedCapSheet}
            currentYear={currentYear}
            onSelectPlayer={handleEditContract}
            playersMap={playersMap}
          />
        )}

        {activeTab === 'capfull' && (
          <CapTableSection
            teamCapSheet={capSheetState.modifiedCapSheet}
            currentYear={currentYear}
            onSelectPlayer={handleEditContract}
            onActionClick={handleCapSheetAction}
            playersMap={playersMap}
            getRulesProfileForYear={getProfileForYear}
          />
        )}

        {activeTab === 'trade' && (
          <TradeSection
            primaryTeam={teamId}
            capProjections={capProjections}
            currentYear={currentYear}
            playersMap={playersMap}
            onApplyTrade={applyTradeToCapSheet}
            primaryTeamData={teamCapSheet}
            onEditContract={handleEditContract}
          />
        )}

        {activeTab === 'fa' && (
          <FreeAgencySection
            freeAgents={freeAgents}
            teamCapSheet={capSheetState.modifiedCapSheet}
            capProjections={capProjections}
            currentYear={currentYear}
            onSign={handleSign}
            playersMap={playersMap}
          />
        )}

        {activeTab === 'offseason' && (
          <OffseasonSection
            teamCapSheet={capSheetState.modifiedCapSheet}
            setTeamCapSheet={setTeamCapSheet}
            currentYear={currentYear}
            setCurrentYear={setCurrentYear}
            capProjections={capProjections}
            setLastCapSheet={setLastCapSheet}
            setOffseasonRun={setOffseasonRun}
            setOffseasonSummary={setOffseasonSummary}
            setShowModal={setShowModal}
            playersMap={playersMap}
          />
        )}

        {activeTab === 'history' && (
          <HistorySection teamCapSheet={teamCapSheet} />
        )}
      </div>

      {showModal && offseasonSummary && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Offseason Summary</h3>
            {offseasonSummary.declinedOptions.length > 0 && (
              <>
                <h4>Declined Options</h4>
                <ul>
                  {offseasonSummary.declinedOptions.map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>
              </>
            )}
            {offseasonSummary.expiredContracts.length > 0 && (
              <>
                <h4>Expired Contracts</h4>
                <ul>
                  {offseasonSummary.expiredContracts.map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>
              </>
            )}
            {offseasonSummary.expiredTPEs.length > 0 && (
              <>
                <h4>Expired Trade Exceptions</h4>
                <ul>
                  {offseasonSummary.expiredTPEs.map((t, i) => (
                    <li key={i}>
                      ${t.amount.toLocaleString()} from {t.source}
                    </li>
                  ))}
                </ul>
              </>
            )}
            {offseasonSummary.waivedDeadCap.length > 0 && (
              <>
                <h4>Ongoing Dead Cap</h4>
                <ul>
                  {offseasonSummary.waivedDeadCap.map((w, i) => (
                    <li key={i}>
                      {w.name} → ${w.amount.toLocaleString()} in {w.year}
                    </li>
                  ))}
                </ul>
              </>
            )}
            {offseasonSummary.resetMLE && (
              <p>
                <strong>MLE reset for new season.</strong>
              </p>
            )}
            <button onClick={() => setShowModal(false)}>Close</button>
          </div>
        </div>
      )}

      {showSaveModal && (
        <SavePlanModal
          isOpen={showSaveModal}
          name={newPlanName}
          onNameChange={setNewPlanName}
          onCancel={() => setShowSaveModal(false)}
          onSave={async () => {
            if (!newPlanName.trim()) return;
            setIsSaving(true);
            setError('');
            try {
              await saveNamedTeamPlan(
                userId,
                teamId,
                newPlanName.trim(),
                teamCapSheet
              );
              const updated = await listUserTeamPlans(userId, teamId);
              setPlans(updated);
              setSelectedPlan(newPlanName.trim());
              setNewPlanName('');
              setShowSaveModal(false);
            } catch (err) {
              console.error('Failed to save plan', err);
              setError('Failed to save plan');
            } finally {
              setIsSaving(false);
            }
          }}
        />
      )}

      {showContractModal && (
        <EditContractModal
          isOpen={showContractModal}
          onClose={() => {
            setShowContractModal(false);
            setInitialAction(null);
            setTargetYear(null);
            setActionContext(null);
            setSelectedRulesYear(currentYear);
          }}
          player={selectedPlayer}
          initialAction={initialAction}
          targetYear={targetYear}
          actionContext={actionContext}
          capProjections={capProjections}
          teamCapSheet={teamCapSheet}
          currentYear={currentYear}
          onSign={handleSign}
          onSave={handleSaveContract}
          onExtend={handleExtendContract}
          onWaive={handleWaiveContract}
          onOptionDecision={handleOptionDecision}
          playersMap={playersMap}
          playerRulesProfile={selectedPlayerRulesProfile}
          rulesLeagueContext={selectedRulesLeagueContext}
        />
      )}

      {userId && viewMode === 'plan' && (
        <div className="fixed bottom-6 right-6 z-50">
          <button
            onClick={() => setShowSaveModal(true)}
            className="bg-black/20 text-white px-4 py-2 rounded hover:bg-white/20"
          >
            Save Plan
          </button>
        </div>
      )}
    </div>
  );
};

export default GMDashboard;
