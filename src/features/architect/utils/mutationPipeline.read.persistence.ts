/**
 * FILE: src/features/architect/utils/mutationPipeline.read.persistence.ts
 * PURPOSE: Post-compute persistence prep, dashboard reload normalizers, and audit/event building.
 * OWNERSHIP: Feature: architect/core
 *
 * Wave 5 Step 3: Extracted from mutationPipeline.read.ts (L1447-2793).
 */

import {
  EMPTY_WRITES_SUMMARY,
  asLooseRecord,
  cloneWritesSummary,
  normalizeMutationExceptionsFromIngress,
  normalizeStringArray,
  removeUndefinedDeep,
  toOptionalBoolean,
  toOptionalBooleanOrNull,
  toOptionalIdString,
  toOptionalNumber,
  toOptionalNumberOrNull,
  toOptionalNumberishOrNull,
  toOptionalTrimmedString,
  toOptionalTrimmedStringOrNull,
} from './mutationPipeline.helpers';
import {
  hasMutationExceptionBuckets,
  normalizeCurrentStateCapHolds,
  safeCloneForAudit,
  toOptionalDateLike,
  toOptionalScalarId,
} from './mutationPipeline.read.normalizeData';
import {
  normalizePostComputeTeamSnapshotForPostState,
  backfillCurrentStateBaseTeamPreservedFields,
  materializeCurrentStateTeamForAudit,
  stripComputeOnlyTeamFieldsForPersistence,
} from './mutationPipeline.read.normalizeTeam';

import { toEndYear } from '@/features/architect/utils/seasonFormat';
import { computeTeamCapTotals } from '@/features/architect/utils/capTotals';
import {
  synchronizeTeamTotalsSnapshot,
} from '@/features/architect/utils/capTotals/computeTeamCapTotals';
import {
  normalizeTeamTpeSchema,
} from '@/features/architect/utils/persistenceContracts';
import {
  FORBIDDEN_TRANSIENT_KEYS,
  sanitizeTransientFieldsForPersistence,
} from '@/features/architect/utils/persistenceContracts/enforcement';
import { getCapSettings } from '@/features/architect/utils/tradeMachine/utils/capSettingsProvider';
import {
  POST_STATE_CAP_VALIDATOR_VERSION,
} from '@/features/architect/utils/capLegality/postStateCapValidator';

import type { PostStateCapValidationInput } from '@/features/architect/utils/capLegality/postStateCapValidator';
import type {
  ArchitectGeneralMutationCommittedTeamSnapshot,
  ArchitectGeneralMutationCommittedTeamUpdate,
  ArchitectGeneralMutationDashboardReloadBirdRights,
  ArchitectGeneralMutationDashboardReloadContractFreeAgency,
  ArchitectGeneralMutationDashboardReloadDeadCapEntry,
  ArchitectGeneralMutationDashboardReloadDeadCapYear,
  ArchitectGeneralMutationDashboardReloadExceptionEntry,
  ArchitectGeneralMutationDashboardReloadExceptions,
  ArchitectGeneralMutationDashboardReloadOfferSheet,
  ArchitectGeneralMutationDashboardReloadPlayer,
  ArchitectGeneralMutationDashboardReloadPlayerContract,
  ArchitectGeneralMutationDashboardReloadPlayerFutureContract,
  ArchitectGeneralMutationDashboardReloadTeamSnapshot,
  ArchitectGeneralMutationDashboardReloadTradeException,
  ArchitectMutationPayload,
  ArchitectMutationResult,
  ArchitectMutationTeamUpdate,
  ArchitectWorldMutationContractSummary,
  ArchitectWorldMutationEvent,
  ArchitectWorldMutationEventDiffSummary,
  ArchitectWorldMutationHistoryMetadata,
  AuditContextLike,
  BuildTotalsTeamMap,
  BuildWorldMutationEventPayloadArgs,
  ComputeResultLike,
  CurrentStatePlayer,
  CurrentStatePlayerContract,
  CurrentStatePlayerFutureContract,
  CurrentStateTeamPersistenceStripShape,
  CurrentStateTeamRoundTripMaterializable,
  GeneralMutationPersistenceTeamSnapshot,
  LooseRecord,
  MutationBridgePlayerIdSlice,
  MutationBridgePlayerTouchSlice,
  MutationBridgeTeamUpdatesSlice,
  MutationBridgeWritesSlice,
  MutationDiffSummary,
  MutationEventMetadataLike,
  MutationEventSourceResult,
  MutationFailureOverrides,
  MutationTeamMap,
  TeamLike,
  PostStateTotalsByTeam,
  WritesSummaryLike,
} from './mutationPipeline';
import {
  type CanonicalNonTpeExceptionKey,
} from '@/features/architect/utils/exceptions/exceptionOwnership';

export const CAP_AUDIT_EVENT_SCHEMA_VERSION = 'cap-audit-event-v1';

export function addTeamSnapshot(
  teamsByCode: MutationTeamMap,
  teamCode: string | null | undefined,
  team: TeamLike | null | undefined
) {
  if (!teamCode || !team || teamsByCode[teamCode]) {
    return;
  }
  teamsByCode[teamCode] = safeCloneForAudit(team);
}

export function extractTeamsByCodeFromComputeResult(
  computeResult: MutationBridgeTeamUpdatesSlice = {}
): MutationTeamMap {
  const teamsByCode: MutationTeamMap = {};
  for (const update of computeResult.teamUpdates || []) {
    addTeamSnapshot(
      teamsByCode,
      update?.teamCode,
      normalizePostComputeTeamSnapshotForPostState(update?.team)
    );
  }
  return teamsByCode;
}

export function buildTotalsByTeam(
  teamsByCode: BuildTotalsTeamMap,
  year: number
): PostStateTotalsByTeam {
  const totalsByTeam: PostStateTotalsByTeam = {};
  for (const [teamCode, team] of Object.entries(teamsByCode)) {
    const canonicalTeam = synchronizeTeamTotalsSnapshot(team, year) || team;
    totalsByTeam[teamCode] =
      canonicalTeam?.totals || computeTeamCapTotals(team, year);
  }
  return totalsByTeam;
}


export function prepareGeneralMutationPersistenceTeamSnapshot(
  team: CurrentStateTeamRoundTripMaterializable | null | undefined,
  seasonId: string
): GeneralMutationPersistenceTeamSnapshot {
  const persistenceReadyTeam = stripComputeOnlyTeamFieldsForPersistence(
    team as CurrentStateTeamPersistenceStripShape
  );
  const canonicalYear = toEndYear(seasonId);
  const totalsAlignedTeam = Number.isFinite(canonicalYear)
    ? backfillCurrentStateBaseTeamPreservedFields(
        synchronizeTeamTotalsSnapshot(persistenceReadyTeam, canonicalYear) ||
          persistenceReadyTeam,
        persistenceReadyTeam
      ) || persistenceReadyTeam
    : persistenceReadyTeam;
  const afterSanitize =
    sanitizeTransientFieldsForPersistence(totalsAlignedTeam);
  const afterTpeNormalize = normalizeTeamTpeSchema(afterSanitize);

  return afterTpeNormalize as GeneralMutationPersistenceTeamSnapshot;
}

export function buildGeneralMutationCommittedTeamSnapshot(
  team: CurrentStateTeamRoundTripMaterializable | null | undefined,
  seasonId: string
): GeneralMutationPersistenceTeamSnapshot {
  return removeUndefinedDeep(
    prepareGeneralMutationPersistenceTeamSnapshot(team, seasonId)
  ) as GeneralMutationPersistenceTeamSnapshot;
}

export function buildGeneralMutationCommittedTeamUpdates(
  teamUpdates: ArchitectMutationTeamUpdate[] | null | undefined,
  seasonId: string
): ArchitectGeneralMutationCommittedTeamUpdate[] {
  if (!Array.isArray(teamUpdates)) {
    return [];
  }

  return teamUpdates.map((update) => ({
    teamCode: update.teamCode,
    team: update?.team
      ? buildGeneralMutationCommittedTeamSnapshot(update.team, seasonId)
      : null,
  }));
}


// Wave 11 Step 1: dashboard reload normalizers extracted to submodule
export * from './mutationPipeline.read.dashboardNormalizers';
import {
  buildGeneralMutationDashboardReloadTeamSnapshot,
  normalizeDashboardReloadDeadCap,
  normalizeDashboardReloadExceptions,
  normalizeDashboardReloadOfferSheets,
  normalizeDashboardReloadPlayers,
} from './mutationPipeline.read.dashboardNormalizers';


export function canonicalizeTeamUpdatesWithCanonicalTotals(
  teamUpdates: ArchitectMutationTeamUpdate[] | null | undefined,
  seasonId: string
): ArchitectMutationTeamUpdate[] {
  const canonicalYear = toEndYear(seasonId);

  if (!Array.isArray(teamUpdates) || !Number.isFinite(canonicalYear)) {
    return Array.isArray(teamUpdates) ? teamUpdates : [];
  }

  return teamUpdates.map((update) => ({
    ...update,
    team: backfillCurrentStateBaseTeamPreservedFields(
      (synchronizeTeamTotalsSnapshot(update?.team, canonicalYear) ||
        update?.team) as CurrentStateTeamRoundTripMaterializable,
      update?.team as CurrentStateTeamRoundTripMaterializable
    ),
  }));
}

export function canonicalizeComputeResultTeamUpdates<T extends ComputeResultLike>(
  result: T,
  seasonId: string
): T {
  if (!Array.isArray(result?.teamUpdates) || result.teamUpdates.length === 0) {
    return result;
  }

  return {
    ...result,
    teamUpdates: canonicalizeTeamUpdatesWithCanonicalTotals(
      result.teamUpdates,
      seasonId
    ),
  };
}

export function collectMutationPlayerIds(
  payload: Pick<ArchitectMutationPayload, 'playerId' | 'teams'> = {},
  computeResult: MutationBridgePlayerIdSlice = {}
) {
  const playerIds = new Set();

  if (payload.playerId) {
    playerIds.add(String(payload.playerId));
  }

  for (const teamEntry of payload.teams || []) {
    for (const player of teamEntry.sends || []) {
      const playerId = player?.player_id || player?.id || player?.playerId;
      if (playerId) {
        playerIds.add(String(playerId));
      }
    }
  }

  for (const update of computeResult.playerUpdates || []) {
    if (update?.playerId) {
      playerIds.add(String(update.playerId));
    }
  }

  const tradedPlayerIds = Array.isArray(computeResult.metadata?.playersTraded)
    ? computeResult.metadata.playersTraded
    : [];
  for (const playerId of tradedPlayerIds) {
    if (playerId) {
      playerIds.add(String(playerId));
    }
  }

  return Array.from(playerIds);
}

export function buildPostStateRulesContext(
  year: number
): NonNullable<PostStateCapValidationInput['rulesContext']> {
  const capSettingsResult = getCapSettings({ year });
  const minimumTeamSalary = Number(capSettingsResult?.settings?.floor);

  return {
    capSettings: capSettingsResult?.settings || null,
    minimumTeamSalary: Number.isFinite(minimumTeamSalary)
      ? minimumTeamSalary
      : undefined,
    capSettingsSource: capSettingsResult?.source || null,
  };
}

export function buildCapAuditDiffSummary({
  beforeTeamsByCode = {},
  afterTeamsByCode = {},
}: {
  beforeTeamsByCode?: MutationTeamMap;
  afterTeamsByCode?: MutationTeamMap;
}): MutationDiffSummary {
  const teamCodes = Array.from(
    new Set([
      ...Object.keys(beforeTeamsByCode),
      ...Object.keys(afterTeamsByCode),
    ])
  );
  const changedPlayerIds = new Set();
  let deadCapChanged = 0;
  let exceptionsChanged = 0;

  for (const teamCode of teamCodes) {
    const beforeTeam = materializeCurrentStateTeamForAudit(
      beforeTeamsByCode[teamCode]
    );
    const afterTeam = materializeCurrentStateTeamForAudit(
      afterTeamsByCode[teamCode]
    );

    const beforeRoster = new Set((beforeTeam?.roster || []).map(String));
    const afterRoster = new Set((afterTeam?.roster || []).map(String));

    for (const playerId of beforeRoster) {
      if (!afterRoster.has(playerId)) {
        changedPlayerIds.add(playerId);
      }
    }
    for (const playerId of afterRoster) {
      if (!beforeRoster.has(playerId)) {
        changedPlayerIds.add(playerId);
      }
    }

    if (
      JSON.stringify(beforeTeam?.deadCap || []) !==
      JSON.stringify(afterTeam?.deadCap || [])
    ) {
      deadCapChanged += 1;
    }
    if (
      JSON.stringify(beforeTeam?.exceptions || {}) !==
      JSON.stringify(afterTeam?.exceptions || {})
    ) {
      exceptionsChanged += 1;
    }
  }

  return {
    playersMoved: changedPlayerIds.size,
    deadCapChanged,
    exceptionsChanged,
    teamsTouched: teamCodes.length,
  };
}

export const FREE_AGENCY_MUTATION_TYPES = new Set([
  'signFreeAgent',
  'signAndTrade',
  'storeOfferSheet',
  'matchOfferSheet',
  'declineOfferSheet',
  'finalizeMatchedOfferSheet',
  'finalizeDeclinedOfferSheet',
  'renounceRights',
]);



export function buildComputeWritesSummary(
  computeResult: MutationBridgeWritesSlice = {}
): WritesSummaryLike {
  const teamCodes = (computeResult.teamUpdates || [])
    .map((update) => String(update?.teamCode || '').trim())
    .filter(Boolean);
  const playerIds = collectPlayerTouchIds(computeResult);
  const entitlementIds = (computeResult.entitlementUpdates || [])
    .map((update) => String(update?.entitlementId || '').trim())
    .filter(Boolean);

  return {
    ...cloneWritesSummary(),
    teamsPatched: teamCodes.length,
    teamCodes,
    playersPatched: playerIds.length,
    playerIds,
    entitlementsPatched: entitlementIds.length,
    entitlementIds,
  };
}

export function buildMutationFailureResult(
  error: unknown,
  overrides: MutationFailureOverrides = {}
): ArchitectMutationResult {
  const {
    appliedToLocalState = false,
    persistedToWorld = false,
    eventWritten = false,
    writesSummary = EMPTY_WRITES_SUMMARY,
    ...restOverrides
  } = overrides;

  return {
    success: false,
    error: error as string | Error,
    appliedToLocalState,
    persistedToWorld,
    eventWritten,
    writesSummary: cloneWritesSummary(writesSummary || EMPTY_WRITES_SUMMARY),
    ...restOverrides,
  };
}

export function sanitizeStringList(input: unknown) {
  if (!Array.isArray(input)) {
    return [];
  }

  return input.map((value) => String(value || '').trim()).filter(Boolean);
}

export function collectPlayerTouchIds(
  computeResult: MutationBridgePlayerTouchSlice = {}
): string[] {
  const playerIds = new Set<string>();

  for (const update of computeResult.playerUpdates || []) {
    const playerId = String(update?.playerId || '').trim();
    if (playerId) {
      playerIds.add(playerId);
    }
  }

  for (const deletion of computeResult.playerDeletes || []) {
    const playerId = String(deletion?.playerId || '').trim();
    if (playerId) {
      playerIds.add(playerId);
    }
  }

  return Array.from(playerIds);
}

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
    // Legacy fields retained for compatibility with existing event consumers.
    eventId: stableEventId,
    id: stableEventId,
    type: canonicalMutationType,
    timestamp: occurredAt,
    seasonId,
    metadata,
    teamsAffected: teamCodes,

    // Cap Audit Event V1 envelope.
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
