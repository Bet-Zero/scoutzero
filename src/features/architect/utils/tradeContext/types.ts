import type {
  TradeSummaryByTeamIndexRow,
  TradeTeamResult,
  TradeValidationResult,
  TradeValidatorCapProjections,
  TradeValidatorContext,
  TradeValidatorCapSettings,
  ValidationIssue as TradeValidationIssue,
} from '@/features/architect/utils/tradeMachine/constants/types';
import type {
  ArchitectMutationTeamRecord,
  ArchitectTradePayloadPlayer,
  ArchitectTradePayloadTeam,
} from '@/features/architect/utils/mutationPipeline';

// Narrow support surface for mutationPipeline's live trade path.
// This layer still consumes mixed validator/runtime blobs, so `any` remains
// localized here instead of leaking through the primary mutation file.
export type AnyRecord = Record<string, any>;

export interface TeamUpdate {
  teamCode: string | null;
  team: ArchitectMutationTeamRecord;
}

export type ValidationIssue = TradeValidationIssue;

export type TeamResult = TradeTeamResult & AnyRecord;

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

export interface ValidatedTradeContext extends AnyRecord {
  legal: boolean;
  valid: boolean;
  reason: string | null;
  error: string | null;
  violations: ValidationIssue[];
  warnings: ValidationIssue[];
  teamResults: TeamResult[];
  summaryByTeamIndex: TradeSummaryByTeamIndexRow[];
  performance?: TradeValidationResult['performance'];
  tradeReceipt: TradeValidationResult['tradeReceipt'] | AnyRecord | null;
  dataWarnings: TradeValidationResult['dataWarnings'];
  hasDataIssues: boolean;
  yearKey: number | string | null;
  seasonKey?: string | null;
  capSettings: TradeValidatorCapSettings | null;
  capSettingsSource: string | null;
  capSettingsWarnings: string[];
  asOfDate: string | null;
  tradeDate: string | null;
  offseason: boolean | null;
  validationTeams: ValidationTeam[];
  _rawValidation?: TradeValidationResult | AnyRecord;
  _isValidatedTradeContext: true;
}

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
