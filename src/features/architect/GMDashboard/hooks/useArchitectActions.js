/**
 * FILE: src/features/architect/GMDashboard/hooks/useArchitectActions.js
 * PURPOSE: Centralized action handlers for GMDashboard - manages all user interactions and mutations.
 * OWNERSHIP: Feature: architect/GMDashboard
 *
 * HISTORY:
 *  - 2025-12-12: Created - extracted all handlers from GMDashboard.jsx (Phase 3 refactor)
 *
 * LINKS:
 *  - Plan: plans/extract_gmdashboard_actions_b9466109.plan.md
 */
import { useCallback } from 'react';
import {
  saveNamedTeamPlan,
  listUserTeamPlans,
} from '@/features/architect/utils/firebaseTeamPlanHelpers';
import { basePlayerRef } from '@/data/firestorePaths';
import { getDoc } from 'firebase/firestore';
import { getPlayerPositionLabel } from '@/shared/utils/roles';
import capProjections from '@/features/architect/utils/capProjections';

// ==== Season helpers ====
const toSeasonKey = (endYear) => `${endYear - 1}-${String(endYear).slice(-2)}`;

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

/**
 * Centralized action handlers hook for GMDashboard
 *
 * @param {Object} params - Hook parameters
 * @param {string} params.teamId - Current team ID
 * @param {string|null} params.userId - Authenticated user ID (null if not logged in)
 * @param {boolean} params.authLoading - Whether auth is still loading
 * @param {Object} params.state - State object from useArchitectState
 * @param {Object} params.capSheetState - State object from useCapSheetState
 * @param {Object} params.playersMap - Map of players for quick lookup
 * @returns {Object} All action handlers
 */
export function useArchitectActions({
  teamId,
  userId,
  // authLoading is available but not currently used by handlers
  state,
  capSheetState,
  playersMap,
}) {
  // Destructure state for easier access
  const {
    teamCapSheet,
    currentYear,
    newPlanName,
    setTeamCapSheet,
    setSelectedRulesYear,
    setSelectedPlayer,
    setFreeAgents,
    startSave,
    finishSave,
    setShowSaveModal,
    setShowContractModal,
    setNewPlanName,
    setInitialAction,
    setTargetYear,
    setActionContext,
    setOffseasonRun,
    setOffseasonSummary,
    setPlans,
    setSelectedPlan,
  } = state;

  // === Trade Actions ===

  const applyTradeToCapSheet = useCallback(
    async (tradeData) => {
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

      const normalize = (str = '') =>
        str.toLowerCase().replace(/[^a-z0-9]/g, '');
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
            getPlayerPositionLabel(
              playerData?.bio?.position || p.position || ''
            );
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
    },
    [teamCapSheet, teamId, playersMap, setTeamCapSheet]
  );

  // === Contract/Player Actions ===

  const handleSign = useCallback(
    (playerObj, contract) => {
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
          getPlayerPositionLabel(
            base.bio?.position || playerObj.position || ''
          );

        const newPlayer = {
          ...(base || {}),
          name: base.name || playerObj.name,
          player_id: playerObj.id || playerObj.player_id || base.player_id,
          displayName:
            base.bio?.displayName ||
            playerObj.bio?.displayName ||
            playerObj.name,
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
    },
    [teamId, playersMap, setTeamCapSheet, setFreeAgents]
  );

  const handleEditContract = useCallback(
    (player) => {
      setSelectedPlayer(player);
      setInitialAction(null); // No pre-selection when just clicking player name
      setTargetYear(null); // No specific year context
      setActionContext(null); // No specific action context - show based on player state
      setSelectedRulesYear(currentYear);
      setShowContractModal(true);
    },
    [
      currentYear,
      setSelectedPlayer,
      setInitialAction,
      setTargetYear,
      setActionContext,
      setSelectedRulesYear,
      setShowContractModal,
    ]
  );

  // Handler for clicking action cells (PO/TO/UFA/RFA) in CapSheetFull or Renounce
  const handleCapSheetAction = useCallback(
    (player, actionType, year) => {
      if (actionType === 'renounce') {
        // Call renounce directly
        if (
          window.confirm(
            `Are you sure you want to renounce rights to ${player.displayName || player.name}? This will clear their cap hold.`
          )
        ) {
          capSheetState.renounceRights(player);
        }
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
    },
    [
      currentYear,
      capSheetState,
      setSelectedPlayer,
      setTargetYear,
      setSelectedRulesYear,
      setInitialAction,
      setActionContext,
      setShowContractModal,
    ]
  );

  const handleSaveContract = useCallback(
    (player, contractData) => {
      capSheetState.signPlayer(player, contractData, 'signNew');
      setShowContractModal(false);
    },
    [capSheetState, setShowContractModal]
  );

  const handleExtendContract = useCallback(
    (player, extensionContract) => {
      capSheetState.extendContract(player, extensionContract);
      setShowContractModal(false);
    },
    [capSheetState, setShowContractModal]
  );

  const handleWaiveContract = useCallback(
    (player, { stretch, buyout }) => {
      const confirmMsg = stretch
        ? 'Waive and stretch this player?'
        : 'Waive this player?';
      if (!window.confirm(confirmMsg)) return;

      capSheetState.waivePlayer(player, { stretch, buyout });
      setShowContractModal(false);
    },
    [capSheetState, setShowContractModal]
  );

  const handleOptionDecision = useCallback(
    (player, accepted) => {
      capSheetState.exerciseOption(player, accepted);
      setShowContractModal(false);
    },
    [capSheetState, setShowContractModal]
  );

  const handleRenounceRights = useCallback(
    (player) => {
      if (
        window.confirm(
          `Are you sure you want to renounce rights to ${player.displayName || player.name}? This will clear their cap hold.`
        )
      ) {
        capSheetState.renounceRights(player);
      }
    },
    [capSheetState]
  );

  const handleUpdateRoster = useCallback(
    (updatedCapSheet) => {
      setTeamCapSheet(updatedCapSheet);
    },
    [setTeamCapSheet]
  );

  const handleResetCapSheet = useCallback(() => {
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
  }, [
    teamCapSheet,
    currentYear,
    setTeamCapSheet,
    setOffseasonRun,
    setOffseasonSummary,
  ]);

  // === Modal Actions ===

  const openSaveModal = useCallback(() => {
    // Guard: only allow if userId is available
    if (!userId) return;
    setShowSaveModal(true);
  }, [userId, setShowSaveModal]);

  const closeSaveModal = useCallback(() => {
    setShowSaveModal(false);
  }, [setShowSaveModal]);

  const closeContractModal = useCallback(() => {
    setShowContractModal(false);
    setInitialAction(null);
    setTargetYear(null);
    setActionContext(null);
    setSelectedRulesYear(currentYear);
  }, [
    currentYear,
    setShowContractModal,
    setInitialAction,
    setTargetYear,
    setActionContext,
    setSelectedRulesYear,
  ]);

  // === Save Plan Action ===

  const handleSavePlan = useCallback(async () => {
    // Guard: saving requires userId
    if (!userId) {
      console.warn('Cannot save plan: userId is missing');
      return;
    }

    if (!newPlanName.trim()) return;

    startSave();
    try {
      await saveNamedTeamPlan(userId, teamId, newPlanName.trim(), teamCapSheet);
      const updated = await listUserTeamPlans(userId, teamId);
      setPlans(updated);
      setSelectedPlan(newPlanName.trim());
      setNewPlanName('');
      setShowSaveModal(false);
      finishSave();
    } catch (err) {
      console.error('Failed to save plan', err);
      finishSave('Failed to save plan');
    }
  }, [
    userId,
    teamId,
    newPlanName,
    teamCapSheet,
    startSave,
    finishSave,
    setPlans,
    setSelectedPlan,
    setNewPlanName,
    setShowSaveModal,
  ]);

  return {
    // Contract/Player actions
    handleSign,
    handleEditContract,
    handleCapSheetAction,
    handleSaveContract,
    handleExtendContract,
    handleWaiveContract,
    handleOptionDecision,
    handleRenounceRights,
    handleUpdateRoster,
    handleResetCapSheet,

    // Trade actions
    applyTradeToCapSheet,

    // Modal actions
    openSaveModal,
    closeSaveModal,
    closeContractModal,
    handleSavePlan,
  };
}

export default useArchitectActions;

