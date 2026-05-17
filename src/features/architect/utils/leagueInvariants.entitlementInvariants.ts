/**
 * Wave 32 Step 2: Entitlement invariant validation extracted from
 * leagueInvariants.ts (lines 458–956).
 *
 * Validates entitlement uniqueness across teams (B5+B6) and per-team
 * exclusivity at trade apply time (TM-EXCL-E3).
 */

import { getLeague } from './teamLoader';
import { resolveEntitlementsForTeam } from './entitlements/entitlementResolver';
import { runTeamExclusivityGate } from './entitlements/runTeamExclusivityGate';
import {
  runLeagueClaimUniquenessGate,
  type LeagueClaimConflict,
} from './entitlements/leagueClaimUniquenessGate';
import type { EntitlementDocLike } from './entitlements/entitlementExclusivityValidator';
import type { ComputeResultLike } from './mutationPipeline';

// ============================================================
// Private helper
// ============================================================

function projectEntitlementTeam(team: {
  teamCode?: string | null;
  entitlementIds?: unknown;
}): { teamCode?: string; entitlementIds?: string[] } {
  const projected: { teamCode?: string; entitlementIds?: string[] } = {};
  if (team.teamCode) {
    projected.teamCode = team.teamCode;
  }
  if (Array.isArray(team.entitlementIds)) {
    projected.entitlementIds = team.entitlementIds
      .map((entitlementId) =>
        entitlementId == null ? null : String(entitlementId)
      )
      .filter((entitlementId): entitlementId is string =>
        Boolean(entitlementId)
      );
  }
  return projected;
}

// ============================================================
// Exported types
// ============================================================

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

// ============================================================
// ENTITLEMENT INVARIANTS (B5 + B6)
// ============================================================

/**
 * Validate that no entitlement exists on multiple teams in the league.
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
 */
export async function validateMutationEntitlementInvariants(
  worldId: string,
  mutationType: string,
  computeResult?: ComputeResultLike
): Promise<EntitlementInvariantResult> {
  if (mutationType !== 'executeTrade' || !computeResult?.teamUpdates) {
    return { valid: true };
  }

  const teamUpdates = computeResult.teamUpdates;
  const allTeams = await getLeague(worldId);
  const updatedTeamCodes = new Set(teamUpdates.map((u) => u.teamCode));

  const combinedTeams = allTeams
    .map((team) => {
      if (updatedTeamCodes.has(team.teamCode)) {
        return (
          teamUpdates.find((u) => u.teamCode === team.teamCode)?.team || team
        );
      }
      return team;
    })
    .map(projectEntitlementTeam);

  return validateNoDuplicateEntitlements(combinedTeams);
}

/**
 * Full entitlement integrity validation.
 */
export async function assertEntitlementIntegrity(
  worldId: string
): Promise<EntitlementInvariantResult> {
  if (!worldId) {
    return { valid: false, error: 'worldId is required' };
  }

  const teams = await getLeague(worldId);
  const dupeResult = validateNoDuplicateEntitlements(
    teams.map(projectEntitlementTeam)
  );
  if (!dupeResult.valid) {
    return dupeResult;
  }

  return { valid: true };
}

/**
 * Validate pick-slot accounting: verify expected number of pick slots exist.
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

  const expectedSlotSet = new Set<string>();
  for (const year of yearRange) {
    for (const round of [1, 2]) {
      for (const teamCode of teamCodes) {
        expectedSlotSet.add(`${teamCode}_${year}_${round}`);
      }
    }
  }

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
      if (ent.kind !== 'pick_ownership') continue;
      if (!yearRange.includes(ent.seasonYear as number)) continue;

      const slotKey = parseSlotKeyFromEntitlement(ent);
      if (!slotKey) continue;

      if (slotToEntitlement.has(slotKey)) {
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

  return { valid: true, expected: expectedSlots, actual: actualCount };
}

function parseSlotKeyFromEntitlement(entitlement: {
  underlyingPickId?: string;
  seasonYear?: number;
  round?: number;
}): string | null {
  if (!entitlement.underlyingPickId) return null;
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
 * Validate per-team entitlement exclusivity for a trade at apply time.
 *
 * TM-EXCL-E3 invariant: "No entitlement ownership mutation may persist if
 * exclusivity cannot be validated."
 */
export async function validateTradeApplyExclusivity(
  worldId: string,
  mutationType: string,
  computeResult?: ComputeResultLike
): Promise<TradeApplyExclusivityResult> {
  if (
    (mutationType !== 'executeTrade' && mutationType !== 'signAndTrade') ||
    !computeResult?.entitlementUpdates?.length
  ) {
    return { valid: true };
  }

  const affectedTeamCodes = new Set<string>();
  for (const update of computeResult.entitlementUpdates) {
    if (update.holderTeam) {
      affectedTeamCodes.add(update.holderTeam);
    }
  }

  const entitlementsTradedByTeam =
    computeResult.metadata?.entitlementsTraded &&
    !Array.isArray(computeResult.metadata.entitlementsTraded)
      ? computeResult.metadata.entitlementsTraded
      : null;

  if (entitlementsTradedByTeam) {
    for (const [teamCode, transfers] of Object.entries(
      entitlementsTradedByTeam as Record<
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

  for (const teamCode of affectedTeamCodes) {
    try {
      const resolved = await resolveEntitlementsForTeam(worldId, teamCode);

      const outgoing = new Set<string>();
      const transferredEntitlements = entitlementsTradedByTeam as Record<
        string,
        { out?: string[]; in?: string[] }
      > | null;
      const transferredForTeam = transferredEntitlements?.[teamCode];
      if (transferredForTeam?.out) {
        for (const id of transferredForTeam.out) {
          outgoing.add(id);
        }
      }

      const postTradeSet = resolved.filter(
        (ent) => !outgoing.has(ent.id as string)
      );

      const incomingIds = new Set<string>();
      if (transferredForTeam?.in) {
        for (const id of transferredForTeam.in) {
          incomingIds.add(id);
        }
      }
      const existingIds = new Set(postTradeSet.map((e) => e.id as string));
      const missingIncoming = [...incomingIds].filter(
        (id) => !existingIds.has(id)
      );

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
