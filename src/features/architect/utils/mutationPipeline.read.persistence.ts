/**
 * FILE: src/features/architect/utils/mutationPipeline.read.persistence.ts
 * PURPOSE: Post-compute persistence prep, dashboard reload normalizers, and audit/event building.
 * OWNERSHIP: Feature: architect/core
 *
 * Wave 5 Step 3: Extracted from mutationPipeline.read.ts (L1447-2793).
 */

import { removeUndefinedDeep } from './mutationPipeline.helpers';
import {
  sanitizeTransientFieldsForPersistence,
} from '@/features/architect/utils/persistenceContracts/enforcement';
import {
  POST_STATE_CAP_VALIDATOR_VERSION,
} from '@/features/architect/utils/capLegality/postStateCapValidator';
import type {
  ArchitectWorldMutationContractSummary,
  ArchitectWorldMutationEvent,
  ArchitectWorldMutationEventDiffSummary,
  ArchitectWorldMutationHistoryMetadata,
  AuditContextLike,
  BuildWorldMutationEventPayloadArgs,
  LooseRecord,
  MutationEventMetadataLike,
  MutationEventSourceResult,
} from './mutationPipeline';
// Wave 42 Step 1: snapshot, canonicalize, and write-summary functions extracted to submodule
export * from './mutationPipeline.read.persistence.snapshots';
import {
  sanitizeStringList,
  collectPlayerTouchIds,
  CAP_AUDIT_EVENT_SCHEMA_VERSION,
} from './mutationPipeline.read.persistence.snapshots';

export function deriveEventTeamCodes({
  auditContext = {},
  computeResult = {},
}: {
  auditContext?: AuditContextLike;
  computeResult?: Pick<MutationEventSourceResult, 'teamUpdates' | 'metadata'>;
}) {
  const candidates = [
    auditContext.teamCodes,
    (computeResult.teamUpdates || []).map((update) => update?.teamCode),
    computeResult.metadata?.teamsAffected,
    computeResult.metadata?.teamsInvolved,
    computeResult.metadata?.teamCodes,
  ];

  for (const candidate of candidates) {
    const teamCodes = sanitizeStringList(candidate);
    if (teamCodes.length > 0) {
      return Array.from(new Set(teamCodes));
    }
  }

  return [];
}

export function deriveEventPlayerIds({
  auditContext = {},
  computeResult = {},
}: {
  auditContext?: AuditContextLike;
  computeResult?: Pick<
    MutationEventSourceResult,
    'playerUpdates' | 'playerDeletes' | 'metadata'
  >;
}) {
  const candidates = [
    auditContext.playerIds,
    collectPlayerTouchIds(computeResult),
    computeResult.metadata?.playersTraded,
    computeResult.metadata?.playerId ? [computeResult.metadata.playerId] : [],
  ];

  for (const candidate of candidates) {
    const playerIds = sanitizeStringList(candidate);
    if (playerIds.length > 0) {
      return Array.from(new Set(playerIds));
    }
  }

  return [];
}

export const TEAM_HISTORY_REQUIRED_MUTATION_TYPES = new Set([
  'executeTrade',
  'signFreeAgent',
  'signAndTrade',
  'finalizeMatchedOfferSheet',
  'finalizeDeclinedOfferSheet',
  'waivePlayer',
  'extendPlayer',
  'optionDecision',
  'renounceRights',
  'setExceptions',
  'setDeadCap',
]);

export function normalizeEventMutationType(mutationType: string) {
  if (mutationType === 'setException') {
    return 'setExceptions';
  }
  return mutationType;
}

export function toSafeIsoTimestamp(timestamp: unknown) {
  const numericTimestamp = Number(timestamp);
  if (Number.isFinite(numericTimestamp)) {
    return new Date(numericTimestamp).toISOString();
  }

  const parsed = Date.parse(String(timestamp ?? ''));
  if (Number.isFinite(parsed)) {
    return new Date(parsed).toISOString();
  }
  return new Date().toISOString();
}

export function coerceObject(input: unknown): LooseRecord {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return {};
  }
  return input as LooseRecord;
}

export function toArrayOfStrings(input: unknown) {
  if (!Array.isArray(input)) {
    return [];
  }
  return input.map((value) => String(value || '').trim()).filter(Boolean);
}

export function deriveContractSummary(
  metadata: MutationEventMetadataLike = {}
): ArchitectWorldMutationContractSummary {
  const contract = coerceObject(metadata.contract);
  const extensionTerms = coerceObject(metadata.extensionTerms);
  const salariesByYear = Array.isArray(contract.salariesByYear)
    ? contract.salariesByYear
    : Array.isArray(extensionTerms.salariesByYear)
      ? extensionTerms.salariesByYear
      : [];

  const firstSalaryRow = salariesByYear[0] || {};
  const yearsCandidate =
    Number(contract.years) ||
    Number(contract.contractYears) ||
    Number(contract.contractLength) ||
    Number(metadata.extensionYears) ||
    Number(extensionTerms.contractYears) ||
    Number(extensionTerms.years) ||
    (salariesByYear.length > 0 ? salariesByYear.length : 0);
  const firstYearSalaryCandidate =
    Number(contract.firstYearSalary) ||
    Number(contract.year1Salary) ||
    Number(firstSalaryRow.salary) ||
    Number(firstSalaryRow.capHit) ||
    Number(extensionTerms.firstYearSalary) ||
    0;
  const totalValueCandidate =
    Number(contract.totalValue) ||
    Number(metadata.contractValue) ||
    (salariesByYear.length > 0
      ? salariesByYear.reduce(
          (sum, row) => sum + (Number(row?.salary || row?.capHit) || 0),
          0
        )
      : 0);

  const startSeason = String(firstSalaryRow.season || '').trim();
  const endSeason = String(
    salariesByYear[salariesByYear.length - 1]?.season || ''
  ).trim();

  const summary = {
    years:
      Number.isFinite(yearsCandidate) && yearsCandidate > 0
        ? yearsCandidate
        : undefined,
    firstYearSalary:
      Number.isFinite(firstYearSalaryCandidate) && firstYearSalaryCandidate > 0
        ? firstYearSalaryCandidate
        : undefined,
    totalValue:
      Number.isFinite(totalValueCandidate) && totalValueCandidate > 0
        ? totalValueCandidate
        : undefined,
    startYear: startSeason || undefined,
    endYear: endSeason || undefined,
    signedUsing:
      typeof metadata.signedUsing === 'string' && metadata.signedUsing
        ? metadata.signedUsing
        : typeof contract.signedUsing === 'string' && contract.signedUsing
          ? contract.signedUsing
          : undefined,
  };

  return removeUndefinedDeep(summary) as ArchitectWorldMutationContractSummary;
}

export function deriveTradePicksMoved(metadata: MutationEventMetadataLike = {}) {
  const picksTraded = toArrayOfStrings(metadata.picksTraded);
  if (picksTraded.length > 0) {
    return picksTraded;
  }

  const legacyEntitlementsTraded = toArrayOfStrings(
    metadata.entitlementsTraded
  );
  if (legacyEntitlementsTraded.length > 0) {
    return legacyEntitlementsTraded;
  }

  const entitlementsTraded = coerceObject(metadata.entitlementsTraded);
  const lines = [];
  for (const [teamCode, transfer] of Object.entries(entitlementsTraded)) {
    const transferObj = coerceObject(transfer);
    const out = toArrayOfStrings(transferObj.out);
    const incoming = toArrayOfStrings(transferObj.in);
    if (out.length > 0) {
      lines.push(`${teamCode}: out ${out.join(', ')}`);
    }
    if (incoming.length > 0) {
      lines.push(`${teamCode}: in ${incoming.join(', ')}`);
    }
  }

  return lines;
}

export function buildTeamHistoryDiffSummary({
  mutationType,
  auditContext = {},
  metadata = {},
  playerIds = [],
}: {
  mutationType: string;
  auditContext?: AuditContextLike;
  metadata?: MutationEventMetadataLike;
  playerIds?: string[];
}): ArchitectWorldMutationEventDiffSummary {
  const baseDiffSummary = coerceObject(auditContext.diffSummary);
  const diffSummary = {
    ...baseDiffSummary,
  };

  if ('executeTrade' === mutationType) {
    if (!Array.isArray(diffSummary.playersMoved)) {
      diffSummary.playersMoved =
        toArrayOfStrings(metadata.playersTraded).length > 0
          ? toArrayOfStrings(metadata.playersTraded)
          : playerIds;
    }

    if (!Array.isArray(diffSummary.picksMoved)) {
      const picksMoved = deriveTradePicksMoved(metadata);
      if (picksMoved.length > 0) {
        diffSummary.picksMoved = picksMoved;
      }
    }
  }

  if (mutationType === 'setExceptions') {
    const existing = toArrayOfStrings(diffSummary.exceptionChanges);
    if (existing.length === 0) {
      const fromMetadata = toArrayOfStrings(metadata.exceptionChanges);
      diffSummary.exceptionChanges =
        fromMetadata.length > 0 ? fromMetadata : ['Exceptions updated'];
    }
  }

  if (mutationType === 'setDeadCap') {
    const existing = toArrayOfStrings(diffSummary.deadCapChanges);
    if (existing.length === 0) {
      const fromMetadata = toArrayOfStrings(metadata.deadCapChanges);
      diffSummary.deadCapChanges =
        fromMetadata.length > 0 ? fromMetadata : ['Dead cap updated'];
    }
  }

  return removeUndefinedDeep(
    diffSummary
  ) as ArchitectWorldMutationEventDiffSummary;
}

export function buildTeamHistoryMutationMetadata({
  mutationType,
  auditContext = {},
  worldId,
  teamCodes = [],
  playerIds = [],
  metadata = {},
}: {
  mutationType: string;
  auditContext?: AuditContextLike;
  worldId: string;
  teamCodes?: readonly string[];
  playerIds?: readonly string[];
  metadata?: MutationEventMetadataLike;
}): ArchitectWorldMutationHistoryMetadata {
  const contractSummary = deriveContractSummary(metadata);

  const mutationMetadata: ArchitectWorldMutationHistoryMetadata = {
    mutationType,
    category: auditContext.mutationCategory || 'unknown',
    worldId,
    teams: [...teamCodes],
    players: [...playerIds],
    teamCode:
      typeof metadata.teamCode === 'string' && metadata.teamCode
        ? metadata.teamCode
        : teamCodes[0],
    playerId:
      typeof metadata.playerId === 'string' && metadata.playerId
        ? metadata.playerId
        : playerIds[0],
    playerName:
      typeof metadata.playerName === 'string' && metadata.playerName
        ? metadata.playerName
        : typeof metadata.waivedPlayer === 'string' && metadata.waivedPlayer
          ? metadata.waivedPlayer
          : typeof metadata.renouncedPlayer === 'string' &&
              metadata.renouncedPlayer
            ? metadata.renouncedPlayer
            : undefined,
    signedUsing:
      typeof metadata.signedUsing === 'string' && metadata.signedUsing
        ? metadata.signedUsing
        : contractSummary.signedUsing,
    rightsUsed:
      typeof metadata.rightsUsed === 'string' && metadata.rightsUsed
        ? metadata.rightsUsed
        : undefined,
    birdRightsType:
      typeof metadata.birdRightsType === 'string'
        ? metadata.birdRightsType
        : undefined,
    freeAgentStatus:
      typeof metadata.freeAgentStatus === 'string'
        ? metadata.freeAgentStatus
        : undefined,
    rightOfFirstRefusal:
      typeof metadata.rightOfFirstRefusal === 'string'
        ? metadata.rightOfFirstRefusal
        : undefined,
    freeAgentAmountRemoved:
      typeof metadata.freeAgentAmountRemoved === 'number' &&
      Number.isFinite(metadata.freeAgentAmountRemoved)
        ? metadata.freeAgentAmountRemoved
        : undefined,
    rightsLedgerId:
      typeof metadata.rightsLedgerId === 'string'
        ? metadata.rightsLedgerId
        : undefined,
    rightsLedgerVersion:
      typeof metadata.rightsLedgerVersion === 'number' &&
      Number.isInteger(metadata.rightsLedgerVersion)
        ? metadata.rightsLedgerVersion
        : undefined,
    rightsStateId:
      typeof metadata.rightsStateId === 'string'
        ? metadata.rightsStateId
        : undefined,
    rightsStateVersion:
      typeof metadata.rightsStateVersion === 'number' &&
      Number.isInteger(metadata.rightsStateVersion)
        ? metadata.rightsStateVersion
        : undefined,
    stretched: metadata.stretched === true,
    buyout: metadata.buyout === true,
    deadCapAmount:
      Number.isFinite(Number(metadata.deadCapAmount)) &&
      Number(metadata.deadCapAmount) > 0
        ? Number(metadata.deadCapAmount)
        : undefined,
    extensionYears:
      Number.isFinite(Number(metadata.extensionYears)) &&
      Number(metadata.extensionYears) > 0
        ? Number(metadata.extensionYears)
        : undefined,
    optionType:
      typeof metadata.optionType === 'string' && metadata.optionType
        ? metadata.optionType
        : undefined,
    accepted:
      typeof metadata.accepted === 'boolean' ? metadata.accepted : undefined,
    contract: contractSummary,
    contractSummary,
    summary:
      typeof metadata.summary === 'string' && metadata.summary.trim()
        ? metadata.summary.trim()
        : undefined,
  };

  if ('executeTrade' === mutationType) {
    const tradePicksMoved = deriveTradePicksMoved(metadata);
    if (tradePicksMoved.length > 0) {
      mutationMetadata.picksMoved = tradePicksMoved;
    }
  }

  return removeUndefinedDeep(
    mutationMetadata
  ) as ArchitectWorldMutationHistoryMetadata;
}

export function buildWorldMutationEventPayload({
  mutationType,
  eventId,
  seasonId,
  worldId,
  timestamp,
  computeResult,
  auditContext = {},
}: BuildWorldMutationEventPayloadArgs): ArchitectWorldMutationEvent {
  const canonicalMutationType = normalizeEventMutationType(mutationType);
  const teamCodes = deriveEventTeamCodes({ auditContext, computeResult });
  if (
    teamCodes.length === 0 &&
    TEAM_HISTORY_REQUIRED_MUTATION_TYPES.has(canonicalMutationType)
  ) {
    throw new Error(
      `persistWorldMutation requires non-empty teamCodes for ${canonicalMutationType}`
    );
  }

  const playerIds = deriveEventPlayerIds({ auditContext, computeResult });
  const occurredAt = toSafeIsoTimestamp(timestamp);
  if (!occurredAt || Number.isNaN(Date.parse(occurredAt))) {
    throw new Error(
      `persistWorldMutation produced invalid occurredAt for ${canonicalMutationType}`
    );
  }

  const stableEventId =
    typeof eventId === 'string' && eventId.trim()
      ? eventId.trim()
      : `${canonicalMutationType}_${Date.parse(occurredAt)}`;
  const operationId =
    typeof auditContext.operationId === 'string' && auditContext.operationId
      ? auditContext.operationId
      : stableEventId;
  const metadata = removeUndefinedDeep(
    sanitizeTransientFieldsForPersistence(computeResult.metadata)
  ) as MutationEventMetadataLike;
  const diffSummary = buildTeamHistoryDiffSummary({
    mutationType: canonicalMutationType,
    auditContext,
    metadata,
    playerIds,
  });
  const mutationMetadata = buildTeamHistoryMutationMetadata({
    mutationType: canonicalMutationType,
    auditContext,
    worldId,
    teamCodes,
    playerIds,
    metadata,
  });

  return {
    eventId: stableEventId,
    id: stableEventId,
    type: canonicalMutationType,
    timestamp: occurredAt,
    seasonId,
    metadata,
    teamsAffected: teamCodes,
    schemaVersion: auditContext.schemaVersion || CAP_AUDIT_EVENT_SCHEMA_VERSION,
    validatorVersion:
      auditContext.validatorVersion || POST_STATE_CAP_VALIDATOR_VERSION,
    operationId,
    mutationType: canonicalMutationType,
    occurredAt,
    worldId,
    teamCodes,
    playerIds,
    beforeTotalsByTeam: auditContext.beforeTotalsByTeam || {},
    afterTotalsByTeam: auditContext.afterTotalsByTeam || {},
    valid: auditContext.valid === true,
    violations: auditContext.violations || [],
    warnings: auditContext.warnings || [],
    diffSummary,
    mutationMetadata,
  };
}
