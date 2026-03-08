/**
 * Common interfaces for trade validation
 *
 * IMPORTANT (Phase 66):
 * These are INTERNAL COMPUTE types for trade validation, NOT persisted shapes.
 * For canonical persisted team schema, see src/schemas/architect.ts (ExceptionsZ).
 * The persisted team doc uses `team.exceptions.tpe[]` as the ONLY canonical TPE location.
 * `tradeExceptions` in NormalizedTeam is populated via getTeamTpeList() accessor.
 */

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
  salaryOut: number;
  salaryIn: number;
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
  incomingTwoWay: number;
  outgoingTwoWay: number;
}

export interface SalaryMatchingResult extends ValidationResult {
  allowable?: number;
  salaryIn: number;
  salaryOut: number;
  difference: number;
  ceiling?: number;
}

export interface RosterResult extends ValidationResult {
  rosterCounts?: {
    standard: number;
    twoWay: number;
    projected?: number;
    current?: number;
    incomingTwoWay?: number;
    outgoingTwoWay?: number;
  };
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
