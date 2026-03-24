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

export interface TradeContextPayload extends AnyRecord {
  teams: PayloadTeam[];
  capProjections?: TradeValidatorCapProjections | null;
  tradeCtx?:
    | (TradeValidatorContext & {
        enforceSignAndTradePreflight?: boolean | null;
      })
    | null;
  asOfDate?: string | number | null;
}

export interface CurrentStateTeamEntry {
  teamCode: string | null;
  team: ArchitectMutationTeamRecord;
}

export interface TradeContextCurrentState extends AnyRecord {
  teams: CurrentStateTeamEntry[];
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
