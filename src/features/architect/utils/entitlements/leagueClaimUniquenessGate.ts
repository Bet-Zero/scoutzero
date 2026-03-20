/**
 * FILE: src/features/architect/utils/entitlements/leagueClaimUniquenessGate.ts
 * PURPOSE: Enforce league-wide claim uniqueness for entitlement writes.
 * OWNERSHIP: Feature: architect/utils/entitlements (Ship Gate B1)
 *
 * INVARIANT:
 *  No two different teams may claim the same underlying pick outcome/control key.
 */

import type { Firestore } from 'firebase/firestore';
import { TeamListFull } from '@/constants/teamList';
import {
  computeEntitlementClaims,
  type EntitlementClaimType,
} from './computeEntitlementClaims';
import type { EntitlementDocLike } from './entitlementExclusivityValidator';
import {
  resolveEntitlementsForTeam,
  resolveEntitlementsForTeamWithDb,
} from './entitlementResolver';

export type LeagueClaimGateContext =
  | 'ENTITLEMENT_SAVE'
  | 'WORLD_TRADE_APPLY'
  | 'DARE_MUTATION'
  | 'ENTITLEMENT_MOVE';

export type LeagueClaimGateErrorType =
  | 'CLAIM_UNIQUENESS_VIOLATION'
  | 'VALIDATION_UNAVAILABLE';

export type LeagueClaimScopeMode = 'FULL_LEAGUE' | 'CUSTOM';

/**
 * CUSTOM scope reasons require an explicit safety proof.
 * Keep this enum intentionally small and audited.
 */
export type LeagueClaimScopeReason = 'PERF_SAFE_INDEXED_LOOKUP';

export interface LeagueClaimConflict {
  claimKey: string;
  claimType: EntitlementClaimType;
  teams: string[];
  entitlements: Array<{
    teamCode: string;
    entitlementId: string;
  }>;
}

export type LeagueClaimGateResult =
  | { ok: true }
  | {
      ok: false;
      errorType: LeagueClaimGateErrorType;
      message: string;
      conflicts?: LeagueClaimConflict[];
    };

export interface LeagueClaimGateInput {
  worldId: string | null;
  context: LeagueClaimGateContext;
  /**
   * Optional post-mutation snapshots for specific teams.
   * Teams included here are used directly; all others are resolved from storage.
   */
  postMutationEntitlementsByTeam?: Record<string, EntitlementDocLike[]>;
  /**
   * Scope mode for validation.
   * Defaults to FULL_LEAGUE.
   */
  scopeMode?: LeagueClaimScopeMode;
  /**
   * Required when scopeMode is CUSTOM.
   * Must document the safety proof for narrowing.
   */
  scopeReason?: LeagueClaimScopeReason;
  /**
   * Optional team scope.
   * Defaults to all NBA teams.
   */
  teamCodes?: string[];
}

interface LeagueClaimGateInputWithDb extends LeagueClaimGateInput {
  db: Firestore;
}

interface ClaimOwnerRef {
  teamCode: string;
  entitlementId: string;
  claimType: EntitlementClaimType;
}

const DEFAULT_TEAM_CODES = TeamListFull.map((team: any) => team.code).filter(
  Boolean
) as string[];

const CONTEXT_LABELS: Record<LeagueClaimGateContext, string> = {
  ENTITLEMENT_SAVE: 'Entitlement Save',
  WORLD_TRADE_APPLY: 'World Trade Apply',
  DARE_MUTATION: 'DARE Mutation',
  ENTITLEMENT_MOVE: 'Entitlement Move',
};

const CORE_WRITE_CONTEXTS = new Set<LeagueClaimGateContext>([
  'ENTITLEMENT_SAVE',
  'WORLD_TRADE_APPLY',
  'DARE_MUTATION',
  'ENTITLEMENT_MOVE',
]);

function hasExplicitTeamScope(teamCodes?: string[]): boolean {
  return Array.isArray(teamCodes) && teamCodes.length > 0;
}

/**
 * Guardrail for league-claim uniqueness scope usage.
 *
 * Rules:
 * - teamCodes may only be supplied in CUSTOM mode.
 * - CUSTOM mode requires an audited scopeReason.
 * - Core write contexts always require FULL_LEAGUE mode.
 */
export function assertLeagueClaimGateScopeSafety(
  input: Pick<
    LeagueClaimGateInput,
    'context' | 'scopeMode' | 'scopeReason' | 'teamCodes'
  >
): void {
  const scopeMode = input.scopeMode ?? 'FULL_LEAGUE';
  const hasTeamCodes = hasExplicitTeamScope(input.teamCodes);

  if (scopeMode === 'CUSTOM') {
    if (!input.scopeReason) {
      throw new Error(
        `${input.context}: CUSTOM scope requires scopeReason.`
      );
    }
    if (CORE_WRITE_CONTEXTS.has(input.context)) {
      throw new Error(
        `${input.context}: core write path requires FULL_LEAGUE scope.`
      );
    }
    if (!hasTeamCodes) {
      throw new Error(
        `${input.context}: CUSTOM scope requires explicit teamCodes.`
      );
    }
    return;
  }

  if (hasTeamCodes) {
    throw new Error(
      `${input.context}: teamCodes may only be provided with scopeMode=CUSTOM.`
    );
  }
}

function normalizeTeamCodes(teamCodes?: string[]): string[] {
  const source = Array.isArray(teamCodes) && teamCodes.length > 0
    ? teamCodes
    : DEFAULT_TEAM_CODES;
  return [...new Set(source.filter(Boolean))];
}

function toSafeEntitlementId(entitlement: EntitlementDocLike): string {
  return (entitlement.id as string) || '(no id)';
}

function buildConflictMessage(
  contextLabel: string,
  conflict: LeagueClaimConflict
): string {
  const teamList = conflict.teams.join(', ');
  const refs = conflict.entitlements
    .map((entry) => `${entry.teamCode}:${entry.entitlementId}`)
    .join(', ');
  return `${contextLabel}: Claim uniqueness violation — claim "${conflict.claimKey}" is held by multiple teams (${teamList}). Entitlements: ${refs}`;
}

function resolveContextLabel(context: LeagueClaimGateContext): string {
  return CONTEXT_LABELS[context] ?? context;
}

export function detectCrossTeamClaimConflicts(
  entitlementsByTeam: Record<string, EntitlementDocLike[]>
): LeagueClaimConflict[] {
  const claimOwners = new Map<string, ClaimOwnerRef[]>();
  const seenEntries = new Set<string>();

  for (const [teamCode, entitlements] of Object.entries(entitlementsByTeam)) {
    if (!Array.isArray(entitlements)) {
      throw new Error(`Entitlements for ${teamCode} are not an array.`);
    }

    for (const entitlement of entitlements) {
      const entitlementId = toSafeEntitlementId(entitlement);
      const { claims } = computeEntitlementClaims({
        ...entitlement,
        id: entitlementId,
      });

      for (const claim of claims) {
        const entryKey = `${teamCode}::${entitlementId}::${claim.key}`;
        if (seenEntries.has(entryKey)) continue;
        seenEntries.add(entryKey);

        if (!claimOwners.has(claim.key)) {
          claimOwners.set(claim.key, []);
        }
        claimOwners.get(claim.key)!.push({
          teamCode,
          entitlementId,
          claimType: claim.type,
        });
      }
    }
  }

  const conflicts: LeagueClaimConflict[] = [];

  for (const [claimKey, owners] of claimOwners) {
    const uniqueTeams = [...new Set(owners.map((owner) => owner.teamCode))];
    if (uniqueTeams.length <= 1) continue;

    conflicts.push({
      claimKey,
      claimType: owners[0].claimType,
      teams: uniqueTeams.sort(),
      entitlements: owners.map((owner) => ({
        teamCode: owner.teamCode,
        entitlementId: owner.entitlementId,
      })),
    });
  }

  return conflicts.sort((a, b) => a.claimKey.localeCompare(b.claimKey));
}

export function evaluateLeagueClaimUniquenessForMap(input: {
  context: LeagueClaimGateContext;
  entitlementsByTeam: Record<string, EntitlementDocLike[]>;
}): LeagueClaimGateResult {
  const label = resolveContextLabel(input.context);

  try {
    const conflicts = detectCrossTeamClaimConflicts(input.entitlementsByTeam);
    if (conflicts.length === 0) {
      return { ok: true };
    }

    return {
      ok: false,
      errorType: 'CLAIM_UNIQUENESS_VIOLATION',
      message: buildConflictMessage(label, conflicts[0]),
      conflicts,
    };
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      errorType: 'VALIDATION_UNAVAILABLE',
      message: `${label}: Cannot validate league-wide claim uniqueness — ${errMsg}`,
    };
  }
}

async function buildLeagueEntitlementMapWithDb(
  input: LeagueClaimGateInputWithDb
): Promise<Record<string, EntitlementDocLike[]>> {
  const {
    db,
    worldId,
    scopeMode,
    teamCodes,
    postMutationEntitlementsByTeam = {},
  } = input;
  const resolvedByTeam: Record<string, EntitlementDocLike[]> = {};
  const resolvedScopeMode = scopeMode ?? 'FULL_LEAGUE';
  const teamScope =
    resolvedScopeMode === 'CUSTOM'
      ? normalizeTeamCodes(teamCodes)
      : DEFAULT_TEAM_CODES;

  for (const teamCode of teamScope) {
    if (teamCode in postMutationEntitlementsByTeam) {
      const provided = postMutationEntitlementsByTeam[teamCode];
      if (!Array.isArray(provided)) {
        throw new Error(
          `Provided entitlement set for ${teamCode} is not an array.`
        );
      }
      resolvedByTeam[teamCode] = provided;
      continue;
    }

    const resolved = await resolveEntitlementsForTeamWithDb(db, worldId, teamCode);
    if (!Array.isArray(resolved)) {
      throw new Error(`Resolved entitlement set for ${teamCode} is not an array.`);
    }
    resolvedByTeam[teamCode] = resolved as EntitlementDocLike[];
  }

  return resolvedByTeam;
}

export async function runLeagueClaimUniquenessGate(
  input: LeagueClaimGateInput
): Promise<LeagueClaimGateResult> {
  try {
    const { db } = await import('@/firebaseConfig');
    return runLeagueClaimUniquenessGateWithDb({ ...input, db });
  } catch (err: unknown) {
    const label = resolveContextLabel(input.context);
    const errMsg = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      errorType: 'VALIDATION_UNAVAILABLE',
      message: `${label}: Cannot validate league-wide claim uniqueness — ${errMsg}`,
    };
  }
}

export async function runLeagueClaimUniquenessGateWithDb(
  input: LeagueClaimGateInputWithDb
): Promise<LeagueClaimGateResult> {
  try {
    assertLeagueClaimGateScopeSafety(input);
    const entitlementsByTeam = await buildLeagueEntitlementMapWithDb(input);
    return evaluateLeagueClaimUniquenessForMap({
      context: input.context,
      entitlementsByTeam,
    });
  } catch (err: unknown) {
    const label = resolveContextLabel(input.context);
    const errMsg = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      errorType: 'VALIDATION_UNAVAILABLE',
      message: `${label}: Cannot validate league-wide claim uniqueness — ${errMsg}`,
    };
  }
}

export async function resolveLeagueEntitlementsForTeamCodes(
  worldId: string | null,
  teamCodes: string[]
): Promise<Record<string, EntitlementDocLike[]>> {
  const resolved: Record<string, EntitlementDocLike[]> = {};
  for (const teamCode of normalizeTeamCodes(teamCodes)) {
    const entitlements = await resolveEntitlementsForTeam(worldId, teamCode);
    if (!Array.isArray(entitlements)) {
      throw new Error(`Resolved entitlement set for ${teamCode} is not an array.`);
    }
    resolved[teamCode] = entitlements as EntitlementDocLike[];
  }
  return resolved;
}
