/**
 * FILE: src/features/architect/GMDashboard/hooks/useArchitectActions.helpers.ts
 * PURPOSE: Pure helper functions for useArchitectActions hook (no React).
 * OWNERSHIP: Feature: architect/GMDashboard
 *
 * Wave 6 Step 2: Extracted from useArchitectActions.ts (L185-L1099).
 */

import {
  toEndYear,
  toSeasonCode,
} from '@/features/architect/utils/seasonFormat';
import { computeTeamCapTotals } from '@/features/architect/utils/capTotals';
import { synchronizeTeamTotalsSnapshot } from '@/features/architect/utils/capTotals/computeTeamCapTotals';
import {
  POST_STATE_CAP_VALIDATOR_VERSION,
  validatePostStateCapLegality,
} from '@/features/architect/utils/capLegality/postStateCapValidator';
import type {
  ArchitectMutationPayload,
  SignAndTradePreflightResult,
  OfferSheetPreflightResult,
  ArchitectGeneralMutationDashboardReloadTeamSnapshot,
} from '@/features/architect/utils/mutationPipeline';
import type { CapAuditEventV1Like } from '@/features/architect/utils/capLegality/localCapAuditLog';
import type { PlayerRulesProfileInput } from '@/features/architect/types';
import type { ReloadActiveWorldMetadataPatch } from './useArchitectState';
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


// Helper to ensure contract has proper structure
export const ensureContractStructure = (
  contract: LocalContract | null | undefined,
  overrides: Partial<LocalContract> = {}
): LocalContract | null => {
  if (!contract) return null;

  const mutableOverrides: Partial<LocalContract> = { ...overrides };
  const startYearOverride = Number(
    mutableOverrides.startYear ?? contract.startYear ?? contract.year
  );
  delete mutableOverrides.startYear;

  // If contract already has salariesByYear array, use it directly
  if (contract.salariesByYear && Array.isArray(contract.salariesByYear)) {
    return {
      ...contract,
      ...mutableOverrides,
    };
  }

  // Legacy UI payload fallback: convert salaries[] to canonical salariesByYear[]
  const legacySalaries = contract.salaries;
  if (Array.isArray(legacySalaries) && legacySalaries.length > 0) {
    const yearsRaw = Number(contract.years) || legacySalaries.length;
    const years = Math.max(1, Math.min(yearsRaw, legacySalaries.length));
    const startYear = Number.isFinite(startYearOverride)
      ? startYearOverride
      : new Date().getFullYear();

    const salariesByYear = legacySalaries.slice(0, years).map((row, idx) => {
      const salaryRaw =
        typeof row === 'number'
          ? row
          : typeof row === 'string'
            ? Number(row)
            : Number(row?.salary);
      const salary = Number.isFinite(salaryRaw) ? Math.round(salaryRaw) : 0;
      return {
        season: toSeasonCode(startYear + idx),
        salary,
        capHit: salary,
        guaranteed: true,
        guaranteedAmount: salary,
        option: null,
        optionType: null,
        optionUsed: null,
      };
    });

    return {
      ...contract,
      ...mutableOverrides,
      salariesByYear,
    };
  }

  // If no contract data, return null
  return null;
};

export const deriveSigningMechanism = (
  contract: SigningDetails | null | undefined
): string | null => {
  const signedUsingRaw = contract?.signedUsing ?? contract?.exceptionType;
  const normalized =
    typeof signedUsingRaw === 'string' ? signedUsingRaw.trim() : '';
  if (!normalized || normalized.toLowerCase() === 'none') {
    return null;
  }
  return normalized;
};

export const MINIMUM_SIGNING_HEURISTIC = 2_200_000;

export function hasStagedScalarSigningSalaries(
  contract: SigningDetails | LocalContract | null | undefined
): contract is SigningDetails & { salaries: LocalContractLegacySalaryInput[] } {
  return Array.isArray(contract?.salaries) && contract.salaries.length > 0;
}

export function stripPrebuiltSigningRowsForAuthority(
  contract: SigningDetails | null | undefined
): LocalContract | null {
  if (!contract) {
    return null;
  }

  if (!hasStagedScalarSigningSalaries(contract)) {
    return contract as LocalContract;
  }

  const { salariesByYear: _ignoredPrebuiltRows, ...stagedContract } =
    contract as LocalContract;
  return stagedContract;
}

export function normalizeFiniteNumber(value: unknown): number | null {
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : null;
}

export function deriveSigningYearsOfService(
  playerObj: ArchitectPlayer,
  contract: SigningDetails | null | undefined
): number | null {
  const candidates = [
    contract?.yearsOfService,
    playerObj.yearsOfService,
    playerObj.yearsPro,
    playerObj.experience,
    playerObj.years_of_service,
    playerObj.bio?.experience,
    playerObj.bio?.yearsExperience,
    playerObj.bio?.['Years Pro'],
  ];

  for (const candidate of candidates) {
    const normalized = normalizeFiniteNumber(candidate);
    if (normalized !== null) {
      return normalized;
    }
  }

  return null;
}

export type AuthoritativeSigningPreparationOverrides = Partial<LocalContract> & {
  contractType: string;
};

export type PreparedAuthoritativeSigningDetails = {
  actionSeasonContext: ReturnType<typeof buildActionSeasonContext>;
  architectContract: LocalContract | null;
  signedUsing: string | null;
};

export type StandardSigningMutationPayload = ArchitectMutationPayload & {
  teamCode: string;
  playerId: string;
  contract: LocalContract;
  signedUsing: string | null;
};

export type PreparedStandardSigningDetails = {
  actionSeasonContext: ReturnType<typeof buildActionSeasonContext>;
  standardSigningPayload: StandardSigningMutationPayload | null;
};

export type SignAndTradeMutationPayload = ArchitectMutationPayload & {
  teamCode: string;
  destinationTeamCode: string;
  playerId: string;
  contract: LocalContract;
  signedUsing: string | null;
  signAndTrade: true;
};

export type SignAndTradeTransactionPreparationFailure = {
  ok: false;
  message: string;
  preflightResult: SignAndTradePreflightResult;
  logContext?: Record<string, unknown>;
};

export type PreparedSignAndTradeTransactionDefinition =
  | {
      ok: true;
      actionSeasonContext: ReturnType<typeof buildActionSeasonContext>;
      mutationPayload: SignAndTradeMutationPayload;
    }
  | SignAndTradeTransactionPreparationFailure;

export type OfferSheetCreationDefinitionFailure = {
  ok: false;
  storeMessage: string;
  preflightResult: OfferSheetPreflightResult;
  logContext?: Record<string, unknown>;
};

export type OfferSheetMutationPayload = ArchitectMutationPayload & {
  teamCode: string;
  playerId: string;
  contract: LocalContract;
  signedUsing: string | null;
};

export type PreparedOfferSheetCreationDefinition =
  | {
      ok: true;
      actionSeasonContext: ReturnType<typeof buildActionSeasonContext>;
      preflightPayload: {
        offeringTeamCode: string;
        playerId: string;
        contract: LocalContract;
      };
      mutationPayload: OfferSheetMutationPayload;
    }
  | OfferSheetCreationDefinitionFailure;

export type DashboardMutationPropagationMode = 'world-committed' | 'local-validated';
export type WorldCommittedTeamSource = 'changedTeams' | 'reload';
export const toDashboardCommittedTeamSnapshot = (
  team: ArchitectGeneralMutationDashboardReloadTeamSnapshot
): DashboardCommittedTeamSnapshot =>
  ({
    ...team,
    hardCapped:
      typeof team.hardCapped === 'boolean' ? team.hardCapped : undefined,
  }) as DashboardCommittedTeamSnapshot;

/**
 * Dashboard post-mutation propagation lane.
 * - `world-committed`: authoritative world persistence already succeeded, so
 *   visible reapply must go back through the committed-world reload/state seam.
 * - `local-validated`: no authoritative world write exists, so the validated
 *   local snapshot can be applied directly by the action layer.
 */
export type WorldCommittedTeamPropagation = {
  propagationMode: 'world-committed';
  committedTeam: DashboardCommittedTeamSnapshot;
  committedTeamSource: WorldCommittedTeamSource;
};
export type CommittedWorldReloadSeed = Pick<
  WorldCommittedTeamPropagation,
  'committedTeam' | 'committedTeamSource'
>;
export type LocalValidatedTeamPropagation = {
  propagationMode: 'local-validated';
  localValidatedTeam: CapSheet;
  localValidatedTeamSource: 'compute';
};
export type ResolvedCommittedWorldTeam = WorldCommittedTeamPropagation;
export type CommittedWorldReloadPlan = {
  committedWorldTeam: ResolvedCommittedWorldTeam;
  committedWorldMetadata: ReloadActiveWorldMetadataPatch | null;
  refreshRosterBundle: boolean;
};
export type CommittedWorldReloadResult =
  | {
      status: 'applied';
      committedWorldTeam: ResolvedCommittedWorldTeam;
    }
  | {
      status: 'stale-drop';
    };

export type WorldCommittedStandardSigningPropagation = {
  propagationMode: 'world-committed';
  reloadPlan: CommittedWorldReloadPlan;
};
export type StandardSigningResolvedState =
  | WorldCommittedStandardSigningPropagation
  | LocalValidatedTeamPropagation;

export type StandardSigningExecutionResult =
  | ({ success: true } & StandardSigningResolvedState)
  | {
      success: false;
      message: string;
    };

export type SignAndTradeExecutionResult =
  | ({ success: true } & WorldCommittedTeamPropagation)
  | {
      success: false;
      message: string;
    };

export type StandardSigningExecutionRoute = {
  mode: 'world' | 'vacuum';
  execute: (
    playerObj: ArchitectPlayer,
    actionSeasonContext: ReturnType<typeof buildActionSeasonContext>,
    standardSigningPayload: StandardSigningMutationPayload
  ) => Promise<StandardSigningExecutionResult>;
};

export type FreeAgencyWorldOnlyActionKind =
  | 'signAndTrade'
  | 'offerSheetCreation'
  | 'offerSheetLifecycle';

export type FreeAgencyWorldOnlyActionPhase = 'commit' | 'preview';

export type FreeAgencyWorldOnlyRequirement = {
  message: string;
};

export type FreeAgencyWorldOnlyRequirementTable = Record<
  FreeAgencyWorldOnlyActionKind,
  Partial<
    Record<FreeAgencyWorldOnlyActionPhase, FreeAgencyWorldOnlyRequirement>
  >
>;

export const FREE_AGENCY_WORLD_ONLY_REQUIREMENTS: FreeAgencyWorldOnlyRequirementTable =
  {
    signAndTrade: {
      commit: {
        message: 'Sign-and-trade requires an active world to commit.',
      },
      preview: {
        message: 'Sign-and-trade requires an active world to preview.',
      },
    },
    offerSheetCreation: {
      commit: {
        message: 'Offer sheet actions require an active world to commit.',
      },
      preview: {
        message: 'Offer sheet actions require an active world to preview.',
      },
    },
    offerSheetLifecycle: {
      commit: {
        message:
          'Offer-sheet lifecycle actions require an active world to commit.',
      },
    },
  };

export function isSignAndTradeTransactionPreparationFailure(
  value: PreparedSignAndTradeTransactionDefinition
): value is SignAndTradeTransactionPreparationFailure {
  return value.ok === false;
}

export function isOfferSheetCreationDefinitionFailure(
  value: PreparedOfferSheetCreationDefinition
): value is OfferSheetCreationDefinitionFailure {
  return value.ok === false;
}

export function resolveSeasonEndYear(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = toEndYear(value);
    return typeof parsed === 'number' && Number.isFinite(parsed)
      ? parsed
      : null;
  }

  return null;
}

export function deriveContractActionYear(
  contract: Partial<LocalContract> | null | undefined,
  fallbackYear: number
): number {
  const salaryRows = Array.isArray(contract?.salariesByYear)
    ? contract.salariesByYear
    : [];
  const firstSeasonValue = salaryRows.find(
    (row) => row?.season != null
  )?.season;
  const fromSeasonRow = resolveSeasonEndYear(firstSeasonValue);

  if (fromSeasonRow !== null) {
    return fromSeasonRow;
  }

  const fromStartYear = resolveSeasonEndYear(
    contract?.startYear ?? contract?.year
  );
  return fromStartYear ?? fallbackYear;
}

export function buildActionSeasonContext(
  contract: Partial<LocalContract> | null | undefined,
  fallbackYear: number
) {
  const actionYear = deriveContractActionYear(contract, fallbackYear);
  return {
    actionYear,
    seasonId: toSeasonCode(actionYear),
  };
}

export function buildBlockedSignAndTradePreflightResult(
  message: string
): SignAndTradePreflightResult {
  return {
    status: 'blocked',
    reasons: [message],
    warnings: [],
    source: 'authoritative-preflight',
  };
}

export function buildOfferSheetPreflightResult(
  status: OfferSheetPreflightResult['status'],
  message: string
): OfferSheetPreflightResult {
  return {
    status,
    reasons: [message],
    warnings: [],
    source: 'authoritative-preflight',
  };
}

export function buildSignAndTradeTransactionPreparationFailure(
  message: string,
  logContext?: Record<string, unknown>
): SignAndTradeTransactionPreparationFailure {
  return {
    ok: false,
    message,
    preflightResult: buildBlockedSignAndTradePreflightResult(message),
    logContext,
  };
}

export function buildOfferSheetCreationDefinitionFailure(
  preflightStatus: OfferSheetPreflightResult['status'],
  preflightMessage: string,
  storeMessage: string,
  logContext?: Record<string, unknown>
): OfferSheetCreationDefinitionFailure {
  return {
    ok: false,
    storeMessage,
    preflightResult: buildOfferSheetPreflightResult(
      preflightStatus,
      preflightMessage
    ),
    logContext,
  };
}

export function buildYearSeasonContext(year: unknown, fallbackYear: number) {
  const actionYear = resolveSeasonEndYear(year) ?? fallbackYear;
  return {
    actionYear,
    seasonId: toSeasonCode(actionYear),
  };
}

export function getFreeAgencyWorldOnlyRequirement(
  kind: FreeAgencyWorldOnlyActionKind,
  phase: FreeAgencyWorldOnlyActionPhase
): FreeAgencyWorldOnlyRequirement {
  const requirement = FREE_AGENCY_WORLD_ONLY_REQUIREMENTS[kind]?.[phase];
  if (!requirement) {
    throw new Error(
      `Missing Free Agency world-only requirement for ${kind}:${phase}`
    );
  }
  return requirement;
}

export const OFFER_SHEET_WORLD_REQUIRED_MESSAGE = getFreeAgencyWorldOnlyRequirement(
  'offerSheetLifecycle',
  'commit'
).message;

export type RenounceActionTarget =
  | PlayerRulesProfileInput
  | ArchitectPlayer
  | CapHoldActionItem;

export function isCapHoldTarget(
  value: RenounceActionTarget
): value is CapHoldActionItem {
  return 'playerName' in value || 'amount' in value;
}

export function getRenounceTargetDisplayName(target: RenounceActionTarget): string {
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
  year: number
): CapAuditEventV1Like['beforeTotalsByTeam'] {
  const totalsByTeam: CapAuditEventV1Like['beforeTotalsByTeam'] = {};
  for (const [teamCode, team] of Object.entries(teamsByCode || {})) {
    const canonicalTeam = synchronizeTeamTotalsSnapshot(team, year);
    totalsByTeam[teamCode] =
      canonicalTeam?.totals || computeTeamCapTotals(team, year);
  }
  return totalsByTeam;
}

export function buildCapAuditEvaluation(params: {
  operationId: string;
  occurredAt: string;
  mutationType: string;
  worldId: string | null;
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

  const beforeTotalsByTeam = buildTotalsByTeam(beforeTeamsByCode, year);
  const afterTotalsByTeam = buildTotalsByTeam(afterTeamsByCode, year);
  const validation = validatePostStateCapLegality({
    operationId,
    mutationType,
    worldId: worldId || BASE_MODE_VALIDATOR_WORLD_ID,
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

export function buildCommittedOfferSheetIdentity(params: {
  result: PersistMutationResult;
  playerId: string;
  seasonKey: string;
  offeringTeamCode: string;
}): OfferSheetCommittedIdentity {
  const metadata = (params.result.metadata ||
    null) as OfferSheetMutationMetadata | null;

  return {
    dedupKey: toTrimmedStringOrNull(metadata?.dedupKey),
    offerSheetId: toTrimmedStringOrNull(metadata?.offerSheetId),
    playerId: params.playerId,
    seasonKey: params.seasonKey,
    offeringTeamCode: params.offeringTeamCode,
    status: 'PENDING_MATCH',
  };
}

export function matchesCommittedOfferSheetIdentity(
  offerSheet: OfferSheet | null | undefined,
  identity: OfferSheetCommittedIdentity
): boolean {
  if (!offerSheet) {
    return false;
  }

  const entryDedupKey = toTrimmedStringOrNull(offerSheet.dedupKey);
  if (identity.dedupKey && entryDedupKey === identity.dedupKey) {
    return true;
  }

  const entryOfferSheetId = toTrimmedStringOrNull(offerSheet.id);
  if (identity.offerSheetId && entryOfferSheetId === identity.offerSheetId) {
    return true;
  }

  return (
    toTrimmedStringOrNull(offerSheet.playerId) === identity.playerId &&
    toTrimmedStringOrNull(offerSheet.seasonKey) === identity.seasonKey &&
    toTrimmedStringOrNull(offerSheet.offeringTeamCode) ===
      identity.offeringTeamCode &&
    String(offerSheet.status || '').trim() === identity.status
  );
}

export function buildCommittedOfferSheetLifecycleIdentity(params: {
  result: PersistMutationResult;
  fallbackIdentity: OfferSheetLifecycleCommittedIdentityInput;
}): OfferSheetLifecycleCommittedIdentity {
  const metadata = (params.result.metadata ||
    null) as OfferSheetMutationMetadata | null;

  return {
    dedupKey: toTrimmedStringOrNull(
      metadata?.dedupKey ?? params.fallbackIdentity.dedupKey
    ),
    offerSheetId: toTrimmedStringOrNull(
      metadata?.offerSheetId ?? params.fallbackIdentity.offerSheetId
    ),
    playerId: toTrimmedStringOrNull(
      metadata?.playerId ?? params.fallbackIdentity.playerId
    ),
    seasonKey: toTrimmedStringOrNull(
      metadata?.seasonKey ?? params.fallbackIdentity.seasonKey
    ),
    offeringTeamCode: toTrimmedStringOrNull(
      metadata?.offeringTeamCode ??
        metadata?.offeringTeam ??
        params.fallbackIdentity.offeringTeamCode
    ),
    homeTeamCode: toTrimmedStringOrNull(
      metadata?.homeTeamCode ??
        metadata?.homeTeam ??
        params.fallbackIdentity.homeTeamCode
    ),
    status: toTrimmedStringOrNull(
      metadata?.status ?? params.fallbackIdentity.status
    ),
  };
}

export function matchesCommittedOfferSheetLifecycleIdentity(
  offerSheet: OfferSheet | null | undefined,
  identity: OfferSheetLifecycleCommittedIdentity
): boolean {
  if (!offerSheet) {
    return false;
  }

  const entryDedupKey = toTrimmedStringOrNull(offerSheet.dedupKey);
  const entryOfferSheetId = toTrimmedStringOrNull(offerSheet.id);
  const entryPlayerId = toTrimmedStringOrNull(offerSheet.playerId);
  const entrySeasonKey = toTrimmedStringOrNull(offerSheet.seasonKey);
  const entryOfferingTeamCode = toTrimmedStringOrNull(
    offerSheet.offeringTeamCode
  );
  const entryHomeTeamCode = toTrimmedStringOrNull(offerSheet.homeTeamCode);
  const entryStatus = toTrimmedStringOrNull(offerSheet.status);

  const identityByPrimaryKey =
    (identity.dedupKey && entryDedupKey === identity.dedupKey) ||
    (identity.offerSheetId && entryOfferSheetId === identity.offerSheetId);
  const identityByFallbackTruth =
    Boolean(
      identity.playerId ||
        identity.seasonKey ||
        identity.offeringTeamCode ||
        identity.homeTeamCode
    ) &&
    (!identity.playerId || entryPlayerId === identity.playerId) &&
    (!identity.seasonKey || entrySeasonKey === identity.seasonKey) &&
    (!identity.offeringTeamCode ||
      entryOfferingTeamCode === identity.offeringTeamCode) &&
    (!identity.homeTeamCode || entryHomeTeamCode === identity.homeTeamCode);

  if (!identityByPrimaryKey && !identityByFallbackTruth) {
    return false;
  }

  if (identity.status && entryStatus !== identity.status) {
    return false;
  }

  return true;
}

export function filterSignedPlayerFromFreeAgents<
  T extends {
    name?: unknown;
    id?: unknown;
    player_id?: unknown;
  },
>(freeAgents: T[], playerObj: ArchitectPlayer): T[] {
  return freeAgents.filter(
    (player) =>
      player.name !== playerObj.name &&
      player.id !== playerObj.id &&
      player.player_id !== playerObj.player_id
  );
}

