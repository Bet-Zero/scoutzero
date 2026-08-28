import type {
  TradeTeamResult,
  TradeValidationResult,
  TradeValidatorCapProjections,
  TradeValidatorContext,
  TradeExceptionPlayer,
  TradeTeam,
  ValidationIssue as TradeValidationIssue,
} from '@/features/architect/utils/tradeMachine/constants/types';
import type {
  ArchitectMutationTeamRecord,
  ArchitectTradePayloadPlayer,
  ArchitectTradePayloadTeam,
} from '@/features/architect/utils/mutationPipeline';
import type { GovernedCashSnapshotReceipt } from '@/schemas/governedCashConsideration';
import type { TradeSalaryMatchingElection } from '@/schemas/tradeSalaryMatchingPath';
import type { GovernedTradeSalaryBasis } from '@/schemas/governedTradeSalaryBasis';
import type {
  GovernedSignAndTradeAuthority,
  GovernedSignAndTradeProposal,
} from '@/schemas/governedSignAndTrade';

// Local object-shape carrier for snapshot-building compatibility paths.
// Validator output is narrowed below to the exact live trade bridge contract.
export type AnyRecord = Record<string, unknown>;

export interface TeamUpdate {
  teamCode: string | null;
  team: ArchitectMutationTeamRecord;
}

export type ValidationIssue = TradeValidationIssue;

export type TeamResult = TradeTeamResult;
type TradeContextScalarId = string | number | null | undefined;
export type TradeContextValidationPlayer = TradeExceptionPlayer &
  Pick<ArchitectTradePayloadPlayer, 'signAndTradeContract'> &
  Record<string, unknown>;

export interface ValidationTeam {
  team: NonNullable<TradeTeam['team']>;
  teamCode: string | null;
  sends: TradeContextValidationPlayer[];
  receives: TradeContextValidationPlayer[];
  picksOut: NonNullable<ArchitectTradePayloadTeam['picksOut']>;
  picksIn: NonNullable<ArchitectTradePayloadTeam['picksOut']>;
  entitlementsOut: NonNullable<ArchitectTradePayloadTeam['entitlementsOut']>;
  cashSent: number;
  cashReceived?: number;
  cashToTeamId?: string | null;
  salaryMatchingElection?: TradeSalaryMatchingElection | null;
}

export interface TradeApplyValidationPlayer {
  player_id?: string | null;
  id?: string | null;
  playerId?: string | null;
  name?: string | null;
  displayName?: string | null;
  playerName?: string | null;
  absorptionMode?: string | null;
  tpeId?: string | null;
  matchIncoming?: number;
}

export interface TradeApplyValidationTeam {
  teamCode: string | null;
  receives: TradeApplyValidationPlayer[];
}

export interface PostTradeSnapshot {
  teamUpdates: TeamUpdate[];
  validationTeams: ValidationTeam[];
  payloadTeams: ArchitectTradePayloadTeam[];
  _isPostTradeSnapshot?: boolean;
}

export type ValidatedTradeContext = Pick<
  TradeValidationResult,
  'legal' | 'reason' | 'error' | 'violations' | 'warnings'
> & {
  teamResults: TeamResult[];
  validationTeams: TradeApplyValidationTeam[];
  _rawValidation?: TradeValidationResult;
  _isValidatedTradeContext: true;
};

export type PayloadTeam = ArchitectTradePayloadTeam;

export interface PayloadPlayerIngress {
  player_id?: TradeContextScalarId;
  id?: TradeContextScalarId;
  playerId?: TradeContextScalarId;
  name?: string | null;
  displayName?: string | null;
  playerName?: string | null;
  originTeamId?: TradeContextScalarId;
  matchIncoming?: number | string | null;
  matchOutgoing?: number | string | null;
  absorptionMode?: string | null;
  tpeId?: string | number | null;
  isTwoWay?: boolean | null;
  signAndTrade?: boolean;
  signAndTradeContract?: ArchitectTradePayloadPlayer['signAndTradeContract'];
  governedSignAndTradeProposal?: GovernedSignAndTradeProposal | null;
  governedSignAndTradeAuthority?: GovernedSignAndTradeAuthority | null;
  governedTradeSalaryBasis?: GovernedTradeSalaryBasis | null;
  receivingTeamIndex?: TradeContextScalarId;
  receivingTeamId?: TradeContextScalarId;
  tradeTo?: TradeContextScalarId;
  toTeamId?: TradeContextScalarId;
  destTeamId?: TradeContextScalarId;
}

export interface PayloadEntitlementIngress {
  entitlementId?: TradeContextScalarId;
  id?: TradeContextScalarId;
  type?: string | null;
  kind?: string | null;
  name?: string | null;
  seasonYear?: number | string | null;
  year?: number | string | null;
  round?: number | string | null;
  terms?: {
    round?: number | string | null;
  } | null;
  toTeamId?: TradeContextScalarId;
}

export interface PayloadTeamIngress {
  team?: {
    id?: TradeContextScalarId;
    teamCode?: TradeContextScalarId;
  } | null;
  teamCode?: TradeContextScalarId;
  teamId?: TradeContextScalarId;
  sends?: PayloadPlayerIngress[];
  receives?: PayloadPlayerIngress[];
  receiving?: Array<Record<string, unknown>>;
  playersReceiving?: Array<Record<string, unknown>>;
  outgoingEntitlements?: PayloadEntitlementIngress[];
  incomingEntitlements?: PayloadEntitlementIngress[];
  entitlementsOut?: PayloadEntitlementIngress[];
  picksOut?: ArchitectTradePayloadTeam['picksOut'];
  picksIn?: unknown[];
  cashSent?: number | null;
  cashReceived?: number | null;
  cashToTeamId?: TradeContextScalarId;
  salaryMatchingElection?: TradeSalaryMatchingElection | null;
}

export interface TradeContextTradeBridge {
  worldId?: TradeValidatorContext['worldId'] | null;
  source?: TradeValidatorContext['source'] | null;
  asOfDate?: string | number | null;
  tradeDate?: TradeValidatorContext['tradeDate'] | null;
  yearKey?: number | string | null;
  // Compatibility passthrough for existing public callers; tradeContext does not read this field.
  seasonId?: string | null;
  offseason?: boolean | null;
  enforceSignAndTradePreflight?: boolean | null;
}

export interface TradeContextPayload {
  teams: PayloadTeamIngress[];
  capProjections?: TradeValidatorCapProjections | null;
  tradeCtx?: TradeContextTradeBridge | null;
  asOfDate?: string | number | null;
}

export interface TradeContextNormalizedPayload {
  teams: PayloadTeam[];
  capProjections?: TradeValidatorCapProjections | null;
  tradeCtx?: TradeContextTradeBridge | null;
  asOfDate?: string | number | null;
}

export interface CurrentStateTeamEntry {
  teamCode: string | null;
  team: AnyRecord;
}

export interface TradeContextCurrentState {
  teams: CurrentStateTeamEntry[];
  governedCashTeamSnapshots?: GovernedCashSnapshotReceipt[] | null;
}

export interface OutgoingTradeRouteLike {
  receivingTeamIndex?: string | number | null;
  receivingTeamId?: string | number | null;
  tradeTo?: string | number | null;
  toTeamId?: string | number | null;
  destTeamId?: string | number | null;
}

export interface BuildPostTradeTeamsSnapshotParams {
  payload: TradeContextPayload;
  currentState: TradeContextCurrentState;
  seasonId: string;
  timestamp: number;
}

export interface ValidatePostTradeSnapshotForContextParams {
  snapshot: PostTradeSnapshot;
  payload: TradeContextPayload;
  seasonId: string;
}

export interface BuildTradeApplyPreparationParams {
  payload: TradeContextPayload;
  currentState: TradeContextCurrentState;
  seasonId: string;
  timestamp: number;
  asOfDate?: string | number | null;
}

export interface TradeApplyPreparation {
  postTradeSnapshot: PostTradeSnapshot;
  validatedContext: ValidatedTradeContext;
  validationPayload: TradeContextPayload;
}

export interface AssertTradeComputeInputsParams {
  postTradeSnapshot: unknown;
  validatedContext: unknown;
  callSite?: string;
}
