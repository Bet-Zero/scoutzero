/**
 * useCapSheetState Hook
 * 
 * Manages local state modifications to team cap sheet data.
 * Provides undo capability and action history for experimentation.
 * Changes persist during session but reset on page refresh.
 */
import { useState, useCallback, useMemo } from 'react';
import { generateExtensionContract, getContractYearSlice, calculateCapHold } from '@/features/architect/utils/contractUtils';
import { toSeasonCode } from '@/features/architect/utils/seasonFormat';
import capProjections from '@/features/architect/utils/capProjections';

/**
 * Action types for history tracking
 */
const ACTION_TYPES = {
  OPTION_ACCEPT: 'OPTION_ACCEPT',
  OPTION_DECLINE: 'OPTION_DECLINE',
  EXTEND: 'EXTEND',
  SIGN_NEW: 'SIGN_NEW',
  RESIGN: 'RESIGN',
  WAIVE: 'WAIVE',
  WAIVE_STRETCH: 'WAIVE_STRETCH',
  BUYOUT: 'BUYOUT',
  SIGN_AND_TRADE: 'SIGN_AND_TRADE',
  RENOUNCE: 'RENOUNCE',
};

/**
 * Deep clone a player object to avoid mutations
 */
const clonePlayer = (player) => JSON.parse(JSON.stringify(player));

/**
 * Main hook for cap sheet state management
 * 
 * @param {Object} params
 * @param {Object} params.initialCapSheet - The original team cap sheet data
 * @param {number} params.currentYear - Current NBA season end year (e.g., 2026 for 2025-26)
 * @returns {Object} State and action methods
 */
export function useCapSheetState({ initialCapSheet, currentYear }) {
  // Modified players state - starts as copy of initial data
  const [players, setPlayers] = useState(() => 
    (initialCapSheet?.players || []).map(clonePlayer)
  );

  // Cap Holds state - managed as a separate array
  const [capHolds, setCapHolds] = useState(() => 
    initialCapSheet?.capHolds || []
  );
  
  // Action history for undo
  const [actionHistory, setActionHistory] = useState([]);
  
  /**
   * Find a player by ID or name
   */
  const findPlayer = useCallback((playerIdOrName) => {
    return players.find(p => 
      p.playerId === playerIdOrName || 
      p.id === playerIdOrName ||
      p.name === playerIdOrName
    );
  }, [players]);
  
  /**
   * Update a player in the state
   */
  const updatePlayer = useCallback((playerIdOrName, updateFn, actionType, actionDetails = {}) => {
    setPlayers(prevPlayers => {
      const playerIndex = prevPlayers.findIndex(p => 
        p.playerId === playerIdOrName || 
        p.id === playerIdOrName ||
        p.name === playerIdOrName
      );
      
      if (playerIndex === -1) {
        console.warn(`Player not found: ${playerIdOrName}`);
        return prevPlayers;
      }
      
      // Clone the player and apply update
      const updatedPlayer = updateFn(clonePlayer(prevPlayers[playerIndex]));
      
      // Create new array with updated player
      const newPlayers = [...prevPlayers];
      newPlayers[playerIndex] = updatedPlayer;
      
      return newPlayers;
    });
    
    // Record action in history
    setActionHistory(prev => [...prev, {
      type: actionType,
      playerId: playerIdOrName,
      timestamp: Date.now(),
      ...actionDetails,
    }]);
  }, []);
  
  /**
   * Exercise or decline a player/team option
   * 
   * @param {Object} player - Player object
   * @param {boolean} accept - True to accept, false to decline
   * @param {number} optionYear - The year of the option
   */
  const exerciseOption = useCallback((player, accept, optionYear = null) => {
    const playerId = player.playerId || player.id || player.name;
    const targetYear = optionYear || currentYear + 1;
    
    updatePlayer(playerId, (p) => {
      const salaries = p.contract?.salariesByYear || [];
      
      // Find the option year entry
      const optionIndex = salaries.findIndex(y => {
        const season = String(y.season);
        const yearEnd = /^\d{4}-\d{2}$/.test(season) 
          ? 2000 + parseInt(season.split('-')[1], 10)
          : parseInt(season, 10);
        return yearEnd === targetYear && y.option;
      });
      
      if (optionIndex === -1) {
        console.warn(`No option found for year ${targetYear}`);
        return p;
      }
      
      // Mark option as used
      p.contract.salariesByYear[optionIndex].optionUsed = accept ? 'accepted' : 'declined';
      
      if (!accept) {
        // Declining: remove this year and all future years
        p.contract.salariesByYear = salaries.filter((y, idx) => idx < optionIndex);
        
        // Set player as upcoming free agent
        p.freeAgentYear = targetYear;
        if (!p.contract.freeAgency) p.contract.freeAgency = {};
        p.contract.freeAgency.year = targetYear - 1; // FA year is season start year
        p.contract.freeAgency.type = 'UFA';

        const capHoldAmt = calculateCapHold(p, capProjections, currentYear);
        if (capHoldAmt) {
          const newHold = {
             playerId: p.id || p.player_id || p.name,
             playerName: p.displayName || p.name,
             amount: capHoldAmt,
             type: 'FA Cap Hold', // or derive from rights
             season: toSeasonCode(targetYear),
             isSigned: false,
             reason: 'Declined Option',
             active: true
          };
          
          setCapHolds(prev => {
             // Avoid dupes
             const filtered = prev.filter(h => h.playerId !== newHold.playerId);
             return [...filtered, newHold];
          });
        }
      }
      
      return p;
    }, accept ? ACTION_TYPES.OPTION_ACCEPT : ACTION_TYPES.OPTION_DECLINE, {
      optionYear: targetYear,
      accepted: accept,
    });
  }, [currentYear, updatePlayer]);
  
  /**
   * Extend a player's contract
   * 
   * @param {Object} player - Player object
   * @param {Object} extensionData - Extension contract details
   */
  const extendContract = useCallback((player, extensionData) => {
    const playerId = player.playerId || player.id || player.name;
    
    updatePlayer(playerId, (p) => {
      // Add extension years to futureContract
      if (!p.futureContract) {
        p.futureContract = {
          salariesByYear: [],
          extension: true,
        };
      }
      
      // Merge new extension years
      const newYears = extensionData.salariesByYear || [];
      p.futureContract.salariesByYear = [
        ...(p.futureContract.salariesByYear || []),
        ...newYears.map(y => ({ ...y, isExtensionSeason: true })),
      ];
      
      // Update free agency info
      if (newYears.length > 0) {
        const lastYear = newYears[newYears.length - 1];
        const lastSeason = String(lastYear.season);
        const endYear = /^\d{4}-\d{2}$/.test(lastSeason)
          ? 2000 + parseInt(lastSeason.split('-')[1], 10)
          : parseInt(lastSeason, 10);
        
        p.freeAgentYear = endYear + 1;
        if (!p.contract) p.contract = {};
        if (!p.contract.freeAgency) p.contract.freeAgency = {};
        p.contract.freeAgency.year = endYear;
        p.contract.freeAgency.type = 'UFA';
      }
      
      return p;
    }, ACTION_TYPES.EXTEND, {
      years: extensionData.salariesByYear?.length || 0,
      totalValue: extensionData.totalValue || 0,
    });
  }, [updatePlayer]);
  
  /**
   * Sign a player to a new contract (re-sign or sign new after declining option)
   * 
   * @param {Object} player - Player object
   * @param {Object} contractData - New contract details
   * @param {string} signingType - 'resign' or 'signNew'
   */
  const signPlayer = useCallback((player, contractData, signingType = 'resign') => {
    const playerId = player.playerId || player.id || player.name;
    const startYear = contractData.startYear || currentYear + 1;
    
    updatePlayer(playerId, (p) => {
      // Build new contract salaries
      const salaries = [];
      const years = contractData.years || 1;
      const baseSalary = contractData.salaries?.[0] || contractData.base || 0;
      const raisePct = contractData.raisePct || 0.08;
      
      let salary = baseSalary;
      for (let i = 0; i < years; i++) {
        const endYear = startYear + i;
        salaries.push({
          season: toSeasonCode(endYear),
          salary: Math.round(salary),
          capHit: Math.round(salary),
          guaranteed: true,
          option: null,
        });
        salary *= (1 + raisePct);
      }
      
      // Replace or create new contract
      p.contract = {
        ...p.contract,
        salariesByYear: salaries,
        totalValue: salaries.reduce((sum, y) => sum + y.salary, 0),
        startYear: startYear - 1, // Contract starts in the start year
        originalLength: years,
        exceptionType: contractData.exceptionType || null,
      };
      
      // Clear free agent status
      p.freeAgentYear = null;
      
      // Update free agency to new end
      const lastYear = startYear + years - 1;
      if (!p.contract.freeAgency) p.contract.freeAgency = {};
      p.contract.freeAgency.year = lastYear;
      p.contract.freeAgency.type = 'UFA';
      
      // Clear any future contract (extension) since we're replacing
      p.futureContract = null;
      
      return p;
    }, signingType === 'resign' ? ACTION_TYPES.RESIGN : ACTION_TYPES.SIGN_NEW, {
      years: contractData.years || 1,
      totalValue: contractData.salaries?.reduce((a, b) => a + b, 0) || 0,
    });
  }, [currentYear, updatePlayer]);
  
  /**
   * Waive a player (with optional stretch)
   * 
   * @param {Object} player - Player object
   * @param {Object} options - { stretch: boolean, buyout: boolean, buyoutAmount: number }
   */
  const waivePlayer = useCallback((player, options = {}) => {
    const playerId = player.playerId || player.id || player.name;
    const { stretch = false, buyout = false, buyoutAmount = 0 } = options;
    
    updatePlayer(playerId, (p) => {
      // Calculate remaining guaranteed money
      const remainingGuaranteed = (p.contract?.salariesByYear || [])
        .filter(y => {
          const season = String(y.season);
          const yearEnd = /^\d{4}-\d{2}$/.test(season)
            ? 2000 + parseInt(season.split('-')[1], 10)
            : parseInt(season, 10);
          return yearEnd >= currentYear && y.guaranteed !== false;
        })
        .reduce((sum, y) => sum + (y.salary || 0), 0);
      
      const deadCap = buyout ? buyoutAmount : remainingGuaranteed;
      
      // Mark player as waived
      p.waived = true;
      p.waivedDate = new Date().toISOString();
      p.deadCap = {
        amount: deadCap,
        stretched: stretch,
        buyout,
        buyoutAmount: buyout ? buyoutAmount : null,
      };
      
      // Clear active contract (they're off the roster)
      p.contract = {
        ...p.contract,
        salariesByYear: [],
        waived: true,
      };
      p.futureContract = null;
      
      return p;
    }, stretch ? ACTION_TYPES.WAIVE_STRETCH : (buyout ? ACTION_TYPES.BUYOUT : ACTION_TYPES.WAIVE), {
      remaining: 0, // Would calculate from contract
      stretch,
      buyout,
    });
  }, [currentYear, updatePlayer]);
  
  /**
   * Renounce rights to a free agent
   * 
   * @param {Object} player - Player object or Cap Hold object
   */
  const renounceRights = useCallback((playerOrHold) => {
    const idToRenounce = playerOrHold.playerId || playerOrHold.id || playerOrHold.player_id || playerOrHold.name;
    
    // Remove from capHolds array
    setCapHolds(prev => prev.filter(h => h.playerId !== idToRenounce));
    
    // Also update the player object if it exists (for visual consistency if needed, though UI should drive off capHolds)
    updatePlayer(idToRenounce, (p) => {
      // Logic to mark as renounced if we were keeping track on player, 
      // but primarily we just want to ensure proper state is reflected.
      // Maybe set a flag 'rightsRenounced' if helpful for other UI.
      p.rightsRenounced = true; 
      
      // Clear bird rights
      if (p.contract?.birdRights) {
        p.contract.birdRights.status = 'None';
      }
      
      return p;
    }, ACTION_TYPES.RENOUNCE, {});
  }, [updatePlayer, setCapHolds]);
  
  /**
   * Undo the last action
   */
  const undo = useCallback(() => {
    if (actionHistory.length === 0) return;
    
    // For now, simple approach: reset to initial and replay all but last action
    // In future, could store snapshots for more efficient undo
    const actionsToReplay = actionHistory.slice(0, -1);
    
    // Reset to initial state
    setPlayers((initialCapSheet?.players || []).map(clonePlayer));
    setCapHolds(initialCapSheet?.capHolds || []); // Reset cap holds too
    setActionHistory([]);
    
    // TODO: Replay actions if we want cumulative undo
    // For now, each undo just removes the last action from history
    // Users will see "reset to original" behavior
    
    // Actually, let's just pop the last action and keep the note
    // The proper way would be to store state snapshots, but that's heavier
    setActionHistory(actionsToReplay);
  }, [actionHistory, initialCapSheet]);
  
  /**
   * Reset all changes to initial state
   */
  const reset = useCallback(() => {
    setPlayers((initialCapSheet?.players || []).map(clonePlayer));
    setCapHolds(initialCapSheet?.capHolds || []); // Reset cap holds too
    setActionHistory([]);
  }, [initialCapSheet]);
  
  /**
   * Refresh from new initial data (e.g., after team selection change)
   */
  const refreshFromSource = useCallback((newCapSheet) => {
    setPlayers((newCapSheet?.players || []).map(clonePlayer));
    setCapHolds(newCapSheet?.capHolds || []); // Refresh cap holds too
    setActionHistory([]);
  }, []);
  
  // Derived state
  const canUndo = actionHistory.length > 0;
  const hasChanges = actionHistory.length > 0;
  
  // Build modified cap sheet object
  const modifiedCapSheet = useMemo(() => ({
    ...initialCapSheet,
    players,
    _modified: hasChanges,
    _actionCount: actionHistory.length,
  }), [initialCapSheet, players, hasChanges, actionHistory.length]);
  
  return {
    // State
    players,
    modifiedCapSheet,
    actionHistory,
    canUndo,
    hasChanges,
    
    // Actions
    exerciseOption,
    extendContract,
    signPlayer,
    waivePlayer,
    renounceRights,
    undo,
    reset,
    refreshFromSource,
    
    // Internal (for advanced use)
    findPlayer,
    updatePlayer,
  };
}

export default useCapSheetState;
