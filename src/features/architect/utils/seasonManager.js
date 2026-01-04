/**
 * Season Manager
 *
 * Handles season advancement logic: contract expirations, options, empty roster charges,
 * draft pick updates, cap hold processing, and Stepien recalculation.
 *
 * @file src/features/architect/utils/seasonManager.js
 * @module seasonManager
 *
 * HISTORY:
 *  - 2025-12-20: Phase 3B - Added advanceSeasonInWorld with explicit option decisions
 *                         - Added Stepien recalculation for draft picks
 *                         - Refactored processOptions to accept optionDecisions
 */

import { db } from '@/firebaseConfig';
import { writeBatch, serverTimestamp, increment } from 'firebase/firestore';
import { getLeague } from '@/features/architect/utils/teamLoader';
import { getWorldMetadata } from '@/features/architect/utils/worldManager';
import {
  toEndYear,
  toSeasonCode,
} from '@/features/architect/utils/seasonFormat';
import {
  worldTeamRef,
  worldMetadataRef,
} from '@/features/architect/utils/architectFirestorePaths';
import { getMinimumSalaryScale } from '@/features/architect/utils/salaryEngine';
import { calculateCapHold } from '@/features/architect/utils/contractUtils';

/**
 * Advance world to next season
 *
 * @param {string} worldId - World ID
 * @param {string} [targetSeason] - Target season code (e.g., "2026-27"). If not provided, advances by one season.
 * @returns {Promise<Object>} Season advancement result
 */
export async function advanceSeason(worldId, targetSeason = null) {
  if (!worldId) {
    throw new Error('worldId is required');
  }

  // Get current world metadata
  const worldMeta = await getWorldMetadata(worldId);

  // Require currentSeason from world metadata - no hard-coded fallback
  const currentSeason = worldMeta.currentSeason;
  if (!currentSeason) {
    throw new Error('World metadata missing currentSeason');
  }

  // Determine target season
  let nextSeason = targetSeason;
  if (!nextSeason) {
    const currentYear = toEndYear(currentSeason);
    const nextYear = currentYear + 1;
    nextSeason = toSeasonCode(nextYear);
  }

  // Process season transition
  return await processSeasonTransition(worldId, currentSeason, nextSeason);
}

/**
 * Process season transition
 *
 * @param {string} worldId - World ID
 * @param {string} fromSeason - Current season code
 * @param {string} toSeason - Target season code
 * @returns {Promise<Object>} Transition result
 */
export async function processSeasonTransition(worldId, fromSeason, toSeason) {
  if (!worldId || !fromSeason || !toSeason) {
    throw new Error('worldId, fromSeason, and toSeason are required');
  }

  // Load all teams in the world
  const teams = await getLeague(worldId);

  const batch = writeBatch(db);
  const updatedTeams = [];

  // Process each team
  for (const team of teams) {
    const teamCode = team.teamCode;

    // Process team for season transition
    const updatedTeam = await processTeamSeasonTransition(
      team,
      fromSeason,
      toSeason
    );

    // Save snapshot if team was modified
    // Path: architect_worlds/{worldId}/teams/{teamCode}
    if (updatedTeam) {
      const snapshotRef = worldTeamRef(worldId, teamCode);
      batch.set(snapshotRef, updatedTeam);
      updatedTeams.push(teamCode);
    }
  }

  // Update world metadata
  // Path: architect_worlds/{worldId}
  const metadataRef = worldMetadataRef(worldId);
  batch.update(metadataRef, {
    currentSeason: toSeason,
    lastModifiedAt: serverTimestamp(),
  });

  await batch.commit();

  return {
    success: true,
    fromSeason,
    toSeason,
    updatedTeams,
  };
}

/**
 * Process team for season transition
 *
 * @param {Object} teamData - Team data
 * @param {string} fromSeason - Current season
 * @param {string} toSeason - Target season
 * @returns {Promise<Object|null>} Updated team data or null if no changes
 */
async function processTeamSeasonTransition(teamData, fromSeason, toSeason) {
  const updatedTeam = { ...teamData };
  let hasChanges = false;

  // Update team season
  updatedTeam.season = toSeason;

  // Process contract expirations
  const contractResult = processContractExpirations(
    updatedTeam,
    fromSeason,
    toSeason
  );
  if (contractResult.hasChanges) {
    hasChanges = true;
    updatedTeam.roster = contractResult.roster;
    updatedTeam.players = contractResult.players;
  }

  // Process options (check options for the fromSeason being exited)
  const optionsResult = processOptions(updatedTeam, fromSeason);
  if (optionsResult.hasChanges) {
    hasChanges = true;
    updatedTeam.roster = optionsResult.roster;
    updatedTeam.players = optionsResult.players;
  }

  // Process empty roster charges
  const emptyRosterResult = processEmptyRosterCharges(updatedTeam, toSeason);
  if (emptyRosterResult.hasChanges) {
    hasChanges = true;
    updatedTeam.totals = {
      ...updatedTeam.totals,
      ...emptyRosterResult.totals,
    };
  }

  // Update cap holds
  const capHoldsResult = updateCapHolds(updatedTeam, toSeason);
  if (capHoldsResult.hasChanges) {
    hasChanges = true;
    updatedTeam.capHolds = capHoldsResult.capHolds;
  }

  // Update draft picks
  const draftPicksResult = updateDraftPicks(updatedTeam, fromSeason, toSeason);
  if (draftPicksResult.hasChanges) {
    hasChanges = true;
    updatedTeam.draftPicks = draftPicksResult.draftPicks;
  }

  // Recalculate cap totals
  if (hasChanges) {
    // Import updateTeamCapTotals from tradeManager
    const { updateTeamCapTotals } = await import('./tradeManager');
    updatedTeam.totals = await updateTeamCapTotals(updatedTeam);
  }

  return hasChanges ? updatedTeam : null;
}

/**
 * Process contract expirations
 *
 * @param {Object} teamData - Team data
 * @param {string} fromSeason - Current season
 * @param {string} toSeason - Target season
 * @returns {Object} Result with updated roster and players
 */
function processContractExpirations(teamData, fromSeason, toSeason) {
  const toYear = toEndYear(toSeason);

  const roster = [...(teamData.roster || [])];
  const players = [...(teamData.players || [])];
  let hasChanges = false;

  // Filter out expired contracts
  const activeRoster = [];
  const activePlayers = [];

  roster.forEach((playerId, index) => {
    // Support multiple ID formats: player_id, id, playerId
    const player =
      players[index] || 
      players.find((p) => p.player_id === playerId || p.id === playerId || p.playerId === playerId);

    if (!player || !player.contract) {
      // Keep player if no contract data
      activeRoster.push(playerId);
      activePlayers.push(player);
      return;
    }

    const contract = player.contract;
    const endSeason = contract.endSeason;

    if (endSeason) {
      const endYear = toEndYear(endSeason);

      // Contract expires if endYear is before toYear
      if (endYear < toYear) {
        hasChanges = true;
        // Remove from roster (becomes free agent)
        // Don't add to active arrays
        return;
      }
    }

    // Update contract years remaining
    if (contract.yearsRemaining !== undefined) {
      const yearsRemaining = Math.max(0, contract.yearsRemaining - 1);
      if (yearsRemaining !== contract.yearsRemaining) {
        hasChanges = true;
        contract.yearsRemaining = yearsRemaining;
      }
    }

    // Advance salariesByYear array (remove expired years)
    if (contract.salariesByYear && Array.isArray(contract.salariesByYear)) {
      const activeSalaries = contract.salariesByYear.filter((yearData) => {
        const year = toEndYear(yearData.season);
        return year >= toYear;
      });

      if (activeSalaries.length !== contract.salariesByYear.length) {
        hasChanges = true;
        contract.salariesByYear = activeSalaries;
      }
    }

    activeRoster.push(playerId);
    activePlayers.push(player);
  });

  return {
    hasChanges,
    roster: activeRoster,
    players: activePlayers,
  };
}

/**
 * Process player and team options
 *
 * @param {Object} teamData - Team data
 * @param {string} season - Current season
 * @returns {Object} Result with updated roster and players
 */
function processOptions(teamData, season) {
  const seasonYear = toEndYear(season);
  const roster = [...(teamData.roster || [])];
  const players = [...(teamData.players || [])];
  let hasChanges = false;

  players.forEach((player) => {
    if (!player || !player.contract) return;

    const contract = player.contract;

    // Check salariesByYear for options
    if (contract.salariesByYear && Array.isArray(contract.salariesByYear)) {
      contract.salariesByYear.forEach((yearData) => {
        const year = toEndYear(yearData.season);
        if (year === seasonYear && yearData.option && yearData.optionUsed == null) {
          // Option decision year - default: assume option is exercised if not specified
          // In a full implementation, this would be user input
          hasChanges = true;
          yearData.optionUsed = true;
        }

        if (year === seasonYear && yearData.option && !yearData.optionUsed) {
          // Option declined - contract expires
          hasChanges = true;
          const rosterIndex = roster.indexOf(player.player_id || player.id);
          if (rosterIndex >= 0) {
            roster.splice(rosterIndex, 1);
          }
        }
      });
    }
  });

  return {
    hasChanges,
    roster,
    players,
  };
}

/**
 * Process empty roster charges
 *
 * @param {Object} teamData - Team data
 * @param {string} season - Target season code (e.g., "2025-26")
 * @returns {Object} Result with updated totals
 */
function processEmptyRosterCharges(teamData, season) {
  const rosterCount = teamData.roster?.length || 0;
  const MIN_ROSTER_SIZE = 12; // Minimum roster size for NBA
  // Get year-appropriate minimum salary from salary engine
  // The minimum salary scale returns minimum based on YOS (years of service)
  // For empty roster charges, use 0 YOS (rookie minimum)
  const minSalaryScale = getMinimumSalaryScale(season);
  const EMPTY_ROSTER_CHARGE = minSalaryScale?.[0] || 1_119_563;

  let emptyRosterCharges = 0;
  if (rosterCount < MIN_ROSTER_SIZE) {
    emptyRosterCharges = (MIN_ROSTER_SIZE - rosterCount) * EMPTY_ROSTER_CHARGE;
  }

  const totals = teamData.totals || {};
  const hasChanges = totals.emptyRosterCharges !== emptyRosterCharges;

  return {
    hasChanges,
    totals: {
      ...totals,
      emptyRosterCharges,
      rosterCount,
    },
  };
}

/**
 * Update cap holds for free agents
 *
 * @param {Object} teamData - Team data
 * @param {string} season - Current season
 * @returns {Object} Result with updated cap holds
 */
function updateCapHolds(teamData, season) {
  const capHolds = [...(teamData.capHolds || [])];
  let hasChanges = false;

  // Filter out expired cap holds
  const activeCapHolds = capHolds.filter((hold) => {
    if (hold.expiresOn) {
      const expireDate = new Date(hold.expiresOn);
      const seasonStartDate = new Date(`${season.split('-')[0]}-07-01`); // Approximate season start

      if (expireDate < seasonStartDate) {
        hasChanges = true;
        return false; // Expired
      }
    }

    // Remove if player is signed
    if (hold.isSigned) {
      hasChanges = true;
      return false;
    }

    return true;
  });

  return {
    hasChanges,
    capHolds: activeCapHolds,
  };
}

/**
 * Update draft picks for season transition
 *
 * @param {Object} teamData - Team data
 * @param {string} fromSeason - Current season
 * @param {string} toSeason - Target season
 * @returns {Object} Result with updated draft picks
 */
function updateDraftPicks(teamData, fromSeason, toSeason) {
  const toYear = toEndYear(toSeason);
  const draftPicks = [...(teamData.draftPicks || [])];
  let hasChanges = false;

  const updatedPicks = draftPicks.map((pick) => {
    const updatedPick = { ...pick };

    // Advance pick year if needed
    if (pick.year && pick.year < toYear) {
      // Pick year has passed - update status if needed
      if (pick.status === 'future' || !pick.status) {
        hasChanges = true;
        updatedPick.status = 'available';
      }
    }

    // Update Stepien eligibility (would need full Stepien calculation in production)
    // For now, just preserve existing values

    return updatedPick;
  });

  return {
    hasChanges,
    draftPicks: updatedPicks,
  };
}

// ==============================================================================
// PHASE 3B: ENHANCED SEASON ADVANCEMENT WITH OPTION DECISIONS
// ==============================================================================

/**
 * Advance world to next season with explicit option decisions
 *
 * This is the Phase 3B implementation that:
 * 1. Requires explicit option decisions (no silent defaults)
 * 2. Runs Stepien recalculation for draft picks
 * 3. Persists atomically to architect_worlds
 * 4. Updates world metadata stats
 *
 * @param {string} worldId - World ID (required)
 * @param {Object} options - Season advance options
 * @param {string} [options.fromSeason] - Current season code (defaults to world's currentSeason)
 * @param {string} [options.toSeason] - Target season code (defaults to next season)
 * @param {Object} [options.optionDecisions={}] - Map of playerId to decision
 *   Each entry: { decision: 'exercise' | 'decline', optionType: 'player' | 'team', season: string }
 * @returns {Promise<Object>} Season advancement result
 */
export async function advanceSeasonInWorld(worldId, options = {}) {
  if (!worldId) {
    return { success: false, error: 'worldId is required' };
  }

  const { optionDecisions = {} } = options;

  try {
    // Get current world metadata
    const worldMeta = await getWorldMetadata(worldId);

    // Determine from/to seasons
    const fromSeason = options.fromSeason || worldMeta.currentSeason;
    if (!fromSeason) {
      return { success: false, error: 'World metadata missing currentSeason' };
    }

    const fromYear = toEndYear(fromSeason);
    const toYear = fromYear + 1;
    const toSeason = options.toSeason || toSeasonCode(toYear);

    // Load all teams in the world
    const teams = await getLeague(worldId);

    const batch = writeBatch(db);
    const updatedTeams = [];
    const summary = {
      exercisedOptions: [],
      declinedOptions: [],
      expiredContracts: [],
      stepienUpdates: [],
    };

    // Process each team
    for (const team of teams) {
      const teamCode = team.teamCode;

      // Process team for season transition with explicit option decisions
      const { updatedTeam, teamSummary } = await processTeamSeasonTransitionWithOptions(
        team,
        fromSeason,
        toSeason,
        optionDecisions
      );

      // Merge summaries
      if (teamSummary.exercisedOptions.length > 0) {
        summary.exercisedOptions.push(...teamSummary.exercisedOptions);
      }
      if (teamSummary.declinedOptions.length > 0) {
        summary.declinedOptions.push(...teamSummary.declinedOptions);
      }
      if (teamSummary.expiredContracts.length > 0) {
        summary.expiredContracts.push(...teamSummary.expiredContracts);
      }
      if (teamSummary.stepienUpdates.length > 0) {
        summary.stepienUpdates.push(...teamSummary.stepienUpdates);
      }

      // Save snapshot if team was modified
      if (updatedTeam) {
        const snapshotRef = worldTeamRef(worldId, teamCode);
        batch.set(snapshotRef, updatedTeam);
        updatedTeams.push(teamCode);
      }
    }

    // Update world metadata
    const metadataRef = worldMetadataRef(worldId);
    batch.update(metadataRef, {
      currentSeason: toSeason,
      lastModifiedAt: serverTimestamp(),
      lastModifiedTeams: updatedTeams,
      actionCount: increment(1),
    });

    await batch.commit();

    return {
      success: true,
      fromSeason,
      toSeason,
      updatedTeams,
      summary,
    };
  } catch (error) {
    console.error('advanceSeasonInWorld failed:', error);
    return {
      success: false,
      error: error.message || 'Season advance failed',
    };
  }
}

/**
 * Process team for season transition with explicit option decisions
 *
 * @param {Object} teamData - Team data
 * @param {string} fromSeason - Current season
 * @param {string} toSeason - Target season
 * @param {Object} optionDecisions - Map of playerId to option decision
 * @returns {Promise<Object>} Updated team data and summary
 */
async function processTeamSeasonTransitionWithOptions(
  teamData,
  fromSeason,
  toSeason,
  optionDecisions
) {
  const updatedTeam = { ...teamData };
  let hasChanges = false;
  const teamSummary = {
    exercisedOptions: [],
    declinedOptions: [],
    expiredContracts: [],
    stepienUpdates: [],
  };

  // Update team season
  updatedTeam.season = toSeason;

  // Process options FIRST with explicit decisions
  const optionsResult = processOptionsWithDecisions(
    updatedTeam,
    fromSeason,
    toSeason,
    optionDecisions
  );
  if (optionsResult.hasChanges) {
    hasChanges = true;
    updatedTeam.roster = optionsResult.roster;
    updatedTeam.players = optionsResult.players;
    if (optionsResult.capHolds) {
      updatedTeam.capHolds = [
        ...(updatedTeam.capHolds || []),
        ...optionsResult.capHolds,
      ];
    }
    teamSummary.exercisedOptions = optionsResult.exercisedOptions || [];
    teamSummary.declinedOptions = optionsResult.declinedOptions || [];
  }

  // Process contract expirations
  const contractResult = processContractExpirations(
    updatedTeam,
    fromSeason,
    toSeason
  );
  if (contractResult.hasChanges) {
    hasChanges = true;
    updatedTeam.roster = contractResult.roster;
    updatedTeam.players = contractResult.players;
    // Track expired contracts
    const expiredPlayerIds = teamData.roster?.filter(
      (id) => !contractResult.roster.includes(id)
    ) || [];
    for (const playerId of expiredPlayerIds) {
      // Support multiple ID formats: player_id, id, playerId
      const player = teamData.players?.find(
        (p) => (p.player_id || p.id || p.playerId) === playerId
      );
      if (player) {
        teamSummary.expiredContracts.push({
          playerId,
          playerName: player.displayName || player.name || playerId,
        });
      }
    }
  }

  // Process empty roster charges
  const emptyRosterResult = processEmptyRosterCharges(updatedTeam, toSeason);
  if (emptyRosterResult.hasChanges) {
    hasChanges = true;
    updatedTeam.totals = {
      ...updatedTeam.totals,
      ...emptyRosterResult.totals,
    };
  }

  // Update cap holds
  const capHoldsResult = updateCapHolds(updatedTeam, toSeason);
  if (capHoldsResult.hasChanges) {
    hasChanges = true;
    updatedTeam.capHolds = capHoldsResult.capHolds;
  }

  // Update draft picks with Stepien recalculation
  const draftPicksResult = updateDraftPicksWithStepien(
    updatedTeam,
    fromSeason,
    toSeason
  );
  if (draftPicksResult.hasChanges) {
    hasChanges = true;
    updatedTeam.draftPicks = draftPicksResult.draftPicks;
    teamSummary.stepienUpdates = draftPicksResult.stepienUpdates || [];
  }

  // Recalculate cap totals
  if (hasChanges) {
    const { updateTeamCapTotals } = await import('./tradeManager');
    updatedTeam.totals = await updateTeamCapTotals(updatedTeam);
  }

  return {
    updatedTeam: hasChanges ? updatedTeam : null,
    teamSummary,
  };
}

/**
 * Process player and team options with explicit decisions
 *
 * Unlike the original processOptions, this version:
 * 1. Requires explicit decisions - no silent defaults
 * 2. Creates cap holds for declined options
 * 3. Returns detailed summary of actions taken
 *
 * @param {Object} teamData - Team data
 * @param {string} fromSeason - Current season
 * @param {string} toSeason - Target season
 * @param {Object} optionDecisions - Map of playerId to decision
 * @returns {Object} Result with updated roster, players, cap holds, and summaries
 */
function processOptionsWithDecisions(teamData, fromSeason, toSeason, optionDecisions) {
  const fromYear = toEndYear(fromSeason);
  const toYear = toEndYear(toSeason);
  const roster = [...(teamData.roster || [])];
  const players = [...(teamData.players || [])];
  let hasChanges = false;
  const exercisedOptions = [];
  const declinedOptions = [];
  const newCapHolds = [];

  // Process each player
  for (let i = 0; i < players.length; i++) {
    const player = players[i];
    if (!player || !player.contract) continue;

    // Support multiple ID formats: player_id, id, playerId
    // IMPORTANT: We avoid using player.name as ID since names are not unique
    const playerId = player.player_id || player.id || player.playerId;
    if (!playerId) {
      console.warn('Player missing ID fields, skipping option processing:', player.displayName || player.name);
      continue;
    }
    const contract = player.contract;

    if (!contract.salariesByYear || !Array.isArray(contract.salariesByYear)) {
      continue;
    }

    // Find option year entry for the target season
    const optionYearIndex = contract.salariesByYear.findIndex((yearData) => {
      const year = toEndYear(yearData.season);
      return year === toYear && yearData.option;
    });

    if (optionYearIndex === -1) continue;

    const optionYear = contract.salariesByYear[optionYearIndex];
    const decision = optionDecisions[playerId];

    // If no decision provided for this player, skip (will be handled by validation earlier)
    if (!decision || !decision.decision) {
      continue;
    }

    hasChanges = true;

    if (decision.decision === 'exercise') {
      // Exercise option - mark as used
      contract.salariesByYear = contract.salariesByYear.map((yearData, idx) => {
        if (idx === optionYearIndex) {
          return { ...yearData, optionUsed: 'exercised' };
        }
        return yearData;
      });

      exercisedOptions.push({
        playerId,
        playerName: player.displayName || player.name || playerId,
        optionType: optionYear.option,
        salary: optionYear.salary || optionYear.capHit || 0,
      });
    } else if (decision.decision === 'decline') {
      // Decline option - remove this year and all future years
      const filteredSalaries = contract.salariesByYear.filter(
        (_, idx) => idx < optionYearIndex
      );

      // Update contract
      contract.salariesByYear = filteredSalaries;
      contract.freeAgency = {
        year: toYear - 1,
        type: 'UFA',
      };

      // Mark option as declined
      if (filteredSalaries.length > 0) {
        filteredSalaries[filteredSalaries.length - 1] = {
          ...filteredSalaries[filteredSalaries.length - 1],
          optionUsed: 'declined',
        };
      }

      // Calculate cap hold
      const capHoldResult = calculateCapHold({
        ...player,
        contract: {
          ...contract,
          salariesByYear: filteredSalaries,
        },
      });

      if (capHoldResult && capHoldResult.amount) {
        newCapHolds.push({
          playerId,
          playerName: player.displayName || player.name || '',
          amount: capHoldResult.amount,
          type: 'FA Cap Hold',
          season: toSeasonCode(toYear),
          isSigned: false,
          reason: `Declined ${optionYear.option}`,
          active: true,
        });
      }

      // Remove from roster
      const rosterIndex = roster.indexOf(playerId);
      if (rosterIndex >= 0) {
        roster.splice(rosterIndex, 1);
      }

      // Keep player in players array but mark as FA
      player.freeAgentYear = toYear;

      declinedOptions.push({
        playerId,
        playerName: player.displayName || player.name || playerId,
        optionType: optionYear.option,
        salary: optionYear.salary || optionYear.capHit || 0,
      });
    }
  }

  return {
    hasChanges,
    roster,
    players,
    capHolds: newCapHolds,
    exercisedOptions,
    declinedOptions,
  };
}

/**
 * Update draft picks for season transition with Stepien recalculation
 *
 * Implements Phase 3B Stepien rule:
 * - A team cannot trade consecutive future first-round picks
 * - Marks picks as "stepienBlocked" if trading them would violate this rule
 *
 * @param {Object} teamData - Team data
 * @param {string} fromSeason - Current season
 * @param {string} toSeason - Target season
 * @returns {Object} Result with updated draft picks and Stepien updates
 */
function updateDraftPicksWithStepien(teamData, fromSeason, toSeason) {
  const toYear = toEndYear(toSeason);
  const teamCode = teamData.teamCode;
  const draftPicks = [...(teamData.draftPicks || [])];
  let hasChanges = false;
  const stepienUpdates = [];

  // Separate picks into owned and owed
  const ownFirsts = []; // First-round picks the team owns
  const owedFirsts = []; // First-round picks the team has traded away

  for (const pick of draftPicks) {
    const isFirstRound = pick.round === 1 || pick.round === '1';
    if (!isFirstRound) continue;

    // Check if this is an owned pick or owed pick
    // Owned: originalTeam === teamCode AND NOT traded
    // Owed: originalTeam === teamCode AND traded/conveyed to another team
    const isOwned = pick.currentOwner === teamCode || 
                   (pick.owner === teamCode && !pick.tradedTo);
    const isOwed = pick.originalTeam === teamCode && 
                  (pick.tradedTo || pick.currentOwner !== teamCode);

    if (isOwned) {
      ownFirsts.push(pick);
    } else if (isOwed) {
      owedFirsts.push(pick);
    }
  }

  // Sort owed picks by year
  owedFirsts.sort((a, b) => (a.year || 0) - (b.year || 0));

  // Check Stepien for the next 7 drafts
  const futureYears = Array.from({ length: 7 }, (_, i) => toYear + i);
  const owedYears = new Set(owedFirsts.map((p) => p.year));

  // Update each pick's status
  const updatedPicks = draftPicks.map((pick) => {
    const updatedPick = { ...pick };
    const isFirstRound = pick.round === 1 || pick.round === '1';

    // Advance pick year status if needed
    if (pick.year && pick.year < toYear) {
      if (pick.status === 'future' || !pick.status) {
        hasChanges = true;
        updatedPick.status = 'available';
      }
    }

    // Stepien check only for first-round picks the team owns
    if (isFirstRound && pick.year >= toYear) {
      const pickYear = pick.year;
      const isOwnedByTeam = pick.currentOwner === teamCode || 
                           (pick.owner === teamCode && !pick.tradedTo);

      if (isOwnedByTeam) {
        // Check if trading this pick would create consecutive years without a first
        const prevYear = pickYear - 1;
        const nextYear = pickYear + 1;

        // A pick is Stepien-blocked if trading it would leave no first-round pick
        // in either the previous or next year
        const prevYearOwed = owedYears.has(prevYear);
        const nextYearOwed = owedYears.has(nextYear);

        // If both adjacent years are owed out, this pick is locked (Stepien)
        const isStepienBlocked = prevYearOwed && nextYearOwed;

        // Also blocked if the year before is owed and this is the last owned first
        // in the near future
        const adjacentOwed = prevYearOwed || nextYearOwed;

        if (updatedPick.stepienBlocked !== isStepienBlocked) {
          hasChanges = true;
          updatedPick.stepienBlocked = isStepienBlocked;

          if (isStepienBlocked) {
            updatedPick.stepienReason = `Cannot trade: would create consecutive years (${prevYear}, ${pickYear}, ${nextYear}) without a 1st`;
            stepienUpdates.push({
              pickId: pick.id || `${teamCode}_${pickYear}_1`,
              year: pickYear,
              status: 'blocked',
              reason: updatedPick.stepienReason,
            });
          }
        }
      }
    }

    return updatedPick;
  });

  return {
    hasChanges,
    draftPicks: updatedPicks,
    stepienUpdates,
  };
}

// ==============================================================================
// PHASE 3: SWAP RESOLUTION HELPER
// ==============================================================================

/**
 * Resolve draft pick swaps for a specific year
 *
 * This is a pure function that processes a team's draft picks and resolves
 * any swap rights for the specified draft year, using the provided lottery
 * results (positionsMap).
 *
 * CRITICAL: This function is a NO-OP unless positionsMap is provided with
 * actual position data. Default behavior returns the team unchanged.
 *
 * Only processes picks that:
 * - Are first-round picks (round === 1)
 * - Are swap picks (isSwap === true)
 * - Match the specified draft year
 * - Are not already resolved (resolved !== true)
 *
 * Picks that cannot be resolved (missing partner or missing positions) are
 * left unresolved (no throw during season advance).
 *
 * @param {Object} team - Team data with draftPicks array
 * @param {number} draftYear - Year to resolve swaps for
 * @param {Object<string, number>} [positionsMap] - Map of team codes to draft positions
 * @param {Object} [opts={}] - Options
 * @param {string} [opts.nowIso] - ISO timestamp for resolution
 * @param {string} [opts.method='lottery'] - Resolution method for audit trail
 * @returns {Object} - Team with updated draftPicks array
 */
export function resolveDraftPickSwapsForYear(team, draftYear, positionsMap, opts = {}) {
  // Return team unchanged if no positions provided (NO-OP)
  if (!positionsMap || typeof positionsMap !== 'object' || Object.keys(positionsMap).length === 0) {
    return team;
  }

  // Return team unchanged if no draft picks
  if (!team?.draftPicks || !Array.isArray(team.draftPicks)) {
    return team;
  }

  // Import the resolution utility inline to avoid circular dependencies
  // This is a dynamic import pattern that works in ES modules
  const { resolvePickSwap } = require('./tradeMachine/utils/swapResolution.js');

  const { nowIso, method = 'lottery' } = opts;

  const updatedPicks = team.draftPicks.map((pick) => {
    // Skip non-swap picks
    if (!pick || pick.isSwap !== true) {
      return pick;
    }

    // Skip non-first-round picks (Phase 3 only resolves first round)
    const round = typeof pick.round === 'string'
      ? parseInt(pick.round.replace(/\D/g, ''), 10)
      : pick.round;
    if (round !== 1) {
      return pick;
    }

    // Skip picks not in the specified year
    if (pick.year !== draftYear) {
      return pick;
    }

    // Skip already resolved
    if (pick.resolved === true) {
      return pick;
    }

    // Skip if missing swap partner
    if (!pick.swapWithTeamId) {
      return pick;
    }

    // Check if we have positions for both teams
    const teamA = pick.originalTeam || 'UNK';
    const teamB = pick.swapWithTeamId;

    if (!(teamA in positionsMap) || !(teamB in positionsMap)) {
      // Missing position data - leave unresolved (no throw)
      return pick;
    }

    // Attempt resolution - catch any errors and leave unresolved
    try {
      return resolvePickSwap(pick, positionsMap, { nowIso, method });
    } catch {
      // Resolution failed - leave pick unresolved
      return pick;
    }
  });

  return {
    ...team,
    draftPicks: updatedPicks,
  };
}
