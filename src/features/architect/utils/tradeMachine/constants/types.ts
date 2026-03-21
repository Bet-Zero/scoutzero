/**
 * Common interfaces for trade validation
 *
 * IMPORTANT (Phase 66):
 * These are INTERNAL COMPUTE types for trade validation, NOT persisted shapes.
 * For canonical persisted team schema, see src/schemas/architect.ts (ExceptionsZ).
 * The persisted team doc uses `team.exceptions.tpe[]` as the ONLY canonical TPE location.
 * `tradeExceptions` in NormalizedTeam is populated via getTeamTpeList() accessor.
 */

import type { DataWarning } from '../utils/dataValidation';

// Normalized cap settings
export interface CapSettings {
  salaryCap: number;
  firstApron: number;
  apron?: number;
  secondApron: number;
  taxLine: number;
  fullMLE: number;
  roomMLE: number;
  bae: number;
  [key: string]: unknown;
}

// Normalized player data
export interface NormalizedPlayer {
  name: string;
  salary: number;
  matchIncoming: number;
  matchOutgoing: number;
  isTwoWay: boolean;
  absorptionMode: 'MATCH' | 'TPE' | 'FA_EXCEPTION';
  signAndTrade: boolean;
  contractYears: number;
  firstYearGuaranteed: boolean;
  tpeId?: string;
  fromTeamId?: string;
  toTeamId?: string;
  [key: string]: unknown; // Allow additional properties
}

export interface TradeExceptionPlayer {
  id?: string;
  name?: string;
  displayName?: string;
  salary?: number;
  matchIncoming?: number;
  matchOutgoing?: number;
  absorptionMode?: 'MATCH' | 'TPE' | 'FA_EXCEPTION' | string;
  signAndTrade?: boolean;
  tpeId?: string;
  fromTeamId?: string;
  toTeamId?: string;
  [key: string]: unknown;
}

export interface TradeExceptionRecord {
  id?: string;
  amount?: number;
  totalAmount?: number;
  remaining?: number;
  remainingAmount?: number;
  expiresOn?: string | null;
  expirationDate?: string | null;
  expiryISO?: string | null;
  expiryDate?: string | null;
  createdSeason?: number;
  season?: number;
  createdAtSeason?: number;
  isUsed?: boolean;
  isBeingUsed?: boolean;
  sourceRef?: TradeExceptionRecord | Record<string, unknown> | null;
  [key: string]: unknown;
}

export interface NormalizedTradeExceptionRecord extends TradeExceptionRecord {
  id: string;
  amount: number;
  totalAmount: number;
  remaining: number;
  remainingAmount: number;
}

export type NormalizedTPE = NormalizedTradeExceptionRecord;

export interface CanonicalTeamTpeUsageEntry {
  tpeId: string;
  tpe: NormalizedTradeExceptionRecord | null;
  players: TradeExceptionPlayer[];
  totalUsage: number;
  source: 'playerAssignment' | 'compatibilityInput';
}

export interface UnresolvedTpeUsage {
  player: TradeExceptionPlayer | null;
  tpeId: string | null;
  reason: 'missingTpeId' | 'missingOnTeam';
}

export interface CanonicalTeamTpeUsage {
  availableTpes: NormalizedTradeExceptionRecord[];
  usedTpes: CanonicalTeamTpeUsageEntry[];
  unresolvedPlayers: UnresolvedTpeUsage[];
  usesTpe: boolean;
}

// Normalized team data
// NOTE: This is an INTERNAL COMPUTE type, NOT the persisted shape.
// The `tradeExceptions` field is populated via getTeamTpeList() accessor
// which reads from canonical `team.exceptions.tpe[]` (or legacy fallback).
export interface NormalizedTeam {
  team: {
    id: string;
    teamName: string;
    teamTotalSalary: number;
    projectedSalary: number;
    players: NormalizedPlayer[];
    twoWayPlayers: NormalizedPlayer[];
    /** @deprecated Internal compute only - populated via getTeamTpeList() */
    tradeExceptions: TradeExceptionRecord[];
    exceptions?: {
      tpe?: TradeExceptionRecord[];
      [key: string]: unknown;
    };
    cashLedger?: {
      totalOut?: number;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
  sends: NormalizedPlayer[];
  picksOut: Array<{
    year: number | string;
    round: number | string;
    [key: string]: unknown;
  }>;
  cashSent: number;
  cashReceived?: number;
  hardCapped: boolean;
  appliedTPEs: TradeExceptionRecord[];
  [key: string]: unknown;
}

// Normalized trade input
export interface NormalizedTradeInput {
  teams: NormalizedTeam[];
  capSettings: CapSettings;
  yearKey: number;
  tradeCtx: {
    tradeDate: string;
    [key: string]: unknown;
  };
}

export interface ValidationIssue {
  message: string;
  severity: 'error' | 'warning';
  rule: string;
  code: string;
  details?: unknown;
  meta?: Record<string, unknown> | null;
}

export type ValidationIssueLike = ValidationIssue | string;
export type HardCapTypeCanonical = 'FIRST_APRON' | 'SECOND_APRON' | 'UNKNOWN';
export type HardCapTypeLegacy = 'FirstApron' | 'SecondApron' | 'Unknown';

export interface HardCapStatusResult {
  isHardCapped: boolean;
  reason: string | null;
  source: string;
  hardCapType: HardCapTypeCanonical | null;
  hardCapTypeLegacy: HardCapTypeLegacy | null;
  hardCapCeiling: number | null;
  hardCapCeilingType: Exclude<HardCapTypeCanonical, 'UNKNOWN'> | null;
  hardCapCeilingLabel: string | null;
  failClosed: boolean;
}

export interface HardCapCapLimits {
  firstApron: number;
  secondApron: number;
}

export interface AuthoritativeSalaryMatchingCapSettings {
  salaryCap: number;
  firstApron: number;
  secondApron: number;
}

export interface AuthoritativeSalaryMatchingHardCapCeilingDetails {
  ceiling: number;
  apron: number | null;
  apronLabel: string | null;
  limiter: 'hardCap' | 'salaryMatching';
}

export interface AuthoritativeSalaryMatchingDetails {
  ruleApplied: string;
  formulaUsed: string;
  capSettings?: AuthoritativeSalaryMatchingCapSettings;
  capSettingsSource: string;
  capSettingsWarnings?: string[];
  totalSalary?: number;
  totalSalarySource?: string;
  bucketRemaining?: number;
  tpeAbsorbedSalary?: number | null;
  salaryNeedingMatch?: number;
  tpeCount?: number;
  bucketTypes?: unknown[];
  faExceptionAbsorbedSalary?: number | null;
  effectiveSalaryIn?: number;
  margin?: number | null;
  hardCapStatus?: HardCapStatusResult | null;
  hardCapCeiling?: AuthoritativeSalaryMatchingHardCapCeilingDetails | null;
}

export interface AuthoritativeSalaryMatchingResult {
  passed: boolean;
  applicable: boolean;
  skipReason: string | null;
  allowableIncoming: number | null;
  violations: ValidationIssueLike[];
  warnings?: ValidationIssueLike[];
  salaryIn?: number;
  salaryOut?: number;
  hardCapIncomingCeiling?: number | null;
  effectiveAllowableIncoming?: number | null;
  tpeAbsorbedSalary?: number | null;
  faExceptionAbsorbedSalary?: number | null;
  difference?: number;
  message?: string;
  warningsOnly?: boolean;
  usingTPE?: boolean;
  details: AuthoritativeSalaryMatchingDetails;
  [key: string]: unknown;
}

// Common validation result interface
export interface ValidationResult {
  passed: boolean;
  violations: ValidationIssue[];
  warnings?: ValidationIssue[];
  message: string;
  details?: unknown;
  warningsOnly?: boolean;
  [key: string]: unknown;
}

export interface TeamContext {
  capSettings?: {
    salaryCap?: number;
    firstApron?: number;
    apron?: number;
    secondApron?: number;
    taxLine?: number;
  };
  yearKey?: number | string;
  tradeDate?: string;
  asOfDate?: string;
  season?: number | string;
  teams?: TradeTeam[];
  wasTradedAwayWithinOneYear?: (playerId: unknown, destTeamId: unknown) => boolean;
  [key: string]: unknown;
}

export interface TradeTeam {
  teamId?: string;
  teamName?: string;
  bucketType?: string;
  salaryOut?: number;
  salaryIn?: number;
  teamTotalSalary?: number;
  projectedSalary?: number;
  projectedRosterCount?: number;
  initialRosterCount?: number;
  hardCapped?: boolean;
  hardCapTrigger?: string | null;
  absorptionMode?: string;
  incomingPlayers?: TradeExceptionPlayer[];
  outgoingPlayers?: TradeExceptionPlayer[];
  sends?: TradeExceptionPlayer[];
  receives?: TradeExceptionPlayer[];
  tradeExceptions?: TradeExceptionRecord[];
  appliedTPEs?: TradeExceptionRecord[];
  cashSent?: number;
  cashReceived?: number;
  outgoingPicks?: Array<Record<string, unknown>>;
  postTradeStatus?: {
    isAtOrAboveSecondApron?: boolean;
  };
  team?: {
    id?: string;
    teamId?: string;
    teamCode?: string;
    teamName?: string;
    name?: string;
    nickname?: string;
    teamTotalSalary?: number;
    totalSalary?: number;
    hardCapTriggered?: boolean | 'FirstApron' | 'SecondApron';
    twoWayPlayers?: Array<Record<string, unknown>>;
    picks?: Array<Record<string, unknown>>;
    tradeExceptions?: TradeExceptionRecord[];
    exceptions?: {
      tpe?: TradeExceptionRecord[];
      [key: string]: unknown;
    };
    cashLedger?: {
      totalOut?: number;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
  context?: TeamContext;
  capSettings?: CapSettings;
  [key: string]: unknown;
}

export interface RosterCounts {
  standard: number;
  twoWay: number;
  projected: number;
  current: number;
}

export interface SalaryMatchingResult extends ValidationResult {
  allowable?: number;
  salaryIn: number;
  salaryOut: number;
  difference: number;
  ceiling?: number;
}

export interface RosterResult {
  passed: boolean;
  violations: string[];
  warnings?: string[];
  message: string;
  details: string;
  warningsOnly: boolean | null;
  rosterCounts: RosterCounts;
  [key: string]: unknown;
}

export interface AuthoritativeHardCapResult {
  passed: boolean;
  violations: ValidationIssueLike[];
  warnings?: ValidationIssueLike[];
  message?: string;
  details?: unknown;
  warningsOnly?: boolean;
  projectedSalary?: number;
  hardCapType?: 'FirstApron' | 'SecondApron' | null;
  hardCapTypeCanonical?: HardCapTypeCanonical | null;
  hardCapStatus?: HardCapStatusResult | null;
  capLimits?: HardCapCapLimits;
  trigger?: string | null;
  [key: string]: unknown;
}

export interface HardCapResult extends ValidationResult {
  projectedSalary: number;
  hardCapType?: 'FirstApron' | 'SecondApron' | null;
  trigger: string | null;
}

export interface StepienResult extends ValidationResult {
  calendar?: Array<Record<string, unknown>>;
  farthestYear: number;
  currentYear: number;
}

export interface TradeExceptionValidationResult extends ValidationResult {
  createdTPE: TradeExceptionRecord | null;
}

export interface CashValidationResult extends ValidationResult {}

export interface ConsentValidationResult extends ValidationResult {}

export interface EligibilityValidationResult extends ValidationResult {}

export interface ReacquisitionValidationResult extends ValidationResult {}

export interface TradeValidationNormalizedYear {
  endYear: number;
  seasonString: string;
}

export interface TradeValidatorCapSettings {
  cap?: number;
  salaryCap?: number;
  firstApron?: number;
  secondApron?: number;
  luxuryTax?: number;
  tax?: number;
  fullMLE?: number;
  roomMLE?: number;
  taxpayerMLE?: number;
  [key: string]: unknown;
}

export interface TradeValidatorCapProjectionRow {
  cap?: number;
  salaryCap?: number;
  firstApron?: number;
  secondApron?: number;
  luxuryTax?: number;
  tax?: number;
  fullMLE?: number;
  roomMLE?: number;
  taxpayerMLE?: number;
  confirmed?: boolean;
  growthRate?: number;
}

export interface TradeValidatorCapProjections {
  salaryCap?: number;
  cap?: number;
  firstApron?: number;
  secondApron?: number;
  luxuryTax?: number;
  tax?: number;
  fullMLE?: number;
  roomMLE?: number;
  taxpayerMLE?: number;
  [seasonKey: string]: TradeValidatorCapProjectionRow | number | undefined;
}

export interface TradeFaExceptionBucket {
  type?: string | null;
  name?: string | null;
  label?: string | null;
  amount?: number | null;
  remaining?: number | null;
  remainingAmount?: number | null;
  [key: string]: unknown;
}

export interface TradeValidatorContext extends TeamContext {
  capProjections?: TradeValidatorCapProjections;
  currentYear?: number;
  yearKey?: number;
  asOfDate?: string;
  tradeDate?: string;
  offseason?: boolean;
  seasonState?: string;
  capSettings?: TradeValidatorCapSettings;
  capSettingsSource?: string;
  capSettingsWarnings?: string[];
  normalizedYear?: TradeValidationNormalizedYear | null;
  teams?: TradeTeam[];
  daysRemainingInSeason?: number;
  daysInSeason?: number;
}

export interface ValidateTradeParams {
  teams?: Array<TradeTeam | null | undefined> | null;
  capProjections?: TradeValidatorCapProjections | null;
  currentYear?: number | string | null;
  tradeCtx?: TradeValidatorContext | null;
}

export interface TradeRuleEnvelope extends ValidationResult {
  key: string;
  sourceType: 'validator' | 'enforcement' | string;
  warnings: ValidationIssue[];
  details: unknown;
  [key: string]: unknown;
}

export interface TradeTeamSalaryMatchingCalculations {
  allowedIncoming: number;
  margin: number;
  difference: number;
}

export interface TradeTeamCalculations {
  salaryIn: number;
  salaryOut: number;
  salaryMatching: TradeTeamSalaryMatchingCalculations;
}

export interface TradeTeamResult {
  teamId: string;
  teamCode: string;
  teamName: string;
  legal: boolean;
  violations: ValidationIssue[];
  warnings: ValidationIssue[];
  rules: Record<string, TradeRuleEnvelope>;
  salaryOut: number;
  salaryIn: number;
  outgoingPlayers: TradeExceptionPlayer[];
  incomingPlayers: TradeExceptionPlayer[];
  calculations: TradeTeamCalculations;
  totalSalary: number;
  projectedSalary: number;
  capRoom: number;
  hardCapped: boolean;
  apronStatus: '2nd Apron' | '1st Apron' | 'Below Aprons';
  faExceptionBuckets: TradeFaExceptionBucket[];
  notes: unknown;
  createdTPE: TradeExceptionRecord | null;
  details: string;
  warningDetails: string;
  [key: string]: unknown;
}

export interface TradeSummaryByTeamIndexRow {
  playersOut: string;
  playersIn: string[];
  capDelta: number;
  teamId: string;
  teamCode: string;
  legal: boolean;
  violations: ValidationIssue[];
  warnings: ValidationIssue[];
  teamName: string;
}

export interface TradeReceiptPlayerFlags {
  isBYC: boolean;
  isPoisonPill: boolean;
  hasTradeKicker: boolean;
  tradeKickerPct: number;
  isSignAndTrade: boolean;
}

export interface TradeReceiptBycDetails {
  previousSalary: number;
  fiftyPercentNew: number;
  method: 'previousSalary' | '50%_of_new';
}

export interface TradeReceiptPoisonPillDetails {
  currentSalary: number;
  extensionYears: Array<Record<string, unknown>>;
  averagedSalary: number;
  method: 'averaging_current_plus_extensions';
}

export interface TradeReceiptTradeKickerDetails {
  percentage: number;
  kickerAmount: number;
  waivedPct: number;
  maximum: unknown;
}

export interface TradeReceiptPlayerRow {
  id?: string;
  name: string;
  baseSalary: number;
  matchingValue: number;
  flags: TradeReceiptPlayerFlags;
  bycDetails?: TradeReceiptBycDetails | null;
  poisonPillDetails?: TradeReceiptPoisonPillDetails | null;
  tradeKickerDetails?: TradeReceiptTradeKickerDetails | null;
}

export interface TradeReceiptEntitlementRow {
  id?: string;
  seasonYear?: number | string;
  round?: number | string;
  kind?: string;
  description?: string;
  fromTeam?: string;
  toTeamId?: string | null;
  draftKey?: string;
  terms?: unknown;
  termsShort?: unknown;
}

export interface TradeReceiptSalaryMatchingEvaluation {
  ruleApplied: string | null;
  skipReason: string | null;
  formulaUsed: string | null;
  allowableIncoming: number | null;
  actualIncoming: number | null;
  passed: boolean | null;
  margin: number | null;
  capSettings: TradeValidatorCapSettings | null | undefined;
  capSettingsSource: string;
}

export interface TradeReceiptTeamRow {
  teamCode: string;
  teamName: string;
  preTradeTeamSalary: number;
  preTradeTeamSalarySource: string;
  outgoingPlayers: TradeReceiptPlayerRow[];
  incomingPlayers: TradeReceiptPlayerRow[];
  outgoingEntitlements: TradeReceiptEntitlementRow[];
  incomingEntitlements: TradeReceiptEntitlementRow[];
  totals: {
    outgoingBaseTotal: number;
    outgoingMatchingTotal: number;
    incomingBaseTotal: number;
    incomingMatchingTotal: number;
  };
  salaryMatchingEvaluation: TradeReceiptSalaryMatchingEvaluation;
  violations: ValidationIssue[];
  warnings: ValidationIssue[];
}

export interface TradeReceipt {
  isLegal: boolean;
  primaryViolation: string | null;
  allViolations: ValidationIssue[];
  timestamp: string;
  validatorVersion: string;
  salaryMatchingVersion: string;
  capSettingsVersion: string;
  yearKey: number | undefined;
  seasonKey: string;
  capSettingsUsed: {
    salaryCap: number;
    firstApron: number;
    secondApron: number;
    luxuryTax: number;
  };
  capSettingsSource: string;
  capSettingsWarnings: string[];
  teams: TradeReceiptTeamRow[];
  performance: {
    validationTimeMs: number;
  };
}

export interface TradeValidationResult {
  legal: boolean;
  valid: boolean;
  error: string | null;
  reason: string;
  violations: ValidationIssue[];
  warnings: ValidationIssue[];
  teamResults: TradeTeamResult[];
  summaryByTeamIndex: TradeSummaryByTeamIndexRow[];
  performance: {
    validationTime: number;
  };
  tradeReceipt: TradeReceipt | null;
  dataWarnings: DataWarning[];
  hasDataIssues: boolean;
  yearKey: number | null;
  seasonKey: string | null;
  capSettings: TradeValidatorCapSettings | null;
  capSettingsSource: string | null;
  capSettingsWarnings: string[];
  asOfDate: string | null;
  tradeDate: string | null;
  offseason: boolean | null;
}
