export interface ValidationIssueLike {
  message?: string;
  reason?: string;
  rule?: string;
  severity?: string;
  meta?: Record<string, any>;
  [key: string]: any;
}

export interface ValidationRuleLike {
  passed?: boolean | null;
  violations?: Array<ValidationIssueLike | string> | null;
  warnings?: Array<ValidationIssueLike | string> | null;
  message?: string;
  details?: string;
  skipReason?: string | null;
  [key: string]: any;
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
  flags?: Record<string, any> | null;
  [key: string]: any;
}

export interface TeamEntitlementLike {
  id?: string;
  entitlementId?: string;
  seasonYear?: any;
  round?: any;
  kind?: string;
  description?: string;
  fromTeam?: string;
  toTeamId?: string;
  [key: string]: any;
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
  [key: string]: any;
}

export interface FaExceptionBucketLike {
  type?: string;
  remaining?: number;
  amount?: number;
  label?: string;
  name?: string;
  [key: string]: any;
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
  [key: string]: any;
}

export interface TeamLike {
  team?: TeamCoreLike | null;
  sends?: any[];
  picksOut?: any[];
  entitlementsOut?: TeamEntitlementLike[];
  [key: string]: any;
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
  createdTPE?: Record<string, any> | null;
  incomingPlayers?: TeamPlayerLike[];
  outgoingPlayers?: TeamPlayerLike[];
  incomingEntitlements?: TeamEntitlementLike[];
  outgoingEntitlements?: TeamEntitlementLike[];
  faExceptionBuckets?: FaExceptionBucketLike[];
  rules?: Record<string, ValidationRuleLike | undefined>;
  violations?: Array<ValidationIssueLike | string>;
  warnings?: Array<ValidationIssueLike | string>;
  [key: string]: any;
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
  [key: string]: any;
}

export interface DataWarningLike {
  severity?: string;
  message?: string;
  [key: string]: any;
}

export interface DataValidationSummaryLike {
  totalPlayers?: number;
  bycPlayers?: number;
  bycMissingPrevSalary?: number;
  salaryFallbacks?: number;
  salaryMissing?: number;
  [key: string]: any;
}

export interface CapSettingsLike {
  salaryCap?: any;
  cap?: any;
  firstApron?: any;
  secondApron?: any;
  firstApronLine?: any;
  secondApronLine?: any;
  luxuryTax?: any;
  [key: string]: any;
}

export interface TradeReceiptTeamLike {
  teamName?: string;
  teamCode?: string;
  preTradeTeamSalary?: number;
  preTradeTeamSalarySource?: string;
  salaryMatchingEvaluation?: Record<string, any> | null;
  totals?: Record<string, any> | null;
  outgoingPlayers?: TeamPlayerLike[];
  incomingPlayers?: TeamPlayerLike[];
  outgoingEntitlements?: TeamEntitlementLike[];
  incomingEntitlements?: TeamEntitlementLike[];
  violations?: Array<ValidationIssueLike | string>;
  warnings?: Array<ValidationIssueLike | string>;
  [key: string]: any;
}

export interface TradeReceiptLike {
  isLegal?: boolean;
  validatorVersion?: string | number;
  yearKey?: string | number;
  seasonKey?: string;
  teams?: TradeReceiptTeamLike[];
  allViolations?: any[];
  performance?: Record<string, any> | null;
  capSettingsUsed?: CapSettingsLike | null;
  capSettingsSource?: string;
  capSettingsWarnings?: string[];
  primaryViolation?: string;
  [key: string]: any;
}

export interface ValidationResultLike {
  legal?: boolean;
  override?: Record<string, any> | null;
  violations?: Array<ValidationIssueLike | string>;
  warnings?: Array<ValidationIssueLike | string>;
  summaryByTeamIndex?: Array<SummaryTeamLike | null | undefined>;
  teamResults?: TeamResultLike[];
  capSettings?: CapSettingsLike | null;
  tradeReceipt?: TradeReceiptLike | null;
  dataWarnings?: DataWarningLike[];
  dataValidationSummary?: DataValidationSummaryLike | null;
  hasDataIssues?: boolean;
  [key: string]: any;
}
