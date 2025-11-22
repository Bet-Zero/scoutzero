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
  [key: string]: any; // Allow additional properties
}

// Normalized trade exception
export interface NormalizedTPE {
  id: string;
  amount: number;
  remaining: number;
  expiryDate?: string;
  createdSeason?: number;
  [key: string]: any;
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
    [key: string]: any;
  };
  sends: NormalizedPlayer[];
  picksOut: any[];
  cashSent: number;
  hardCapped: boolean;
  appliedTPEs: NormalizedTPE[];
  [key: string]: any;
}

// Normalized trade input
export interface NormalizedTradeInput {
  teams: NormalizedTeam[];
  capSettings: CapSettings;
  yearKey: number;
  tradeCtx: {
    tradeDate: string;
    [key: string]: any;
  };
}

// Common validation result interface
export interface ValidationResult {
  passed: boolean;
  violations: string[];
  message: string;
  details?: string;
  warningsOnly?: boolean;
  [key: string]: any;
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
  incomingPlayers?: any[];
  outgoingPlayers?: any[];
  outgoingPicks?: any[];
  projectedRosterCount?: number;
  initialRosterCount?: number;
  postTradeStatus?: {
    isAtOrAboveSecondApron?: boolean;
  };
  team?: {
    hardCapTriggered?: boolean | 'FirstApron' | 'SecondApron';
    twoWayPlayers?: any[];
    picks?: any[];
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
    projected?: number;
    current?: number;
    incomingTwoWay?: number;
    outgoingTwoWay?: number;
  };
}

export interface HardCapResult extends ValidationResult {
  projectedSalary: number;
  hardCapType?: 'FirstApron' | 'SecondApron' | null;
  trigger: string | null;
}

export interface StepienResult extends ValidationResult {
  calendar?: any[];
  farthestYear: number;
  currentYear: number;
}
