/**
 * Team Data Loader with Fallback Chain
 *
 * Implements the fallback chain pattern: world snapshot → parent world → base
 * This enables efficient storage by only snapshotting modified teams.
 *
 * @file src/utils/architect/teamLoader.js
 * @module teamLoader
 */

import { getDoc, getDocs } from 'firebase/firestore';
import { getWorldMetadata } from '@/features/architect/utils/worldManager';
import { hydrateBaseTeam } from '@/features/architect/utils/firebaseTeamPlanHelpers';
import {
  baseTeamRef,
  basePlayerRef,
  worldTeamRef,
  worldTeamsCol,
  worldPlayerRef,
} from '@/features/architect/utils/architectFirestorePaths';

/**
 * Get team data with fallback chain
 *
 * Fallback order:
 * 1. World snapshot (if worldId provided)
 * 2. Parent world snapshot (recursive)
 * 3. Base team (architect_baseTeams)
 *
 * @param {string|null} worldId - World ID (null for base only)
 * @param {string} teamCode - Team code (e.g., "LAL")
 * @returns {Promise<Object>} Team data
 */
export async function getTeam(worldId, teamCode) {
  if (!teamCode) {
    throw new Error('teamCode is required');
  }

  // Base mode: No world selected, return base team directly
  if (!worldId) {
    return await getBaseTeam(teamCode);
  }

  // Try world snapshot first
  // Path: architect_worlds/{worldId}/teams/{teamCode}
  const worldSnapshotRef = worldTeamRef(worldId, teamCode);
  const worldSnapshotSnap = await getDoc(worldSnapshotRef);

  if (worldSnapshotSnap.exists()) {
    const snapshotData = worldSnapshotSnap.data();
    // Hydrate roster from base players if needed
    return await hydrateTeamFromSnapshot(snapshotData, teamCode);
  }

  // Try parent world (recursive)
  try {
    const worldMeta = await getWorldMetadata(worldId);
    if (worldMeta.parentWorldId) {
      const parentTeam = await getTeam(worldMeta.parentWorldId, teamCode);
      if (parentTeam) {
        return parentTeam;
      }
    }
  } catch (error) {
    // If parent lookup fails, continue to base fallback
    console.warn(`Failed to load parent world for ${worldId}:`, error);
  }

  // Fall back to base
  return await getBaseTeam(teamCode);
}

/**
 * Get base team (no world context)
 *
 * @param {string} teamCode - Team code
 * @returns {Promise<Object>} Base team data
 */
async function getBaseTeam(teamCode) {
  const baseTeamSnap = await getDoc(baseTeamRef(teamCode));

  if (!baseTeamSnap.exists()) {
    throw new Error(`Base team ${teamCode} not found`);
  }

  const baseDoc = baseTeamSnap.data();
  return await hydrateBaseTeam(teamCode, baseDoc);
}

/**
 * Hydrate team from snapshot data
 * Ensures roster is properly hydrated from base players
 *
 * @param {Object} snapshotData - Snapshot team data
 * @param {string} teamCode - Team code
 * @returns {Promise<Object>} Hydrated team data
 */
async function hydrateTeamFromSnapshot(snapshotData, teamCode) {
  // If snapshot already has hydrated roster, return as-is
  if (snapshotData.players && snapshotData.players.length > 0) {
    return snapshotData;
  }

  // Otherwise, hydrate from base players
  return await hydrateBaseTeam(teamCode, snapshotData);
}

/**
 * Get all 30 teams for league view
 * Optimized: Batch read world snapshots first, then fill gaps from base
 *
 * @param {string|null} worldId - World ID (null for base only)
 * @returns {Promise<Array<Object>>} Array of all 30 teams
 */
export async function getLeague(worldId) {
  const TEAM_CODES = [
    'ATL',
    'BOS',
    'BKN',
    'CHA',
    'CHI',
    'CLE',
    'DAL',
    'DEN',
    'DET',
    'GSW',
    'HOU',
    'IND',
    'LAC',
    'LAL',
    'MEM',
    'MIA',
    'MIL',
    'MIN',
    'NOP',
    'NYK',
    'OKC',
    'ORL',
    'PHI',
    'PHX',
    'POR',
    'SAC',
    'SAS',
    'TOR',
    'UTA',
    'WAS',
  ];

  // Base mode: Read all from baseTeams
  if (!worldId) {
    return await Promise.all(TEAM_CODES.map((code) => getBaseTeam(code)));
  }

  // World mode: Batch read all world snapshots first
  // Path: architect_worlds/{worldId}/teams
  const snapshotCollectionRef = worldTeamsCol(worldId);
  const snapshotQuery = await getDocs(snapshotCollectionRef);

  const snapshotMap = new Map();
  snapshotQuery.docs.forEach((docSnap) => {
    snapshotMap.set(docSnap.id, docSnap.data());
  });

  // Get world metadata for parent lookup
  let parentWorldId = null;
  try {
    const worldMeta = await getWorldMetadata(worldId);
    parentWorldId = worldMeta.parentWorldId;
  } catch (error) {
    console.warn(`Failed to load world metadata for ${worldId}:`, error);
  }

  // Load all teams: use snapshot if available, otherwise try parent or base
  const teams = await Promise.all(
    TEAM_CODES.map(async (code) => {
      if (snapshotMap.has(code)) {
        const snapshotData = snapshotMap.get(code);
        return await hydrateTeamFromSnapshot(snapshotData, code);
      }

      // Try parent world
      if (parentWorldId) {
        try {
          const parentTeam = await getTeam(parentWorldId, code);
          if (parentTeam) {
            return parentTeam;
          }
        } catch {
          // Continue to base fallback
        }
      }

      // Fall back to base
      return await getBaseTeam(code);
    })
  );

  return teams;
}

/**
 * Get player data with overrides
 *
 * Player override path: architect_worlds/{worldId}/teams/{teamCode}/players/{playerId}
 *
 * @param {string|null} worldId - World ID (null for base only)
 * @param {string} teamCode - Team code
 * @param {string} playerId - Player ID
 * @returns {Promise<Object>} Player data (merged with overrides if any)
 */
export async function getPlayer(worldId, teamCode, playerId) {
  if (!teamCode || !playerId) {
    throw new Error('teamCode and playerId are required');
  }

  // Get base player
  const basePlayerSnap = await getDoc(basePlayerRef(playerId));
  if (!basePlayerSnap.exists()) {
    throw new Error(`Base player ${playerId} not found`);
  }
  const basePlayer = basePlayerSnap.data();

  // Base mode: No world, return base player
  if (!worldId) {
    return basePlayer;
  }

  // Try world-specific player override
  // Path: architect_worlds/{worldId}/teams/{teamCode}/players/{playerId}
  const playerOverrideRef = worldPlayerRef(worldId, teamCode, playerId);
  const playerOverrideSnap = await getDoc(playerOverrideRef);

  if (playerOverrideSnap.exists()) {
    const override = playerOverrideSnap.data();
    return mergePlayerOverride(basePlayer, override);
  }

  // Try parent world
  try {
    const worldMeta = await getWorldMetadata(worldId);
    if (worldMeta.parentWorldId) {
      const parentPlayer = await getPlayer(
        worldMeta.parentWorldId,
        teamCode,
        playerId
      );
      if (parentPlayer) {
        return parentPlayer;
      }
    }
  } catch {
    // Continue to base fallback
  }

  // Fall back to base
  return basePlayer;
}

/**
 * Merge player override data with base player
 *
 * @param {Object} basePlayer - Base player data
 * @param {Object} override - Override data (partial)
 * @returns {Object} Merged player data
 */
export function mergePlayerOverride(basePlayer, override) {
  if (!override) {
    return basePlayer;
  }

  // Deep merge: override takes precedence
  const merged = { ...basePlayer };

  // Merge contract if override has contract changes
  if (override.contract) {
    merged.contract = { ...basePlayer.contract, ...override.contract };

    // Merge salariesByYear array if present
    if (override.contract.salariesByYear) {
      merged.contract.salariesByYear = mergeSalariesByYear(
        basePlayer.contract?.salariesByYear || [],
        override.contract.salariesByYear
      );
    }
  }

  // Merge bio if override has bio changes
  if (override.bio) {
    merged.bio = { ...basePlayer.bio, ...override.bio };
  }

  // Merge other top-level fields
  Object.keys(override).forEach((key) => {
    if (key !== 'contract' && key !== 'bio') {
      merged[key] = override[key];
    }
  });

  return merged;
}

/**
 * Merge salariesByYear arrays
 * Override entries replace base entries for matching seasons
 *
 * @param {Array<Object>} baseSalaries - Base salariesByYear array
 * @param {Array<Object>} overrideSalaries - Override salariesByYear array
 * @returns {Array<Object>} Merged salariesByYear array
 */
function mergeSalariesByYear(baseSalaries, overrideSalaries) {
  if (!overrideSalaries || overrideSalaries.length === 0) {
    return baseSalaries;
  }

  const merged = [...baseSalaries];
  overrideSalaries.forEach((override) => {
    const idx = merged.findIndex((s) => s.season === override.season);
    if (idx >= 0) {
      // Replace existing entry
      merged[idx] = { ...merged[idx], ...override };
    } else {
      // Add new entry
      merged.push(override);
    }
  });

  // Sort by season
  return merged.sort((a, b) => {
    const aYear = parseInt(a.season.split('-')[0]);
    const bYear = parseInt(b.season.split('-')[0]);
    return aYear - bYear;
  });
}
