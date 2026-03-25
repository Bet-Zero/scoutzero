export interface ValidationIssueLike {
  message?: string;
  reason?: string;
  rule?: string;
  severity?: string;
  meta?: Record<string, unknown>;
}

export interface ValidationRuleLike {
  passed?: boolean | null;
  violations?: Array<ValidationIssueLike | string> | null;
  warnings?: Array<ValidationIssueLike | string> | null;
  message?: string;
  details?: string;
  skipReason?: string | null;
}

export interface TeamPlayerLike {
  id?: string;
  player_id?: string;
  name?: string;
  fullName?: string;
  salary?: number;
  baseSalary?: number;
  matchingValue?: number;
  matchIncoming?: number;
  absorptionMode?: string | null;
  tpeId?: string | null;
  tpeIndex?: number;
  flags?: Record<string, unknown> | null;
}

export interface TeamEntitlementLike {
  id?: string;
  entitlementId?: string;
  seasonYear?: string | number;
  round?: string | number;
  kind?: string;
  description?: string;
  fromTeam?: string;
  toTeamId?: string;
}

export interface TpeLike {
  id?: string;
  amount?: number;
  remaining?: number;
  totalAmount?: number;
  remainingAmount?: number;
  name?: string;
  createdFrom?: string;
  expirationDate?: string;
  expiresOn?: string;
}

export interface FaExceptionBucketLike {
  type?: string;
  remaining?: number;
  amount?: number;
  label?: string;
  name?: string;
}

export interface TeamCoreLike {
  id?: string;
  nickname?: string;
  teamName?: string;
  teamTotalSalary?: number;
  totalSalary?: number;
  entitlements?: TeamEntitlementLike[];
  tradeExceptions?: TpeLike[];
  faExceptionBuckets?: FaExceptionBucketLike[];
}

export interface TeamLike {
  team?: TeamCoreLike | null;
  sends?: TeamPlayerLike[];
  picksOut?: TeamEntitlementLike[];
  entitlementsOut?: TeamEntitlementLike[];
}

export interface TeamResultLike {
  teamId?: string;
  teamCode?: string;
  teamName?: string;
  legal?: boolean;
  salaryIn?: number;
  salaryOut?: number;
  totalSalary?: number;
  projectedSalary?: number;
  hardCapped?: boolean | number;
  apronStatus?: string;
  createdTPE?: Record<string, unknown> | null;
  incomingPlayers?: TeamPlayerLike[];
  outgoingPlayers?: TeamPlayerLike[];
  incomingEntitlements?: TeamEntitlementLike[];
  outgoingEntitlements?: TeamEntitlementLike[];
  faExceptionBuckets?: FaExceptionBucketLike[];
  rules?: Record<string, ValidationRuleLike | undefined>;
  violations?: Array<ValidationIssueLike | string>;
  warnings?: Array<ValidationIssueLike | string>;
}

export interface SummaryTeamLike {
  teamId?: string;
  teamCode?: string;
  teamName?: string;
  playersOut?: string | string[];
  playersIn?: string | string[];
  capDelta?: number;
  legal?: boolean;
  violations?: Array<ValidationIssueLike | string>;
  warnings?: Array<ValidationIssueLike | string>;
}

export interface DataWarningLike {
  severity?: string;
  message?: string;
}

export interface DataValidationSummaryLike {
  totalPlayers?: number;
  bycPlayers?: number;
  bycMissingPrevSalary?: number;
  salaryFallbacks?: number;
  salaryMissing?: number;
}

export interface CapSettingsLike {
  salaryCap?: number;
  cap?: number;
  firstApron?: number;
  secondApron?: number;
  firstApronLine?: number;
  secondApronLine?: number;
  luxuryTax?: number;
}

export interface TradeReceiptTeamLike {
  teamName?: string;
  teamCode?: string;
  preTradeTeamSalary?: number;
  preTradeTeamSalarySource?: string;
  salaryMatchingEvaluation?: Record<string, unknown> | null;
  totals?: Record<string, unknown> | null;
  outgoingPlayers?: TeamPlayerLike[];
  incomingPlayers?: TeamPlayerLike[];
  outgoingEntitlements?: TeamEntitlementLike[];
  incomingEntitlements?: TeamEntitlementLike[];
  violations?: Array<ValidationIssueLike | string>;
  warnings?: Array<ValidationIssueLike | string>;
}

export interface TradeReceiptLike {
  isLegal?: boolean;
  validatorVersion?: string | number;
  yearKey?: string | number;
  seasonKey?: string;
  teams?: TradeReceiptTeamLike[];
  allViolations?: Array<ValidationIssueLike | string>;
  performance?: Record<string, unknown> | null;
  capSettingsUsed?: CapSettingsLike | null;
  capSettingsSource?: string;
  capSettingsWarnings?: string[];
  primaryViolation?: string;
}

export interface ValidationResultLike {
  legal?: boolean;
  override?: Record<string, unknown> | null;
  violations?: Array<ValidationIssueLike | string>;
  warnings?: Array<ValidationIssueLike | string>;
  summaryByTeamIndex?: Array<SummaryTeamLike | null | undefined>;
  teamResults?: TeamResultLike[];
  capSettings?: CapSettingsLike | null;
  tradeReceipt?: TradeReceiptLike | null;
  dataWarnings?: DataWarningLike[];
  dataValidationSummary?: DataValidationSummaryLike | null;
  hasDataIssues?: boolean;
  // TM-TRUTH-E2: Preview coverage tier metadata
  previewTier?: 'cba-validator';
  applyOnlyGates?: string[];
}
