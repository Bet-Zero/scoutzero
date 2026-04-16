import type {
  TradeTeamResult,
  TradeValidationResult,
  TradeValidatorCapProjections,
  TradeValidatorContext,
  ValidationIssue as TradeValidationIssue,
} from '@/features/architect/utils/tradeMachine/constants/types';
import type {
  ArchitectMutationTeamRecord,
  ArchitectTradePayloadPlayer,
  ArchitectTradePayloadPlayerIngress,
  ArchitectTradePayloadTeam,
  ArchitectTradePayloadTeamIngress,
} from '@/features/architect/utils/mutationPipeline';

// Local object-shape carrier for snapshot-building compatibility paths.
// Validator output is narrowed below to the exact live trade bridge contract.
export type AnyRecord = Record<string, any>; // load-bearing bridge type: snapshot-building paths require any-valued records for legacy validator compatibility

export interface TeamUpdate {
  teamCode: string | null;
  team: ArchitectMutationTeamRecord;
}

export type ValidationIssue = TradeValidationIssue;

export type TeamResult = TradeTeamResult;

export interface ValidationTeam {
  team: ArchitectMutationTeamRecord;
  teamCode: string | null;
  sends: ArchitectTradePayloadPlayer[];
  receives: ArchitectTradePayloadPlayer[];
  picksOut: NonNullable<ArchitectTradePayloadTeam['picksOut']>;
  picksIn: NonNullable<ArchitectTradePayloadTeam['picksOut']>;
  cashSent: number;
  cashReceived: number;
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
export type PayloadTeamIngress = ArchitectTradePayloadTeamIngress;
export type PayloadPlayerIngress = ArchitectTradePayloadPlayerIngress;

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
  team: ArchitectMutationTeamRecord;
}

export interface TradeContextCurrentState {
  teams: CurrentStateTeamEntry[];
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
