/**
 * FILE: src/features/architect/utils/leagueInvariants.ts
 * PURPOSE: League-wide invariant validation to ensure cross-team consistency.
 *          Prevents duplicate players across teams and validates league-level constraints.
 * OWNERSHIP: Feature: architect/core
 *
 * HISTORY:
 *  - 2026-02-03: Created per LEAGUE_INTEGRITY_COMPLETION_AUDIT blocking gap resolution
 *
 * LINKS:
 *  - Audit: docs/architect/LEAGUE_INTEGRITY_COMPLETION_AUDIT.md
 *  - Mutation Pipeline: src/features/architect/utils/mutationPipeline.js
 */

import { getLeague } from './teamLoader';

/**
 * Player location info for duplicate detection
 */
interface PlayerLocation {
  playerId: string;
  teamCode: string;
  playerName?: string;
}

/**
 * Result of league invariant validation
 */
export interface LeagueInvariantResult {
  valid: boolean;
  error?: string;
  duplicates?: Array<{
    playerId: string;
    teams: string[];
    playerName?: string;
  }>;
}

/**
 * Extract player ID from player object with fallback handling.
 * Handles inconsistent player object schemas across the codebase.
 */
function extractPlayerId(player: any): string | null {
  if (!player) return null;
  return (
    player.player_id ||
    player.id ||
    player.playerId ||
    player.bio?.playerId ||
    null
  );
}

/**
 * Extract player name from player object for error messages.
 */
function extractPlayerName(player: any): string | null {
  if (!player) return null;
  return (
    player.displayName ||
    player.name ||
    player.playerName ||
    player.bio?.displayName ||
    null
  );
}

/**
 * Collect all player IDs from a team's roster.
 * @param team - Team object with players array
 * @returns Array of player locations (playerId, teamCode, playerName)
 */
function collectPlayersFromTeam(team: any): PlayerLocation[] {
  const teamCode = team?.teamCode;
  if (!teamCode) return [];

  const players = team?.players || team?.roster || [];
  if (!Array.isArray(players)) return [];

  return players
    .map((player: any) => {
      const playerId = extractPlayerId(player);
      if (!playerId) return null;
      return {
        playerId,
        teamCode,
        playerName: extractPlayerName(player) || undefined,
      };
    })
    .filter(
      (loc: PlayerLocation | null): loc is PlayerLocation => loc !== null
    );
}

/**
 * Validate that no player exists on multiple teams in the league.
 * This is a critical league-wide invariant.
 *
 * @param teams - Array of all 30 teams in the world
 * @returns Validation result with duplicates if any found
 */
export function validateNoDuplicatePlayers(
  teams: any[]
): LeagueInvariantResult {
  const playerMap = new Map<string, { teams: string[]; playerName?: string }>();

  for (const team of teams) {
    const players = collectPlayersFromTeam(team);

    for (const { playerId, teamCode, playerName } of players) {
      const existing = playerMap.get(playerId);
      if (existing) {
        existing.teams.push(teamCode);
        // Keep the first name we found
      } else {
        playerMap.set(playerId, { teams: [teamCode], playerName });
      }
    }
  }

  // Find duplicates (players on more than one team)
  const duplicates: Array<{
    playerId: string;
    teams: string[];
    playerName?: string;
  }> = [];

  for (const [playerId, { teams, playerName }] of playerMap) {
    if (teams.length > 1) {
      duplicates.push({ playerId, teams, playerName });
    }
  }

  if (duplicates.length > 0) {
    const firstDupe = duplicates[0];
    const playerDesc = firstDupe.playerName
      ? `${firstDupe.playerName} (${firstDupe.playerId})`
      : firstDupe.playerId;
    const teamsDesc = firstDupe.teams.join(', ');

    return {
      valid: false,
      error: `Player ${playerDesc} exists on multiple teams: ${teamsDesc}. ${duplicates.length} duplicate(s) found.`,
      duplicates,
    };
  }

  return { valid: true };
}

/**
 * Validate that a specific player is not already on another team in the world.
 * Use this for targeted validation during mutations (more efficient than full league scan).
 *
 * @param worldId - World ID to check
 * @param playerId - Player ID being added
 * @param targetTeamCode - Team the player is being added to
 * @param playerName - Optional player name for error messages
 * @returns Validation result
 */
export async function assertPlayerNotOnOtherTeam(
  worldId: string,
  playerId: string,
  targetTeamCode: string,
  playerName?: string
): Promise<LeagueInvariantResult> {
  if (!worldId || !playerId || !targetTeamCode) {
    return { valid: true }; // Skip validation if missing required params
  }

  const teams = await getLeague(worldId);

  for (const team of teams) {
    const teamCode = team?.teamCode;
    if (!teamCode || teamCode === targetTeamCode) continue;

    const players = collectPlayersFromTeam(team);
    const existingPlayer = players.find((p) => p.playerId === playerId);

    if (existingPlayer) {
      const playerDesc =
        playerName || existingPlayer.playerName
          ? `${playerName || existingPlayer.playerName} (${playerId})`
          : playerId;

      return {
        valid: false,
        error: `Player ${playerDesc} already exists on ${teamCode}. Cannot add to ${targetTeamCode}.`,
        duplicates: [
          { playerId, teams: [teamCode, targetTeamCode], playerName },
        ],
      };
    }
  }

  return { valid: true };
}

/**
 * Full league invariant validation.
 * Loads all teams and validates all league-wide constraints.
 *
 * @param worldId - World ID to validate
 * @returns Validation result
 */
export async function assertLeagueIntegrity(
  worldId: string
): Promise<LeagueInvariantResult> {
  if (!worldId) {
    return {
      valid: false,
      error: 'worldId is required for league integrity check',
    };
  }

  const teams = await getLeague(worldId);

  if (!teams || teams.length === 0) {
    return { valid: false, error: 'No teams found in world' };
  }

  if (teams.length !== 30) {
    return {
      valid: false,
      error: `Expected 30 teams, found ${teams.length}. League structure is invalid.`,
    };
  }

  // Check for duplicate players
  const duplicateResult = validateNoDuplicatePlayers(teams);
  if (!duplicateResult.valid) {
    return duplicateResult;
  }

  return { valid: true };
}

/**
 * Extract player IDs being added to a team from mutation payload.
 * Used for targeted pre-mutation validation.
 *
 * @param mutationType - Type of mutation
 * @param payload - Mutation payload
 * @returns Array of { playerId, targetTeamCode, playerName } for players being added
 */
export function extractIncomingPlayers(
  mutationType: string,
  payload: any
): Array<{ playerId: string; targetTeamCode: string; playerName?: string }> {
  const incomingPlayers: Array<{
    playerId: string;
    targetTeamCode: string;
    playerName?: string;
  }> = [];

  switch (mutationType) {
    case 'executeTrade': {
      // For trades, extract players being received by each team
      const teams = payload?.teams || [];
      for (const teamEntry of teams) {
        const targetTeamCode = teamEntry?.teamCode || teamEntry?.team?.teamCode;
        const receiving =
          teamEntry?.receiving || teamEntry?.playersReceiving || [];
        for (const player of receiving) {
          const playerId = extractPlayerId(player);
          if (playerId && targetTeamCode) {
            incomingPlayers.push({
              playerId,
              targetTeamCode,
              playerName: extractPlayerName(player) || undefined,
            });
          }
        }
      }
      break;
    }

    case 'signFreeAgent':
    case 'signAndTrade': {
      const playerId = payload?.playerId;
      const targetTeamCode = payload?.teamCode;
      if (playerId && targetTeamCode) {
        incomingPlayers.push({
          playerId,
          targetTeamCode,
          playerName: payload?.playerName || undefined,
        });
      }
      break;
    }

    case 'matchOfferSheet':
    case 'finalizeMatchedOfferSheet': {
      // RFA matching: player stays with home team
      const playerId = payload?.playerId;
      const targetTeamCode = payload?.homeTeamCode || payload?.teamCode;
      if (playerId && targetTeamCode) {
        incomingPlayers.push({
          playerId,
          targetTeamCode,
          playerName: payload?.playerName || undefined,
        });
      }
      break;
    }

    case 'finalizeDeclinedOfferSheet': {
      // RFA decline: player goes to offering team
      const playerId = payload?.playerId;
      const targetTeamCode = payload?.offeringTeamCode || payload?.teamCode;
      if (playerId && targetTeamCode) {
        incomingPlayers.push({
          playerId,
          targetTeamCode,
          playerName: payload?.playerName || undefined,
        });
      }
      break;
    }

    // Other mutations don't add players to teams
    default:
      break;
  }

  return incomingPlayers;
}

/**
 * Validate that incoming players from a mutation are not already on other teams.
 * This is the primary guard called from the mutation pipeline.
 *
 * @param worldId - World ID
 * @param mutationType - Type of mutation
 * @param payload - Mutation payload
 * @param computeResult - Result from compute phase (contains post-trade team states)
 * @returns Validation result
 */
export async function validateMutationLeagueInvariants(
  worldId: string,
  mutationType: string,
  payload: any,
  computeResult?: any
): Promise<LeagueInvariantResult> {
  // For trades, we need to validate the POST-trade state, not current state
  // The compute phase has already moved players, so we validate the result
  if (mutationType === 'executeTrade' && computeResult?.teamUpdates) {
    // Extract all player locations from post-trade team states
    const postTradeTeams = computeResult.teamUpdates.map(
      (update: any) => update.team
    );

    // We also need teams NOT involved in the trade to check against
    // Load full league and replace with post-trade states
    const allTeams = await getLeague(worldId);
    const updatedTeamCodes = new Set(
      computeResult.teamUpdates.map((u: any) => u.teamCode)
    );

    // Build combined team list: post-trade for involved teams, current for others
    const combinedTeams = allTeams.map((team: any) => {
      if (updatedTeamCodes.has(team.teamCode)) {
        return (
          computeResult.teamUpdates.find(
            (u: any) => u.teamCode === team.teamCode
          )?.team || team
        );
      }
      return team;
    });

    return validateNoDuplicatePlayers(combinedTeams);
  }

  // For signings and other player additions, validate against current league state
  const incomingPlayers = extractIncomingPlayers(mutationType, payload);

  if (incomingPlayers.length === 0) {
    return { valid: true }; // No players being added
  }

  // Validate each incoming player is not on another team
  for (const { playerId, targetTeamCode, playerName } of incomingPlayers) {
    const result = await assertPlayerNotOnOtherTeam(
      worldId,
      playerId,
      targetTeamCode,
      playerName
    );
    if (!result.valid) {
      return result;
    }
  }

  return { valid: true };
}
