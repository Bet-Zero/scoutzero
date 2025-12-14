/**
 * Common interfaces for trade validation
 */

// Normalized cap settings
export interface CapSettings {
  salaryCap: number;
  firstApron: number;
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

// Normalized trade exception
export interface NormalizedTPE {
  id: string;
  amount: number;
  remaining: number;
  expiryDate?: string;
  createdSeason?: number;
  [key: string]: unknown;
}

// Normalized team data
export interface NormalizedTeam {
  team: {
    id: string;
    teamName: string;
    teamTotalSalary: number;
    projectedSalary: number;
    players: NormalizedPlayer[];
    twoWayPlayers: NormalizedPlayer[];
    tradeExceptions: NormalizedTPE[];
    [key: string]: unknown;
  };
  sends: NormalizedPlayer[];
  picksOut: Array<{ year: number | string; round: number | string; [key: string]: unknown }>;
  cashSent: number;
  hardCapped: boolean;
  appliedTPEs: NormalizedTPE[];
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

// Common validation result interface
export interface ValidationResult {
  passed: boolean;
  violations: string[];
  message: string;
  details?: string;
  warningsOnly?: boolean;
  [key: string]: unknown;
}

export interface TeamContext {
  capSettings: {
    salaryCap?: number;
    firstApron?: number;
    secondApron?: number;
    taxLine?: number;
  };
  yearKey: number;
  tradeDate?: string;
}

export interface TradeTeam {
  teamId?: string;
  teamName?: string;
  bucketType?: string;
  salaryOut: number;
  salaryIn: number;
  teamTotalSalary?: number;
  projectedSalary?: number;
  hardCapped?: boolean;
  hardCapTrigger?: string | null;
  absorptionMode?: string;
  incomingPlayers?: Array<Record<string, unknown>>;
  outgoingPlayers?: Array<Record<string, unknown>>;
  team?: {
    hardCapTriggered?: boolean | 'FirstApron' | 'SecondApron';
    twoWayPlayers?: Array<Record<string, unknown>>;
  };
  context?: {
    yearKey: number | string;
    capSettings?: {
      salaryCap?: number;
      firstApron?: number;
      secondApron?: number;
      taxLine?: number;
    };
  };
  capSettings?: CapSettings;
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
  };
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
