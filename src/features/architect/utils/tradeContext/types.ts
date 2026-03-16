export type AnyRecord = Record<string, unknown>;

export interface TeamUpdate {
  teamCode: string;
  team: AnyRecord;
}

export interface ValidationIssue {
  message: string;
  severity: 'error' | 'warning' | string;
  rule: string;
  code: string;
  details?: unknown;
  meta?: Record<string, unknown> | null;
}

export interface TeamResult extends AnyRecord {
  createdTPE?: AnyRecord;
  rules?: AnyRecord;
  violations?: ValidationIssue[];
  warnings?: ValidationIssue[];
}

export interface ValidationTeam extends AnyRecord {
  team: AnyRecord;
  teamCode: string;
  sends: AnyRecord[];
  receives: AnyRecord[];
  picksOut: AnyRecord[];
  picksIn: AnyRecord[];
  cashSent: number;
  cashReceived: number;
}

export interface PostTradeSnapshot extends AnyRecord {
  teamUpdates: TeamUpdate[];
  validationTeams: ValidationTeam[];
  payloadTeams: AnyRecord[];
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
  summaryByTeamIndex: any[];
  capSettings: AnyRecord | null;
  capSettingsSource: string | null;
  capSettingsWarnings: any[];
  dataWarnings: any[];
  hasDataIssues: boolean;
  tradeReceipt: AnyRecord | null;
  validationTeams: ValidationTeam[];
  _rawValidation?: AnyRecord;
  _isValidatedTradeContext: true;
  yearKey?: number | string;
  seasonKey?: string | null;
  asOfDate?: string | null;
  tradeDate?: string | null;
  offseason?: boolean | null;
}

export interface PayloadTeam extends AnyRecord {
  team?: AnyRecord;
  teamCode?: string;
  teamId?: string;
  sends?: AnyRecord[];
  receives?: AnyRecord[];
  picksOut?: AnyRecord[];
  picksIn?: AnyRecord[];
  cashSent?: number;
  cashReceived?: number;
  outgoingEntitlements?: AnyRecord[];
  entitlementsOut?: AnyRecord[];
}

export interface TradeContextPayload extends AnyRecord {
  teams: PayloadTeam[];
  capProjections?: AnyRecord;
  tradeCtx?: AnyRecord;
  asOfDate?: string | null;
}

export interface CurrentStateTeamEntry {
  teamCode: string;
  team: AnyRecord;
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
