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
 *  - Mutation Pipeline: src/features/architect/utils/mutationPipeline.ts
 */

import { getLeague } from './teamLoader';
import { resolveEntitlementsForTeam } from './entitlements/entitlementResolver';
import { runTeamExclusivityGate } from './entitlements/runTeamExclusivityGate';
import {
  runLeagueClaimUniquenessGate,
  type LeagueClaimConflict,
} from './entitlements/leagueClaimUniquenessGate';
import type { EntitlementDocLike } from './entitlements/entitlementExclusivityValidator';

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

  return players.flatMap((player: any): PlayerLocation[] => {
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

// =============================================================================
// ENTITLEMENT INVARIANTS (B5 + B6)
// =============================================================================

/**
 * Result of entitlement invariant validation
 */
export interface EntitlementInvariantResult {
  valid: boolean;
  error?: string;
  duplicates?: Array<{
    entitlementId: string;
    teams: string[];
    description?: string;
  }>;
}

/**
 * Result of pick-slot accounting validation
 */
export interface PickSlotAccountingResult {
  valid: boolean;
  error?: string;
  expected: number;
  actual: number;
  missingSlots?: Array<{ year: number; round: number; team: string }>;
  extraSlots?: Array<{
    year: number;
    round: number;
    team: string;
    entitlementId: string;
  }>;
}

/**
 * Validate that no entitlement exists on multiple teams in the league.
 * Parallel to validateNoDuplicatePlayers.
 *
 * @param teams - Array of all teams with entitlementIds arrays
 * @returns Validation result with duplicates if any found
 */
export function validateNoDuplicateEntitlements(
  teams: Array<{ teamCode?: string; entitlementIds?: string[] }>
): EntitlementInvariantResult {
  const entitlementMap = new Map<string, string[]>();

  for (const team of teams) {
    const teamCode = team?.teamCode;
    if (!teamCode) continue;

    const entitlementIds = team.entitlementIds || [];
    for (const entId of entitlementIds) {
      const existing = entitlementMap.get(entId);
      if (existing) {
        existing.push(teamCode);
      } else {
        entitlementMap.set(entId, [teamCode]);
      }
    }
  }

  // Find duplicates (entitlements on more than one team)
  const duplicates: Array<{ entitlementId: string; teams: string[] }> = [];

  for (const [entitlementId, teamList] of entitlementMap) {
    if (teamList.length > 1) {
      duplicates.push({ entitlementId, teams: teamList });
    }
  }

  if (duplicates.length > 0) {
    const firstDupe = duplicates[0];
    return {
      valid: false,
      error: `Entitlement ${firstDupe.entitlementId} exists on multiple teams: ${firstDupe.teams.join(', ')}. ${duplicates.length} duplicate(s) found.`,
      duplicates,
    };
  }

  return { valid: true };
}

/**
 * Validate entitlement integrity for a specific mutation.
 * Use after trades to ensure no entitlement ended up on multiple teams.
 *
 * @param worldId - World ID
 * @param mutationType - Type of mutation
 * @param computeResult - Result from compute phase (contains post-trade team states)
 * @returns Validation result
 */
export async function validateMutationEntitlementInvariants(
  worldId: string,
  mutationType: string,
  computeResult?: any
): Promise<EntitlementInvariantResult> {
  // Only validate for trades (the primary way entitlements can move)
  if (mutationType !== 'executeTrade' || !computeResult?.teamUpdates) {
    return { valid: true };
  }

  // Load full league and replace with post-trade states
  const allTeams = await getLeague(worldId);
  const updatedTeamCodes = new Set(
    computeResult.teamUpdates.map((u: any) => u.teamCode)
  );

  // Build combined team list: post-trade for involved teams, current for others
  const combinedTeams = allTeams.map((team: any) => {
    if (updatedTeamCodes.has(team.teamCode)) {
      return (
        computeResult.teamUpdates.find((u: any) => u.teamCode === team.teamCode)
          ?.team || team
      );
    }
    return team;
  });

  return validateNoDuplicateEntitlements(combinedTeams);
}

/**
 * Full entitlement integrity validation.
 * Combines duplicate entitlement check with optional pick-slot accounting.
 *
 * @param worldId - World ID to validate
 * @returns Validation result
 */
export async function assertEntitlementIntegrity(
  worldId: string
): Promise<EntitlementInvariantResult> {
  if (!worldId) {
    return { valid: false, error: 'worldId is required' };
  }

  const teams = await getLeague(worldId);

  // Check for duplicate entitlements across teams
  const dupeResult = validateNoDuplicateEntitlements(teams);
  if (!dupeResult.valid) {
    return dupeResult;
  }

  return { valid: true };
}

/**
 * Validate pick-slot accounting: verify expected number of pick slots exist.
 *
 * NBA has 30 teams × 2 rounds × N tradeable years = expected pick slots.
 * Every slot should be accounted for by exactly one pick_ownership entitlement.
 *
 * @param teams - Array of teams with resolved entitlements
 * @param yearRange - Array of years to check (e.g., [2026, 2027, 2028, ...])
 * @param teamCodes - Array of all 30 team codes
 * @returns Validation result with accounting details
 */
export function validatePickSlotAccounting(
  teams: Array<{
    teamCode?: string;
    entitlementIds?: string[];
    entitlements?: Array<{
      id?: string;
      kind?: string;
      seasonYear?: number;
      round?: number;
      underlyingPickId?: string;
    }>;
  }>,
  yearRange: number[],
  teamCodes: string[]
): PickSlotAccountingResult {
  if (!yearRange.length || !teamCodes.length) {
    return { valid: true, expected: 0, actual: 0 };
  }

  const expectedSlots = teamCodes.length * 2 * yearRange.length;

  // Build expected slot set
  const expectedSlotSet = new Set<string>();
  for (const year of yearRange) {
    for (const round of [1, 2]) {
      for (const teamCode of teamCodes) {
        expectedSlotSet.add(`${teamCode}_${year}_${round}`);
      }
    }
  }

  // Collect all pick_ownership entitlements and map to slots
  const slotToEntitlement = new Map<
    string,
    { entitlementId: string; teamCode: string }
  >();
  const missingSlots: Array<{ year: number; round: number; team: string }> = [];
  const extraSlots: Array<{
    year: number;
    round: number;
    team: string;
    entitlementId: string;
  }> = [];

  for (const team of teams) {
    const teamCode = team?.teamCode;
    if (!teamCode) continue;

    const entitlements = team.entitlements || [];

    for (const ent of entitlements) {
      // Only count pick_ownership entitlements
      if (ent.kind !== 'pick_ownership') continue;
      if (!yearRange.includes(ent.seasonYear as number)) continue;

      // Parse slot from underlyingPickId (format: "LAL_2027_1st")
      const slotKey = parseSlotKeyFromEntitlement(ent);
      if (!slotKey) continue;

      if (slotToEntitlement.has(slotKey)) {
        // Duplicate slot coverage
        extraSlots.push({
          year: ent.seasonYear as number,
          round: ent.round as number,
          team: teamCode,
          entitlementId: ent.id as string,
        });
      } else {
        slotToEntitlement.set(slotKey, {
          entitlementId: ent.id as string,
          teamCode,
        });
      }
    }
  }

  // Check for missing slots
  for (const slot of expectedSlotSet) {
    if (!slotToEntitlement.has(slot)) {
      const [team, yearStr, roundStr] = slot.split('_');
      missingSlots.push({
        year: parseInt(yearStr, 10),
        round: parseInt(roundStr, 10),
        team,
      });
    }
  }

  const actualCount = slotToEntitlement.size;

  if (missingSlots.length > 0 || extraSlots.length > 0) {
    return {
      valid: false,
      error: `Pick slot accounting mismatch: expected ${expectedSlots}, found ${actualCount}. Missing: ${missingSlots.length}, Extra: ${extraSlots.length}`,
      expected: expectedSlots,
      actual: actualCount,
      missingSlots,
      extraSlots,
    };
  }

  return {
    valid: true,
    expected: expectedSlots,
    actual: actualCount,
  };
}

/**
 * Parse slot key from entitlement for pick-slot accounting.
 */
function parseSlotKeyFromEntitlement(entitlement: {
  underlyingPickId?: string;
  seasonYear?: number;
  round?: number;
}): string | null {
  if (!entitlement.underlyingPickId) return null;

  // Try to parse team from underlyingPickId (format: "LAL_2027_1st")
  const match = entitlement.underlyingPickId.match(/^([A-Z]{3})_(\d{4})_/);
  if (match) {
    const team = match[1];
    const year = match[2];
    const round = entitlement.round || 1;
    return `${team}_${year}_${round}`;
  }

  return null;
}

// =============================================================================
// TM-EXCL-E3: Per-team exclusivity validation at world trade apply time
// =============================================================================

/**
 * Result of per-team exclusivity validation at apply time.
 */
export interface TradeApplyExclusivityResult {
  valid: boolean;
  error?: string;
  teamViolations?: Array<{
    teamCode: string;
    message: string;
    violations?: unknown[];
  }>;
  claimConflicts?: LeagueClaimConflict[];
}

/**
 * Validate per-team entitlement exclusivity for a trade at apply time.
 *
 * Unlike Phase 3.6 (which checks cross-team duplicate entitlement IDs),
 * this checks that no team ends up with overlapping entitlement *claims*
 * (duplicate ownership, swap controllers, conveyance rights) after the trade.
 *
 * TM-EXCL-E3 invariant: "No entitlement ownership mutation may persist if
 * exclusivity cannot be validated."
 *
 * @param worldId - World ID for resolving entitlements
 * @param mutationType - Mutation type (only runs for executeTrade and signAndTrade)
 * @param computeResult - Result from compute phase with teamUpdates + entitlementUpdates
 * @returns Validation result
 */
export async function validateTradeApplyExclusivity(
  worldId: string,
  mutationType: string,
  computeResult?: any
): Promise<TradeApplyExclusivityResult> {
  // Only validate for trades (the primary way entitlements change ownership)
  if (
    (mutationType !== 'executeTrade' && mutationType !== 'signAndTrade') ||
    !computeResult?.entitlementUpdates?.length
  ) {
    return { valid: true };
  }

  // Identify teams affected by entitlement ownership changes
  const affectedTeamCodes = new Set<string>();
  for (const update of computeResult.entitlementUpdates) {
    if (update.holderTeam) {
      affectedTeamCodes.add(update.holderTeam);
    }
  }

  // Also include teams that lost entitlements (from teamUpdates metadata)
  if (computeResult.metadata?.entitlementsTraded) {
    for (const [teamCode, transfers] of Object.entries(
      computeResult.metadata.entitlementsTraded as Record<
        string,
        { out?: string[]; in?: string[] }
      >
    )) {
      if (
        (transfers.out && transfers.out.length > 0) ||
        (transfers.in && transfers.in.length > 0)
      ) {
        affectedTeamCodes.add(teamCode);
      }
    }
  }

  if (affectedTeamCodes.size === 0) {
    return { valid: true };
  }

  const teamViolations: Array<{
    teamCode: string;
    message: string;
    violations?: unknown[];
  }> = [];
  const postTradeSetsByTeam: Record<string, EntitlementDocLike[]> = {};

  // For each affected team, resolve full entitlement docs and run exclusivity gate
  for (const teamCode of affectedTeamCodes) {
    try {
      // Resolve the team's full entitlement set (includes world overrides)
      const resolved = await resolveEntitlementsForTeam(worldId, teamCode);

      // Apply the pending holderTeam patches from this trade:
      //  - Entitlements being transferred TO this team: should already appear
      //    via the resolver. holderTeam patches haven't been written yet, but
      //    the entitlement is still referenced (via entitlementIds on the team).
      //  - Entitlements being transferred AWAY from this team: remove them.
      const outgoing = new Set<string>();
      if (computeResult.metadata?.entitlementsTraded?.[teamCode]?.out) {
        for (const id of computeResult.metadata.entitlementsTraded[teamCode]
          .out) {
          outgoing.add(id);
        }
      }

      // Build post-trade set: current minus outgoing, plus incoming that might not be resolved yet
      const postTradeSet = resolved.filter(
        (ent) => !outgoing.has(ent.id as string)
      );

      // Add incoming entitlements that this team receives but might not yet be resolved
      // (The entitlementUpdates contain holderTeam patches for incoming entitlements)
      const incomingIds = new Set<string>();
      if (computeResult.metadata?.entitlementsTraded?.[teamCode]?.in) {
        for (const id of computeResult.metadata.entitlementsTraded[teamCode]
          .in) {
          incomingIds.add(id);
        }
      }
      const existingIds = new Set(postTradeSet.map((e) => e.id as string));
      const missingIncoming = [...incomingIds].filter(
        (id) => !existingIds.has(id)
      );

      // If there are incoming entitlements not yet in the resolved set,
      // try to resolve them individually
      if (missingIncoming.length > 0) {
        const { resolveEntitlement } = await import(
          './entitlements/entitlementResolver'
        );
        for (const entId of missingIncoming) {
          const ent = await resolveEntitlement(worldId, entId);
          if (ent) {
            postTradeSet.push({ ...ent, holderTeam: teamCode });
          }
        }
      }

      const gateResult = runTeamExclusivityGate({
        teamId: teamCode,
        entitlements: postTradeSet,
        context: 'WORLD_TRADE_APPLY',
      });

      if (!gateResult.ok) {
        const failedGateResult = gateResult as Exclude<
          typeof gateResult,
          { ok: true }
        >;
        teamViolations.push({
          teamCode,
          message: failedGateResult.message,
          violations: failedGateResult.violations,
        });
      } else {
        postTradeSetsByTeam[teamCode] = postTradeSet;
      }
    } catch (err: unknown) {
      // Integrity-first: if we cannot resolve or validate, fail the trade
      const msg = err instanceof Error ? err.message : String(err);
      teamViolations.push({
        teamCode,
        message: `World Trade Apply: Cannot validate exclusivity for ${teamCode} — ${msg}`,
      });
    }
  }

  if (teamViolations.length > 0) {
    const firstViolation = teamViolations[0];
    return {
      valid: false,
      error: firstViolation.message,
      teamViolations,
    };
  }

  // League-wide claim uniqueness gate (R1):
  // ensure no affected-team post state conflicts with any other team in the league.
  const leagueClaimResult = await runLeagueClaimUniquenessGate({
    worldId,
    context: 'WORLD_TRADE_APPLY',
    scopeMode: 'FULL_LEAGUE',
    postMutationEntitlementsByTeam: postTradeSetsByTeam,
  });

  if (!leagueClaimResult.ok) {
    const failedLeagueClaimResult = leagueClaimResult as Exclude<
      typeof leagueClaimResult,
      { ok: true }
    >;
    return {
      valid: false,
      error: failedLeagueClaimResult.message,
      teamViolations: failedLeagueClaimResult.conflicts
        ? failedLeagueClaimResult.conflicts.map((conflict) => ({
            teamCode: conflict.teams.join(','),
            message: `Claim key "${conflict.claimKey}" conflicts across teams: ${conflict.teams.join(', ')}`,
            violations: conflict.entitlements,
          }))
        : undefined,
      claimConflicts: failedLeagueClaimResult.conflicts,
    };
  }

  return { valid: true };
}
