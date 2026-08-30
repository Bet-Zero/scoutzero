/**
 * FILE: src/features/architect/GMDashboard/hooks/useArchitectActions.helpers.ts
 * PURPOSE: Pure helper functions for useArchitectActions hook (no React).
 * OWNERSHIP: Feature: architect/GMDashboard
 *
 * Wave 6 Step 2: Extracted from useArchitectActions.ts (L185-L1099).
 */

// Wave 34 Step 1: signing types + preflight builders
export * from './useArchitectActions.helpers.signing';
// Wave 34 Step 2: committed offer-sheet identity helpers
export * from './useArchitectActions.helpers.offerSheet';

import {
  createCanonicalTeamTotalsSnapshot,
  synchronizeTeamTotalsSnapshot,
} from '@/features/architect/utils/capTotals/computeTeamCapTotals';
import {
  POST_STATE_CAP_VALIDATOR_VERSION,
  validatePostStateCapLegality,
} from '@/features/architect/utils/capLegality/postStateCapValidator';
import type { CapAuditEventV1Like } from '@/features/architect/utils/capLegality/localCapAuditLog';
import type { PlayerRulesProfileInput } from '@/features/architect/types';
import type {
  LocalContract,
  LocalContractLegacySalaryInput,
  SigningDetails,
  ArchitectPlayer,
  CapSheet,
  CapHoldActionItem,
  OverrideAuditEntry,
  DashboardCommittedTeamSnapshot,
  PersistMutationResult,
  OfferSheet,
  OfferSheetCommittedIdentity,
  OfferSheetMutationMetadata,
  OfferSheetLifecycleCommittedIdentity,
  OfferSheetLifecycleCommittedIdentityInput,
} from './useArchitectActions.types';
import type { RenounceActionTarget } from './useArchitectActions.helpers.signing';
import type { ReloadActiveWorldMetadataPatch } from './useArchitectState.types';

// Helper to ensure contract has proper structure

export function isCapHoldTarget(
  value: RenounceActionTarget
): value is CapHoldActionItem {
  return 'playerName' in value || 'amount' in value;
}

export function getRenounceTargetDisplayName(
  target: RenounceActionTarget
): string {
  if (isCapHoldTarget(target)) {
    return String(target.playerName || 'this player');
  }

  return String(
    ('displayName' in target ? target.displayName : undefined) ||
      ('name' in target ? target.name : undefined) ||
      'this player'
  );
}

export function getRenounceTargetCandidateValues(
  target: RenounceActionTarget
): unknown[] {
  if (isCapHoldTarget(target)) {
    return [target.playerId, target.playerName];
  }

  return [
    'id' in target ? target.id : undefined,
    'player_id' in target ? target.player_id : undefined,
    'name' in target ? target.name : undefined,
    'displayName' in target ? target.displayName : undefined,
  ];
}

export function getRenounceTargetPrimaryId(
  target: RenounceActionTarget
): string | null {
  const rawId = isCapHoldTarget(target)
    ? target.playerId
    : ('id' in target ? target.id : undefined) ||
      ('player_id' in target ? target.player_id : undefined) ||
      ('name' in target ? target.name : undefined);
  const normalized = String(rawId || '').trim();
  return normalized || null;
}

export const normalizeEntityIdentity = (value: unknown): string => {
  if (value == null) {
    return '';
  }
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
};

/**
 * Helper to record override audit entry in cap sheet
 */
export const recordOverrideAudit = (
  prev: CapSheet | null,
  actionType: string,
  reasons: string[],
  playerId?: string,
  playerName?: string
): OverrideAuditEntry[] => {
  const existingLog = prev?.overrideAuditLog || [];
  const newEntry: OverrideAuditEntry = {
    actionType,
    timestamp: new Date().toISOString(),
    reasons,
    overrideUsed: true,
    playerId,
    playerName,
  };
  return [...existingLog, newEntry];
};

export const CAP_AUDIT_EVENT_SCHEMA_VERSION = 'cap-audit-event-v1';
export const BASE_MODE_VALIDATOR_WORLD_ID = 'base-mode';

export type TeamsByCode = Record<string, CapSheet>;

export function generateLocalOperationId(timestamp = Date.now()): string {
  const randomSuffix = Math.random().toString(36).slice(2, 10);
  return `op_${timestamp}_${randomSuffix}`;
}

export function safeCloneForAudit<T>(value: T): T {
  try {
    return JSON.parse(JSON.stringify(value)) as T;
  } catch {
    return value;
  }
}

export function getTeamPlayerIds(team: CapSheet): Set<string> {
  const rosterIds = Array.isArray(team?.roster)
    ? team.roster
        .map((playerId) => String(playerId || ''))
        .filter((playerId) => playerId.length > 0)
    : [];

  if (rosterIds.length > 0) {
    return new Set(rosterIds);
  }

  const players = Array.isArray(team?.players) ? team.players : [];
  return new Set(
    players
      .map((player) =>
        String(player?.id || player?.player_id || player?.name || '')
      )
      .filter((playerId) => playerId.length > 0)
  );
}

export function buildAuditDiffSummary(params: {
  beforeTeamsByCode: TeamsByCode;
  afterTeamsByCode: TeamsByCode;
}) {
  const { beforeTeamsByCode, afterTeamsByCode } = params;
  const teamCodes = Array.from(
    new Set([
      ...Object.keys(beforeTeamsByCode),
      ...Object.keys(afterTeamsByCode),
    ])
  );

  const changedPlayerIds = new Set<string>();
  let deadCapChanged = 0;
  let exceptionsChanged = 0;

  for (const code of teamCodes) {
    const beforeTeam = beforeTeamsByCode[code] || {};
    const afterTeam = afterTeamsByCode[code] || {};
    const beforePlayerIds = getTeamPlayerIds(beforeTeam);
    const afterPlayerIds = getTeamPlayerIds(afterTeam);

    for (const playerId of beforePlayerIds) {
      if (!afterPlayerIds.has(playerId)) {
        changedPlayerIds.add(playerId);
      }
    }

    for (const playerId of afterPlayerIds) {
      if (!beforePlayerIds.has(playerId)) {
        changedPlayerIds.add(playerId);
      }
    }

    if (
      JSON.stringify(beforeTeam.deadCap || []) !==
      JSON.stringify(afterTeam.deadCap || [])
    ) {
      deadCapChanged += 1;
    }

    if (
      JSON.stringify(beforeTeam.exceptions || {}) !==
      JSON.stringify(afterTeam.exceptions || {})
    ) {
      exceptionsChanged += 1;
    }
  }

  return {
    teamsTouched: teamCodes.length,
    playersMoved: changedPlayerIds.size,
    deadCapChanged,
    exceptionsChanged,
  };
}

export function buildTotalsByTeam(
  teamsByCode: TeamsByCode,
  year: number,
  asOfDate: string | null = null
): CapAuditEventV1Like['beforeTotalsByTeam'] {
  const totalsByTeam: CapAuditEventV1Like['beforeTotalsByTeam'] = {};
  for (const [teamCode, team] of Object.entries(teamsByCode || {})) {
    const canonicalTeam = asOfDate
      ? synchronizeTeamTotalsSnapshot(team, year, { asOfDate })
      : team;
    totalsByTeam[teamCode] =
      canonicalTeam?.totals ||
      createCanonicalTeamTotalsSnapshot(team, year, { asOfDate });
  }
  return totalsByTeam;
}

export function buildCapAuditEvaluation(params: {
  operationId: string;
  occurredAt: string;
  mutationType: string;
  worldId: string | null;
  worldLineage?: readonly string[];
  year: number;
  teamCodes: string[];
  playerIds: string[];
  beforeTeamsByCode: TeamsByCode;
  afterTeamsByCode: TeamsByCode;
  preview?: boolean;
  authoritativeEventLinked?: boolean;
  authoritativeOperationId?: string;
  persistFailed?: boolean;
}): {
  event: CapAuditEventV1Like;
  validation: ReturnType<typeof validatePostStateCapLegality>;
} {
  const {
    operationId,
    occurredAt,
    mutationType,
    worldId,
    worldLineage = [],
    year,
    teamCodes,
    playerIds,
    beforeTeamsByCode,
    afterTeamsByCode,
    preview,
    authoritativeEventLinked,
    authoritativeOperationId,
    persistFailed,
  } = params;

  const beforeTotalsByTeam = buildTotalsByTeam(
    beforeTeamsByCode,
    year,
    occurredAt
  );
  const afterTotalsByTeam = buildTotalsByTeam(
    afterTeamsByCode,
    year,
    occurredAt
  );
  const validation = validatePostStateCapLegality({
    operationId,
    mutationType,
    worldId: worldId || BASE_MODE_VALIDATOR_WORLD_ID,
    worldLineage,
    year,
    beforeTeamsByCode: beforeTeamsByCode as Record<
      string,
      Record<string, unknown>
    >,
    afterTeamsByCode: afterTeamsByCode as Record<
      string,
      Record<string, unknown>
    >,
    beforeTotalsByTeam,
    afterTotalsByTeam,
  });

  const event: CapAuditEventV1Like = {
    schemaVersion: CAP_AUDIT_EVENT_SCHEMA_VERSION,
    validatorVersion: POST_STATE_CAP_VALIDATOR_VERSION,
    operationId,
    mutationType,
    occurredAt,
    worldId,
    teamCodes,
    playerIds,
    beforeTotalsByTeam,
    afterTotalsByTeam,
    valid: validation.valid,
    violations: validation.violations.map((issue) => ({ ...issue })),
    warnings: validation.warnings.map((issue) => ({ ...issue })),
    diffSummary: buildAuditDiffSummary({
      beforeTeamsByCode,
      afterTeamsByCode,
    }),
    ...(typeof preview === 'boolean' ? { preview } : {}),
    ...(typeof authoritativeEventLinked === 'boolean'
      ? { authoritativeEventLinked }
      : {}),
    ...(authoritativeOperationId ? { authoritativeOperationId } : {}),
    ...(typeof persistFailed === 'boolean' ? { persistFailed } : {}),
  };

  return {
    event,
    validation,
  };
}

export function getFirstViolationMessage(
  validation: ReturnType<typeof validatePostStateCapLegality>,
  fallbackMessage: string
): string {
  const firstViolation = validation.violations?.[0];
  if (!firstViolation) {
    return fallbackMessage;
  }

  const typedMessage = String(firstViolation.message || '').trim();
  return typedMessage || fallbackMessage;
}

export function getWorldOptimisticLockScopeKey(worldId: string): string {
  return `architect_world_cap_mutation_lock:${worldId}`;
}

export function toTrimmedStringOrNull(value: unknown): string | null {
  const normalized = String(value || '').trim();
  return normalized.length > 0 ? normalized : null;
}

export function extractCommittedWorldMetadataPatch(
  result: PersistMutationResult
): ReloadActiveWorldMetadataPatch | null {
  const patch = result.worldPatch || null;

  if (!patch || patch.asOfDate === undefined) {
    return null;
  }

  return {
    asOfDate: patch.asOfDate || null,
  };
}
