/**
 * Wave 18 Step 1: Private type definitions extracted from tradeValidator.ts.
 */

import type { normalizeValidationIssues } from '../utils/validationIssueText';
import type { DataWarning } from '../utils/dataValidation';
import type {
  TradeReceipt,
  TradeTeamResult,
  TradeSummaryByTeamIndexRow,
  TradeValidatorContext,
  TradeFaExceptionBucket,
  TradeExceptionPlayer,
  ValidationIssueLike,
} from '../constants/types';

export type TradeValidatorPlayer = TradeExceptionPlayer & {
  player_id?: string;
  playerName?: string;
  playerId?: string;
  teamCode?: string | null;
  currentSalary?: number;
  previousSalary?: number;
  extensionYears?: Array<{
    season?: string | null;
    year?: number | string | null;
    salary?: number | string | null;
    [key: string]: unknown;
  }>;
  tradeKicker?: {
    percentage?: number;
    waived?: number;
    maximum?: unknown;
  };
  tradeKickerPct?: number;
  tradeKickerWaivedPct?: number;
  isBYC?: boolean;
  baseYearCompensation?: boolean;
  isPoisonPill?: boolean;
  signAndTrade?: boolean;
  isTwoWay?: boolean;
};

import type { TradeTeam } from '../constants/types';

export type TradeValidatorTeamData = NonNullable<TradeTeam['team']> & {
  players?: TradeValidatorPlayer[];
  twoWayPlayers?: TradeValidatorPlayer[];
  faExceptionBuckets?: TradeFaExceptionBucket[];
  hardCapped?: boolean | string;
  hardCapFirstApron?: {
    active?: boolean;
    reason?: string | null;
    season?: string | null;
  } | null;
};

export type TradeValidatorEntitlement = {
  entitlementId?: string;
  id?: string;
  seasonYear?: number | string;
  round?: number | string;
  kind?: string;
  description?: string;
  toTeamId?: string | null;
  draftKey?: string;
  terms?: unknown;
  termsShort?: unknown;
  linkedEntitlementIds?: string[];
};

export type TradeValidatorTeamSlot = TradeTeam & {
  teamId?: string;
  teamCode?: string;
  sends?: TradeValidatorPlayer[];
  outgoingPlayers?: TradeValidatorPlayer[];
  incomingPlayers?: TradeValidatorPlayer[];
  entitlementsOut?: TradeValidatorEntitlement[];
  outgoingEntitlements?: TradeValidatorEntitlement[];
  validationEntitlements?: TradeValidatorEntitlement[];
  teamTotalSalary?: number;
  salaryOut?: number;
  salaryIn?: number;
  projectedSalary?: number;
  cashSent?: number;
  cashReceived?: number;
  notes?: unknown;
  context?: TradeValidatorContext;
  team?: TradeValidatorTeamData | null;
};

export type TradeValidatorActiveTeamSlot = TradeValidatorTeamSlot & {
  team: TradeValidatorTeamData;
};

export type RuleEnvelopeObjectLike = {
  passed?: boolean;
  status?: string;
  evaluated?: boolean;
  missingInputs?: readonly string[];
  violations?: Parameters<typeof normalizeValidationIssues>[0];
  warnings?: Parameters<typeof normalizeValidationIssues>[0];
  message?: string | null;
  sourceType?: string | null;
  details?: unknown;
  skipReason?: string | null;
  allowableIncoming?: number | null;
  salaryIn?: number | null;
  hardCapped?: boolean;
  hardCapStatus?: {
    isHardCapped?: boolean;
  } | null;
};

export type RuleEnvelopeLike =
  | ValidationIssueLike[]
  | RuleEnvelopeObjectLike
  | null
  | undefined;

export type TeamIdentityLike = {
  teamCode?: unknown;
  id?: unknown;
  teamId?: unknown;
  code?: unknown;
  abbreviation?: unknown;
};

export type SignAndTradeResultLike = {
  hardCapped?: boolean;
};

export type HardCapStatusLike = {
  isHardCapped?: boolean;
};

export type SalaryMatchingReceiptDetailsLike = {
  totalSalarySource?: string;
  ruleApplied?: string | null;
  formulaUsed?: string | null;
  margin?: number | null;
  capSettingsSource?: string;
  pathEvaluation?:
    | import('../utils/tradeSalaryMatchingPaths').TradeSalaryPathEvaluation
    | null;
};

export type SalaryMatchingReceiptRuleLike = {
  skipReason: string | null;
  allowableIncoming: number | null;
  salaryIn: number | null;
  passed: boolean | null;
  details: SalaryMatchingReceiptDetailsLike;
};

export interface BuildValidationResultParams {
  legal: boolean;
  reason?: string | null;
  error?: string | null;
  violations?: ValidationIssueLike[];
  warnings?: ValidationIssueLike[];
  teamResults?: TradeTeamResult[];
  summaryByTeamIndex?: TradeSummaryByTeamIndexRow[];
  validationTime: number;
  tradeReceipt?: TradeReceipt | null;
  dataWarnings?: DataWarning[];
  context?: TradeValidatorContext;
}

export interface GenerateTradeReceiptParams {
  teamsWithAssets: TradeValidatorTeamSlot[];
  teamResults: TradeTeamResult[];
  context: TradeValidatorContext;
  isOverallLegal: boolean;
  reason: string;
  validationTime: number;
}
