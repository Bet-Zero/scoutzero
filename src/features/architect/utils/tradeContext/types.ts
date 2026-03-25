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
  ArchitectTradePayloadTeam,
} from '@/features/architect/utils/mutationPipeline';

// Local object-shape carrier for snapshot-building compatibility paths.
// Validator output is narrowed below to the exact live trade bridge contract.
export type AnyRecord = Record<string, any>;

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
  picksIn: NonNullable<ArchitectTradePayloadTeam['picksIn']>;
  cashSent: number;
  cashReceived: number;
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
  validationTeams: ValidationTeam[];
  _rawValidation?: TradeValidationResult;
  _isValidatedTradeContext: true;
};

export type PayloadTeam = ArchitectTradePayloadTeam;

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

export interface AssertTradeComputeInputsParams {
  postTradeSnapshot: unknown;
  validatedContext: unknown;
  callSite?: string;
}
