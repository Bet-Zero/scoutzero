/**
 * FILE: src/features/architect/utils/mutationPipeline.types.result.ts
 * PURPOSE: Dashboard reload shapes, mutation result/event types, and helper functions.
 * OWNERSHIP: Feature: architect/core
 *
 * Wave 13 Step 3: Extracted from mutationPipeline.types.ts (L1266–L1826 of original).
 */

import type { PostStateCapValidationInput } from '@/features/architect/utils/capLegality/postStateCapValidator';
import type { CanonicalNonTpeExceptionKey } from '@/features/architect/utils/exceptions/exceptionOwnership';
import type { serverTimestamp } from 'firebase/firestore';
import type { validateSigning } from '@/features/architect/utils/capLegalityValidation';
import type {
  ArchitectMutationPayload,
  ArchitectMutationPlayerRecord,
  ArchitectMutationValidatedTradeContext,
  EntitlementUpdateLike,
  LooseRecord,
  TradeTpeConsumptionIssue,
} from './mutationPipeline.types.record';
import type {
  ArchitectMutationComputedTeamSnapshot,
  ArchitectMutationTeamUpdate,
  CurrentStateManualCapTeam,
  CurrentStateOfferSheetMirrorTeam,
  CurrentStateOfferSheetResolutionTeam,
  CurrentStatePlayer,
  CurrentStatePlayerContract,
  CurrentStatePlayerFutureContract,
  CurrentStatePlayerOpsTeam,
  CurrentStateSigningTeam,
  CurrentStateTeam,
  CurrentStateTeamRoundTripMaterializable,
  MaterializedCurrentStateTeam,
  TeamLike,
  TradeTeamLike,
} from './mutationPipeline.types.currentState';

export type GeneralMutationCommittedTeamSnapshotFrom<
  T extends CurrentStateTeamRoundTripMaterializable,
> = Omit<MaterializedCurrentStateTeam<T>, 'teamTotalSalary'>;
export type GeneralMutationCommittedTeamSnapshotCore =
  | GeneralMutationCommittedTeamSnapshotFrom<CurrentStatePlayerOpsTeam>
  | GeneralMutationCommittedTeamSnapshotFrom<CurrentStateManualCapTeam>
  | GeneralMutationCommittedTeamSnapshotFrom<CurrentStateSigningTeam>
  | GeneralMutationCommittedTeamSnapshotFrom<CurrentStateOfferSheetMirrorTeam>
  | GeneralMutationCommittedTeamSnapshotFrom<CurrentStateOfferSheetResolutionTeam>
  | GeneralMutationCommittedTeamSnapshotFrom<TradeTeamLike>;
export type ArchitectGeneralMutationCommittedTeamSnapshot =
  GeneralMutationCommittedTeamSnapshotCore &
    Partial<Omit<CurrentStateTeam, 'teamTotalSalary'>>;
export type ArchitectGeneralMutationCommittedTeamUpdate = {
  teamCode?: string | null;
  team?: ArchitectGeneralMutationCommittedTeamSnapshot | null;
};
export type GeneralMutationPersistenceTeamSnapshot =
  ArchitectGeneralMutationCommittedTeamSnapshot;
export type ArchitectGeneralMutationDashboardReloadDeadCapYear = {
  season: string;
  amount: number;
  isStretched?: boolean | null;
};
export type ArchitectGeneralMutationDashboardReloadDeadCapEntry = {
  id?: string | null;
  playerId?: string | null;
  playerName?: string | null;
  label?: string | null;
  originalSalary?: number | null;
  amountByYear?: ArchitectGeneralMutationDashboardReloadDeadCapYear[] | null;
  waiveDate?: string | null;
  notes?: string | null;
  stretched?: boolean | null;
};
export type ArchitectGeneralMutationDashboardReloadExceptionEntry = {
  type?: string | null;
  enabled?: boolean;
  available?: boolean;
  totalAmount?: number | null;
  maxAmount?: number | null;
  amount?: number | null;
  usedAmount?: number | null;
  remainingAmount?: number | null;
  createdFrom?: string | null;
  createdOn?: string | null;
  expiresOn?: string | null;
  notes?: string | null;
  seasonKey?: string | null;
  lastUsedAt?: string | null;
};
export type ArchitectGeneralMutationDashboardReloadTradeException = {
  id: string;
  totalAmount?: number | null;
  usedAmount?: number | null;
  remainingAmount?: number | null;
  createdFrom?: string | null;
  createdOn?: string | null;
  expiresOn?: string | null;
  notes?: string | null;
};
export type ArchitectGeneralMutationDashboardReloadExceptions = Partial<
  Record<
    CanonicalNonTpeExceptionKey | 'dpe',
    ArchitectGeneralMutationDashboardReloadExceptionEntry | null
  >
> & {
  tpe?: ArchitectGeneralMutationDashboardReloadTradeException[] | null;
};
export type ArchitectGeneralMutationDashboardReloadOfferSheet = {
  id?: string | number | null;
  playerName?: string;
  offeringTeamCode?: string;
  homeTeamCode?: string;
  dedupKey?: string;
  playerId?: string;
  seasonKey?: string;
  contractYears?: number | string | null;
  totalValue?: number | string | null;
  status: string;
  createdAt?: string | number | Date | null;
};
export type ArchitectGeneralMutationDashboardReloadContractFreeAgency = {
  year?: number | null;
  type?: string | null;
};
export type ArchitectGeneralMutationDashboardReloadBirdRights = {
  status: string;
  yearsOfService?: number | null;
  yearsWithTeam?: number | null;
  eligibleFor?: string[] | null;
};
export type ArchitectGeneralMutationDashboardReloadPlayerContract = Omit<
  CurrentStatePlayerContract,
  'signingDate' | 'freeAgency' | 'birdRights'
> & {
  signingDate?: string | null;
  birdRights?: ArchitectGeneralMutationDashboardReloadBirdRights | null;
  freeAgency?:
    | ArchitectGeneralMutationDashboardReloadContractFreeAgency
    | string
    | null;
};
export type ArchitectGeneralMutationDashboardReloadPlayerFutureContract = Omit<
  CurrentStatePlayerFutureContract,
  'signingDate' | 'freeAgency'
> & {
  signingDate?: string | null;
  freeAgency?:
    | ArchitectGeneralMutationDashboardReloadContractFreeAgency
    | string
    | null;
};
export type ArchitectGeneralMutationDashboardReloadPlayer = Omit<
  CurrentStatePlayer,
  'contract' | 'futureContract'
> & {
  contract?: ArchitectGeneralMutationDashboardReloadPlayerContract | null;
  futureContract?: ArchitectGeneralMutationDashboardReloadPlayerFutureContract | null;
};
// changedTeams is the dashboard reload artifact, not the persistence snapshot.
// It keeps only the fields the post-commit dashboard/state seam actually reads.
// Governed rights and contract ledgers are live authority for consecutive
// Full Cap Table decisions, so they must survive this committed reload seam.
export type ArchitectGeneralMutationDashboardReloadTeamSnapshot = Pick<
  ArchitectGeneralMutationCommittedTeamSnapshot,
  | 'roster'
  | 'capHolds'
  | 'rightsLedger'
  | 'contractEventLedgers'
  | 'totals'
  | 'exceptionHistory'
  | 'draftPicks'
  | 'entitlementIds'
  | 'hardCapLevel'
  | 'hardCapReason'
  | 'hardCapTriggeredBy'
> & {
  teamName?: string;
  players?: ArchitectGeneralMutationDashboardReloadPlayer[] | null;
  deadCap?: ArchitectGeneralMutationDashboardReloadDeadCapEntry[] | null;
  exceptions?: ArchitectGeneralMutationDashboardReloadExceptions | null;
  offerSheets?: ArchitectGeneralMutationDashboardReloadOfferSheet[] | null;
  incomingOfferSheets?:
    | ArchitectGeneralMutationDashboardReloadOfferSheet[]
    | null;
  hardCapped?: boolean | null;
  teamCode?: string;
};
export type ArchitectGeneralMutationDashboardReloadTeamUpdate = {
  teamCode?: string | null;
  team?: ArchitectGeneralMutationDashboardReloadTeamSnapshot | null;
};

export type MutationTeamMap = Record<string, TeamLike>;
export type BuildTotalsTeamMap = Record<
  string,
  TeamLike | ArchitectGeneralMutationCommittedTeamSnapshot | null | undefined
>;
export type MutationCurrentStateTeamEntry = {
  teamCode?: string | null;
  team?: TradeTeamLike | null;
};
export type ArchitectMutationPlayerUpdate = {
  playerId?: string | null;
  player?: ArchitectMutationPlayerRecord | null;
};
export type ArchitectMutationPlayerDelete = {
  playerId?: string | null;
  teamCode?: string | null;
};
export type ArchitectMutationWritesSummary = {
  teamsPatched: number;
  teamsWritten: number;
  teamCodes: string[];
  playersPatched: number;
  playersWritten: number;
  playerIds: string[];
  entitlementsPatched: number;
  entitlementsWritten: number;
  entitlementIds: string[];
  eventsWritten: number;
  eventWritten: boolean;
  eventIds: string[];
  worldMetadataPatched: number;
  worldStatsUpdated: boolean;
};
export type MutationDiffSummary = {
  playersMoved: number;
  deadCapChanged: number;
  exceptionsChanged: number;
  teamsTouched: number;
};
// Deliberately mixed: this aggregates issue payloads from multiple validators and
// invariant checks that do not yet share one cross-module issue contract.
export type MutationResultIssueLike = string | LooseRecord;
export type MutationEventContractSalaryRow = {
  season?: string | number | null;
  salary?: number | string | null;
  capHit?: number | string | null;
};
export type MutationEventContractLike = {
  salariesByYear?: readonly MutationEventContractSalaryRow[] | null;
  years?: number | string | null;
  contractYears?: number | string | null;
  contractLength?: number | string | null;
  firstYearSalary?: number | string | null;
  year1Salary?: number | string | null;
  totalValue?: number | string | null;
  signedUsing?: string | null;
};
export type MutationEventExtensionTermsLike = {
  salariesByYear?: readonly MutationEventContractSalaryRow[] | null;
  contractYears?: number | string | null;
  years?: number | string | null;
  firstYearSalary?: number | string | null;
};
export type MutationEventEntitlementTransferSummary = {
  out: readonly string[];
  in: readonly string[];
};
export type MutationEventEntitlementsMovedByTeam = Record<
  string,
  MutationEventEntitlementTransferSummary
>;
export type MutationEventMetadataLike = {
  playersTraded?: readonly (string | number | null | undefined)[] | null;
  teamsAffected?: readonly (string | number | null | undefined)[] | null;
  teamsInvolved?: readonly (string | number | null | undefined)[] | null;
  teamCodes?: readonly (string | number | null | undefined)[] | null;
  contract?: MutationEventContractLike | null;
  extensionTerms?: MutationEventExtensionTermsLike | null;
  extensionYears?: number | string | null;
  contractValue?: number | string | null;
  signedUsing?: string | null;
  picksTraded?: readonly (string | number | null | undefined)[] | null;
  entitlementsTraded?:
    | MutationEventEntitlementsMovedByTeam
    | readonly (string | number | null | undefined)[]
    | null;
  exceptionChanges?: readonly string[] | null;
  deadCapChanges?: readonly string[] | null;
  teamCode?: string | null;
  playerId?: string | number | null;
  playerName?: string | null;
  waivedPlayer?: string | null;
  renouncedPlayer?: string | null;
  rightsUsed?: string | null;
  birdRightsType?: string | null;
  freeAgentStatus?: string | null;
  rightOfFirstRefusal?: string | null;
  freeAgentAmountRemoved?: number | null;
  rightsLedgerId?: string | null;
  rightsLedgerVersion?: number | null;
  rightsStateId?: string | null;
  rightsStateVersion?: number | null;
  stretched?: boolean | null;
  buyout?: boolean | null;
  deadCapAmount?: number | string | null;
  optionType?: string | null;
  accepted?: boolean | null;
  summary?: string | null;
} & Record<string, unknown>;
export type ArchitectWorldMutationContractSummary = {
  years?: number;
  firstYearSalary?: number;
  totalValue?: number;
  startYear?: string;
  endYear?: string;
  signedUsing?: string;
};
export type ArchitectWorldMutationHistoryMetadata = {
  mutationType: string;
  category: string;
  worldId: string;
  teams: string[];
  players: string[];
  teamCode?: string;
  playerId?: string;
  playerName?: string;
  signedUsing?: string;
  rightsUsed?: string;
  birdRightsType?: string;
  freeAgentStatus?: string;
  rightOfFirstRefusal?: string;
  freeAgentAmountRemoved?: number;
  rightsLedgerId?: string;
  rightsLedgerVersion?: number;
  rightsStateId?: string;
  rightsStateVersion?: number;
  stretched?: boolean;
  buyout?: boolean;
  deadCapAmount?: number;
  extensionYears?: number;
  optionType?: string;
  accepted?: boolean;
  contract: ArchitectWorldMutationContractSummary;
  contractSummary: ArchitectWorldMutationContractSummary;
  summary?: string;
  picksMoved?: string[];
};
export type ArchitectWorldMutationEventDiffSummary = {
  playersMoved?: number | string[];
  deadCapChanged?: number;
  exceptionsChanged?: number;
  teamsTouched?: number;
  picksMoved?: string[];
  exceptionChanges?: string[];
  deadCapChanges?: string[];
};
export type ArchitectWorldMutationPatch = {
  lastModifiedAt: ReturnType<typeof serverTimestamp>;
  lastModifiedTeams: Array<string | null | undefined>;
  asOfDate?: string;
};
export type ArchitectWorldMutationEventBridge = Partial<
  Pick<ArchitectWorldMutationEvent, 'eventId' | 'id' | 'operationId'>
>;
export type ArchitectWorldMutationEvent = {
  eventId: string;
  id: string;
  type: string;
  timestamp: string;
  seasonId: string;
  metadata: MutationEventMetadataLike;
  teamsAffected: string[];
  schemaVersion: string;
  validatorVersion: string;
  operationId: string;
  mutationType: string;
  occurredAt: string;
  worldId: string;
  teamCodes: string[];
  playerIds: string[];
  beforeTotalsByTeam: NonNullable<
    PostStateCapValidationInput['beforeTotalsByTeam']
  >;
  afterTotalsByTeam: NonNullable<
    PostStateCapValidationInput['afterTotalsByTeam']
  >;
  valid: boolean;
  violations: string[];
  warnings: string[];
  diffSummary: ArchitectWorldMutationEventDiffSummary;
  mutationMetadata: ArchitectWorldMutationHistoryMetadata;
};
export type MutationAuditContext = {
  operationId?: string | null;
  validatorVersion?: string | null;
  schemaVersion?: string | null;
  mutationCategory?: string | null;
  teamCodes?: readonly string[];
  playerIds?: readonly string[];
  beforeTotalsByTeam?: NonNullable<
    PostStateCapValidationInput['beforeTotalsByTeam']
  >;
  afterTotalsByTeam?: NonNullable<
    PostStateCapValidationInput['afterTotalsByTeam']
  >;
  valid?: boolean | null;
  violations?: string[];
  warnings?: string[];
  diffSummary?: MutationDiffSummary;
};
export type ArchitectMutationResult = {
  success?: boolean;
  error?: string | Error | null;
  teamUpdates?: ArchitectMutationTeamUpdate[];
  playerUpdates?: ArchitectMutationPlayerUpdate[];
  playerDeletes?: ArchitectMutationPlayerDelete[];
  entitlementUpdates?: EntitlementUpdateLike[];
  metadata?: MutationEventMetadataLike;
  warnings?: MutationResultIssueLike[];
  violations?: MutationResultIssueLike[];
  writesSummary?: ArchitectMutationWritesSummary;
  changedTeams?: ArchitectGeneralMutationCommittedTeamUpdate[];
  changedPlayers?: ArchitectMutationPlayerUpdate[];
  worldPatch?: ArchitectWorldMutationPatch;
  event?: ArchitectWorldMutationEventBridge;
  appliedToLocalState?: boolean;
  persistedToWorld?: boolean;
  eventWritten?: boolean;
  _validatedTradeContext?: ArchitectMutationValidatedTradeContext;
  _signingValidation?: ReturnType<typeof validateSigning>;
  _tpeConsumptionErrors?: TradeTpeConsumptionIssue[];
};

/**
 * Compute-time lookup for local-validated flows. Committed dashboard reload
 * paths should use findCommittedTeamSnapshot so they receive the post-persistence
 * committed team artifact instead of the compute-time team update shape.
 */
export function findUpdatedTeamSnapshot(
  teamUpdates: ArchitectMutationTeamUpdate[] | null | undefined,
  targetTeamCode: string
): ArchitectMutationComputedTeamSnapshot | null {
  const matchingUpdate = (teamUpdates || []).find(
    (update) => update?.teamCode === targetTeamCode && update?.team
  );

  return (
    (matchingUpdate?.team as
      | ArchitectMutationComputedTeamSnapshot
      | null
      | undefined) || null
  );
}

/**
 * Post-commit propagation order for general world mutations:
 * 1. Reuse the matching dashboard reload snapshot from `changedTeams` when available.
 * 2. If that direct snapshot is missing, reload a committed team snapshot through the read stack.
 * 3. Hand the reload snapshot to the dashboard/state resync seam so metadata
 *    patching, roster refresh, and stale-drop rules stay state-owned.
 */
export function findCommittedTeamSnapshot(
  teamUpdates: ArchitectGeneralMutationCommittedTeamUpdate[] | null | undefined,
  targetTeamCode: string
): ArchitectGeneralMutationCommittedTeamSnapshot | null {
  const matchingUpdate = (teamUpdates || []).find(
    (update) => update?.teamCode === targetTeamCode && update?.team
  );

  return matchingUpdate?.team || null;
}

export type SignAndTradePreflightStatus = 'legal' | 'blocked' | 'incomplete';
export type SignAndTradePreflightResult = {
  status: SignAndTradePreflightStatus;
  reasons: string[];
  warnings: string[];
  source: 'authoritative-preflight';
};
export type OfferSheetPreflightStatus = 'legal' | 'blocked' | 'incomplete';
export type OfferSheetPreflightResult = {
  status: OfferSheetPreflightStatus;
  reasons: string[];
  warnings: string[];
  source: 'authoritative-preflight';
};
export type MutationPayloadLike = ArchitectMutationPayload;
export type PlayerUpdateLike = ArchitectMutationPlayerUpdate;
export type PlayerDeleteLike = ArchitectMutationPlayerDelete;
export type WritesSummaryLike = ArchitectMutationWritesSummary;
export type TradeValidatedContextLike = ArchitectMutationValidatedTradeContext;
export type TradeTeamUpdate = ArchitectMutationTeamUpdate;
export type ArchitectMutationBridgeResult = {
  success?: boolean;
  error?: string | Error | null;
  teamUpdates?: ArchitectMutationTeamUpdate[];
  playerUpdates?: ArchitectMutationPlayerUpdate[];
  playerDeletes?: ArchitectMutationPlayerDelete[];
  entitlementUpdates?: EntitlementUpdateLike[];
  metadata?: MutationEventMetadataLike;
  warnings?: MutationResultIssueLike[];
  violations?: MutationResultIssueLike[];
  _validatedTradeContext?: ArchitectMutationValidatedTradeContext;
  _signingValidation?: ReturnType<typeof validateSigning>;
  _tpeConsumptionErrors?: TradeTpeConsumptionIssue[];
};
export type PersistWorldMutationResult = {
  success: boolean;
  error?: string | Error | null;
  worldPatch?: ArchitectWorldMutationPatch;
  event?: ArchitectWorldMutationEventBridge;
  writesSummary?: WritesSummaryLike;
};
export type MutationBridgeTeamUpdatesSlice = Pick<
  ArchitectMutationBridgeResult,
  'teamUpdates'
>;
export type MutationBridgePlayerTouchSlice = Pick<
  ArchitectMutationBridgeResult,
  'playerUpdates' | 'playerDeletes'
>;
export type MutationBridgeWritesSlice = Pick<
  ArchitectMutationBridgeResult,
  'teamUpdates' | 'playerUpdates' | 'playerDeletes' | 'entitlementUpdates'
>;
export type MutationBridgePlayerIdSlice = Pick<
  ArchitectMutationBridgeResult,
  'playerUpdates' | 'metadata'
>;
export type MutationEventSourceResult = Pick<
  ArchitectMutationBridgeResult,
  'metadata' | 'teamUpdates' | 'playerUpdates' | 'playerDeletes'
>;
export type MutationFailureOverrides = Pick<
  ArchitectMutationResult,
  | 'appliedToLocalState'
  | 'persistedToWorld'
  | 'eventWritten'
  | 'writesSummary'
  | 'violations'
  | 'warnings'
>;
export type ComputeResultLike = ArchitectMutationBridgeResult;
export type AuditContextLike = MutationAuditContext;
export type PostStateTotalsByTeam = NonNullable<
  PostStateCapValidationInput['afterTotalsByTeam']
>;
export type SupportedComputeMutationType =
  | 'executeTrade'
  | 'signFreeAgent'
  | 'waivePlayer'
  | 'extendPlayer'
  | 'optionDecision'
  | 'renounceRights'
  | 'storeOfferSheet'
  | 'matchOfferSheet'
  | 'declineOfferSheet'
  | 'finalizeMatchedOfferSheet'
  | 'finalizeDeclinedOfferSheet'
  | 'signAndTrade'
  | 'setDeadCap'
  | 'setExceptions';
