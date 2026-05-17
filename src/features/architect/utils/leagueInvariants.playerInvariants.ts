/**
 * Wave 32 Step 1: Player invariant validation extracted from leagueInvariants.ts
 * (lines 28–456).
 *
 * Validates that no player exists on multiple teams (duplicate detection)
 * and that incoming players from mutations are not already on other teams.
 */

import { getLeague } from './teamLoader';
import type {
  ArchitectMutationPayload,
  ComputeResultLike,
} from './mutationPipeline';

// ============================================================
// Private types
// ============================================================

type RawPlayerLike = {
  player_id?: string | number | null;
  id?: string | number | null;
  playerId?: string | number | null;
  displayName?: string | null;
  name?: string | null;
  playerName?: string | null;
  bio?: {
    playerId?: string | number | null;
    displayName?: string | null;
  } | null;
};

type RawTeamLike = {
  teamCode?: string | null;
  players?: unknown[] | null;
  roster?: unknown[] | null;
};

/**
 * Player location info for duplicate detection
 */
interface PlayerLocation {
  playerId: string;
  teamCode: string;
  playerName?: string;
}

// ============================================================
// Exported types
// ============================================================

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

// ============================================================
// Private helpers
// ============================================================

/**
 * Extract player ID from player object with fallback handling.
 */
function extractPlayerId(
  player: RawPlayerLike | null | undefined
): string | null {
  if (!player) return null;
  const raw =
    player.player_id ??
    player.id ??
    player.playerId ??
    player.bio?.playerId ??
    null;
  return raw !== null && raw !== undefined ? String(raw) : null;
}

/**
 * Extract player name from player object for error messages.
 */
function extractPlayerName(
  player: RawPlayerLike | null | undefined
): string | null {
  if (!player) return null;
  return (
    (player.displayName ||
      player.name ||
      player.playerName ||
      player.bio?.displayName ||
      null) ??
    null
  );
}

function isRawPlayerLike(player: unknown): player is RawPlayerLike {
  return Boolean(player && typeof player === 'object');
}

/**
 * Collect all player IDs from a team's roster.
 */
function collectPlayersFromTeam(
  team: RawTeamLike | null | undefined
): PlayerLocation[] {
  const teamCode = team?.teamCode;
  if (!teamCode) return [];

  const players = team?.players || team?.roster || [];
  if (!Array.isArray(players)) return [];

  return players.flatMap((player): PlayerLocation[] => {
    if (!isRawPlayerLike(player)) return [];
    const playerId = extractPlayerId(player);
    if (!playerId) return [];
    return [
      {
        playerId,
        teamCode,
        playerName: extractPlayerName(player) || undefined,
      },
    ];
  });
}

// ============================================================
// Exported functions
// ============================================================

/**
 * Validate that no player exists on multiple teams in the league.
 */
export function validateNoDuplicatePlayers(
  teams: Array<RawTeamLike | null | undefined>
): LeagueInvariantResult {
  const playerMap = new Map<string, { teams: string[]; playerName?: string }>();

  for (const team of teams) {
    const players = collectPlayersFromTeam(team);
    for (const { playerId, teamCode, playerName } of players) {
      const existing = playerMap.get(playerId);
      if (existing) {
        existing.teams.push(teamCode);
      } else {
        playerMap.set(playerId, { teams: [teamCode], playerName });
      }
    }
  }

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
 */
export async function assertPlayerNotOnOtherTeam(
  worldId: string,
  playerId: string,
  targetTeamCode: string,
  playerName?: string
): Promise<LeagueInvariantResult> {
  if (!worldId || !playerId || !targetTeamCode) {
    return { valid: true };
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
        duplicates: [{ playerId, teams: [teamCode, targetTeamCode], playerName }],
      };
    }
  }

  return { valid: true };
}

/**
 * Full league invariant validation — loads all teams and validates all league-wide constraints.
 */
export async function assertLeagueIntegrity(
  worldId: string
): Promise<LeagueInvariantResult> {
  if (!worldId) {
    return { valid: false, error: 'worldId is required for league integrity check' };
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

  const duplicateResult = validateNoDuplicatePlayers(teams);
  if (!duplicateResult.valid) {
    return duplicateResult;
  }

  return { valid: true };
}

/**
 * Extract player IDs being added to a team from mutation payload.
 */
export function extractIncomingPlayers(
  mutationType: string,
  payload: ArchitectMutationPayload
): Array<{ playerId: string; targetTeamCode: string; playerName?: string }> {
  const incomingPlayers: Array<{
    playerId: string;
    targetTeamCode: string;
    playerName?: string;
  }> = [];

  switch (mutationType) {
    case 'executeTrade': {
      const teams = payload?.teams || [];
      for (const teamEntry of teams) {
        const rawTargetTeamCode =
          teamEntry?.teamCode ?? teamEntry?.team?.teamCode ?? null;
        const targetTeamCode =
          rawTargetTeamCode !== null && rawTargetTeamCode !== undefined
            ? String(rawTargetTeamCode)
            : null;
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

    default:
      break;
  }

  return incomingPlayers;
}

/**
 * Validate that incoming players from a mutation are not already on other teams.
 */
export async function validateMutationLeagueInvariants(
  worldId: string,
  mutationType: string,
  payload: ArchitectMutationPayload,
  computeResult?: ComputeResultLike
): Promise<LeagueInvariantResult> {
  if (mutationType === 'executeTrade' && computeResult?.teamUpdates) {
    const teamUpdates = computeResult.teamUpdates;
    const allTeams = await getLeague(worldId);
    const updatedTeamCodes = new Set(teamUpdates.map((u) => u.teamCode));

    const combinedTeams = allTeams.map((team) => {
      if (updatedTeamCodes.has(team.teamCode)) {
        return (
          teamUpdates.find((u) => u.teamCode === team.teamCode)?.team || team
        );
      }
      return team;
    });

    return validateNoDuplicatePlayers(combinedTeams);
  }

  const incomingPlayers = extractIncomingPlayers(mutationType, payload);

  if (incomingPlayers.length === 0) {
    return { valid: true };
  }

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
