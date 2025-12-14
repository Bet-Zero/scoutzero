/**
 * Season Manager
 *
 * Handles season advancement logic: contract expirations, options, empty roster charges,
 * draft pick updates, and cap hold processing.
 *
 * @file src/features/architect/utils/seasonManager.js
 * @module seasonManager
 */

import { db } from '@/firebaseConfig';
import { writeBatch, serverTimestamp } from 'firebase/firestore';
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

  // Process options
  const optionsResult = processOptions(updatedTeam, toSeason);
  if (optionsResult.hasChanges) {
    hasChanges = true;
    updatedTeam.roster = optionsResult.roster;
    updatedTeam.players = optionsResult.players;
  }

  // Process empty roster charges
  const emptyRosterResult = processEmptyRosterCharges(updatedTeam);
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
    const player =
      players[index] || players.find((p) => p.player_id === playerId);

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
        const year = yearData.year;
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
 * @returns {Object} Result with updated totals
 */
function processEmptyRosterCharges(teamData) {
  const rosterCount = teamData.roster?.length || 0;
  const MIN_ROSTER_SIZE = 12; // Minimum roster size for NBA
  const EMPTY_ROSTER_CHARGE = 1_119_563; // Minimum salary for 2025-26

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
