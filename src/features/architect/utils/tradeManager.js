/**
 * FILE: src/features/architect/utils/tradeManager.js
 * PURPOSE: Computes and validates trade-related roster transactions (trades, signings, waivers, extensions) and returns updated snapshots without persisting to Firestore.
 * OWNERSHIP: Feature: architect/utils
 *
 * HISTORY:
 *  - 2025-11-27: Created (Bet_Zero)
 *  - 2025-12-13: Removed client-side Firestore write operations; module is now read-only (Copilot)
 *
 * LINKS:
 *  - Plan: N/A (not created via plan)
 *  - Latest Chunk: N/A
 *  - Related: src/features/architect/utils/tradeMachine (trade validation)
 */

import { getTeam, getPlayer } from '@/features/architect/utils/teamLoader';
import { validateTrade } from '@/features/architect/utils/tradeMachine';
import { buildTradeTeamInput } from '@/features/architect/utils/schemaAdapter';
import { toEndYear } from '@/features/architect/utils/seasonFormat';

/**
 * Client-side note:
 * This module is intentionally READ-ONLY with respect to Firestore.
 * It computes updated team/player snapshots and returns them to callers,
 * but does not persist them. Persistence must be handled server-side.
 */

/**
 * Execute trade between teams
 *
 * @param {string} worldId - World ID
 * @param {Object} tradeData - Trade data
 * @param {Array<Object>} tradeData.teams - Array of team trade objects
 * @param {Object} tradeData.capProjections - Cap projections for validation
 * @param {number|string} tradeData.currentYear - Current year (numeric or season code)
 * @returns {Promise<Object>} Trade execution result
 */
export async function executeTrade(worldId, tradeData) {
  if (!worldId) {
    throw new Error('worldId is required');
  }
  if (!tradeData || !tradeData.teams || tradeData.teams.length < 2) {
    throw new Error('Trade must include at least 2 teams');
  }

  // Get current year (convert season code to year if needed)
  const currentYear =
    typeof tradeData.currentYear === 'string'
      ? toEndYear(tradeData.currentYear)
      : tradeData.currentYear || new Date().getFullYear();

  // Load team states for all teams in trade
  const teamCodes = tradeData.teams.map((t) => t.teamCode || t.team?.teamCode);
  const teamStates = await Promise.all(
    teamCodes.map((code) => getTeam(worldId, code))
  );

  // Build trade input for validator
  // Each team combines baseline state with trade-specific data
  const tradeInput = {
    teams: tradeData.teams.map((teamTrade, index) =>
      buildTradeTeamInput(teamStates[index], teamTrade)
    ),
    capProjections: tradeData.capProjections || {},
    currentYear,
    tradeCtx: tradeData.tradeCtx || {},
  };

  // Validate trade
  const validation = validateTrade(tradeInput);

  if (!validation.legal) {
    throw new Error(
      `Trade invalid: ${validation.reason || validation.error || 'Unknown error'}`
    );
  }

  // Execute trade: update rosters and draft picks
  const updatedTeams = [];

  for (let i = 0; i < tradeData.teams.length; i++) {
    const teamTrade = tradeData.teams[i];
    const currentTeamState = teamStates[i];
    const teamCode = teamCodes[i];

    // Build updated team state
    const updatedTeam = { ...currentTeamState };

    // Update roster: remove outgoing players, add incoming players
    const outgoingPlayerIds = (teamTrade.sends || []).map(
      (p) => p.player_id || p.id || p.playerId
    );
    const incomingPlayerIds = [];

    // Collect incoming players from other teams
    tradeData.teams.forEach((otherTeamTrade, otherIndex) => {
      if (otherIndex !== i) {
        const incoming = otherTeamTrade.sends || [];
        incoming.forEach((player) => {
          const playerId = player.player_id || player.id || player.playerId;
          if (playerId) {
            incomingPlayerIds.push(playerId);
          }
        });
      }
    });

    // Update roster array
    updatedTeam.roster = [
      ...currentTeamState.roster.filter(
        (playerId) => !outgoingPlayerIds.includes(playerId)
      ),
      ...incomingPlayerIds,
    ];

    // Update draft picks: remove outgoing picks, add incoming picks
    const outgoingPicks = teamTrade.picksOut || [];
    const incomingPicks = [];

    tradeData.teams.forEach((otherTeamTrade, otherIndex) => {
      if (otherIndex !== i) {
        const incoming = otherTeamTrade.picksOut || [];
        incomingPicks.push(...incoming);
      }
    });

    // Update draft picks array
    updatedTeam.draftPicks = [
      ...(currentTeamState.draftPicks || []).filter(
        (pick) =>
          !outgoingPicks.some(
            (outgoing) =>
              outgoing.year === pick.year &&
              outgoing.round === pick.round &&
              outgoing.owner === pick.owner
          )
      ),
      ...incomingPicks,
    ];

    // Update source metadata
    updatedTeam.source = {
      ...updatedTeam.source,
      type: 'world-snapshot',
      worldId,
      generatedAt: new Date().toISOString(),
      baseTeamVersion:
        currentTeamState.source?.scrapedAt || currentTeamState.source?.version,
    };

    // Recalculate cap totals (simplified - full implementation would use cap calculation utils)
    updatedTeam.totals = await updateTeamCapTotals(updatedTeam);

    updatedTeams.push({ teamCode, team: updatedTeam });
  }

  return {
    success: true,
    validation,
    teams: updatedTeams,
  };
}

/**
 * Sign free agent to team
 *
 * @param {string} worldId - World ID
 * @param {string} teamCode - Team code
 * @param {Object} signingData - Signing data
 * @param {string} signingData.playerId - Player ID
 * @param {Object} signingData.contract - Contract details
 * @param {string} [signingData.signedUsing] - Exception used (e.g., "MLE", "BAE")
 * @returns {Promise<Object>} Signing result
 */
export async function signFreeAgent(worldId, teamCode, signingData) {
  if (!worldId || !teamCode || !signingData || !signingData.playerId) {
    throw new Error('worldId, teamCode, and signingData.playerId are required');
  }

  // Load team state
  const teamState = await getTeam(worldId, teamCode);

  // Build updated team
  const updatedTeam = { ...teamState };

  // Add player to roster if not already present
  if (!updatedTeam.roster.includes(signingData.playerId)) {
    updatedTeam.roster = [...updatedTeam.roster, signingData.playerId];
  }

  // Update exceptions if used
  if (signingData.signedUsing) {
    const exceptionType = signingData.signedUsing.toLowerCase();
    const contractValue = signingData.contract?.totalValue || 0;

    if (exceptionType === 'mle' && updatedTeam.exceptions?.mle) {
      updatedTeam.exceptions.mle.usedAmount =
        (updatedTeam.exceptions.mle.usedAmount || 0) + contractValue;
      updatedTeam.exceptions.mle.remainingAmount =
        (updatedTeam.exceptions.mle.remainingAmount || 0) - contractValue;

      // Trigger hard cap if using non-taxpayer MLE
      // Note: Must check for 'non-taxpayer' explicitly, not just !includes('taxpayer')
      // because 'non-taxpayer' includes 'taxpayer' as a substring
      if (updatedTeam.exceptions.mle.type === 'non-taxpayer') {
        updatedTeam.totals = updatedTeam.totals || {};
        updatedTeam.totals.isHardCapped = true;
        updatedTeam.totals.hardCapLevel = 'firstApron';
        updatedTeam.totals.hardCapDetail = 'Triggered by Non-Taxpayer MLE';
      }
    } else if (exceptionType === 'bae' && updatedTeam.exceptions?.bae) {
      updatedTeam.exceptions.bae.usedAmount =
        (updatedTeam.exceptions.bae.usedAmount || 0) + contractValue;
      updatedTeam.exceptions.bae.remainingAmount =
        (updatedTeam.exceptions.bae.remainingAmount || 0) - contractValue;
    }
  }

  // Remove cap hold if player had one
  if (updatedTeam.capHolds) {
    updatedTeam.capHolds = updatedTeam.capHolds.filter(
      (hold) => hold.playerId !== signingData.playerId
    );
  }

  // Recalculate cap totals
  updatedTeam.totals = await updateTeamCapTotals(updatedTeam);

  // Update source metadata
  updatedTeam.source = {
    ...updatedTeam.source,
    type: 'world-snapshot',
    worldId,
    generatedAt: new Date().toISOString(),
    baseTeamVersion: teamState.source?.scrapedAt || teamState.source?.version,
  };

  return {
    success: true,
    team: updatedTeam,
  };
}

/**
 * Waive player (with optional stretch)
 *
 * @param {string} worldId - World ID
 * @param {string} teamCode - Team code
 * @param {string} playerId - Player ID
 * @param {Object} [options] - Waive options
 * @param {boolean} [options.stretch=false] - Stretch contract over multiple years
 * @param {number} [options.stretchYears=3] - Number of years to stretch
 * @returns {Promise<Object>} Waive result
 */
export async function waivePlayer(worldId, teamCode, playerId, options = {}) {
  if (!worldId || !teamCode || !playerId) {
    throw new Error('worldId, teamCode, and playerId are required');
  }

  const { stretch = false, stretchYears = 3 } = options;

  // Load team and player states
  const teamState = await getTeam(worldId, teamCode);
  const playerData = await getPlayer(worldId, teamCode, playerId);

  if (!playerData || !playerData.contract) {
    throw new Error(`Player ${playerId} not found or has no contract`);
  }

  // Build updated team
  const updatedTeam = { ...teamState };

  // Remove player from roster
  updatedTeam.roster = updatedTeam.roster.filter((id) => id !== playerId);

  // Calculate dead cap
  const contract = playerData.contract;
  const remainingSalary = contract.guaranteedValue || 0;

  if (stretch && remainingSalary > 0) {
    // Stretch over multiple years
    const stretchedAmount = Math.floor(remainingSalary / stretchYears);
    const currentSeason = teamState.season || '2025-26';

    // Add to dead cap array
    updatedTeam.deadCap = updatedTeam.deadCap || [];
    updatedTeam.deadCap.push({
      playerId,
      playerName: playerData.displayName || playerId,
      originalSalary: remainingSalary,
      amountByYear: Array.from({ length: stretchYears }, (_, i) => {
        const seasonYear = parseInt(currentSeason.split('-')[0]) + i;
        const nextYear = seasonYear + 1;
        return {
          season: `${seasonYear}-${String(nextYear).slice(-2)}`,
          amount: stretchedAmount,
          isStretched: true,
        };
      }),
      waiveDate: new Date().toISOString(),
      notes: `Stretched over ${stretchYears} years`,
    });
  } else if (remainingSalary > 0) {
    // Immediate dead cap (current season only)
    updatedTeam.deadCap = updatedTeam.deadCap || [];
    updatedTeam.deadCap.push({
      playerId,
      playerName: playerData.displayName || playerId,
      originalSalary: remainingSalary,
      amountByYear: [
        {
          season: teamState.season || '2025-26',
          amount: remainingSalary,
          isStretched: false,
        },
      ],
      waiveDate: new Date().toISOString(),
    });
  }

  // Recalculate cap totals
  updatedTeam.totals = await updateTeamCapTotals(updatedTeam);

  // Update source metadata
  updatedTeam.source = {
    ...updatedTeam.source,
    type: 'world-snapshot',
    worldId,
    generatedAt: new Date().toISOString(),
    baseTeamVersion: teamState.source?.scrapedAt || teamState.source?.version,
  };

  return {
    success: true,
    team: updatedTeam,
  };
}

/**
 * Extend player contract
 *
 * @param {string} worldId - World ID
 * @param {string} teamCode - Team code
 * @param {string} playerId - Player ID
 * @param {Object} extension - Extension contract details
 * @returns {Promise<Object>} Extension result
 */
export async function extendPlayer(worldId, teamCode, playerId, extension) {
  if (!worldId || !teamCode || !playerId || !extension) {
    throw new Error('worldId, teamCode, playerId, and extension are required');
  }

  // Load team and player states
  const teamState = await getTeam(worldId, teamCode);
  const playerData = await getPlayer(worldId, teamCode, playerId);

  if (!playerData || !playerData.contract) {
    throw new Error(`Player ${playerId} not found or has no contract`);
  }

  const updatedPlayer = {
    ...playerData,
    contract: {
      ...playerData.contract,
      ...extension,
      isExtension: true,
    },
  };

  // Recalculate team cap totals (player override affects team totals)
  const updatedTeam = { ...teamState };
  updatedTeam.totals = await updateTeamCapTotals(updatedTeam);

  return {
    success: true,
    player: updatedPlayer,
    team: updatedTeam,
  };
}

/**
 * Update team cap totals after changes
 *
 * This is a simplified implementation. A full implementation would:
 * - Sum all player salaries from roster
 * - Add dead cap amounts
 * - Add cap holds
 * - Calculate exceptions usage
 * - Determine hard cap status
 * - Calculate luxury tax, apron status, etc.
 *
 * @param {Object} teamData - Team data
 * @returns {Promise<Object>} Updated totals object
 */
export async function updateTeamCapTotals(teamData) {
  // Simplified cap calculation
  // In production, this would use comprehensive cap calculation utilities

  const totals = teamData.totals || {};

  // Calculate total salary from roster
  let totalSalary = 0;
  let guaranteedSalary = 0;
  let nonGuaranteedSalary = 0;

  if (teamData.players && Array.isArray(teamData.players)) {
    teamData.players.forEach((player) => {
      if (player.contract?.salariesByYear) {
        // Sum current season salary
        const currentSeason = teamData.season || '2025-26';
        const currentYear = toEndYear(currentSeason);

        player.contract.salariesByYear.forEach((yearData) => {
          const year = toEndYear(yearData.season);
          if (year === currentYear) {
            const salary = yearData.salary || 0;
            totalSalary += salary;

            if (yearData.guaranteed) {
              guaranteedSalary += salary;
            } else {
              nonGuaranteedSalary += salary;
            }
          }
        });
      }
    });
  }

  // Add dead cap
  let deadCapTotal = 0;
  if (teamData.deadCap && Array.isArray(teamData.deadCap)) {
    const currentSeason = teamData.season || '2025-26';
    teamData.deadCap.forEach((deadCapItem) => {
      if (deadCapItem.amountByYear) {
        deadCapItem.amountByYear.forEach((yearData) => {
          if (yearData.season === currentSeason) {
            deadCapTotal += yearData.amount || 0;
          }
        });
      }
    });
  }

  // Add cap holds
  let capHoldsTotal = 0;
  if (teamData.capHolds && Array.isArray(teamData.capHolds)) {
    teamData.capHolds.forEach((hold) => {
      capHoldsTotal += hold.amount || 0;
    });
  }

  const totalCapHit = totalSalary + deadCapTotal + capHoldsTotal;

  // Update totals
  return {
    ...totals,
    totalSalary,
    capHit: totalCapHit,
    guaranteedSalary,
    nonGuaranteedSalary,
    rosterCount: teamData.roster?.length || 0,
    deadCapTotal,
    capHoldsTotal,
  };
}
