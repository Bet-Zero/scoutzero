type TeamIdentifierValue = string | number | null | undefined;

type TeamIdentifierLike =
  | TeamIdentifierValue
  | {
      teamCode?: TeamIdentifierValue;
      id?: TeamIdentifierValue;
      code?: TeamIdentifierValue;
      abbreviation?: TeamIdentifierValue;
    };

type PlayerRoutingPlayer = {
  playerId?: string | number | null;
  id?: string | number | null;
  name?: string | null;
  displayName?: string | null;
  tradeTo?: TeamIdentifierValue;
  toTeamId?: TeamIdentifierValue;
  destTeamId?: TeamIdentifierValue;
};

type PlayerRoutingTeamSlot = {
  team?:
    | {
        id?: TeamIdentifierValue;
        teamId?: TeamIdentifierValue;
        teamCode?: TeamIdentifierValue;
        code?: TeamIdentifierValue;
        abbreviation?: TeamIdentifierValue;
      }
    | null;
  teamId?: TeamIdentifierValue;
  teamCode?: TeamIdentifierValue;
  sends?: PlayerRoutingPlayer[] | null;
};

type PlayerRoutingParams = {
  teams?: PlayerRoutingTeamSlot[] | null;
};

type PlayerRoutingResult = {
  valid: boolean;
  errors: string[];
  warnings: string[];
};

type PlayerRoutingContext = {
  teams?: PlayerRoutingTeamSlot[] | null;
  [key: string]: unknown;
};

type PlayerRoutingEnforcementResult = {
  pass: boolean;
  errors: string[];
  warnings: string[];
};

/**
 * Normalize team identifier to a consistent format for comparison.
 * Handles teamCode (3 letters), full team ID, or team object.
 */
function normalizeTeamCode(teamIdLike: TeamIdentifierLike): TeamIdentifierValue {
  if (!teamIdLike) return null;

  if (typeof teamIdLike === 'string') {
    if (teamIdLike.length === 3) return teamIdLike.toUpperCase();
    return teamIdLike;
  }

  if (typeof teamIdLike === 'object') {
    return (
      teamIdLike.teamCode ||
      teamIdLike.id ||
      teamIdLike.code ||
      teamIdLike.abbreviation ||
      null
    );
  }

  return null;
}

function resolveTeamId(
  slot: PlayerRoutingTeamSlot,
  index: number
): string | number {
  return (
    normalizeTeamCode(slot?.team?.id) ||
    normalizeTeamCode(slot?.team?.teamId) ||
    normalizeTeamCode(slot?.team?.teamCode) ||
    normalizeTeamCode(slot?.teamId) ||
    normalizeTeamCode(slot?.teamCode) ||
    `team-${index}`
  );
}

function resolvePlayerDestination(player: PlayerRoutingPlayer): TeamIdentifierValue {
  return normalizeTeamCode(player?.tradeTo || player?.toTeamId || player?.destTeamId);
}

/**
 * Get a unique identifier for a player.
 * Uses playerId if available, or falls back to name + fromTeamId combination.
 */
function getPlayerKey(
  player: PlayerRoutingPlayer,
  fromTeamId: string | number
): string | number {
  if (player.playerId) return player.playerId;
  if (player.id) return player.id;

  const name = player.name || player.displayName || 'unknown';
  return `${name}__${fromTeamId}`;
}

/**
 * Validate player routing for a trade.
 *
 * Checks:
 * 1. UNIQUENESS: Same player cannot appear in multiple teams' sends
 * 2. NO_DUPLICATE_WITHIN_TEAM: Same player cannot appear twice in same team's sends
 * 3. ROUTING: In 3+ team trades, every sent player must have a valid tradeTo
 * 4. DESTINATION: tradeTo must reference a team that is part of the trade
 * 5. NO_SELF_ROUTE: tradeTo cannot be the same as the team sending the player
 */
export function validatePlayerRouting({
  teams,
}: PlayerRoutingParams): PlayerRoutingResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!Array.isArray(teams) || teams.length === 0) {
    return { valid: true, errors, warnings };
  }

  const activeTeams = teams
    .map((slot, index) => ({ slot, index }))
    .filter(({ slot }) => slot.team)
    .map(({ slot, index }) => ({
      slot,
      index,
      teamId: resolveTeamId(slot, index),
    }));
  const activeTeamCount = activeTeams.length;

  if (activeTeamCount < 2) {
    return { valid: true, errors, warnings };
  }

  const tradeTeamIds = new Set<string | number>();
  for (const activeTeam of activeTeams) {
    tradeTeamIds.add(activeTeam.teamId);
  }

  const seenPlayerKeys = new Map<string | number, string | number>();

  for (const [index, slot] of teams.entries()) {
    if (!slot.team) continue;

    const fromTeamId = resolveTeamId(slot, index);
    const sends = slot.sends || [];

    const playersInThisTeam = new Set<string | number>();

    for (const player of sends) {
      const playerKey = getPlayerKey(player, fromTeamId);
      const playerName = player.name || player.displayName || 'Unknown Player';

      if (seenPlayerKeys.has(playerKey)) {
        const otherTeam = seenPlayerKeys.get(playerKey);
        errors.push(
          `Player "${playerName}" is selected by both ${otherTeam} and ${fromTeamId} — same player cannot be traded by multiple teams`
        );
      } else {
        seenPlayerKeys.set(playerKey, fromTeamId);
      }

      if (playersInThisTeam.has(playerKey)) {
        errors.push(
          `Player "${playerName}" appears multiple times in ${fromTeamId}'s sends`
        );
      } else {
        playersInThisTeam.add(playerKey);
      }

      const tradeTo = resolvePlayerDestination(player);
      if (activeTeamCount > 2 && !tradeTo) {
        errors.push(
          `Player "${playerName}" from ${fromTeamId} has no destination (tradeTo required in ${activeTeamCount}-team trade)`
        );
      }

      if (tradeTo && !tradeTeamIds.has(tradeTo)) {
        errors.push(
          `Player "${playerName}" from ${fromTeamId} has invalid destination "${tradeTo}" — not a team in this trade`
        );
      }

      if (tradeTo && tradeTo === fromTeamId) {
        errors.push(
          `Player "${playerName}" from ${fromTeamId} cannot be routed to the same team`
        );
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Check for player routing issues that would block trade validation.
 * Designed to integrate into the trade validator pipeline.
 */
export function enforcePlayerRouting(
  ctx: PlayerRoutingContext
): PlayerRoutingEnforcementResult {
  const { teams } = ctx;
  const result = validatePlayerRouting({ teams });

  return {
    pass: result.valid,
    errors: result.errors,
    warnings: result.warnings,
  };
}

export default validatePlayerRouting;
